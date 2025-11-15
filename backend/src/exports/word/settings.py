from pathlib import Path
from docx.shared import Pt, RGBColor

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

# ADD constants for formatting
TEXT_COLOR = RGBColor(0x00, 0x20, 0x60)  # #002060

# Sizes
TITLE_PT = 28
DAY_PT = 10
DATE_PT = 10
NORMAL_PT = 10

# Paragraph spacing rules
SP_BEFORE_ALL_PT = 0   # aucun espace avant
SP_AFTER_ALL_PT = 0    # par défaut
SP_AFTER_NORMAL_PT = 0  # Normal: Après = 0 pt (modif demandée)

# Image size (cm)
HERO_W_CM = 14.72
HERO_H_CM = 4.5

