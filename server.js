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

// HTML page routes matching the original site structure
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/olympiads.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'subjects.html')));
app.get('/math-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'subjects.html')));
app.get('/english-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'subjects.html')));
app.get('/gk-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'subjects.html')));
app.get('/science-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'subjects.html')));
app.get('/computer-olympiad.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'subjects.html')));
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
