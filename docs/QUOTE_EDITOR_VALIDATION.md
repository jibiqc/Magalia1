# Quote Editor — Validation Ladder



## Gate 1 — UI skeleton (no DB)

- [ ] Top bar visible (New/Open, Title, Pax, Start/End, Save, Preview, Export, Versions)

- [ ] Left rail visible (list of days mock)

- [ ] Center canvas shows paged look (white page + margins)

- [ ] Right rail visible (Catalog/Insert placeholder)

- [ ] No console errors; FPS stable while scrolling



## Gate 2 — Basic mechanics (still no DB)

- [ ] Create N mock days from Start/End

- [ ] Drag & drop a "mock service" between days (no-op)

- [ ] Keyboard shortcuts no-op: Ctrl+S, Ctrl+P, N, T, I, C



## Gate 3 — Minimal DB schema (Quote/Day/Line)

- [ ] Alembic migration applies cleanly

- [ ] POST /quotes creates a draft quote

- [ ] GET /quotes/{id} returns the draft



## Gate 4 — Cost engine (dry-run)

- [ ] Onspot/Hassle/Margin computed on mocked lines

- [ ] 3 price boxes appear per line; override lock works

- [ ] Day/Quote totals correct (rounding rule noted)



## Gate 5 — Excel-like preview

- [ ] Grid mirrors columns & totals

- [ ] Edits in grid reflect in line objects and vice-versa

- [ ] No broken formulas; no currency mixing



## Gate 6 — Versioning

- [ ] Preview/Export creates a new version row

- [ ] Version history lists snapshots

- [ ] Restore loads the snapshot



## Gate 7 — Exports fidelity

- [ ] DOCX pixel/point-perfect vs your golden file

- [ ] XLSX structure/borders/formats identical

