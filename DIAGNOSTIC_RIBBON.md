# Diagnostic Ruban "Unsaved changes"

## A) JSX et État

### 1. Déclaration de l'état `confirmNav`

```326:326:frontend/src/pages/QuoteEditor.jsx
  const [confirmNav, setConfirmNav] = useState({ visible:false, busy:false, action:null }); // action: {type:'new'|'open', id?:string}
```

### 2. Bloc JSX complet du ruban "Unsaved changes"

```1574:1591:frontend/src/pages/QuoteEditor.jsx
      {/* Dirty navigation ribbon fixed on topbar */}
      {confirmNav.visible && (
        <div style={{
          position:"sticky", top:0, zIndex:1000,
          background:"#26334d", borderBottom:"1px solid rgba(255,255,255,.12)",
          color:"#e6edf7", padding:"8px 12px", display:"flex", alignItems:"center", gap:8
        }}>
          <span style={{fontWeight:600}}>Unsaved changes</span>
          <span style={{opacity:.85}}>You have unsaved edits. What do you want to do?</span>
          <div style={{marginLeft:"auto", display:"flex", gap:8}}>
            <button className="btn primary" onClick={saveAndProceed} disabled={confirmNav.busy}>
              {confirmNav.busy ? "Saving…" : "Save & proceed"}
            </button>
            <button className="btn" onClick={discardAndProceed} disabled={confirmNav.busy}>Discard & proceed</button>
            <button className="btn" onClick={cancelProceed} disabled={confirmNav.busy} title="Cancel (Esc)">Cancel</button>
          </div>
        </div>
      )}
```

### 3. Boutons topbar "Save" et "Open" et leurs handlers

**Bouton Save:**
```1567:1567:frontend/src/pages/QuoteEditor.jsx
        <button className="btn primary" onClick={() => { console.info("[topbar] Save clicked"); void saveQuote(); }}>Save</button>
```

**Bouton New:**
```1518:1518:frontend/src/pages/QuoteEditor.jsx
        <button onClick={requestNew} className="btn">New</button>
```

**Bouton Open:**
```1529:1535:frontend/src/pages/QuoteEditor.jsx
        <button
          className="btn"
          onClick={()=> openId.trim() ? requestOpen(openId.trim()) : showNotice("Enter an ID", "info")}
          title="Open by ID"
        >
          Open
        </button>
```

**Input Open avec Enter:**
```1522:1528:frontend/src/pages/QuoteEditor.jsx
        <input
          className="id-input"
          placeholder="id…"
          value={openId}
          onChange={e=>setOpenId(e.target.value)}
          onKeyDown={(e)=>{ if(e.key==="Enter" && openId.trim()) { e.preventDefault(); requestOpen(openId.trim()); } }}
        />
```

### 4. Définitions des fonctions

**`saveAndProceed`:**
```694:721:frontend/src/pages/QuoteEditor.jsx
  const saveAndProceed = async () => {
    const a = confirmNav.action;
    if (!a) return;
    if (inflightRef.current) { console.warn("[nav] saveAndProceed ignored, inflight"); return; }
    try {
      inflightRef.current = true;
      console.info("[nav] saveAndProceed", a);
      setConfirmNav(s => ({ ...s, busy:true }));
      const ok = await saveQuote();
      if (!ok) {
        console.warn("[nav] saveAndProceed: save failed");
        return;
      }
      // Success: hide ribbon then proceed
      setConfirmNav({ visible:false, busy:false, action:null });
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

**`discardAndProceed`:**
```685:692:frontend/src/pages/QuoteEditor.jsx
  const discardAndProceed = () => {
    const a = confirmNav.action;
    console.info("[nav] discard", a);
    setConfirmNav({ visible:false, busy:false, action:null }); // close ribbon first
    if (!a) return;
    if (a.type === "new") handleNew();
    if (a.type === "open" && a.id) fetchQuote(a.id);
  };
```

**`cancelProceed`:**
```681:684:frontend/src/pages/QuoteEditor.jsx
  const cancelProceed = () => {
    console.info("[nav] cancel");
    setConfirmNav({ visible:false, busy:false, action:null });
  };
```

**`requestOpen`:**
```672:680:frontend/src/pages/QuoteEditor.jsx
  const requestOpen = (id) => {
    const qid = String(id || "").trim();
    if (!qid) return;
    if (q?.dirty) {
      setConfirmNav({ visible:true, busy:false, action:{ type:"open", id: qid } });
    } else {
      fetchQuote(qid);
    }
  };
```

**`requestNew`:**
```665:671:frontend/src/pages/QuoteEditor.jsx
  const requestNew = () => {
    if (q?.dirty) {
      setConfirmNav({ visible:true, busy:false, action:{ type:"new" } });
    } else {
      handleNew();
    }
  };
```

**`handleNew`:**
```511:532:frontend/src/pages/QuoteEditor.jsx
  const handleNew = () => {
    const q0 = emptyQuote(); // 3 days with date:null, destination:""
    // Today in UTC ISO
    const todayISO = new Date().toISOString().slice(0,10);
    const d1 = addDaysISO(todayISO, 1);
    const d2 = addDaysISO(todayISO, 2);
    const daysPrefilled = (q0.days || []).slice(0,3).map((d, i) => ({
      ...d,
      date: i === 0 ? todayISO : (i === 1 ? d1 : d2),
      destination: "", // ensure empty destination on fresh quotes
    }));
    const q1 = {
      ...q0,
      start_date: todayISO,
      end_date: d2,
      days: daysPrefilled,
    };
    setQ(q1);
    setOpenId("");
    if (q1.days && q1.days.length > 0) setActiveDayId(q1.days[0].id);
    showNotice("New quote created", "success");
  };
```

**`fetchQuote`:**
```624:638:frontend/src/pages/QuoteEditor.jsx
  const fetchQuote = async (quoteId) => {
    if (!quoteId) return;
    try {
      const quoteRaw = await api.getQuote(quoteId);
      const quote = normalizeQuotePositions(quoteRaw); // trust backend order, ensure positions are consistent client-side
      // Assurer que margin_pct a une valeur par défaut
      if (quote.margin_pct == null) quote.margin_pct = DEFAULT_MARGIN;
      setQ(quote);
      setOpenId(String(quoteId));
      showNotice(`Opened #${quoteId}`, "success");
    } catch (err) {
      console.error("Fetch error:", err);
      showNotice("Open failed (check ID)", "error");
    }
  };
```

**`saveQuote` (extrait clé):**
```534:622:frontend/src/pages/QuoteEditor.jsx
  // Returns boolean: true on success, false on failure
  const saveQuote = async () => {
    if (!q) {
      console.warn("Save: no quote");
      showNotice("Nothing to save", "info");
      return false;
    }
    try {
      console.info("[saveQuote] start", { hasId: !!q.id });
      // ensure positions reflect current visual order before serializing
      const qNorm = normalizeQuotePositions(q);
      if (!qNorm || !qNorm.days) {
        console.error("Save: normalized quote is invalid", qNorm);
        showNotice("Save failed", "error");
        return false;
      }
      const payload = {
        title: qNorm.title,
        pax: qNorm.pax,
        start_date: qNorm.start_date,
        end_date: qNorm.end_date,
        margin_pct: qNorm.margin_pct,
        onspot_manual: qNorm.onspot_manual,
        hassle_manual: qNorm.hassle_manual,
        days: qNorm.days.map((d, idx) => ({
          position: idx,
          date: d.date,
          destination: d.destination,
          decorative_images: d.decorative_images || [],
          lines: (d.lines || []).map((l, liIdx) => ({
            position: liIdx,
            service_id: l.service_id,
            category: l.category,
            title: l.title,
            supplier_name: l.supplier_name,
            visibility: l.visibility || "client",
            achat_eur: l.achat_eur,
            achat_usd: l.achat_usd,
            vente_usd: l.vente_usd,
            fx_rate: l.fx_rate,
            currency: l.currency,
            base_net_amount: l.base_net_amount,
            raw_json: { ...(l.raw_json || {}), fx: (l.fx_rate ?? fxEuroToUsd ?? DEFAULT_FX) },
          })),
        })),
      };
      
      // If no ID, create the quote first
      let quoteId = q.id;
      if (!quoteId) {
        const created = await api.createOrSaveQuote(payload).catch(e => {
          console.error("[saveQuote] create error", e);
          return null;
        });
        if (created && created.id) {
          quoteId = created.id;
          const createdNorm = normalizeQuotePositions(created);
          setQ({ ...createdNorm, dirty: false });
          setOpenId(String(created.id));
          showNotice("Saved", "success");
          console.info("[saveQuote] created ok", { id: created.id });
          return true;
        } else {
          console.error("Save: failed to create quote");
          showNotice("Save failed", "error");
          return false;
        }
      }
      
      // Update existing quote
      const updated = await api.saveQuote(quoteId, payload).catch(e => {
        console.error("[saveQuote] update error", e);
        return null;
      });
      if (!updated) {
        showNotice("Save failed", "error");
        return false;
      }
      const updatedNorm = normalizeQuotePositions(updated);
      setQ({ ...updatedNorm, dirty: false });
      showNotice("Saved", "success");
      console.info("[saveQuote] updated ok", { id: quoteId });
      return true;
    } catch (err) {
      console.error("Save error:", err);
      showNotice("Save failed", "error");
      return false;
    }
  };
```

## B) CSS

### Règles `.topbar`

```29:36:frontend/src/styles/quote.css
.topbar{
  display:flex;
  align-items:center;
  gap:8px;
  padding:10px 12px;
  background:var(--rail);
  border-bottom:1px solid rgba(255,255,255,.06);
}
```

### Règles `.btn`

```87:88:frontend/src/styles/quote.css
.btn{background:#1a2b4b;cursor:pointer;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:0 14px;height:36px;}
.btn.primary{background:var(--accent);color:#061124;border:none}
```

### Règles `.left-list`

```177:179:frontend/src/styles/quote.css
.left-list{
  padding:12px; position:sticky; top:0;
}
```

### Règles `.rail.right`

```96:101:frontend/src/styles/quote.css
.rail{
  background:var(--rail);
  overflow:auto;
  border-right:1px solid rgba(255,255,255,.06);
}
.rail.right{border-right:none;border-left:1px solid rgba(255,255,255,.06)}
```

### Styles inline du ruban (dans JSX)

Le ruban utilise des styles inline :
- `position: "sticky"`
- `top: 0`
- `zIndex: 1000`
- `background: "#26334d"`
- `borderBottom: "1px solid rgba(255,255,255,.12)"`
- `color: "#e6edf7"`
- `padding: "8px 12px"`
- `display: "flex"`
- `alignItems: "center"`
- `gap: 8`

**Note:** Aucune règle CSS externe n'est appliquée au ruban, tout est en inline dans le JSX.

## C) DevTools - Vérifications à effectuer

### 1. Elements - Sélection du ruban

Dans l'onglet Elements, sélectionner le `<div>` du ruban et vérifier les valeurs Computed :

- **position**: `sticky`
- **top**: `0px`
- **z-index**: `1000`
- **height**: (valeur calculée)
- **pointer-events**: `auto` (par défaut)
- **width**: (valeur calculée)

### 2. État des boutons

**Avant clic sur "Save & proceed":**
- Le bouton a-t-il `disabled={true}` en permanence ?
- Le bouton "Cancel" a-t-il `disabled={true}` en permanence ?
- Vérifier dans l'onglet Elements les attributs `disabled` des boutons.

### 3. Network - Requêtes API

**Après clic sur "Save & proceed":**
- Voir un `POST /quotes` ou `PUT /quotes/{id}` ?
- Si non, confirmer qu'aucune requête ne part.
- Vérifier les logs console pour `[saveQuote] start`, `[saveQuote] create error`, `[saveQuote] update error`, etc.

## D) État courant - À vérifier avant clic

### Valeurs à afficher dans la console

Ajouter temporairement dans `saveAndProceed` (ou via DevTools Console) :

```javascript
console.log("[DEBUG] État avant clic:", {
  "q.id": q?.id,
  "openId": openId,
  "q.dirty": q?.dirty,
  "confirmNav.visible": confirmNav.visible,
  "confirmNav.busy": confirmNav.busy,
  "confirmNav.action": confirmNav.action,
  "inflightRef.current": inflightRef.current
});
```

### Capture d'écran

Prendre une capture d'écran montrant :
- Le ruban "Unsaved changes" visible
- La topbar avec les boutons "New", "Open", "Save"
- L'état des boutons du ruban (disabled/enabled)

## Points d'attention

1. **Double nettoyage de `busy`** : Dans `saveAndProceed`, `busy` est nettoyé dans le `catch` ET dans le `finally`. Si le ruban est déjà caché (ligne 708), le `finally` peut réactiver `busy` sur un état caché.

2. **`inflightRef` non réinitialisé en cas d'erreur** : Si `saveQuote()` échoue et retourne `false`, `inflightRef.current` est réinitialisé dans le `finally`, mais si une exception est levée avant, il pourrait rester à `true`.

3. **Ordre des `setConfirmNav`** : Dans `saveAndProceed`, ligne 708 cache le ruban AVANT d'exécuter `handleNew()` ou `fetchQuote()`. Si ces fonctions modifient `q.dirty`, cela pourrait déclencher un nouveau `requestNew`/`requestOpen` qui réafficherait le ruban.

4. **Pas de vérification de `q.dirty` après save** : Après un save réussi, `q.dirty` est mis à `false` dans `saveQuote()`, mais si `handleNew()` ou `fetchQuote()` sont appelés immédiatement après, ils pourraient voir un état transitoire.


