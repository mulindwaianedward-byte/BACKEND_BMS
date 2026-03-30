const router = require('express').Router();
const db     = require('../database');
const auth   = require('../middleware/auth');

// GET all orders
router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM orders ORDER BY date DESC').all());
});

// POST add order
router.post('/', auth, (req, res) => {
  const { customer, items, total, delivery } = req.body;
  const count = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const id    = 'ORD-' + String(count + 1).padStart(3, '0');
  const date  = new Date().toISOString().split('T')[0];

  db.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?)')
    .run(id, customer, date, items, total || 0, delivery || 'Pickup', 'Pending');

  res.json({ id, customer, date, items, total, delivery, status: 'Pending' });
});

// PUT update order status
router.put('/:id/status', auth, (req, res) => {
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(req.body.status, req.params.id);
  res.json({ ok: true });
});

// DELETE order
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM orders WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
