"""OCR fallback (PRD §15.1.3).

When the upstream PDF/DOCX text extractor returns essentially empty text
(scanned PDFs without a text layer), this module renders each page to a raster
image with PyMuPDF and runs Tesseract over it. It is gated behind the
`tesseract` binary being present on the host — it is installed in the api
Dockerfile but the function logs a warning and returns the original pages if
the binary is missing.
"""
from __future__ import annotations

import io
import shutil
from typing import List, Tuple

from app.core.logging import logger


def tesseract_available() -> bool:
    return shutil.which("tesseract") is not None


def ocr_pdf_pages(data: bytes) -> Tuple[str, int, List[Tuple[int, str]]]:
    """Return (full_text, page_count, [(page_no, text)]) by OCR-ing each page.

    Best-effort. If the page can't be rendered or Tesseract isn't available,
    falls back to whatever the upstream extractor gave (caller still has the
    original pages and can decide).
    """
    if not tesseract_available():
        logger.warning("OCR requested but `tesseract` binary not found in PATH; skipping")
        return "", 0, []
    import fitz  # PyMuPDF — late import so module loads even if pkg missing
    import pytesseract
    from PIL import Image

    out_pages: List[Tuple[int, str]] = []
    full: list[str] = []
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:  # noqa: BLE001
        logger.warning("OCR: cannot open PDF: {}", e)
        return "", 0, []

    try:
        for i in range(doc.page_count):
            page = doc.load_page(i)
            try:
                # 200 dpi is a good readability/cost tradeoff.
                pix = page.get_pixmap(dpi=200, alpha=False)
                img_bytes = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_bytes))
                text = pytesseract.image_to_string(img) or ""
            except Exception as e:  # noqa: BLE001
                logger.warning("OCR page {} failed: {}", i + 1, e)
                text = ""
            out_pages.append((i + 1, text))
            full.append(text)
    finally:
        doc.close()
    return "\n".join(full), len(out_pages), out_pages


__all__ = ["ocr_pdf_pages", "tesseract_available"]
