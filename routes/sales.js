const router = require('express').Router();
const db     = require('../database');
const auth   = require('../middleware/auth');
const { broadcast } = require('../sse');

// GET all sales
router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM sales ORDER BY date DESC').all());
});

// POST record new sale
router.post('/', auth, (req, res) => {
  const { customer, items, method, amount, notes } = req.body;
  const count = db.prepare('SELECT COUNT(*) as c FROM sales').get().c;
  const id    = 'TXN-' + String(count + 1).padStart(3, '0');
  const date  = new Date().toISOString().split('T')[0];

  db.prepare('INSERT INTO sales VALUES (?,?,?,?,?,?,?,?)')
    .run(id, date, customer, items, method, amount, 'Completed', notes || '');

  // Broadcast new sale
  broadcast('new-sale', {
    icon:   '💰',
    title:  `New sale recorded — ${id}`,
    detail: `${customer} · ${items} · UGX ${Number(amount).toLocaleString()}`,
    time:   new Date().toISOString()
  });

  // Check all stock for low/out-of-stock after a sale
  const stockItems = db.prepare('SELECT * FROM stock').all();
  for (const item of stockItems) {
    if (item.status === 'Out of Stock') {
      broadcast('stock-alert', {
        icon:   '🔴',
        title:  `Out of Stock: ${item.name}`,
        detail: `0 units remaining`,
        time:   new Date().toISOString()
      });
    } else if (item.status === 'Low Stock') {
      broadcast('stock-alert', {
        icon:   '🟡',
        title:  `Low Stock: ${item.name}`,
        detail: `${item.qty} left (min: ${item.min})`,
        time:   new Date().toISOString()
      });
    }
  }

  res.json({ id, date, customer, items, method, amount, status: 'Completed', notes });
});

module.exports = router;
