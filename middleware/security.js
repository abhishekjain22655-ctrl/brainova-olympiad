// =====================================================================
// BRAINOVA NATIONAL OLYMPIAD - CORE SECURITY MIDDLEWARE
// =====================================================================

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 1. Helmet Security Headers (anti-clickjacking, nosniff, remove X-Powered-By)
const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false
});

// 2. Anti-Brute-Force Rate Limiters
// Login limiter: Max 20 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP address. Please wait 15 minutes before trying again.'
  }
});

// Registration limiter: Max 25 accounts created per 15 minutes per IP
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration requests from this connection. Please try again after 15 minutes.'
  }
});

// Public inquiries limiter (Contact forms, quotes, newsletters): Max 30 per 15 minutes per IP
const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Submission limit reached. Please wait a few minutes before submitting another inquiry.'
  }
});

// 3. XSS Sanitization Helper (Neutralizes any HTML/script injection attempts)
function sanitizeInput(val) {
  if (typeof val !== 'string') return val;
  return val.replace(/[<>]/g, '').trim();
}

// 4. Password Security Validation (Ensures minimum 6 characters for students/schools)
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required.' };
  }
  const cleanPass = password.trim();
  if (cleanPass.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters long for student security.' };
  }
  return { valid: true };
}

module.exports = {
  securityHeaders,
  loginLimiter,
  registerLimiter,
  inquiryLimiter,
  sanitizeInput,
  validatePassword
};
