#!/usr/bin/env bash
# Builds the CrazyGames upload zip: only the files the game needs, index.html at the zip root.
set -euo pipefail
cd "$(dirname "$0")"
VER="${1:-1.0}"
OUT="release/letter-legion-v${VER}.zip"
mkdir -p release
rm -f "$OUT"
zip -q -r -9 -X "$OUT" index.html css js assets -x '*.DS_Store' '*/Thumbs.db'
echo "$OUT: $(unzip -l "$OUT" | tail -1 | awk '{print $2}') files, $(du -h "$OUT" | cut -f1) zipped, $(unzip -l "$OUT" | tail -1 | awk '{printf "%.1f MB", $1/1048576}') unzipped"
