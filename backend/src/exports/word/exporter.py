from __future__ import annotations
from io import BytesIO
from typing import Optional, List
import re
import calendar
from datetime import datetime

from docx import Document
from docx.shared import Cm, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.text.paragraph import Paragraph

from sqlalchemy.orm import Session

from .settings import (
    WORD_TEMPLATE_PATH, HERO_W_CM, HERO_H_CM,
    TEXT_COLOR, TITLE_PT, DAY_PT, DATE_PT, NORMAL_PT,
    SP_AFTER_NORMAL_PT, SP_BEFORE_ALL_PT, SP_AFTER_ALL_PT
)
from .image_utils import fetch_image_bytes, contain_resize_to_width_cm, stitch_side_by_side_to_cm
from .html_utils import append_sanitized_html_to_docx, add_hyperlink
from ...models_quote import Quote

# --- Date formatting identical to UI, English locale, ordinals ---
ORD = {1: "st", 2: "nd", 3: "rd"}

def _ordinal(n: int) -> str:
    return f"{n}{ORD.get(0 if 10 <= n % 100 <= 20 else n % 10, 'th')}"

def fmt_ui_date(d_iso: str) -> str:
    # "Tuesday, November 11th 2025 :"
    dt = datetime.fromisoformat(d_iso)
    wd = calendar.day_name[dt.weekday()]
    month = calendar.month_name[dt.month]
    return f"{wd}, {month} {_ordinal(dt.day)} {dt.year} :"

def _is_first_of_dest_block(days, idx):
    cur = (_get_attr(days[idx], "destination") or "").strip()
    if not cur:
        return False
    if idx == 0:
        return True
    prev = (_get_attr(days[idx-1], "destination") or "").strip()
    return cur != prev

def _count_nights_from_index(days, idx):
    cur = (_get_attr(days[idx], "destination") or "").strip()
    n = 1
    j = idx + 1
    while j < len(days) and (_get_attr(days[j], "destination") or "").strip() == cur:
        n += 1
        j += 1
    return n

# --- Paragraph factories ---
def _set_par_spacing(p, before_pt=SP_BEFORE_ALL_PT, after_pt=SP_AFTER_ALL_PT, line_single=True):
    p.paragraph_format.space_before = Pt(before_pt)
    p.paragraph_format.space_after = Pt(after_pt)
    if line_single:
        p.paragraph_format.line_spacing = 1.0

def _add_title(doc: Document, text: str):
    # Titre global : Arial 28, gras, couleur #002060, centré
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.font.name = "Arial"
    r.font.size = Pt(TITLE_PT)
    r.font.bold = True
    r.font.color.rgb = TEXT_COLOR
    r.italic = False
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _set_par_spacing(p, before_pt=SP_BEFORE_ALL_PT, after_pt=SP_AFTER_ALL_PT)
    # ← ajout : insérer une ligne vide après le titre
    doc.add_paragraph()
    return p

def _add_date_line(doc: Document, text: str):
    # Date: Arial 10, underlined, NOT bold, color; after 0; no italics
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.font.name = "Arial"
    r.font.size = Pt(DATE_PT)
    r.font.bold = False
    r.underline = True
    r.font.color.rgb = TEXT_COLOR
    r.italic = False
    _set_par_spacing(p, before_pt=SP_BEFORE_ALL_PT, after_pt=SP_AFTER_ALL_PT)
    return p

def _add_day_title(doc: Document, text: str):
    # Day/service titles: Arial 10, bold, color; after 0
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.font.name = "Arial"
    r.font.size = Pt(DAY_PT)
    r.font.bold = True
    r.font.color.rgb = TEXT_COLOR
    r.italic = False
    _set_par_spacing(p, before_pt=SP_BEFORE_ALL_PT, after_pt=SP_AFTER_ALL_PT)
    return p

def _add_normal(doc: Document, text: str):
    # Normal: Arial 10, color; after 10 pt; no italics
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.font.name = "Arial"
    r.font.size = Pt(NORMAL_PT)
    r.font.color.rgb = TEXT_COLOR
    r.italic = False
    _set_par_spacing(p, before_pt=SP_BEFORE_ALL_PT, after_pt=SP_AFTER_NORMAL_PT)
    return p

def _blank_line(doc: Document):
    p = doc.add_paragraph()
    _set_par_spacing(p, before_pt=SP_BEFORE_ALL_PT, after_pt=SP_AFTER_ALL_PT)
    return p

def _add_title_with_html_formatting(p: Paragraph, html_text: str):
    """Ajoute un titre avec formatage HTML (gras pour <strong>/<b>)."""
    import re
    import bleach
    
    # Extraire les segments avec/sans gras
    pos = 0
    for m in re.finditer(r'<(strong|b)>(.*?)</(strong|b)>', html_text, flags=re.I):
        # Texte avant le gras
        before = bleach.clean(html_text[pos:m.start()], tags=[], strip=True)
        if before:
            run = p.add_run(before)
            run.font.name = "Arial"
            run.font.size = Pt(DAY_PT)
            run.font.bold = True  # Titre en gras par défaut
            run.font.color.rgb = TEXT_COLOR
            run.font.italic = False
        # Texte en gras (déjà en gras, donc on garde)
        bold_text = bleach.clean(m.group(2), tags=[], strip=True)
        if bold_text:
            run = p.add_run(bold_text)
            run.font.bold = True
            run.font.name = "Arial"
            run.font.size = Pt(DAY_PT)
            run.font.color.rgb = TEXT_COLOR
            run.font.italic = False
        pos = m.end()
    # Texte restant après le dernier gras
    remaining = bleach.clean(html_text[pos:], tags=[], strip=True)
    if remaining:
        run = p.add_run(remaining)
        run.font.name = "Arial"
        run.font.size = Pt(DAY_PT)
        run.font.bold = True  # Titre en gras par défaut
        run.font.color.rgb = TEXT_COLOR
        run.font.italic = False
    # Si pas de HTML, ajouter tout le texte en gras
    if not re.search(r'<(strong|b)>', html_text, flags=re.I):
        clean_text = bleach.clean(html_text, tags=[], strip=True)
        if clean_text:
            run = p.add_run(clean_text)
            run.font.name = "Arial"
            run.font.size = Pt(DAY_PT)
            run.font.bold = True
            run.font.color.rgb = TEXT_COLOR
            run.font.italic = False

# --- Helper pour accéder aux attributs (dict ou objet) ---
def _get_attr(obj, key, default=None):
    """Helper pour accéder à un attribut/clé d'un objet ou dictionnaire."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)

# --- Service title composition (identical to ServiceCard.jsx) ---
def _norm_yes(v) -> bool:
    s = str(v or "").lower()
    return s == "1" or s == "yes" or "breakfast" in s

def _norm_stars(v) -> str:
    s = str(v or "").strip()
    if not s:
        return ""
    try:
        n = round(float("".join(ch for ch in s if (ch.isdigit() or ch == "."))))
    except Exception:
        return ""
    n = max(1, min(5, n))
    return " " + "★" * n

def _infer_room(t: str) -> str:
    t = (t or "")
    t = re.sub(r"\bat\b.*$", "", t, flags=re.I)
    t = re.sub(r"^(hotel\s*)?room\b[:\-]?\s*", "", t, flags=re.I).strip()
    return t or "Room"

def _fmt_ampm(hhmm: str) -> str:
    if not hhmm:
        return ""
    parts = hhmm.split(":")
    h = int(parts[0] or "0")
    m = (parts[1] if len(parts) > 1 else "00").zfill(2)
    suf = "pm" if h >= 12 else "am"
    h = (h % 12) or 12
    return f"{h}:{m} {suf}"

def _fmt_service_title(line):
    cat = (_get_attr(line, "category") or "").strip()
    title = _get_attr(line, "title") or cat or "Service"
    rj = _get_attr(line, "raw_json", {}) or {}

    # HOTEL
    if cat == "Hotel":
        isCatalog = bool(rj.get("catalog_id"))
        if isCatalog:
            room = (rj.get("room_type") or "").strip()
            company = (rj.get("hotel_name") or _get_attr(line, "provider_name") or _get_attr(line, "supplier_name") or "").strip()
            stars = _norm_stars(rj.get("hotel_stars"))
        else:
            room = _infer_room(title)
            company = _get_attr(line, "provider_name") or _get_attr(line, "supplier_name") or ""
            stars = _norm_stars(rj.get("hotel_stars"))
        bf_json = rj.get("breakfast")
        if bf_json is True:
            bf = "breakfast & VAT included"
        elif bf_json is False:
            bf = "VAT included"
        else:
            bf = "breakfast & VAT included" if _norm_yes(rj.get("meal_1")) else "VAT included"
        eci = ", early check-in guaranteed" if rj.get("early_check_in") else ""
        title = f"{room}{eci}, {bf} at {company}{stars}"

    # ACTIVITÉS
    elif cat in ("Activity", "Small Group", "Private"):
        st = rj.get("start_time") or ""
        if st:
            # Utiliser _fmt_ampm si le format contient ":"
            st_formatted = _fmt_ampm(st) if ":" in st else st
            title = f"{title} at {st_formatted}"

    # TRANSPORTS
    elif cat in ("Private Transfer", "Flight", "Train", "Ferry", "Car Rental"):
        # Afficher tel quel, pas de normalisation destructrice
        title = _get_attr(line, "title") or title

    return title

def _is_trip_info(line) -> bool:
    return (_get_attr(line, "category") or "").strip() == "Trip info"

def _append_hotel_url_if_any(doc, line):
    raw_json = _get_attr(line, "raw_json", {}) or {}
    url = (raw_json.get("hotel_url") or "").strip()
    if url:
        p = doc.add_paragraph()
        r = p.add_run(url)
        r.font.name = "Arial"
        r.font.size = Pt(NORMAL_PT)
        r.font.color.rgb = TEXT_COLOR
        r.underline = True
        r.italic = False
        _set_par_spacing(p, before_pt=SP_BEFORE_ALL_PT, after_pt=SP_AFTER_NORMAL_PT)

def _insert_two_heroes(doc: Document, url1: str, url2: str):
    if not url1 or not url2:
        return
    # Pas d'espace avant la photo
    try:
        jpeg = stitch_side_by_side_to_cm(url1, url2, width_cm=HERO_W_CM, height_cm=HERO_H_CM)
        p = doc.add_paragraph()
        run = p.add_run()
        run.add_picture(BytesIO(jpeg), width=Cm(HERO_W_CM), height=Cm(HERO_H_CM))
        _set_par_spacing(p, before_pt=SP_BEFORE_ALL_PT, after_pt=SP_AFTER_ALL_PT)
        # Un espace (ligne vide) après la photo
        _blank_line(doc)
    except Exception:
        pass  # Skip if image fetch fails

def _render_service(doc: Document, line, usable_width_cm: float):
    cat = (_get_attr(line, "category") or "").strip()
    rj = _get_attr(line, "raw_json", {}) or {}
    
    # 1) Titre - toujours affiché
    title = _fmt_service_title(line)
    if title:
        # Pour Trip info, titre en italique
        if cat == "Trip info":
            p = doc.add_paragraph()
            r = p.add_run(title)
            r.font.name = "Arial"
            r.font.size = Pt(DAY_PT)
            r.font.bold = False  # Pas de gras pour Trip info
            r.font.italic = True  # Italique pour Trip info
            r.font.color.rgb = TEXT_COLOR
            _set_par_spacing(p, before_pt=SP_BEFORE_ALL_PT, after_pt=SP_AFTER_ALL_PT)
        # Pour Car Rental, parser le HTML pour préserver le formatage (gras pour SUV, CDW, etc.)
        elif cat == "Car Rental":
            p = doc.add_paragraph()
            # Le titre peut contenir du HTML avec <strong> pour SUV, CDW, etc.
            # Utiliser une fonction spéciale pour préserver le formatage
            _add_title_with_html_formatting(p, title)
            _set_par_spacing(p, before_pt=SP_BEFORE_ALL_PT, after_pt=SP_AFTER_ALL_PT)
        else:
            _add_day_title(doc, title)
    added_any = False

    # 2) Sous-titre pour Flight, Train, Ferry (heures de départ/arrivée)
    if cat == "Flight":
        dep_time = rj.get("dep_time") or ""
        arr_time = rj.get("arr_time") or ""
        if dep_time or arr_time:
            subtitle_parts = []
            if dep_time:
                subtitle_parts.append(f"Departure at {_fmt_ampm(dep_time)}")
            if arr_time:
                subtitle_parts.append(f"arrival at {_fmt_ampm(arr_time)}")
            if subtitle_parts:
                subtitle = f"{'; '.join(subtitle_parts)} – Schedule subject to change"
                _add_normal(doc, subtitle)
                added_any = True
    
    elif cat == "Train":
        dep_time = rj.get("dep_time") or ""
        arr_time = rj.get("arr_time") or ""
        if dep_time or arr_time:
            subtitle_parts = []
            if dep_time:
                subtitle_parts.append(f"Departure at {_fmt_ampm(dep_time)}")
            if arr_time:
                subtitle_parts.append(f"arrival at {_fmt_ampm(arr_time)}")
            if subtitle_parts:
                subtitle = f"{'; '.join(subtitle_parts)} – Schedule subject to change"
                _add_normal(doc, subtitle)
                added_any = True
    
    elif cat == "Ferry":
        dep_time = rj.get("dep_time") or ""
        arr_time = rj.get("arr_time") or ""
        if dep_time or arr_time:
            subtitle_parts = []
            if dep_time:
                subtitle_parts.append(f"Departure {_fmt_ampm(dep_time)}")
            if arr_time:
                subtitle_parts.append(f"Arrival {_fmt_ampm(arr_time)}")
            if subtitle_parts:
                subtitle = f"{'; '.join(subtitle_parts)} – Schedule subject to change"
                _add_normal(doc, subtitle)
                added_any = True

    # 3) Corps - description
    fields = rj.get("fields", {}) or {}
    desc = fields.get("full_description") or rj.get("description") or rj.get("note") or _get_attr(line, "description", "") or ""
    
    # Pour ces catégories spécifiques, on s'assure d'exporter le texte même s'il est dans le titre
    # MAIS: pour Flight/Train/Ferry, si on a déjà affiché le sous-titre avec les heures, on n'utilise PAS le titre comme description
    has_subtitle = cat in ("Flight", "Train", "Ferry") and (rj.get("dep_time") or rj.get("arr_time"))
    
    if cat in ("Flight", "Train", "Ferry", "Car Rental", "Trip info"):
        # Si pas de description et qu'on n'a pas de sous-titre, on peut utiliser le titre comme description (fallback)
        if not desc and title and not has_subtitle:
            desc = title

    if desc:
        # Pour Trip info, description en italique normal (pas de gras)
        para_count_before = len(doc.paragraphs)
        p_desc = doc.add_paragraph()
        if cat == "Trip info":
            # Description en italique mais normal (pas gras)
            append_sanitized_html_to_docx(p_desc, desc, allow_italic=True)
            # Forcer italique et pas de gras pour tous les runs
            para_count_after = len(doc.paragraphs)
            for i in range(para_count_before, para_count_after):
                for run in doc.paragraphs[i].runs:
                    run.font.italic = True
                    run.font.bold = False
                _set_par_spacing(doc.paragraphs[i], before_pt=SP_BEFORE_ALL_PT, after_pt=SP_AFTER_NORMAL_PT)
        else:
            # Autres catégories : italique autorisé seulement pour Trip info (mais on est déjà dans le else)
            append_sanitized_html_to_docx(p_desc, desc, allow_italic=False)
            # Apply spacing to all generated paragraphs
            para_count_after = len(doc.paragraphs)
            for i in range(para_count_before, para_count_after):
                _set_par_spacing(doc.paragraphs[i], before_pt=SP_BEFORE_ALL_PT, after_pt=SP_AFTER_NORMAL_PT)
        added_any = True

    # 3) Lien hôtel si catégorie Hotel
    if cat == "Hotel":
        _append_hotel_url_if_any(doc, line)
        added_any = True

    # 4) Saut de ligne après le dernier élément du service
    _blank_line(doc)

def _render_day_services(doc: Document, day, usable_w_cm: float = None) -> None:
    """Rend tous les services visibles (inclut Flight, Train, Ferry, Car Rental, etc.)."""
    lines = list(_get_attr(day, "lines", []) or [])
    if not lines:
        _blank_line(doc)
        return

    for line in lines:
        # On ignore seulement les Internal info / placeholders, pas les vraies catégories
        cat = (_get_attr(line, "category") or "").strip()
        if cat.lower().startswith("internal"):
            continue
        _render_service(doc, line, usable_w_cm or 0)

def _insert_day_block(doc: Document, qout, day, day_idx, usable_width_cm: float):
    # Jamais d'image hero pour le premier jour
    if day_idx > 0:
        decorative_images = _get_attr(day, "decorative_images", []) or []
        if len(decorative_images) >= 2:
            imgs = decorative_images[:2]
            _insert_two_heroes(doc, imgs[0], imgs[1])

    # Ligne de date
    date_iso = _get_attr(day, "date")
    base = fmt_ui_date(date_iso) if date_iso else ""
    if _is_first_of_dest_block(qout.days, day_idx):
        n = _count_nights_from_index(qout.days, day_idx)
        dest = (_get_attr(day, "destination") or "").strip()
        if dest and n > 0:
            base = f"{base} {dest} for {n} night{'s' if n > 1 else ''}"
    _add_date_line(doc, base)

    # Utiliser _render_day_services pour rendre tous les services (inclut Flight, Train, etc.)
    _render_day_services(doc, day, usable_width_cm)

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

def _compute_usable_width_cm(section) -> float:
    page_cm = section.page_width.cm
    left_cm = section.left_margin.cm
    right_cm = section.right_margin.cm
    return max(0.0, page_cm - left_cm - right_cm)

def build_docx_for_quote(db: Session, quote_id: int) -> BytesIO:
    """
    Build a .docx for the given quote id, using the repository template and inserting
    generated content before the Terms & Conditions heading.
    """
    # Import here to avoid circular import
    from ...api.quotes import _to_out
    
    # Re-query properly:
    q = db.query(Quote).filter(Quote.id == quote_id).first()
    if not q:
        raise ValueError("Quote not found")
    qout = _to_out(q, db=db, include_first_image=True)

    # Load template
    doc = Document(str(WORD_TEMPLATE_PATH))
    section = doc.sections[0]
    usable_width_cm = _compute_usable_width_cm(section)

    # Find T&C anchor paragraph
    tc_idx = _find_terms_heading_index(doc)
    if tc_idx is None:
        # No T&C found: append content at end
        # Titre global
        title = (_get_attr(qout, "display_title") or _get_attr(qout, "title") or "").strip()
        if title:
            _add_title(doc, title)
        # Global heroes
        global_heroes = [_get_attr(qout, "hero_photo_1"), _get_attr(qout, "hero_photo_2")]
        global_heroes = [u for u in global_heroes if u]
        if len(global_heroes) >= 2:
            _insert_two_heroes(doc, global_heroes[0], global_heroes[1])
        # Days
        for i, day in enumerate(qout.days or []):
            _insert_day_block(doc, qout, day, i, usable_width_cm)
    else:
        # Snapshot T&C texts (plain) to re-add at the end
        tc_paragraphs = doc.paragraphs[tc_idx:]
        tc_texts = [p.text for p in tc_paragraphs]
        # Start a fresh doc with same section settings
        doc = Document()
        new_sec = doc.sections[0]
        old_sec = Document(str(WORD_TEMPLATE_PATH)).sections[0]
        new_sec.page_width = old_sec.page_width
        new_sec.page_height = old_sec.page_height
        new_sec.left_margin = old_sec.left_margin
        new_sec.right_margin = old_sec.right_margin
        new_sec.top_margin = old_sec.top_margin
        new_sec.bottom_margin = old_sec.bottom_margin
        usable_width_cm = _compute_usable_width_cm(new_sec)
        # Generate content area now on fresh doc
        title = (getattr(qout, "display_title", None) or getattr(qout, "title", None) or "").strip()
        if title:
            _add_title(doc, title)
        # Global heroes
        global_heroes = [getattr(qout, "hero_photo_1", None), getattr(qout, "hero_photo_2", None)]
        global_heroes = [u for u in global_heroes if u]
        if len(global_heroes) >= 2:
            _insert_two_heroes(doc, global_heroes[0], global_heroes[1])
        # Days
        for i, day in enumerate(qout.days or []):
            _insert_day_block(doc, qout, day, i, usable_width_cm)
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

    # Save to memory
    out = BytesIO()
    doc.save(out)
    out.seek(0)
    return out
