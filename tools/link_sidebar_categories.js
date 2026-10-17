const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  path.join(__dirname, '..', 'public', 'blog.html'),
  path.join(__dirname, '..', 'public', 'blog', 'why-every-student-should-participate-in-national-olympiad-exams.html'),
  path.join(__dirname, '..', 'public', 'blog', 'brainova-national-olympiad-2026.html')
];

const categoryLinks = [
  { label: 'Industry Trends', pattern: /Industry\s*Trends/i, url: '/blog.html' },
  { label: 'OLYMPIADS DETAILS', pattern: /OLYMPIADS\s*DETAILS/i, url: '/olympiads-details.html' },
  { label: 'OLYMPIADS', pattern: /^OLYMPIADS$/i, url: '/olympiads.html' },
  { label: 'Science Olympiad', pattern: /Science\s*Olympiad/i, url: '/science-olympiad.html' },
  { label: 'Olympaid Fee Structure', pattern: /Olympaid\s*Fee\s*Structure/i, url: '/olympaid-fee-structure.html' },
  { label: 'Math Olympiad', pattern: /Math\s*Olympiad/i, url: '/math-olympiad.html' },
  { label: 'Olympiad Schedule', pattern: /Olympiad\s*Schedule/i, url: '/olympiad-schedule.html' },
  { label: 'English Olympiad', pattern: /English\s*Olympiad/i, url: '/english-olympiad.html' },
  { label: 'Olympiad Exam Pattern', pattern: /Olympiad\s*Exam\s*Pattern/i, url: '/olympiad-exam-pattern.html' },
  { label: 'GK Olympiad', pattern: /GK\s*Olympiad/i, url: '/gk-olympiad.html' },
  { label: 'Olympiad Ranking', pattern: /Olympiad\s*Ranking/i, url: '/olympiad-ranking.html' },
  { label: 'Computer Olympiad', pattern: /Computer\s*Olympiad/i, url: '/computer-olympiad.html' }
];

function getUrlForLabel(text) {
  const clean = text.replace(/<[^>]+>/g, '').trim();
  for (const item of categoryLinks) {
    if (item.pattern.test(clean)) {
      return item.url;
    }
  }
  return null;
}

filesToUpdate.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.warn("File not found:", filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  // Match the category-list section: <ul class="list-unstyled category-list m-0"> ... </ul>
  const listRegex = /<ul class="list-unstyled category-list m-0">([\s\S]*?)<\/ul>/;
  const match = content.match(listRegex);
  if (!match) {
    console.warn("category-list not found in", filePath);
    return;
  }

  const listContent = match[1];
  
  // Replace each <li ...> ... <a href="#" ...>Text ... </a> ... </li>
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
  let updatedListContent = listContent.replace(liRegex, (fullLi, innerLi) => {
    // Extract label text
    // Remove svg
    const noSvg = innerLi.replace(/<svg[\s\S]*?<\/svg>/g, '');
    const cleanText = noSvg.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    
    const targetUrl = getUrlForLabel(cleanText);
    if (!targetUrl) {
      console.log("No url found for:", cleanText);
      return fullLi;
    }

    // Replace href="#" or existing href with targetUrl
    let updatedInner = innerLi.replace(/<a\s+href="[^"]*"/, `<a href="${targetUrl}"`);
    // Ensure <a> has w-100
    if (!updatedInner.includes('w-100')) {
      updatedInner = updatedInner.replace('class="d-flex align-items-center justify-content-between fw-500"', 'class="d-flex align-items-center justify-content-between fw-500 w-100"');
    }

    return `<li class="mb-8" onclick="window.location.href='${targetUrl}'" style="cursor: pointer;">${updatedInner}</li>`;
  });

  content = content.replace(listRegex, `<ul class="list-unstyled category-list m-0">${updatedListContent}</ul>`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully updated:", path.basename(filePath));
});
