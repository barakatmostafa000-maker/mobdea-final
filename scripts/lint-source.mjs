import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targets = ['src', 'cloud-worker'];
const files = [];
for (const target of targets) walk(path.join(root, target));

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name)) files.push(full);
  }
}

const issues = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  if (/\beval\s*\(/.test(text)) issues.push(`${relative}: eval() is forbidden.`);
  if (/dangerouslySetInnerHTML/.test(text)) issues.push(`${relative}: dangerouslySetInnerHTML requires a reviewed exception.`);
  if (/document\.write\s*\(/.test(text)) issues.push(`${relative}: document.write() is forbidden.`);
  if (/console\.(log|debug)\s*\(/.test(text)) issues.push(`${relative}: debug console output found.`);
  for (const line of text.split('\n')) {
    if (/Math\.random\(\)/.test(line) && /(token|secret|password|pin)/i.test(line)) issues.push(`${relative}: Math.random() must not generate secrets.`);
  }
  for (const tag of text.match(/<a\b[^>]*target=["']_blank["'][^>]*>/g) || []) {
    if (!/rel=["'][^"']*noopener/.test(tag)) issues.push(`${relative}: target=_blank without rel=noopener.`);
  }
  if (/\bhttp:\/\//.test(text) && !/localhost|127\.0\.0\.1|schemas\.android\.com|developer\.android\.com|gradle\.org/.test(text)) issues.push(`${relative}: insecure HTTP URL found.`);
}

if (issues.length) {
  console.error(`Source lint failed with ${issues.length} issue(s):`);
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}
console.log(`Source lint passed (${files.length} files checked).`);
