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
  const dbPath = path.resolve(__dirname, '../brainova.db');
  sqliteDb = new sqlite3.Database(dbPath);
  console.log(`[DB] Using SQLite Embedded adapter (${dbPath})`);
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

  // Check if schools exist, otherwise seed
  const schoolCount = await get(`SELECT COUNT(*) as count FROM schools`);
  if (schoolCount.count === 0) {
    await seedInitialData();
  }
}

async function seedInitialData() {
  console.log('Seeding initial Brainova Olympiad multi-tenant records...');
  const salt = bcrypt.genSaltSync(10);
  const defaultPassword = bcrypt.hashSync('Brainova@2026', salt);

  // 1. Seed Schools (Tenants)
  const schools = [
    ['SCH-101', 'Delhi Public School, R.K. Puram', 'CBSE', 'Dr. Sandeep Sharma', 'principal@dpsrkp.net', '9811023456', defaultPassword, 'New Delhi', 'South West Delhi', 'Delhi', '110022'],
    ['SCH-102', 'St. Xavier Collegiate High School', 'ICSE', 'Father James Lobo', 'admin@stxaviers.edu.in', '9833012984', defaultPassword, 'Mumbai', 'Mumbai City', 'Maharashtra', '400001'],
    ['SCH-103', 'Kendriya Vidyalaya No. 1', 'CBSE', 'Meenakshi Sundaram', 'kv1.chennai@kvsedu.gov.in', '9444056781', defaultPassword, 'Chennai', 'Chennai', 'Tamil Nadu', '600036'],
    ['SCH-104', 'The Heritage Valley School', 'Cambridge', 'Ananya Deshmukh', 'heritage.valley@edu.org', '9712045612', defaultPassword, 'Bengaluru', 'Bengaluru Urban', 'Karnataka', '560068'],
    ['SCH-105', 'D.A.V. Centenary Public School', 'CBSE', 'Rajesh K. Verma', 'dav.rohini@davdelhi.in', '8587929298', defaultPassword, 'Delhi', 'North West Delhi', 'Delhi', '110085']
  ];

  for (const s of schools) {
    await run(`
      INSERT INTO schools (school_code, school_name, affiliation_board, contact_person, contact_email, contact_phone, password_hash, city, district, state, pincode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, s);
  }

  // 2. Seed Subjects
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

  // 3. Seed Students
  const students = [
    ['BNO-2026-001', 'Aarav Sharma', 'aarav.sharma@gmail.com', defaultPassword, '9810123451', '2012-05-14', 1, 'Class 8', 'Vikram Sharma', 'Sector 14, R.K. Puram', 'New Delhi', 'Delhi', '110022'],
    ['BNO-2026-002', 'Diya Patel', 'diya.patel@yahoo.com', defaultPassword, '9820234562', '2010-09-22', 2, 'Class 10', 'Bhavin Patel', 'Churchgate Avenue', 'Mumbai', 'Maharashtra', '400020'],
    ['BNO-2026-003', 'Karthik Subramanian', 'karthik.subra@gmail.com', defaultPassword, '9440345673', '2014-03-11', 3, 'Class 6', 'S. Subramanian', 'Gandhi Nagar, Adyar', 'Chennai', 'Tamil Nadu', '600020'],
    ['BNO-2026-004', 'Ananya Roy', 'ananya.roy@outlook.com', defaultPassword, '9710456784', '2011-11-08', 4, 'Class 9', 'Subhash Roy', 'Koramangala 4th Block', 'Bengaluru', 'Karnataka', '560034'],
    ['BNO-2026-005', 'Rohan Gupta', 'rohan.gupta@gmail.com', defaultPassword, '8580567895', '2013-07-19', 5, 'Class 7', 'Neeraj Gupta', 'Pocket C-13, Sector 3, Rohini', 'Delhi', 'Delhi', '110085'],
    ['BNO-2026-006', 'Meera Iyer', 'meera.iyer@gmail.com', defaultPassword, '9810678906', '2009-02-04', 1, 'Class 11', 'Raghavan Iyer', 'Vasant Kunj Sector B', 'New Delhi', 'Delhi', '110070'],
    ['BNO-2026-007', 'Kabir Sen', 'kabir.sen@gmail.com', defaultPassword, '9820789017', '2015-08-30', 2, 'Class 5', 'Debashis Sen', 'Bandra West, Hill Road', 'Mumbai', 'Maharashtra', '400050'],
    ['BNO-2026-008', 'Sneha Reddy', 'sneha.reddy@gmail.com', defaultPassword, '9440890128', '2012-12-15', 3, 'Class 8', 'K. V. Reddy', 'Anna Nagar West', 'Chennai', 'Tamil Nadu', '600040']
  ];

  for (const stu of students) {
    await run(`
      INSERT INTO students (roll_number, full_name, email, password_hash, phone, dob, school_id, grade_class, parent_name, address, city, state, pincode, last_login)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 hours'))
    `, stu);
  }

  // 4. Seed Questions (Maths, English, GK, Science, Computer)
  const questions = [
    // Maths (subject_id 1)
    [1, 'All', 'If the sum of three consecutive odd numbers is 57, what is the value of the largest number?', '17', '19', '21', '23', 'C', 'Let numbers be x, x+2, x+4. 3x + 6 = 57 => 3x = 51 => x = 17. Largest is 17+4=21.'],
    [1, 'All', 'What is the perimeter of a rectangle whose area is 96 cm² and length is 12 cm?', '36 cm', '40 cm', '44 cm', '20 cm', 'B', 'Breadth = 96/12 = 8 cm. Perimeter = 2 * (12 + 8) = 40 cm.'],
    [1, 'All', 'A train travels at 72 km/h. How many meters does it cover in 25 seconds?', '400 m', '450 m', '500 m', '550 m', 'C', '72 km/h = 72 * (5/18) = 20 m/s. Distance = 20 * 25 = 500 meters.'],
    [1, 'All', 'If 15 workers can build a wall in 48 hours, how many workers will be required to do the same work in 30 hours?', '20', '22', '24', '28', 'C', '15 * 48 = W * 30 => W = 720 / 30 = 24 workers.'],
    [1, 'All', 'Solve for x: 3^(2x - 1) = 81.', '2', '2.5', '3', '3.5', 'B', '81 = 3^4. So 2x - 1 = 4 => 2x = 5 => x = 2.5.'],

    // English (subject_id 2)
    [2, 'All', 'Choose the correct synonym for the word "METICULOUS":', 'Careless', 'Diligent and thorough', 'Hesitant', 'Arrogant', 'B', 'Meticulous means showing great attention to detail; very careful and precise.'],
    [2, 'All', 'Identify the correct passive voice: "The students completed the complex project yesterday."', 'The complex project was completed by the students yesterday.', 'The complex project had been completed yesterday.', 'The complex project has completed by students.', 'Yesterday the complex project was completing.', 'A', 'Simple past active converts to was/were + past participle.'],
    [2, 'All', 'Choose the word correctly spelled:', 'Accomodation', 'Accommodation', 'Acommodation', 'Accomadation', 'B', 'Accommodation has double "c" and double "m".'],
    [2, 'All', 'Fill in the blank with appropriate preposition: "She has been proficient ___ mathematics since childhood."', 'on', 'with', 'in', 'at', 'C', 'The correct idiom is "proficient in" a discipline or subject.'],
    [2, 'All', 'Select the antonym for "CANDID":', 'Frank', 'Deceitful / Secretive', 'Blunt', 'Honest', 'B', 'Candid means truthful and straightforward; its opposite is deceptive/secretive.'],

    // GK (subject_id 3)
    [3, 'All', 'Which Indian satellite mission successfully achieved soft landing near the lunar south pole in 2023?', 'Mangalyaan-2', 'Chandrayaan-3', 'Aditya-L1', 'Gaganyaan-1', 'B', 'Chandrayaan-3 achieved historical soft-landing on 23 August 2023.'],
    [3, 'All', 'Who is widely recognized as the father of the Indian Constitution?', 'Mahatma Gandhi', 'Dr. B.R. Ambedkar', 'Jawaharlal Nehru', 'Sardar Vallabhbhai Patel', 'B', 'Dr. Bhimrao Ramji Ambedkar chaired the Drafting Committee.'],
    [3, 'All', 'Which river is the longest in peninsular India, often called the "Dakshin Ganga"?', 'Krishna', 'Mahanadi', 'Godavari', 'Cauvery', 'C', 'Godavari is the second longest river in India and largest in peninsular India.'],
    [3, 'All', 'What is the currency of Japan?', 'Yuan', 'Won', 'Yen', 'Ringgit', 'C', 'The official currency of Japan is the Japanese Yen (JPY).'],
    [3, 'All', 'Which organelle is universally referred to as the powerhouse of the eukaryotic cell?', 'Ribosome', 'Mitochondria', 'Golgi Apparatus', 'Lysosome', 'B', 'Mitochondria produce ATP through cellular respiration.'],

    // Science (subject_id 4)
    [4, 'All', 'What is the chemical formula for ordinary table salt?', 'NaCl', 'KCl', 'CaCO3', 'Na2SO4', 'A', 'Common table salt is composed of sodium and chlorine (NaCl).'],
    [4, 'All', 'Which vital gas is produced by plants during oxygenic photosynthesis?', 'Carbon Dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen', 'B', 'Plants release oxygen (O2) as a byproduct of splitting water in photosynthesis.'],
    [4, 'All', 'What is the SI unit of electric current?', 'Volt', 'Ohm', 'Ampere', 'Watt', 'C', 'The SI base unit of electric current is the Ampere (A).'],
    [4, 'All', 'Which planet in our solar system is famously known as the "Red Planet"?', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'B', 'Mars appears red due to extensive iron oxide (rust) on its surface.'],
    [4, 'All', 'What is the approximate speed of light in a vacuum?', '300,000 km/s', '150,000 km/s', '30,000 km/s', '3,000,000 km/s', 'A', 'The speed of light in vacuum is approximately 299,792 km/s (3 x 10^8 m/s).'],

    // Computer / Cyber (subject_id 5)
    [5, 'All', 'What does the abbreviation CPU stand for in computer hardware?', 'Central Process Unit', 'Central Processing Unit', 'Computer Power Unit', 'Core Programming Unit', 'B', 'CPU stands for Central Processing Unit.'],
    [5, 'All', 'Which network protocol encrypts data transmission for secure web browsing?', 'HTTP', 'FTP', 'HTTPS', 'SMTP', 'C', 'HTTPS (Hypertext Transfer Protocol Secure) encrypts web traffic using TLS/SSL.'],
    [5, 'All', 'Which data structure operates on a Last-In, First-Out (LIFO) order?', 'Queue', 'Stack', 'Array', 'Linked List', 'B', 'A Stack operates strictly on a Last-In, First-Out (LIFO) basis.'],
    [5, 'All', 'What binary value corresponds to the decimal number 10?', '1001', '1010', '1100', '1110', 'B', 'Decimal 10 in 8-4-2-1 binary code is 1010 (8 + 2).'],
    [5, 'All', 'What does RAM stand for in computer systems?', 'Random Access Memory', 'Read Access Memory', 'Rapid Action Memory', 'Remote Available Memory', 'A', 'RAM stands for Random Access Memory, the primary volatile working memory.']
  ];

  for (const q of questions) {
    await run(`
      INSERT INTO exam_questions (subject_id, class_group, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, q);
  }

  // 5. Seed Exam Attempts (for Multi-Tenant Score Ledger)
  const attempts = [
    [1, 1, 1, 15, 15, 14, 1, 56, 60, 93.33, 1120, 'completed'], // Aarav - Maths
    [1, 1, 2, 15, 15, 13, 2, 52, 60, 86.67, 980, 'completed'],  // Aarav - English
    [1, 1, 3, 15, 15, 15, 0, 60, 60, 100.0, 750, 'completed'],  // Aarav - GK
    [2, 2, 1, 15, 15, 15, 0, 60, 60, 100.0, 1040, 'completed'], // Diya - Maths
    [2, 2, 2, 15, 14, 12, 2, 48, 60, 80.00, 1100, 'completed'], // Diya - English
    [3, 3, 1, 15, 14, 11, 3, 44, 60, 73.33, 1280, 'completed'], // Karthik - Maths
    [3, 3, 3, 15, 15, 13, 2, 52, 60, 86.67, 890, 'completed'],  // Karthik - GK
    [4, 4, 2, 15, 15, 15, 0, 60, 60, 100.0, 820, 'completed'],  // Ananya - English
    [4, 4, 3, 15, 14, 12, 2, 48, 60, 80.00, 910, 'completed'],  // Ananya - GK
    [5, 5, 1, 15, 15, 13, 2, 52, 60, 86.67, 1150, 'completed'], // Rohan - Maths
    [5, 5, 2, 15, 15, 14, 1, 56, 60, 93.33, 940, 'completed'],  // Rohan - English
    [6, 1, 1, 15, 15, 15, 0, 60, 60, 100.0, 960, 'completed']   // Meera - Maths
  ];

  for (const att of attempts) {
    await run(`
      INSERT INTO exam_attempts (student_id, school_id, subject_id, total_questions, answered_count, correct_count, wrong_count, score, max_score, percentage, time_taken_seconds, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, att);
  }

  console.log('Seeding completed successfully!');
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

