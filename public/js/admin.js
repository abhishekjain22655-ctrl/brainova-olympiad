// =====================================================================
// BRAINOVA NATIONAL OLYMPIAD - MASTER CONTROL ADMIN CONTROLLER
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Check if current user is admin or load directly
  initAdminDashboard();
});

let currentLedgerData = [];
let currentPerformanceData = [];
let schoolsList = [];

async function initAdminDashboard() {
  loadMetrics();
  loadSchoolsDropdown();
  loadRegistrationLedger();
  loadSubjectPerformanceGrid();
  setupEventListeners();
}

// 1. Fetch Global Metrics
async function loadMetrics() {
  try {
    const res = await fetch('/api/admin/metrics');
    const json = await res.json();
    if (json.success) {
      const data = json.data;
      document.getElementById('metricTotalStudents').textContent = data.total_students.toLocaleString();
      document.getElementById('metricTotalSchools').textContent = data.total_schools.toLocaleString();
      document.getElementById('metricTotalExams').textContent = data.total_exams_taken.toLocaleString();
      document.getElementById('metricAvgScore').textContent = `${data.average_score_pct}%`;
      document.getElementById('metricPassRate').textContent = `${data.pass_rate_pct}%`;
    }
  } catch (err) {
    console.error('Failed to load metrics:', err);
  }
}

// 2. Fetch Schools for Filter Dropdown
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

// 3. Load Central Interactive Registration Ledger
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
      document.getElementById('ledgerCountBadge').textContent = `${currentLedgerData.length} Registered`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">Error loading registration records.</td></tr>`;
  }
}

function renderLedger(students) {
  const tbody = document.getElementById('ledgerTableBody');
  if (!tbody) return;

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">No student records found matching the current criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    const statusClass = s.status === 'active' ? 'badge-active' : s.status === 'pending' ? 'badge-pending' : 'badge-suspended';
    const lastLoginFormatted = s.last_login ? new Date(s.last_login).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Never';
    const createdFormatted = new Date(s.created_at).toLocaleDateString();

    return `
      <tr>
        <td><span class="student-code-pill">${s.roll_number}</span></td>
        <td>
          <div style="font-weight: 700; color: #1e1b4b;">${escapeHtml(s.full_name)}</div>
          <div style="font-size: 0.8rem; color: #64748b;">${escapeHtml(s.email)} • ${s.phone}</div>
        </td>
        <td><span style="font-weight: 600;">${escapeHtml(s.grade_class)}</span></td>
        <td>
          <div class="tenant-tag">
            <i class="fas fa-school"></i>
            <div>
              <div>${escapeHtml(s.school_name)}</div>
              <small style="color: #64748b; font-size: 0.75rem;">${s.school_code}</small>
            </div>
          </div>
        </td>
        <td>
          <div style="font-size: 0.85rem; font-weight: 600;">${lastLoginFormatted}</div>
          <small style="color: #94a3b8; font-size: 0.75rem;">Registered: ${createdFormatted}</small>
        </td>
        <td>
          <span class="badge-status ${statusClass}">${s.status}</span>
        </td>
        <td>
          <span style="font-weight: 700; color: #1e1b4b;">${s.exams_taken}</span>
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

// 4. Load Subject Grid Performance (Multi-Tenant Score Tracker across Maths, English, GK)
async function loadSubjectPerformanceGrid() {
  const tbody = document.getElementById('perfTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px;"><i class="fas fa-spinner fa-spin"></i> Loading Performance Grid...</td></tr>`;

  const searchVal = document.getElementById('searchPerfInput')?.value || '';
  const schoolVal = document.getElementById('filterPerfSchool')?.value || 'all';

  const params = new URLSearchParams({
    q: searchVal,
    school_id: schoolVal
  });

  try {
    const res = await fetch(`/api/admin/performance?${params.toString()}`);
    const json = await res.json();

    if (json.success) {
      currentPerformanceData = json.data;
      renderPerformanceGrid(currentPerformanceData);
      document.getElementById('perfCountBadge').textContent = `${currentPerformanceData.length} Candidates`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">Error loading performance grid.</td></tr>`;
  }
}

function renderPerformanceGrid(records) {
  const tbody = document.getElementById('perfTableBody');
  if (!tbody) return;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">No testing scores found.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => {
    return `
      <tr>
        <td><span class="student-code-pill">${r.roll_number}</span></td>
        <td>
          <div style="font-weight: 700; color: #1e1b4b;">${escapeHtml(r.full_name)}</div>
          <small style="color: #64748b;">${escapeHtml(r.grade_class)}</small>
        </td>
        <td>
          <div class="tenant-tag">
            <i class="fas fa-building-columns"></i>
            <span>${escapeHtml(r.school_name)}</span>
          </div>
        </td>
        <td>${formatScorePill(r.math_score)}</td>
        <td>${formatScorePill(r.english_score)}</td>
        <td>${formatScorePill(r.gk_score)}</td>
        <td>
          ${r.average_score !== null 
            ? `<div style="font-weight: 800; font-size: 1rem; color: #1e1b4b;">${r.average_score}%</div><small style="color: #10b981; font-weight: 600;">${r.status_label}</small>` 
            : `<span class="score-pill score-none">No Attempts</span>`}
        </td>
        <td>
          <span style="font-size: 0.8rem; color: #64748b;">
            ${r.last_exam_date ? new Date(r.last_exam_date).toLocaleDateString() : '—'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
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

// 5. Unified Controls & Event Listeners
function setupEventListeners() {
  // Real-time search debouncing for Ledger
  let timer1;
  const searchLedger = document.getElementById('searchLedgerInput');
  if (searchLedger) {
    searchLedger.addEventListener('input', () => {
      clearTimeout(timer1);
      timer1 = setTimeout(loadRegistrationLedger, 300);
    });
  }

  // Filters
  document.getElementById('filterTenantSchool')?.addEventListener('change', loadRegistrationLedger);
  document.getElementById('filterDateRange')?.addEventListener('change', loadRegistrationLedger);
  document.getElementById('filterStatus')?.addEventListener('change', loadRegistrationLedger);

  // Performance search
  let timer2;
  const searchPerf = document.getElementById('searchPerfInput');
  if (searchPerf) {
    searchPerf.addEventListener('input', () => {
      clearTimeout(timer2);
      timer2 = setTimeout(loadSubjectPerformanceGrid, 300);
    });
  }
  document.getElementById('filterPerfSchool')?.addEventListener('change', loadSubjectPerformanceGrid);

  // CSV Export Button
  const btnExport = document.getElementById('btnExportLedgerCSV');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const schoolVal = document.getElementById('filterTenantSchool')?.value || 'all';
      const dateVal = document.getElementById('filterDateRange')?.value || 'all';
      window.location.href = `/api/admin/export-csv?type=full_ledger&school_id=${schoolVal}&date_range=${dateVal}`;
    });
  }

  const btnExportPerf = document.getElementById('btnExportPerfCSV');
  if (btnExportPerf) {
    btnExportPerf.addEventListener('click', () => {
      window.location.href = `/api/admin/export-csv?type=performance`;
    });
  }
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
    }
  } catch (err) {
    alert('Failed to update status.');
  }
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
        <label style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Full Name</label>
        <div style="font-size: 1.1rem; font-weight: 700; color: #1e1b4b;">${escapeHtml(student.full_name)}</div>
      </div>
      <div>
        <label style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Roll Number</label>
        <div style="font-size: 1.1rem; font-weight: 700; color: #f16032;">${student.roll_number}</div>
      </div>
      <div>
        <label style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Email Address</label>
        <div>${escapeHtml(student.email)}</div>
      </div>
      <div>
        <label style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Contact Number</label>
        <div>${escapeHtml(student.phone)}</div>
      </div>
      <div>
        <label style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Grade / Class</label>
        <div>${escapeHtml(student.grade_class)}</div>
      </div>
      <div>
        <label style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Assigned Tenant/School</label>
        <div>${escapeHtml(student.school_name)} (${student.school_code})</div>
      </div>
      <div>
        <label style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">City & State</label>
        <div>${escapeHtml(student.city || 'N/A')}, ${escapeHtml(student.state || 'N/A')}</div>
      </div>
      <div>
        <label style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Account Status</label>
        <div><span class="badge-status ${student.status === 'active' ? 'badge-active' : 'badge-suspended'}">${student.status}</span></div>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}
