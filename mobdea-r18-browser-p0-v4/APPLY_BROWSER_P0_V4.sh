#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/mobdea-final
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".browser-p0-v4-backup-$STAMP"
mkdir -p "$BACKUP_DIR"
FILES=(
  src/services/webPdfRenderer.js
  src/hooks/useAssetSource.js
  src/pages/ClassMode.jsx
  src/pages/MapChallenge.jsx
  src/components/maps/ProfessionalMap.jsx
  src/components/maps/LessonMapStudio.jsx
  src/styles/v111.css
)
for file in "${FILES[@]}"; do
  mkdir -p "$BACKUP_DIR/$(dirname "$file")"
  if [ -f "$file" ]; then cp "$file" "$BACKUP_DIR/$file"; fi
  mkdir -p "$(dirname "$file")"
  cp "$PATCH_DIR/$file" "$file"
done
mkdir -p tests
cp "$PATCH_DIR/tests/browser-p0-v4-regression.test.mjs" tests/browser-p0-v4-regression.test.mjs

# PDF pages must render inside the app itself; do not depend on a remote CDN or
# the mobile browser's incomplete iframe PDF viewer.
if ! node -e "import('pdfjs-dist/build/pdf.mjs').then(()=>process.exit(0)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
  echo "[1/3] Installing local PDF renderer..."
  npm install --save-exact pdfjs-dist@4.10.38 --no-audit --no-fund
else
  echo "[1/3] Local PDF renderer already installed."
fi

echo "[2/3] Running V4 browser regression checks..."
node --test tests/browser-p0-v4-regression.test.mjs

echo "[3/3] Browser P0 V4 applied."
echo "Backup: $BACKUP_DIR"
echo "BROWSER P0 V4 APPLIED"
