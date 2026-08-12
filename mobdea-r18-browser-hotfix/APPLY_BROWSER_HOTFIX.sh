#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/workspaces/mobdea-final}"
cd "$ROOT"
cp -f src/components/classmode/ClassModeViewport.jsx "src/components/classmode/ClassModeViewport.jsx.pre-browser-hotfix.bak" 2>/dev/null || true
cp -f src/components/maps/ProfessionalMap.jsx "src/components/maps/ProfessionalMap.jsx.pre-browser-hotfix.bak" 2>/dev/null || true
cp -f src/styles/v111.css "src/styles/v111.css.pre-browser-hotfix.bak" 2>/dev/null || true
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -f "$SCRIPT_DIR/src/components/classmode/ClassModeViewport.jsx" src/components/classmode/ClassModeViewport.jsx
cp -f "$SCRIPT_DIR/src/components/maps/ProfessionalMap.jsx" src/components/maps/ProfessionalMap.jsx
cp -f "$SCRIPT_DIR/src/styles/v111.css" src/styles/v111.css
printf '\nBrowser hotfix applied. Start Vite with:\n  npm run dev -- --host 0.0.0.0\n'
