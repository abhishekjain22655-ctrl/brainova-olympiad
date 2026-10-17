require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSend() {
  console.log('Sending test email using account:', process.env.EMAIL_USER);
  const passClean = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: passClean
    }
  });

  try {
    const info = await transporter.sendMail({
      from: `"Brainova National Olympiad" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_NOTIFICATION_EMAIL,
      subject: '🔔 Verification Test: Brainova National Olympiad Notifications are Live!',
      html: `
        <div style="font-family: Arial, sans-serif; background: #110d33; color: #fff; padding: 30px; border-radius: 12px; max-width: 550px; margin: 0 auto;">
          <h2 style="color: #f16032; margin-top: 0;">Brainova National Olympiad 2026</h2>
          <h3 style="color: #10b981;">✅ Email Notifications are Working!</h3>
          <p style="color: #cbd5e1; line-height: 1.5;">This email confirms that your Gmail App Password has been successfully verified.</p>
          <p style="color: #cbd5e1;">From now on, whenever a new student or school registers, or someone sends an inquiry, you will immediately receive an instant notification here at <strong>${process.env.ADMIN_NOTIFICATION_EMAIL}</strong>.</p>
          <div style="background: rgba(255,255,255,0.08); padding: 12px 16px; border-radius: 8px; margin-top: 20px; font-size: 13px; color: #94a3b8;">
            Time of Dispatch: ${new Date().toLocaleString()}
          </div>
        </div>
      `
    });

    console.log('🎉 SUCCESS! Real email sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (err) {
    console.error('❌ Failed to send email:', err.message);
    if (err.message.includes('Username and Password not accepted')) {
      console.error('HINT: Check if 2-Step Verification is enabled and the 16-letter App Password was copied without typos.');
    }
  }
}

testSend();
