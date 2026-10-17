require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDatabase } = require('./db/database');

const authRoutes = require('./routes/authRoutes');
const examRoutes = require('./routes/examRoutes');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const emailService = require('./services/emailService');

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

const multer = require('multer');
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

// Form POST endpoints matching original site form actions
app.post('/student-registration-submit.html', upload.any(), async (req, res) => {
  try {
    const {
      student_name, dob, student_email, student_phone, parent_name,
      student_school_id, student_school, student_class, address, city, district, state, pincode
    } = req.body;
    
    const db = require('./db/database');
    const bcrypt = require('bcryptjs');

    const countRow = await db.get('SELECT COUNT(*) as count FROM students');
    const rollNumber = `BNO-2026-${String((countRow?.count || 0) + 1).padStart(4, '0')}`;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Brainova@2026', salt);

    await db.run(`
      INSERT INTO students (
        roll_number, full_name, email, password_hash, phone, dob,
        school_id, grade_class, parent_name, address, city, state, pincode, status, last_login
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
    `, [
      rollNumber, student_name || 'Registered Student', (student_email || '').toLowerCase() || `${rollNumber.toLowerCase()}@brainova.com`,
      hash, student_phone || '9999999999', dob || null,
      parseInt(student_school_id) || 1, student_class || 'Class 10',
      parent_name || '', address || '', city || '', state || '', pincode || ''
    ]);

    // Dispatch background email notifications to both Admin and Student
    try {
      const schoolRow = await db.get('SELECT school_name, school_code FROM schools WHERE id = ?', [parseInt(student_school_id) || 1]);
      emailService.sendStudentRegistrationEmails({
        student: {
          roll_number: rollNumber,
          full_name: student_name || 'Registered Student',
          email: student_email,
          phone: student_phone,
          grade_class: student_class || 'Class 10',
          city: city,
          state: state
        },
        school: schoolRow
      });
    } catch (e) {
      console.error('Email dispatch trigger error:', e);
    }

    // If client requested JSON (e.g. jQuery AJAX in front.js)
    if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({
        success: true,
        message: 'Registration Successful!',
        rollNumber: rollNumber,
        link: '/admin'
      });
    }

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
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(500).json({ success: false, message: 'Registration processing failed.' });
    }
    res.status(500).send('Registration processing failed.');
  }
});

app.post('/school-registration-submit.html', upload.any(), async (req, res) => {
  try {
    const { school_name, affiliation_board, board, contact_name, contact_email, email, contact_phone_number, phone_number, city, state, pincode } = req.body;
    const db = require('./db/database');
    const bcrypt = require('bcryptjs');

    const countRow = await db.get('SELECT COUNT(*) as count FROM schools');
    const schoolCode = `SCH-${String((countRow?.count || 0) + 101)}`;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('School@2026', salt);

    const sEmail = (contact_email || email || '').toLowerCase() || `${schoolCode.toLowerCase()}@school.edu`;
    const sPhone = contact_phone_number || phone_number || '8587929298';
    const sBoard = affiliation_board || board || 'CBSE';

    await db.run(`
      INSERT INTO schools (
        school_code, school_name, affiliation_board, contact_person,
        contact_email, contact_phone, password_hash, city, district, state, pincode, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [
      schoolCode, school_name || 'Partner School', sBoard,
      contact_name || 'Principal', sEmail,
      sPhone, hash, city || '', '', state || '', pincode || ''
    ]);

    // Dispatch background email notifications to both Admin and School
    try {
      emailService.sendSchoolRegistrationEmails({
        school: {
          school_code: schoolCode,
          school_name: school_name || 'Partner School',
          affiliation_board: sBoard,
          contact_person: contact_name || 'Principal',
          contact_email: sEmail,
          contact_phone: sPhone,
          city: city,
          state: state
        }
      });
    } catch (e) {
      console.error('School email dispatch trigger error:', e);
    }

    if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({
        success: true,
        message: 'School Registered Successfully!',
        schoolCode: schoolCode,
        link: '/admin'
      });
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>School Registered</title>
        <link rel="stylesheet" href="/public/assets/css/vendor/bootstrap.min.css">
      </head>
      <body style="background:#19124d; color:#fff; display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:sans-serif; text-align:center;">
        <div style="background:#ffffff; color:#19124d; padding:40px; border-radius:16px; max-width:500px; box-shadow:0 15px 35px rgba(0,0,0,0.3);">
          <h2 style="color:#10b981; font-weight:bold; margin-bottom:15px;">School Registered Successfully!</h2>
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
    console.error('School registration error:', err);
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(500).json({ success: false, message: 'School registration failed.' });
    }
    res.status(500).send('School registration failed.');
  }
});

app.post('/school/search-school.html', async (req, res) => {
  try {
    const search = req.body.search || '';
    const db = require('./db/database');
    const schools = await db.all(`
      SELECT id, school_name, school_code 
      FROM schools 
      WHERE school_name LIKE ? OR school_code LIKE ?
      LIMIT 10
    `, [`%${search}%`, `%${search}%`]);

    const formatted = schools.map(s => ({
      id: s.id,
      school_name: s.school_name,
      school_code: s.school_code,
      school_logo: null
    }));

    res.json(formatted);
  } catch (err) {
    res.json([]);
  }
});

app.post('/contact-submit.html', upload.any(), async (req, res) => {
  try {
    const { name, first_name, last_name, phone_number, phone, email, message } = req.body;
    const db = require('./db/database');
    const senderName = name || (first_name ? `${first_name} ${last_name || ''}`.trim() : 'Anonymous Inquirer');
    const senderPhone = phone_number || phone || '';
    const senderEmail = email || '';
    const senderMsg = message || '';

    await db.run('INSERT INTO contact_inquiries (full_name, phone_number, email, message) VALUES (?, ?, ?, ?)', [
      senderName, senderPhone, senderEmail, senderMsg
    ]);

    // Dispatch background email notification to Admin
    try {
      emailService.sendContactInquiryEmails({
        inquiry: {
          full_name: senderName,
          phone_number: senderPhone,
          email: senderEmail,
          message: senderMsg
        }
      });
    } catch (e) {
      console.error('Inquiry email dispatch error:', e);
    }

    if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({
        success: true,
        message: 'Your inquiry has been received. Our team will contact you shortly.'
      });
    }

    res.send(`<script>alert('Thank you! Your inquiry has been received. Our team will contact you shortly.'); window.location.href='/';</script>`);
  } catch (err) {
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(500).json({ success: false, message: 'Failed to record inquiry.' });
    }
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
    const { username, password, login_type } = req.body;
    const db = require('./db/database');
    const bcrypt = require('bcryptjs');

    const ident = (username || '').trim().toLowerCase();

    // Check Master Admin
    if (ident === 'admin@brainova.com' || ident === 'admin') {
      return res.redirect('/admin');
    }

    if (login_type === 'school') {
      const school = await db.get(`
        SELECT * FROM schools WHERE LOWER(contact_email) = ? OR LOWER(school_code) = ?
      `, [ident, ident]);

      if (school) {
        return res.redirect('/admin');
      }
    } else {
      const student = await db.get(`
        SELECT * FROM students WHERE LOWER(email) = ? OR LOWER(roll_number) = ?
      `, [ident, ident]);

      if (student) {
        await db.run("UPDATE students SET last_login = datetime('now') WHERE id = ?", [student.id]);
        return res.redirect('/olympiads.html');
      }
    }

    // Default fallback to olympiads on demo login
    res.redirect('/olympiads.html');
  } catch (err) {
    res.redirect('/login.html');
  }
});

app.post('/user/forgot_password.html', (req, res) => {
  const { email } = req.body;
  res.send(`<script>alert('Password reset instructions have been sent to ${email || 'your email'}. Please check your inbox.'); window.location.href='/login.html';</script>`);
});

// HTML page routes matching the original site structure
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/olympiads.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'olympiads.html')));

// General Olympiad Subject Overview Pages (from header menu)
app.get('/math-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'math-olympiad.html')));
app.get('/science-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'science-olympiad.html')));
app.get('/english-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'english-olympiad.html')));
app.get('/gk-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'gk-olympiad.html')));
app.get('/computer-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'computer-olympiad.html')));

// Authentic Dedicated Exam & Quiz Detail Pages (from card carousel)
app.get(['/exam/nationl-maths-olympiad.html', '/exam/national-maths-olympiad.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'exam', 'nationl-maths-olympiad.html'));
});

app.get('/exam/national-science-olympiad.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'exam', 'national-science-olympiad.html'));
});

app.get('/exam/national-english-olympiad.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'exam', 'national-english-olympiad.html'));
});

app.get(['/exam/national-general-knowledge-olympiad-new.html', '/exam/national-general-knowledge-olympiad.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'exam', 'national-general-knowledge-olympiad-new.html'));
});

app.get(['/exam/national-cyber-olympiad.html', '/exam/national-computer-olympiad.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'computer-olympiad.html'));
});

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
app.get('/gallery.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'gallery.html')));
app.get('/blog.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'blog.html')));
app.get('/blog/why-every-student-should-participate-in-national-olympiad-exams.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'blog', 'why-every-student-should-participate-in-national-olympiad-exams.html'));
});
app.get('/blog/brainova-national-olympiad-2026.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'blog', 'brainova-national-olympiad-2026.html'));
});
app.get('/privacy-policy.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'privacy-policy.html')));
app.get('/terms-and-conditions.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'terms-and-conditions.html')));
app.get('/courses.html', (req, res) => res.redirect('/olympiads.html'));
app.get(['/teachers.html', '/teachers'], (req, res) => res.redirect('/about-us.html#team'));
app.post('/blog/comment/store', (req, res) => {
  res.send('<script>alert("Thank you! Your comment has been submitted successfully."); history.back();</script>');
});
app.post('/contact-submit.html', upload.any(), async (req, res) => {
  try {
    const { name, full_name, email, phone, phone_number, message } = req.body;
    const db = require('./db/database');
    const senderName = name || full_name || 'Visitor';
    const senderEmail = (email || '').toLowerCase() || 'visitor@example.com';
    const senderPhone = phone || phone_number || '';
    const msg = message || 'Inquiry submitted from website';

    await db.run(`
      INSERT INTO contact_inquiries (full_name, phone_number, email, message, status)
      VALUES (?, ?, ?, ?, 'new')
    `, [senderName, senderPhone, senderEmail, msg]);

    if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({
        success: true,
        message: 'Your inquiry has been submitted successfully! Our team will contact you shortly.'
      });
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Inquiry Received</title><link rel="stylesheet" href="/public/assets/css/vendor/bootstrap.min.css"></head>
      <body style="background:#19124d; color:#fff; display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:sans-serif; text-align:center;">
        <div style="background:#ffffff; color:#19124d; padding:40px; border-radius:16px; max-width:500px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
          <h2 style="color:#10b981; font-weight:bold; margin-bottom:15px;">Inquiry Received!</h2>
          <p style="color:#64748b;">Thank you <strong>${senderName}</strong>. Our team will get back to you shortly.</p>
          <a href="/" class="btn" style="background:#19124d; color:#fff; padding:10px 20px; border-radius:8px;">Back to Home</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Contact submission error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit inquiry.' });
  }
});

// Admin Protection Middleware
function checkAdminAuth(req, res, next) {
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'brainova_master_jwt_secret_2026';
  
  let token = null;
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/brainova_admin_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token && req.headers['authorization']) {
    token = req.headers['authorization'].replace('Bearer ', '');
  }

  if (!token) {
    return res.redirect('/admin-login.html');
  }

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.redirect('/admin-login.html');
  }
}

app.get('/admin-login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('/admin', checkAdminAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin.html', checkAdminAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

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
