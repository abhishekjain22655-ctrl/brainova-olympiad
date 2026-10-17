// =====================================================================
// BRAINOVA NATIONAL OLYMPIAD - CLIENT MAIN CONTROLLER
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Remove Preloader
  const preloader = document.getElementById('preloader');
  if (preloader) {
    setTimeout(() => {
      preloader.classList.add('fade-out');
    }, 450);
  }

  // 2. Animated Numerical Counters
  const counters = document.querySelectorAll('.stat-number');
  const speed = 1500; // ms

  const runCounter = (el) => {
    const target = parseInt(el.getAttribute('data-target') || '0', 10);
    const suffix = el.getAttribute('data-suffix') || '';
    const startTime = performance.now();

    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / speed, 1);
      // easeOutQuad
      const current = Math.floor(target * (progress * (2 - progress)));
      el.textContent = current.toLocaleString() + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target.toLocaleString() + suffix;
      }
    };

    requestAnimationFrame(update);
  };

  // Intersection observer for counters
  if ('IntersectionObserver' in window && counters.length > 0) {
    const counterObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          runCounter(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    counters.forEach(c => counterObserver.observe(c));
  } else {
    counters.forEach(c => runCounter(c));
  }

  // 3. Quick Quote Modal Handlers
  const quoteModal = document.getElementById('quoteModal');
  const openModalBtns = document.querySelectorAll('.btn-open-quote');
  const closeModalBtns = document.querySelectorAll('.btn-close-modal');

  openModalBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (quoteModal) quoteModal.classList.add('active');
    });
  });

  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (quoteModal) quoteModal.classList.remove('active');
    });
  });

  if (quoteModal) {
    quoteModal.addEventListener('click', (e) => {
      if (e.target === quoteModal) {
        quoteModal.classList.remove('active');
      }
    });
  }

  // 4. Contact / Quote Form Submission
  const quoteForm = document.getElementById('quoteForm');
  if (quoteForm) {
    quoteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = quoteForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

      const formData = new FormData(quoteForm);
      const payload = {
        name: formData.get('name'),
        phone_number: formData.get('phone_number'),
        email: formData.get('email'),
        message: formData.get('message')
      };

      try {
        const res = await fetch('/api/public/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
          showNotification(data.message, 'success');
          quoteForm.reset();
          if (quoteModal) quoteModal.classList.remove('active');
        } else {
          showNotification(data.message || 'Error submitting request.', 'error');
        }
      } catch (err) {
        console.error('Submission failed:', err);
        showNotification('Connection error. Please try again.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // 5. Newsletter Submission
  const newsletterForms = document.querySelectorAll('.newsletter-form');
  newsletterForms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      if (!input || !input.value) return;

      const emailVal = input.value;
      const btn = form.querySelector('button');
      btn.disabled = true;

      try {
        const res = await fetch('/api/public/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newsletter: emailVal })
        });
        const data = await res.json();
        showNotification(data.message, data.success ? 'success' : 'error');
        if (data.success) form.reset();
      } catch (err) {
        showNotification('Unable to subscribe. Please try again.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // 6. Back To Top
  const backToTopBtn = document.getElementById('backToTop');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        backToTopBtn.classList.add('show');
      } else {
        backToTopBtn.classList.remove('show');
      }
    });

    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 7. Mobile Navigation Toggle
  const mobileToggle = document.querySelector('.mobile-toggle');
  const mainNav = document.querySelector('.main-nav');
  if (mobileToggle && mainNav) {
    mobileToggle.addEventListener('click', () => {
      if (mainNav.style.display === 'flex') {
        mainNav.style.display = 'none';
      } else {
        mainNav.style.display = 'flex';
        mainNav.style.flexDirection = 'column';
        mainNav.style.position = 'absolute';
        mainNav.style.top = '100%';
        mainNav.style.left = '0';
        mainNav.style.right = '0';
        mainNav.style.background = '#ffffff';
        mainNav.style.padding = '20px';
        mainNav.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
      }
    });
  }
});

// Helper: Toast Notifications
function showNotification(message, type = 'info') {
  const existing = document.querySelector('.brainova-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `brainova-toast toast-${type}`;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#19124d'};
    color: #ffffff;
    padding: 14px 22px;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.92rem;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    z-index: 999999;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideInToast 0.3s ease;
  `;

  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
  toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
