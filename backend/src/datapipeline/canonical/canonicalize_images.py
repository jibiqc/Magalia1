from src.models.db import SessionLocal

from src.models.staging_models import StgImage

from src.models.prod_models import ServiceCatalog, ServiceImage



def canonicalize_images():

    inserted = updated = linked = 0

    with SessionLocal() as s:

        for img in s.query(StgImage).all():

            # Upsert by URL

            existing = s.query(ServiceImage).filter(ServiceImage.url == img.url).first()

            target = existing

            if not existing:

                target = ServiceImage(url=img.url, caption=img.caption or None, service_id=None)

                s.add(target); s.flush()

                inserted += 1

            else:

                # Update caption if changed

                if (img.caption or None) != existing.caption:

                    existing.caption = (img.caption or None); updated += 1



            # Try to link to a service using BK if available

            if img.name and img.company and img.start_destination:

                svc = s.query(ServiceCatalog).filter(

                    ServiceCatalog.name==img.name,

                    ServiceCatalog.company==img.company,

                    ServiceCatalog.start_destination==img.start_destination

                ).first()

                if svc and target.service_id != svc.id:

                    target.service_id = svc.id

                    linked += 1



        s.commit()

    print(f"Canonicalized images -> inserted={inserted}, updated={updated}, linked={linked}")



if __name__ == "__main__":

    canonicalize_images()

