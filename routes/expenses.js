const router = require('express').Router();
const db     = require('../database');
const auth   = require('../middleware/auth');

// GET all expenses
router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM expenses ORDER BY date DESC').all());
});

// POST add expense
router.post('/', auth, (req, res) => {
  const { category, desc, amount } = req.body;
  const count = db.prepare('SELECT COUNT(*) as c FROM expenses').get().c;
  const id    = 'EXP-' + String(count + 1).padStart(3, '0');
  const date  = new Date().toISOString().split('T')[0];

  db.prepare('INSERT INTO expenses VALUES (?,?,?,?,?)').run(id, date, category, desc, amount);

  res.json({ id, date, category, desc, amount });
});

// DELETE expense
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
