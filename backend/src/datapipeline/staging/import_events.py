import pandas as pd

from pathlib import Path

from datetime import datetime, date, time, timezone

import yaml

from src.models.db import SessionLocal

from src.models.staging_models import StgItineraryEvent

from src.datapipeline.utils.cleaners import clean_text, stable_row_hash



def _load_yaml(p):

    with open(p, "r", encoding="utf-8") as f:

        return yaml.safe_load(f)



def _excel_to_date(v):

    if v is None or (isinstance(v, float) and pd.isna(v)):

        return None

    # pandas already parses Excel serials if engine is openpyxl

    try:

        if isinstance(v, (pd.Timestamp,)):

            return v.date()

        if isinstance(v, str):

            v = v.strip()

            if not v:

                return None

            return pd.to_datetime(v, errors="coerce").date()

        if isinstance(v, (int, float)):

            return pd.to_datetime(v, unit="D", origin="1899-12-30", errors="coerce").date()

    except:

        return None

    return None



def _time_to_str(v):

    if v is None or (isinstance(v, float) and pd.isna(v)):

        return None

    if isinstance(v, (pd.Timestamp,)):

        return v.strftime("%H:%M")

    if isinstance(v, (pd.Timedelta,)):

        # not expected but convert to HH:MM

        total_sec = int(v.total_seconds())

        h, m = divmod(total_sec//60, 60)

        return f"{h:02d}:{m:02d}"

    if isinstance(v, (float, int)):

        # Excel time as fraction of day

        if pd.isna(v):

            return None

        mins = int(round(float(v) * 24 * 60))

        return f"{mins//60:02d}:{mins%60:02d}"

    s = str(v).strip()

    return s or None



def import_events_excel(excel_path: str, cfg_path: str, sheet_name: str | None = None):

    cfg = _load_yaml(cfg_path)

    xls = pd.ExcelFile(excel_path)

    sheet = sheet_name or xls.sheet_names[0]



    chunksize = int(cfg.get("chunksize") or 0)

    frames = [xls.parse(sheet)] if chunksize<=0 else pd.read_excel(excel_path, sheet_name=sheet, chunksize=chunksize)



    inserted_total = 0

    for df in frames if chunksize>0 else [frames[0]]:

        df.columns = [str(c).strip() for c in df.columns]

        miss = [c for c in cfg["required_fields"] if c not in df.columns]

        if miss:

            raise ValueError(f"Missing required columns: {miss}")



        dep_col = cfg["departure_code_column"]

        name_col = cfg["name_column"]

        cat_col = cfg["category_column"]

        dest_col = cfg["start_destination_column"]

        comp_col = cfg["company_column"]

        sd_col  = cfg["start_date_column"]

        ed_col  = cfg.get("end_date_column")

        st_col  = cfg.get("start_time_column")

        et_col  = cfg.get("end_time_column")



        records = []

        for _, row in df.iterrows():

            raw = { col: (None if pd.isna(row[col]) else str(row[col])) for col in df.columns }



            dep_raw = clean_text(raw.get(dep_col))

            if not dep_raw: 

                continue

            # Take text before ":" if present

            dep_code = dep_raw.split(":")[0].strip()



            name = clean_text(raw.get(name_col))

            date_val = _excel_to_date(row.get(sd_col))

            if not (dep_code and name and date_val):

                continue



            cat_src  = clean_text(raw.get(cat_col))

            dest     = clean_text(raw.get(dest_col))

            comp     = clean_text(raw.get(comp_col))

            end_date = _excel_to_date(row.get(ed_col)) if ed_col and ed_col in df.columns else None

            st_time  = _time_to_str(row.get(st_col)) if st_col and st_col in df.columns else None

            en_time  = _time_to_str(row.get(et_col)) if et_col and et_col in df.columns else None



            # BK: with Start Time if present

            bk_payload = {

                "Departure": dep_code, "Date": date_val.isoformat(), "Name": name,

                "StartTime": st_time or ""

            }

            row_hash = stable_row_hash(bk_payload, raw)



            records.append(dict(

                departure_code=dep_code,

                date=date_val.isoformat(),

                service_title=name,

                city=dest,

                supplier=comp,

                category=cat_src,

                ef_code=None,  # none for now; could be extracted from columns if present

                notes=None,

                _source_file=Path(excel_path).name,

                _source_sheet=sheet,

                _row_hash=row_hash,

                raw_json=raw

            ))



        if not records:

            continue



        inserted = 0

        with SessionLocal() as s:

            for r in records:

                if s.query(StgItineraryEvent).filter_by(_row_hash=r["_row_hash"]).first():

                    continue

                s.add(StgItineraryEvent(

                    departure_code=r["departure_code"],

                    date=r["date"],

                    service_title=r["service_title"],

                    city=r["city"],

                    supplier=r["supplier"],

                    category=r["category"],

                    ef_code=r["ef_code"],

                    notes=r["notes"],

                    _source_file=r["_source_file"],

                    _source_sheet=r["_source_sheet"],

                    _row_hash=r["_row_hash"],

                    raw_json=r["raw_json"]

                ))

                inserted += 1

            s.commit()

        inserted_total += inserted

    print(f"Imported itinerary events into staging: {inserted_total} new rows")



if __name__ == "__main__":

    import sys

    if len(sys.argv) < 3:

        print("Usage: python -m src.datapipeline.staging.import_events <EXCEL_PATH> <CFG_PATH> [SHEET_NAME]")

        sys.exit(1)

    excel, cfg = sys.argv[1], sys.argv[2]

    sheet = sys.argv[3] if len(sys.argv) > 3 else None

    import_events_excel(excel, cfg, sheet)

