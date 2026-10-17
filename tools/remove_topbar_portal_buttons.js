const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const htmlFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

htmlFiles.forEach(file => {
  const filePath = path.join(publicDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 1. Remove Admin Portal button from topbar
  const adminBtnRegex = /\s*<a href="\/admin"[\s\S]*?<\/a>/g;
  if (adminBtnRegex.test(content)) {
    content = content.replace(adminBtnRegex, '');
    changed = true;
  }

  // 2. Remove Online Exam button from topbar
  const examBtnRegex = /\s*<a href="\/exam\.html"\s+class="btn reg-class"[\s\S]*?<\/a>/g;
  if (examBtnRegex.test(content)) {
    content = content.replace(examBtnRegex, '');
    changed = true;
  }

  // 3. Remove ONLINE EXAM from Olympiads dropdown if present
  const examDropdownRegex = /\s*<li>\s*<a href="\/exam\.html" title="ONLINE EXAM"[\s\S]*?<\/li>/g;
  if (examDropdownRegex.test(content)) {
    content = content.replace(examDropdownRegex, '');
    changed = true;
  }

  // 4. Remove Take Mock Exam button from header right
  const mockBtnRegex = /\s*<a href="\/exam\.html" class="cus-btn-2 smheight[\s\S]*?<\/a>/g;
  if (mockBtnRegex.test(content)) {
    content = content.replace(mockBtnRegex, '');
    changed = true;
  }

  // Restore main-menu__right wrapper if it was changed
  content = content.replace('class="main-menu__right d-flex align-items-center"', 'class="main-menu__right"');

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Cleaned header in:", file);
  }
});
