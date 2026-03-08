const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, '..', 'judo-club.db'));

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    member_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    date_of_birth TEXT,
    address TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    medical_info TEXT,
    join_date TEXT DEFAULT (date('now')),
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS belt_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    belt_color TEXT NOT NULL,
    grade_date TEXT DEFAULT (date('now')),
    instructor TEXT,
    notes TEXT,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    class_date TEXT NOT NULL,
    class_type TEXT DEFAULT 'regular',
    notes TEXT,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    UNIQUE(member_id, class_date)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_date TEXT DEFAULT (date('now')),
    payment_type TEXT DEFAULT 'monthly',
    description TEXT,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
  CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(class_date);
  CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
`);

// Create default admin user if not exists
const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare("INSERT INTO users (email, password, role) VALUES (?, ?, ?)")
    .run('admin@judoclub.com', hashedPassword, 'admin');
  console.log('✓ Admin user created: admin@judoclub.com / admin123');
}

// Create news table
db.exec(`
  CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id INTEGER,
    file_path TEXT,
    file_name TEXT,
    file_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
  );
`);

// Add member type and board columns to members table
try {
  db.exec(`ALTER TABLE members ADD COLUMN member_type TEXT DEFAULT 'judoca'`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE members ADD COLUMN is_board_member INTEGER DEFAULT 0`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE members ADD COLUMN board_position TEXT`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE members ADD COLUMN rut TEXT UNIQUE`);
} catch (e) { /* Column may already exist */ }

module.exports = db;
