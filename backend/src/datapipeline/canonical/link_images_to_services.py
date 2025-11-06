from src.models.db import SessionLocal

from src.models.prod_models import ServiceCatalog, ServiceImage

from src.models.staging_models import StgImage

from src.datapipeline.utils.normalize import normalize_key

import yaml



def _load_yaml(path):

    with open(path, "r", encoding="utf-8") as f:

        return yaml.safe_load(f) or {}



def _alias(d: dict, value: str | None) -> str | None:

    if not value: return None

    a = d.get("aliases", {})

    return a.get(value, value)



def build_index(session):

    """

    Build two indices on ServiceCatalog:

    - normalized index: (norm_name, norm_company, norm_dest) -> service

    - raw index with aliases applied (strict): (aliased_company, aliased_dest, name as-is) optional

    We rely mainly on normalized triple.

    """

    norm_index = {}

    raw_index = {}

    for svc in session.query(ServiceCatalog).all():

        n_name  = normalize_key(svc.name)

        n_comp  = normalize_key(svc.company)

        n_dest  = normalize_key(svc.start_destination)

        if n_name and n_comp and n_dest:

            norm_index[(n_name, n_comp, n_dest)] = svc.id

    return norm_index



def link_images(strict_supplier_aliases_path: str, strict_destination_aliases_path: str):

    supp_alias = _load_yaml(strict_supplier_aliases_path)

    dest_alias = _load_yaml(strict_destination_aliases_path)



    linked_norm = linked_alias = 0

    with SessionLocal() as s:

        # Build normalized index of services once

        norm_index = build_index(s)



        # Iterate orphan images (already upserted by URL)

        orphans = s.query(ServiceImage).filter(ServiceImage.service_id == None).all()

        if not orphans:

            print("No orphan images to link.")

            return



        for img in orphans:

            # Find the corresponding staging row (same URL)

            stg = s.query(StgImage).filter(StgImage.url == img.url).first()

            if not stg:

                # No staging info for this URL (possible if image existed before staging): skip

                continue



            # --- Pass A: normalized BK

            n_name = normalize_key(stg.name)

            n_comp = normalize_key(stg.company)

            n_dest = normalize_key(stg.start_destination)

            sid = None

            if n_name and n_comp and n_dest:

                sid = norm_index.get((n_name, n_comp, n_dest))

            if sid:

                img.service_id = sid

                linked_norm += 1

                continue  # next image



            # --- Pass B: alias then normalized BK

            a_comp = _alias(supp_alias, stg.company)

            a_dest = _alias(dest_alias, stg.start_destination)

            n_name2 = n_name

            n_comp2 = normalize_key(a_comp)

            n_dest2 = normalize_key(a_dest)

            if n_name2 and n_comp2 and n_dest2:

                sid2 = norm_index.get((n_name2, n_comp2, n_dest2))

                if sid2:

                    img.service_id = sid2

                    linked_alias += 1

                    continue



        s.commit()

    print(f"Image linking done -> normalized={linked_norm}, alias={linked_alias}")



if __name__ == "__main__":

    link_images(

        "backend/src/datapipeline/supplier_aliases.yaml",

        "backend/src/datapipeline/destination_aliases.yaml"

    )

