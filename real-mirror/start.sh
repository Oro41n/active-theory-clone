#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "============================================================"
echo "  41n Design Collection - personal study"
echo "============================================================"
echo

if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
  echo "[ERROR] Python 3 not found. Install it first."
  exit 1
fi
PY=python3; command -v python3 >/dev/null 2>&1 || PY=python

if [ ! -f "site/index.html" ]; then
  echo "[1/2] First run - downloading ~180 MB of real assets..."
  echo "      (only once; subsequent runs skip existing files)"
  "$PY" tools/build.py
else
  echo "[OK] site/ already built."
fi

echo
echo "[2/2] Starting local server on http://127.0.0.1:8080"
echo "      Press Ctrl+C to stop the server."
echo

URL="http://127.0.0.1:8080/check-gpu.html"
# open the self-check page in the default browser, cross-platform
if command -v open >/dev/null 2>&1; then open "$URL" &          # macOS
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" & # Linux
fi

"$PY" tools/serve.py 8080
