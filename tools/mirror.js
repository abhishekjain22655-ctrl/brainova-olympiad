const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.brainovanationalolympiad.com';
const TARGET_DIR = path.join(__dirname, '../public');

const PAGES = [
  { url: `${BASE_URL}/`, file: 'index.html' },
  { url: `${BASE_URL}/olympiads.html`, file: 'olympiads.html' },
  { url: `${BASE_URL}/science-olympiad.html`, file: 'science-olympiad.html' },
  { url: `${BASE_URL}/math-olympiad.html`, file: 'math-olympiad.html' },
  { url: `${BASE_URL}/english-olympiad.html`, file: 'english-olympiad.html' },
  { url: `${BASE_URL}/gk-olympiad.html`, file: 'gk-olympiad.html' },
  { url: `${BASE_URL}/computer-olympiad.html`, file: 'computer-olympiad.html' },
  { url: `${BASE_URL}/olympiads-details.html`, file: 'olympiads-details.html' },
  { url: `${BASE_URL}/olympaid-fee-structure.html`, file: 'olympaid-fee-structure.html' },
  { url: `${BASE_URL}/olympiad-schedule.html`, file: 'olympiad-schedule.html' },
  { url: `${BASE_URL}/olympiad-exam-pattern.html`, file: 'olympiad-exam-pattern.html' },
  { url: `${BASE_URL}/olympiad-ranking.html`, file: 'olympiad-ranking.html' },
  { url: `${BASE_URL}/about-us.html`, file: 'about-us.html' },
  { url: `${BASE_URL}/contact-us.html`, file: 'contact-us.html' },
  { url: `${BASE_URL}/login.html`, file: 'login.html' },
  { url: `${BASE_URL}/register.html`, file: 'register.html' }
];

const downloadedAssets = new Set();

async function fetchWithRetry(url, asBuffer = false) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return asBuffer ? Buffer.from(await res.arrayBuffer()) : await res.text();
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function downloadAsset(assetUrl) {
  try {
    let cleanUrl = assetUrl.split('?')[0].split('#')[0];
    if (downloadedAssets.has(cleanUrl)) return;
    downloadedAssets.add(cleanUrl);

    // Resolve URL
    let fullUrl = cleanUrl;
    if (cleanUrl.startsWith('//')) {
      fullUrl = 'https:' + cleanUrl;
    } else if (cleanUrl.startsWith('/')) {
      fullUrl = BASE_URL + cleanUrl;
    } else if (!cleanUrl.startsWith('http')) {
      fullUrl = `${BASE_URL}/${cleanUrl}`;
    }

    // Only download from our domain
    if (!fullUrl.includes('brainovanationalolympiad.com')) {
      return;
    }

    const urlObj = new URL(fullUrl);
    let relativePath = decodeURIComponent(urlObj.pathname);
    if (relativePath.startsWith('/')) relativePath = relativePath.slice(1);

    const localFilePath = path.join(TARGET_DIR, relativePath);
    const localDir = path.dirname(localFilePath);

    fs.mkdirSync(localDir, { recursive: true });

    console.log(`Downloading asset: ${relativePath}`);
    const data = await fetchWithRetry(fullUrl, true);
    fs.writeFileSync(localFilePath, data);
  } catch (err) {
    console.warn(`Warning: Could not fetch asset ${assetUrl}: ${err.message}`);
  }
}

async function processPage(page) {
  console.log(`\n========================================`);
  console.log(`Fetching Page: ${page.url} -> ${page.file}`);
  console.log(`========================================`);

  try {
    let html = await fetchWithRetry(page.url);

    // Find all assets in HTML (src, href, background: url(...))
    const assetRegex = /(?:src|href)=["']([^"']+\.(?:css|js|png|jpg|jpeg|svg|webp|ico|gif|woff|woff2|ttf|eot))(?:\?[^"']*)?["']/gi;
    let match;
    const assetsToFetch = [];

    while ((match = assetRegex.exec(html)) !== null) {
      assetsToFetch.push(match[1]);
    }

    // Background images in style attributes
    const bgRegex = /url\(["']?([^"')]+\.(?:png|jpg|jpeg|svg|webp|gif))(?:\?[^"')]+)?["']?\)/gi;
    while ((match = bgRegex.exec(html)) !== null) {
      assetsToFetch.push(match[1]);
    }

    // Download all unique assets for this page
    for (const asset of assetsToFetch) {
      await downloadAsset(asset);
    }

    // Rewrite URLs in HTML so they are local
    // Replace "https://www.brainovanationalolympiad.com/" with "/"
    html = html.replace(/https?:\/\/www\.brainovanationalolympiad\.com\//g, '/');
    html = html.replace(/https?:\/\/brainovanationalolympiad\.com\//g, '/');

    // Inject Admin & Exam Portal quick link in the topbar or header
    const adminLinkSnippet = `
      <div style="background:#110d33; color:#fff; text-align:center; padding:6px 12px; font-size:13px; font-family:sans-serif; display:flex; justify-content:center; gap:20px; align-items:center; border-bottom:1px solid rgba(255,255,255,0.15); z-index:99999; position:relative;">
        <span><strong style="color:#f16032;">Brainova National Olympiad Live Mirror</strong> (Connected to Local Server)</span>
        <a href="/admin" style="background:#f16032; color:#fff; padding:3px 12px; border-radius:4px; text-decoration:none; font-weight:bold;">Master Admin Dashboard</a>
        <a href="/exam.html" style="background:#10b981; color:#fff; padding:3px 12px; border-radius:4px; text-decoration:none; font-weight:bold;">Live Mock Exam Engine</a>
      </div>
    `;

    if (html.includes('<body')) {
      html = html.replace(/<body[^>]*>/i, `$&${adminLinkSnippet}`);
    }

    const outPath = path.join(TARGET_DIR, page.file);
    fs.writeFileSync(outPath, html, 'utf-8');
    console.log(`Saved: ${page.file} (${(html.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error(`Failed to mirror ${page.url}:`, err);
  }
}

async function runMirror() {
  console.log('Starting full 100% clone of www.brainovanationalolympiad.com...');
  fs.mkdirSync(TARGET_DIR, { recursive: true });

  for (const page of PAGES) {
    await processPage(page);
  }

  console.log('\n======================================================');
  console.log(`Mirror complete! Total assets downloaded: ${downloadedAssets.size}`);
  console.log('All pages and original assets saved to public/');
  console.log('======================================================');
}

runMirror();
