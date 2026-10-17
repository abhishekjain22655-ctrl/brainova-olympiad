// =====================================================================
// BRAINOVA NATIONAL OLYMPIAD - ENTERPRISE EMAIL & NOTIFICATION SERVICE
// =====================================================================

require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'email_notifications.log');

/**
 * Log email events with timestamp
 */
function logEmailEvent(type, recipient, subject, status, details = '') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type.toUpperCase()}] [${status}] TO: ${recipient} | SUBJECT: "${subject}" ${details ? '| ' + details : ''}\n`;
  console.log(`📧 ${logEntry.trim()}`);
  try {
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (err) {
    // Silent fail if log file cannot be written
  }
}

/**
 * Creates the appropriate Nodemailer transporter based on .env config.
 */
function createTransporter() {
  const service = process.env.EMAIL_SERVICE || 'gmail';
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    return null; // Safe fallback mode
  }

  if (service.toLowerCase() === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }

  // Custom SMTP (Brevo, SendGrid, Hostinger, etc.)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass }
  });
}

/**
 * Dispatches an email with safe error handling and fallback logging.
 */
async function sendMailSafe({ to, subject, html, text }) {
  const transporter = createTransporter();
  const fromName = process.env.EMAIL_FROM_NAME || 'Brainova National Olympiad 2026';
  const fromAddress = process.env.EMAIL_USER || process.env.EMAIL_FROM_ADDRESS || 'notifications@brainova.com';
  const from = `"${fromName}" <${fromAddress}>`;

  if (!transporter) {
    // Safe Development / Simulation Mode
    logEmailEvent('SIMULATION', to, subject, 'SUCCESS_MOCKED', '(Configure EMAIL_USER & EMAIL_PASS in .env to deliver real emails)');
    return { success: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: text || 'Please view this email in an HTML-compatible client.'
    });

    logEmailEvent('DISPATCH', to, subject, 'DELIVERED', `MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logEmailEvent('DISPATCH_ERROR', to, subject, 'FAILED', err.message);
    return { success: false, error: err.message };
  }
}

// =====================================================================
// 1. STUDENT REGISTRATION NOTIFICATIONS
// =====================================================================
async function sendStudentRegistrationEmails({ student, school }) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@brainova.com';
  const schoolName = school?.school_name || student.school_name || 'Independent Candidate';
  const schoolCode = school?.school_code || student.school_code || 'N/A';
  const rollNumber = student.roll_number || 'BNO-2026-PENDING';

  // 1A. Email Alert to Admin (Holder)
  const adminHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0b0821; color: #ffffff; margin: 0; padding: 20px; }
        .card { background-color: #15103d; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, #100b2e, #19124d); padding: 24px; border-bottom: 2px solid #f16032; text-align: center; }
        .header h2 { margin: 0; color: #f16032; font-size: 20px; letter-spacing: 1px; }
        .header span { color: #94a3b8; font-size: 13px; text-transform: uppercase; font-weight: bold; }
        .body { padding: 28px; }
        .pill { display: inline-block; background: rgba(241,96,50,0.15); border: 1px solid #f16032; color: #f16032; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 16px; margin: 10px 0; }
        .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .data-table td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 14px; }
        .data-table .label { color: #94a3b8; font-weight: bold; width: 35%; }
        .data-table .val { color: #ffffff; }
        .footer { padding: 18px; text-align: center; font-size: 12px; color: #64748b; background: #0c0825; border-top: 1px solid rgba(255,255,255,0.06); }
        .btn-view { display: inline-block; background: #f16032; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h2>BRAINOVA NATIONAL OLYMPIAD 2026</h2>
          <span>New Candidate Registration Alert</span>
        </div>
        <div class="body">
          <p style="margin: 0; color: #cbd5e1; font-size: 15px;">A new student candidate has just successfully registered on the platform:</p>
          <div style="text-align: center; margin: 15px 0;">
            <div class="pill">${rollNumber}</div>
          </div>
          <table class="data-table">
            <tr><td class="label">Candidate Name:</td><td class="val"><strong>${student.full_name}</strong></td></tr>
            <tr><td class="label">Roll Number:</td><td class="val" style="color: #f16032; font-weight: bold;">${rollNumber}</td></tr>
            <tr><td class="label">Grade / Class:</td><td class="val">${student.grade_class}</td></tr>
            <tr><td class="label">Assigned School:</td><td class="val">${schoolName} (${schoolCode})</td></tr>
            <tr><td class="label">Email Address:</td><td class="val">${student.email}</td></tr>
            <tr><td class="label">Contact Phone:</td><td class="val">${student.phone || 'N/A'}</td></tr>
            <tr><td class="label">Location:</td><td class="val">${student.city || 'N/A'}, ${student.state || 'N/A'}</td></tr>
          </table>
          <div style="text-align: center;">
            <a href="http://localhost:3000/admin" class="btn-view">Inspect Candidate in Admin Ledger &rarr;</a>
          </div>
        </div>
        <div class="footer">
          Brainova Master Control Automated Notification • ${new Date().toLocaleString()}
        </div>
      </div>
    </body>
    </html>
  `;

  // 1B. Official Welcome & Confirmation to the Student
  const studentHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
        .card { background-color: #ffffff; border-radius: 14px; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
        .header { background: #110d33; padding: 28px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 22px; letter-spacing: 1px; }
        .header p { margin: 6px 0 0 0; color: #f16032; font-size: 14px; font-weight: bold; }
        .body { padding: 32px 28px; }
        .roll-box { background: #fff7ed; border: 2px dashed #f16032; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0; }
        .roll-label { font-size: 12px; color: #9a3412; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .roll-num { font-size: 26px; color: #f16032; font-weight: 800; letter-spacing: 1px; margin-top: 4px; }
        .instruction-box { background: #f1f5f9; border-radius: 10px; padding: 16px; margin-top: 20px; font-size: 14px; line-height: 1.6; color: #334155; }
        .btn-exam { display: inline-block; background: #f16032; color: #ffffff; text-decoration: none; padding: 12px 26px; border-radius: 8px; font-weight: bold; font-size: 15px; margin-top: 20px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #64748b; background: #f8fafc; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>BRAINOVA NATIONAL OLYMPIAD 2026</h1>
          <p>Official Registration & Enrollment Confirmation</p>
        </div>
        <div class="body">
          <h2 style="color: #0f172a; margin-top: 0;">Welcome, ${student.full_name}! 👋</h2>
          <p style="color: #475569; line-height: 1.5;">Congratulations! You have been successfully registered for the <strong>Brainova National Olympiad 2026</strong>. Please preserve your official candidate roll number below for all future examinations and admit card access.</p>
          
          <div class="roll-box">
            <div class="roll-label">Official Candidate Roll Number</div>
            <div class="roll-num">${rollNumber}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Grade: ${student.grade_class} | Institution: ${schoolName}</div>
          </div>

          <div class="instruction-box">
            <strong>Next Steps for Candidates:</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              <li>Practice sample tests using the <strong>Mock Exam Engine</strong>.</li>
              <li>Your Admit Card will be generated using your Roll Number (<strong>${rollNumber}</strong>).</li>
              <li>Official National Olympiad test schedules and links will be shared via this registered email address.</li>
            </ul>
          </div>

          <div style="text-align: center;">
            <a href="http://localhost:3000/exam.html" class="btn-exam">Start Mock Examination &rarr;</a>
          </div>
        </div>
        <div class="footer">
          Brainova Olympiad Foundation • Support Helpline: +91 8587929298 • support@brainova.com<br>
          C-13/48, Sector-3, Rohini, Delhi - 110085
        </div>
      </div>
    </body>
    </html>
  `;

  // Asynchronous dispatch (fire-and-forget so user form submission returns in milliseconds)
  setImmediate(async () => {
    // 1. Send Admin Alert
    await sendMailSafe({
      to: adminEmail,
      subject: `🔔 New Student Registration Alert: ${student.full_name} (${rollNumber})`,
      html: adminHtml
    });

    // 2. Send Student Confirmation (if student provided valid email)
    if (student.email && student.email.includes('@')) {
      await sendMailSafe({
        to: student.email,
        subject: `🎉 Registration Confirmed: Brainova National Olympiad 2026 - Roll No: ${rollNumber}`,
        html: studentHtml
      });
    }
  });
}

// =====================================================================
// 2. SCHOOL / INSTITUTION REGISTRATION NOTIFICATIONS
// =====================================================================
async function sendSchoolRegistrationEmails({ school }) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@brainova.com';
  const schoolCode = school.school_code || 'SCH-PENDING';
  const schoolName = school.school_name || 'Partner Institution';
  const recipientEmail = school.contact_email || school.email;

  // 2A. Admin Alert
  const adminHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; background-color: #0b0821; color: #fff; margin: 0; padding: 20px; }
        .card { background: #15103d; border-radius: 12px; max-width: 600px; margin: 0 auto; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
        .header { background: #110d33; padding: 24px; border-bottom: 2px solid #3b82f6; text-align: center; }
        .body { padding: 24px; }
        .pill { background: rgba(59,130,246,0.15); border: 1px solid #3b82f6; color: #60a5fa; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 16px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h2 style="margin: 0; color: #3b82f6;">BRAINOVA NATIONAL OLYMPIAD</h2>
          <span style="color: #94a3b8; font-size: 13px;">New Partner School Registration</span>
        </div>
        <div class="body">
          <p>A new institution has registered as an examination tenant center:</p>
          <div style="text-align: center; margin: 15px 0;">
            <div class="pill">${schoolCode}</div>
          </div>
          <p><strong>School Name:</strong> ${schoolName}</p>
          <p><strong>Affiliation Board:</strong> ${school.affiliation_board || 'CBSE'}</p>
          <p><strong>Principal / Contact:</strong> ${school.contact_person || school.contact_name || 'Principal'}</p>
          <p><strong>Email:</strong> ${recipientEmail || 'N/A'}</p>
          <p><strong>Phone:</strong> ${school.contact_phone || school.contact_phone_number || 'N/A'}</p>
          <p><strong>City / State:</strong> ${school.city || ''}, ${school.state || ''}</p>
          <div style="text-align: center; margin-top: 20px;">
            <a href="http://localhost:3000/admin" style="background: #3b82f6; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">Verify School in Admin Panel &rarr;</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // 2B. School Confirmation Email
  const schoolHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
        .card { background-color: #ffffff; border-radius: 12px; max-width: 600px; margin: 0 auto; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.06); }
        .header { background: #110d33; padding: 24px; text-align: center; color: #fff; }
        .body { padding: 28px; }
        .code-box { background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 10px; padding: 16px; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h2 style="margin: 0; color: #ffffff;">BRAINOVA NATIONAL OLYMPIAD 2026</h2>
          <span style="color: #60a5fa; font-weight: bold;">Institutional Center Enrollment</span>
        </div>
        <div class="body">
          <h3 style="color: #1e293b; margin-top: 0;">Welcome, ${schoolName}!</h3>
          <p>We are delighted to confirm your institution's registration as an official examination center for the Brainova National Olympiad 2026.</p>
          <div class="code-box">
            <div style="font-size: 12px; color: #1e40af; font-weight: bold;">Assigned Institution Code</div>
            <div style="font-size: 24px; color: #2563eb; font-weight: 800; margin-top: 4px;">${schoolCode}</div>
          </div>
          <p>Students from your institution can now select <strong>${schoolName}</strong> during candidate registration, or you can register batches directly.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  setImmediate(async () => {
    // 1. Send Admin Alert
    await sendMailSafe({
      to: adminEmail,
      subject: `🏫 New Partner School Registered: ${schoolName} (${schoolCode})`,
      html: adminHtml
    });

    // 2. Send School Confirmation
    if (recipientEmail && recipientEmail.includes('@')) {
      await sendMailSafe({
        to: recipientEmail,
        subject: `🏛️ Institution Registration Confirmed: ${schoolName} (Code: ${schoolCode})`,
        html: schoolHtml
      });
    }
  });
}

// =====================================================================
// 3. CONTACT INQUIRIES NOTIFICATIONS
// =====================================================================
async function sendContactInquiryEmails({ inquiry }) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@brainova.com';

  const adminHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; background-color: #0b0821; color: #fff; margin: 0; padding: 20px; }
        .card { background: #15103d; border-radius: 12px; max-width: 600px; margin: 0 auto; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
        .header { background: #110d33; padding: 22px; border-bottom: 2px solid #f59e0b; text-align: center; }
        .body { padding: 24px; }
        .msg-box { background: rgba(255,255,255,0.05); border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 6px; font-style: italic; color: #e2e8f0; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h2 style="margin: 0; color: #f59e0b;">BRAINOVA NATIONAL OLYMPIAD</h2>
          <span style="color: #94a3b8; font-size: 13px;">New Contact Inquiry / Consultation Request</span>
        </div>
        <div class="body">
          <p><strong>From:</strong> ${inquiry.full_name}</p>
          <p><strong>Email:</strong> ${inquiry.email || 'N/A'}</p>
          <p><strong>Phone:</strong> ${inquiry.phone_number || 'N/A'}</p>
          <p><strong>Message / Query:</strong></p>
          <div class="msg-box">"${inquiry.message || 'No message text provided.'}"</div>
          <div style="text-align: center; margin-top: 20px;">
            <a href="mailto:${inquiry.email || ''}" style="background: #f59e0b; color: #110d33; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">Reply Directly to Sender &rarr;</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  setImmediate(async () => {
    await sendMailSafe({
      to: adminEmail,
      subject: `💬 New Contact Inquiry: ${inquiry.full_name} (${inquiry.email || inquiry.phone_number || 'Parent/Educator'})`,
      html: adminHtml
    });
  });
}

module.exports = {
  sendMailSafe,
  sendStudentRegistrationEmails,
  sendSchoolRegistrationEmails,
  sendContactInquiryEmails
};
