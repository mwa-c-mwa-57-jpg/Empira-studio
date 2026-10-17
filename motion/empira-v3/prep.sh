#!/usr/bin/env bash
# Prépare les médias de la v3 (vidéos libres de droits Mixkit, couleurs naturelles).
# Usage : bash motion/empira-v3/prep.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/.sources"; OUT="$HERE/footage"; TH="$HERE/thumbs"
mkdir -p "$SRC" "$OUT" "$TH"
get() { # id résolution
  local f="$SRC/$1-$2.mp4"
  [ -s "$f" ] || for r in $2 1080 720 360; do curl -sf -m 120 -o "$f" "https://assets.mixkit.co/videos/$1/$1-$r.mp4" && break; done
  echo "$f"
}
LOOK="eq=contrast=1.08:saturation=1.12:gamma=1.04,colorbalance=rs=.04:bs=-.05:rh=.03:bh=-.04"

# Rushes plein écran : id début durée
echo "42316 2.0 2.6
43531 2.5 2.6
51252 0.5 2.0
51613 3.0 2.6" | while read -r id ss dur; do
  f=$(get $id 1080); mkdir -p "$OUT/$id"; rm -f "$OUT/$id"/*.jpg
  ffmpeg -nostdin -v error -y -ss "$ss" -t "$dur" -i "$f" -an \
    -vf "fps=30,crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920,$LOOK" -q:v 4 -start_number 0 "$OUT/$id/%03d.jpg"
  echo "$id : $(ls "$OUT/$id" | wc -l) images"
done

# Vignettes de la grille du profil (format 3:4)
i=0
for spec in 42316:5 42319:3 42323:3 42315:2 43149:2 34487:3 49141:2 51252:4 50492:2; do
  id=${spec%%:*}; ss=${spec##*:}; f=$(get $id 360)
  ffmpeg -nostdin -v error -y -ss "$ss" -i "$f" -frames:v 1 \
    -vf "crop='min(iw,ih*3/4)':'min(ih,iw*4/3)',scale=360:480,$LOOK" -q:v 3 "$TH/$i.jpg"
  i=$((i+1))
done
echo "vignettes : $(ls "$TH" | wc -l)"
