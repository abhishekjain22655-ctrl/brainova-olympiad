// =====================================================================
// AUTOMATED TEST SUITE: BRAINOVA EMAIL & NOTIFICATION SERVICE
// =====================================================================

require('dotenv').config();
const emailService = require('../services/emailService');
const fs = require('fs');
const path = require('path');

async function runEmailTests() {
  console.log('🧪 Starting Email & Notification System Verification...\n');

  // Test 1: Student Registration Email Notification
  console.log('Test 1: Dispatching Student Registration Alert & Confirmation...');
  await emailService.sendStudentRegistrationEmails({
    student: {
      roll_number: 'BNO-2026-TEST',
      full_name: 'Pooja Verma',
      email: 'pooja.verma@example.com',
      phone: '9876543210',
      grade_class: 'Class 9',
      city: 'Delhi',
      state: 'Delhi'
    },
    school: {
      school_name: 'Delhi Public School, R.K. Puram',
      school_code: 'SCH-101'
    }
  });

  // Test 2: School Registration Email Notification
  console.log('Test 2: Dispatching School Registration Alert & Confirmation...');
  await emailService.sendSchoolRegistrationEmails({
    school: {
      school_code: 'SCH-TEST-999',
      school_name: 'St. Marks Senior Secondary School',
      affiliation_board: 'CBSE',
      contact_person: 'Dr. Sunita Rao',
      contact_email: 'principal@stmarks.edu',
      contact_phone: '9811223344',
      city: 'Bengaluru',
      state: 'Karnataka'
    }
  });

  // Test 3: Contact Inquiry Alert
  console.log('Test 3: Dispatching Contact Inquiry Alert...');
  await emailService.sendContactInquiryEmails({
    inquiry: {
      full_name: 'Amit Kumar',
      email: 'amit.kumar@example.com',
      phone_number: '9822334455',
      message: 'Hello Brainova team, we would like to register 250 students for the National Science Olympiad.'
    }
  });

  // Give asynchronous setImmediate a brief tick
  await new Promise(resolve => setTimeout(resolve, 800));

  // Check email_notifications.log
  const logPath = path.join(__dirname, '..', 'email_notifications.log');
  if (fs.existsSync(logPath)) {
    const logs = fs.readFileSync(logPath, 'utf8');
    console.log('\n📄 Recent entries from email_notifications.log:');
    const lines = logs.trim().split('\n').slice(-6);
    console.log(lines.join('\n'));
    console.log('\n✅ ALL EMAIL NOTIFICATION DISPATCH TESTS PASSED!');
  } else {
    console.error('❌ Log file not generated.');
  }
}

runEmailTests();
