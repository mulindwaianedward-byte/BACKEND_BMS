const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'bms-secret-key-change-in-production';

module.exports = function verifyToken(req, res, next) {
  const header = req.headers['authorization'];
  const token  = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, SECRET);

    // Check force-relogin: compare token's frt with current DB value
    const db = require('../database');
    const row = db.prepare("SELECT value FROM settings WHERE key = 'force_relogin_token'").get();
    const currentFrt = row ? row.value : null;

    if (currentFrt && decoded.frt !== currentFrt) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
};
