const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_CLIENT = (process.env.DB_CLIENT || 'sqlite').toLowerCase();

let sqliteDb = null;
let mysqlPool = null;
let pgPool = null;

// Initialize adapter based on DB_CLIENT
if (DB_CLIENT === 'mysql') {
  const mysql = require('mysql2/promise');
  mysqlPool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'brainova_olympiad',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    multipleStatements: true
  });
  console.log(`[DB] Using MySQL / MariaDB adapter (${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT || 3306}/${process.env.MYSQL_DATABASE})`);
} else if (DB_CLIENT === 'postgres') {
  const { Pool } = require('pg');
  pgPool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'brainova_olympiad',
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  console.log(`[DB] Using PostgreSQL adapter (${process.env.PG_HOST}:${process.env.PG_PORT || 5432}/${process.env.PG_DATABASE})`);
} else {
  try {
    const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const dbPath = isVercel ? ':memory:' : path.resolve(__dirname, '../brainova.db');
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.warn('[DB] SQLite open notice:', err.message);
        sqliteDb = new sqlite3.Database(':memory:');
      }
    });
    console.log(`[DB] Using SQLite Embedded adapter (${dbPath})`);
  } catch (err) {
    console.warn('[DB] SQLite initialization bypassed:', err.message);
  }
}


// Dialect SQL normalizer for cross-database compatibility
function normalizeSql(sql, dialect) {
  if (dialect === 'mysql') {
    return sql
      .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT IGNORE INTO')
      .replace(/datetime\('now',\s*'-(\d+)\s+days?'\)/gi, 'DATE_SUB(NOW(), INTERVAL $1 DAY)')
      .replace(/datetime\('now',\s*'-(\d+)\s+hours?'\)/gi, 'DATE_SUB(NOW(), INTERVAL $1 HOUR)')
      .replace(/datetime\('now'\)/gi, 'NOW()');
  }
  if (dialect === 'postgres') {
    let s = sql
      .replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi, 'INSERT INTO $1 ($2) VALUES ($3) ON CONFLICT DO NOTHING')
      .replace(/datetime\('now',\s*'-(\d+)\s+days?'\)/gi, "NOW() - INTERVAL '$1 days'")
      .replace(/datetime\('now',\s*'-(\d+)\s+hours?'\)/gi, "NOW() - INTERVAL '$1 hours'")
      .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
    let idx = 1;
    s = s.replace(/\?/g, () => `$${idx++}`);
    return s;
  }
  return sql;
}

// Promisified wrappers
async function run(sql, params = []) {
  if (DB_CLIENT === 'mysql') {
    const querySql = normalizeSql(sql, 'mysql');
    const [result] = await mysqlPool.query(querySql, params);
    return { lastID: result.insertId, changes: result.affectedRows };
  }
  if (DB_CLIENT === 'postgres') {
    const querySql = normalizeSql(sql, 'postgres');
    const result = await pgPool.query(querySql, params);
    return { lastID: result.rows[0]?.id || null, changes: result.rowCount };
  }
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function get(sql, params = []) {
  if (DB_CLIENT === 'mysql') {
    const querySql = normalizeSql(sql, 'mysql');
    const [rows] = await mysqlPool.query(querySql, params);
    return rows && rows.length > 0 ? rows[0] : undefined;
  }
  if (DB_CLIENT === 'postgres') {
    const querySql = normalizeSql(sql, 'postgres');
    const result = await pgPool.query(querySql, params);
    return result.rows && result.rows.length > 0 ? result.rows[0] : undefined;
  }
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function all(sql, params = []) {
  if (DB_CLIENT === 'mysql') {
    const querySql = normalizeSql(sql, 'mysql');
    const [rows] = await mysqlPool.query(querySql, params);
    return rows || [];
  }
  if (DB_CLIENT === 'postgres') {
    const querySql = normalizeSql(sql, 'postgres');
    const result = await pgPool.query(querySql, params);
    return result.rows || [];
  }
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Database Initialization and Seeding
async function initDatabase() {
  if (DB_CLIENT === 'mysql') {
    try {
      console.log('[DB:MySQL] Testing connection to MySQL server...');
      await mysqlPool.query('SELECT 1');
      console.log('[DB:MySQL] Connected successfully.');

      // Check if schema exists, if not execute schema.sql
      const [tableRows] = await mysqlPool.query("SHOW TABLES LIKE 'schools'");
      if (!tableRows || tableRows.length === 0) {
        console.log('[DB:MySQL] Tables not detected. Applying db/schema.sql...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
          const schemaSql = fs.readFileSync(schemaPath, 'utf8');
          await mysqlPool.query(schemaSql);
          console.log('[DB:MySQL] Schema applied successfully.');
        }
      }

      // Check if seeded
      const schoolCount = await get('SELECT COUNT(*) as count FROM schools');
      if (!schoolCount || Number(schoolCount.count) === 0) {
        await seedInitialData();
      }
      return;
    } catch (err) {
      console.error('[DB:MySQL ERROR] Failed to initialize MySQL database:', err.message);
      console.error('[DB:MySQL ERROR] Please verify your MYSQL_* settings in .env or run db/schema.sql in phpMyAdmin/MySQL.');
      throw err;
    }
  }

  if (DB_CLIENT === 'postgres') {
    try {
      console.log('[DB:Postgres] Testing connection to PostgreSQL...');
      await pgPool.query('SELECT 1');
      console.log('[DB:Postgres] Connected successfully.');
      return;
    } catch (err) {
      console.error('[DB:Postgres ERROR] Failed to initialize PostgreSQL database:', err.message);
      throw err;
    }
  }

  try {
  // Create Schools table
  await run(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_code TEXT UNIQUE NOT NULL,
      school_name TEXT NOT NULL,
      affiliation_board TEXT DEFAULT 'CBSE',
      contact_person TEXT NOT NULL,
      contact_email TEXT UNIQUE NOT NULL,
      contact_phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      city TEXT NOT NULL,
      district TEXT,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Students table
  await run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roll_number TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT NOT NULL,
      dob TEXT,
      school_id INTEGER,
      grade_class TEXT NOT NULL,
      parent_name TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      status TEXT DEFAULT 'active',
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id)
    )
  `);

  // Create Subjects table
  await run(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      duration_minutes INTEGER DEFAULT 30,
      total_questions INTEGER DEFAULT 15,
      marks_per_question INTEGER DEFAULT 4,
      negative_marks REAL DEFAULT 0.0,
      icon_class TEXT DEFAULT 'fa-book',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Exam Questions table
  await run(`
    CREATE TABLE IF NOT EXISTS exam_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      class_group TEXT DEFAULT 'All',
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option TEXT NOT NULL,
      explanation TEXT,
      difficulty TEXT DEFAULT 'medium',
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    )
  `);

  // Create Exam Attempts table
  await run(`
    CREATE TABLE IF NOT EXISTS exam_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      school_id INTEGER,
      subject_id INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      answered_count INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      wrong_count INTEGER DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      max_score INTEGER NOT NULL DEFAULT 60,
      percentage REAL NOT NULL DEFAULT 0.0,
      time_taken_seconds INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    )
  `);

  // Create Contact Inquiries table
  await run(`
    CREATE TABLE IF NOT EXISTS contact_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      inquiry_type TEXT DEFAULT 'quote_request',
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Newsletters table
  await run(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Check if subjects exist, otherwise seed subjects and questions
  const subjectCount = await get(`SELECT COUNT(*) as count FROM subjects`);
  if (!subjectCount || Number(subjectCount.count) === 0) {
    await seedInitialData();
  }
  } catch (err) {
    console.warn('[DB] SQLite table setup notice:', err.message);
  }
}

async function seedInitialData() {
  console.log('Seeding core Olympiad subjects and question bank...');

  // 1. Seed Core Subjects
  const subjects = [
    ['math-olympiad', 'Mathematics Olympiad', 'Logical reasoning, algebraic expressions, geometric principles, and problem solving.', 30, 15, 4, 0.0, 'fa-calculator'],
    ['english-olympiad', 'English Olympiad', 'Grammar mastery, comprehension, advanced vocabulary, syntax, and literary verbal ability.', 30, 15, 4, 0.0, 'fa-spell-check'],
    ['gk-olympiad', 'General Knowledge Olympiad', 'National & international affairs, science innovations, history, geography, and general awareness.', 25, 15, 4, 0.0, 'fa-globe'],
    ['science-olympiad', 'Science Olympiad', 'Physics principles, chemistry in everyday life, life sciences, and scientific inquiry.', 30, 15, 4, 0.0, 'fa-flask'],
    ['computer-olympiad', 'Cyber & Computer Olympiad', 'Algorithms, digital citizenship, computing logic, networking, and programming fundamentals.', 30, 15, 4, 0.0, 'fa-laptop-code']
  ];

  for (const sub of subjects) {
    await run(`
      INSERT INTO subjects (slug, title, description, duration_minutes, total_questions, marks_per_question, negative_marks, icon_class)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, sub);
  }

  // 3. Students & Exam Attempts are NOT seeded in production (starts with 0 registrations)
  console.log('Production database initialized with 0 student registrations.');
}

const db = {
  run,
  get,
  all,
  initDatabase,
  get client() {
    return sqliteDb || mysqlPool || pgPool;
  }
};

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase
};

