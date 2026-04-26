#!/usr/bin/env bash
# Generate placeholder OpenBench icons for the Tauri desktop bundle.
# Uses a one-shot Python container with Pillow — no local Python needed.
# Run once before `pnpm tauri:build`. Replace these with branded artwork before shipping.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="apps/bench-desktop/src-tauri/icons"
mkdir -p "$OUT"

docker run --rm -v "$(pwd)/$OUT:/out" python:3.11-slim sh -c '
pip install --quiet pillow >/dev/null 2>&1 || pip install pillow >/dev/null
python - <<PY
from PIL import Image, ImageDraw, ImageFont

BRAND = (30, 27, 75, 255)        # ink-900 / brand-900
ACCENT = (79, 70, 229, 255)      # brand-600
INK = (255, 255, 255, 255)

def make(size: int):
    img = Image.new("RGBA", (size, size), BRAND)
    d = ImageDraw.Draw(img)
    # simple "OB" mark
    pad = max(2, size // 8)
    d.rounded_rectangle((pad, pad, size - pad, size - pad), radius=size // 6, outline=ACCENT, width=max(1, size // 16))
    txt = "OB"
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(size * 0.45))
    except Exception:
        font = ImageFont.load_default()
    bbox = d.textbbox((0, 0), txt, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - tw) // 2 - bbox[0], (size - th) // 2 - bbox[1]), txt, fill=INK, font=font)
    return img

for s, name in [(32, "32x32.png"), (128, "128x128.png"), (256, "icon.png")]:
    img = make(s)
    img.save(f"/out/{name}", "PNG")

# Multi-size .ico for Windows installer
ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
make(256).save("/out/icon.ico", format="ICO", sizes=ico_sizes)

# Tauri also references icon.icns; ship a PNG renamed for now (replace with proper icns
# if you build for macOS).
make(512).save("/out/icon.icns", format="PNG")

print("Generated icons in /out: 32x32.png, 128x128.png, icon.png, icon.ico, icon.icns")
PY
'

echo "Icons written to $OUT"
ls -lh "$OUT"
