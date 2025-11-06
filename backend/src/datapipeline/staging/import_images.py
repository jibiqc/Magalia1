import pandas as pd

from pathlib import Path

from datetime import datetime, timezone

import yaml

from src.models.db import SessionLocal

from src.models.staging_models import StgImage

from src.datapipeline.utils.cleaners import clean_text, is_valid_url, stable_row_hash



def load_yaml(p):

    with open(p, "r", encoding="utf-8") as f:

        return yaml.safe_load(f)



def import_images_excel(excel_path: str, cfg_path: str, sheet_name: str | None = None):

    cfg = load_yaml(cfg_path)

    xls = pd.ExcelFile(excel_path)

    sheet = sheet_name or xls.sheet_names[0]

    df = xls.parse(sheet)

    df.columns = [str(c).strip() for c in df.columns]



    url_col = cfg.get("url_column") or "URL"

    if url_col not in df.columns:

        raise ValueError(f"Missing URL column '{url_col}' in sheet; found columns: {list(df.columns)}")



    def pick(colname):

        c = cfg.get(colname) or ""

        return c if (c and c in df.columns) else None



    name_col  = pick("name_column")

    comp_col  = pick("company_column")

    dest_col  = pick("start_destination_column")

    ef_col    = pick("ef_code_column")

    cap_col   = pick("caption_column")



    recs = []

    for _, row in df.iterrows():

        raw = { col: (None if pd.isna(row[col]) else str(row[col])) for col in df.columns }



        url = clean_text(raw.get(url_col))

        if not url or (cfg.get("reject_if_url_invalid") and not is_valid_url(url)):

            continue



        name = clean_text(raw.get(name_col)) if name_col else None

        comp = clean_text(raw.get(comp_col)) if comp_col else None

        dest = clean_text(raw.get(dest_col)) if dest_col else None

        ef   = clean_text(raw.get(ef_col))   if ef_col   else None

        cap  = clean_text(raw.get(cap_col))  if cap_col  else None



        # BK/hash: URL is unique; include BK hints to avoid re-ingesting identical rows

        bk = {"URL": url, "Name": name, "Company": comp, "Start Destination": dest, "EF": ef}

        row_hash = stable_row_hash(bk, raw)



        recs.append(dict(

            url=url, name=name, company=comp, start_destination=dest, ef_code=ef, caption=cap,

            _source_file=Path(excel_path).name, _source_sheet=sheet, _row_hash=row_hash,

            _ingested_at=datetime.now(timezone.utc).isoformat(), raw_json=raw

        ))



    if not recs:

        print("No image records to import.")

        return



    inserted = 0

    with SessionLocal() as s:

        for r in recs:

            if s.query(StgImage).filter_by(_row_hash=r["_row_hash"]).first():

                continue

            s.add(StgImage(

                url=r["url"], name=r["name"], company=r["company"], start_destination=r["start_destination"],

                ef_code=r["ef_code"], caption=r["caption"], _source_file=r["_source_file"],

                _source_sheet=r["_source_sheet"], _row_hash=r["_row_hash"], raw_json=r["raw_json"]

            ))

            inserted += 1

        s.commit()

    print(f"Imported images into staging: {inserted} new rows")



if __name__ == "__main__":

    import sys

    if len(sys.argv) < 3:

        print("Usage: python -m src.datapipeline.staging.import_images <EXCEL_PATH> <CFG_PATH> [SHEET_NAME]")

        sys.exit(1)

    excel, cfg = sys.argv[1], sys.argv[2]

    sheet = sys.argv[3] if len(sys.argv) > 3 else None

    import_images_excel(excel, cfg, sheet)

