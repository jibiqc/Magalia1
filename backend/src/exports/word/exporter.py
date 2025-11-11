from __future__ import annotations
from io import BytesIO
from typing import Optional, List
import re
import math
from datetime import date

from docx import Document
from docx.shared import Cm, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from sqlalchemy.orm import Session

from .settings import WORD_TEMPLATE_PATH, COL_W_CM, COL_H_CM, DPI
from .image_utils import fetch_image_bytes, cover_crop_to_cm, contain_resize_to_width_cm, make_two_up_cover, jpeg_bytes, ensure_jpeg
from .html_utils import sanitize_html, append_sanitized_html_to_docx, add_hyperlink
from ...api.quotes import _to_out
from ...models_quote import Quote

# --- Styles helpers: use template styles exactly, no overrides ---
STYLE_TITLE = "Title"     # Arial 28 Bold, DarkBlue, Center, SpaceAfter=0
STYLE_DATE = "Date"       # Arial 10 Underline, DarkBlue, SpaceAfter=0
STYLE_DAYTITLE = "DayTitle"  # Arial 10 Bold, DarkBlue, SpaceAfter=0
STYLE_NORMAL = "Normal"   # Arial 10, DarkBlue

def _style_or(doc: Document, name_or_candidates, fallback: str = "Normal"):
    """Return a document style by trying a name or list of candidate names."""
    if isinstance(name_or_candidates, list):
        for name in name_or_candidates:
            try:
                return doc.styles[name]
            except (KeyError, AttributeError):
                continue
        return doc.styles[fallback]
    else:
        try:
            return doc.styles[name_or_candidates]
        except KeyError:
            return doc.styles[fallback]

def _p(doc: Document, style_name: str):
    p = doc.add_paragraph()
    p.style = _style_or(doc, style_name)
    return p

def _zero_after(p):
    fmt = p.paragraph_format
    fmt.space_after = Pt(0)
    return p

# --- Date formatting identical to UI, English locale, ordinals ---
_EN_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
_EN_MONTHS = [None, "January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"]

def _ordinal(d: int) -> str:
    if 11 <= d % 100 <= 13:
        return f"{d}th"
    return f"{d}{['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][d % 10]}"

def _fmt_long_en(iso_date: str) -> str:
    if not iso_date:
        return ""
    y, m, d = map(int, iso_date.split("-"))
    dt = date(y, m, d)
    dn = _EN_DAYS[dt.weekday()]  # Monday=0
    mn = _EN_MONTHS[m]
    return f"{dn}, {mn} {_ordinal(d)} {y}"

def _is_first_of_dest_block(days, idx: int) -> bool:
    if idx <= 0:
        return True
    day_curr = days[idx]
    day_prev = days[idx-1]
    curr_dest = (getattr(day_curr, "destination", None) if hasattr(day_curr, "destination") else (day_curr.get("destination") if isinstance(day_curr, dict) else None)) or ""
    prev_dest = (getattr(day_prev, "destination", None) if hasattr(day_prev, "destination") else (day_prev.get("destination") if isinstance(day_prev, dict) else None)) or ""
    return curr_dest != prev_dest

def _count_nights_from_index(days, idx: int) -> int:
    day = days[idx]
    dest = (getattr(day, "destination", None) if hasattr(day, "destination") else (day.get("destination") if isinstance(day, dict) else None)) or ""
    if not dest:
        return 0
    n = 1
    i = idx + 1
    while i < len(days):
        di = days[i]
        di_dest = (getattr(di, "destination", None) if hasattr(di, "destination") else (di.get("destination") if isinstance(di, dict) else None)) or ""
        if di_dest == dest:
            n += 1
            i += 1
        else:
            break
    return n

def _compose_day_title(days, idx: int) -> str:
    d = days[idx]
    date_iso = getattr(d, "date", None) if hasattr(d, "date") else (d.get("date") if isinstance(d, dict) else None)
    base = _fmt_long_en(date_iso or "") + " :"
    if _is_first_of_dest_block(days, idx):
        n = _count_nights_from_index(days, idx)
        dest = (getattr(d, "destination", None) if hasattr(d, "destination") else (d.get("destination") if isinstance(d, dict) else None)) or ""
        if dest and n > 0:
            s = "night" if n == 1 else "nights"
            return f"{base} {dest} for {n} {s}"
    return base

# --- Service title composition (identical to ServiceCard.jsx) ---
def _norm_yes(v) -> bool:
    s = str(v or "").lower()
    return s == "1" or s == "yes" or ("breakfast" in s)

def _norm_stars(v) -> str:
    s = str(v or "").strip()
    if not s:
        return ""
    try:
        n = float(re.sub(r"[^\d.]", "", s) or "0")
    except Exception:
        n = 0
    if not (n > 0):
        return ""
    k = max(1, min(5, int(round(n))))
    return " " + ("★" * k)

def _infer_room(title: str) -> str:
    t = (title or "")
    t = re.sub(r"\bat\b.*$", "", t, flags=re.I).strip()
    t = re.sub(r"^(hotel\s*)?room\b[:\-]?\s*", "", t, flags=re.I).strip()
    return t or "Room"

def _fmt_ampm(hhmm: str) -> str:
    if not hhmm:
        return ""
    parts = (hhmm or "").split(":")
    h = int(parts[0] or "0")
    m = (parts[1] if len(parts) > 1 else "00").zfill(2)
    suf = "pm" if h >= 12 else "am"
    h = (h % 12) or 12
    return f"{h}:{m} {suf}"

def _compose_service_title(line) -> str:
    title = (getattr(line, "title", None) or getattr(line, "category", None) or "Service")
    cat = (getattr(line, "category", None) or "").strip()
    raw = getattr(line, "raw_json", None) or {}
    if not isinstance(raw, dict):
        raw = {}
    fields = (raw.get("fields") or {}) if isinstance(raw.get("fields"), dict) else {}
    
    # HOTEL
    if cat == "Hotel":
        room = raw.get("room_type") or (fields.get("room_type") if isinstance(fields, dict) else None) or _infer_room(title)
        company = raw.get("hotel_name") or getattr(line, "supplier_name", None) or ""
        stars = _norm_stars(raw.get("hotel_stars") or (fields.get("hotel_stars") if isinstance(fields, dict) else None))
        bf_from_json = (
            "breakfast & VAT included" if raw.get("breakfast") is True
            else "VAT included" if raw.get("breakfast") is False
            else None
        )
        bf = bf_from_json or ("breakfast & VAT included" if _norm_yes(fields.get("meal_1") if isinstance(fields, dict) else None) else "VAT included")
        eci = ", early check-in guaranteed" if raw.get("early_check_in") else ""
        return f"{room}{eci}, {bf} at {company}{stars}"
    
    # ACTIVITÉ
    if cat in ("Activity", "Small Group", "Private"):
        st = raw.get("start_time") or (fields.get("start_time") if isinstance(fields, dict) else None) or ""
        if st:
            return f"{title} at {_fmt_ampm(st) if ':' in st else st}"
        return title
    
    # TRANSPORTS ET AUTRES: ne pas tronquer; afficher tel quel
    return title

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
    p = doc.add_paragraph(title or "", style=_style_or(doc, ["Title", "Heading 1", "Normal"]))
    _zero_after(p)

def _insert_two_heroes(doc: Document, left_url: str, right_url: str, usable_w_cm: float) -> None:
    # Nouvelle implémentation: une seule image composée, zéro espace.
    if not (left_url and right_url):
        return
    from PIL import Image
    left_buf = fetch_image_bytes(left_url)
    right_buf = fetch_image_bytes(right_url)
    if not (left_buf and right_buf):
        return
    L = ensure_jpeg(left_buf)
    R = ensure_jpeg(right_buf)
    # Hauteur cible identique à l'existant: 5.14 cm par image => total largeur = 2 * 7.3 cm
    single_w_cm = usable_w_cm / 2.0
    composed = make_two_up_cover(L, R, single_w_cm, COL_H_CM, DPI)
    jpeg_data = jpeg_bytes(composed)
    # Créer un paragraphe pour l'image
    p = _p(doc, STYLE_NORMAL)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    picture = run.add_picture(BytesIO(jpeg_data))
    # Ajuster à la largeur utile de la page
    picture.width = Cm(usable_w_cm)
    # s'assurer qu'aucun espace après
    _zero_after(p)

def _insert_day_block(doc: Document, days, day, day_idx: int, usable_w_cm: float) -> None:
    # Héros du jour (sauf s'il n'y en a pas)
    if day_idx > 0:
        day_heroes = (getattr(day, "decorative_images", None) if hasattr(day, "decorative_images") else (day.get("decorative_images") if isinstance(day, dict) else None)) or []
        if len(day_heroes) >= 2:
            left, right = day_heroes[0], day_heroes[1]
            _insert_two_heroes(doc, left, right, usable_w_cm)
    
    # Titre de jour
    p = doc.add_paragraph(_compose_day_title(days, day_idx), style=_style_or(doc, ["Date", "Heading 3", "Normal"]))
    _zero_after(p)
    
    # Services
    _render_day_services(doc, day, usable_w_cm)

def _insert_service(doc: Document, line, usable_w_cm: float) -> None:
    # Titre
    title = _compose_service_title(line).strip()
    p = doc.add_paragraph(title, style=_style_or(doc, ["DayTitle", "Heading 4", "Normal"]))
    _zero_after(p)
    
    # Description HTML (sanitisée)
    raw = getattr(line, "raw_json", None) or {}
    if not isinstance(raw, dict):
        raw = {}
    fields = raw.get("fields", {}) if isinstance(raw.get("fields"), dict) else {}
    html = raw.get("description") or (fields.get("full_description") if isinstance(fields, dict) else None) or ""
    if html:
        from .html_utils import append_sanitized_html_to_docx
        p_desc = _p(doc, STYLE_NORMAL)
        append_sanitized_html_to_docx(p_desc, html)
        _zero_after(p_desc)
    
    # Lien hôtel si présent
    hotel_url = (raw.get("hotel_url") or (fields.get("hotel_url") if isinstance(fields, dict) else None))
    if hotel_url and (getattr(line, "category", None) or "") == "Hotel":
        p_url = doc.add_paragraph("", style=_style_or(doc, ["Normal"]))
        add_hyperlink(p_url, hotel_url, hotel_url)
        _zero_after(p_url)
    
    # Optional service image (contain, centered, full usable width)
    first_image_url = getattr(line, "first_image_url", None) if hasattr(line, "first_image_url") else (line.get("first_image_url") if isinstance(line, dict) else None)
    if first_image_url:
        buf = fetch_image_bytes(first_image_url)
        if buf:
            processed = contain_resize_to_width_cm(buf, usable_w_cm, DPI)
            if processed:
                ip = _p(doc, STYLE_NORMAL)
                ip.alignment = WD_ALIGN_PARAGRAPH.CENTER
                ip.add_run().add_picture(processed, width=Cm(usable_w_cm))
                _zero_after(ip)

def _render_day_services(doc: Document, day, usable_w_cm: float) -> None:
    allowed = {"Hotel", "Activity", "Small Group", "Private", "Private Transfer", "Transfer", "Flight", "Train", "Rail", "Ferry", "Car Rental", "Trip info", "Internal info"}
    day_lines = getattr(day, "lines", None) if hasattr(day, "lines") else (day.get("lines") if isinstance(day, dict) else None)
    for line in (day_lines or []):
        if (getattr(line, "visibility", None) or "client") != "client":
            continue
        cat = (getattr(line, "category", None) or "")
        if cat not in allowed:
            # ne pas exclure silencieusement, mais on pourrait consigner si besoin
            pass
        _insert_service(doc, line, usable_w_cm)

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
        # Titre global
        _insert_title(doc, getattr(qout, "display_title", None) or getattr(qout, "title", None) or "")
        # Global heroes
        global_heroes = [getattr(qout, "hero_photo_1", None), getattr(qout, "hero_photo_2", None)]
        global_heroes = [u for u in global_heroes if u]
        if len(global_heroes) >= 2:
            _insert_two_heroes(doc, global_heroes[0], global_heroes[1], usable_width_cm)
        for i, day in enumerate(qout.days or []):
            _insert_day_block(doc, qout.days, day, i, usable_width_cm)
    else:
        anchor_para = doc.paragraphs[tc_idx]
        # Generate blocks at the end, then move them before the anchor
        start_body_len = len(doc.element.body)
        # Titre global
        _insert_title(doc, getattr(qout, "display_title", None) or getattr(qout, "title", None) or "")
        # Global heroes
        global_heroes = [getattr(qout, "hero_photo_1", None), getattr(qout, "hero_photo_2", None)]
        global_heroes = [u for u in global_heroes if u]
        if len(global_heroes) >= 2:
            _insert_two_heroes(doc, global_heroes[0], global_heroes[1], usable_width_cm)
        # Days
        for i, day in enumerate(qout.days or []):
            _insert_day_block(doc, qout.days, day, i, usable_width_cm)
        # Collect new block elements
        end_body_len = len(doc.element.body)
        new_elements = list(doc.element.body.iterchildren())[start_body_len:end_body_len]
        _move_block_before(anchor_para, new_elements)

    # Save to memory
    out = BytesIO()
    doc.save(out)
    out.seek(0)
    return out
