const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');

// List of HTML files to update
const htmlFiles = [
  'index.html',
  'olympiads.html',
  'science-olympiad.html',
  'math-olympiad.html',
  'english-olympiad.html',
  'gk-olympiad.html',
  'computer-olympiad.html',
  'olympiads-details.html',
  'olympaid-fee-structure.html',
  'olympiad-schedule.html',
  'olympiad-exam-pattern.html',
  'olympiad-ranking.html',
  'about-us.html',
  'contact-us.html',
  'register.html',
  'login.html',
  'gallery.html',
  'blog.html',
  'privacy-policy.html',
  'terms-and-conditions.html'
];

const topbarAddition = `
                    <a href="/admin"
                        class="btn reg-class" style="background:#19124d; border:1px solid rgba(255,255,255,0.3); color:#fff; font-weight:600;">
                        <i class="fa-solid fa-gauge me-1" style="color:#f16032;"></i> Admin Portal
                    </a>

                    <a href="/exam.html"
                        class="btn reg-class" style="background:#f16032; border:1px solid #f16032; color:#fff; font-weight:600;">
                        <i class="fa-solid fa-laptop-code me-1"></i> Online Exam
                    </a>
`;

const menuExamItem = `
                         <li>
                             <a href="/exam.html" title="ONLINE EXAM" style="color: #f16032; font-weight: 700;">
                                 <i class="fa-solid fa-laptop-code me-1"></i> ONLINE EXAM
                             </a>
                         </li>
`;

const rightMenuMockBtn = `
                    <a href="/exam.html" class="cus-btn-2 smheight d-none d-lg-inline-flex me-2" style="background:#f16032; border-color:#f16032; color:#fff; line-height:2.4; padding:0 16px;">
                        <span class="btn-text">Take Mock Exam</span>
                        <span>Take Mock Exam</span>
                    </a>
`;

const footerShortcuts = `
                            <li class="mb-12">
                                <a href="/exam.html" style="color:#ffa182; font-weight:600;"><i class="fa-solid fa-laptop-code me-1"></i> Online Exam Room</a>
                            </li>
                            <li class="mb-12">
                                <a href="/admin" style="color:#ffa182; font-weight:600;"><i class="fa-solid fa-gauge me-1"></i> Admin Dashboard</a>
                            </li>
                            <li class="mb-12">
                                <a href="/olympiads.html">Subject Portal</a>
                            </li>
                            <li class="mb-12">
                                <a href="/register.html">Registration (Student / School)</a>
                            </li>
`;

htmlFiles.forEach(file => {
  const filePath = path.join(publicDir, file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add Admin & Online Exam to topbar if not present
  if (!content.includes('href="/admin"') && content.includes('<div class="topbar-one__social">')) {
    content = content.replace(
      '<div class="topbar-one__social">',
      `<div class="topbar-one__social">${topbarAddition}`
    );
  }

  // 2. Add ONLINE EXAM to main menu if not present
  if (!content.includes('title="ONLINE EXAM"') && content.includes('<ul class="main-menu__list">')) {
    // Insert after OLYMPIADS DETAILS
    if (content.includes('title="OLYMPIADS DETAILS"')) {
      const splitIdx = content.indexOf('title="OLYMPIADS DETAILS"');
      const closeLi = content.indexOf('</li>', splitIdx + 200); // after submenu closes
      if (closeLi !== -1) {
        content = content.slice(0, closeLi + 5) + menuExamItem + content.slice(closeLi + 5);
      }
    }
  }

  // 3. Add Take Mock Exam button in main-menu__right if not present
  if (!content.includes('Take Mock Exam') && content.includes('<div class="main-menu__right">')) {
    content = content.replace(
      '<div class="main-menu__right">',
      `<div class="main-menu__right d-flex align-items-center">${rightMenuMockBtn}`
    );
  }

  // 4. Update Footer Quick Links to include Online Exam & Admin
  if (!content.includes('Online Exam Room') && content.includes('<div class="link-block quick-links">')) {
    content = content.replace(
      '<ul class="footer-list list-unstyled">',
      `<ul class="footer-list list-unstyled">${footerShortcuts}`
    );
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Linked portals in:', file);
});

// Update public/index.html hero buttons specifically
const indexPath = path.join(publicDir, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');
if (!indexContent.includes('Explore Olympiads')) {
  indexContent = indexContent.replace(
    /<div class="hero-buttons[\s\S]*?<\/div>/,
    `<div class="hero-buttons d-flex justify-content-xl-start justify-content-center gap-16 mb-48 flex-wrap">
        <a href="/olympiads.html" class="cus-btn">
            <span class="btn-text" style="line-height: 2;">Explore Olympiads</span>
            <span>Explore Olympiads</span>
        </a>
        <a href="/exam.html" class="cus-btn-2" style="background:#f16032; border-color:#f16032; color:#fff;">
            <span class="btn-text" style="line-height: 2;">Take Online Exam</span>
            <span>Take Online Exam</span>
        </a>
        <a href="/admin" class="cus-btn-2" style="background:#19124d; border:1px solid rgba(255,255,255,0.3); color:#fff;">
            <span class="btn-text" style="line-height: 2;">Admin Portal</span>
            <span>Admin Portal</span>
        </a>
    </div>`
  );
  fs.writeFileSync(indexPath, indexContent, 'utf8');
  console.log('Updated index.html hero buttons.');
}

// Update public/admin.html sidebar navigation
const adminPath = path.join(publicDir, 'admin.html');
let adminContent = fs.readFileSync(adminPath, 'utf8');
if (!adminContent.includes('Online Exam Room')) {
  adminContent = adminContent.replace(
    `<a href="/" class="sidebar-link">
          <i class="fa-solid fa-house"></i>
          <span>Public Website</span>
        </a>`,
    `<a href="/" class="sidebar-link">
          <i class="fa-solid fa-house"></i>
          <span>Public Website</span>
        </a>
        <a href="/olympiads.html" class="sidebar-link">
          <i class="fa-solid fa-book-open"></i>
          <span>Subject Portal</span>
        </a>
        <a href="/exam.html" class="sidebar-link">
          <i class="fa-solid fa-laptop-code" style="color: #f16032;"></i>
          <span>Online Exam Room</span>
        </a>
        <a href="/register.html" class="sidebar-link">
          <i class="fa-solid fa-user-plus"></i>
          <span>Registration Portal</span>
        </a>`
  );
  fs.writeFileSync(adminPath, adminContent, 'utf8');
  console.log('Updated admin.html sidebar links.');
}

// Update public/exam.html header navigation
const examPath = path.join(publicDir, 'exam.html');
let examContent = fs.readFileSync(examPath, 'utf8');
if (!examContent.includes('btn-exam-nav')) {
  examContent = examContent.replace(
    `<div class="timer-widget">`,
    `<div style="display: flex; align-items: center; gap: 10px; margin-right: 15px;">
        <a href="/" class="btn-exam-nav" style="color: #fff; text-decoration: none; font-size: 0.8rem; background: rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2);">
          <i class="fa-solid fa-house me-1"></i> Home
        </a>
        <a href="/olympiads.html" class="btn-exam-nav" style="color: #fff; text-decoration: none; font-size: 0.8rem; background: rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2);">
          <i class="fa-solid fa-book me-1"></i> Subjects
        </a>
        <a href="/admin" class="btn-exam-nav" style="color: #ffa182; text-decoration: none; font-size: 0.8rem; background: rgba(241,96,50,0.15); padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(241,96,50,0.3);">
          <i class="fa-solid fa-gauge me-1"></i> Admin
        </a>
      </div>
      <div class="timer-widget">`
  );
  fs.writeFileSync(examPath, examContent, 'utf8');
  console.log('Updated exam.html header navigation.');
}

console.log('All portals successfully linked together!');
