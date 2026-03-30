const router = require('express').Router();
const db     = require('../database');
const auth   = require('../middleware/auth');

// Helper: get all settings as a plain object
function getAll() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// Helper: log an activity
function log(user, action, detail = '') {
  db.prepare('INSERT INTO activity_log (timestamp, user, action, detail) VALUES (?,?,?,?)')
    .run(new Date().toISOString(), user, action, detail);
}

// GET all settings
router.get('/', auth, (req, res) => {
  res.json(getAll());
});

// PUT update a single setting
router.put('/:key', auth, (req, res) => {
  if (req.user.role !== 'Admin')
    return res.status(403).json({ error: 'Admin only.' });

  const { value } = req.body;
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(req.params.key, value);
  log(req.user.name, 'Setting changed', `${req.params.key} = ${value}`);
  res.json({ ok: true, key: req.params.key, value });
});

// POST force re-login (rotate the token secret stamp)
router.post('/force-relogin', auth, (req, res) => {
  if (req.user.role !== 'Admin')
    return res.status(403).json({ error: 'Admin only.' });

  const newToken = Date.now().toString();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('force_relogin_token', newToken);
  log(req.user.name, 'Force re-login', 'All sessions invalidated');
  res.json({ ok: true });
});

// GET activity log (last 50 entries, newest first)
router.get('/activity-log', auth, (req, res) => {
  if (req.user.role !== 'Admin')
    return res.status(403).json({ error: 'Admin only.' });

  const rows = db.prepare(
    'SELECT * FROM activity_log ORDER BY id DESC LIMIT 50'
  ).all();
  res.json(rows);
});

// POST write an activity log entry (called from frontend on key actions)
router.post('/activity-log', auth, (req, res) => {
  const { action, detail } = req.body;
  log(req.user.name, action, detail || '');
  res.json({ ok: true });
});

module.exports = router;
module.exports.log = log; // export helper so other routes can use it
