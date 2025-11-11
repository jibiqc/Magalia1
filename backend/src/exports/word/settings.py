from pathlib import Path

# Path to the Word template inside the repository
WORD_TEMPLATE_PATH = Path(__file__).resolve().parent / "templates" / "Essential_Travel_Itinerary_Template.docx"

# Image rules for hero/day images (two columns)
COL_W_CM = 7.3
COL_H_CM = 5.14
DPI = 150  # print/email friendly
JPEG_QUALITY = 80  # target quality for JPEG
MAX_IMAGE_BYTES = 900_000  # ~900 KB max per inserted image
IMG_TIMEOUT_S = 5  # per-image download timeout

# Utility conversions
CM_PER_INCH = 2.54

def cm_to_px(cm: float, dpi: int = DPI) -> int:
    return int(round((cm / CM_PER_INCH) * dpi))

