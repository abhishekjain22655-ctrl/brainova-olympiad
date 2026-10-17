require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDatabase } = require('./db/database');

const authRoutes = require('./routes/authRoutes');
const examRoutes = require('./routes/examRoutes');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Brainova National Olympiad Portal',
    version: '1.0.0',
    database: process.env.DB_CLIENT || 'sqlite-embedded'
  });
});

// Form POST endpoints matching original site form actions
app.post('/student-registration-submit.html', async (req, res) => {
  try {
    const {
      student_name, dob, student_email, student_phone, parent_name,
      student_school_id, student_school, student_class, address, city, district, state, pincode
    } = req.body;
    
    // Redirect to auth API or process directly
    const authRoutes = require('./routes/authRoutes');
    const db = require('./db/database');
    const bcrypt = require('bcryptjs');

    const countRow = await db.get('SELECT COUNT(*) as count FROM students');
    const rollNumber = `BNO-2026-${String(countRow.count + 1).padStart(4, '0')}`;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Brainova@2026', salt);

    await db.run(`
      INSERT INTO students (
        roll_number, full_name, email, password_hash, phone, dob,
        school_id, grade_class, parent_name, address, city, state, pincode, status, last_login
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
    `, [
      rollNumber, student_name || 'Registered Student', (student_email || '').toLowerCase() || `${rollNumber}@brainova.com`,
      hash, student_phone || '9999999999', dob || null,
      parseInt(student_school_id) || 1, student_class || 'Class 10',
      parent_name || '', address || '', city || '', state || '', pincode || ''
    ]);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Registration Complete</title>
        <link rel="stylesheet" href="/public/assets/css/vendor/bootstrap.min.css">
        <link rel="stylesheet" href="/public/assets/css/app.css">
      </head>
      <body style="background:#19124d; color:#fff; display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:sans-serif; text-align:center;">
        <div style="background:#ffffff; color:#19124d; padding:40px; border-radius:16px; max-width:500px; box-shadow:0 15px 35px rgba(0,0,0,0.3);">
          <h2 style="color:#10b981; font-weight:bold; margin-bottom:15px;">Registration Successful!</h2>
          <p style="color:#64748b;">Welcome <strong>${student_name || 'Candidate'}</strong> to Brainova National Olympiad 2026.</p>
          <div style="background:#f1f5f9; padding:15px; border-radius:10px; font-size:22px; font-weight:bold; color:#f16032; margin:20px 0;">
            Roll Number: ${rollNumber}
          </div>
          <div style="display:flex; gap:10px; justify-content:center;">
            <a href="/admin" class="btn" style="background:#19124d; color:#fff; padding:10px 20px; border-radius:8px;">View in Admin Ledger</a>
            <a href="/exam.html" class="btn" style="background:#f16032; color:#fff; padding:10px 20px; border-radius:8px;">Take Mock Exam</a>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Student registration error:', err);
    res.status(500).send('Registration processing failed.');
  }
});

app.post('/school-registration-submit.html', async (req, res) => {
  try {
    const { school_name, affiliation_board, contact_name, contact_email, contact_phone_number, city, state, pincode } = req.body;
    const db = require('./db/database');
    const bcrypt = require('bcryptjs');

    const countRow = await db.get('SELECT COUNT(*) as count FROM schools');
    const schoolCode = `SCH-${String(countRow.count + 101)}`;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('School@2026', salt);

    await db.run(`
      INSERT INTO schools (
        school_code, school_name, affiliation_board, contact_person,
        contact_email, contact_phone, password_hash, city, district, state, pincode, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [
      schoolCode, school_name || 'Partner School', affiliation_board || 'CBSE',
      contact_name || 'Principal', (contact_email || '').toLowerCase() || `${schoolCode}@school.edu`,
      contact_phone_number || '8587929298', hash, city || '', '', state || '', pincode || ''
    ]);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>School Registered</title>
        <link rel="stylesheet" href="/public/assets/css/vendor/bootstrap.min.css">
      </head>
      <body style="background:#19124d; color:#fff; display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:sans-serif; text-align:center;">
        <div style="background:#ffffff; color:#19124d; padding:40px; border-radius:16px; max-width:500px; box-shadow:0 15px 35px rgba(0,0,0,0.3);">
          <h2 style="color:#10b981; font-weight:bold; margin-bottom:15px;">Institution Registered!</h2>
          <p style="color:#64748b;"><strong>${school_name || 'School'}</strong> has been registered as an examination tenant center.</p>
          <div style="background:#f1f5f9; padding:15px; border-radius:10px; font-size:22px; font-weight:bold; color:#f16032; margin:20px 0;">
            School Code: ${schoolCode}
          </div>
          <a href="/admin" class="btn" style="background:#19124d; color:#fff; padding:10px 20px; border-radius:8px;">Open Master Admin</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('School registration failed.');
  }
});

app.post('/contact-submit.html', async (req, res) => {
  try {
    const { name, phone_number, email, message } = req.body;
    const db = require('./db/database');
    await db.run('INSERT INTO contact_inquiries (full_name, phone_number, email, message) VALUES (?, ?, ?, ?)', [
      name || 'Anonymous', phone_number || '', email || '', message || ''
    ]);
    res.send(`<script>alert('Thank you! Your inquiry has been received. Our team will contact you shortly.'); window.location.href='/';</script>`);
  } catch (err) {
    res.redirect('/');
  }
});

app.post('/newsletters.html', async (req, res) => {
  try {
    const { newsletter } = req.body;
    const db = require('./db/database');
    if (newsletter) {
      await db.run('INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)', [newsletter.trim().toLowerCase()]);
    }
    res.send(`<script>alert('Thank you for subscribing to Brainova National Olympiad newsletter!'); window.location.href='/';</script>`);
  } catch (err) {
    res.redirect('/');
  }
});

app.post('/user/login.html', async (req, res) => {
  try {
    const { username, password } = req.body;
    // Default admin credentials redirect to admin
    if ((username || '').toLowerCase() === 'admin@brainova.com' || username === 'admin') {
      return res.redirect('/admin');
    }
    res.redirect('/olympiads.html');
  } catch (err) {
    res.redirect('/login.html');
  }
});

// HTML page routes matching the original site structure
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/olympiads.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'olympiads.html')));
app.get('/science-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'science-olympiad.html')));
app.get('/math-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'math-olympiad.html')));
app.get('/english-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'english-olympiad.html')));
app.get('/gk-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'gk-olympiad.html')));
app.get('/computer-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'computer-olympiad.html')));
app.get('/olympiads-details.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'olympiads-details.html')));
app.get('/olympaid-fee-structure.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'olympaid-fee-structure.html')));
app.get('/olympiad-schedule.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'olympiad-schedule.html')));
app.get('/olympiad-exam-pattern.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'olympiad-exam-pattern.html')));
app.get('/olympiad-ranking.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'olympiad-ranking.html')));
app.get('/about-us.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'about-us.html')));
app.get('/contact-us.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'contact-us.html')));
app.get('/exam.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'exam.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// Catch-all fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Brainova National Olympiad Platform is LIVE!`);
    console.log(` Local Server:   http://localhost:${PORT}`);
    console.log(` Admin Portal:   http://localhost:${PORT}/admin`);
    console.log(` Subject Portal: http://localhost:${PORT}/olympiads.html`);
    console.log(` Online Exam:    http://localhost:${PORT}/exam.html`);
    console.log(` Registration:   http://localhost:${PORT}/register.html`);
    console.log(`=======================================================`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
