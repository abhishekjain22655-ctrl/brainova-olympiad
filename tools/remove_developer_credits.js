const fs = require('fs');
const path = require('path');

function processDirectory(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== '.git') {
        processDirectory(fullPath);
      }
    } else if (item.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // Pattern 1: Developed by <a ... anushtech ...>...</a>
      const devRegex = /\s*Developed\s+by\s+<a\s+href="https?:\/\/[^"]*anushtech[^"]*"[^>]*>[\s\S]*?<\/a>/gi;
      if (devRegex.test(content)) {
        content = content.replace(devRegex, '');
        changed = true;
      }

      // Pattern 2: any remaining Developed by ... ANUSH TECHNOLOGY
      const anushRegex = /\s*Developed\s+by[\s\S]*?ANUSH\s+TECHNOLOGY[\s\S]*?<\/a>/gi;
      if (anushRegex.test(content)) {
        content = content.replace(anushRegex, '');
        changed = true;
      }

      // Clean extra spaces before </p>
      content = content.replace(/\s+<\/p>/g, '</p>');

      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log("Removed developer credits from:", path.relative(path.join(__dirname, '..'), fullPath));
      }
    } else if (item.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('Teach Me')) {
        content = content.replace(/Template Name: Teach Me/g, 'Project: Brainova National Olympiad');
        content = content.replace(/Teach Me Html Template/g, 'Brainova National Olympiad Stylesheet');
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log("Cleaned template header in:", path.relative(path.join(__dirname, '..'), fullPath));
      }
    }
  }
}

processDirectory(path.join(__dirname, '..', 'public'));
