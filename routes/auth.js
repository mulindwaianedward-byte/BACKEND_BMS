const router  = require('express').Router();
const db      = require('../database');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const SECRET  = process.env.JWT_SECRET || 'bms-secret-key-change-in-production';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Incorrect email or password.' });

  if (user.status === 'Blocked')
    return res.status(403).json({ error: 'Account blocked. Contact admin.' });

  db.prepare('UPDATE users SET last_login = ? WHERE id = ?')
    .run(new Date().toISOString(), user.id);

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

module.exports = router;
