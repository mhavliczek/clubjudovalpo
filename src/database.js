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
    exam_date TEXT,
    score REAL,
    status TEXT DEFAULT 'pending',
    status_date TEXT,
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
  db.exec(`ALTER TABLE members ADD COLUMN member_type TEXT DEFAULT 'deportista'`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE members ADD COLUMN is_board_member INTEGER DEFAULT 0`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE members ADD COLUMN board_position TEXT`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE members ADD COLUMN rut TEXT`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_members_rut ON members(rut)`);
} catch (e) { /* Column may already exist */ }

// Add document type column (rut/passport)
try {
  db.exec(`ALTER TABLE members ADD COLUMN document_type TEXT DEFAULT 'rut'`);
} catch (e) { /* Column may already exist */ }

// Add new fields for judoka profile
try {
  db.exec(`ALTER TABLE members ADD COLUMN profession TEXT`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE members ADD COLUMN weight REAL`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE members ADD COLUMN medical_conditions TEXT`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE members ADD COLUMN is_guardian INTEGER DEFAULT 0`);
} catch (e) { /* Column may already exist */ }

// Add guardian_id for minors (reference to guardian member)
try {
  db.exec(`ALTER TABLE members ADD COLUMN guardian_id INTEGER`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_members_guardian ON members(guardian_id)`);
} catch (e) { /* Column may already exist */ }

// Add honorary member flag
try {
  db.exec(`ALTER TABLE members ADD COLUMN is_honorary INTEGER DEFAULT 0`);
} catch (e) { /* Column may already exist */ }

// Add exam fields to belt_grades
try {
  db.exec(`ALTER TABLE belt_grades ADD COLUMN exam_date TEXT`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE belt_grades ADD COLUMN score REAL`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE belt_grades ADD COLUMN status TEXT DEFAULT 'pending'`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE belt_grades ADD COLUMN status_date TEXT`);
} catch (e) { /* Column may already exist */ }
try {
  db.exec(`ALTER TABLE members ADD COLUMN association TEXT`);
} catch (e) { /* Column may already exist */ }

// Add student fields to members table
try { db.exec(`ALTER TABLE members ADD COLUMN condition TEXT DEFAULT 'profession'`); } catch (e) { }
try { db.exec(`ALTER TABLE members ADD COLUMN school_id INTEGER`); } catch (e) { }
try { db.exec(`ALTER TABLE members ADD COLUMN education_level TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE members ADD COLUMN grade_course TEXT`); } catch (e) { }

// Create guardian info table
db.exec(`
  CREATE TABLE IF NOT EXISTS guardian_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    rut TEXT NOT NULL,
    date_of_birth TEXT,
    profession TEXT,
    address TEXT,
    email TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  );
`);

// Create guardian relationships table (for managing multiple minors per guardian)
db.exec(`
  CREATE TABLE IF NOT EXISTS guardian_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guardian_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    start_date TEXT DEFAULT (date('now')),
    end_date TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guardian_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    UNIQUE(guardian_id, member_id)
  );
`);

// Add document type to guardian_info
try {
  db.exec(`ALTER TABLE guardian_info ADD COLUMN document_type TEXT DEFAULT 'rut'`);
} catch (e) { /* Column may already exist */ }

// Add photo field for QR profile
try {
  db.exec(`ALTER TABLE members ADD COLUMN photo TEXT`);
} catch (e) { /* Column may already exist */ }

// Create schools table (for students)
db.exec(`
  CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    school_type TEXT DEFAULT 'particular',
    commune TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Create annual fees table
db.exec(`
  CREATE TABLE IF NOT EXISTS annual_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL UNIQUE,
    enrollment_amount REAL DEFAULT 0,
    monthly_amount REAL DEFAULT 0,
    license_amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add student fields to members table
try { db.exec(`ALTER TABLE members ADD COLUMN condition TEXT DEFAULT 'profession'`); } catch (e) { }
try { db.exec(`ALTER TABLE members ADD COLUMN school_id INTEGER`); } catch (e) { }
try { db.exec(`ALTER TABLE members ADD COLUMN education_level TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE members ADD COLUMN grade_course TEXT`); } catch (e) { }

// Create member payment status overrides table
db.exec(`
  CREATE TABLE IF NOT EXISTS payment_status_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    UNIQUE(member_id, year)
  );
`);

// Create instructors table
db.exec(`
  CREATE TABLE IF NOT EXISTS instructors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rank TEXT,
    organization TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Create belt grade history table (for tracking grade dates)
db.exec(`
  CREATE TABLE IF NOT EXISTS belt_grade_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    belt_color TEXT NOT NULL,
    grade_date TEXT NOT NULL,
    instructor TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  );
`);

// Create settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create curriculum table (for tournaments)
db.exec(`
  CREATE TABLE IF NOT EXISTS curriculum (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    tournament_name TEXT NOT NULL,
    tournament_date TEXT NOT NULL,
    location TEXT,
    tournament_type TEXT DEFAULT 'abierto',
    category TEXT,
    weight TEXT,
    belt_grade TEXT,
    place_obtained TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  );
`);

// Create documents table (for statutes and administrative documents)
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    category TEXT NOT NULL DEFAULT 'estatuto',
    is_active INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );
`);

// Create tournament documents table (for tournament rules and bases)
db.exec(`
  CREATE TABLE IF NOT EXISTS tournament_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    tournament_name TEXT,
    tournament_date TEXT,
    category TEXT NOT NULL DEFAULT 'bases',
    is_active INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );
`);

// Migrate existing belt_grades to belt_grade_history
try {
  const existingGrades = db.prepare('SELECT * FROM belt_grades').all();
  if (existingGrades.length > 0) {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO belt_grade_history (member_id, belt_color, grade_date, instructor, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const grade of existingGrades) {
      insert.run(grade.member_id, grade.belt_color, grade.grade_date, grade.instructor, grade.notes);
    }
  }
} catch (e) { /* Migration may have already occurred */ }

module.exports = db;
