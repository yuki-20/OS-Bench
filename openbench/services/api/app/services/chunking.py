"""Section/page-aware chunker for retrieval."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

SECTION_RE = re.compile(
    r"^\s*(?:section\s+)?(?P<num>\d{1,2}(?:\.\d{1,2})?)?\s*[:\-)]?\s*(?P<title>[A-Z][A-Za-z][A-Za-z0-9\s/,&\-\.()]{2,80})\s*$"
)


@dataclass
class Chunk:
    text: str
    page_no: Optional[int]
    section_label: Optional[str]


def chunk_pages(
    pages: List[Tuple[int, str]],
    *,
    target_chars: int = 1200,
    min_chars: int = 250,
) -> List[Chunk]:
    chunks: List[Chunk] = []
    current_section: Optional[str] = None
    buffer: List[str] = []
    buffer_page: Optional[int] = None
    buffer_section: Optional[str] = current_section

    def flush() -> None:
        nonlocal buffer, buffer_page, buffer_section
        if not buffer:
            return
        text = "\n".join(buffer).strip()
        if len(text) >= min_chars:
            chunks.append(Chunk(text=text, page_no=buffer_page, section_label=buffer_section))
        elif chunks:
            chunks[-1].text = (chunks[-1].text + "\n\n" + text).strip()
        else:
            chunks.append(Chunk(text=text, page_no=buffer_page, section_label=buffer_section))
        buffer = []

    for page_no, page_text in pages:
        if buffer_page is None:
            buffer_page = page_no
        for raw_line in page_text.splitlines():
            line = raw_line.strip()
            if not line:
                # treat blank line as soft separator
                if sum(len(b) for b in buffer) >= target_chars:
                    flush()
                    buffer_page = page_no
                    buffer_section = current_section
                continue
            m = SECTION_RE.match(line)
            if m and len(line) <= 100:
                title = (m.group("title") or "").strip()
                if title and (title.istitle() or title.isupper() or m.group("num")):
                    flush()
                    current_section = line
                    buffer_section = current_section
                    buffer_page = page_no
            buffer.append(line)
            if sum(len(b) for b in buffer) >= target_chars * 1.4:
                flush()
                buffer_page = page_no
                buffer_section = current_section
    flush()
    return chunks
