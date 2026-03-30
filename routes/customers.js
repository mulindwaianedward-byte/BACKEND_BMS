const router = require('express').Router();
const db     = require('../database');
const auth   = require('../middleware/auth');

// GET all customers
router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM customers').all());
});

// POST add customer
router.post('/', auth, (req, res) => {
  const { name, phone, email } = req.body;
  const count = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
  const id    = 'CUS-' + String(count + 1).padStart(3, '0');
  const today = new Date().toISOString().split('T')[0];

  db.prepare('INSERT INTO customers VALUES (?,?,?,?,?,?,?,?)')
    .run(id, name, phone, email || '---', 0, 0, today, 'Bronze');

  res.json({ id, name, phone, email: email || '---', purchases: 0, total: 0, last_visit: today, loyalty: 'Bronze' });
});

// DELETE customer
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
