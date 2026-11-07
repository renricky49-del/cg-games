#!/usr/bin/env bash
# Build the CrazyGames upload zip: index.html at the zip root plus only the runtime folders.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/last-door-standing.zip
zip -qr -X dist/last-door-standing.zip index.html css js assets -x '*.DS_Store'
unzip -l dist/last-door-standing.zip | tail -1
du -h dist/last-door-standing.zip
