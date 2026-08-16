import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const version = String(pkg.version || '').trim();
const versionCode = Number(pkg.mobdea?.versionCode || 0);
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error('package.json contains an invalid semantic version.');
if (!Number.isInteger(versionCode) || versionCode <= 0) throw new Error('package.json mobdea.versionCode must be a positive integer.');

const versionFile = `export const APP_VERSION = '${version}';\nexport const APP_VERSION_CODE = ${versionCode};\nexport const DATA_SCHEMA_VERSION = 13;\nexport const RELEASE_CHANNEL = 'stable';\nexport const RELEASE_TAG = 'R18';\n`;
fs.writeFileSync(path.join(root, 'src/config/version.js'), versionFile);

const gradlePath = path.join(root, 'android/app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
fs.writeFileSync(gradlePath, gradle);

const manifestPath = path.join(root, 'public/update.manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.enabled === false) manifest.version = version;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Synchronized Mobdea version ${version} (${versionCode}).`);
