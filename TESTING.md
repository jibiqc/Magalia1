# Magal'IA — QuoteEditor Smoke & Regression Checklist

## Daily Smoke (5–10 min)

- [ ] **Open by ID**: Type a valid ID → **Open**. Notice shows "Opened #ID".

- [ ] **Open by URL**: Reload with `?quoteId=<id>`. Quote loads correctly.

- [ ] **New + Save**: Create new quote, set title/pax/dates → **Save**. ID assigned, no errors.

- [ ] **Insert days**: Select a middle day → **+ Before**, **+ After**. Positions contiguous.  

      Verify `end_date = start_date + (days.length - 1)`.

- [ ] **Delete day**: Delete first day then a middle one.  

      First-day delete shifts `start_date` +1. Contiguity preserved.

- [ ] **DnD lines**: Move one line J3→J1 and reorder within J2 → **Save** → **Open**. No snap-back.



## Weekly Regression (30–40 min)

- [ ] **Positions lock**: After multiple inserts/deletes, verify `position=idx` for days and lines.

- [ ] **Rebuild start/end**: Change `start_date` and `end_date` by ±1.  

      Days count equals `end - start + 1` and dates are contiguous.

- [ ] **Totals parity**: Add paid and non-paid services, include Onspot/Hassle duplicates, set per-line FX.  

      Total USD = USD purchases + commission% on purchases + USD sales.  

      No double count Onspot/Hassle. Round display to 2 decimals.

- [ ] **Dirty flag & leave guard**: Modify without saving, try leaving. Confirmation appears.

- [ ] **Notices**:  

  - Invalid ID on Open → error notice.  

  - Save with backend down (simulate) → error notice.  

  - Insert beyond 90 days → "Max 90 days".  

  - Delete when 1 day → "At least 1 day required".

- [ ] **A11y**: Keyboard tab order on topbar and left list. Enter on ID input triggers Open.

- [ ] **Performance**: 15–20 days, 10–15 lines/day. DnD smooth. Save completes without UI freeze.

- [ ] **Catalog add**: From right rail, add a service (e.g., New Hotel).  

      Line appears in active day immediately and Total updates.

- [ ] **State restore**: Sequence = +Before → +After → Delete → DnD → Save → Open.  

      Restored state matches pre-Save exactly.

- [ ] **Guards**:  

  - Try to insert the 91st day → blocked with notice.  

  - Try to delete to 0 day → blocked with notice.



## Data Integrity (ad hoc)

- [ ] Day IDs unique after multiple insert/delete cycles.

- [ ] All day dates are ISO `YYYY-MM-DD`.

- [ ] PUT payload: day `position` spans 0..N−1 with no gaps; same for line positions.



## Quick Commands (optional)

- [ ] Pull latest: `git pull --ff-only`

- [ ] New test branch: `git switch -c test/smoke-<date>`

- [ ] Revert local changes after tests: `git restore . && git clean -fd`



> Tip: Run "Daily Smoke" after each merge to `QuoteEditor.jsx`, and before any demo.

