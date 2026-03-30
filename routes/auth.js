const router  = require('express').Router();
const db      = require('../database');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { broadcast } = require('../sse');
const SECRET  = process.env.JWT_SECRET || 'bms-secret-key-change-in-production';

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function logActivity(user, action, detail = '') {
  db.prepare('INSERT INTO activity_log (timestamp, user, action, detail) VALUES (?,?,?,?)')
    .run(new Date().toISOString(), user, action, detail);
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Incorrect email or password.' });

  if (user.status === 'Blocked')
    return res.status(403).json({ error: 'Account blocked. Contact admin.' });

  if (user.role === 'Employee' && getSetting('employee_login_enabled') === 'false')
    return res.status(403).json({ error: 'Employee logins are currently disabled by the administrator.' });

  if (user.role === 'Manager' && getSetting('manager_login_enabled') === 'false')
    return res.status(403).json({ error: 'Manager logins are currently disabled by the administrator.' });

  db.prepare('UPDATE users SET last_login = ? WHERE id = ?')
    .run(new Date().toISOString(), user.id);

  const forceToken = getSetting('force_relogin_token') || '0';
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, frt: forceToken },
    SECRET,
    { expiresIn: '8h' }
  );

  logActivity(user.name, 'Login', `Role: ${user.role}`);

  // Broadcast login event to all connected admins
  broadcast('user-login', {
    icon:    '🔑',
    title:   `${user.name} logged in`,
    detail:  `Role: ${user.role}`,
    time:    new Date().toISOString()
  });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

// POST /api/auth/logout  (optional explicit logout broadcast)
router.post('/logout', (req, res) => {
  const header = req.headers['authorization'];
  const token  = header && header.split(' ')[1];
  let name = 'Unknown';
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'bms-secret-key-change-in-production');
    name = decoded.name;
    logActivity(name, 'Logout', '');
  } catch {}

  broadcast('user-logout', {
    icon:   '🚪',
    title:  `${name} logged out`,
    detail: '',
    time:   new Date().toISOString()
  });

  res.json({ ok: true });
});

module.exports = router;
