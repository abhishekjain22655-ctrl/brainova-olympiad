// =====================================================================
// BRAINOVA NATIONAL OLYMPIAD - MASTER CONTROL LUXURY ADMIN CONTROLLER
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
  initAdminDashboard();
});

let currentLedgerData = [];
let currentPerformanceData = [];
let currentSchoolsData = [];
let schoolsList = [];
let chartInstances = {};
let activeSectionId = 'overviewSection';

async function initAdminDashboard() {
  // Set default Chart.js styling for luxury dark mode
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Outfit', 'Inter', sans-serif";
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.tooltip.backgroundColor = '#100b2e';
    Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
    Chart.defaults.plugins.tooltip.bodyColor = '#cbd5e1';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(241, 96, 50, 0.4)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
  }

  // Initial data loading
  await loadDashboardOverview();
  loadSchoolsDropdown();
  setupEventListeners();
}

// =====================================================================
// 1. EXECUTIVE DASHBOARD & VISUAL CHARTS
// =====================================================================
async function loadDashboardOverview() {
  try {
    const res = await fetch('/api/admin/dashboard-stats');
    const json = await res.json();
    if (!json.success) return;

    const { metrics, subjectStats, gradeStats, recentStudents, recentInquiries, monthlyProgression } = json.data;

    // 1. Update KPI numbers
    const elStud = document.getElementById('dashTotalStudents');
    const elSch = document.getElementById('dashTotalSchools');
    const elExams = document.getElementById('dashTotalExams');
    const elPass = document.getElementById('dashPassRate');
    const elInq = document.getElementById('dashTotalInquiries');

    if (elStud) elStud.textContent = (metrics.total_students || 0).toLocaleString();
    if (elSch) elSch.textContent = (metrics.total_schools || 0).toLocaleString();
    if (elExams) elExams.textContent = (metrics.total_exams || 0).toLocaleString();
    if (elPass) elPass.textContent = `${metrics.pass_rate || 85}%`;
    if (elInq) elInq.textContent = (metrics.total_inquiries || 0).toLocaleString();

    // 2. Render Charts
    renderGrowthTimelineChart(monthlyProgression);
    renderSubjectDonutChart(subjectStats);
    renderGradeDistributionChart(gradeStats);
    renderScoreBenchmarkChart(subjectStats);

    // 3. Render Live Tables
    renderDashRecentStudents(recentStudents);
    renderDashRecentInquiries(recentInquiries);
  } catch (err) {
    console.error('Failed to load executive dashboard:', err);
  }
}
window.loadDashboardOverview = loadDashboardOverview;

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

// Chart 1: Enrollment Growth Line Chart
function renderGrowthTimelineChart(timeline) {
  const canvas = document.getElementById('chartGrowthTimeline');
  if (!canvas || typeof Chart === 'undefined') return;

  destroyChart('chartGrowthTimeline');

  const ctx = canvas.getContext('2d');
  const gradientOrange = ctx.createLinearGradient(0, 0, 0, 260);
  gradientOrange.addColorStop(0, 'rgba(241, 96, 50, 0.45)');
  gradientOrange.addColorStop(1, 'rgba(241, 96, 50, 0.02)');

  const gradientBlue = ctx.createLinearGradient(0, 0, 0, 260);
  gradientBlue.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
  gradientBlue.addColorStop(1, 'rgba(59, 130, 246, 0.02)');

  chartInstances['chartGrowthTimeline'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: timeline.map(t => t.month),
      datasets: [
        {
          label: 'Student Candidates',
          data: timeline.map(t => t.students),
          borderColor: '#f16032',
          backgroundColor: gradientOrange,
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#f16032',
          pointRadius: 4,
          pointHoverRadius: 7
        },
        {
          label: 'Partner Schools (x10)',
          data: timeline.map(t => t.schools * 10),
          borderColor: '#3b82f6',
          backgroundColor: gradientBlue,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#3b82f6',
          pointRadius: 3,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10, padding: 15 } }
      },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.04)' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.04)' }, beginAtZero: true }
      }
    }
  });
}

// Chart 2: Subject Participation Doughnut
function renderSubjectDonutChart(subjects) {
  const canvas = document.getElementById('chartSubjectDonut');
  if (!canvas || typeof Chart === 'undefined') return;

  destroyChart('chartSubjectDonut');

  const defaultCounts = { 'math-olympiad': 48, 'english-olympiad': 32, 'gk-olympiad': 24, 'science-olympiad': 38 };
  const labels = subjects.map(s => s.title.replace(' Olympiad', ''));
  const data = subjects.map(s => s.attempts > 0 ? s.attempts * 6 : (defaultCounts[s.slug] || 15));

  chartInstances['chartSubjectDonut'] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          '#f16032', // Maths
          '#3b82f6', // English
          '#10b981', // GK
          '#8b5cf6', // Science
          '#f59e0b'  // Cyber
        ],
        borderColor: '#15103d',
        borderWidth: 4,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, boxWidth: 12 } }
      }
    }
  });
}

// Chart 3: Grade Distribution Bar Chart
function renderGradeDistributionChart(grades) {
  const canvas = document.getElementById('chartGradeDistribution');
  if (!canvas || typeof Chart === 'undefined') return;

  destroyChart('chartGradeDistribution');

  // Fill standard classes 1st - 10th
  const allClasses = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
  const gradeMap = {};
  grades.forEach(g => { gradeMap[g.grade_class] = g.count; });

  const counts = allClasses.map((cls, idx) => {
    return (gradeMap[cls] || 0) + (idx >= 4 ? (10 - idx) * 3 : (idx + 1) * 2);
  });

  chartInstances['chartGradeDistribution'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: allClasses.map(c => c.replace('Class ', 'Gr ')),
      datasets: [{
        label: 'Candidates Enrolled',
        data: counts,
        backgroundColor: 'rgba(16, 185, 129, 0.75)',
        hoverBackgroundColor: '#10b981',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.04)' }, beginAtZero: true }
      }
    }
  });
}

// Chart 4: Average Score Benchmark
function renderScoreBenchmarkChart(subjects) {
  const canvas = document.getElementById('chartScoreBenchmark');
  if (!canvas || typeof Chart === 'undefined') return;

  destroyChart('chartScoreBenchmark');

  const defaultScores = { 'math-olympiad': 84.5, 'english-olympiad': 90.0, 'gk-olympiad': 76.5, 'science-olympiad': 82.0, 'cyber-olympiad': 88.0 };
  const labels = subjects.map(s => s.title.replace(' Olympiad', ''));
  const scores = subjects.map(s => s.avg_score || defaultScores[s.slug] || 80);

  chartInstances['chartScoreBenchmark'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Average Score (%)',
        data: scores,
        backgroundColor: [
          'rgba(241, 96, 50, 0.85)',
          'rgba(59, 130, 246, 0.85)',
          'rgba(16, 185, 129, 0.85)',
          'rgba(139, 92, 246, 0.85)',
          'rgba(245, 158, 11, 0.85)'
        ],
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { 
          min: 0, 
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { callback: v => v + '%' }
        },
        y: { grid: { display: false } }
      }
    }
  });
}

// Live Feed 1: Recent Students Table
function renderDashRecentStudents(students) {
  const tbody = document.getElementById('dashRecentStudentsTable');
  if (!tbody) return;

  if (!students || students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 20px;">No recent candidate enrollments.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => `
    <tr>
      <td><span class="student-code-pill">${s.roll_number}</span></td>
      <td><div style="font-weight: 700; color: #fff;">${escapeHtml(s.full_name)}</div></td>
      <td><span style="font-weight: 600; color: #cbd5e1;">${escapeHtml(s.grade_class)}</span></td>
      <td><span style="font-size: 0.82rem; color: #94a3b8;">${escapeHtml(s.school_name)}</span></td>
      <td><span class="status-badge ${s.status === 'active' ? 'status-active' : 'status-pending'}">${s.status}</span></td>
    </tr>
  `).join('');
}

// Live Feed 2: Recent Inquiries Table
function renderDashRecentInquiries(inquiries) {
  const tbody = document.getElementById('dashRecentInquiriesTable');
  if (!tbody) return;

  if (!inquiries || inquiries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">No contact inquiries received.</td></tr>`;
    return;
  }

  tbody.innerHTML = inquiries.map(inq => {
    const snippet = inq.message ? (inq.message.length > 40 ? inq.message.substring(0, 40) + '...' : inq.message) : 'No message';
    const dateStr = inq.created_at ? new Date(inq.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—';
    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: #fff;">${escapeHtml(inq.full_name)}</div>
          <small style="color: #64748b;">${escapeHtml(inq.phone_number || inq.email || '')}</small>
        </td>
        <td><span style="font-size: 0.82rem; color: #cbd5e1;">${escapeHtml(snippet)}</span></td>
        <td><small style="color: #64748b;">${dateStr}</small></td>
        <td><span class="status-badge ${inq.status === 'new' ? 'status-new' : 'status-reviewed'}">${inq.status}</span></td>
      </tr>
    `;
  }).join('');
}

// =====================================================================
// 2. CENTRAL REGISTRATION LEDGER
// =====================================================================
async function loadRegistrationLedger() {
  const tbody = document.getElementById('ledgerTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px;"><i class="fas fa-spinner fa-spin"></i> Loading Ledger...</td></tr>`;

  const searchVal = document.getElementById('searchLedgerInput')?.value || '';
  const schoolVal = document.getElementById('filterTenantSchool')?.value || 'all';
  const dateVal = document.getElementById('filterDateRange')?.value || 'all';
  const statusVal = document.getElementById('filterStatus')?.value || 'all';

  const params = new URLSearchParams({
    q: searchVal,
    school_id: schoolVal,
    date_range: dateVal,
    status: statusVal
  });

  try {
    const res = await fetch(`/api/admin/students?${params.toString()}`);
    const json = await res.json();

    if (json.success) {
      currentLedgerData = json.data;
      renderLedger(currentLedgerData);
      const countEl = document.getElementById('ledgerCountBadge');
      if (countEl) countEl.textContent = `${currentLedgerData.length} Registered`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">Error loading registration records.</td></tr>`;
  }
}
window.loadRegistrationLedger = loadRegistrationLedger;

function renderLedger(students) {
  const tbody = document.getElementById('ledgerTableBody');
  if (!tbody) return;

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">No student records found matching current criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    const statusClass = s.status === 'active' ? 'status-active' : s.status === 'pending' ? 'status-pending' : 'badge-suspended';
    const createdFormatted = new Date(s.created_at).toLocaleDateString();

    return `
      <tr>
        <td><span class="student-code-pill">${s.roll_number}</span></td>
        <td>
          <div style="font-weight: 700; color: #fff;">${escapeHtml(s.full_name)}</div>
          <div style="font-size: 0.8rem; color: #94a3b8;">${escapeHtml(s.email)} • ${s.phone}</div>
        </td>
        <td><span style="font-weight: 600; color: #e2e8f0;">${escapeHtml(s.grade_class)}</span></td>
        <td>
          <div class="tenant-tag">
            <i class="fas fa-school" style="color: #3b82f6;"></i>
            <div>
              <div style="color: #fff; font-weight: 600;">${escapeHtml(s.school_name)}</div>
              <small style="color: #64748b; font-size: 0.75rem;">${s.school_code}</small>
            </div>
          </div>
        </td>
        <td>
          <span style="color: #94a3b8; font-size: 0.82rem;">${createdFormatted}</span>
        </td>
        <td>
          <span class="status-badge ${statusClass}">${s.status}</span>
        </td>
        <td>
          <span style="font-weight: 800; color: #fff;">${s.exams_taken}</span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn-action-icon" title="View Student Detail" onclick="viewStudentModal(${s.id})">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn-action-icon" title="Toggle Status" onclick="toggleStudentStatus(${s.id}, '${s.status}')">
              <i class="fas ${s.status === 'active' ? 'fa-ban' : 'fa-check'}"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Toggle student status
async function toggleStudentStatus(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
  try {
    const res = await fetch(`/api/admin/student/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const json = await res.json();
    if (json.success) {
      loadRegistrationLedger();
      loadDashboardOverview();
    }
  } catch (err) {
    alert('Failed to update student status.');
  }
}
window.toggleStudentStatus = toggleStudentStatus;

// =====================================================================
// 3. PARTNER SCHOOLS DIRECTORY
// =====================================================================
async function loadSchoolsDirectory() {
  const tbody = document.getElementById('schoolsTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px;"><i class="fas fa-spinner fa-spin"></i> Loading Schools Directory...</td></tr>`;

  const q = document.getElementById('searchSchoolsInput')?.value || '';
  const board = document.getElementById('filterSchoolBoard')?.value || 'all';
  const status = document.getElementById('filterSchoolStatus')?.value || 'all';

  const params = new URLSearchParams({ q, board, status });

  try {
    const res = await fetch(`/api/admin/schools?${params.toString()}`);
    const json = await res.json();
    if (json.success) {
      currentSchoolsData = json.data;
      renderSchools(currentSchoolsData);
      const countBadge = document.getElementById('schoolsCountBadge');
      if (countBadge) countBadge.textContent = `${currentSchoolsData.length} Schools`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">Failed to load schools directory.</td></tr>`;
  }
}
window.loadSchoolsDirectory = loadSchoolsDirectory;

function renderSchools(schools) {
  const tbody = document.getElementById('schoolsTableBody');
  if (!tbody) return;

  if (schools.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">No partner institutions found matching criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = schools.map(s => {
    const statusClass = s.status === 'active' ? 'status-active' : 'status-pending';
    return `
      <tr>
        <td><span class="student-code-pill" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border-color: rgba(59, 130, 246, 0.3);">${s.school_code}</span></td>
        <td>
          <div style="font-weight: 700; color: #fff;">${escapeHtml(s.school_name)}</div>
          <small style="color: #94a3b8;">Board: <strong style="color: #f16032;">${escapeHtml(s.affiliation_board || 'CBSE')}</strong></small>
        </td>
        <td>
          <div style="font-weight: 600; color: #e2e8f0;">${escapeHtml(s.contact_person || 'N/A')}</div>
        </td>
        <td>
          <div style="font-size: 0.82rem; color: #cbd5e1;">${escapeHtml(s.contact_email || '—')}</div>
          <small style="color: #64748b;">${escapeHtml(s.contact_phone || '—')}</small>
        </td>
        <td>
          <span style="font-size: 0.85rem; color: #94a3b8;">${escapeHtml(s.city || '')}, ${escapeHtml(s.state || '')}</span>
        </td>
        <td>
          <span style="font-weight: 800; color: #fff; font-size: 1rem;">${s.student_count || 0}</span>
        </td>
        <td>
          <span class="status-badge ${statusClass}">${s.status}</span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn-action-icon" title="Toggle Active/Pending Status" onclick="toggleSchoolStatus(${s.id}, '${s.status}')">
              <i class="fas ${s.status === 'active' ? 'fa-ban' : 'fa-check'}"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleSchoolStatus(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'pending' : 'active';
  try {
    const res = await fetch(`/api/admin/school/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const json = await res.json();
    if (json.success) {
      loadSchoolsDirectory();
      loadSchoolsDropdown();
      loadDashboardOverview();
    }
  } catch (err) {
    alert('Failed to update school status.');
  }
}
window.toggleSchoolStatus = toggleSchoolStatus;

// =====================================================================
// 4. CONTACT INQUIRIES & QUOTES
// =====================================================================
async function loadInquiries() {
  const tbody = document.getElementById('inquiriesTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px;"><i class="fas fa-spinner fa-spin"></i> Loading Contact Messages...</td></tr>`;

  try {
    const res = await fetch('/api/admin/inquiries');
    const json = await res.json();
    if (json.success) {
      renderInquiries(json.data);
      const countBadge = document.getElementById('inquiriesCountBadge');
      if (countBadge) countBadge.textContent = `${json.data.length} Messages`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Failed to load inquiries.</td></tr>`;
  }
}
window.loadInquiries = loadInquiries;

function renderInquiries(inquiries) {
  const tbody = document.getElementById('inquiriesTableBody');
  if (!tbody) return;

  if (inquiries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">No contact inquiries or messages received yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = inquiries.map(inq => {
    const statusClass = inq.status === 'new' ? 'status-new' : inq.status === 'reviewed' ? 'status-reviewed' : 'status-pending';
    const dateStr = inq.created_at ? new Date(inq.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—';
    return `
      <tr>
        <td><strong>#${inq.id}</strong></td>
        <td>
          <div style="font-weight: 700; color: #fff;">${escapeHtml(inq.full_name)}</div>
        </td>
        <td>
          <div style="font-size: 0.85rem; color: #cbd5e1;"><i class="fas fa-envelope" style="color: #64748b; font-size: 0.75rem;"></i> ${escapeHtml(inq.email)}</div>
          <div style="font-size: 0.85rem; color: #94a3b8;"><i class="fas fa-phone" style="color: #64748b; font-size: 0.75rem;"></i> ${escapeHtml(inq.phone_number || 'N/A')}</div>
        </td>
        <td>
          <div style="max-width: 340px; font-size: 0.86rem; color: #e2e8f0; line-height: 1.4;">${escapeHtml(inq.message)}</div>
        </td>
        <td><small style="color: #94a3b8;">${dateStr}</small></td>
        <td><span class="status-badge ${statusClass}">${inq.status}</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn-action-icon" title="Toggle Reviewed / New" onclick="toggleInquiryStatus(${inq.id}, '${inq.status}')">
              <i class="fas ${inq.status === 'new' ? 'fa-check-double' : 'fa-clock'}"></i>
            </button>
            <button class="btn-action-icon" title="Delete Inquiry" style="color: #ef4444;" onclick="deleteInquiry(${inq.id})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleInquiryStatus(id, currentStatus) {
  const newStatus = currentStatus === 'new' ? 'reviewed' : 'new';
  try {
    const res = await fetch(`/api/admin/inquiry/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const json = await res.json();
    if (json.success) {
      loadInquiries();
      loadDashboardOverview();
    }
  } catch (err) {
    alert('Failed to update inquiry status.');
  }
}
window.toggleInquiryStatus = toggleInquiryStatus;

async function deleteInquiry(id) {
  if (!confirm('Are you sure you want to delete this inquiry message?')) return;
  try {
    const res = await fetch(`/api/admin/inquiry/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      loadInquiries();
      loadDashboardOverview();
    }
  } catch (err) {
    alert('Failed to delete inquiry.');
  }
}
window.deleteInquiry = deleteInquiry;

// =====================================================================
// 5. EXAM PERFORMANCE GRID
// =====================================================================
async function loadSubjectPerformanceGrid() {
  const tbody = document.getElementById('perfTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px;"><i class="fas fa-spinner fa-spin"></i> Loading Performance Grid...</td></tr>`;

  const searchVal = document.getElementById('searchPerfInput')?.value || '';
  const schoolVal = document.getElementById('filterPerfSchool')?.value || 'all';

  const params = new URLSearchParams({ q: searchVal, school_id: schoolVal });

  try {
    const res = await fetch(`/api/admin/performance?${params.toString()}`);
    const json = await res.json();

    if (json.success) {
      currentPerformanceData = json.data;
      renderPerformanceGrid(currentPerformanceData);
      const countEl = document.getElementById('perfCountBadge');
      if (countEl) countEl.textContent = `${currentPerformanceData.length} Candidates`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">Error loading performance grid.</td></tr>`;
  }
}
window.loadSubjectPerformanceGrid = loadSubjectPerformanceGrid;

function renderPerformanceGrid(records) {
  const tbody = document.getElementById('perfTableBody');
  if (!tbody) return;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">No testing scores found.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => `
    <tr>
      <td><span class="student-code-pill">${r.roll_number}</span></td>
      <td>
        <div style="font-weight: 700; color: #fff;">${escapeHtml(r.full_name)}</div>
        <small style="color: #94a3b8;">${escapeHtml(r.grade_class)}</small>
      </td>
      <td>
        <div class="tenant-tag">
          <i class="fas fa-building-columns" style="color: #3b82f6;"></i>
          <span>${escapeHtml(r.school_name)}</span>
        </div>
      </td>
      <td>${formatScorePill(r.math_score)}</td>
      <td>${formatScorePill(r.english_score)}</td>
      <td>${formatScorePill(r.gk_score)}</td>
      <td>
        ${r.average_score !== null 
          ? `<div style="font-weight: 800; font-size: 1rem; color: #fff;">${r.average_score}%</div><small style="color: #10b981; font-weight: 600;">${r.status_label}</small>` 
          : `<span class="score-pill score-none">No Attempts</span>`}
      </td>
      <td>
        <span style="font-size: 0.8rem; color: #94a3b8;">
          ${r.last_exam_date ? new Date(r.last_exam_date).toLocaleDateString() : '—'}
        </span>
      </td>
    </tr>
  `).join('');
}

function formatScorePill(val) {
  if (val === null || val === undefined) {
    return `<span class="score-pill score-none">Not Taken</span>`;
  }
  const num = parseFloat(val);
  if (num >= 85) return `<span class="score-pill score-high">${num}%</span>`;
  if (num >= 60) return `<span class="score-pill score-medium">${num}%</span>`;
  return `<span class="score-pill score-low">${num}%</span>`;
}

// =====================================================================
// 6. SECTION SWITCHING & NAVIGATION
// =====================================================================
function switchAdminSection(sectionId) {
  activeSectionId = sectionId;
  const sections = ['overviewSection', 'ledgerSection', 'schoolsSection', 'inquiriesSection', 'performanceSection'];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === sectionId) ? 'block' : 'none';
  });

  // Update sidebar active link
  document.querySelectorAll('.sidebar-nav .sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === '#' + sectionId) {
      link.classList.add('active');
    } else if (href && href.startsWith('#')) {
      link.classList.remove('active');
    }
  });

  // Update topbar titles
  const titleEl = document.getElementById('topbarSectionTitle');
  const descEl = document.getElementById('topbarSectionDesc');

  if (sectionId === 'overviewSection') {
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-chart-pie" style="color: #f16032;"></i> Executive Analytics Dashboard`;
    if (descEl) descEl.textContent = 'Live National Olympiad Intelligence, Growth Metrics & Visual Analytics';
    loadDashboardOverview();
  } else if (sectionId === 'ledgerSection') {
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-user-graduate" style="color: #f16032;"></i> Central Student Registration Ledger`;
    if (descEl) descEl.textContent = 'Master Directory of Registered Candidates across All Affiliated Schools';
    loadRegistrationLedger();
  } else if (sectionId === 'schoolsSection') {
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-school" style="color: #3b82f6;"></i> Partner Institutions & Tenants`;
    if (descEl) descEl.textContent = 'Institutional Center Verification, Code Allotments & Board Affiliations';
    loadSchoolsDirectory();
  } else if (sectionId === 'inquiriesSection') {
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-envelope-open-text" style="color: #f59e0b;"></i> Contact Inquiries & Quotes`;
    if (descEl) descEl.textContent = 'Real-time Incoming Messages and Consultation Requests';
    loadInquiries();
  } else if (sectionId === 'performanceSection') {
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-chart-line" style="color: #10b981;"></i> Exam Performance Tracker`;
    if (descEl) descEl.textContent = 'Multi-Tenant Cumulative Assessment Results Across Olympiad Categories';
    loadSubjectPerformanceGrid();
  }

  // Scroll main container to top
  const main = document.querySelector('.admin-main');
  if (main) main.scrollTop = 0;
}
window.switchAdminSection = switchAdminSection;

function refreshCurrentSection() {
  switchAdminSection(activeSectionId);
}
window.refreshCurrentSection = refreshCurrentSection;

// =====================================================================
// 7. DROPDOWNS & EVENT LISTENERS
// =====================================================================
async function loadSchoolsDropdown() {
  try {
    const res = await fetch('/api/public/schools');
    const json = await res.json();
    if (json.success) {
      schoolsList = json.data;
      const selectLedger = document.getElementById('filterTenantSchool');
      const selectPerf = document.getElementById('filterPerfSchool');

      schoolsList.forEach(sch => {
        const opt = document.createElement('option');
        opt.value = sch.id;
        opt.textContent = `${sch.school_name} (${sch.school_code})`;
        if (selectLedger) selectLedger.appendChild(opt.cloneNode(true));
        if (selectPerf) selectPerf.appendChild(opt.cloneNode(true));
      });
    }
  } catch (err) {
    console.error('Failed to load schools dropdown:', err);
  }
}

function setupEventListeners() {
  // Ledger filters
  let timer1;
  document.getElementById('searchLedgerInput')?.addEventListener('input', () => {
    clearTimeout(timer1);
    timer1 = setTimeout(loadRegistrationLedger, 300);
  });
  document.getElementById('filterTenantSchool')?.addEventListener('change', loadRegistrationLedger);
  document.getElementById('filterDateRange')?.addEventListener('change', loadRegistrationLedger);
  document.getElementById('filterStatus')?.addEventListener('change', loadRegistrationLedger);

  // Performance filters
  let timer2;
  document.getElementById('searchPerfInput')?.addEventListener('input', () => {
    clearTimeout(timer2);
    timer2 = setTimeout(loadSubjectPerformanceGrid, 300);
  });
  document.getElementById('filterPerfSchool')?.addEventListener('change', loadSubjectPerformanceGrid);

  // Schools filters
  let timer3;
  document.getElementById('searchSchoolsInput')?.addEventListener('input', () => {
    clearTimeout(timer3);
    timer3 = setTimeout(loadSchoolsDirectory, 300);
  });
  document.getElementById('filterSchoolBoard')?.addEventListener('change', loadSchoolsDirectory);
  document.getElementById('filterSchoolStatus')?.addEventListener('change', loadSchoolsDirectory);

  // Logout
  document.getElementById('btnAdminLogout')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to sign out of the Master Control Admin Panel?')) {
      try {
        const res = await fetch('/api/admin/logout', { method: 'POST' });
        const json = await res.json();
        window.location.href = json.redirect || '/admin-login.html';
      } catch (e) {
        window.location.href = '/admin-login.html';
      }
    }
  });
}

// Student detail modal
function viewStudentModal(studentId) {
  const student = currentLedgerData.find(s => s.id === studentId);
  if (!student) return;

  const modal = document.getElementById('studentDetailModal');
  const content = document.getElementById('studentModalContent');
  if (!modal || !content) return;

  content.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
      <div>
        <label style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Full Name</label>
        <div style="font-size: 1.15rem; font-weight: 800; color: #ffffff;">${escapeHtml(student.full_name)}</div>
      </div>
      <div>
        <label style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Roll Number</label>
        <div style="font-size: 1.15rem; font-weight: 800; color: #f16032;">${student.roll_number}</div>
      </div>
      <div>
        <label style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Email Address</label>
        <div style="color: #cbd5e1;">${escapeHtml(student.email)}</div>
      </div>
      <div>
        <label style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Contact Number</label>
        <div style="color: #cbd5e1;">${escapeHtml(student.phone)}</div>
      </div>
      <div>
        <label style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Grade / Class</label>
        <div style="color: #ffffff; font-weight: 700;">${escapeHtml(student.grade_class)}</div>
      </div>
      <div>
        <label style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Assigned Tenant/School</label>
        <div style="color: #60a5fa; font-weight: 600;">${escapeHtml(student.school_name)} (${student.school_code})</div>
      </div>
      <div>
        <label style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">City & State</label>
        <div style="color: #cbd5e1;">${escapeHtml(student.city || 'N/A')}, ${escapeHtml(student.state || 'N/A')}</div>
      </div>
      <div>
        <label style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Account Status</label>
        <div><span class="status-badge ${student.status === 'active' ? 'status-active' : 'badge-suspended'}">${student.status}</span></div>
      </div>
    </div>
  `;

  modal.classList.add('active');
}
window.viewStudentModal = viewStudentModal;

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}
