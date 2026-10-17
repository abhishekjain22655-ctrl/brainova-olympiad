const express = require('express');
const router = express.Router();
const { get, run, all } = require('../db/database');

// 1. Get all active examination subjects
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await all(`
      SELECT s.*, COUNT(q.id) as loaded_questions 
      FROM subjects s
      LEFT JOIN exam_questions q ON s.id = q.subject_id
      WHERE s.status = 'active'
      GROUP BY s.id
      ORDER BY s.id ASC
    `);
    res.json({ success: true, data: subjects });
  } catch (error) {
    console.error('Fetch subjects error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch exam subjects.' });
  }
});

// Helper to resolve subject by slug or friendly alias
async function resolveSubject(slug) {
  if (!slug) return null;
  const direct = await get('SELECT * FROM subjects WHERE slug = ?', [slug]);
  if (direct) return direct;

  const aliasMap = {
    'maths': 'math-olympiad',
    'math': 'math-olympiad',
    'mathematics': 'math-olympiad',
    'science': 'science-olympiad',
    'english': 'english-olympiad',
    'gk': 'gk-olympiad',
    'general-knowledge': 'gk-olympiad',
    'cyber': 'computer-olympiad',
    'computer': 'computer-olympiad'
  };
  const mapped = aliasMap[slug.toLowerCase()];
  if (mapped) {
    return await get('SELECT * FROM subjects WHERE slug = ?', [mapped]);
  }
  return null;
}

// 2. Get questions for an Olympiad exam session
router.get('/questions/:subjectSlug', async (req, res) => {
  try {
    const { subjectSlug } = req.params;
    const subject = await resolveSubject(subjectSlug);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    const questions = await all(`
      SELECT id, subject_id, class_group, question_text, 
             option_a, option_b, option_c, option_d, difficulty
      FROM exam_questions
      WHERE subject_id = ?
      ORDER BY id ASC
    `, [subject.id]);

    res.json({
      success: true,
      subject: {
        id: subject.id,
        slug: subject.slug,
        title: subject.title,
        duration_minutes: subject.duration_minutes,
        total_questions: questions.length,
        marks_per_question: subject.marks_per_question
      },
      questions
    });
  } catch (error) {
    console.error('Fetch questions error:', error);
    res.status(500).json({ success: false, message: 'Failed to load exam questions.' });
  }
});

// 3. Submit exam attempt and calculate scorecard
router.post('/submit', async (req, res) => {
  try {
    const {
      student_id,
      roll_number,
      subject_slug,
      answers, // e.g., { "1": "C", "2": "B", ... }
      time_taken_seconds
    } = req.body;

    const subject = await resolveSubject(subject_slug);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Invalid examination subject.' });
    }

    // Resolve student
    let student = null;
    if (student_id) {
      student = await get('SELECT * FROM students WHERE id = ?', [student_id]);
    } else if (roll_number) {
      student = await get('SELECT * FROM students WHERE roll_number = ?', [roll_number]);
    }

    // Fallback demo student if guest testing
    if (!student) {
      student = await get('SELECT * FROM students ORDER BY id ASC LIMIT 1');
    }

    const allQuestions = await all('SELECT id, correct_option, explanation FROM exam_questions WHERE subject_id = ?', [subject.id]);
    
    let correctCount = 0;
    let wrongCount = 0;
    let answeredCount = 0;
    const marksPerQ = subject.marks_per_question || 4;
    const maxScore = allQuestions.length * marksPerQ;

    const detailedReview = allQuestions.map(q => {
      const userSelected = answers ? answers[q.id] : null;
      const isAnswered = Boolean(userSelected);
      if (isAnswered) answeredCount++;

      const isCorrect = userSelected === q.correct_option;
      if (isCorrect) {
        correctCount++;
      } else if (isAnswered) {
        wrongCount++;
      }

      return {
        question_id: q.id,
        user_choice: userSelected || 'Not Attempted',
        correct_choice: q.correct_option,
        is_correct: isCorrect,
        explanation: q.explanation
      };
    });

    const calculatedScore = correctCount * marksPerQ;
    const percentage = maxScore > 0 ? parseFloat(((calculatedScore / maxScore) * 100).toFixed(2)) : 0;

    // Record attempt
    const attemptRecord = await run(`
      INSERT INTO exam_attempts (
        student_id, school_id, subject_id, total_questions,
        answered_count, correct_count, wrong_count, score, max_score,
        percentage, time_taken_seconds, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    `, [
      student.id,
      student.school_id,
      subject.id,
      allQuestions.length,
      answeredCount,
      correctCount,
      wrongCount,
      calculatedScore,
      maxScore,
      percentage,
      time_taken_seconds || 600
    ]);

    // Calculate school / platform percentile rank
    const totalAttempts = await get('SELECT COUNT(*) as count FROM exam_attempts WHERE subject_id = ?', [subject.id]);
    const lowerScores = await get('SELECT COUNT(*) as count FROM exam_attempts WHERE subject_id = ? AND score < ?', [subject.id, calculatedScore]);
    const percentile = totalAttempts.count > 0 
      ? Math.min(99.9, Math.max(10, Math.round((lowerScores.count / totalAttempts.count) * 100))) 
      : 95.0;

    res.json({
      success: true,
      message: 'Exam submitted and graded successfully.',
      score: calculatedScore,
      percentage: percentage,
      scorecard: {
        attempt_id: attemptRecord.lastID,
        student_name: student.full_name,
        roll_number: student.roll_number,
        subject: subject.title,
        total_questions: allQuestions.length,
        answered: answeredCount,
        unanswered: allQuestions.length - answeredCount,
        correct: correctCount,
        wrong: wrongCount,
        score: calculatedScore,
        max_score: maxScore,
        percentage,
        percentile,
        time_taken_formatted: `${Math.floor((time_taken_seconds || 0) / 60)}m ${(time_taken_seconds || 0) % 60}s`,
        detailedReview
      }
    });
  } catch (error) {
    console.error('Exam submission error:', error);
    res.status(500).json({ success: false, message: 'Failed to process exam submission.' });
  }
});

module.exports = router;
