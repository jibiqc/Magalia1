# Contexte de Diagnostic - Ruban "Unsaved changes"

## A) JSX réel du ruban et de la topbar

### 1. Ruban "Unsaved changes" (lignes 1587-1630)

```1587:1630:frontend/src/pages/QuoteEditor.jsx
      {/* Dirty navigation ribbon: fixed wrapper (non-blocking) + inner (clickable) */}
      {confirmNav.visible && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            pointerEvents: "none",
          }}
          aria-live="polite"
        >
          <div
            style={{
              maxWidth: "100%",
              background: "#26334d",
              borderBottom: "1px solid rgba(255,255,255,.12)",
              color: "#e6edf7",
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              pointerEvents: "auto",
            }}
          >
            <span style={{ fontWeight: 600 }}>Unsaved changes</span>
            <span style={{ opacity: 0.85 }}>
              You have unsaved edits. What do you want to do?
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn primary" onClick={saveAndProceed} disabled={confirmNav.busy}>
                {confirmNav.busy ? "Saving…" : "Save & proceed"}
              </button>
              <button className="btn" onClick={discardAndProceed} disabled={confirmNav.busy}>
                Discard & proceed
              </button>
              <button className="btn" onClick={cancelProceed} disabled={confirmNav.busy} title="Cancel (Esc)">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
```

### 2. Topbar avec boutons New, Open, Save (lignes 1525-1586)

```1525:1586:frontend/src/pages/QuoteEditor.jsx
      <div className="topbar">

        <div className="brand">Magal'IA</div>



        <button onClick={requestNew} className="btn">New</button>



        <input
          className="id-input"
          placeholder="id…"
          value={openId}
          onChange={e=>setOpenId(e.target.value)}
          onKeyDown={(e)=>{ if(e.key==="Enter" && openId.trim()) { e.preventDefault(); requestOpen(openId.trim()); } }}
        />
        <button
          className="btn"
          onClick={()=> openId.trim() ? requestOpen(openId.trim()) : showNotice("Enter an ID", "info")}
          title="Open by ID"
        >
          Open
        </button>



        {/* >>> élargir le titre : il prend la place restante */}

        <input

          className="title-input"

          placeholder="Quote title"

          value={q.title||""}

          onChange={e=>setQ(p=>({...p,title:e.target.value}))}

        />



        {/* le reste: pax, dates, fx, Save… */}

        <input className="pax-input" type="number" value={q.pax||0} onChange={e=>setQ(p=>({...p,pax: Number(e.target.value||0)}))} />

        <input type="date" className="date-input" value={startDateStr} onChange={onStartDateChange}/>

        <input type="date" className="date-input" value={endDateStr} onChange={onEndDateChange}/>

        <div className="fx-wrap"><span>€→$</span><input className="fx-global-inp" type="text" inputMode="decimal" placeholder="€→$" value={toStr(fxEuroToUsd)} onChange={(e)=> setFxEuroToUsd(e.target.value)} onBlur={()=> setFxEuroToUsd(round2(parseLocaleFloat(fxEuroToUsd)))} /></div>



        <button className="btn primary" onClick={() => { console.info("[topbar] Save clicked"); void saveQuote(); }}>Save</button>

        <button className="btn secondary" onClick={() => setTrashOpen(!trashOpen)} title="Trash">
          🗑 {trashLines.length > 0 && <span>({trashLines.length})</span>}
        </button>

      </div>
```

## B) État et handlers au runtime (logs ajoutés)

### Log d'état ajouté avant le return (ligne 1517-1523)

```1517:1523:frontend/src/pages/QuoteEditor.jsx
  // DEBUG: Log state before render
  console.log("[STATE]", {
    dirty: q?.dirty ?? null,
    id: q?.id ?? null,
    openId,
    confirmNav
  });
```

**Instructions pour tester :**
1. Ouvrir la console du navigateur
2. Cliquer sur chaque bouton et noter la sortie console correspondante :
   - "Save & proceed" → devrait loguer `[RIBBON BEFORE CLICK]`, `[RIBBON AFTER SET]`, `[saveQuote] start`, etc.
   - "Discard & proceed" → devrait loguer `[RIBBON BEFORE CLICK]`, `[RIBBON AFTER SET]`, `[nav] discard`
   - "Cancel" → devrait loguer `[RIBBON BEFORE CLICK]`, `[RIBBON AFTER SET]`, `[nav] cancel`
   - "Save" (topbar) → devrait loguer `[topbar] Save clicked`, `[saveQuote] start`
   - "Open" (topbar) → devrait loguer `[nav] requestOpen` ou `[nav] fetchQuote`

### Logs ajoutés dans les handlers

**`cancelProceed` (lignes 681-686):**
```681:686:frontend/src/pages/QuoteEditor.jsx
  const cancelProceed = () => {
    console.info("[nav] cancel");
    console.log("[RIBBON BEFORE CLICK]", { confirmNav });
    setConfirmNav({ visible:false, busy:false, action:null });
    console.log("[RIBBON AFTER SET]", { confirmNav: { visible:false, busy:false, action:null } });
  };
```

**`discardAndProceed` (lignes 687-696):**
```687:696:frontend/src/pages/QuoteEditor.jsx
  const discardAndProceed = () => {
    const a = confirmNav.action;
    console.info("[nav] discard", a);
    console.log("[RIBBON BEFORE CLICK]", { confirmNav });
    setConfirmNav({ visible:false, busy:false, action:null }); // close ribbon first
    console.log("[RIBBON AFTER SET]", { confirmNav: { visible:false, busy:false, action:null } });
    if (!a) return;
    if (a.type === "new") handleNew();
    if (a.type === "open" && a.id) fetchQuote(a.id);
  };
```

**`saveAndProceed` (lignes 698-725):**
```698:725:frontend/src/pages/QuoteEditor.jsx
  const saveAndProceed = async () => {
    const a = confirmNav.action;
    if (!a) return;
    console.log("[RIBBON BEFORE CLICK]", { confirmNav });
    if (inflightRef.current) { console.warn("[nav] saveAndProceed ignored, inflight"); return; }
    try {
      inflightRef.current = true;
      console.info("[nav] saveAndProceed", a);
      setConfirmNav(s => {
        const next = { ...s, busy:true };
        console.log("[RIBBON AFTER SET]", { confirmNav: next });
        return next;
      });
      const ok = await saveQuote();
      if (!ok) {
        console.warn("[nav] saveAndProceed: save failed");
        return;
      }
      // Success: hide ribbon then proceed
      setConfirmNav({ visible:false, busy:false, action:null });
      console.log("[RIBBON AFTER SET]", { confirmNav: { visible:false, busy:false, action:null } });
      console.info("[nav] proceeding after save", a);
      if (a.type === "new") handleNew();
      if (a.type === "open" && a.id) fetchQuote(a.id);
    } catch (e) {
      console.error("[nav] saveAndProceed error", e);
      setConfirmNav(s => ({ ...s, busy:false }));
      showNotice("Save failed", "error");
    } finally {
      // Always clear busy; if ribbon is already hidden, this is a no-op
      setConfirmNav(s => ({ ...s, busy:false }));
      inflightRef.current = false;
    }
  };
```

## C) Attributs disabled et portée des clics

### Vérifications à effectuer dans DevTools Elements

1. **Les 3 boutons du ruban** :
   - Inspecter chaque bouton (`Save & proceed`, `Discard & proceed`, `Cancel`)
   - Vérifier l'attribut `disabled` dans l'onglet Elements
   - Si `disabled` est présent, noter sa valeur (`true` ou `false`)

2. **Le bouton Save topbar** :
   - Inspecter le bouton "Save" dans `.topbar`
   - Vérifier l'attribut `disabled`
   - Si `disabled` est présent, noter sa valeur

**Résultat attendu :** Aucun bouton ne devrait avoir `disabled="true"` en permanence (sauf si `confirmNav.busy === true`).

## D) Styles calculés qui peuvent bloquer les clics

### Pour le wrapper du ruban (div position:fixed)

Dans DevTools Elements, sélectionner le div wrapper (celui avec `position: "fixed"`) et vérifier dans l'onglet Computed :

- **z-index**: `9999` (attendu)
- **pointer-events**: `none` (attendu - ne bloque pas les clics)
- **top**: `0px` (attendu)
- **height**: (valeur calculée - devrait couvrir toute la hauteur de l'écran si `bottom` n'est pas défini)
- **width**: (valeur calculée - devrait être `100%` ou la largeur de l'écran)

### Pour le contenu interne du ruban (div avec pointerEvents: "auto")

Sélectionner le div interne (celui avec `pointerEvents: "auto"`) et vérifier :

- **z-index**: (hérité du parent ou `auto`)
- **pointer-events**: `auto` (attendu - capture les clics)
- **height**: (valeur calculée basée sur le contenu)
- **width**: (valeur calculée - `maxWidth: "100%"` devrait limiter à la largeur de l'écran)

**getBoundingClientRect()** (à exécuter dans la console) :
```javascript
// Sélectionner le div interne du ruban dans Elements, puis dans Console :
$0.getBoundingClientRect()
// Devrait retourner : { top, left, right, bottom, width, height, x, y }
```

### Pour .topbar

Sélectionner `.topbar` et vérifier :

- **z-index**: (valeur calculée - probablement `auto` ou `0`)
- **position**: (valeur calculée - probablement `static` ou `relative`)
- **height**: (valeur calculée - probablement `56px` avec padding)

**Vérifier les parents :**
- Remonter dans la hiérarchie DOM et vérifier si un parent a :
  - `overflow: hidden` (peut masquer le ruban)
  - `z-index` supérieur à `9999` (peut masquer le ruban)

## E) Présence d'un overlay concurrent

### Recherche dans le code

**Dans `frontend/src/pages/QuoteEditor.jsx` :**

1. **Ruban "Unsaved changes"** (ligne 1601) :
   - `position: "fixed"`, `zIndex: 9999`, `pointerEvents: "none"`

2. **Notice non-modale** (ligne 1645) :
   - `position:"fixed", top:10, left:10, zIndex:9999`
   - **Conflit potentiel** : même `zIndex: 9999` que le ruban

**Dans `frontend/src/styles/quote.css` :**

1. **`.left-list`** (ligne 178) :
   - `position:sticky; top:0;`
   - Pas de conflit (sticky, pas fixed)

2. **`.quote-table thead th`** (ligne 295) :
   - `position: sticky; top: 0;`
   - Pas de conflit (sticky, pas fixed)

3. **`.modal-backdrop`** (ligne 551) :
   - `position:fixed; inset:0; z-index:9999;`
   - **Conflit potentiel** : même `zIndex: 9999` que le ruban
   - Mais devrait être masqué quand le ruban est visible (modals fermées)

4. **`.modal-overlay`** (ligne 627) :
   - `position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 1000;`
   - Pas de conflit (`z-index: 1000` < `9999`)

5. **`.trash-drawer`** (ligne 865) :
   - `position: fixed; inset: 0;`
   - Pas de `z-index` explicite (probablement `auto` ou `0`)

**Résumé des overlays concurrents :**
- **Notice non-modale** : même `zIndex: 9999` → peut masquer le ruban si elle est visible
- **Modal backdrop** : même `zIndex: 9999` → ne devrait pas être visible en même temps que le ruban

## F) Vérification des imports et refs

### Import de `useRef`

```1:1:frontend/src/pages/QuoteEditor.jsx
import React, {useEffect, useMemo, useRef, useState, useCallback} from "react";
```

✅ **Confirmé** : `useRef` est bien importé.

### Déclaration de `inflightRef`

```697:697:frontend/src/pages/QuoteEditor.jsx
  const inflightRef = useRef(false);
```

✅ **Confirmé** : `inflightRef` est déclaré avec `useRef(false)`.

## G) État busy exact

### Logs ajoutés

Les logs `[RIBBON BEFORE CLICK]` et `[RIBBON AFTER SET]` ont été ajoutés dans :
- `cancelProceed` (lignes 683, 685)
- `discardAndProceed` (lignes 690, 692)
- `saveAndProceed` (lignes 701, 706, 714)

**Instructions pour tester :**
1. Ouvrir la console
2. Cliquer sur chaque bouton du ruban
3. Noter les valeurs de `confirmNav.busy` dans les logs `[RIBBON BEFORE CLICK]` et `[RIBBON AFTER SET]`

**Résultat attendu :**
- **Avant clic** : `busy: false` (sauf si une opération est en cours)
- **Après clic sur "Save & proceed"** : `busy: true` immédiatement, puis `busy: false` dans le `finally`
- **Après clic sur "Discard & proceed"** : `busy: false` (pas de changement)
- **Après clic sur "Cancel"** : `busy: false` (pas de changement)

## H) Checklist de diagnostic

- [ ] Vérifier les logs `[STATE]` à chaque render
- [ ] Vérifier les logs `[RIBBON BEFORE CLICK]` et `[RIBBON AFTER SET]` pour chaque bouton
- [ ] Vérifier les attributs `disabled` des boutons dans Elements
- [ ] Vérifier les styles calculés du wrapper et du contenu interne du ruban
- [ ] Vérifier `getBoundingClientRect()` du contenu interne
- [ ] Vérifier les styles de `.topbar` et ses parents
- [ ] Vérifier si la notice non-modale est visible en même temps que le ruban
- [ ] Vérifier si un modal est ouvert en même temps que le ruban
- [ ] Vérifier la valeur de `inflightRef.current` dans la console avant chaque clic


