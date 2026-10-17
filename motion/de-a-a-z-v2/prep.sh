#!/usr/bin/env bash
# Prépare les rushes de la v2 : télécharge les vidéos libres de droits (Mixkit),
# recadre en 9:16, applique l'étalonnage noir & or, et extrait les images à 30 i/s.
# Usage : bash motion/de-a-a-z-v2/prep.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/.sources"; OUT="$HERE/footage"
mkdir -p "$SRC" "$OUT"

# id  début(s)  durée(s)  gamma (éclaircit les plans sombres)
CLIPS="49141 0.5 1.5 1
42316 3.0 2.4 1
34486 0.5 1.5 1
41272 0.5 1.6 1
43531 3.0 1.1 1.7
51613 3.5 1.1 1.9
51252 0.5 1.8 1
14154 2.0 3.2 1"

GOLD="hue=s=0,eq=contrast=1.3:brightness=-0.02,curves=r='0/0 0.3/0.26 0.65/0.82 1/1':g='0/0 0.3/0.15 0.65/0.55 1/0.93':b='0/0 0.3/0.03 0.65/0.18 1/0.72'"

echo "$CLIPS" | while read -r id ss dur gamma; do
  f="$SRC/$id.mp4"
  [ -s "$f" ] || for r in 1080 720; do curl -sf -m 120 -o "$f" "https://assets.mixkit.co/videos/$id/$id-$r.mp4" && break; done
  mkdir -p "$OUT/$id"; rm -f "$OUT/$id"/*.jpg
  ffmpeg -nostdin -v error -y -ss "$ss" -t "$dur" -i "$f" -an \
    -vf "fps=30,crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920,eq=gamma=$gamma,$GOLD" \
    -q:v 4 -start_number 0 "$OUT/$id/%03d.jpg"
  echo "$id : $(ls "$OUT/$id" | wc -l) images"
done
