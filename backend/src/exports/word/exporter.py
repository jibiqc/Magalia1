from __future__ import annotations
from io import BytesIO
from typing import Optional, List

from docx import Document
from docx.shared import Cm
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

from datetime import datetime


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


def _style_or(doc: Document, candidates: list[str], fallback: str = "Normal"):
    """Return a document style by trying several names."""
    for name in candidates:
        try:
            return doc.styles[name]
        except Exception:
            continue
    return doc.styles[fallback]

_WEEKDAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

def _ordinal(n: int) -> str:
    # English ordinal with special cases for 11/12/13
    if 10 <= (n % 100) <= 13:
        return f"{n}th"
    suf = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suf}"

def _fmt_date_long_en(iso_date: str) -> str:
    """Return 'Weekday, Month Do YYYY' in English from YYYY-MM-DD."""
    if not iso_date:
        return ""
    dt = datetime.strptime(iso_date, "%Y-%m-%d").date()
    wd = _WEEKDAYS[dt.weekday()]
    mo = _MONTHS[dt.month - 1]
    return f"{wd}, {mo} {_ordinal(dt.day)} {dt.year}"

def _is_first_of_dest_block(days: list, idx: int) -> bool:
    """True if this day is the first in a run of identical destination."""
    if idx < 0 or idx >= len(days):
        return False
    cur = (getattr(days[idx], "destination", None) if hasattr(days[idx], "destination")
           else (days[idx].get("destination") if isinstance(days[idx], dict) else None)) or ""
    if idx == 0:
        return True
    prev = (getattr(days[idx-1], "destination", None) if hasattr(days[idx-1], "destination")
            else (days[idx-1].get("destination") if isinstance(days[idx-1], dict) else None)) or ""
    return cur != prev

def _count_nights_from_index(days: list, idx: int) -> int:
    """Count consecutive days with the same destination starting at idx."""
    if idx < 0 or idx >= len(days):
        return 0
    cur = (getattr(days[idx], "destination", None) if hasattr(days[idx], "destination")
           else (days[idx].get("destination") if isinstance(days[idx], dict) else None)) or ""
    if not cur:
        # When destination is empty, UI prints date only; nights = 0
        return 0
    n = 0
    for j in range(idx, len(days)):
        dj = (getattr(days[j], "destination", None) if hasattr(days[j], "destination")
              else (days[j].get("destination") if isinstance(days[j], dict) else None)) or ""
        if dj == cur:
            n += 1
        else:
            break
    # UI labels "for N nights" counting days in that run (1 day => 1 night)
    return n


def _insert_title(doc: Document, title: str) -> None:
    p = doc.add_paragraph()
    p.style = _style_or(doc, ["Title"])
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run(title or "")


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
    # Remove table borders explicitly
    tblBorders = OxmlElement("w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        b = OxmlElement(f"w:{side}")
        b.set(qn("w:val"), "nil")
        tblBorders.append(b)
    tblPr.append(tblBorders)
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
    row = tbl.rows[0]
    # Fill each cell
    for i, url in enumerate(urls[:2]):
        cell = row.cells[i]
        paragraph = cell.paragraphs[0]
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        buf = fetch_image_bytes(url)
        if not buf:
            continue
        processed = cover_crop_to_cm(buf, COL_W_CM, COL_H_CM, DPI)
        if not processed:
            continue
        run = paragraph.add_run()
        run.add_picture(processed, width=Cm(COL_W_CM), height=Cm(COL_H_CM))
    # intentionally no blank paragraph here


def _compose_date_line(days: list, idx: int) -> str:
    """Match UI rules exactly for the date line text."""
    day = days[idx]
    date_iso = getattr(day, "date", None) if hasattr(day, "date") else day.get("date")
    dest = (getattr(day, "destination", None) if hasattr(day, "destination") else day.get("destination")) or ""
    longDate = _fmt_date_long_en(date_iso or "")
    if _is_first_of_dest_block(days, idx):
        n = _count_nights_from_index(days, idx)
        if dest and n > 0:
            return f"{longDate} : {dest} for {n} night{'s' if n>1 else ''}"
    return f"{longDate} :"


def _insert_day_block(doc: Document, days: list, day_idx: int, usable_width_cm: float) -> None:
    # Day 1 must NEVER have hero images
    day = days[day_idx]
    if day_idx > 0:
        day_heroes = ((getattr(day, "decorative_images", None) if hasattr(day, "decorative_images") else day.get("decorative_images")) or [])[:2]
        if day_heroes:
            _insert_two_heroes(doc, day_heroes)
    # Date line (exactly as UI)
    date_line = _compose_date_line(days, day_idx)
    if date_line:
        dp = doc.add_paragraph()
        dp.style = _style_or(doc, ["Date"])
        dp.add_run(date_line)
    # No separate "day title" paragraph in the UI beyond the date line; proceed to services
    day_lines = getattr(day, "lines", None) if hasattr(day, "lines") else (day.get("lines") if isinstance(day, dict) else None)
    for line in (day_lines or []):
        # Title
        sp = doc.add_paragraph()
        sp.style = _style_or(doc, ["Normal"])
        # Title comes from the UI data; we keep it as-is
        title = getattr(line, "title", None) if hasattr(line, "title") else (line.get("title") if isinstance(line, dict) else None)
        sr = sp.add_run(title or "")
        sr.bold = True
        # Description (HTML sanitized → Word)
        raw = getattr(line, "raw_json", None) if hasattr(line, "raw_json") else (line.get("raw_json") if isinstance(line, dict) else None)
        raw = raw or {}
        # try common keys
        desc = raw.get("description") if isinstance(raw, dict) else (getattr(raw, "description", None) or "")
        if not desc and isinstance(raw, dict):
            desc = raw.get("full_description") or ""
        if desc:
            paragraph = doc.add_paragraph()
            paragraph.style = _style_or(doc, ["Normal"])
            append_sanitized_html_to_docx(paragraph, desc)
        # Optional service image (contain, centered, full usable width)
        first_image_url = getattr(line, "first_image_url", None) if hasattr(line, "first_image_url") else (line.get("first_image_url") if isinstance(line, dict) else None)
        if first_image_url:
            buf = fetch_image_bytes(first_image_url)
            if buf:
                processed = contain_resize_to_width_cm(buf, usable_width_cm, DPI)
                if processed:
                    ip = doc.add_paragraph()
                    ip.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    ip.add_run().add_picture(processed, width=Cm(usable_width_cm))
        # Spacing controlled by styles; avoid empty paragraphs


def _compute_usable_width_cm(section) -> float:
    page_cm = section.page_width.cm
    left_cm = section.left_margin.cm
    right_cm = section.right_margin.cm
    return max(0.0, page_cm - left_cm - right_cm)


def _move_block_before(anchor_para, new_elements):
    """
    Move a list of block-level elements (p/tbl) before anchor_para.
    """
    parent = anchor_para._p.getparent()
    anchor = anchor_para._p
    for el in new_elements:
        parent.insert(parent.index(anchor), el)


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

    # Find T&C anchor paragraph (exact uppercase heading provided)
    tc_idx = _find_terms_heading_index(doc)
    if tc_idx is None:
        # No T&C found: append content at end
        p0 = doc.add_paragraph(); p0.style = _style_or(doc, ["Title"]); p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p0.add_run(qout.display_title or qout.title or "")
        global_heroes = [qout.hero_photo_1, qout.hero_photo_2]
        global_heroes = [u for u in global_heroes if u]
        if global_heroes:
            _insert_two_heroes(doc, global_heroes)
        for i, _day in enumerate(qout.days or []):
            _insert_day_block(doc, qout.days, i, usable_width_cm=usable_width_cm)
    else:
        anchor_para = doc.paragraphs[tc_idx]
        # Generate blocks at the end, then move them before the anchor
        start_body_len = len(doc.element.body)
        # Title
        p0 = doc.add_paragraph(); p0.style = _style_or(doc, ["Title"]); p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p0.add_run(qout.display_title or qout.title or "")
        # Global heroes
        global_heroes = [qout.hero_photo_1, qout.hero_photo_2]
        global_heroes = [u for u in global_heroes if u]
        if global_heroes:
            _insert_two_heroes(doc, global_heroes)
        # Days
        for i, _day in enumerate(qout.days or []):
            _insert_day_block(doc, qout.days, i, usable_width_cm=usable_width_cm)
        # Collect new block elements
        end_body_len = len(doc.element.body)
        new_elements = list(doc.element.body.iterchildren())[start_body_len:end_body_len]
        _move_block_before(anchor_para, new_elements)

    # Save to memory
    out = BytesIO()
    doc.save(out)
    out.seek(0)
    return out

