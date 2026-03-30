const router = require('express').Router();
const db     = require('../database');
const auth   = require('../middleware/auth');

// GET all suppliers
router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers').all());
});

// POST add supplier
router.post('/', auth, (req, res) => {
  const { name, contact, phone } = req.body;
  const count = db.prepare('SELECT COUNT(*) as c FROM suppliers').get().c;
  const id    = 'SUP-' + String(count + 1).padStart(3, '0');

  db.prepare('INSERT INTO suppliers (id, name, contact, phone) VALUES (?,?,?,?)')
    .run(id, name, contact || '---', phone || '---');

  res.json({ id, name, contact: contact || '---', phone: phone || '---', items: 0, last_order: '---', balance: 0, status: 'Active' });
});

// PUT mark supplier balance as paid
router.put('/:id/pay', auth, (req, res) => {
  db.prepare('UPDATE suppliers SET balance=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// DELETE supplier
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
