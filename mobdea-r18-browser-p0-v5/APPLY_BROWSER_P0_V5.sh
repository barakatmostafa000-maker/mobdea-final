#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ ! -f "$ROOT/package.json" || ! -d "$ROOT/src" ]]; then
  echo "ERROR: شغّل السكريبت من جذر مشروع mobdea-final" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.r18-browser-v5-backup-$STAMP"
mkdir -p "$BACKUP"

FILES=(
  "src/components/classmode/MediaRenderer.jsx"
  "src/components/classmode/PdfCanvasPreview.jsx"
  "src/components/maps/LessonMapStudio.jsx"
  "src/components/maps/ProfessionalMap.jsx"
  "src/pages/ClassMode.jsx"
  "src/styles/v111.css"
  "tests/browser-p0-v5-regression.test.mjs"
)

for rel in "${FILES[@]}"; do
  if [[ -f "$ROOT/$rel" ]]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp "$ROOT/$rel" "$BACKUP/$rel"
  fi
  mkdir -p "$ROOT/$(dirname "$rel")"
  cp "$PATCH_DIR/$rel" "$ROOT/$rel"
done

# V5 uses local pdf.js. V4 should already have it, but install locally if it is absent.
if [[ ! -f "$ROOT/node_modules/pdfjs-dist/legacy/build/pdf.mjs" ]]; then
  echo "[V5] pdfjs-dist غير موجود؛ تثبيت محلي بدون تعديل package-lock..."
  npm install --no-save --package-lock=false pdfjs-dist@4.10.38
fi

node --test tests/browser-p0-v5-regression.test.mjs

echo ""
echo "========================================="
echo " BROWSER P0 V5 APPLIED"
echo " Backup: $BACKUP"
echo "========================================="
echo "أعد تشغيل Vite ثم اعمل Reload كامل للصفحة."
