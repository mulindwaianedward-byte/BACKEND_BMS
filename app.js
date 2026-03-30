/* ══ BACKEND API CONNECTION ════════════════════════════════════
   Replace API_BASE with your Railway URL when deployed.
   Leave as empty string '' to use same-origin (local server).   */
const API_BASE = ''; // e.g. 'https://backendbms-production.up.railway.app'

let authToken = localStorage.getItem('bms_token') || null;

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: 'Bearer ' + authToken } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  };
  const res = await fetch(API_BASE + '/api' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

async function loadAllData() {
  try {
    const [sales, stock, rawMats, customers, suppliers, expenses, users, orders] =
      await Promise.all([
        api('GET', '/sales'),
        api('GET', '/stock'),
        api('GET', '/raw-materials'),
        api('GET', '/customers'),
        api('GET', '/suppliers'),
        api('GET', '/expenses'),
        api('GET', '/users'),
        api('GET', '/orders'),
      ]);
    db.sales = sales;
    db.inventory = stock;       // keeps old key for full compatibility
    db.rawMaterials = rawMats;
    db.customers = customers;
    db.suppliers = suppliers;
    db.expenses = expenses;
    db.users = users;
    db.orders = orders;
  } catch (err) {
    console.error('Failed to load data:', err);
    toast('Could not load data from server. Is the backend running?', 'danger');
  }
}
/* ════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   BMS — Business Management System
   app.js  v2.0 — Role permissions · Working currency · User admin
   ══════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────
// 1.  ROLE PERMISSIONS
//     Lists every page each role is allowed to visit.
//     Add or remove sections here to change access.
// ─────────────────────────────────────────────────────────────
const PERMISSIONS = {
  Admin: ['dashboard', 'sales', 'orders', 'inventory', 'rawMaterials', 'customers', 'suppliers', 'users', 'finance', 'reports', 'notifications', 'settings'],
  Manager: ['dashboard', 'sales', 'reports', 'inventory', 'rawMaterials', 'customers', 'notifications'],
  Employee: ['sales', 'customers', 'notifications']
};

// ─────────────────────────────────────────────────────────────
// 1b. SESSION TIMEOUT  (Manager & Employee only — 20 minutes)
//     The timer resets every time the user clicks or types.
//     When it fires, the user is logged out automatically.
// ─────────────────────────────────────────────────────────────
const SESSION_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes in milliseconds
let sessionTimer = null;

function startSessionTimer() {
  // Only applies to Manager and Employee — Admins stay logged in
  if (!currentUser || currentUser.role === 'Admin') return;
  clearSessionTimer(); // reset any existing timer
  sessionTimer = setTimeout(() => {
    // Time is up — show a message then log out
    alert('⏰ Your session has expired after 20 minutes of inactivity.\nYou have been logged out for security.');
    doLogout();
  }, SESSION_TIMEOUT_MS);
}

function clearSessionTimer() {
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
}

function resetSessionTimer() {
  // Called on every user interaction (click, keypress)
  if (currentUser && currentUser.role !== 'Admin') {
    startSessionTimer();
  }
}

// Listen for any mouse click or keypress to reset the idle timer
document.addEventListener('click', resetSessionTimer);
document.addEventListener('keydown', resetSessionTimer);

// ─────────────────────────────────────────────────────────────
// 2.  CURRENCY SYSTEM
//     All amounts are stored in UGX internally.
//     formatMoney() converts to whatever the user has selected.
// ─────────────────────────────────────────────────────────────
const CURRENCIES = {
  UGX: { symbol: 'UGX', rate: 1, dec: 0, name: 'Ugandan Shilling' },
  USD: { symbol: '$', rate: 0.000272, dec: 2, name: 'US Dollar' },
  KES: { symbol: 'KES', rate: 0.03571, dec: 0, name: 'Kenyan Shilling' },
  EUR: { symbol: '€', rate: 0.000251, dec: 2, name: 'Euro' },
  GBP: { symbol: '£', rate: 0.000215, dec: 2, name: 'British Pound' },
  TZS: { symbol: 'TZS', rate: 0.6849, dec: 0, name: 'Tanzanian Shilling' },
};

let activeCurrency = 'UGX';  // Changes when user picks from the dropdown

// Convert a UGX amount to the active currency and format it nicely
function formatMoney(ugxAmount) {
  const c = CURRENCIES[activeCurrency];
  const converted = ugxAmount * c.rate;
  const formatted = converted.toLocaleString(undefined, {
    minimumFractionDigits: c.dec,
    maximumFractionDigits: c.dec
  });
  return c.symbol + ' ' + formatted;
}

// Called by the currency dropdown in the topbar
function changeCurrency(code) {
  activeCurrency = code;
  // Re-render the current page so all numbers update
  const active = document.querySelector('.nav-item.active');
  const section = active ? active.dataset.section : 'dashboard';
  if (section && section !== '__logout__') nav(section, true);
}

// ─────────────────────────────────────────────────────────────
// 3.  CURRENT USER  (set on login, cleared on logout)
// ─────────────────────────────────────────────────────────────
let currentUser = null;
let activeChart = null;   // Track Chart.js instances so we can destroy them
let currentSection = null;

// ─────────────────────────────────────────────────────────────
// 4.  DATABASE  — All fake demo data removed.
//     The app starts empty and clean.
//     Add your real business name, email and password below.
//     You can add more users later from inside the app (Users page).
// ─────────────────────────────────────────────────────────────
const db = {
  sales: [],   // Will fill up as you record real sales
  inventory: [],   // Add your real products from the Inventory page
  customers: [],   // Add real customers from the Customers page
  suppliers: [],   // Add real suppliers from the Suppliers page
  orders: [],   // Orders will appear here as they are created
  expenses: [],   // Record real expenses from the Financial page

  // ── YOUR ADMIN LOGIN ──────────────────────────────────────────
  // ✏️  CHANGE the name, email and password below to YOUR real details
  //     before going live. This is the only account that can log in
  //     at first. You can create more accounts from inside the app.
  users: [
    {
      id: 'USR-001',
      name: 'Mulindwa Ian Edward',       // ← change this
      email: 'mulindwaianedward@gmail.com',       // ← change this (this is your login email)
      password: 'edward@2002',  // ← change this (make it hard to guess!)
      role: 'Admin',
      status: 'Active',
      lastLogin: 'Never'
    }
  ]
};

// ─────────────────────────────────────────────────────────────
// 5.  CHART DATA
// ─────────────────────────────────────────────────────────────
const weeklySalesUGX = [0, 0, 0, 0, 0, 0, 0];           // Will populate as real sales are recorded
const monthlySalesUGX = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // Will populate as real sales are recorded
const weeklyLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthLabels = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];


/* ══════════════════════════════════════════════════════════════
   AUTH  — Login / Logout
   ══════════════════════════════════════════════════════════════ */

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!email || !pass) { showLoginError('Please enter your email and password.'); return; }

  try {
    const data = await api('POST', '/auth/login', { email, password: pass });

    authToken = data.token;
    localStorage.setItem('bms_token', authToken);
    currentUser = data.user;

    document.getElementById('user-name-nav').textContent = currentUser.name;
    document.getElementById('user-role-nav').textContent = currentUser.role;
    document.getElementById('user-avatar').textContent = initials(currentUser.name);

    applyPermissions();
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    startSessionTimer();

    await loadAllData();

    const allowed = PERMISSIONS[currentUser.role] || [];
    nav(allowed[0] || 'sales');
  } catch (err) {
    showLoginError(err.message || 'Login failed. Check your credentials.');
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function doLogout() {
  authToken = null;
  localStorage.removeItem('bms_token');
  clearSessionTimer(); // Stop the timeout clock when logging out
  currentUser = null;
  currentSection = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
}

// ─────────────────────────────────────────────────────────────
//  APPLY PERMISSIONS — hide/show sidebar items after login
// ─────────────────────────────────────────────────────────────
function applyPermissions() {
  const role = currentUser.role;
  document.querySelectorAll('.nav-item[data-roles]').forEach(item => {
    const allowed = item.dataset.roles.split(',');
    item.style.display = allowed.includes(role) ? 'flex' : 'none';
  });
  // Also show the nav-label only if at least one item in its section is visible
  document.querySelectorAll('.nav-section').forEach(section => {
    const hasVisible = [...section.querySelectorAll('.nav-item')].some(i => i.style.display !== 'none');
    const label = section.querySelector('.nav-label');
    if (label) label.style.display = hasVisible ? 'block' : 'none';
  });
}

// Check if current user can access a section
function canAccess(section) {
  if (!currentUser) return false;
  return (PERMISSIONS[currentUser.role] || []).includes(section);
}


/* ══════════════════════════════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════════════════════════════ */

function nav(section, silent = false) {
  // Block access to sections the user doesn't have permission for
  if (!canAccess(section)) {
    document.getElementById('content-area').innerHTML = `
      <div style="padding:80px;text-align:center">
        <div style="font-size:52px;margin-bottom:16px">🔒</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:8px">Access Denied</div>
        <div style="color:var(--muted)">You don't have permission to view this page.<br>Contact your administrator.</div>
      </div>`;
    return;
  }

  // Highlight active nav item
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeItem = document.querySelector(`.nav-item[data-section="${section}"]`);
  if (activeItem) activeItem.classList.add('active');

  // Update topbar title
  const titles = {
    dashboard: 'Dashboard', sales: 'Sales & Transactions', orders: 'Order Management',
    inventory: 'Stock / Finished Goods', rawMaterials: 'Raw Material Inventory',
    customers: 'Customer Management', suppliers: 'Supplier Management',
    users: 'User Management', finance: 'Financial Management', reports: 'Reports',
    notifications: 'Notifications & Alerts', settings: 'System Settings'
  };
  document.getElementById('page-title').textContent = titles[section] || section;

  // Destroy any previous Chart.js chart to prevent memory leaks
  if (activeChart) { try { activeChart.destroy(); } catch (e) { } activeChart = null; }

  currentSection = section;

  // Call the right render function
  const renders = {
    dashboard: renderDashboard,
    sales: renderSales,
    orders: renderOrders,
    inventory: renderInventory,
    rawMaterials: renderRawMaterials,
    customers: renderCustomers,
    suppliers: renderSuppliers,
    users: renderUsers,
    finance: renderFinance,
    reports: renderReports,
    notifications: renderNotifications,
    settings: renderSettings,
  };
  if (renders[section]) renders[section]();
}


/* ══════════════════════════════════════════════════════════════
   MODAL HELPERS
   ══════════════════════════════════════════════════════════════ */

function openModal(title, html) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.remove('open');
  }
}


/* ══════════════════════════════════════════════════════════════
   SMALL HELPERS
   ══════════════════════════════════════════════════════════════ */

// Get initials from a name e.g. "Sarah Manager" → "SM"
function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// Colour-coded status badge
function badge(s) {
  const map = {
    Completed: 'badge-green', Active: 'badge-green', Paid: 'badge-green', 'In Stock': 'badge-green',
    Platinum: 'badge-purple', Gold: 'badge-amber', Silver: 'badge-blue', Bronze: 'badge-gray',
    Pending: 'badge-amber', Processing: 'badge-blue',
    'Low Stock': 'badge-amber', 'Out of Stock': 'badge-red',
    Refunded: 'badge-red', Cancelled: 'badge-red', Blocked: 'badge-red',
    Inactive: 'badge-gray', Overdue: 'badge-red',
    Admin: 'badge-purple', Manager: 'badge-blue', Employee: 'badge-gray',
  };
  return `<span class="badge ${map[s] || 'badge-gray'}">${s}</span>`;
}

// Simple confirm helper that returns true/false
function ask(question) { return window.confirm(question); }

// Show a toast notification at top-right
function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}


/* ══════════════════════════════════════════════════════════════
   PAGE: DASHBOARD
   ══════════════════════════════════════════════════════════════ */
function renderDashboard() {
  const totalSales = db.sales.filter(s => s.status === 'Completed').reduce((a, b) => a + b.amount, 0);
  const totalExpenses = db.expenses.reduce((a, b) => a + b.amount, 0);
  const profit = totalSales - totalExpenses;
  const lowCount = db.inventory.filter(i => i.status !== 'In Stock').length;

  document.getElementById('content-area').innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Total Sales</div>    <div class="stat-value" style="color:var(--accent)">${formatMoney(totalSales)}</div></div>
      <div class="stat-card"><div class="stat-label">Net Profit</div>     <div class="stat-value" style="color:var(--green)">${formatMoney(profit)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Expenses</div> <div class="stat-value" style="color:var(--red)">${formatMoney(totalExpenses)}</div></div>
      <div class="stat-card"><div class="stat-label">Customers</div>      <div class="stat-value">${db.customers.length}</div></div>
      <div class="stat-card"><div class="stat-label">Transactions</div>   <div class="stat-value">${db.sales.length}</div></div>
      <div class="stat-card"><div class="stat-label">Low Stock Items</div><div class="stat-value" style="color:${lowCount > 0 ? 'var(--orange)' : 'var(--green)'}">${lowCount}</div>${lowCount > 0 ? `<div class="stat-change stat-down">Needs reorder</div>` : ''}</div>
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-header"><div class="card-title">Weekly Sales (${activeCurrency})</div></div>
        <div class="chart-wrap"><canvas id="chartWeekly"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Monthly Revenue (${activeCurrency})</div><span style="font-size:12px;color:var(--muted)">Last 12 months</span></div>
        <div class="chart-wrap"><canvas id="chartMonthly"></canvas></div>
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-header"><div class="card-title">Recent Transactions</div><button class="btn btn-ghost btn-sm" onclick="nav('sales')">View All</button></div>
        <div class="table-wrap"><table>
          <tr><th>ID</th><th>Customer</th><th>Amount</th><th>Status</th></tr>
          ${db.sales.slice(0, 5).map(s => `<tr>
            <td style="color:var(--muted)">${s.id}</td>
            <td>${s.customer}</td>
            <td style="color:var(--accent);font-weight:700">${formatMoney(s.amount)}</td>
            <td>${badge(s.status)}</td>
          </tr>`).join('')}
        </table></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Stock Alerts</div><button class="btn btn-ghost btn-sm" onclick="nav('inventory')">View All</button></div>
        ${db.inventory.filter(i => i.status !== 'In Stock').map(i => `
          <div class="alert ${i.status === 'Out of Stock' ? 'alert-danger' : 'alert-warn'}" style="margin-bottom:8px">
            <span>${i.status === 'Out of Stock' ? '🔴' : '🟡'}</span>
            <div><strong>${i.name}</strong><br><small>${i.status} — ${i.qty} left (min ${i.min})</small></div>
          </div>`).join('')}
        <div style="margin-top:12px">
          <div class="card-title" style="font-size:13px;margin-bottom:8px">Sales by Category</div>
          <div style="position:relative;height:130px"><canvas id="chartPie"></canvas></div>
        </div>
      </div>
    </div>`;

  setTimeout(() => {
    const c = CURRENCIES[activeCurrency];
    const wData = weeklySalesUGX.map(v => +(v * c.rate).toFixed(c.dec));
    const mData = monthlySalesUGX.map(v => +(v * c.rate).toFixed(c.dec));

    const barOpts = (labels, data, color) => ({
      type: 'bar', data: { labels, datasets: [{ data, backgroundColor: color + '33', borderColor: color, borderWidth: 1.5, borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8B949E', font: { size: 11 } }, grid: { color: '#30363D22' } },
          y: { ticks: { color: '#8B949E', font: { size: 11 }, callback: v => formatAxisVal(v) }, grid: { color: '#30363D55' } }
        }
      }
    });

    const cW = document.getElementById('chartWeekly');
    const cM = document.getElementById('chartMonthly');
    const cP = document.getElementById('chartPie');
    if (cW) new Chart(cW, barOpts(weeklyLabels, wData, '#F59E0B'));
    if (cM) new Chart(cM, barOpts(monthLabels, mData, '#58A6FF'));
    if (cP) {
      const catTotals = {};
      db.sales.filter(s => s.status === 'Completed').forEach(s => {
        const prod = db.inventory.find(p => s.items.toLowerCase().includes(p.name.toLowerCase()));
        const cat = prod ? prod.cat : 'Other';
        catTotals[cat] = (catTotals[cat] || 0) + s.amount;
      });
      const labels = Object.keys(catTotals);
      const values = Object.values(catTotals);
      const colors = ['#F59E0B', '#3FB950', '#58A6FF', '#D2A8FF', '#8B949E', '#F85149'];
      if (labels.length === 0) {
        cP.parentElement.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">No sales data yet</div>`;
      } else {
        new Chart(cP, {
          type: 'doughnut',
          data: { labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#8B949E', font: { size: 11 }, boxWidth: 10 } } } }
        });
      }
    }
  }, 100);
}

function formatAxisVal(v) {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
  return v;
}


/* ══════════════════════════════════════════════════════════════
   PAGE: SALES
   ══════════════════════════════════════════════════════════════ */
function renderSales() {
  const todaySales = db.sales.filter(s => s.date === '2026-03-23');
  const todayTotal = todaySales.filter(s => s.status === 'Completed').reduce((a, b) => a + b.amount, 0);

  document.getElementById('content-area').innerHTML = `
    <div class="card-header" style="margin-bottom:16px">
      <div class="section-actions">
        <input class="search-bar" id="sales-search" placeholder="🔍 Search transactions…" oninput="filterSalesTable(this.value)">
        <select id="sales-method-filter" onchange="filterSalesTable()" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text)">
          <option value="">All Methods</option><option>Cash</option><option>Mobile Money</option><option>Bank</option>
        </select>
      </div>
      <div class="section-actions">
        <button class="btn btn-primary" onclick="openSaleModal()">+ New Sale</button>
        <button class="btn btn-ghost btn-sm" onclick="printPage()">🖨️ Print</button>
      </div>
    </div>
    <div class="stat-grid" style="margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">Today's Sales</div>     <div class="stat-value" style="color:var(--accent)">${formatMoney(todayTotal)}</div></div>
      <div class="stat-card"><div class="stat-label">Transactions Today</div><div class="stat-value">${todaySales.length}</div></div>
      <div class="stat-card"><div class="stat-label">Avg. Transaction</div>  <div class="stat-value">${formatMoney(todaySales.length ? todayTotal / todaySales.length : 0)}</div></div>
      <div class="stat-card"><div class="stat-label">Refunds</div>           <div class="stat-value" style="color:var(--red)">${db.sales.filter(s => s.status === 'Refunded').length}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Transaction History</div></div>
      <div class="table-wrap"><table id="sales-table">
        <tr><th>ID</th><th>Date</th><th>Customer</th><th>Items</th><th>Payment</th><th>Amount</th><th>Status</th><th>Receipt</th></tr>
        ${db.sales.map(s => salesRow(s)).join('')}
      </table></div>
    </div>`;
}

function salesRow(s) {
  return `<tr data-customer="${s.customer.toLowerCase()}" data-method="${s.method}">
    <td style="color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:12px">${s.id}</td>
    <td style="color:var(--muted)">${s.date}</td>
    <td><strong>${s.customer}</strong></td>
    <td style="color:var(--muted);font-size:12px">${s.items}</td>
    <td>${s.method}</td>
    <td style="color:var(--accent);font-weight:700">${formatMoney(s.amount)}</td>
    <td>${badge(s.status)}</td>
    <td><button class="btn btn-ghost btn-sm" onclick="viewReceipt('${s.id}')">🧾 View</button></td>
  </tr>`;
}

function filterSalesTable(searchVal) {
  const q = (searchVal || document.getElementById('sales-search')?.value || '').toLowerCase();
  const m = (document.getElementById('sales-method-filter')?.value || '').toLowerCase();
  document.querySelectorAll('#sales-table tr[data-customer]').forEach(row => {
    const matchQ = !q || row.dataset.customer.includes(q);
    const matchM = !m || row.dataset.method.toLowerCase() === m;
    row.style.display = (matchQ && matchM) ? '' : 'none';
  });
}

function openSaleModal() {
  openModal('Record New Sale', `
    <div class="form-group"><label>Customer</label>
      <select id="sale-customer" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text)">
        <option value="">-- Walk-in Customer --</option>
        ${db.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Items / Description</label>
      <input type="text" id="sale-items" placeholder="e.g. Juice x2, Bread x3" style="width:100%">
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Amount (UGX)</label><input type="number" id="sale-amount" placeholder="0" style="width:100%" min="0"></div>
      <div class="form-group"><label>Payment Method</label>
        <select id="sale-method" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text)">
          <option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label>Notes (optional)</label>
      <textarea id="sale-notes" placeholder="Any extra notes…" style="width:100%;height:60px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);resize:vertical"></textarea>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveSale()">Record Sale ✓</button>
    </div>`);
}

async function saveSale() {
  const amount = parseFloat(document.getElementById('sale-amount').value);
  const items = document.getElementById('sale-items').value.trim();
  if (!items || !amount || amount <= 0) { toast('Please fill in items and amount.', 'danger'); return; }

  const custSel = document.getElementById('sale-customer');
  const custName = custSel.options[custSel.selectedIndex].text === '-- Walk-in Customer --'
    ? 'Walk-in Customer'
    : custSel.options[custSel.selectedIndex].text;

  try {
    const newSale = await api('POST', '/sales', {
      customer: custName, items,
      method: document.getElementById('sale-method').value,
      amount,
      notes: document.getElementById('sale-notes') ? document.getElementById('sale-notes').value : ''
    });
    db.sales.unshift(newSale);
    closeModal();
    toast('Sale recorded successfully! 🎉');
    renderSales();
  } catch (err) { toast(err.message, 'danger'); }
}

function viewReceipt(id) {
  const s = db.sales.find(x => x.id === id);
  if (!s) return;
  openModal('Receipt — ' + s.id, `
    <div style="text-align:center;padding:8px 0 20px">
      <div style="font-family:'Syne',sans-serif;font-size:22px;color:var(--accent);letter-spacing:1px">◆ BMS</div>
      <div style="color:var(--muted);font-size:12px;margin-top:4px">Kampala Mart Ltd · Plot 45, Kampala Road</div>
      <div style="color:var(--muted);font-size:12px">Tel: +256 414 000000</div>
    </div>
    <div class="divider"></div>
    <table style="width:100%;font-size:13px">
      <tr><td style="color:var(--muted);padding:5px 0">Receipt No.</td><td style="text-align:right;font-weight:600;font-family:monospace">${s.id}</td></tr>
      <tr><td style="color:var(--muted);padding:5px 0">Date</td>       <td style="text-align:right">${s.date}</td></tr>
      <tr><td style="color:var(--muted);padding:5px 0">Customer</td>   <td style="text-align:right">${s.customer}</td></tr>
      <tr><td style="color:var(--muted);padding:5px 0">Items</td>      <td style="text-align:right">${s.items}</td></tr>
      <tr><td style="color:var(--muted);padding:5px 0">Payment</td>    <td style="text-align:right">${s.method}</td></tr>
    </table>
    <div class="divider"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
      <span style="font-size:16px;font-weight:700">TOTAL</span>
      <span style="font-size:22px;font-weight:700;color:var(--accent)">${formatMoney(s.amount)}</span>
    </div>
    <div style="font-size:11px;color:var(--muted);text-align:center;margin:4px 0 2px">(${activeCurrency === 'UGX' ? '' : 'UGX ' + s.amount.toLocaleString() + ' = '}${formatMoney(s.amount)})</div>
    <div class="divider"></div>
    <div style="text-align:center;color:var(--muted);font-size:13px;padding:8px 0">Thank you for shopping with us! 🙏</div>
    <div style="text-align:right;margin-top:16px">
      <button class="btn btn-primary" onclick="window.print()">🖨️ Print Receipt</button>
    </div>`);
}

function printPage() { window.print(); }


/* ══════════════════════════════════════════════════════════════
   PAGE: ORDERS
   ══════════════════════════════════════════════════════════════ */
function renderOrders() {
  document.getElementById('content-area').innerHTML = `
    <div class="card-header" style="margin-bottom:16px">
      <input class="search-bar" placeholder="🔍 Search orders…">
      <button class="btn btn-primary" onclick="openModal('Create Order', createOrderForm())">+ Create Order</button>
    </div>
    <div class="stat-grid" style="margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">Pending</div>    <div class="stat-value" style="color:var(--orange)">${db.orders.filter(o => o.status === 'Pending').length}</div></div>
      <div class="stat-card"><div class="stat-label">Processing</div> <div class="stat-value" style="color:var(--blue)">${db.orders.filter(o => o.status === 'Processing').length}</div></div>
      <div class="stat-card"><div class="stat-label">Completed</div>  <div class="stat-value" style="color:var(--green)">${db.orders.filter(o => o.status === 'Completed').length}</div></div>
      <div class="stat-card"><div class="stat-label">Cancelled</div>  <div class="stat-value" style="color:var(--red)">${db.orders.filter(o => o.status === 'Cancelled').length}</div></div>
    </div>
    <div class="card"><div class="card-header"><div class="card-title">All Orders</div></div>
    <div class="table-wrap"><table>
      <tr><th>Order ID</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Type</th><th>Status</th><th>Action</th></tr>
      ${db.orders.map(o => `<tr>
        <td style="color:var(--muted);font-family:monospace;font-size:12px">${o.id}</td>
        <td><strong>${o.customer}</strong></td>
        <td style="color:var(--muted)">${o.date}</td>
        <td style="font-size:12px;color:var(--muted)">${o.items}</td>
        <td style="font-weight:700;color:var(--accent)">${formatMoney(o.total)}</td>
        <td><span class="tag">${o.delivery}</span></td>
        <td>${badge(o.status)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="updateOrderStatus('${o.id}')">Update</button></td>
      </tr>`).join('')}
    </table></div></div>`;
}

function createOrderForm() {
  return `
    <div class="form-group"><label>Customer</label>
      <select style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text)">
        ${db.customers.map(c => `<option>${c.name}</option>`).join('')}
      </select></div>
    <div class="form-group"><label>Items</label><input type="text" style="width:100%" placeholder="e.g. Juice x4, Bread x2"></div>
    <div class="form-grid">
      <div class="form-group"><label>Total (UGX)</label><input type="number" style="width:100%" placeholder="0"></div>
      <div class="form-group"><label>Delivery Type</label>
        <select style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text)">
          <option>Delivery</option><option>Pickup</option>
        </select></div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="toast('Order created! 📦');closeModal()">Create Order</button>
    </div>`;
}

function updateOrderStatus(id) {
  const order = db.orders.find(o => o.id === id);
  if (!order) return;
  const statuses = ['Pending', 'Processing', 'Completed', 'Cancelled'];
  const next = statuses[(statuses.indexOf(order.status) + 1) % statuses.length];
  openModal(`Update Order ${id}`, `
    <p style="color:var(--muted);margin-bottom:16px">Current status: ${badge(order.status)}</p>
    <div class="form-group"><label>New Status</label>
      <select id="new-status" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text)">
        ${statuses.map(s => `<option ${s === next ? 'selected' : ''}>${s}</option>`).join('')}
      </select></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="applyOrderStatus('${id}')">Save Status</button>
    </div>`);
}

function applyOrderStatus(id) {
  const o = db.orders.find(x => x.id === id);
  if (o) { o.status = document.getElementById('new-status').value; }
  closeModal();
  toast('Order status updated!');
  renderOrders();
}


/* ══════════════════════════════════════════════════════════════
   PAGE: INVENTORY
   ══════════════════════════════════════════════════════════════ */
function renderInventory() {
  const alerts = db.inventory.filter(i => i.status !== 'In Stock');
  document.getElementById('content-area').innerHTML = `
    ${alerts.length ? `<div class="alert alert-warn"><span>⚠️</span><strong>${alerts.length} items need attention:</strong> ${alerts.map(i => i.name).join(', ')}</div>` : ''}
    <div class="card-header" style="margin-bottom:16px">
      <div class="section-actions">
        <input class="search-bar" id="inv-search" placeholder="🔍 Search products…" oninput="filterInventory(this.value)">
        <select id="inv-cat" onchange="filterInventory()" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text)">
          <option value="">All Categories</option>
          ${[...new Set(db.inventory.map(p => p.cat))].map(c => `<option>${c}</option>`).join('')}
        </select>
      </div>
      <div class="section-actions">
        <button class="btn btn-primary" onclick="openAddProductModal()">+ Add Product</button>
        <button class="btn btn-ghost btn-sm" onclick="printPage()">Export / Print</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Stock Levels</div><span style="color:var(--muted);font-size:12px">${db.inventory.length} products</span></div>
      <div class="table-wrap"><table id="inv-table">
        <tr><th>ID</th><th>Product</th><th>Category</th><th>Stock</th><th>Min</th><th>Level</th><th>Price (${activeCurrency})</th><th>Supplier</th><th>Status</th><th>Actions</th></tr>
        ${db.inventory.map(p => inventoryRow(p)).join('')}
      </table></div>
    </div>`;
}

function inventoryRow(p) {
  const pct = Math.min(Math.round((p.qty / Math.max(p.min * 3, 1)) * 100), 100);
  const col = p.status === 'In Stock' ? 'var(--green)' : p.status === 'Low Stock' ? 'var(--orange)' : 'var(--red)';
  return `<tr data-name="${p.name.toLowerCase()}" data-cat="${p.cat}">
    <td style="color:var(--muted);font-size:12px">${p.id}</td>
    <td><strong>${p.name}</strong></td>
    <td><span class="tag">${p.cat}</span></td>
    <td style="font-weight:700">${p.qty}</td>
    <td style="color:var(--muted)">${p.min}</td>
    <td style="min-width:110px">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${col}"></div></div>
      <span style="font-size:10px;color:var(--muted)">${pct}%</span>
    </td>
    <td style="color:var(--accent)">${formatMoney(p.price)}</td>
    <td style="font-size:12px;color:var(--muted)">${p.supplier}</td>
    <td>${badge(p.status)}</td>
    <td><div style="display:flex;gap:6px">
      <button class="btn btn-ghost btn-sm" onclick="editProduct('${p.id}')">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">Del</button>
    </div></td>
  </tr>`;
}

function filterInventory(searchVal) {
  const q = (searchVal || document.getElementById('inv-search')?.value || '').toLowerCase();
  const cat = (document.getElementById('inv-cat')?.value || '').toLowerCase();
  document.querySelectorAll('#inv-table tr[data-name]').forEach(row => {
    const mQ = !q || row.dataset.name.includes(q);
    const mC = !cat || row.dataset.cat.toLowerCase() === cat;
    row.style.display = (mQ && mC) ? '' : 'none';
  });
}

function openAddProductModal() {
  openModal('Add New Product', `
    <div class="form-grid">
      <div class="form-group"><label>Product Name</label><input type="text" id="p-name" style="width:100%" placeholder="e.g. Tropical Juice"></div>
      <div class="form-group"><label>Category</label>
        <select id="p-cat" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text)">
          <option>Beverages</option><option>Pastries</option><option>Dairy</option><option>Snacks</option><option>Bakery</option><option>Spreads</option>
        </select></div>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Quantity</label><input type="number" id="p-qty" style="width:100%" placeholder="0" min="0"></div>
      <div class="form-group"><label>Min Stock Level</label><input type="number" id="p-min" style="width:100%" placeholder="10" min="0"></div>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Unit Price (UGX)</label><input type="number" id="p-price" style="width:100%" placeholder="0" min="0"></div>
      <div class="form-group"><label>Supplier</label>
        <select id="p-sup" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text)">
          ${db.suppliers.map(s => `<option>${s.name}</option>`).join('')}
        </select></div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveProduct()">Save Product</button>
    </div>`);
}

async function saveProduct() {
  const name = document.getElementById('p-name').value.trim();
  const qty = parseInt(document.getElementById('p-qty').value);
  const min = parseInt(document.getElementById('p-min').value);
  const price = parseFloat(document.getElementById('p-price').value);
  if (!name || isNaN(qty) || isNaN(price)) { toast('Please fill all required fields.', 'danger'); return; }
  try {
    const prod = await api('POST', '/stock', {
      name, qty, min, price,
      cat: document.getElementById('p-cat').value,
      supplier: document.getElementById('p-sup').value,
    });
    db.inventory.push(prod);
    closeModal();
    toast('Product added! 📦');
    renderInventory();
  } catch (err) { toast(err.message, 'danger'); }
}

function editProduct(id) {
  const p = db.inventory.find(x => x.id === id);
  if (!p) return;
  openModal(`Edit — ${p.name}`, `
    <div class="form-grid">
      <div class="form-group"><label>Quantity</label><input type="number" id="ep-qty" value="${p.qty}" style="width:100%"></div>
      <div class="form-group"><label>Min Stock</label><input type="number" id="ep-min" value="${p.min}" style="width:100%"></div>
    </div>
    <div class="form-group"><label>Unit Price (UGX)</label><input type="number" id="ep-price" value="${p.price}" style="width:100%"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="applyEditProduct('${id}')">Save Changes</button>
    </div>`);
}

async function applyEditProduct(id) {
  const p = db.inventory.find(x => x.id === id);
  const qty = parseInt(document.getElementById('ep-qty').value);
  const min = parseInt(document.getElementById('ep-min').value);
  const price = parseFloat(document.getElementById('ep-price').value);
  if (!p || isNaN(qty) || isNaN(price)) return;
  try {
    await api('PUT', '/stock/' + id, { qty, min, price });
    p.qty = qty;
    p.min = min;
    p.price = price;
    p.status = qty === 0 ? 'Out of Stock' : qty <= min ? 'Low Stock' : 'In Stock';
    closeModal();
    toast('Product updated! ✓');
    renderInventory();
  } catch (err) { toast(err.message, 'danger'); }
}

async function deleteProduct(id) {
  if (!ask('Are you sure you want to delete this product? This cannot be undone.')) return;
  try {
    await api('DELETE', '/stock/' + id);
    const idx = db.inventory.findIndex(x => x.id === id);
    if (idx !== -1) db.inventory.splice(idx, 1);
    toast('Product deleted.', 'danger');
    renderInventory();
  } catch (err) { toast(err.message, 'danger'); }
}


/* ══════════════════════════════════════════════════════════════
   PAGE: CUSTOMERS
   ══════════════════════════════════════════════════════════════ */
function renderCustomers() {
  document.getElementById('content-area').innerHTML = `
    <div class="card-header" style="margin-bottom:16px">
      <input class="search-bar" id="cust-search" placeholder="🔍 Search customers…" oninput="filterCustomers(this.value)">
      <button class="btn btn-primary" onclick="openAddCustomerModal()">+ Add Customer</button>
    </div>
    <div class="stat-grid" style="margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">Total</div>    <div class="stat-value">${db.customers.length}</div></div>
      <div class="stat-card"><div class="stat-label">Platinum</div> <div class="stat-value" style="color:var(--purple)">${db.customers.filter(c => c.loyalty === 'Platinum').length}</div></div>
      <div class="stat-card"><div class="stat-label">Gold</div>     <div class="stat-value" style="color:var(--accent)">${db.customers.filter(c => c.loyalty === 'Gold').length}</div></div>
      <div class="stat-card"><div class="stat-label">Silver</div>   <div class="stat-value" style="color:var(--blue)">${db.customers.filter(c => c.loyalty === 'Silver').length}</div></div>
    </div>
    <div class="card"><div class="card-header"><div class="card-title">Customer Directory</div></div>
    <div class="table-wrap"><table id="cust-table">
      <tr><th>ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Purchases</th><th>Total Spend</th><th>Last Visit</th><th>Loyalty</th><th>Actions</th></tr>
      ${db.customers.map(c => `<tr data-name="${c.name.toLowerCase()}">
        <td style="color:var(--muted);font-size:12px">${c.id}</td>
        <td><div style="display:flex;align-items:center;gap:8px">
          <div class="avatar" style="width:28px;height:28px;font-size:11px">${initials(c.name)}</div>
          <strong>${c.name}</strong>
        </div></td>
        <td style="color:var(--muted)">${c.phone}</td>
        <td style="color:var(--blue)">${c.email}</td>
        <td style="text-align:center">${c.purchases}</td>
        <td style="color:var(--accent);font-weight:700">${formatMoney(c.total)}</td>
        <td style="color:var(--muted)">${c.lastVisit}</td>
        <td>${badge(c.loyalty)}</td>
        <td style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="viewCustomer('${c.id}')">View</button>
          <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${c.id}')">Del</button>
        </td>
      </tr>`).join('')}
    </table></div></div>`;
}

function filterCustomers(q) {
  q = q.toLowerCase();
  document.querySelectorAll('#cust-table tr[data-name]').forEach(row => {
    row.style.display = (!q || row.dataset.name.includes(q)) ? '' : 'none';
  });
}

function openAddCustomerModal() {
  openModal('Register New Customer', `
    <div class="form-grid">
      <div class="form-group"><label>Full Name</label><input type="text" id="cn-name" style="width:100%" placeholder="Customer's full name"></div>
      <div class="form-group"><label>Phone</label><input type="text" id="cn-phone" style="width:100%" placeholder="+256 7XX XXXXXX"></div>
    </div>
    <div class="form-group"><label>Email (optional)</label><input type="email" id="cn-email" style="width:100%" placeholder="customer@email.com"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveCustomer()">Save Customer</button>
    </div>`);
}

async function saveCustomer() {
  const name = document.getElementById('cn-name').value.trim();
  const phone = document.getElementById('cn-phone').value.trim();
  if (!name || !phone) { toast('Name and phone are required.', 'danger'); return; }
  try {
    const cust = await api('POST', '/customers', {
      name, phone,
      email: document.getElementById('cn-email').value || '---',
    });
    db.customers.push(cust);
    closeModal();
    toast('Customer added! 👥');
    renderCustomers();
  } catch (err) { toast(err.message, 'danger'); }
}

function viewCustomer(id) {
  const c = db.customers.find(x => x.id === id);
  if (!c) return;
  const history = db.sales.filter(s => s.customer === c.name);
  openModal(`Customer — ${c.name}`, `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
      <div class="avatar" style="width:48px;height:48px;font-size:18px">${initials(c.name)}</div>
      <div>
        <div style="font-weight:700;font-size:16px">${c.name}</div>
        <div>${badge(c.loyalty)}</div>
      </div>
    </div>
    <table style="width:100%;font-size:13px;margin-bottom:16px">
      <tr><td style="color:var(--muted);padding:4px 0">Phone</td>      <td style="text-align:right">${c.phone}</td></tr>
      <tr><td style="color:var(--muted);padding:4px 0">Email</td>      <td style="text-align:right;color:var(--blue)">${c.email}</td></tr>
      <tr><td style="color:var(--muted);padding:4px 0">Total Spend</td><td style="text-align:right;color:var(--accent);font-weight:700">${formatMoney(c.total)}</td></tr>
      <tr><td style="color:var(--muted);padding:4px 0">Purchases</td>  <td style="text-align:right">${c.purchases}</td></tr>
      <tr><td style="color:var(--muted);padding:4px 0">Last Visit</td> <td style="text-align:right">${c.lastVisit}</td></tr>
    </table>
    ${history.length ? `
      <div style="font-weight:600;margin-bottom:8px">Purchase History</div>
      <div class="table-wrap"><table>
        <tr><th>Date</th><th>Items</th><th>Amount</th><th>Status</th></tr>
        ${history.map(s => `<tr><td style="color:var(--muted)">${s.date}</td><td style="font-size:12px">${s.items}</td><td style="color:var(--accent)">${formatMoney(s.amount)}</td><td>${badge(s.status)}</td></tr>`).join('')}
      </table></div>` : '<div style="color:var(--muted);font-size:13px">No purchase history yet.</div>'}`);
}

async function deleteCustomer(id) {
  if (!ask('Delete this customer? This cannot be undone.')) return;
  try {
    await api('DELETE', '/customers/' + id);
    const idx = db.customers.findIndex(x => x.id === id);
    if (idx !== -1) db.customers.splice(idx, 1);
    toast('Customer removed.', 'danger');
    renderCustomers();
  } catch (err) { toast(err.message, 'danger'); }
}


/* ══════════════════════════════════════════════════════════════
   PAGE: SUPPLIERS
   ══════════════════════════════════════════════════════════════ */
function renderSuppliers() {
  document.getElementById('content-area').innerHTML = `
    <div class="card-header" style="margin-bottom:16px">
      <input class="search-bar" placeholder="🔍 Search suppliers…">
      <button class="btn btn-primary" onclick="openAddSupplierModal()">+ Add Supplier</button>
    </div>
    <div class="card"><div class="card-header"><div class="card-title">Supplier Directory</div></div>
    <div class="table-wrap"><table>
      <tr><th>ID</th><th>Company</th><th>Contact</th><th>Phone</th><th>Products</th><th>Last Order</th><th>Outstanding</th><th>Status</th><th>Actions</th></tr>
      ${db.suppliers.map(s => `<tr>
        <td style="color:var(--muted);font-size:12px">${s.id}</td>
        <td><strong>${s.name}</strong></td>
        <td style="color:var(--muted)">${s.contact}</td>
        <td>${s.phone}</td>
        <td style="text-align:center">${s.items}</td>
        <td style="color:var(--muted)">${s.lastOrder}</td>
        <td style="color:${s.balance > 0 ? 'var(--red)' : 'var(--green)'};font-weight:700">${s.balance > 0 ? formatMoney(s.balance) : '✓ Settled'}</td>
        <td>${badge(s.status)}</td>
        <td style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="toast('Order placed for ${s.name}! 📦')">Order</button>
          <button class="btn btn-ghost btn-sm" onclick="markSupplierPaid('${s.id}')">Pay</button>
        </td>
      </tr>`).join('')}
    </table></div></div>`;
}

function markSupplierPaid(id) {
  const s = db.suppliers.find(x => x.id === id);
  if (!s) return;
  if (s.balance === 0) { toast('No outstanding balance for this supplier.', 'danger'); return; }
  if (ask(`Mark ${s.name} as paid? (${formatMoney(s.balance)} outstanding)`)) {
    s.balance = 0;
    toast(`Payment recorded for ${s.name}! ✓`);
    renderSuppliers();
  }
}

function openAddSupplierModal() {
  openModal('Add Supplier', `
    <div class="form-grid">
      <div class="form-group"><label>Company Name</label><input type="text" id="sup-name" style="width:100%" placeholder="e.g. Ugafresh Ltd"></div>
      <div class="form-group"><label>Contact Person</label><input type="text" id="sup-contact" style="width:100%" placeholder="Mr./Ms. Name"></div>
    </div>
    <div class="form-group"><label>Phone</label><input type="text" id="sup-phone" style="width:100%" placeholder="+256 XXX XXXXXX"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveSupplier()">Save Supplier</button>
    </div>`);
}

async function saveSupplier() {
  const name = document.getElementById('sup-name').value.trim();
  if (!name) { toast('Company name is required.', 'danger'); return; }
  try {
    const sup = await api('POST', '/suppliers', {
      name,
      contact: document.getElementById('sup-contact').value || '---',
      phone: document.getElementById('sup-phone').value || '---',
    });
    db.suppliers.push(sup);
    closeModal(); toast('Supplier added! 🚚'); renderSuppliers();
  } catch (err) { toast(err.message, 'danger'); }
}


/* ══════════════════════════════════════════════════════════════
   PAGE: USERS  (Admin only — full management panel)
   ══════════════════════════════════════════════════════════════ */
function renderUsers() {
  document.getElementById('content-area').innerHTML = `
    <div class="alert alert-info" style="margin-bottom:16px">
      <span>🔒</span>
      <div>Only <strong>Admins</strong> can manage users. Blocked users cannot log in. Deleting a user is permanent.</div>
    </div>
    <div class="card-header" style="margin-bottom:16px">
      <input class="search-bar" id="usr-search" placeholder="🔍 Search users…" oninput="filterUsers(this.value)">
      <button class="btn btn-primary" onclick="openAddUserModal()">+ Add User</button>
    </div>

    <!-- USERS TABLE -->
    <div class="card">
      <div class="card-header"><div class="card-title">System Users</div><span style="color:var(--muted);font-size:12px">${db.users.length} accounts</span></div>
      <div class="table-wrap"><table id="usr-table">
        <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th><th>Permissions</th><th>Admin Actions</th></tr>
        ${db.users.map(u => userRow(u)).join('')}
      </table></div>
    </div>

    <!-- PERMISSIONS MATRIX -->
    <div class="card">
      <div class="card-header"><div class="card-title">Role Permissions Matrix</div></div>
      <div class="table-wrap"><table>
        <tr><th>Feature</th><th>Admin</th><th>Manager</th><th>Employee</th></tr>
        ${[
      ['Dashboard', '✅', '✅', '❌'],
      ['Record Sales', '✅', '✅', '✅'],
      ['Orders', '✅', '❌', '❌'],
      ['Inventory', '✅', '✅', '❌'],
      ['Customers', '✅', '✅', '✅'],
      ['Suppliers', '✅', '❌', '❌'],
      ['User Management', '✅', '❌', '❌'],
      ['Financial', '✅', '❌', '❌'],
      ['Reports', '✅', '✅', '❌'],
      ['Notifications', '✅', '✅', '✅'],
      ['System Settings', '✅', '❌', '❌'],
      ['Delete Records', '✅', '❌', '❌'],
    ].map(r => `<tr><td>${r[0]}</td><td style="text-align:center">${r[1]}</td><td style="text-align:center">${r[2]}</td><td style="text-align:center">${r[3]}</td></tr>`).join('')}
      </table></div>
    </div>`;
}

function userRow(u) {
  const isSelf = currentUser && u.id === currentUser.id;
  const permLabel = u.role === 'Admin' ? 'Full Access' : u.role === 'Manager' ? 'Dashboard + Sales + Reports + Inventory + Customers' : 'Sales + Customers Only';
  return `<tr data-name="${u.name.toLowerCase()}" id="usr-row-${u.id}" style="${u.status === 'Blocked' ? 'opacity:0.6' : ''}">
    <td style="color:var(--muted);font-size:12px">${u.id}</td>
    <td>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="avatar" style="width:28px;height:28px;font-size:11px;${u.status === 'Blocked' ? 'background:#2d1b1b;color:var(--red)' : ''}">${initials(u.name)}</div>
        <div>
          <div style="font-weight:600">${u.name} ${isSelf ? '<span style="font-size:10px;color:var(--accent)">(you)</span>' : ''}</div>
        </div>
      </div>
    </td>
    <td style="color:var(--blue)">${u.email}</td>
    <td>${badge(u.role)}</td>
    <td style="color:var(--muted)">${u.lastLogin}</td>
    <td>${badge(u.status)}</td>
    <td style="font-size:11px;color:var(--muted);max-width:180px">${permLabel}</td>
    <td>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="changePasswordModal('${u.id}')" title="Change password">🔑 PW</button>
        ${u.status === 'Blocked'
      ? `<button class="btn btn-success btn-sm" onclick="toggleBlock('${u.id}')" title="Unblock this user">✅ Unblock</button>`
      : `<button class="btn btn-danger btn-sm" onclick="toggleBlock('${u.id}')" ${isSelf ? 'disabled title="Cannot block yourself"' : ''}>🚫 Block</button>`}
        <button class="btn btn-danger btn-sm" onclick="removeUser('${u.id}')" ${isSelf ? 'disabled title="Cannot delete yourself"' : ''}>🗑️ Delete</button>
      </div>
    </td>
  </tr>`;
}

function filterUsers(q) {
  q = q.toLowerCase();
  document.querySelectorAll('#usr-table tr[data-name]').forEach(row => {
    row.style.display = (!q || row.dataset.name.includes(q)) ? '' : 'none';
  });
}

// ── BLOCK / UNBLOCK USER ────────────────────────────────────────
async function toggleBlock(id) {
  const u = db.users.find(x => x.id === id);
  if (!u) return;
  if (u.id === currentUser.id) { toast('You cannot block your own account!', 'danger'); return; }
  if (u.status === 'Blocked') {
    if (!ask(`Unblock ${u.name}? They will be able to log in again.`)) return;
  } else {
    if (!ask(`Block ${u.name}? They will not be able to log in until unblocked.`)) return;
  }
  try {
    const result = await api('PUT', '/users/' + id + '/block');
    u.status = result.status;
    if (u.status === 'Active') toast(`${u.name} has been unblocked. ✅`);
    else toast(`${u.name} has been blocked. 🚫`, 'danger');
    renderUsers();
  } catch (err) { toast(err.message, 'danger'); }
}

// ── DELETE USER ─────────────────────────────────────────────────
async function removeUser(id) {
  const u = db.users.find(x => x.id === id);
  if (!u) return;
  if (u.id === currentUser.id) { toast('You cannot delete your own account!', 'danger'); return; }
  if (!ask(`⚠️ Permanently delete ${u.name}?\n\nThis CANNOT be undone. The user will lose all access.`)) return;
  try {
    await api('DELETE', '/users/' + id);
    const idx = db.users.findIndex(x => x.id === id);
    if (idx !== -1) db.users.splice(idx, 1);
    toast(`${u.name}'s account has been deleted.`, 'danger');
    renderUsers();
  } catch (err) { toast(err.message, 'danger'); }
}

// ── CHANGE PASSWORD ──────────────────────────────────────────────
function changePasswordModal(id) {
  const u = db.users.find(x => x.id === id);
  if (!u) return;
  openModal(`Change Password — ${u.name}`, `
    <div class="alert alert-warn" style="margin-bottom:16px">
      <span>⚠️</span><div>You are changing the password for <strong>${u.name}</strong>.<br>They will need to use the new password next time they log in.</div>
    </div>
    <div class="form-group">
      <label>New Password</label>
      <input type="password" id="new-pw" placeholder="Enter new password (min 6 characters)" style="width:100%">
    </div>
    <div class="form-group">
      <label>Confirm New Password</label>
      <input type="password" id="new-pw-confirm" placeholder="Re-enter password" style="width:100%">
    </div>
    <div id="pw-error" style="color:var(--red);font-size:12px;margin-bottom:8px;display:none"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="applyChangePassword('${id}')">Set New Password</button>
    </div>`);
}

async function applyChangePassword(id) {
  const pw1 = document.getElementById('new-pw').value;
  const pw2 = document.getElementById('new-pw-confirm').value;
  const errEl = document.getElementById('pw-error');
  errEl.style.display = 'none';

  if (pw1.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display = 'block'; return; }
  if (pw1 !== pw2) { errEl.textContent = 'Passwords do not match. Please try again.'; errEl.style.display = 'block'; return; }

  try {
    await api('PUT', '/users/' + id + '/password', { password: pw1 });
    const u = db.users.find(x => x.id === id);
    closeModal();
    toast(`Password changed for ${u ? u.name : 'user'}! 🔑`);
  } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
}

// ── ADD NEW USER ─────────────────────────────────────────────────
function openAddUserModal() {
  openModal('Add New User', `
    <div class="form-grid">
      <div class="form-group"><label>Full Name</label><input type="text" id="nu-name" style="width:100%" placeholder="Full Name"></div>
      <div class="form-group"><label>Email</label><input type="email" id="nu-email" style="width:100%" placeholder="user@kampalamart.ug"></div>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Password</label><input type="password" id="nu-pw" style="width:100%" placeholder="Temporary password"></div>
      <div class="form-group"><label>Role</label>
        <select id="nu-role" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text)">
          <option>Employee</option><option>Manager</option><option>Admin</option>
        </select></div>
    </div>
    <div class="alert alert-info" style="margin-top:4px"><span>ℹ️</span>
      <small><strong>Employee</strong>: Sales + Customers only<br>
      <strong>Manager</strong>: Dashboard + Sales + Reports + Inventory + Customers<br>
      <strong>Admin</strong>: Full access to everything</small>
    </div>
    <div id="nu-error" style="color:var(--red);font-size:12px;margin-top:8px;display:none"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveNewUser()">Create User</button>
    </div>`);
}

async function saveNewUser() {
  const name = document.getElementById('nu-name').value.trim();
  const email = document.getElementById('nu-email').value.trim();
  const pw = document.getElementById('nu-pw').value;
  const role = document.getElementById('nu-role').value;
  const errEl = document.getElementById('nu-error');
  errEl.style.display = 'none';

  if (!name) { errEl.textContent = 'Name is required.'; errEl.style.display = 'block'; return; }
  if (!email) { errEl.textContent = 'Email is required.'; errEl.style.display = 'block'; return; }
  if (pw.length < 6) { errEl.textContent = 'Password must be 6+ characters.'; errEl.style.display = 'block'; return; }

  try {
    const newUser = await api('POST', '/users', { name, email, password: pw, role });
    db.users.push(newUser);
    closeModal();
    toast(`User "${name}" created successfully! 🎉`);
    renderUsers();
  } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
}


/* ══════════════════════════════════════════════════════════════
   PAGE: FINANCE
   ══════════════════════════════════════════════════════════════ */
function renderFinance() {
  const revenue = db.sales.filter(s => s.status === 'Completed').reduce((a, b) => a + b.amount, 0);
  const expenses = db.expenses.reduce((a, b) => a + b.amount, 0);
  const profit = revenue - expenses;

  document.getElementById('content-area').innerHTML = `
    <div class="stat-grid" style="margin-bottom:24px">
      <div class="stat-card"><div class="stat-label">Total Revenue</div>  <div class="stat-value" style="color:var(--accent)">${formatMoney(revenue)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Expenses</div> <div class="stat-value" style="color:var(--red)">${formatMoney(expenses)}</div></div>
      <div class="stat-card"><div class="stat-label">Net Profit</div>     <div class="stat-value" style="color:var(--green)">${formatMoney(profit)}</div>    <div class="stat-change ${profit >= 0 ? 'stat-up' : 'stat-down'}">Margin: ${revenue > 0 ? Math.round((profit / revenue) * 100) : 0}%</div></div>
      <div class="stat-card"><div class="stat-label">Cash on Hand</div>   <div class="stat-value">${formatMoney(db.sales.filter(s => s.status === 'Completed' && s.method === 'Cash').reduce((a, b) => a + b.amount, 0))}</div></div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Expense Tracker</div>
          <button class="btn btn-primary btn-sm" onclick="openAddExpenseModal()">+ Add Expense</button>
        </div>
        <div class="table-wrap"><table>
          <tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Action</th></tr>
          ${db.expenses.map(e => `<tr>
            <td style="color:var(--muted)">${e.date}</td>
            <td><span class="tag">${e.category}</span></td>
            <td>${e.desc}</td>
            <td style="color:var(--red);font-weight:600">- ${formatMoney(e.amount)}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteExpense('${e.id}')">Del</button></td>
          </tr>`).join('')}
          <tr style="border-top:2px solid var(--border)">
            <td colspan="3" style="text-align:right;font-weight:700;padding-top:10px">TOTAL EXPENSES</td>
            <td style="color:var(--red);font-weight:700;padding-top:10px">- ${formatMoney(expenses)}</td>
            <td></td>
          </tr>
        </table></div>
      </div>
      <div>
        <div class="card">
          <div class="card-header"><div class="card-title">Profit & Loss Summary</div></div>
          <table style="width:100%;font-size:13px">
            <tr><td style="padding:7px 0;color:var(--muted)">Gross Revenue</td><td style="text-align:right;font-weight:600;color:var(--green)">+ ${formatMoney(revenue)}</td></tr>
            ${db.expenses.map(e => `<tr><td style="padding:4px 0;color:var(--muted);font-size:12px">↳ ${e.category}</td><td style="text-align:right;color:var(--red);font-size:12px">- ${formatMoney(e.amount)}</td></tr>`).join('')}
            <tr style="border-top:1px solid var(--border)">
              <td style="padding:10px 0;font-weight:700">NET PROFIT</td>
              <td style="text-align:right;font-size:18px;font-weight:700;color:var(--green)">+ ${formatMoney(profit)}</td>
            </tr>
          </table>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Expense Breakdown</div></div>
          <div style="position:relative;height:200px"><canvas id="chartExp"></canvas></div>
        </div>
      </div>
    </div>`;

  setTimeout(() => {
    const el = document.getElementById('chartExp');
    if (el) new Chart(el, {
      type: 'doughnut',
      data: { labels: db.expenses.map(e => e.category), datasets: [{ data: db.expenses.map(e => e.amount), backgroundColor: ['#F59E0B', '#58A6FF', '#3FB950', '#D2A8FF', '#F85149'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8B949E', font: { size: 11 }, boxWidth: 10 } } } }
    });
  }, 100);
}

function openAddExpenseModal() {
  openModal('Add Expense', `
    <div class="form-grid">
      <div class="form-group"><label>Category</label>
        <select id="exp-cat" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text)">
          <option>Utilities</option><option>Supplies</option><option>Rent</option><option>Staff</option><option>Marketing</option><option>Other</option>
        </select></div>
      <div class="form-group"><label>Amount (UGX)</label><input type="number" id="exp-amt" style="width:100%" placeholder="0" min="0"></div>
    </div>
    <div class="form-group"><label>Description</label><input type="text" id="exp-desc" style="width:100%" placeholder="e.g. Monthly electricity bill"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveExpense()">Save Expense</button>
    </div>`);
}

async function saveExpense() {
  const amt = parseFloat(document.getElementById('exp-amt').value);
  const desc = document.getElementById('exp-desc').value.trim();
  if (!desc || !amt || amt <= 0) { toast('Please fill in all fields.', 'danger'); return; }
  try {
    const exp = await api('POST', '/expenses', {
      category: document.getElementById('exp-cat').value,
      desc, amount: amt
    });
    db.expenses.push(exp);
    closeModal(); toast('Expense recorded! ✓'); renderFinance();
  } catch (err) { toast(err.message, 'danger'); }
}

async function deleteExpense(id) {
  if (!ask('Delete this expense record?')) return;
  try {
    await api('DELETE', '/expenses/' + id);
    const idx = db.expenses.findIndex(x => x.id === id);
    if (idx !== -1) db.expenses.splice(idx, 1);
    toast('Expense deleted.', 'danger'); renderFinance();
  } catch (err) { toast(err.message, 'danger'); }
}


/* ══════════════════════════════════════════════════════════════
   PAGE: REPORTS
   ══════════════════════════════════════════════════════════════ */
function renderReports() {
  const revenue = db.sales.filter(s => s.status === 'Completed').reduce((a, b) => a + b.amount, 0);
  const expenses = db.expenses.reduce((a, b) => a + b.amount, 0);
  document.getElementById('content-area').innerHTML = `
    <div class="card-header" style="margin-bottom:16px">
      <div class="section-actions">
        <select style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text)"><option>Daily</option><option selected>Monthly</option><option>Yearly</option></select>
        <input type="month" value="2026-03" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text)">
      </div>
      <div class="section-actions">
        <button class="btn btn-primary btn-sm" onclick="printPage()">📄 Print / Export</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Revenue vs Expenses (${activeCurrency})</div></div>
      <div class="chart-wrap"><canvas id="chartRep"></canvas></div>
    </div>
    <div class="three-col">
      <div class="card">
        <div class="card-title" style="margin-bottom:12px">Payment Methods</div>
        ${(() => {
      const total = db.sales.filter(s => s.status === 'Completed').reduce((a, b) => a + b.amount, 0);
      const methods = ['Cash', 'Mobile Money', 'Bank Transfer'];
      const colors = ['var(--green)', 'var(--blue)', 'var(--purple)'];
      if (total === 0) return `<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px 0">No sales recorded yet.</div>`;
      return methods.map((m, i) => {
        const amt = db.sales.filter(s => s.status === 'Completed' && s.method === m).reduce((a, b) => a + b.amount, 0);
        const pct = Math.round((amt / total) * 100);
        return `<div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${m}</span><span style="color:${colors[i]};font-weight:600">${pct}%</span></div>
              <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${colors[i]}"></div></div>
            </div>`;
      }).join('');
    })()}
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:12px">Top Products</div>
        ${(() => {
      const productTotals = {};
      db.sales.filter(s => s.status === 'Completed').forEach(s => {
        productTotals[s.items] = (productTotals[s.items] || 0) + s.amount;
      });
      const sorted = Object.entries(productTotals).sort((a, b) => b[1] - a[1]).slice(0, 4);
      if (sorted.length === 0) return `<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px 0">No sales recorded yet.</div>`;
      return sorted.map(([name, val], i) => `
            <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
              <span style="width:18px;color:var(--muted);font-size:13px">${i + 1}</span>
              <div style="flex:1;font-size:13px">${name}</div>
              <span style="color:var(--accent);font-size:12px;font-weight:600">${formatMoney(val)}</span>
            </div>`).join('');
    })()}
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:12px">Summary</div>
        ${[['Total Revenue', formatMoney(revenue)], ['Total Expenses', formatMoney(expenses)], ['Net Profit', formatMoney(revenue - expenses)], ['Products', db.inventory.length + ''], ['Customers', db.customers.length + ''], ['Transactions', db.sales.length + '']].map(([l, v]) => `
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--surface2);font-size:13px">
            <span style="color:var(--muted)">${l}</span><span style="font-weight:600">${v}</span>
          </div>`).join('')}
      </div>
    </div>`;

  setTimeout(() => {
    const c = CURRENCIES[activeCurrency];
    const wRev = weeklySalesUGX.map(v => +(v * c.rate).toFixed(c.dec));
    const wExp = new Array(7).fill(0).map(v => +(v * c.rate).toFixed(c.dec));
    const el = document.getElementById('chartRep');
    if (el) new Chart(el, {
      type: 'line',
      data: {
        labels: weeklyLabels, datasets: [
          { label: 'Revenue', data: wRev, borderColor: '#F59E0B', backgroundColor: '#F59E0B22', tension: 0.4, fill: true },
          { label: 'Expenses', data: wExp, borderColor: '#F85149', backgroundColor: '#F8514922', tension: 0.4, fill: true }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#8B949E', boxWidth: 12, font: { size: 12 } } } },
        scales: { x: { ticks: { color: '#8B949E' }, grid: { color: '#30363D44' } }, y: { ticks: { color: '#8B949E', callback: v => formatAxisVal(v) }, grid: { color: '#30363D44' } } }
      }
    });
  }, 100);
}


/* ══════════════════════════════════════════════════════════════
   PAGE: NOTIFICATIONS
   ══════════════════════════════════════════════════════════════ */
const allNotifs = [];

function renderNotifications() {
  const unread = allNotifs.filter(n => !n.read).length;
  document.getElementById('content-area').innerHTML = `
    <div class="card-header" style="margin-bottom:16px">
      <span style="color:var(--muted);font-size:13px">${unread} unread notification${unread !== 1 ? 's' : ''}</span>
      ${allNotifs.length ? `<button class="btn btn-ghost btn-sm" onclick="markAllRead()">Mark All Read</button>` : ''}
    </div>
    <div class="card" id="notif-list">
      ${allNotifs.length === 0
      ? `<div style="text-align:center;padding:48px;color:var(--muted)">
             <div style="font-size:40px;margin-bottom:12px">🔔</div>
             <div style="font-size:15px;font-weight:600;margin-bottom:6px">No notifications yet</div>
             <div style="font-size:13px">Alerts for low stock, orders, and payments will appear here.</div>
           </div>`
      : allNotifs.map((n, i) => `
          <div class="log-item" id="notif-${i}" style="${n.read ? 'opacity:0.55' : ''}">
            <div style="font-size:20px;line-height:1">${n.icon}</div>
            <div style="flex:1">
              <div class="log-text" style="font-weight:${n.read ? '400' : '600'}">${n.title}</div>
              <div class="log-time">${n.time}</div>
            </div>
            ${!n.read ? `<button class="btn btn-ghost btn-sm" onclick="markRead(${i})">Mark read</button><span class="badge badge-blue" style="font-size:10px">New</span>` : ''}
          </div>`).join('')}
    </div>`;
}

function markRead(i) {
  allNotifs[i].read = true;
  updateNotifBadge();
  renderNotifications();
}

function markAllRead() {
  allNotifs.forEach(n => n.read = true);
  updateNotifBadge();
  renderNotifications();
}

function updateNotifBadge() {
  const count = allNotifs.filter(n => !n.read).length;
  const el = document.getElementById('notif-count');
  if (el) { el.textContent = count; el.style.display = count > 0 ? 'inline' : 'none'; }
  const dot = document.querySelector('.notif-dot');
  if (dot) dot.style.display = count > 0 ? 'block' : 'none';
}


/* ══════════════════════════════════════════════════════════════
   PAGE: SETTINGS
   ══════════════════════════════════════════════════════════════ */
function renderSettings() {
  document.getElementById('content-area').innerHTML = `
    <div class="two-col">
      <div>
        <!-- Business Info -->
        <div class="card">
          <div class="card-title" style="margin-bottom:16px">🏢 Business Information</div>
          <div class="form-group"><label>Business Name</label>          <input type="text" id="biz-name-inp" style="width:100%" value="Kampala Mart Ltd"></div>
          <div class="form-group"><label>Address</label>                <input type="text" id="biz-addr" style="width:100%" value="Plot 45, Kampala Road, Kampala"></div>
          <div class="form-group"><label>Phone</label>                  <input type="text" id="biz-phone" style="width:100%" value="+256 414 000000"></div>
          <div class="form-group"><label>Email</label>                  <input type="text" id="biz-email" style="width:100%" value="info@kampalamart.ug"></div>
          <div class="form-group"><label>TIN Number</label>             <input type="text" id="biz-tin"   style="width:100%" value="1001234567"></div>
          <button class="btn btn-primary" onclick="saveBizInfo()">Save Changes</button>
        </div>

        <!-- Currency Settings -->
        <div class="card">
          <div class="card-title" style="margin-bottom:16px">💰 Currency & Financial Settings</div>
          <div class="form-group">
            <label>Display Currency</label>
            <select id="settings-currency" onchange="changeCurrencyFromSettings(this.value)" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text)">
              ${Object.entries(CURRENCIES).map(([code, info]) => `<option value="${code}" ${activeCurrency === code ? 'selected' : ''}>${code} — ${info.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>VAT Rate (%)</label><input type="number" id="vat-rate" style="width:100%" value="18" min="0" max="100"></div>
          <div class="alert alert-info" style="margin-top:4px"><span>ℹ️</span><small>Changing currency updates all money values throughout the entire app instantly. Exchange rates are approximate.</small></div>
          <button class="btn btn-primary" style="margin-top:12px" onclick="toast('Financial settings saved! ✓')">Save</button>
        </div>
      </div>

      <div>
        <!-- Security -->
        <div class="card">
          <div class="card-title" style="margin-bottom:16px">🔒 Security Settings</div>
          ${[
      ['Data Encryption', 'AES-256 encryption active', '✅ Active'],
      ['Automatic Backup', 'Daily backup at 11:00 PM', '✅ Enabled'],
      ['Activity Logging', 'All user actions logged', '✅ Active'],
      ['Session Timeout', 'Auto-logout after 30 mins', '⚙️ 30 min'],
      ['Two-Factor Auth', 'SMS verification', '⚠️ Setup needed'],
    ].map(([t, d, s]) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
              <div><div style="font-size:13px;font-weight:600">${t}</div><div style="font-size:11px;color:var(--muted)">${d}</div></div>
              <span style="font-size:12px;white-space:nowrap">${s}</span>
            </div>`).join('')}
          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="toast('Backup started! 🗄️')">🗄️ Backup Now</button>
            <button class="btn btn-ghost btn-sm" onclick="nav('users')">👥 Manage Users</button>
          </div>
        </div>

        <!-- Appearance -->
        <div class="card">
          <div class="card-title" style="margin-bottom:16px">🎨 Appearance</div>
          <div class="form-group">
            <label>Receipt Footer Message</label>
            <textarea id="receipt-footer" style="width:100%;height:60px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);resize:vertical">Thank you for shopping with us! 🙏</textarea>
          </div>
          <div class="form-group"><label>Low Stock Alert Threshold (%)</label><input type="number" id="low-stock-pct" style="width:100%" value="20" min="5" max="80"></div>
          <button class="btn btn-primary" onclick="toast('Preferences saved! ✓')">Save Preferences</button>
        </div>

        <!-- Activity Log -->
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">📋 Recent Activity Log</div>
          ${[
      ['Admin User logged in', 'Today 09:15 AM', 'var(--green)'],
      ['New sale TXN-001 recorded', 'Today 09:32 AM', 'var(--accent)'],
      ['Inventory: Juice +50 units', 'Today 10:00 AM', 'var(--blue)'],
      ['Password changed for John Staff', 'Yesterday 3:00 PM', 'var(--orange)'],
      ['Backup completed successfully', 'Yesterday 11:00 PM', 'var(--green)'],
    ].map(([t, d, c]) => `
            <div class="log-item">
              <div class="log-dot" style="background:${c}"></div>
              <div><div class="log-text">${t}</div><div class="log-time">${d}</div></div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function saveBizInfo() {
  const name = document.getElementById('biz-name-inp').value.trim();
  if (name) document.getElementById('biz-name').textContent = name;
  toast('Business information saved! 🏢');
}

function changeCurrencyFromSettings(code) {
  // Also sync the topbar dropdown
  document.getElementById('currency-select').value = code;
  changeCurrency(code);
}


/* ═══════════════════════════════════════════════════════════════
   PAGE: RAW MATERIALS
   ═══════════════════════════════════════════════════════════════ */
function renderRawMaterials() {
  const items = db.rawMaterials || [];
  const alerts = items.filter(i => i.status !== 'In Stock');
  document.getElementById('content-area').innerHTML = `
    ${alerts.length ? `<div class="alert alert-warn"><span>⚠️</span>
    <strong>${alerts.length} items need attention:</strong> ${alerts.map(i => i.name).join(', ')}</div>` : ''}
    <div class="card-header" style="margin-bottom:16px">
      <div class="section-actions">
        <input class="search-bar" id="raw-search" placeholder="🔍 Search materials..." oninput="filterRaw(this.value)">
      </div>
      <div class="section-actions">
        <button class="btn btn-primary" onclick="openAddRawModal()">+ Add Material</button>
        <button class="btn btn-ghost btn-sm" onclick="printPage()">Export / Print</button>
      </div>
    </div>
    <div class="stat-grid" style="margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">Total Materials</div><div class="stat-value">${items.length}</div></div>
      <div class="stat-card"><div class="stat-label">In Stock</div><div class="stat-value" style="color:var(--green)">${items.filter(i => i.status === 'In Stock').length}</div></div>
      <div class="stat-card"><div class="stat-label">Low Stock</div><div class="stat-value" style="color:var(--orange)">${items.filter(i => i.status === 'Low Stock').length}</div></div>
      <div class="stat-card"><div class="stat-label">Out of Stock</div><div class="stat-value" style="color:var(--red)">${items.filter(i => i.status === 'Out of Stock').length}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Raw Material Inventory</div>
      <span style="color:var(--muted);font-size:12px">${items.length} materials</span></div>
      <div class="table-wrap"><table id="raw-table">
        <tr><th>ID</th><th>Material</th><th>Unit</th><th>Qty</th><th>Min</th><th>Level</th>
        <th>Cost/Unit (${activeCurrency})</th><th>Supplier</th><th>Last Restock</th><th>Status</th><th>Actions</th></tr>
        ${items.map(m => rawRow(m)).join('')}
      </table></div>
    </div>`;
}

function rawRow(m) {
  const pct = Math.min(Math.round((m.qty / Math.max(m.min * 3, 1)) * 100), 100);
  const col = m.status === 'In Stock' ? 'var(--green)' : m.status === 'Low Stock' ? 'var(--orange)' : 'var(--red)';
  return `<tr data-name="${m.name.toLowerCase()}">
    <td style="color:var(--muted);font-size:12px">${m.id}</td>
    <td><strong>${m.name}</strong></td>
    <td><span class="tag">${m.unit}</span></td>
    <td style="font-weight:700">${m.qty}</td>
    <td style="color:var(--muted)">${m.min}</td>
    <td style="min-width:110px">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${col}"></div></div>
      <span style="font-size:10px;color:var(--muted)">${pct}%</span></td>
    <td style="color:var(--accent)">${formatMoney(m.cost_per_unit)}</td>
    <td style="font-size:12px;color:var(--muted)">${m.supplier}</td>
    <td style="color:var(--muted);font-size:12px">${m.last_restock || '---'}</td>
    <td>${badge(m.status)}</td>
    <td><div style="display:flex;gap:6px">
      <button class="btn btn-ghost btn-sm" onclick="editRaw('${m.id}')">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteRaw('${m.id}')">Del</button>
    </div></td>
  </tr>`;
}

function filterRaw(q) {
  q = q.toLowerCase();
  document.querySelectorAll('#raw-table tr[data-name]').forEach(row => {
    row.style.display = (!q || row.dataset.name.includes(q)) ? '' : 'none';
  });
}

function openAddRawModal() {
  openModal('Add Raw Material', `
    <div class="form-grid">
      <div class="form-group"><label>Material Name</label>
        <input type="text" id="rm-name" style="width:100%" placeholder="e.g. Wheat Flour"></div>
      <div class="form-group"><label>Unit of Measure</label>
        <select id="rm-unit" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text)">
          <option>kg</option><option>g</option><option>L</option><option>mL</option><option>bags</option><option>crates</option><option>pcs</option>
        </select></div>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Current Quantity</label>
        <input type="number" id="rm-qty" style="width:100%" placeholder="0" min="0"></div>
      <div class="form-group"><label>Minimum Level</label>
        <input type="number" id="rm-min" style="width:100%" placeholder="5" min="0"></div>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Cost per Unit (UGX)</label>
        <input type="number" id="rm-cost" style="width:100%" placeholder="0" min="0"></div>
      <div class="form-group"><label>Supplier</label>
        <select id="rm-sup" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text)">
          <option value="">-- No Supplier --</option>
          ${(db.suppliers || []).map(s => `<option>${s.name}</option>`).join('')}
        </select></div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveRawMaterial()">Save Material</button>
    </div>`);
}

async function saveRawMaterial() {
  const name = document.getElementById('rm-name').value.trim();
  const qty = parseFloat(document.getElementById('rm-qty').value);
  const min = parseFloat(document.getElementById('rm-min').value);
  const cost = parseFloat(document.getElementById('rm-cost').value);
  if (!name || isNaN(qty) || isNaN(cost)) { toast('Please fill all required fields.', 'danger'); return; }
  try {
    const mat = await api('POST', '/raw-materials', {
      name, unit: document.getElementById('rm-unit').value,
      qty, min: isNaN(min) ? 5 : min, cost_per_unit: cost,
      supplier: document.getElementById('rm-sup').value
    });
    (db.rawMaterials = db.rawMaterials || []).push(mat);
    closeModal();
    toast('Raw material added! 🧪');
    renderRawMaterials();
  } catch (err) { toast(err.message, 'danger'); }
}

function editRaw(id) {
  const m = (db.rawMaterials || []).find(x => x.id === id);
  if (!m) return;
  openModal(`Edit — ${m.name}`, `
    <div class="form-grid">
      <div class="form-group"><label>Quantity (${m.unit})</label>
        <input type="number" id="er-qty" value="${m.qty}" style="width:100%"></div>
      <div class="form-group"><label>Minimum Level</label>
        <input type="number" id="er-min" value="${m.min}" style="width:100%"></div>
    </div>
    <div class="form-group"><label>Cost per Unit (UGX)</label>
      <input type="number" id="er-cost" value="${m.cost_per_unit}" style="width:100%"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="applyEditRaw('${id}')">Save Changes</button>
    </div>`);
}

async function applyEditRaw(id) {
  const m = (db.rawMaterials || []).find(x => x.id === id);
  const qty = parseFloat(document.getElementById('er-qty').value);
  const min = parseFloat(document.getElementById('er-min').value);
  const cost = parseFloat(document.getElementById('er-cost').value);
  if (!m || isNaN(qty)) return;
  try {
    await api('PUT', '/raw-materials/' + id, { qty, min, cost_per_unit: cost, supplier: m.supplier });
    m.qty = qty; m.min = min; m.cost_per_unit = cost;
    m.status = qty === 0 ? 'Out of Stock' : qty <= min ? 'Low Stock' : 'In Stock';
    closeModal(); toast('Material updated! ✓'); renderRawMaterials();
  } catch (err) { toast(err.message, 'danger'); }
}

async function deleteRaw(id) {
  if (!ask('Delete this material? This cannot be undone.')) return;
  try {
    await api('DELETE', '/raw-materials/' + id);
    const idx = (db.rawMaterials || []).findIndex(x => x.id === id);
    if (idx !== -1) db.rawMaterials.splice(idx, 1);
    toast('Material deleted.', 'danger'); renderRawMaterials();
  } catch (err) { toast(err.message, 'danger'); }
}


/* ══════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  // Enter key on login screen
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') {
    doLogin();
  }
});
