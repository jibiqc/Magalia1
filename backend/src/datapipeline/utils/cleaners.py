import re, hashlib, json
from urllib.parse import urlparse

def clean_text(s):
    if s is None: return None
    s = str(s).strip()
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    return re.sub(r"[ \t]+", " ", s)

def parse_duration_to_minutes(s):
    """Accepts '3h30', '2h', '45m', '1:15', '90' → int minutes or None."""
    if s is None or str(s).strip()=="":
        return None
    txt = str(s).strip().lower()
    m = re.match(r"^\s*(\d+)\s*h(?:\s*(\d+))?\s*$", txt)
    if m:
        h = int(m.group(1)); m2 = int(m.group(2)) if m.group(2) else 0
        return h*60 + m2
    m = re.match(r"^\s*(\d+)\s*m\s*$", txt)
    if m:
        return int(m.group(1))
    m = re.match(r"^\s*(\d+)\s*:\s*(\d+)\s*$", txt)
    if m:
        return int(m.group(1))*60 + int(m.group(2))
    if txt.isdigit():
        return int(txt)
    return None

def clamp_hotel_stars(v):
    if v is None or str(v).strip()=="":
        return None
    try:
        n = int(float(str(v).replace(",", ".")))
        return min(5, max(1, n))
    except:
        return None

def is_valid_url(u):
    if not u: return False
    try:
        p = urlparse(str(u).strip())
        return p.scheme in ("http","https") and bool(p.netloc)
    except:
        return False

def stable_row_hash(bk_values: dict, raw_payload: dict) -> str:
    """Deterministic hash from BK + ALL normalized attributes (idempotent staging)."""
    digest = hashlib.sha1()
    def _norm(v):
        if isinstance(v, (list,dict)): return json.dumps(v, sort_keys=True, ensure_ascii=False)
        return str(v)
    parts = []
    for k in sorted(bk_values.keys()):
        parts.append(f"BK:{k}={_norm(bk_values[k])}")
    for k in sorted(raw_payload.keys()):
        parts.append(f"RAW:{k}={_norm(raw_payload[k])}")
    digest.update("|".join(parts).encode("utf-8"))
    return digest.hexdigest()
