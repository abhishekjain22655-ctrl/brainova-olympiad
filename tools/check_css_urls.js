const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.brainovanationalolympiad.com/public/assets';

const cssFiles = [
  path.join(__dirname, '../public/public/assets/css/app.css'),
  path.join(__dirname, '../public/public/assets/css/my.css'),
  path.join(__dirname, '../public/public/assets/css/menu_detail.css'),
  path.join(__dirname, '../public/public/assets/css/index.css')
];

const urls = new Set();
for (const file of cssFiles) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const regex = /url\(['"]?([^'")]+)['"]?\)/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    let u = match[1].split('?')[0].split('#')[0];
    if (u.startsWith('data:') || u.startsWith('http')) continue;
    urls.add(u);
  }
}

async function checkAndDownload() {
  console.log(`Checking ${urls.size} CSS internal assets...`);
  for (const u of urls) {
    const local = path.resolve(__dirname, '../public/public/assets/css', u);
    if (!fs.existsSync(local)) {
      console.log(`[MISSING] ${u} -> Attempting download...`);
      // URL relative to /public/assets/css
      // e.g. ../media/hero/hero-bg-2.png -> /public/assets/media/hero/hero-bg-2.png
      let relFromAssets = path.relative(path.join(__dirname, '../public/public/assets'), local).replace(/\\/g, '/');
      let remoteUrl = `${BASE_URL}/${relFromAssets}`;
      
      try {
        const res = await fetch(remoteUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (res.ok) {
          fs.mkdirSync(path.dirname(local), { recursive: true });
          const buf = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(local, buf);
          console.log(`  Successfully downloaded: ${remoteUrl} (${(buf.length/1024).toFixed(1)} KB)`);
        } else {
          console.log(`  Failed (${res.status}): ${remoteUrl}`);
        }
      } catch (err) {
        console.log(`  Error fetching ${remoteUrl}: ${err.message}`);
      }
    } else {
      console.log(`[EXISTS] ${u}`);
    }
  }
}

checkAndDownload();
