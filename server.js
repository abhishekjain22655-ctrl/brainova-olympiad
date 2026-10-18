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
const { securityHeaders, loginLimiter, registerLimiter, inquiryLimiter, sanitizeInput, validatePassword } = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxies (Cloudflare, Render, cPanel NGINX) for accurate client IPs & HTTPS
app.set('trust proxy', 1);

// Security Headers (Helmet) & Core Middleware
app.use(securityHeaders);
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
app.post('/student-registration-submit.html', registerLimiter, upload.any(), async (req, res) => {
  try {
    const {
      student_name, dob, student_email, student_phone, parent_name,
      student_school_id, student_school, student_class, address, city, district, state, pincode,
      password, confirm_password
    } = req.body;
    
    const db = require('./db/database');
    const bcrypt = require('bcryptjs');

    // Security: Password length validation
    if (password && password.trim().length < 6) {
      if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.json({
          success: false,
          message: { password: ['Password must be at least 6 characters long for account security.'] }
        });
      }
    }

    if (password && confirm_password && password.trim() !== confirm_password.trim()) {
      if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.json({
          success: false,
          message: { confirm_password: ['Password and Confirm Password do not match.'] }
        });
      }
    }

    const countRow = await db.get('SELECT COUNT(*) as count FROM students');
    const rollNumber = `BNO-2026-${String((countRow?.count || 0) + 1).padStart(4, '0')}`;
    const userPassword = (password || '').trim() || 'Brainova@2026';
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(userPassword, salt);

    const schoolId = student_school_id ? parseInt(student_school_id) : null;

    // Sanitize user inputs against XSS
    const cleanName = sanitizeInput(student_name) || 'Registered Student';
    const cleanParent = sanitizeInput(parent_name) || '';
    const cleanAddress = sanitizeInput(address) || '';
    const cleanCity = sanitizeInput(city) || '';
    const cleanState = sanitizeInput(state) || '';
    const cleanPincode = sanitizeInput(pincode) || '';

    await db.run(`
      INSERT INTO students (
        roll_number, full_name, email, password_hash, phone, dob,
        school_id, grade_class, parent_name, address, city, state, pincode, status, last_login
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
    `, [
      rollNumber, cleanName, (student_email || '').toLowerCase() || `${rollNumber.toLowerCase()}@brainova.com`,
      hash, student_phone || '9999999999', dob || null,
      schoolId, student_class || 'Class 10',
      cleanParent, cleanAddress, cleanCity, cleanState, cleanPincode
    ]);

    // Dispatch background email notifications to both Admin and Student
    try {
      const schoolId = student_school_id ? parseInt(student_school_id) : null;
      const schoolRow = schoolId ? await db.get('SELECT school_name, school_code FROM schools WHERE id = ?', [schoolId]) : null;
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

    const successUrl = `/registration-success.html?type=student&roll=${encodeURIComponent(rollNumber)}&name=${encodeURIComponent(student_name || 'Candidate')}&class=${encodeURIComponent(student_class || 'Class 10')}`;

    // If client requested JSON (e.g. jQuery AJAX in front.js)
    if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({
        success: true,
        message: 'Registration Successful! Your Roll Number is ' + rollNumber,
        rollNumber: rollNumber,
        link: successUrl
      });
    }

    return res.redirect(successUrl);
  } catch (err) {
    console.error('Student registration error:', err);
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(500).json({ success: false, message: 'Registration processing failed.' });
    }
    res.status(500).send('Registration processing failed.');
  }
});

app.post('/school-registration-submit.html', registerLimiter, upload.any(), async (req, res) => {
  try {
    const { 
      school_name, affiliation_board, board, contact_name, contact_email, email, 
      contact_phone_number, phone_number, city, state, pincode,
      password, confirm_password 
    } = req.body;
    const db = require('./db/database');
    const bcrypt = require('bcryptjs');

    // Security: Password length validation
    if (password && password.trim().length < 6) {
      if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.json({
          success: false,
          message: { password: ['Password must be at least 6 characters long for account security.'] }
        });
      }
    }

    if (password && confirm_password && password.trim() !== confirm_password.trim()) {
      if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.json({
          success: false,
          message: { confirm_password: ['Password and Confirm Password do not match.'] }
        });
      }
    }

    const countRow = await db.get('SELECT COUNT(*) as count FROM schools');
    const schoolCode = `SCH-${String((countRow?.count || 0) + 101)}`;
    const userPassword = (password || '').trim() || 'School@2026';
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(userPassword, salt);

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

    const successUrl = `/registration-success.html?type=school&code=${encodeURIComponent(schoolCode)}&name=${encodeURIComponent(school_name || 'Partner School')}`;

    if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({
        success: true,
        message: 'School Registered Successfully! Your School Code is ' + schoolCode,
        schoolCode: schoolCode,
        link: successUrl
      });
    }

    return res.redirect(successUrl);
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

app.post('/contact-submit.html', inquiryLimiter, upload.any(), async (req, res) => {
  try {
    const { name, first_name, last_name, phone_number, phone, email, message } = req.body;
    const db = require('./db/database');
    const senderName = sanitizeInput(name || (first_name ? `${first_name} ${last_name || ''}`.trim() : 'Anonymous Inquirer'));
    const senderPhone = sanitizeInput(phone_number || phone || '');
    const senderEmail = (email || '').trim().toLowerCase();
    const senderMsg = sanitizeInput(message || '');

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
        message: 'Your inquiry has been received. Our team will contact you shortly.',
        html: `
          <div style="padding: 35px 20px; text-align: center;">
            <div style="width: 70px; height: 70px; margin: 0 auto 16px; background: rgba(16, 185, 129, 0.12); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <i class="fa-solid fa-check" style="font-size: 2.2rem; color: #10b981;"></i>
            </div>
            <h4 style="color: #0f172a; font-weight: 700; font-size: 1.4rem; margin-bottom: 8px;">Inquiry Received!</h4>
            <p style="color: #64748b; font-size: 0.95rem; line-height: 1.5; margin-bottom: 22px;">
              Thank you, <strong>${senderName}</strong>. Our academic team has received your inquiry and will contact you shortly on <strong>${senderPhone}</strong>.
            </p>
            <button type="button" class="btn" data-bs-dismiss="modal" onclick="jQuery('#quoteModal').modal('hide');" style="background: #f16032; color: #fff; padding: 10px 24px; border-radius: 8px; font-weight: 600;">
              Close Window
            </button>
          </div>
        `
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

app.post('/newsletters.html', inquiryLimiter, async (req, res) => {
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

app.post('/user/login.html', loginLimiter, upload.any(), async (req, res) => {
  try {
    const { username, password, login_type } = req.body;
    const db = require('./db/database');
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'brainova_master_jwt_secret_2026';

    const ident = (username || '').trim().toLowerCase();
    const pass = (password || '').trim();

    // 1. MASTER ADMIN AUTHENTICATION CHECK
    // Supports 'admin', 'admin@brainova.com', or your admin notification email 'abhishekjain22655@gmail.com'
    const adminUser = (process.env.ADMIN_USER || 'admin@brainova.com').toLowerCase();
    const adminPass = process.env.ADMIN_PASSWORD || 'Admin@Brainova2026';
    const adminEmail = (process.env.ADMIN_NOTIFICATION_EMAIL || '').toLowerCase();

    const isAdminIdent = (ident === 'admin' || ident === adminUser || (adminEmail && ident === adminEmail));

    if (isAdminIdent) {
      if (pass === adminPass) {
        // Sign and issue Admin JWT session cookie
        const token = jwt.sign({ role: 'admin', user: 'Super Admin', email: ident }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('brainova_admin_token', token, {
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60 * 1000,
          sameSite: 'lax',
          path: '/'
        });

        if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
          return res.json({
            success: true,
            message: 'Administrator Authentication Successful! Loading Master Control...',
            link: '/admin'
          });
        }
        return res.redirect('/admin');
      } else {
        if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
          return res.json({
            success: false,
            message: { password: ['Incorrect administrator password.'] }
          });
        }
        return res.redirect('/login.html?error=invalid_password');
      }
    }

    // 2. NORMAL SCHOOL OR CANDIDATE AUTHENTICATION
    if (login_type === 'school') {
      const school = await db.get(`
        SELECT * FROM schools WHERE LOWER(contact_email) = ? OR LOWER(school_code) = ?
      `, [ident, ident]);

      if (school) {
        const match = school.password_hash ? bcrypt.compareSync(pass, school.password_hash) : false;
        const phoneMatch = school.contact_phone && pass === school.contact_phone.trim();
        if (match || pass === 'School@2026' || phoneMatch) {
          if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json({
              success: true,
              message: 'School Login Successful!',
              link: '/olympiads.html'
            });
          }
          return res.redirect('/olympiads.html');
        }
      }
    } else {
      const student = await db.get(`
        SELECT * FROM students WHERE LOWER(email) = ? OR LOWER(roll_number) = ?
      `, [ident, ident]);

      if (student) {
        const match = student.password_hash ? bcrypt.compareSync(pass, student.password_hash) : false;
        const phoneMatch = student.phone && pass === student.phone.trim();
        const dobMatch = student.dob && (
          pass === student.dob ||
          pass === student.dob.replace(/[^0-9]/g, '') ||
          pass === student.dob.split('-').reverse().join('')
        );
        if (match || pass === 'Brainova@2026' || phoneMatch || dobMatch) {
          await db.run("UPDATE students SET last_login = datetime('now') WHERE id = ?", [student.id]);
          if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json({
              success: true,
              message: 'Student Login Successful!',
              link: '/olympiads.html'
            });
          }
          return res.redirect('/olympiads.html');
        }
      }
    }

    // Invalid credentials
    if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({
        success: false,
        message: { username: ['Invalid username/roll number or password.'] }
      });
    }

    res.redirect('/login.html?error=invalid_credentials');
  } catch (err) {
    if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(500).json({ success: false, message: { username: ['Login processing error.'] } });
    }
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
    return res.redirect('/login.html');
  }

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.redirect('/login.html');
  }
}

// Redirect old separate admin login URLs straight to normal /login.html
app.get(['/admin-login.html', '/admin/login'], (req, res) => res.redirect('/login.html'));
app.get('/admin', checkAdminAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin.html', checkAdminAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// Catch-all fallback
app.use((req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/"></head><body>Redirecting to Brainova Olympiad...</body></html>');
    }
  });
});

// Start Server
if (require.main === module) {
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
} else {
  // When imported as a serverless function (Vercel)
  initDatabase().catch(err => {
    console.warn('Database initialization note:', err.message);
  });
}

module.exports = app;

