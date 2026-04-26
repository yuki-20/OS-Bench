"""Generate 12 procedural vision test fixtures (PRD §31.2).

Each image is a tiny PIL composition with deliberately staged content so a
human (or the visual verifier) can see what the scene represents. They are
committed to `services/api/sample_data/vision/<id>.jpg` so the eval runner is
deterministic without binary blobs in source control.

Run once:
    python -m app.scripts.gen_vision_fixtures
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[2] / "sample_data" / "vision"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 720, 480
BG = (240, 240, 230)


def _font(size: int = 18) -> ImageFont.FreeTypeFont:
    # Try DejaVuSans (in the api Dockerfile) and fall back to default.
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def _label(d: ImageDraw.ImageDraw, text: str, *, x: int = 16, y: int = 16, color=(50, 50, 50)) -> None:
    d.rectangle((x - 6, y - 6, x + 460, y + 30), fill=(255, 255, 255), outline=(120, 120, 120))
    d.text((x, y), text, fill=color, font=_font(18))


def _bench(d: ImageDraw.ImageDraw) -> None:
    d.rectangle((0, 360, W, H), fill=(180, 165, 130))   # bench top
    d.rectangle((0, 350, W, 365), fill=(80, 60, 30))    # edge


def _tube(d: ImageDraw.ImageDraw, x: int, *, label: str | None = "A", filled=True) -> None:
    d.rectangle((x, 280, x + 36, 360), outline=(40, 40, 40), width=2, fill=(220, 230, 240))
    if filled:
        d.rectangle((x + 2, 320, x + 34, 358), fill=(120, 180, 220))
    if label is not None:
        d.rectangle((x + 4, 296, x + 32, 318), fill=(255, 255, 255))
        d.text((x + 10, 298), label, fill=(40, 40, 40), font=_font(14))


def _tray(d: ImageDraw.ImageDraw, x: int = 240, y: int = 340, w: int = 240, h: int = 28) -> None:
    d.rectangle((x, y, x + w, y + h), outline=(70, 70, 90), width=3, fill=(220, 220, 230))


def _display(d: ImageDraw.ImageDraw, *, text: str = "READY", color=(40, 200, 40)) -> None:
    d.rectangle((520, 60, 700, 130), fill=(20, 20, 30))
    d.rectangle((530, 70, 690, 120), fill=(0, 0, 0))
    d.text((550, 82), text, fill=color, font=_font(22))


def _scratch(d: ImageDraw.ImageDraw) -> None:
    for i in range(0, 720, 8):
        d.line(((i, 0), (i + 8, 480)), fill=(220, 215, 200), width=1)


CASES: list[tuple[str, str, callable]] = [
    (
        "vc_correct_setup",
        "Correct setup",
        lambda d: (
            _bench(d),
            _tray(d),
            _tube(d, 260, label="A"),
            _tube(d, 320, label="A"),
            _display(d),
            _label(d, "Correct setup — labeled tubes, tray, ready display"),
        ),
    ),
    (
        "vc_missing_label",
        "Missing label on reagent",
        lambda d: (
            _bench(d),
            _tray(d),
            _tube(d, 260, label=None),
            _tube(d, 320, label="A"),
            _display(d),
            _label(d, "Missing label on left tube"),
        ),
    ),
    (
        "vc_missing_containment",
        "Missing secondary containment",
        lambda d: (
            _bench(d),
            _tube(d, 280, label="A"),
            _tube(d, 340, label="A"),
            _display(d),
            _label(d, "No containment tray under the tubes"),
        ),
    ),
    (
        "vc_wrong_tube_count",
        "Wrong tube count (3 instead of 2)",
        lambda d: (
            _bench(d),
            _tray(d),
            _tube(d, 260, label="A"),
            _tube(d, 320, label="A"),
            _tube(d, 380, label="A"),
            _display(d),
            _label(d, "Three tubes; protocol calls for two"),
        ),
    ),
    (
        "vc_blurry_label",
        "Blurry / unreadable label",
        lambda d: (
            _bench(d),
            _tray(d),
            _tube(d, 260, label="?"),
            _tube(d, 320, label="A"),
            _display(d),
            _label(d, "Left tube label is illegible"),
        ),
    ),
    (
        "vc_blocked_item",
        "Blocked required item (tray hidden by clutter)",
        lambda d: (
            _bench(d),
            # cluttered objects in front of where tray would be
            d.rectangle((220, 320, 500, 380), fill=(200, 100, 60)),
            _tube(d, 260, label="A"),
            _tube(d, 320, label="A"),
            _display(d),
            _label(d, "Containment tray is blocked by clutter"),
        ),
    ),
    (
        "vc_wrong_container",
        "Wrong container type",
        lambda d: (
            _bench(d),
            _tray(d),
            # round flask instead of tubes
            d.ellipse((260, 290, 360, 360), outline=(40, 40, 40), width=2, fill=(180, 220, 230)),
            _display(d),
            _label(d, "Round flask in place of expected microtubes"),
        ),
    ),
    (
        "vc_spill_prop",
        "Spill-like prop (harmless, but should attention-flag)",
        lambda d: (
            _bench(d),
            _tray(d),
            _tube(d, 260, label="A"),
            _tube(d, 320, label="A"),
            d.ellipse((140, 380, 240, 430), fill=(60, 120, 200)),
            _label(d, "Liquid pooled outside tray near bench edge"),
        ),
    ),
    (
        "vc_unreadable_display",
        "Unreadable equipment display",
        lambda d: (
            _bench(d),
            _tray(d),
            _tube(d, 260, label="A"),
            _tube(d, 320, label="A"),
            _display(d, text="?????", color=(120, 120, 120)),
            _label(d, "Equipment display unreadable"),
        ),
    ),
    (
        "vc_overcluttered",
        "Overcluttered bench",
        lambda d: (
            _bench(d),
            _tray(d),
            _tube(d, 260, label="A"),
            _tube(d, 320, label="A"),
            _display(d),
            d.rectangle((40, 320, 200, 360), fill=(130, 90, 60)),
            d.rectangle((400, 300, 500, 360), fill=(200, 90, 60)),
            d.rectangle((540, 320, 700, 360), fill=(110, 200, 110)),
            _label(d, "Adjacent items obscure the work area"),
        ),
    ),
    (
        "vc_partially_occluded",
        "Required item partially occluded",
        lambda d: (
            _bench(d),
            _tray(d),
            _tube(d, 260, label="A"),
            _tube(d, 320, label=None),  # half-hidden
            d.rectangle((315, 280, 360, 360), fill=(180, 165, 130)),
            _display(d),
            _label(d, "Right tube partly hidden behind bench item"),
        ),
    ),
    (
        "vc_cannot_verify",
        "Hidden state — cannot verify",
        lambda d: (
            _bench(d),
            _tray(d),
            _tube(d, 260, label="A"),
            _tube(d, 320, label="A"),
            _display(d, text="????", color=(60, 60, 60)),
            _scratch(d),
            _label(d, "Image is too obscured to confirm any item"),
        ),
    ),
]


def main() -> None:
    for case_id, scenario, painter in CASES:
        img = Image.new("RGB", (W, H), BG)
        d = ImageDraw.Draw(img)
        painter(d)
        path = OUT / f"{case_id}.jpg"
        img.save(path, "JPEG", quality=82)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
