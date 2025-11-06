import pandas as pd
from pathlib import Path
from datetime import datetime, timezone
import yaml

from src.models.db import SessionLocal
from src.models.staging_models import StgService
from ..utils.cleaners import (
    clean_text, parse_duration_to_minutes,
    clamp_hotel_stars, is_valid_url, stable_row_hash
)

def load_yaml(path):
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def import_services_excel(excel_path: str, cfg_path: str, sheet_name: str | None = None):
    cfg = load_yaml(cfg_path)

    xls = pd.ExcelFile(excel_path)
    sheet = sheet_name or xls.sheet_names[0]
    df = xls.parse(sheet)

    # Normalize column headers
    df.columns = [str(c).strip() for c in df.columns]

    # Required source columns check
    missing = [c for c in cfg["required_fields"] if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required source columns: {missing}")

    # Build records with minimal cleaning + full raw_json
    records = []
    for _, row in df.iterrows():
        # Full raw payload as strings (keep EVERYTHING)
        rec_raw = { col: (None if pd.isna(row[col]) else str(row[col])) for col in df.columns }

        # Hard reject: Start Destination empty
        start_dest = clean_text(rec_raw.get("Start Destination"))
        if cfg.get("reject_rules",{}).get("reject_if_start_destination_empty") and not start_dest:
            continue

        name = clean_text(rec_raw.get("Name"))
        company = clean_text(rec_raw.get("Company"))
        category_src = clean_text(rec_raw.get("Cost Category"))

        duration_minutes = parse_duration_to_minutes(rec_raw.get("Activity Duration"))
        hotel_stars = clamp_hotel_stars(rec_raw.get("Hotel Stars"))

        img_primary = clean_text(rec_raw.get(cfg["images"]["primary"]))
        img_fallback = clean_text(rec_raw.get(cfg["images"]["fallback"]))
        if img_primary and not is_valid_url(img_primary):
            img_primary = None
        if (not img_primary) and img_fallback and not is_valid_url(img_fallback):
            img_fallback = None

        # BK + hash (deterministic)
        bk = {"Name": name, "Company": company, "Start Destination": start_dest}
        row_hash = stable_row_hash(bk, rec_raw)

        records.append(dict(
            name=name,
            company=company,
            cost_category=category_src,
            start_destination=start_dest,
            hotel_stars=hotel_stars,
            duration_minutes=duration_minutes,
            image_url_primary=img_primary,
            image_url_fallback=img_fallback,
            _source_file=Path(excel_path).name,
            _source_sheet=sheet,
            _row_hash=row_hash,
            _ingested_at=datetime.now(timezone.utc).isoformat(),
            raw_json=rec_raw,
        ))

    if not records:
        print("No records to import (all rejected or empty file).")
        return

    # Idempotent insert into staging
    inserted = 0
    with SessionLocal() as s:
        for rec in records:
            exists = s.query(StgService).filter_by(_row_hash=rec["_row_hash"]).first()
            if exists:
                continue
            s.add(StgService(
                name=rec["name"],
                company=rec["company"],
                cost_category=rec["cost_category"],
                start_destination=rec["start_destination"],
                hotel_stars=rec["hotel_stars"],
                duration_minutes=rec["duration_minutes"],
                image_url_primary=rec["image_url_primary"],
                image_url_fallback=rec["image_url_fallback"],
                _source_file=rec["_source_file"],
                _source_sheet=rec["_source_sheet"],
                _row_hash=rec["_row_hash"],
                raw_json=rec["raw_json"],
            ))
            inserted += 1
        s.commit()
    print(f"Imported into staging: {inserted} new rows")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python -m src.datapipeline.staging.import_services <EXCEL_PATH> <CFG_PATH> [SHEET_NAME]")
        sys.exit(1)
    excel = sys.argv[1]
    cfg = sys.argv[2]
    sheet = sys.argv[3] if len(sys.argv) > 3 else None
    import_services_excel(excel, cfg, sheet)
