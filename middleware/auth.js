const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'bms-secret-key-change-in-production';

module.exports = function verifyToken(req, res, next) {
  const header = req.headers['authorization'];
  const token  = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
};
