const router = require('express').Router();
const db     = require('../database');
const auth   = require('../middleware/auth');

// GET all raw materials
router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM raw_materials').all());
});

// POST add raw material
router.post('/', auth, (req, res) => {
  const { name, unit, qty, min, cost_per_unit, supplier } = req.body;
  const status = qty === 0 ? 'Out of Stock' : qty <= min ? 'Low Stock' : 'In Stock';
  const count  = db.prepare('SELECT COUNT(*) as c FROM raw_materials').get().c;
  const id     = 'RAW-' + String(count + 1).padStart(3, '0');
  const today  = new Date().toISOString().split('T')[0];

  db.prepare('INSERT INTO raw_materials VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, name, unit, qty, min, cost_per_unit, supplier, status, today);

  res.json({ id, name, unit, qty, min, cost_per_unit, supplier, status, last_restock: today });
});

// PUT update raw material
router.put('/:id', auth, (req, res) => {
  const { qty, min, cost_per_unit, supplier } = req.body;
  const status = qty === 0 ? 'Out of Stock' : qty <= min ? 'Low Stock' : 'In Stock';
  const today  = new Date().toISOString().split('T')[0];

  db.prepare('UPDATE raw_materials SET qty=?, min=?, cost_per_unit=?, supplier=?, status=?, last_restock=? WHERE id=?')
    .run(qty, min, cost_per_unit, supplier, status, today, req.params.id);

  res.json({ ok: true });
});

// DELETE raw material
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM raw_materials WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
