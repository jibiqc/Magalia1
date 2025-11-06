import yaml

from src.models.db import SessionLocal

from src.models.staging_models import StgItineraryEvent

from src.models.prod_models import ItineraryEvent, ServiceCatalog

from sqlalchemy import and_



def _load_yaml(p):

    with open(p, "r", encoding="utf-8") as f:

        return yaml.safe_load(f)



def _category_strict(src, cat_map):

    if not src: return "to_review"

    key = str(src).strip().lower()

    return cat_map["categories"].get(key, "to_review")



def canonicalize_events(cat_map_path: str):

    cat_map = _load_yaml(cat_map_path)

    ins = upd = linked = 0

    with SessionLocal() as s:

        # Build quick indexes for linking

        by_bk_full = {}

        by_bk_nc   = {}

        for svc in s.query(ServiceCatalog).all():

            by_bk_full[(svc.name, svc.company, svc.start_destination)] = svc.id

            by_bk_nc[(svc.name, svc.company)] = by_bk_nc.get((svc.name, svc.company), svc.id)



        for stg in s.query(StgItineraryEvent).all():

            # Canon category strict

            cat = _category_strict(stg.category, cat_map)



            # Try to link by full BK then name+company

            sid = None

            if stg.service_title and stg.supplier and stg.city:

                sid = by_bk_full.get((stg.service_title, stg.supplier, stg.city))

            if not sid and stg.service_title and stg.supplier:

                sid = by_bk_nc.get((stg.service_title, stg.supplier))



            # Compose BK for event (with StartTime if present in raw_json)

            st = (stg.raw_json or {}).get("Start Time")

            bk_filter = and_(

                ItineraryEvent.departure_code == stg.departure_code,

                ItineraryEvent.date == stg.date,

                ItineraryEvent.service_title == stg.service_title

            )

            existing = s.query(ItineraryEvent).filter(bk_filter).first()



            if not existing:

                obj = ItineraryEvent(

                    departure_code=stg.departure_code,

                    date=stg.date,

                    service_title=stg.service_title,

                    city=stg.city,

                    supplier=stg.supplier,

                    category=cat,

                    ef_code=stg.ef_code,

                    notes=None,

                    service_id=sid

                )

                s.add(obj); ins += 1

                if sid: linked += 1

            else:

                changed = False

                if existing.city != stg.city: existing.city = stg.city; changed = True

                if existing.supplier != stg.supplier: existing.supplier = stg.supplier; changed = True

                if existing.category != cat: existing.category = cat; changed = True

                if existing.ef_code != stg.ef_code: existing.ef_code = stg.ef_code; changed = True

                # link if missing

                if (existing.service_id or None) != (sid or None):

                    existing.service_id = sid; changed = True

                    if sid: linked += 1

                if changed: upd += 1



        s.commit()

    print(f"Canonicalized events -> inserted={ins}, updated={upd}, linked={linked}")



if __name__ == "__main__":

    canonicalize_events("backend/src/datapipeline/services_category_map.yaml")

