const router = require('express').Router();
const db     = require('../database');
const auth   = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// GET all users (never return passwords)
router.get('/', auth, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, status, last_login FROM users').all();
  res.json(users);
});

// POST add user
router.post('/', auth, (req, res) => {
  const { name, email, password, role } = req.body;
  const count  = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const id     = 'USR-' + String(count + 1).padStart(3, '0');
  const hashed = bcrypt.hashSync(password, 10);

  db.prepare('INSERT INTO users (id, name, email, password, role, status) VALUES (?,?,?,?,?,?)')
    .run(id, name, email, hashed, role, 'Active');

  res.json({ id, name, email, role, status: 'Active', last_login: 'Never' });
});

// PUT toggle block/unblock user
router.put('/:id/block', auth, (req, res) => {
  const u         = db.prepare('SELECT status FROM users WHERE id=?').get(req.params.id);
  const newStatus = u.status === 'Blocked' ? 'Active' : 'Blocked';
  db.prepare('UPDATE users SET status=? WHERE id=?').run(newStatus, req.params.id);
  res.json({ status: newStatus });
});

// PUT change password
router.put('/:id/password', auth, (req, res) => {
  const hashed = bcrypt.hashSync(req.body.password, 10);
  db.prepare('UPDATE users SET password=? WHERE id=?').run(hashed, req.params.id);
  res.json({ ok: true });
});

// DELETE user
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
