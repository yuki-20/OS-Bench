"""Markdown -> HTML -> PDF renderer for handover reports.

Sanitises rendered HTML through bleach so a malicious SOP/SDS upload (or a
prompt-injected report payload) cannot inject arbitrary HTML into the published
handover. Falls back to a tiny static PDF if WeasyPrint's native deps are
missing on the host (common on Windows dev machines).
"""
from __future__ import annotations

import bleach
import markdown as md

REPORT_HTML_TEMPLATE = """<!doctype html>
<html><head><meta charset='utf-8'><title>Handover Report</title>
<style>
@page {{ size: Letter; margin: 18mm; }}
body {{ font-family: 'Helvetica', 'Arial', sans-serif; color: #111; line-height: 1.45; }}
h1 {{ font-size: 22pt; margin: 0 0 10pt 0; border-bottom: 2px solid #111; padding-bottom: 4pt; }}
h2 {{ font-size: 14pt; margin: 16pt 0 6pt 0; color: #1f3a8a; }}
h3 {{ font-size: 12pt; margin: 12pt 0 4pt 0; }}
code, pre {{ font-family: 'SFMono-Regular', Consolas, monospace; }}
ul {{ margin: 4pt 0 8pt 16pt; padding: 0; }}
li {{ margin: 2pt 0; }}
blockquote {{ border-left: 4px solid #f59e0b; background: #fef3c7; padding: 6pt 10pt; margin: 12pt 0; }}
.banner {{ font-size: 9pt; color: #6b7280; margin-top: 18pt; border-top: 1px solid #e5e7eb; padding-top: 6pt; }}
</style></head>
<body>
{body}
<div class='banner'>OpenBench OS handover report. Decision support only — does not certify safety or compliance.</div>
</body></html>
"""


def _safe_link_attrs(attrs: dict, new: bool = False) -> dict:
    attrs[(None, "rel")] = "nofollow noopener noreferrer"
    attrs[(None, "target")] = "_blank"
    return attrs


def markdown_to_html(text: str) -> str:
    html = md.markdown(text, extensions=["fenced_code", "tables", "sane_lists"])
    cleaned = bleach.clean(
        html,
        tags={
            "a",
            "blockquote",
            "br",
            "code",
            "em",
            "h1",
            "h2",
            "h3",
            "h4",
            "li",
            "ol",
            "p",
            "pre",
            "strong",
            "table",
            "tbody",
            "td",
            "th",
            "thead",
            "tr",
            "ul",
        },
        attributes={"a": ["href", "title", "rel"]},
        protocols={"http", "https", "mailto"},
        strip=True,
    )
    cleaned = bleach.linkify(
        cleaned,
        callbacks=[_safe_link_attrs],
        skip_tags={"pre", "code"},
    )
    return REPORT_HTML_TEMPLATE.format(body=cleaned)


def render_pdf(markdown_body: str) -> bytes:
    html = markdown_to_html(markdown_body)
    try:
        from weasyprint import HTML

        return HTML(string=html).write_pdf()
    except Exception:
        # Windows dev machines often lack GTK/Pango libraries required by WeasyPrint.
        # Keep the API usable and return a readable fallback artifact.
        return (
            "%PDF-1.4\n"
            "% OpenBench fallback report artifact\n"
            "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
            "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n"
            "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n"
            "4 0 obj << /Length 94 >> stream\n"
            "BT /F1 12 Tf 72 720 Td (OpenBench handover generated. Use Markdown preview for full content.) Tj ET\n"
            "endstream endobj\n"
            "trailer << /Root 1 0 R >>\n%%EOF\n"
        ).encode("utf-8")
