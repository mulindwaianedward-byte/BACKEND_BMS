const router = require('express').Router();
const db     = require('../database');
const auth   = require('../middleware/auth');
const { broadcast } = require('../sse');

// GET all stock
router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM stock').all());
});

// POST add stock item
router.post('/', auth, (req, res) => {
  const { name, cat, qty, min, price, supplier } = req.body;
  const status = qty === 0 ? 'Out of Stock' : qty <= min ? 'Low Stock' : 'In Stock';
  const count  = db.prepare('SELECT COUNT(*) as c FROM stock').get().c;
  const id     = 'PRD-' + String(count + 1).padStart(3, '0');

  db.prepare('INSERT INTO stock VALUES (?,?,?,?,?,?,?,?)')
    .run(id, name, cat, qty, min, price, supplier, status);

  // Broadcast if newly added item is already low/out
  if (status !== 'In Stock') {
    broadcast('stock-alert', {
      icon:   status === 'Out of Stock' ? '🔴' : '🟡',
      title:  `${status}: ${name}`,
      detail: `${qty} units (min: ${min})`,
      time:   new Date().toISOString()
    });
  }

  res.json({ id, name, cat, qty, min, price, supplier, status });
});

// PUT update stock item
router.put('/:id', auth, (req, res) => {
  const { qty, min, price } = req.body;
  const status = qty === 0 ? 'Out of Stock' : qty <= min ? 'Low Stock' : 'In Stock';

  // Get item name for the broadcast
  const item = db.prepare('SELECT name FROM stock WHERE id=?').get(req.params.id);

  db.prepare('UPDATE stock SET qty=?, min=?, price=?, status=? WHERE id=?')
    .run(qty, min, price, status, req.params.id);

  // Broadcast if updated item is now low/out
  if (status !== 'In Stock' && item) {
    broadcast('stock-alert', {
      icon:   status === 'Out of Stock' ? '🔴' : '🟡',
      title:  `${status}: ${item.name}`,
      detail: `${qty} units remaining (min: ${min})`,
      time:   new Date().toISOString()
    });
  }

  res.json({ ok: true });
});

// DELETE stock item
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM stock WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
