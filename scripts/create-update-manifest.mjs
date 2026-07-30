import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [apkPath, apkUrl] = process.argv.slice(2);
if (!apkPath || !fs.existsSync(apkPath) || !apkUrl) {
  throw new Error(
    'Usage: node scripts/create-update-manifest.mjs <apk-path> <https-apk-url>',
  );
}

let parsedUrl;
try {
  parsedUrl = new URL(apkUrl);
} catch {
  throw new Error('The APK URL must be a valid absolute HTTPS URL.');
}

if (
  parsedUrl.protocol !== 'https:' ||
  !parsedUrl.hostname ||
  parsedUrl.username ||
  parsedUrl.password
) {
  throw new Error('The APK URL must use HTTPS and must not contain credentials.');
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const file = fs.readFileSync(apkPath);
const manifest = {
  enabled: true,
  version: pkg.version,
  apkUrl: parsedUrl.toString(),
  sha256: crypto.createHash('sha256').update(file).digest('hex'),
  sizeBytes: file.byteLength,
  packageName: 'com.mobdea.education',
  mandatory: false,
  notes: `إصدار ${pkg.version}`,
};
const output = path.join(path.dirname(apkPath), 'update.manifest.json');
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(output);
