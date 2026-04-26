"""PDF / DOCX text extraction with page maps."""
from __future__ import annotations

import io
from typing import List, Tuple

import fitz  # PyMuPDF
import pdfplumber
from docx import Document as DocxDocument


def extract_pdf(data: bytes) -> Tuple[str, int, List[Tuple[int, str]]]:
    """Return (full_text, page_count, [(page_no, page_text)])."""
    pages: List[Tuple[int, str]] = []
    full = []
    # try pdfplumber first (cleaner layout)
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                pages.append((i + 1, text))
                full.append(text)
            return "\n".join(full), len(pdf.pages), pages
    except Exception:
        pages = []
        full = []
    # fallback to PyMuPDF
    doc = fitz.open(stream=data, filetype="pdf")
    for i in range(doc.page_count):
        page = doc.load_page(i)
        text = page.get_text() or ""
        pages.append((i + 1, text))
        full.append(text)
    doc.close()
    return "\n".join(full), len(pages), pages


def extract_docx(data: bytes) -> Tuple[str, int, List[Tuple[int, str]]]:
    doc = DocxDocument(io.BytesIO(data))
    parts = [p.text for p in doc.paragraphs]
    text = "\n".join(parts)
    return text, 1, [(1, text)]


def extract_text(data: bytes, mime_type: str) -> Tuple[str, int, List[Tuple[int, str]]]:
    mt = (mime_type or "").lower()
    if mt == "application/pdf" or mt.endswith("/pdf"):
        return extract_pdf(data)
    if "word" in mt or "officedocument" in mt:
        return extract_docx(data)
    # treat as plain text
    text = data.decode("utf-8", errors="ignore")
    return text, 1, [(1, text)]
