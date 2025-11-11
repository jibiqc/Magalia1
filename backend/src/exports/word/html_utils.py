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
    Minimal HTML → Word:
    - <p>/<br>: new paragraphs only when needed (no duplicates)
    - <a>: clickable hyperlink runs
    - <ul>/<ol>/<li>: plain paragraphs with simple bullet/number prefix to avoid template style drift
    """
    safe = sanitize_html(html)
    import re

    def _emit_text_or_link(p: Paragraph, chunk: str):
        pos = 0
        for m in re.finditer(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', chunk, flags=re.I):
            before = bleach.clean(chunk[pos:m.start()], tags=[], strip=True)
            if before:
                p.add_run(before)
            url, text = m.group(1), bleach.clean(m.group(2), tags=[], strip=True)
            if url and text:
                _add_hyperlink(p, url, text)
            pos = m.end()
        tail = bleach.clean(chunk[pos:], tags=[], strip=True)
        if tail:
            p.add_run(tail)

    # Normalize paragraphs and lists
    # Convert </p> to \n markers, strip <p>, handle <br> as line breaks
    text = safe.replace("</p>", "\n").replace("<p>", "")
    # Lists: split blocks for <ul> and <ol>
    # We render each <li> as its own Normal paragraph with a simple prefix.
    # Unordered
    def _render_list(par: Paragraph, block: str, ordered: bool):
        items = re.findall(r"<li>(.*?)</li>", block, flags=re.I | re.S)
        for i, raw in enumerate(items, 1):
            newp = par._parent.add_paragraph()
            newp.style = par.style
            prefix = f"{i}. " if ordered else "• "
            newp.add_run(prefix)
            _emit_text_or_link(newp, raw)

    # Process lists first
    def _strip_lists(s: str, par: Paragraph) -> str:
        # Ordered lists
        for m in re.finditer(r"<ol>(.*?)</ol>", s, flags=re.I | re.S):
            _render_list(par, m.group(1), ordered=True)
        s = re.sub(r"<ol>.*?</ol>", "", s, flags=re.I | re.S)
        # Unordered lists
        for m in re.finditer(r"<ul>(.*?)</ul>", s, flags=re.I | re.S):
            _render_list(par, m.group(1), ordered=False)
        s = re.sub(r"<ul>.*?</ul>", "", s, flags=re.I | re.S)
        return s

    text = _strip_lists(text, paragraph)
    # Split leftover by explicit paragraph breaks
    for idx, blk in enumerate([b for b in text.split("\n") if b.strip()]):
        if idx == 0:
            _emit_text_or_link(paragraph, blk)
        else:
            newp = paragraph._parent.add_paragraph()
            newp.style = paragraph.style
            _emit_text_or_link(newp, blk)

