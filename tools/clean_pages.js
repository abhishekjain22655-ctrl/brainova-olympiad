const fs = require('fs');
const path = require('path');

const pages = [
  'index.html', 'olympiads.html', 'science-olympiad.html', 'math-olympiad.html',
  'english-olympiad.html', 'gk-olympiad.html', 'computer-olympiad.html',
  'olympiads-details.html', 'olympaid-fee-structure.html', 'olympiad-schedule.html',
  'olympiad-exam-pattern.html', 'olympiad-ranking.html', 'about-us.html',
  'contact-us.html', 'login.html', 'register.html'
];

let cleanedCount = 0;

for (const p of pages) {
  const file = path.join(__dirname, '../public', p);
  if (!fs.existsSync(file)) continue;

  let html = fs.readFileSync(file, 'utf8');

  // Remove the injected banner block if present
  const bannerRegex = /<div style="background:#110d33; color:#fff; text-align:center;[\s\S]*?Live Mock Exam Engine<\/a>\s*<\/div>/gi;
  if (bannerRegex.test(html)) {
    html = html.replace(bannerRegex, '');
    fs.writeFileSync(file, html, 'utf8');
    cleanedCount++;
    console.log(`Cleaned banner from ${p}`);
  }
}

console.log(`Finished! Cleaned banner from ${cleanedCount} pages.`);
