#!/bin/bash
# usage: lh.sh <label> ; runs Lighthouse mobile (simulated Slow 4G: 150ms RTT, 1.6 Mbps, 4x CPU) 3x per route
OUT="$(dirname "$0")/$1"; mkdir -p "$OUT"
BASE="https://mubader-libya.github.io/ydf-homepage/"
export CHROME_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe"
for r in "" "activities.html" "activity.html?id=6315" "news.html" "news-item.html?id=6112"; do
  n=$(echo "${r:-index}" | sed 's/[^a-z0-9]/_/g')
  for i in 1 2 3; do
    npx -y lighthouse@13.6.0 "$BASE$r" --quiet --only-categories=performance --form-factor=mobile --throttling-method=simulate \
      --throttling.rttMs=150 --throttling.throughputKbps=1638.4 --throttling.cpuSlowdownMultiplier=4 \
      --chrome-flags="--headless=new --no-sandbox" --output=json --output-path="$OUT/$n-$i.json" >/dev/null 2>&1 || echo "FAIL $n $i"
  done
done
echo done
