from io import BytesIO
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from typing import Optional
from PIL import Image, ImageOps

from .settings import cm_to_px, COL_W_CM, COL_H_CM, DPI, JPEG_QUALITY, MAX_IMAGE_BYTES, IMG_TIMEOUT_S, HERO_W_CM, HERO_H_CM

CM_TO_PX = lambda cm, dpi=300: int(round(cm * dpi / 2.54))

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

def _cover_crop_image(img: Image.Image, target_w_cm: float, target_h_cm: float, dpi: int = DPI) -> Image.Image:
    """Internal: cover-crop an Image.Image to exact WxH cm."""
    tw, th = cm_to_px(target_w_cm, dpi), cm_to_px(target_h_cm, dpi)
    # Compute scale to cover
    scale = max(tw / img.width, th / img.height)
    new_w, new_h = int(round(img.width * scale)), int(round(img.height * scale))
    img = img.resize((new_w, new_h), Image.LANCZOS)
    # Center-crop
    left = max(0, (new_w - tw) // 2)
    top = max(0, (new_h - th) // 2)
    return img.crop((left, top, left + tw, top + th))

def cover_crop_to_cm(buf: BytesIO, target_w_cm: float = COL_W_CM, target_h_cm: float = COL_H_CM, dpi: int = DPI) -> Optional[BytesIO]:
    """
    Resize with 'cover' behavior to exact WxH cm without distortion:
    scale to fill then center-crop the overflow, convert to JPEG, compress.
    """
    try:
        img = ensure_jpeg(buf)
        img = _cover_crop_image(img, target_w_cm, target_h_cm, dpi)
        return _compress_to_jpeg_bytes(img)
    except Exception:
        return None

def make_two_up_cover(left: Image.Image, right: Image.Image, single_w_cm: float, h_cm: float, dpi: int = DPI) -> Image.Image:
    """Assemble deux images cover-croppées côte à côte sans espace."""
    lw = _cover_crop_image(left, single_w_cm, h_cm, dpi)
    rw = _cover_crop_image(right, single_w_cm, h_cm, dpi)
    W = lw.width + rw.width
    H = lw.height  # identiques
    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    canvas.paste(lw, (0, 0))
    canvas.paste(rw, (lw.width, 0))
    return canvas

def make_two_up_fixed(left: Image.Image, right: Image.Image, total_w_cm: float, h_cm: float, dpi: int = DPI) -> Image.Image:
    """Compose une image finale W×H (cm) à partir de deux sources, sans espace."""
    single_w_cm = total_w_cm / 2.0
    L = _cover_crop_image(left, single_w_cm, h_cm, dpi)
    R = _cover_crop_image(right, single_w_cm, h_cm, dpi)
    W = L.width + R.width
    H = L.height  # identiques
    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    canvas.paste(L, (0, 0))
    canvas.paste(R, (L.width, 0))
    return canvas

def jpeg_bytes(img: Image.Image, quality: int = 85) -> bytes:
    buf = BytesIO()
    img = img.convert("RGB")
    img.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
    return buf.getvalue()

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

def stitch_side_by_side_to_cm(url_left: str, url_right: str, width_cm: float = 14.72, height_cm: float = 4.5, dpi: int = 300) -> bytes:
    """Download two images, cover-crop each to half width, then stitch into one JPEG."""
    W = CM_TO_PX(width_cm, dpi)
    H = CM_TO_PX(height_cm, dpi)
    half_w = W // 2

    def _cover(img: Image.Image, tgt_w: int, tgt_h: int) -> Image.Image:
        r = max(tgt_w / img.width, tgt_h / img.height)
        nw, nh = int(img.width * r), int(img.height * r)
        img = img.resize((nw, nh), Image.LANCZOS)
        x0 = (nw - tgt_w) // 2
        y0 = (nh - tgt_h) // 2
        return img.crop((x0, y0, x0 + tgt_w, y0 + tgt_h))

    left_buf = fetch_image_bytes(url_left)
    right_buf = fetch_image_bytes(url_right)
    if not (left_buf and right_buf):
        raise ValueError("Failed to fetch one or both images")
    
    imL = ensure_jpeg(left_buf)
    imR = ensure_jpeg(right_buf)
    imL = _cover(imL, half_w, H)
    imR = _cover(imR, half_w, H)

    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    canvas.paste(imL, (0, 0))
    canvas.paste(imR, (half_w, 0))

    out = BytesIO()
    canvas.save(out, format="JPEG", optimize=True, progressive=True, quality=86)
    return out.getvalue()

