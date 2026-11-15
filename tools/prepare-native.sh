#!/usr/bin/env bash
# Copy the playable web files into www/ for Capacitor (no SW, no screenshots, no tools).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WWW="$ROOT/www"
rm -rf "$WWW"
mkdir -p "$WWW/css" "$WWW/js" "$WWW/icons"
cp "$ROOT/index.html" "$ROOT/privacy.html" "$ROOT/terms.html" "$ROOT/manifest.webmanifest" "$WWW/"
cp "$ROOT/css/"*.css "$WWW/css/"
cp "$ROOT/js/"*.js "$WWW/js/"
cp "$ROOT/icons/"*.png "$WWW/icons/"
# Mark the bundled copy as native so the service worker never registers, even if
# the WebView user-agent check misses Capacitor (it serves https://localhost).
python3 - <<'PY' "$WWW/index.html"
from pathlib import Path
import sys
p = Path(sys.argv[1])
t = p.read_text()
t = t.replace('<html lang="en">', '<html lang="en" data-native="1">', 1)
p.write_text(t)
PY
echo "Prepared $WWW"
