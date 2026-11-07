#!/usr/bin/env bash
# Stitch tools/trailer.cjs frames into the CrazyGames preview videos:
# static cover as the opening frame, short cross-fades between shots, H.264, no audio track.
# usage: tools/trailer.sh <framesRoot>   (expects <framesRoot>/landscape/seg1..4 and <framesRoot>/portrait/seg1..4)
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$1"; mkdir -p store/video
mk() { # mode W H cover
  local mode=$1 W=$2 H=$3 cover=$4 d="$ROOT/$1" X=0.35 out="store/video/preview_${1}_${2}x${3}.mp4"
  local ins=(-loop 1 -t 1.3 -framerate 30 -i "$cover") lens=(1.3)
  for s in 1 2 3 4; do ins+=(-framerate 30 -i "$d/seg$s/%04d.jpg"); lens+=("$(echo "$(ls "$d/seg$s" | wc -l) / 30" | bc -l)"); done
  local f="" off=0 prev="[v0]"
  for i in 0 1 2 3 4; do f+="[$i:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30,format=yuv420p[v$i];"; done
  for i in 1 2 3 4; do
    off=$(printf "%.3f" "$(echo "$off + ${lens[$((i-1))]} - $X" | bc -l)")
    f+="${prev}[v$i]xfade=transition=fade:duration=$X:offset=$off[x$i];"; prev="[x$i]"
  done
  ffmpeg -loglevel error -y "${ins[@]}" -filter_complex "${f%;}" -map "$prev" -an -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart "$out"
  echo "$out $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out")s $(du -h "$out" | cut -f1)"
}
mk landscape 1920 1080 store/cover_1920x1080.jpg
mk portrait 1080 1620 store/cover_800x1200.jpg
