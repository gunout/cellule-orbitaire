#!/usr/bin/env bash
# Rafraîchit les TLE météo + ISS depuis CelesTrak
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
DATA="$DIR/data"
mkdir -p "$DATA"

echo "[$(date -Iseconds)] Refresh TLE…"

curl -fsSL "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle" \
  -o "$DATA/weather.tle" && echo "  ✅ weather.tle ($(grep -c '^1 ' "$DATA/weather.tle") sats)"

curl -fsSL "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE" \
  -o "$DATA/iss.tle" && echo "  ✅ iss.tle"

echo "[$(date -Iseconds)] OK"
