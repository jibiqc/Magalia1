from io import BytesIO
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from typing import Optional
from PIL import Image, ImageOps

from .settings import cm_to_px, COL_W_CM, COL_H_CM, DPI, JPEG_QUALITY, MAX_IMAGE_BYTES, IMG_TIMEOUT_S

def fetch_image_bytes(url: str, timeout: int = IMG_TIMEOUT_S) -> Optional[BytesIO]:
    """Download image to BytesIO or return None on failure."""
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=timeout) as resp:
            data = resp.read()
        return BytesIO(data)
    except (URLError, HTTPError, ValueError):
        return None

def ensure_jpeg(buf: BytesIO) -> Image.Image:
    """Open with PIL and convert to RGB JPEG-compatible image."""
    buf.seek(0)
    img = Image.open(buf)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    return img

def _compress_to_jpeg_bytes(img: Image.Image, quality: int = JPEG_QUALITY, max_bytes: int = MAX_IMAGE_BYTES) -> BytesIO:
    """Compress to progressive JPEG and cap size by lowering quality if needed."""
    q = quality
    out = BytesIO()
    while True:
        out.seek(0)
        out.truncate(0)
        img.save(out, format="JPEG", quality=q, optimize=True, progressive=True)
        if out.tell() <= max_bytes or q <= 50:
            break
        q -= 5
    out.seek(0)
    return out

def cover_crop_to_cm(buf: BytesIO, target_w_cm: float = COL_W_CM, target_h_cm: float = COL_H_CM, dpi: int = DPI) -> Optional[BytesIO]:
    """
    Resize with 'cover' behavior to exact WxH cm without distortion:
    scale to fill then center-crop the overflow, convert to JPEG, compress.
    """
    try:
        img = ensure_jpeg(buf)
        tw, th = cm_to_px(target_w_cm, dpi), cm_to_px(target_h_cm, dpi)
        # Compute scale to cover
        scale = max(tw / img.width, th / img.height)
        new_w, new_h = int(round(img.width * scale)), int(round(img.height * scale))
        img = img.resize((new_w, new_h), Image.LANCZOS)
        # Center-crop
        left = max(0, (new_w - tw) // 2)
        top = max(0, (new_h - th) // 2)
        img = img.crop((left, top, left + tw, top + th))
        return _compress_to_jpeg_bytes(img)
    except Exception:
        return None

def contain_resize_to_width_cm(buf: BytesIO, page_width_cm: float, dpi: int = DPI) -> Optional[BytesIO]:
    """
    Resize to fit within page_width_cm (keep aspect, no crop).
    Good for service images inserted in the flow.
    """
    try:
        img = ensure_jpeg(buf)
        tw = cm_to_px(page_width_cm, dpi)
        if img.width <= tw:
            return _compress_to_jpeg_bytes(img)  # already small enough
        scale = tw / img.width
        new_w, new_h = int(round(img.width * scale)), int(round(img.height * scale))
        img = img.resize((new_w, new_h), Image.LANCZOS)
        return _compress_to_jpeg_bytes(img)
    except Exception:
        return None

