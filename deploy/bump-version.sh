#!/bin/bash
# يرفع رقم الإصدار ?v= لكل ملفات CSS/JS المحلية في الصفحات، حتى يرى الزوار التحديث فوراً
# الاستعمال: bash deploy/bump-version.sh 1.3
set -e
V="${1:?اكتب رقم الإصدار، مثل 1.3}"
cd "$(dirname "$0")/.."
for f in *.html; do
  sed -i -E 's#(href|src)="((sub|menu)\.(css|js)|act-data\.js|news-data\.js)(\?v=[^"]*)?"#\1="\2?v='"$V"'"#g' "$f"
done
grep -ho '?v=[^"]*' *.html | sort | uniq -c
