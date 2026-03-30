require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const jwt     = require('jsonwebtoken');
const { addClient, removeClient } = require('./sse');

const SECRET = process.env.JWT_SECRET || 'bms-secret-key-change-in-production';
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── SSE endpoint — browsers connect here after login ──────────
app.get('/api/events', (req, res) => {
  // Verify token from query param (SSE can't send headers)
  const token = req.query.token;
  if (!token) return res.status(401).end();
  try { jwt.verify(token, SECRET); } catch { return res.status(403).end(); }

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // Send a heartbeat every 25s to keep the connection alive on Railway
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 25000);

  addClient(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(res);
  });
});

// ── API routes ────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/sales',        require('./routes/sales'));
app.use('/api/stock',        require('./routes/stock'));
app.use('/api/raw-materials',require('./routes/rawMaterials'));
app.use('/api/customers',    require('./routes/customers'));
app.use('/api/suppliers',    require('./routes/suppliers'));
app.use('/api/orders',       require('./routes/orders'));
app.use('/api/expenses',     require('./routes/expenses'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/settings',     require('./routes/settings'));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ BMS running on http://localhost:${PORT}`));
