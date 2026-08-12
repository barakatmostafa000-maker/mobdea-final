#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/workspaces/mobdea-final}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
mkdir -p .browser-fix-v2-backup
for f in \
  src/pages/ClassMode.jsx \
  src/pages/ContentLibrary.jsx \
  src/components/classmode/ClassModeViewport.jsx \
  src/components/maps/ProfessionalMap.jsx \
  src/styles/v111.css; do
  cp -f "$f" ".browser-fix-v2-backup/$(echo "$f" | tr '/' '_')"
  cp -f "$HERE/$f" "$f"
done
rm -rf node_modules/.vite
printf '\n=== VERIFY MAP NAME COLLISION ===\n'
grep -n "Map as MapIcon\|new Map" src/pages/ClassMode.jsx | head -10
grep -n "Map as MapIcon\|new Map" src/pages/ContentLibrary.jsx | head -10
printf '\n=== VERIFY CLASSMODE ROOT ===\n'
grep -n "classmode-viewport classmode-v103" src/components/classmode/ClassModeViewport.jsx
printf '\n=== VERIFY DIRECT SVG MAP ===\n'
grep -n "fill={active ? '#d9ad3f'" src/components/maps/ProfessionalMap.jsx
printf '\nBROWSER FIX V2 APPLIED\nStart/restart Vite with:\n  npm run dev -- --host 0.0.0.0\n'
