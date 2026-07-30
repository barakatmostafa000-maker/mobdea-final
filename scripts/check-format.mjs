import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignored = new Set(['node_modules', 'dist', '.git', 'android/app/src/main/assets/public', 'android/build']);
const extensions = new Set(['.js', '.jsx', '.mjs', '.json', '.css', '.html', '.md', '.xml', '.gradle', '.properties', '.toml', '.yml', '.yaml', '.java']);
const files = [];
walk(root, '');

function walk(directory, relativeDirectory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = path.join(relativeDirectory, entry.name).replace(/\\/g, '/');
    if ([...ignored].some((item) => relative === item || relative.startsWith(`${item}/`))) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, relative);
    else if (extensions.has(path.extname(entry.name)) || entry.name === 'build.gradle') files.push({ full, relative });
  }
}

const issues = [];
for (const { full, relative } of files) {
  const text = fs.readFileSync(full, 'utf8');
  if (text.includes('\r\n')) issues.push(`${relative}: CRLF line endings.`);
  if (!text.endsWith('\n')) issues.push(`${relative}: missing final newline.`);
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (/[ \t]+$/.test(line)) issues.push(`${relative}:${index + 1}: trailing whitespace.`);
    if (/\t/.test(line) && !relative.endsWith('.md')) issues.push(`${relative}:${index + 1}: tab indentation.`);
  });
}
if (issues.length) {
  console.error(`Format check failed with ${issues.length} issue(s):`);
  issues.slice(0, 100).forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}
console.log(`Format check passed (${files.length} files checked).`);
