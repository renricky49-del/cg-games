#!/usr/bin/env bash
# Builds the upload zip for the CrazyGames developer portal: dist/teahouse-tile-slide.zip
set -e
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/teahouse-tile-slide.zip
python3 - <<'PY'
import zipfile, os
with zipfile.ZipFile('dist/teahouse-tile-slide.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for root in ['index.html', 'css', 'js', 'assets']:
        if os.path.isfile(root): z.write(root); continue
        for d, _, fs in os.walk(root):
            for f in fs: z.write(os.path.join(d, f))
print('dist/teahouse-tile-slide.zip', os.path.getsize('dist/teahouse-tile-slide.zip') // 1024, 'KB')
PY
