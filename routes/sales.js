const router = require('express').Router();
const db     = require('../database');
const auth   = require('../middleware/auth');

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

  res.json({ id, date, customer, items, method, amount, status: 'Completed', notes });
});

module.exports = router;
