#!/usr/bin/env bash
# Regenerate every dev page and, when Firefox is available, capture screenshots.
set -euo pipefail
cd "$(dirname "$0")"

python3 make-tests.py
python3 make-boot.py
python3 make-layout.py
python3 make-visual.py

OUT="$PWD/.build"
echo
echo "Pages written to $OUT"
echo "Open one in a browser, for example:"
echo "  file://$OUT/tests.html"
echo "  file://$OUT/layout.html?view=game"
echo "  file://$OUT/visual.html?view=game"

if ! command -v firefox >/dev/null 2>&1; then
  echo
  echo "Firefox not found; skipping screenshots."
  exit 0
fi

PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE"' EXIT

shoot() {
  local page="$1" size="$2" name="$3"
  MOZ_HEADLESS=1 firefox --headless --profile "$PROFILE" \
    --window-size "$size" --screenshot "$OUT/$name" \
    "file://$OUT/$page" >/dev/null 2>&1 || true
}

shoot "tests.html" "1200,2200" "tests.png"
for case in resume menu options story over; do
  shoot "boot-$case.html" "900,900" "boot-$case.png"
done
for view in game menu options; do
  for size in "900,900" "390,844" "320,780"; do
    shoot "layout.html?view=$view" "$size" "layout-$view-${size/,/x}.png"
  done
done
for view in game cooling armed tip over vs story nought options menu; do
  shoot "visual.html?view=$view" "900,1100" "visual-$view-900.png"
done
for view in game vs story nought options menu; do
  shoot "visual.html?view=$view" "390,1300" "visual-$view-390.png"
done

echo
echo "Screenshots written to $OUT"
