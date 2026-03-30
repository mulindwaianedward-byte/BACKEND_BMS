const Database = require('better-sqlite3');
const db = new Database('./bms.db');

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    email     TEXT UNIQUE NOT NULL,
    password  TEXT NOT NULL,
    role      TEXT NOT NULL DEFAULT 'Employee',
    status    TEXT NOT NULL DEFAULT 'Active',
    last_login TEXT DEFAULT 'Never'
  );

  CREATE TABLE IF NOT EXISTS sales (
    id       TEXT PRIMARY KEY,
    date     TEXT NOT NULL,
    customer TEXT NOT NULL,
    items    TEXT NOT NULL,
    method   TEXT NOT NULL,
    amount   REAL NOT NULL,
    status   TEXT DEFAULT 'Completed',
    notes    TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS stock (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    cat      TEXT NOT NULL,
    qty      INTEGER NOT NULL DEFAULT 0,
    min      INTEGER NOT NULL DEFAULT 10,
    price    REAL NOT NULL DEFAULT 0,
    supplier TEXT NOT NULL DEFAULT '',
    status   TEXT DEFAULT 'In Stock'
  );

  CREATE TABLE IF NOT EXISTS raw_materials (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    unit          TEXT NOT NULL,
    qty           REAL NOT NULL DEFAULT 0,
    min           REAL NOT NULL DEFAULT 5,
    cost_per_unit REAL NOT NULL DEFAULT 0,
    supplier      TEXT NOT NULL DEFAULT '',
    status        TEXT DEFAULT 'In Stock',
    last_restock  TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS customers (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL,
    email      TEXT DEFAULT '---',
    purchases  INTEGER DEFAULT 0,
    total      REAL DEFAULT 0,
    last_visit TEXT DEFAULT '',
    loyalty    TEXT DEFAULT 'Bronze'
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    contact    TEXT DEFAULT '---',
    phone      TEXT DEFAULT '---',
    items      INTEGER DEFAULT 0,
    last_order TEXT DEFAULT '---',
    balance    REAL DEFAULT 0,
    status     TEXT DEFAULT 'Active'
  );

  CREATE TABLE IF NOT EXISTS orders (
    id       TEXT PRIMARY KEY,
    customer TEXT NOT NULL,
    date     TEXT NOT NULL,
    items    TEXT NOT NULL,
    total    REAL NOT NULL DEFAULT 0,
    delivery TEXT DEFAULT 'Pickup',
    status   TEXT DEFAULT 'Pending'
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id       TEXT PRIMARY KEY,
    date     TEXT NOT NULL,
    category TEXT NOT NULL,
    desc     TEXT NOT NULL,
    amount   REAL NOT NULL
  );
`);

// Seed the admin user on first run
const bcrypt = require('bcryptjs');
const existing = db.prepare('SELECT id FROM users WHERE id = ?').get('USR-001');
if (!existing) {
  const hashed = bcrypt.hashSync('edward@2002', 10);
  db.prepare(`
    INSERT INTO users (id, name, email, password, role, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('USR-001', 'Mulindwa Ian Edward', 'mulindwaianedward@gmail.com', hashed, 'Admin', 'Active');
  console.log('✅ Admin user seeded.');
}

module.exports = db;
