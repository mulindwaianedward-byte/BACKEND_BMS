const router = require('express').Router();
const db     = require('../database');
const auth   = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { broadcast } = require('../sse');

// GET all users (never return passwords)
router.get('/', auth, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, status, last_login FROM users').all();
  res.json(users);
});

// POST add user
router.post('/', auth, (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'All fields are required.' });

  // Check for duplicate email BEFORE trying to insert
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing)
    return res.status(400).json({ error: 'An account with this email already exists.' });

  try {
    // Use a timestamp-based unique ID instead of COUNT — avoids collisions
    const id     = 'USR-' + Date.now();
    const hashed = bcrypt.hashSync(password, 10);

    db.prepare('INSERT INTO users (id, name, email, password, role, status) VALUES (?,?,?,?,?,?)')
      .run(id, name, email, hashed, role, 'Active');

    broadcast('new-user', {
      icon:   '👤',
      title:  `New user added: ${name}`,
      detail: `Role: ${role}`,
      time:   new Date().toISOString()
    });

    res.json({ id, name, email, role, status: 'Active', last_login: 'Never' });

  } catch (err) {
    console.error('Create user error:', err.message);
    res.status(500).json({ error: 'Could not create user. ' + err.message });
  }
});
// PUT toggle block/unblock user
router.put('/:id/block', auth, (req, res) => {
  const u         = db.prepare('SELECT status, name FROM users WHERE id=?').get(req.params.id);
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
