const express = require('express');
const router = express.Router();
const { all, run, get } = require('../db/database');

// 1. Get schools list for tenant dropdown in registration
router.get('/schools', async (req, res) => {
  try {
    const schools = await all(`
      SELECT id, school_code, school_name, affiliation_board, city, state 
      FROM schools 
      WHERE status = 'active'
      ORDER BY school_name ASC
    `);
    res.json({ success: true, data: schools });
  } catch (error) {
    console.error('Fetch schools error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch institutions.' });
  }
});

// 2. Submit Contact Inquiry / Quick Quote Request
router.post('/contact', async (req, res) => {
  try {
    const { name, phone_number, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and message.' });
    }

    await run(`
      INSERT INTO contact_inquiries (full_name, phone_number, email, message, inquiry_type)
      VALUES (?, ?, ?, ?, 'contact_quote')
    `, [name.trim(), phone_number || '', email.trim().toLowerCase(), message.trim()]);

    res.json({ success: true, message: 'Thank you! Your inquiry has been received. Our academic team will contact you shortly.' });
  } catch (error) {
    console.error('Contact error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit inquiry.' });
  }
});

// 3. Newsletter Subscription
router.post('/newsletter', async (req, res) => {
  try {
    const { newsletter } = req.body;
    if (!newsletter) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const email = newsletter.trim().toLowerCase();
    const existing = await get('SELECT id FROM newsletter_subscribers WHERE email = ?', [email]);
    if (existing) {
      return res.json({ success: true, message: 'You are already subscribed to the Brainova National Olympiad newsletter!' });
    }

    await run('INSERT INTO newsletter_subscribers (email) VALUES (?)', [email]);
    res.json({ success: true, message: 'Subscribed successfully! You will receive regular Olympiad updates.' });
  } catch (error) {
    console.error('Newsletter error:', error);
    res.status(500).json({ success: false, message: 'Subscription failed.' });
  }
});

module.exports = router;
