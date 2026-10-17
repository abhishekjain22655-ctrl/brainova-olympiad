// =====================================================================
// BRAINOVA NATIONAL OLYMPIAD - AUTHENTICATION CONTROLLER
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
  initRegistrationTabs();
  initSchoolsDropdown();
  initForms();
  initDemoCredentials();
});

// 1. Dual-Tab Registration Switcher
function initRegistrationTabs() {
  const tabStudent = document.getElementById('tabBtnStudent');
  const tabSchool = document.getElementById('tabBtnSchool');
  const formStudent = document.getElementById('studentRegistrationForm');
  const formSchool = document.getElementById('schoolRegistrationForm');

  if (tabStudent && tabSchool) {
    tabStudent.addEventListener('click', () => {
      tabStudent.classList.add('active');
      tabSchool.classList.remove('active');
      if (formStudent) formStudent.style.display = 'block';
      if (formSchool) formSchool.style.display = 'none';
    });

    tabSchool.addEventListener('click', () => {
      tabSchool.classList.add('active');
      tabStudent.classList.remove('active');
      if (formStudent) formStudent.style.display = 'none';
      if (formSchool) formSchool.style.display = 'block';
    });

    // Check URL parameters: register.html?type=school
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('type') === 'school') {
      tabSchool.click();
    }
  }

  // Login page tabs (Student Login vs School Login)
  const tabLoginStudent = document.getElementById('tabLoginStudent');
  const tabLoginSchool = document.getElementById('tabLoginSchool');
  const hiddenLoginType = document.getElementById('hiddenLoginType');

  if (tabLoginStudent && tabLoginSchool) {
    tabLoginStudent.addEventListener('click', () => {
      tabLoginStudent.classList.add('active');
      tabLoginSchool.classList.remove('active');
      if (hiddenLoginType) hiddenLoginType.value = 'student';
      document.getElementById('loginIdentLabel').textContent = 'Roll Number or Registered Email';
      document.getElementById('loginUsernameInput').placeholder = 'Enter Roll Number or Email';
    });

    tabLoginSchool.addEventListener('click', () => {
      tabLoginSchool.classList.add('active');
      tabLoginStudent.classList.remove('active');
      if (hiddenLoginType) hiddenLoginType.value = 'school';
      document.getElementById('loginIdentLabel').textContent = 'School Code or Institutional Email';
      document.getElementById('loginUsernameInput').placeholder = 'Enter School Code or Email';
    });
  }
}

// 2. Load Schools for Tenant Dropdown
async function initSchoolsDropdown() {
  const select = document.getElementById('studentSchoolSelect');
  if (!select) return;

  try {
    const res = await fetch('/api/public/schools');
    const json = await res.json();
    if (json.success && json.data) {
      json.data.forEach(sch => {
        const opt = document.createElement('option');
        opt.value = sch.id;
        opt.textContent = `${sch.school_name} (${sch.city}, ${sch.affiliation_board})`;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Failed to load schools for dropdown:', err);
  }
}

// 3. Form Handlers
function initForms() {
  // Student Registration Form
  const studentForm = document.getElementById('studentRegistrationForm');
  if (studentForm) {
    studentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = studentForm.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering Candidate...';

      const formData = new FormData(studentForm);
      const payload = Object.fromEntries(formData.entries());

      try {
        const res = await fetch('/api/auth/register-student', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success) {
          localStorage.setItem('brainova_token', json.data.token);
          localStorage.setItem('brainova_user', JSON.stringify(json.data));
          openSuccessModal({
            title: 'Registration Successful!',
            message: `Congratulations <strong>${json.data.full_name}</strong>! Your account has been verified.`,
            roll: json.data.roll_number,
            redirectUrl: '/subjects.html'
          });
        } else {
          showNotification(json.message || 'Registration failed.', 'error');
        }
      } catch (err) {
        showNotification('Connection error during registration.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  }

  // School Registration Form
  const schoolForm = document.getElementById('schoolRegistrationForm');
  if (schoolForm) {
    schoolForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = schoolForm.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Onboarding Institution...';

      const formData = new FormData(schoolForm);
      const payload = Object.fromEntries(formData.entries());

      try {
        const res = await fetch('/api/auth/register-school', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success) {
          localStorage.setItem('brainova_token', json.data.token);
          localStorage.setItem('brainova_user', JSON.stringify(json.data));
          openSuccessModal({
            title: 'Institutional Onboarding Complete!',
            message: `School tenant <strong>${json.data.school_name}</strong> registered successfully.`,
            roll: json.data.school_code,
            redirectUrl: '/admin'
          });
        } else {
          showNotification(json.message || 'School registration failed.', 'error');
        }
      } catch (err) {
        showNotification('Connection error during institutional onboarding.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  }

  // Unified Login Form
  const loginForm = document.getElementById('unifiedLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = loginForm.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';

      const formData = new FormData(loginForm);
      const payload = Object.fromEntries(formData.entries());

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success) {
          localStorage.setItem('brainova_token', json.token);
          localStorage.setItem('brainova_user', JSON.stringify(json.user));
          showNotification('Login successful! Redirecting...', 'success');

          setTimeout(() => {
            if (json.role === 'admin' || json.role === 'school') {
              window.location.href = '/admin';
            } else {
              window.location.href = '/subjects.html';
            }
          }, 800);
        } else {
          showNotification(json.message || 'Invalid credentials.', 'error');
        }
      } catch (err) {
        showNotification('Login connection error.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  }
}

// 4. One-Click Evaluator Demo Credentials
function initDemoCredentials() {
  window.fillDemo = (role) => {
    const userInput = document.getElementById('loginUsernameInput');
    const passInput = document.getElementById('loginPasswordInput');
    const tabStudent = document.getElementById('tabLoginStudent');
    const tabSchool = document.getElementById('tabLoginSchool');

    if (!userInput || !passInput) return;

    if (role === 'admin') {
      userInput.value = 'admin@brainova.com';
      passInput.value = 'Admin@2026';
      showNotification('Filled Master Admin credentials.', 'info');
    } else if (role === 'student') {
      if (tabStudent) tabStudent.click();
      userInput.value = 'aarav.sharma@gmail.com';
      passInput.value = 'Brainova@2026';
      showNotification('Filled Student credentials (Aarav Sharma).', 'info');
    } else if (role === 'school') {
      if (tabSchool) tabSchool.click();
      userInput.value = 'principal@dpsrkp.net';
      passInput.value = 'Brainova@2026';
      showNotification('Filled School Tenant credentials (DPS R.K. Puram).', 'info');
    }
  };
}

function openSuccessModal({ title, message, roll, redirectUrl }) {
  const overlay = document.getElementById('regSuccessModal');
  if (!overlay) {
    alert(`${title}\n${message}\nIdentifier: ${roll}`);
    window.location.href = redirectUrl;
    return;
  }

  document.getElementById('successModalTitle').textContent = title;
  document.getElementById('successModalMessage').innerHTML = message;
  document.getElementById('successModalId').textContent = roll;

  document.getElementById('btnSuccessRedirect').onclick = () => {
    window.location.href = redirectUrl;
  };

  overlay.classList.add('active');
}
