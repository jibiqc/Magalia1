from datetime import date, timedelta

from collections import defaultdict

from src.models.db import SessionLocal

from src.models.prod_models import ServicePopularity, ItineraryEvent



def compute_popularity():

    today = date.today()

    cutoff = today - timedelta(days=365)



    totals = defaultdict(int)

    totals_365 = defaultdict(int)

    last_used = defaultdict(lambda: None)

    dep_sets = defaultdict(set)



    with SessionLocal() as s:

        # Aggregate

        for ev in s.query(ItineraryEvent).all():

            sid = ev.service_id

            if not sid:

                continue  # only count events linked to a service

            totals[sid] += 1
            # Parse date string to date object for comparison
            ev_date = None
            if ev.date:
                try:
                    ev_date = date.fromisoformat(ev.date)
                except:
                    pass

            if ev_date and ev_date >= cutoff:

                totals_365[sid] += 1

            if ev_date and (last_used[sid] is None or ev_date > last_used[sid]):

                last_used[sid] = ev_date

            if ev.departure_code:

                dep_sets[sid].add(ev.departure_code)



        # Upsert ServicePopularity

        ins = upd = 0

        for sid, total in totals.items():

            c365 = totals_365.get(sid, 0)

            lu   = last_used.get(sid)

            ddep = len(dep_sets.get(sid, set()))



            row = s.query(ServicePopularity).filter(ServicePopularity.service_id==sid).first()

            if not row:

                row = ServicePopularity(service_id=sid, total_count=total, count_365d=c365,

                                        last_used=lu.isoformat() if lu else None, distinct_departures=ddep, updated_at=today)

                s.add(row); ins += 1

            else:

                changed = False

                if row.total_count != total: row.total_count = total; changed = True

                if row.count_365d != c365: row.count_365d = c365; changed = True

                lu_str = lu.isoformat() if lu else None
                if row.last_used != lu_str: row.last_used = lu_str; changed = True

                if row.distinct_departures != ddep: row.distinct_departures = ddep; changed = True

                row.updated_at = today

                if changed: upd += 1

        s.commit()

    print("Popularity updated -> inserted={}, updated={}".format(ins, upd))



if __name__ == "__main__":

    compute_popularity()

