const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../brainova.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('DELETE FROM exam_attempts');
  db.run('DELETE FROM students');
  db.run('DELETE FROM contact_inquiries');
  db.run('DELETE FROM newsletter_subscribers');
  db.run("DELETE FROM sqlite_sequence WHERE name IN ('students', 'exam_attempts', 'contact_inquiries', 'newsletter_subscribers')", (err) => {
    if (err) {
      console.error('Error clearing sqlite sequences:', err);
    } else {
      console.log('✅ ALL DUMMY DATA CLEARED!');
    }
  });

  db.get('SELECT COUNT(*) as count FROM students', (err, row) => {
    console.log('Total Student Registrations now:', row ? row.count : 0);
  });

  db.get('SELECT COUNT(*) as count FROM exam_attempts', (err, row) => {
    console.log('Total Exam Attempts now:', row ? row.count : 0);
    db.close();
  });
});
