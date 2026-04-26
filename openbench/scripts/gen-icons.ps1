# PowerShell variant of gen-icons.sh — for Windows users without bash.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "apps/bench-desktop/src-tauri/icons"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$pyScript = @'
from PIL import Image, ImageDraw, ImageFont
BRAND = (30, 27, 75, 255)
ACCENT = (79, 70, 229, 255)
INK = (255, 255, 255, 255)
def make(size):
    img = Image.new("RGBA", (size, size), BRAND)
    d = ImageDraw.Draw(img)
    pad = max(2, size // 8)
    d.rounded_rectangle((pad, pad, size - pad, size - pad), radius=size // 6, outline=ACCENT, width=max(1, size // 16))
    txt = "OB"
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(size * 0.45))
    except Exception:
        font = ImageFont.load_default()
    bbox = d.textbbox((0, 0), txt, font=font)
    tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    d.text(((size-tw)//2-bbox[0], (size-th)//2-bbox[1]), txt, fill=INK, font=font)
    return img
for s, n in [(32, "32x32.png"), (128, "128x128.png"), (256, "icon.png")]:
    make(s).save(f"/out/{n}", "PNG")
ico_sizes = [(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)]
make(256).save("/out/icon.ico", format="ICO", sizes=ico_sizes)
make(512).save("/out/icon.icns", format="PNG")
print("ok")
'@

$tmp = New-TemporaryFile
Set-Content -Path $tmp -Value $pyScript -Encoding UTF8

docker run --rm -v "${out}:/out" -v "${tmp}:/gen.py" python:3.11-slim sh -c "pip install --quiet pillow && python /gen.py"
Remove-Item $tmp -Force

Write-Host "Icons written to $out"
Get-ChildItem $out
