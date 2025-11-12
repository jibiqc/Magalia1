import bleach
from docx.text.paragraph import Paragraph
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt
from .settings import TEXT_COLOR, NORMAL_PT, DAY_PT

# Whitelist agreed
ALLOWED_TAGS = ["b", "strong", "i", "em", "ul", "ol", "li", "a", "p", "br"]
ALLOWED_ATTRS = {"a": ["href", "title"]}

def _apply_run_defaults(run):
    run.font.name = "Arial"
    run.font.size = Pt(NORMAL_PT)
    run.font.color.rgb = TEXT_COLOR
    run.italic = False  # no italics by default
    return run

def sanitize_html(html: str) -> str:
    return bleach.clean(html or "", tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)

def add_hyperlink(paragraph: Paragraph, url: str, text: str) -> None:
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
    # Apply color and underline
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "002060")
    rPr.append(color)
    u = OxmlElement("w:u")
    u.set(qn("w:val"), "single")
    rPr.append(u)
    new_run.append(rPr)
    t = OxmlElement("w:t")
    t.text = text
    new_run.append(t)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)

def append_sanitized_html_to_docx(paragraph: Paragraph, html: str, allow_italic: bool = False) -> None:
    """
    Minimal HTML → Word:
    - <p>/<br>: new paragraphs only when needed (no duplicates)
    - <a>: clickable hyperlink runs
    - <ul>/<ol>/<li>: plain paragraphs with simple bullet/number prefix to avoid template style drift
    """
    safe = sanitize_html(html)
    import re

    def _emit_text_or_link(p: Paragraph, chunk: str, allow_italic: bool = False):
        # Gérer les balises <strong> et <b> pour le gras
        # D'abord, traiter les liens
        pos = 0
        for m in re.finditer(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', chunk, flags=re.I):
            # Texte avant le lien (peut contenir <strong>)
            before = chunk[pos:m.start()]
            _add_text_with_formatting(p, before, allow_italic)
            # Lien
            url, text = m.group(1), bleach.clean(m.group(2), tags=[], strip=True)
            if url and text:
                add_hyperlink(p, url, text)
            pos = m.end()
        # Texte après le dernier lien (peut contenir <strong>)
        tail = chunk[pos:]
        _add_text_with_formatting(p, tail, allow_italic)
    
    def _add_text_with_formatting(p: Paragraph, text: str, allow_italic: bool = False):
        """Ajoute du texte en préservant le formatage <strong>/<b> pour le gras."""
        if not text:
            return
        # Extraire les segments avec/sans gras
        pos = 0
        for m in re.finditer(r'<(strong|b)>(.*?)</(strong|b)>', text, flags=re.I):
            # Texte avant le gras
            before = bleach.clean(text[pos:m.start()], tags=[], strip=True)
            if before:
                run = p.add_run(before)
                if not allow_italic:
                    run = _apply_run_defaults(run)
            # Texte en gras
            bold_text = bleach.clean(m.group(2), tags=[], strip=True)
            if bold_text:
                run = p.add_run(bold_text)
                run.font.bold = True
                run.font.name = "Arial"
                run.font.size = Pt(NORMAL_PT)
                run.font.color.rgb = TEXT_COLOR
                if allow_italic:
                    run.font.italic = True
            pos = m.end()
        # Texte restant après le dernier gras
        remaining = bleach.clean(text[pos:], tags=[], strip=True)
        if remaining:
            run = p.add_run(remaining)
            if not allow_italic:
                run = _apply_run_defaults(run)

    # Normalize paragraphs and lists
    # Convert </p> to \n markers, strip <p>, handle <br> as line breaks
    text = safe.replace("</p>", "\n").replace("<p>", "")
    # Lists: split blocks for <ul> and <ol>
    # We render each <li> as its own Normal paragraph with a simple prefix.
    # Unordered
    def _render_list(par: Paragraph, block: str, ordered: bool, allow_italic: bool = False):
        items = re.findall(r"<li>(.*?)</li>", block, flags=re.I | re.S)
        for i, raw in enumerate(items, 1):
            newp = par._parent.add_paragraph()
            newp.style = par.style
            prefix = f"{i}. " if ordered else "• "
            run = newp.add_run(prefix)
            if not allow_italic:
                run = _apply_run_defaults(run)
            _emit_text_or_link(newp, raw, allow_italic=allow_italic)

    # Process lists first
    def _strip_lists(s: str, par: Paragraph, allow_italic: bool = False) -> str:
        # Ordered lists
        for m in re.finditer(r"<ol>(.*?)</ol>", s, flags=re.I | re.S):
            _render_list(par, m.group(1), ordered=True, allow_italic=allow_italic)
        s = re.sub(r"<ol>.*?</ol>", "", s, flags=re.I | re.S)
        # Unordered lists
        for m in re.finditer(r"<ul>(.*?)</ul>", s, flags=re.I | re.S):
            _render_list(par, m.group(1), ordered=False, allow_italic=allow_italic)
        s = re.sub(r"<ul>.*?</ul>", "", s, flags=re.I | re.S)
        return s

    text = _strip_lists(text, paragraph, allow_italic=allow_italic)
    # Split leftover by explicit paragraph breaks
    for idx, blk in enumerate([b for b in text.split("\n") if b.strip()]):
        if idx == 0:
            _emit_text_or_link(paragraph, blk, allow_italic=allow_italic)
        else:
            newp = paragraph._parent.add_paragraph()
            newp.style = paragraph.style
            _emit_text_or_link(newp, blk, allow_italic=allow_italic)

