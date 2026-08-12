#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/workspaces/mobdea-final}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".browser-p0-v3-backup-$STAMP"
mkdir -p "$BACKUP"
FILES=(
  src/pages/ClassMode.jsx
  src/pages/ContentLibrary.jsx
  src/components/classmode/ClassroomGamePanel.jsx
  src/components/maps/ProfessionalMap.jsx
  src/hooks/usePdfPage.js
  src/services/webPdfRenderer.js
  src/styles/v107.css
  src/styles/v111.css
  tests/browser-p0-regression.test.mjs
)
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -f "$f" "$BACKUP/$f"
  fi
  mkdir -p "$(dirname "$f")"
  cp -f "$HERE/$f" "$f"
done
rm -rf node_modules/.vite 2>/dev/null || true
printf '\n=== Browser P0 V3 checks ===\n'
grep -n "Map as MapIcon\|new Map" src/pages/ClassMode.jsx | head -8
grep -n "classmode-board-focus-toggle" src/pages/ClassMode.jsx | head -3
grep -n "renderWebPdf" src/hooks/usePdfPage.js
grep -n "grid-template-rows: minmax(0, 1fr)" src/styles/v107.css | head -3
node --test tests/browser-p0-regression.test.mjs
printf '\nBROWSER P0 V3 APPLIED\nBackup: %s\n' "$BACKUP"
printf 'Restart Vite: pkill -f vite || true; npm run dev -- --host 0.0.0.0\n'
