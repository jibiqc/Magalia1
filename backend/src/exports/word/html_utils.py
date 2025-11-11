import bleach
from docx.text.paragraph import Paragraph
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

# Whitelist agreed
ALLOWED_TAGS = ["b", "strong", "i", "em", "ul", "ol", "li", "a", "p", "br"]
ALLOWED_ATTRS = {"a": ["href", "title"]}

def sanitize_html(html: str) -> str:
    return bleach.clean(html or "", tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)

def _add_hyperlink(paragraph: Paragraph, url: str, text: str) -> None:
    """
    Create a clickable hyperlink in a paragraph.
    """
    # Build w:hyperlink with a relationship id on the part
    part = paragraph.part
    r_id = part.relate_to(url, reltype="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), r_id)
    # Create run
    new_run = OxmlElement("w:r")
    rPr = OxmlElement("w:rPr")
    # Apply basic hyperlink style (blue + underline by Word default style)
    rStyle = OxmlElement("w:rStyle")
    rStyle.set(qn("w:val"), "Hyperlink")
    rPr.append(rStyle)
    new_run.append(rPr)
    t = OxmlElement("w:t")
    t.text = text
    new_run.append(t)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)

def append_sanitized_html_to_docx(paragraph: Paragraph, html: str) -> None:
    """
    Very small mapper: split by <br>, convert <a> to hyperlink runs, keep bold/italic via Word default if source is simple.
    For lists, caller should create separate paragraphs; here we render inline text segments and links.
    """
    safe = sanitize_html(html)
    # naive split preserving <a href>…</a> using bleach linkify as fallback
    # For simplicity, rely on bleach to convert bare URLs to <a> and then parse minimal tags.
    # We keep paragraphs simple: hyperlinks and plain text runs separated by <br>.
    # More advanced block mapping will be handled in the exporter step.
    parts = safe.replace("</p>", "<br>").replace("<p>", "").split("<br>")
    first = True
    for block in parts:
        if not first:
            paragraph = paragraph._element.addnext(paragraph._element)  # force a new paragraph logically
        first = False
        # crude parsing for <a href="...">text</a>
        # This keeps implementation short; exporter can expand if needed.
        import re
        pos = 0
        for m in re.finditer(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', block, flags=re.I):
            before = bleach.clean(block[pos:m.start()], tags=[], strip=True)
            if before:
                paragraph.add_run(before)
            url, text = m.group(1), bleach.clean(m.group(2), tags=[], strip=True)
            if url and text:
                _add_hyperlink(paragraph, url, text)
            pos = m.end()
        tail = bleach.clean(block[pos:], tags=[], strip=True)
        if tail:
            paragraph.add_run(tail)

