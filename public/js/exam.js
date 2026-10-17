// =====================================================================
// BRAINOVA NATIONAL OLYMPIAD - LIVE ONLINE EXAMINATION ENGINE
// =====================================================================

let examData = {
  subject: null,
  questions: [],
  currentIndex: 0,
  answers: {}, // questionId -> 'A' | 'B' | 'C' | 'D'
  reviewed: {}, // questionId -> boolean
  visited: {}, // questionId -> boolean
  totalSeconds: 20 * 60,
  remainingSeconds: 20 * 60,
  timerInterval: null,
  isSubmitted: false
};

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const subjectSlug = urlParams.get('subject') || 'math-olympiad';
  loadExamSession(subjectSlug);
});

async function loadExamSession(subjectSlug) {
  try {
    const res = await fetch(`/api/exams/questions/${subjectSlug}`);
    const json = await res.json();

    if (!json.success || !json.questions || json.questions.length === 0) {
      alert('Examination questions could not be loaded. Returning to subjects portal.');
      window.location.href = '/olympiads.html';
      return;
    }

    examData.subject = json.subject;
    examData.questions = json.questions;
    examData.totalSeconds = (json.subject.duration_minutes || 20) * 60;
    examData.remainingSeconds = examData.totalSeconds;

    // Update Header
    document.getElementById('examSubjectTitle').textContent = json.subject.title;
    document.getElementById('examTotalQCount').textContent = json.questions.length;

    // Check candidate Roll Number from URL or Storage (No login required)
    const urlParams = new URLSearchParams(window.location.search);
    const activeRoll = urlParams.get('roll') || localStorage.getItem('brainova_roll');

    if (activeRoll) {
      document.getElementById('examCandidateRoll').textContent = activeRoll;
      localStorage.setItem('brainova_roll', activeRoll);
      try {
        const cRes = await fetch(`/api/exams/candidate/${encodeURIComponent(activeRoll)}`);
        const cJson = await cRes.json();
        if (cJson.success && cJson.candidate) {
          examData.candidate = cJson.candidate;
          document.getElementById('examCandidateName').textContent = cJson.candidate.name;
          document.getElementById('examCandidateRoll').textContent = cJson.candidate.roll_number;
        }
      } catch (e) {
        console.warn('Could not resolve candidate by roll number:', e);
      }
    } else {
      const userJson = localStorage.getItem('brainova_user');
      if (userJson) {
        try {
          const u = JSON.parse(userJson);
          examData.candidate = u;
          document.getElementById('examCandidateName').textContent = u.name || 'Candidate';
          document.getElementById('examCandidateRoll').textContent = u.roll_number || 'BNO-GUEST';
        } catch (e) {}
      }
    }

    buildQuestionPalette();
    renderQuestion(0);
    startTimer();
    setupExamButtons();
  } catch (err) {
    console.error('Failed to initialize exam session:', err);
    alert('Network error while loading exam session.');
  }
}

// 1. Timer Engine
function startTimer() {
  const timerDisplay = document.getElementById('examTimerDisplay');
  const timerProgress = document.getElementById('timerProgressBar');

  updateTimerDisplay();

  examData.timerInterval = setInterval(() => {
    if (examData.remainingSeconds <= 0) {
      clearInterval(examData.timerInterval);
      alert('Time is up! Submitting your examination automatically...');
      submitExam();
      return;
    }

    examData.remainingSeconds--;
    updateTimerDisplay();

    // Progress bar
    if (timerProgress) {
      const pct = (examData.remainingSeconds / examData.totalSeconds) * 100;
      timerProgress.style.width = `${pct}%`;
      if (pct < 15) {
        timerProgress.style.backgroundColor = '#ef4444';
      } else if (pct < 40) {
        timerProgress.style.backgroundColor = '#f59e0b';
      }
    }
  }, 1000);
}

function updateTimerDisplay() {
  const timerDisplay = document.getElementById('examTimerDisplay');
  if (!timerDisplay) return;

  const mins = Math.floor(examData.remainingSeconds / 60);
  const secs = examData.remainingSeconds % 60;
  timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  if (mins < 3) {
    timerDisplay.style.color = '#ef4444';
  }
}

// 2. Build Question Palette
function buildQuestionPalette() {
  const grid = document.getElementById('questionPaletteGrid');
  if (!grid) return;

  grid.innerHTML = examData.questions.map((q, idx) => `
    <button type="button" class="q-palette-btn not-visited" id="palette-btn-${idx}" onclick="jumpToQuestion(${idx})">
      ${idx + 1}
    </button>
  `).join('');
}

function updatePaletteStatus(index) {
  const q = examData.questions[index];
  const btn = document.getElementById(`palette-btn-${index}`);
  if (!btn) return;

  btn.className = 'q-palette-btn';

  if (index === examData.currentIndex) {
    btn.classList.add('current');
  }

  if (examData.answers[q.id]) {
    btn.classList.add('answered');
  } else if (examData.reviewed[q.id]) {
    btn.classList.add('review');
  } else if (examData.visited[q.id]) {
    btn.classList.add('visited-unanswered');
  } else {
    btn.classList.add('not-visited');
  }

  updatePaletteSummary();
}

function updatePaletteSummary() {
  let answered = 0;
  let reviewed = 0;
  let notAnswered = 0;

  examData.questions.forEach(q => {
    if (examData.answers[q.id]) answered++;
    else if (examData.reviewed[q.id]) reviewed++;
    else if (examData.visited[q.id]) notAnswered++;
  });

  const countAns = document.getElementById('countAnswered');
  const countRev = document.getElementById('countReview');
  const countNotAns = document.getElementById('countNotAnswered');

  if (countAns) countAns.textContent = answered;
  if (countRev) countRev.textContent = reviewed;
  if (countNotAns) countNotAns.textContent = notAnswered;
}

// 3. Render Question
function renderQuestion(index) {
  if (index < 0 || index >= examData.questions.length) return;

  examData.currentIndex = index;
  const q = examData.questions[index];
  examData.visited[q.id] = true;

  document.getElementById('currentQNum').textContent = index + 1;
  document.getElementById('currentQMarks').textContent = `+${examData.subject.marks_per_question} Marks`;
  document.getElementById('questionContentText').textContent = q.question_text;

  const currentSelection = examData.answers[q.id] || null;

  const optionsContainer = document.getElementById('questionOptionsContainer');
  const options = [
    { key: 'A', text: q.option_a },
    { key: 'B', text: q.option_b },
    { key: 'C', text: q.option_c },
    { key: 'D', text: q.option_d }
  ];

  optionsContainer.innerHTML = options.map(opt => `
    <label class="exam-option-card ${currentSelection === opt.key ? 'selected' : ''}" onclick="selectOption(${q.id}, '${opt.key}')">
      <input type="radio" name="opt_choice" value="${opt.key}" ${currentSelection === opt.key ? 'checked' : ''}>
      <span class="option-key">${opt.key}</span>
      <span class="option-label">${escapeHtml(opt.text)}</span>
    </label>
  `).join('');

  // Update Palette States
  examData.questions.forEach((_, i) => updatePaletteStatus(i));

  // Toggle prev button
  const prevBtn = document.getElementById('btnPrevQ');
  if (prevBtn) prevBtn.disabled = index === 0;

  const nextBtn = document.getElementById('btnNextQ');
  if (nextBtn) {
    nextBtn.innerHTML = index === examData.questions.length - 1 
      ? 'Save & Preview <i class="fas fa-check"></i>' 
      : 'Save & Next <i class="fas fa-chevron-right"></i>';
  }
}

function selectOption(questionId, choice) {
  examData.answers[questionId] = choice;
  delete examData.reviewed[questionId]; // selecting answer clears review state
  renderQuestion(examData.currentIndex);
}

function jumpToQuestion(index) {
  renderQuestion(index);
}

// 4. Setup Controls
function setupExamButtons() {
  document.getElementById('btnPrevQ')?.addEventListener('click', () => {
    if (examData.currentIndex > 0) renderQuestion(examData.currentIndex - 1);
  });

  document.getElementById('btnNextQ')?.addEventListener('click', () => {
    if (examData.currentIndex < examData.questions.length - 1) {
      renderQuestion(examData.currentIndex + 1);
    } else {
      openSubmitConfirmModal();
    }
  });

  document.getElementById('btnReviewQ')?.addEventListener('click', () => {
    const q = examData.questions[examData.currentIndex];
    examData.reviewed[q.id] = true;
    if (examData.currentIndex < examData.questions.length - 1) {
      renderQuestion(examData.currentIndex + 1);
    } else {
      updatePaletteStatus(examData.currentIndex);
    }
  });

  document.getElementById('btnClearQ')?.addEventListener('click', () => {
    const q = examData.questions[examData.currentIndex];
    delete examData.answers[q.id];
    delete examData.reviewed[q.id];
    renderQuestion(examData.currentIndex);
  });

  document.getElementById('btnFinalSubmitExam')?.addEventListener('click', openSubmitConfirmModal);
  document.getElementById('btnConfirmSubmit')?.addEventListener('click', submitExam);
  document.getElementById('btnCancelSubmit')?.addEventListener('click', closeSubmitConfirmModal);
}

function openSubmitConfirmModal() {
  let ansCount = Object.keys(examData.answers).length;
  let unansCount = examData.questions.length - ansCount;

  document.getElementById('confirmAnsCount').textContent = ansCount;
  document.getElementById('confirmUnansCount').textContent = unansCount;
  document.getElementById('confirmModalOverlay').classList.add('active');
}

function closeSubmitConfirmModal() {
  document.getElementById('confirmModalOverlay').classList.remove('active');
}

// 5. Submit Exam & Render Automated Scorecard
async function submitExam() {
  if (examData.isSubmitted) return;
  examData.isSubmitted = true;
  clearInterval(examData.timerInterval);
  closeSubmitConfirmModal();

  const timeTaken = examData.totalSeconds - examData.remainingSeconds;

  let studentId = examData.candidate?.id || 1;
  let rollNumber = examData.candidate?.roll_number || localStorage.getItem('brainova_roll') || 'BNO-2026-GUEST';

  const userJson = localStorage.getItem('brainova_user');
  if (userJson && !examData.candidate) {
    try {
      const u = JSON.parse(userJson);
      studentId = u.id || studentId;
      rollNumber = u.roll_number || rollNumber;
    } catch (e) {}
  }

  const payload = {
    student_id: studentId,
    roll_number: rollNumber,
    subject_slug: examData.subject.slug,
    answers: examData.answers,
    time_taken_seconds: timeTaken
  };

  try {
    const res = await fetch('/api/exams/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (json.success) {
      renderScorecard(json.scorecard);
    } else {
      alert('Error recording examination results.');
    }
  } catch (err) {
    console.error('Submission failed:', err);
    alert('Server error occurred during grading.');
  }
}

function renderScorecard(scorecard) {
  const modal = document.getElementById('scorecardModalOverlay');
  if (!modal) return;

  document.getElementById('resStudentName').textContent = scorecard.student_name;
  document.getElementById('resRollNumber').textContent = scorecard.roll_number;
  document.getElementById('resSubjectName').textContent = scorecard.subject;
  document.getElementById('resScoreFraction').textContent = `${scorecard.score} / ${scorecard.max_score}`;
  document.getElementById('resPercentage').textContent = `${scorecard.percentage}%`;
  document.getElementById('resPercentile').textContent = `${scorecard.percentile}th Percentile`;
  document.getElementById('resTimeTaken').textContent = scorecard.time_taken_formatted;
  document.getElementById('resCorrectCount').textContent = scorecard.correct;
  document.getElementById('resWrongCount').textContent = scorecard.wrong;
  document.getElementById('resUnansweredCount').textContent = scorecard.unanswered;

  // Grade badge
  const gradeBadge = document.getElementById('resGradeBadge');
  if (scorecard.percentage >= 90) {
    gradeBadge.textContent = 'Gold Medalist - Outstanding';
    gradeBadge.className = 'grade-pill grade-gold';
  } else if (scorecard.percentage >= 75) {
    gradeBadge.textContent = 'Distinction Certificate';
    gradeBadge.className = 'grade-pill grade-silver';
  } else if (scorecard.percentage >= 50) {
    gradeBadge.textContent = 'Merit Qualified';
    gradeBadge.className = 'grade-pill grade-bronze';
  } else {
    gradeBadge.textContent = 'Participation Certificate';
    gradeBadge.className = 'grade-pill grade-pass';
  }

  // Detailed Review Accordion
  const reviewContainer = document.getElementById('scorecardDetailedReview');
  if (reviewContainer && scorecard.detailedReview) {
    reviewContainer.innerHTML = scorecard.detailedReview.map((rev, idx) => `
      <div class="review-item ${rev.is_correct ? 'item-correct' : rev.user_choice === 'Not Attempted' ? 'item-unanswered' : 'item-wrong'}">
        <div class="review-item-header">
          <span>Q${idx + 1}: ${rev.is_correct ? '<i class="fas fa-check text-success"></i> Correct (+4)' : rev.user_choice === 'Not Attempted' ? '<i class="fas fa-minus text-muted"></i> Not Attempted (0)' : '<i class="fas fa-times text-danger"></i> Incorrect (0)'}</span>
          <span style="font-weight: 700;">Your Choice: Option ${rev.user_choice} | Correct: Option ${rev.correct_choice}</span>
        </div>
        ${rev.explanation ? `<div class="review-explanation"><i class="fas fa-lightbulb"></i> <strong>Explanation:</strong> ${escapeHtml(rev.explanation)}</div>` : ''}
      </div>
    `).join('');
  }

  modal.classList.add('active');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}
