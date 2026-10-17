const fs = require('fs');
const path = require('path');

async function testAll() {
  const pages = [
    'index.html', 'olympiads.html', 'science-olympiad.html', 'math-olympiad.html',
    'english-olympiad.html', 'gk-olympiad.html', 'computer-olympiad.html',
    'olympiads-details.html', 'olympaid-fee-structure.html', 'olympiad-schedule.html',
    'olympiad-exam-pattern.html', 'olympiad-ranking.html', 'about-us.html',
    'contact-us.html', 'login.html', 'register.html'
  ];
  
  const missing = [];
  const checked = new Set();

  for (const page of pages) {
    const file = path.join(__dirname, '../public', page);
    if (!fs.existsSync(file)) {
      console.log('Missing page:', page);
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    const regex = /(?:src|href|url\()=["']?([^"'\)\s]+\.(?:png|jpg|jpeg|svg|webp|gif|css|js))(?:\?[^"'\)\s]*)?["']?/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      let p = match[1];
      if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) continue;
      if (p.startsWith('/')) p = p.slice(1);
      
      const localP = path.join(__dirname, '../public', p);
      if (!checked.has(localP)) {
        checked.add(localP);
        if (!fs.existsSync(localP)) {
          missing.push({ page, asset: match[1], localP });
        }
      }
    }
  }

  console.log(`Total local assets checked: ${checked.size}`);
  console.log(`Total missing assets: ${missing.length}`);
  if (missing.length > 0) {
    console.log('Missing asset list:');
    missing.forEach(m => console.log(`  [${m.page}] ${m.asset}`));
  }
}

testAll();
