import yaml

from src.models.db import SessionLocal

from src.models.staging_models import StgService

from src.models.prod_models import ServiceCatalog, Supplier, ServiceImage



def load_yaml(path):

    with open(path, "r", encoding="utf-8") as f:

        return yaml.safe_load(f)



def strict_category(cat_src: str | None, cat_map: dict) -> str | None:

    if not cat_src:

        return None

    key = cat_src.strip().lower()

    return cat_map["categories"].get(key)  # None if unknown



def canonicalize_services(cat_map_path: str):

    cat_map = load_yaml(cat_map_path)



    inserted = updated = suppliers_upserted = images_added = 0

    with SessionLocal() as s:

        for stg in s.query(StgService).all():

            # Strict category

            canon_cat = strict_category(stg.cost_category, cat_map) or "to_review"



            # Supplier master (strict on name)

            supplier_id = None

            if stg.company:

                sup = s.query(Supplier).filter(Supplier.name == stg.company).first()

                if not sup:

                    sup = Supplier(name=stg.company)

                    s.add(sup)

                    s.flush()

                    suppliers_upserted += 1

                supplier_id = sup.id



            # BK = (name, company, start_destination)

            existing = s.query(ServiceCatalog).filter(

                ServiceCatalog.name == stg.name,

                ServiceCatalog.company == stg.company,

                ServiceCatalog.start_destination == stg.start_destination

            ).first()



            if not existing:

                obj = ServiceCatalog(

                    name=stg.name,

                    company=stg.company,

                    start_destination=stg.start_destination,

                    category=canon_cat,

                    supplier_id=supplier_id,

                    hotel_stars=stg.hotel_stars,

                    duration_minutes=stg.duration_minutes,

                    extras=stg.raw_json

                )

                s.add(obj); s.flush()

                img = stg.image_url_primary or stg.image_url_fallback

                if img:
                    # Check if this URL already exists for THIS specific service (not globally)
                    existing_img = s.query(ServiceImage).filter(
                        ServiceImage.service_id == obj.id,
                        ServiceImage.url == img
                    ).first()
                    if not existing_img:
                        s.add(ServiceImage(service_id=obj.id, url=img, source="import"))
                        s.flush()
                        images_added += 1

                inserted += 1

            else:

                # newest wins — but skip no-op updates (idempotent)

                changed = False

                if existing.category != canon_cat:

                    existing.category = canon_cat; changed = True

                if existing.supplier_id != supplier_id:

                    existing.supplier_id = supplier_id; changed = True

                if existing.hotel_stars != stg.hotel_stars:

                    existing.hotel_stars = stg.hotel_stars; changed = True

                if existing.duration_minutes != stg.duration_minutes:

                    existing.duration_minutes = stg.duration_minutes; changed = True

                if existing.extras != stg.raw_json:

                    existing.extras = stg.raw_json; changed = True



                # Image upsert (only if new URL for this service)
                # Never modify or delete manual images (source="manual")

                img = stg.image_url_primary or stg.image_url_fallback

                if img:
                    # Check if this URL already exists for THIS specific service (not globally)
                    existing_img = s.query(ServiceImage).filter(
                        ServiceImage.service_id == existing.id,
                        ServiceImage.url == img
                    ).first()
                    if not existing_img:
                        s.add(ServiceImage(service_id=existing.id, url=img, source="import"))
                        s.flush()
                        images_added += 1
                        changed = True



                if changed:

                    updated += 1



        s.commit()

    print(f"Canonicalized services -> inserted={inserted}, updated={updated}, suppliers_upserted={suppliers_upserted}, images_added={images_added}")



if __name__ == "__main__":

    canonicalize_services("backend/src/datapipeline/services_category_map.yaml")

