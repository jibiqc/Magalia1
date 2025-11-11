from __future__ import annotations
from io import BytesIO
from typing import Optional, List

from docx import Document
from docx.shared import Cm, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from sqlalchemy.orm import Session

from .settings import WORD_TEMPLATE_PATH, COL_W_CM, COL_H_CM, DPI
from .image_utils import fetch_image_bytes, cover_crop_to_cm, contain_resize_to_width_cm
from .html_utils import sanitize_html, append_sanitized_html_to_docx
from ...api.quotes import _to_out
from ...models_quote import Quote


def _find_terms_heading_index(doc: Document) -> Optional[int]:
    """
    Find the index of the 'Essential Travel Terms and Conditions' heading.
    Returns paragraph index or None if not found.
    """
    target = "essential travel terms and conditions"
    for i, p in enumerate(doc.paragraphs):
        if p.text and p.text.strip().lower() == target:
            return i
    return None


def _insert_title(doc: Document, title: str) -> None:
    p = doc.add_paragraph()
    run = p.add_run(title or "")
    # Title style close to template visual: large, centered
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    font = run.font
    font.size = Pt(36)
    font.bold = True


def _set_cell_zero_margins(cell):
    """
    Remove inner cell margins to avoid gaps between side-by-side images.
    """
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    for tag in ("top", "start", "bottom", "end"):
        mar = OxmlElement(f"w:tcMar")
        # Not all Word processors honor per-side; we set generic cell margin to 0
    # Simpler: set tblCellMar on the parent table to 0; see _table_zero_margins
    return


def _table_zero_margins(tbl):
    """
    Force 0 cell spacing and margins for a table, to get 'no gap' between two images.
    """
    tblPr = tbl._tbl.tblPr
    # <w:tblCellMar w:top/bottom/left/right w:w="0" w:type="dxa"/>
    cellMar = OxmlElement("w:tblCellMar")
    for side in ("top", "bottom", "left", "right"):
        elm = OxmlElement(f"w:{side}")
        elm.set(qn("w:w"), "0")
        elm.set(qn("w:type"), "dxa")
        cellMar.append(elm)
    tblPr.append(cellMar)
    # <w:tblW w:w="0" w:type="auto"/> is default; alignment centered set on table
    # No explicit cell spacing element exists in docx; margins at 0 usually enough.
    return


def _insert_two_heroes(doc: Document, urls: List[str]) -> None:
    """
    Insert up to 2 images side-by-side as 'cover crop' at COL_W_CM x COL_H_CM.
    """
    urls = [u for u in (urls or []) if u]
    if not urls:
        return
    # Keep at most two
    urls = urls[:2] if len(urls) > 2 else urls
    tbl = doc.add_table(rows=1, cols=2)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    _table_zero_margins(tbl)
    # Fill each cell
    for idx in range(2):
        cell = tbl.cell(0, idx)
        paragraph = cell.paragraphs[0]
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if idx < len(urls):
            buf = fetch_image_bytes(urls[idx])
            if not buf:
                continue
            processed = cover_crop_to_cm(buf, COL_W_CM, COL_H_CM, DPI)
            if not processed:
                continue
            run = paragraph.add_run()
            run.add_picture(processed, width=Cm(COL_W_CM), height=Cm(COL_H_CM))
        else:
            # No placeholder for missing image; leave empty
            pass
    # spacer
    doc.add_paragraph("")


def _day_title_text(day) -> str:
    """
    Compose the day title: prefer date + destination if present, else date only.
    The API already provides ISO date string.
    Works with both dict and Pydantic objects.
    """
    date_txt = getattr(day, "date", None) or (day.get("date") if isinstance(day, dict) else None) or ""
    dest = getattr(day, "destination", None) or (day.get("destination") if isinstance(day, dict) else None) or ""
    dest = dest.strip() if dest else ""
    if date_txt and dest:
        return f"{date_txt}: {dest}"
    return date_txt or dest or ""


def _insert_day_block(doc: Document, day, usable_width_cm: float) -> None:
    # Day heroes - works with both dict and Pydantic objects
    day_heroes = getattr(day, "decorative_images", None) or (day.get("decorative_images") if isinstance(day, dict) else None) or []
    day_heroes = day_heroes[:2] if day_heroes else []
    if day_heroes:
        _insert_two_heroes(doc, day_heroes)
    # Day title
    p = doc.add_paragraph()
    run = p.add_run(_day_title_text(day))
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    font = run.font
    font.bold = True
    font.size = Pt(18)
    # Services - works with both dict and Pydantic objects
    lines = getattr(day, "lines", None) or (day.get("lines") if isinstance(day, dict) else None) or []
    for line in lines:
        # Title - works with both dict and Pydantic objects
        title = getattr(line, "title", None) or (line.get("title") if isinstance(line, dict) else None) or ""
        sp = doc.add_paragraph()
        sr = sp.add_run(title)
        sr.bold = True
        # Description (HTML sanitized → Word)
        desc = ""
        raw = getattr(line, "raw_json", None) or (line.get("raw_json") if isinstance(line, dict) else None) or {}
        # try common keys
        if isinstance(raw, dict):
            desc = raw.get("description") or raw.get("full_description") or ""
        if not desc:
            # keep empty if absent; still add a paragraph to match UI flow
            doc.add_paragraph("")
        else:
            paragraph = doc.add_paragraph()
            append_sanitized_html_to_docx(paragraph, desc)
        # Optional service image (contain, centered, full usable width)
        first_image_url = getattr(line, "first_image_url", None) or (line.get("first_image_url") if isinstance(line, dict) else None)
        if first_image_url:
            buf = fetch_image_bytes(first_image_url)
            if buf:
                processed = contain_resize_to_width_cm(buf, usable_width_cm, DPI)
                if processed:
                    ip = doc.add_paragraph()
                    ip.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    ip.add_run().add_picture(processed, width=Cm(usable_width_cm))
        # Small spacer between services
        doc.add_paragraph("")


def _compute_usable_width_cm(section) -> float:
    page_cm = section.page_width.cm
    left_cm = section.left_margin.cm
    right_cm = section.right_margin.cm
    return max(0.0, page_cm - left_cm - right_cm)


def build_docx_for_quote(db: Session, quote_id: int) -> BytesIO:
    """
    Build a .docx for the given quote id, using the repository template and inserting
    generated content before the Terms & Conditions heading.
    - Title uses display_title if present, else title.
    - Global heroes = hero_photo_1/2.
    - For each day: 2 heroes (decorative_images[0..1]), day title, services with
      title + sanitized HTML + optional image.
    Returns a BytesIO positioned at start.
    """
    # Re-query properly:
    q = db.query(Quote).filter(Quote.id == quote_id).first()
    if not q:
        raise ValueError("Quote not found")
    qout = _to_out(q, db=db, include_first_image=True)

    # Load template
    doc = Document(str(WORD_TEMPLATE_PATH))
    section = doc.sections[0]
    usable_width_cm = _compute_usable_width_cm(section)

    # Find T&C heading index
    tc_idx = _find_terms_heading_index(doc)
    # Strategy: append content at end, then if T&C exists, move T&C block to end after our content.
    # Simpler: if tc_idx exists, we will insert content before tc_idx by:
    # 1) Clone T&C paragraphs, 2) Clear document body, 3) Rebuild content, 4) Append cloned T&C.
    # python-docx has no direct paragraph insert; we rebuild to guarantee order.
    tc_paragraphs = []
    if tc_idx is not None:
        tc_paragraphs = doc.paragraphs[tc_idx:]  # references existing; we will read text only
        # Snapshot T&C texts (plain) to re-add at the end
        tc_texts = [p.text for p in tc_paragraphs]
        # Start a fresh doc with same section settings
        doc = Document()
        new_sec = doc.sections[0]
        new_sec.page_width = section.page_width
        new_sec.page_height = section.page_height
        new_sec.left_margin = section.left_margin
        new_sec.right_margin = section.right_margin
        new_sec.top_margin = section.top_margin
        new_sec.bottom_margin = section.bottom_margin
        # Generate content area now on fresh doc
        _insert_title(doc, qout.display_title or qout.title or "")
        # Global heroes (up to two)
        global_heroes = [qout.hero_photo_1, qout.hero_photo_2]
        global_heroes = [u for u in global_heroes if u]
        if global_heroes:
            _insert_two_heroes(doc, global_heroes)
        # Days
        for day in (qout.days or []):
            _insert_day_block(doc, day, usable_width_cm=usable_width_cm)
        # Page break then re-add T&C heading and texts
        doc.add_page_break()
        # Heading
        h = doc.add_paragraph()
        hr = h.add_run("Essential Travel Terms and Conditions")
        hr.bold = True
        hr.font.size = Pt(18)
        # Body as plain paragraphs (template had fixed text)
        for txt in tc_texts[1:] if len(tc_texts) > 1 else []:
            doc.add_paragraph(txt or "")
    else:
        # No T&C in template: just write content
        _insert_title(doc, qout.display_title or qout.title or "")
        global_heroes = [qout.hero_photo_1, qout.hero_photo_2]
        global_heroes = [u for u in global_heroes if u]
        if global_heroes:
            _insert_two_heroes(doc, global_heroes)
        for day in (qout.days or []):
            _insert_day_block(doc, day, usable_width_cm=usable_width_cm)

    # Save to memory
    out = BytesIO()
    doc.save(out)
    out.seek(0)
    return out

