import React, {useEffect, useMemo, useRef, useState} from "react";

import "../styles/quote.css";
import DestinationRangeModal from "../components/DestinationRangeModal";
import CarRentalModal from "../components/CarRentalModal";
import { api } from "../lib/api";
import { fmtDateShortISO, fmtDateLongISO } from "../utils/dateFmt";



// Défaut global pour la marge
const DEFAULT_MARGIN = 0.1627; // 16.27 %

const money = (n=0, {digits=2}={}) => `$${(Number(n)||0).toFixed(digits)}`;

const parseNum = v => {

  if (v===null || v===undefined || v==="") return 0;

  const n = typeof v==="number" ? v : Number(String(v).replace(/[^\d.-]/g,""));

  return Number.isFinite(n) ? n : 0;

};

// Affichages
const asMoney = (n) => `$${Number(n || 0).toFixed(2)}`;

const parseUsd = (s) => {
  const x = String(s ?? '').replace(',', '.').replace(/[^0-9.\-]/g,'').trim();
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

// Saisie utilisateur "16,27" ou "16.27" -> 0.1627
const parsePct = (s) => {
  const x = String(s ?? '').replace(',', '.').replace(/[^0-9.\-]/g,'').trim();
  const n = Number(x);
  return Number.isFinite(n) ? Math.max(0, n/100) : DEFAULT_MARGIN; // "16.27" -> 0.1627
};

// Helpers à placer en haut du fichier (hors composant)

const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100;

// --- Commission helpers (acceptent "16,27", "16.27%", "0,1627") ---
const pctToDisplay = (p) =>
  (typeof p === "number" ? p * 100 : parseFloat(p || 0) * 100)
    .toFixed(2)
    .replace(".", ",");

const displayToPct = (s, fallback = 0.1627) => {
  if (!s && s !== 0) return fallback;
  const t = String(s).replace("%", "").replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(t);
  if (isNaN(n)) return fallback;
  return n > 1 ? n / 100 : n; // 16.27 -> 0.1627, 0.1627 -> 0.1627
};

function isFirstOfDestBlock(days, idx){
  const cur = days[idx];
  if (!cur?.destination) return false;
  if (idx === 0) return true;
  return days[idx-1]?.destination !== cur.destination;
}

function countNightsFromIndex(days, idx){
  const dest = days[idx]?.destination;
  if (!dest) return 0;
  let n = 1;
  for (let j=idx+1;j<days.length;j++){
    if (days[j]?.destination === dest) n++; else break;
  }
  return n;
}



const newTripInfo = () => ({

  id: crypto.randomUUID(),

  category: "Trip info",

  title: "Trip info (edit me…)",

  supplier_name: null,

  achat_eur: 0, achat_usd: 0, vente_usd: 0,

});

const newPayable = (category, title, supplier=null) => ({

  id: crypto.randomUUID(),

  category, title, supplier_name: supplier,

  achat_eur: 0, achat_usd: 0, vente_usd: 0,

});



const emptyQuote = () => ({

  id: null,

  title: "",

  pax: 2,

  start_date: "2025-04-07",

  end_date: "2025-04-09",

  days: [

    { id: crypto.randomUUID(), date:"2025-04-07", destination:"Paris", lines:[ newTripInfo() ] },

    { id: crypto.randomUUID(), date:"2025-04-08", destination:"Paris", lines:[] },

    { id: crypto.randomUUID(), date:"2025-04-09", destination:"Paris", lines:[] },

  ],

  margin_pct: DEFAULT_MARGIN,

  onspot_manual: null,

  hassle_manual: null,

});



export default function QuoteEditor(){

  const [q,setQ] = useState(emptyQuote);

  const [activeDayId,setActiveDayId] = useState(null);

  const totalsRef = useRef(null);



  // FX global (par défaut 0.75)

  const [fxEuroToUsd, setFxEuroToUsd] = useState(0.75);



  // États pour la topbar

  const [openId, setOpenId] = useState("");

  // Destination modal state

  const [destModal, setDestModal] = useState({ open: false, quoteId: null, startDate: null });
  // Car Rental modal state
  const [carModalOpen, setCarModalOpen] = useState(false);

  // Compute safe currentQuoteId
  const currentQuoteId = (q && q.id) || null;

  // Commission edit state
  const [commEdit, setCommEdit] = React.useState({
    active: false,
    text: ((q.margin_pct ?? DEFAULT_MARGIN) * 100).toFixed(2), // "16.27"
  });

  // Si la marge change ailleurs, resynchroniser l'affichage quand on N'édite pas
  React.useEffect(() => {
    if (!commEdit.active) {
      setCommEdit(s => ({
        ...s,
        text: ((q.margin_pct ?? DEFAULT_MARGIN) * 100).toFixed(2),
      }));
    }
  }, [q.margin_pct, commEdit.active]);

  // --- Drag & drop state & helpers ---

  const [dragging, setDragging] = useState(null);



  const onDragStart = (e, fromDay, fromIndex) => {

    e.dataTransfer.effectAllowed = 'move';

    e.dataTransfer.setData('text/plain', JSON.stringify({ fromDay, fromIndex }));

    setDragging({ fromDay, fromIndex });

  };



  const allowDrop = (e) => {

    e.preventDefault();

    e.dataTransfer.dropEffect = 'move';

  };



  const dropOnDayEnd = (e, toDay) => {

    e.preventDefault();

    const data = e.dataTransfer.getData('text/plain');

    if (!data) return;

    const { fromDay, fromIndex } = JSON.parse(data);

    setQ((prev) => {

      const next = structuredClone(prev);

      const src = [...next.days[fromDay].lines];

      const [moved] = src.splice(fromIndex, 1);

      const dst = [...next.days[toDay].lines, moved];

      next.days[fromDay].lines = src;

      next.days[toDay].lines = dst;

      return next;

    });

    setDragging(null);

  };



  const dropBefore = (e, toDay, toIndex) => {

    e.preventDefault();

    const data = e.dataTransfer.getData('text/plain');

    if (!data) return;

    const { fromDay, fromIndex } = JSON.parse(data);

    setQ((prev) => {

      const next = structuredClone(prev);

      const src = [...next.days[fromDay].lines];

      const [moved] = src.splice(fromIndex, 1);

      const dst = [...next.days[toDay].lines];

      const insertAt = (fromDay === toDay && fromIndex < toIndex) ? toIndex - 1 : toIndex;

      dst.splice(insertAt, 0, moved);

      next.days[fromDay].lines = src;

      next.days[toDay].lines = dst;

      return next;

    });

    setDragging(null);

  };



  // Helpers pour les dates

  const startDateStr = q.start_date || "";

  const endDateStr = q.end_date || "";

  const onStartDateChange = (e) => setQ(p=>({...p,start_date:e.target.value}));

  const onEndDateChange = (e) => setQ(p=>({...p,end_date:e.target.value}));



  // Handlers

  const handleNew = () => { setQ(emptyQuote()); setOpenId(""); };

  const saveQuote = async () => {
    if (!q.id) return;
    try {
      const payload = {
        title: q.title,
        pax: q.pax,
        start_date: q.start_date,
        end_date: q.end_date,
        margin_pct: q.margin_pct,
        onspot_manual: q.onspot_manual,
        hassle_manual: q.hassle_manual,
        days: q.days.map((d, idx) => ({
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
            raw_json: l.raw_json || {},
          })),
        })),
      };
      const updated = await api.saveQuote(q.id, payload);
      setQ(updated);
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const fetchQuote = async (quoteId) => {
    if (!quoteId) return;
    try {
      const quote = await api.getQuote(quoteId);
      // Assurer que margin_pct a une valeur par défaut
      if (quote.margin_pct == null) quote.margin_pct = DEFAULT_MARGIN;
      setQ(quote);
      setOpenId(String(quoteId));
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const ensureQuoteId = async () => {
    // If already have an id, return it
    const existing = (q && q.id) || null;
    if (existing) return existing;

    // Otherwise, trigger save/create flow
    try {
      const payload = {
        title: q.title,
        pax: q.pax,
        start_date: q.start_date,
        end_date: q.end_date,
        margin_pct: q.margin_pct,
        onspot_manual: q.onspot_manual,
        hassle_manual: q.hassle_manual,
        days: q.days.map((d, idx) => ({
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
            raw_json: l.raw_json || {},
          })),
        })),
      };
      const created = await api.createOrSaveQuote(payload);
      // Update local state with the created quote
      if (created && created.id) {
        setQ(created);
        setOpenId(String(created.id));
        return created.id;
      }
      return null;
    } catch (err) {
      console.error("ensureQuoteId error:", err);
      throw err;
    }
  };



  // utilitaires pour maj de lignes

  const updateLine = (dayIdx, lineIdx, patch) => {

    setQ(prev => {

      const next = structuredClone(prev);

      Object.assign(next.days[dayIdx].lines[lineIdx], patch);

      return next;

    });

  };






  // rebuild between start/end if needed

  useEffect(()=>{

    const d0 = new Date(q.start_date+"T00:00:00");

    const d1 = new Date(q.end_date+"T00:00:00");

    if (isNaN(d0) || isNaN(d1)) return;

    const n = Math.max(1, Math.round((d1 - d0)/(24*3600*1000))+1);

    const days = Array.from({length:n}, (_,i)=>{

      const iso = new Date(d0.getTime()+i*86400000).toISOString().slice(0,10);

      const existing = q.days[i];

      return existing ? {...existing, date: iso} : { id: crypto.randomUUID(), date: iso, destination: q.days[0]?.destination ?? "", lines:[] };

    });

    setQ(prev=>({...prev, days}));

    if (!activeDayId && days.length) setActiveDayId(days[0].id);

  // eslint-disable-next-line

  }, [q.start_date, q.end_date]);



  const numDays = useMemo(()=> q.days.length || 0, [q.days]);

  // Calculs par défaut
  const onspotDefault = useMemo(()=>{
    // nombre de cartes Onspot: 1 carte / 6 pax (arrondi supérieur)
    const onspotCards = Math.ceil((q.pax || 0) / 6) || 0;
    const tripDays = Math.max(1, q.days?.length || 0);
    return Math.max(27, 9 * onspotCards * tripDays); // min 27 $
  }, [q.pax, q.days]);

  const hassleDefault = useMemo(()=> 150 * (q.pax || 0), [q.pax]);

  // Valeurs effectives avec override
  const onspotValue = useMemo(()=> (q.onspot_manual ?? onspotDefault), [q.onspot_manual, onspotDefault]);
  const hassleValue = useMemo(()=> (q.hassle_manual ?? hassleDefault), [q.hassle_manual, hassleDefault]);



  const calc = useMemo(()=>{

    const achatsService = q.days.flatMap(d=>d.lines)

      .filter(l => l.category!=="Trip info" && l.category!=="Internal info")

      .reduce((sum,l)=> sum + parseNum(l.achat_usd), 0);



    // Utiliser onspotValue directement (déjà calculé avec override)






    // Utiliser onspotValue et hassleValue
    // achats commissionnables = somme USD services + Onspot
    const achatsTotal = achatsService + onspotValue;

    // commission (utiliser toujours le fallback)
    const margin = q.margin_pct ?? DEFAULT_MARGIN;
    const commission = achatsTotal * margin;

    // ventes = somme vente services + Hassle
    const ventes = q.days.flatMap(d=>d.lines).reduce((sum,l)=> sum + parseNum(l.vente_usd), 0) + hassleValue;



    const grand = ventes + commission + achatsTotal;

    return {

      onspot: onspotValue, hassle: hassleValue, achatsService, achatsTotal,

      commission, ventes,

      grandRounded: Math.round(grand)

    };

  }, [q, onspotValue, hassleValue]);






  const addLine = (dayId, category) => {

    setQ(prev=>{

      const days = prev.days.map(d=>{

        if (d.id!==dayId) return d;

        const l = (category==="Trip info"||category==="Internal info")

          ? (category==="Trip info" ? newTripInfo() : {...newTripInfo(), category:"Internal info", title:"Internal note (edit only here)"})

          : newPayable(category, `New ${category}`);

        return {...d, lines:[...d.lines, l]};

      });

      return {...prev, days};

    });

  };



  const totalScroll = ()=> totalsRef.current?.scrollIntoView({behavior:"smooth", block:"start"});



  // Recalculate totals (trigger re-render)

  const recalculateTotals = () => {

    setQ(prev => ({...prev})); // Force re-render to recalc

  };



  // Render Excel preview table

  function renderExcelPreview() {

    // Agrège toutes les lignes "payantes"

    const paidCats = new Set(["Activity","Hotel","Transport","Flight","Train","Ferry","Cost","New Hotel","New Service"]);

    const rows = [];

    let sumEur = 0, sumUsd = 0, sumSell = 0;



    // Onspot/Hassle actuels (utiliser les valeurs calculées)
    const onspotTotal = Number(onspotValue);   // dans Achats $
    const hassleTotal = Number(hassleValue);   // dans Ventes $



    // Onspot row

    rows.push({

      dest: "",

      name: "Onspot",

      eur: 0,

      fx: "",

      usd: onspotTotal,

      sell: 0,

      kind: "meta"

    });



    // Hassle row

    rows.push({

      dest: "",

      name: "Hassle",

      eur: 0,

      fx: "",

      usd: 0,

      sell: hassleTotal,

      kind: "meta"

    });



    // Lignes payantes par jour

    q.days.forEach((day, dIdx) => {

      let printedDest = false;

      (day.lines || []).forEach((line) => {

        if (!paidCats.has((line.category || "").trim())) return;



        const eur  = Number(line.achat_eur || 0);

        const fx   = line.fx_rate ?? "";

        const usd  = Number(line.achat_usd || 0);

        const sell = Number(line.vente_usd || 0);



        rows.push({

          dest: printedDest ? "" : (day.destination || ""),

          name: line.title || line.service_name || "—",

          eur, fx, usd, sell

        });

        printedDest = true;



        sumEur  += eur;

        sumUsd  += usd;

        sumSell += sell;

      });

    });



    // Ajoute Onspot/Hassle dans les totaux comme demandé

    const totalEur  = round2(sumEur);

    const totalUsd  = round2(sumUsd + onspotTotal);

    const totalSell = round2(sumSell + hassleTotal);



    return (

      <div ref={totalsRef} className="excel-card">

        <div className="excel-title">Excel preview</div>

        <table className="et-table table-compact">

          <thead>

            <tr>

              <th>Destination</th>

              <th>Nom du service</th>

              <th>Prix d'achat €</th>

              <th>FX €→$</th>

              <th>Prix d'achat $</th>

              <th>Prix de vente $</th>

            </tr>

          </thead>

          <tbody>

            {rows.map((r, i) => (

              <tr key={i} className={r.kind==="meta" ? "row-meta" : ""}>

                <td>{r.dest}</td>

                <td>{r.name}</td>

                <td className="num">{r.eur ? r.eur.toFixed(2) : ""}</td>

                <td className="num">{r.fx !== "" ? Number(r.fx).toFixed(2) : ""}</td>



                {/* USD: vide pour Hassle, input pour Onspot */}
                <td className={r.name === "Onspot" ? "cell-right" : "num"}>
                  {r.name === "Onspot" ? (
                    <input
                      className="money-cell"
                      value={q.onspot_manual != null ? q.onspot_manual : onspotDefault}
                      onChange={(e) => {
                        const v = parseUsd(e.target.value);
                        setQ(prev => ({ ...prev, onspot_manual: v }));
                      }}
                      onBlur={(e) => {
                        // clamp au minimum 27 $
                        const v = Math.max(27, parseUsd(e.target.value));
                        setQ(prev => ({ ...prev, onspot_manual: v }));
                      }}
                      inputMode="decimal"
                    />
                  ) : r.name === "Hassle" ? "" : `$${r.usd.toFixed(2)}`}
                </td>

                {/* Vente: vide pour Onspot, input pour Hassle */}
                <td className={r.name === "Hassle" ? "cell-right" : "num"}>
                  {r.name === "Hassle" ? (
                    <input
                      className="money-cell"
                      value={q.hassle_manual != null ? q.hassle_manual : hassleDefault}
                      onChange={(e) => {
                        const v = parseUsd(e.target.value);
                        setQ(prev => ({ ...prev, hassle_manual: v }));
                      }}
                      onBlur={(e) => {
                        const v = Math.max(0, parseUsd(e.target.value)); // pas de min, juste >= 0
                        setQ(prev => ({ ...prev, hassle_manual: v }));
                      }}
                      inputMode="decimal"
                    />
                  ) : r.name === "Onspot" ? "" : `$${r.sell.toFixed(2)}`}
                </td>

              </tr>

            ))}

          </tbody>

            <tfoot>

              <tr className="totals">

                <td colSpan={2}>Totaux</td>

                <td className="num">${totalEur.toFixed(2)}</td>

                <td />

                <td className="num">${totalUsd.toFixed(2)}</td>

                <td className="num">${totalSell.toFixed(2)}</td>

              </tr>

            </tfoot>

          </table>



          {/* Récap final */}
          <div className="summary-grid">
            <div className="label">Prix d'achat (USD)</div>
            <div></div>
            <div className="value">{asMoney(calc.achatsTotal)}</div>

            <div className="label">Commission</div>
            <div className="middle" style={{display:'flex', alignItems:'center', gap:6}}>
              <input
                type="text"
                inputMode="decimal"
                className="pct-cell"
                value={commEdit.text}
                placeholder="16.27"
                onFocus={() => {
                  setCommEdit({
                    active: true,
                    // afficher sans forcer 2 décimales pendant l'édition
                    text: ((q.margin_pct ?? DEFAULT_MARGIN) * 100).toString().replace('.', ','),
                  });
                }}
                onChange={(e) => setCommEdit(s => ({ ...s, text: e.target.value }))}
                onBlur={() => {
                  const raw = (commEdit.text ?? '')
                    .toString()
                    .replace(',', '.')
                    .replace(/[^\d.]/g, '');
                  const num = raw === '' ? NaN : Number(raw);
                  const pct = Number.isFinite(num) ? num / 100 : DEFAULT_MARGIN; // 16.27 -> 0.1627
                  setQ(prev => ({ ...prev, margin_pct: pct }));
                  setCommEdit({ active: false, text: (pct * 100).toFixed(2) });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur(); // commit au Enter
                }}
              />
              <span className="pct-suffix">%</span>
            </div>
            <div className="value">{asMoney(calc.commission)}</div>

            <div className="label">Prix de vente (USD)</div>
            <div></div>
            <div className="value">{asMoney(calc.ventes)}</div>

            <div className="total label">Total</div>
            <div></div>
            <div className="total value">{asMoney(calc.grandRounded)}</div>
          </div>

        </div>

      );

    }



  return (

    <div className="app">

      {/* TOP BAR */}

      <div className="topbar">

        <div className="brand">Magal'IA</div>



        <button onClick={handleNew} className="btn">New</button>



        <input className="id-input" placeholder="id…" value={openId} onChange={e=>setOpenId(e.target.value)} />



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

        <div className="fx-wrap"><span>€→$</span><input className="fx-input" type="number" step="0.01" value={fxEuroToUsd} onChange={(e)=>setFxEuroToUsd(e.target.value)} /></div>



        <button className="btn primary" onClick={saveQuote}>Save</button>

      </div>



      <div className="shell">

        {/* Left rail */}

        <div className="rail">

          <div className="left-list">

            <div className="left-group">

              {q.days.map((d,i)=>{
                return (
                  <div key={d.id} className="day-list-item">
                    <button
                      className="day-pin btn-xxs icon-only"
                      aria-label="Set destination for N nights"
                      title="Set destination for N nights"
                      onClick={(e) => {
                        e.stopPropagation(); // don't change selection
                        const qid = (q && q.id) || null;
                        setDestModal({ open: true, quoteId: qid, startDate: d.date });
                      }}
                    >
                      📍
                    </button>
                    <button
                      className={`day-pill ${activeDayId===d.id ? "active":""}`}
                      onClick={()=>{ setActiveDayId(d.id); const el=document.getElementById(`day-${d.id}`); el?.scrollIntoView({behavior:"smooth", block:"start"}); }}
                    >
                      <span className="day-list-label">
                        {fmtDateShortISO(d.date)}{d.destination ? ` — ${d.destination}` : ""}
                      </span>
                    </button>
                  </div>
                );
              })}

              {/* Total row */}

              <button className="total-pill" onClick={totalScroll}>

                <span>Total</span>

                <span className="small">{money(calc.grandRounded,{digits:0})}</span>

              </button>

            </div>

          </div>

        </div>



        {/* COLONNE CENTRALE */}

        <div className="center-rail">

          <div className="page" id="wordPage">

            {/* ---- tout ce qui suit doit être DEDANS ---- */}

            {q.days.map((d, dayIdx)=>(

              <div key={d.id} id={`day-${d.id}`} className="day-card">

                <div className="day-title">
                  {(() => {
                    const longDate = fmtDateLongISO(d.date);
                    let title = longDate;
                    if (isFirstOfDestBlock(q.days, dayIdx)) {
                      const n = countNightsFromIndex(q.days, dayIdx);
                      if (d.destination && n > 0) {
                        title = `${longDate} : ${d.destination} for ${n} night${n>1?"s":""}`;
                      }
                    }
                    return (
                      <>
                        <button
                          className="day-pin btn-xxs icon-only"
                          aria-label="Set destination for N nights"
                          title="Set destination for N nights"
                          onClick={() => {
                            const qid = (q && q.id) || null;
                            console.log("[dest] opening modal", { quoteId: qid, startDate: d.date });
                            setDestModal({ open: true, quoteId: qid, startDate: d.date });
                          }}
                        >
                          📍
                        </button>
                        <span>{title}</span>
                      </>
                    );
                  })()}
                </div>



                {d.lines.length===0 && <div className="hint">No services yet… Add from the right panel.</div>}



                <div className="day-services">

                  {d.lines.map((l, lineIdx)=>(

                    <React.Fragment key={l.id}>

                      <div className="service" data-index={lineIdx}>

                        { (l.category==="Trip info" || l.category==="Internal info") ? (

                          <div className="hint">This note will export to Word/Excel (Trip info), or remain internal (Internal info).</div>

                        ) : (

                          <div className="service-card">

                            {/* Poignée de drag (seul élément draggable) */}

                            <span

                              className="drag-handle"

                              title="Déplacer"

                              draggable

                              onDragStart={(e) => onDragStart(e, dayIdx, lineIdx)}

                              onClick={(e) => e.preventDefault()}

                            >

                              ⋮⋮

                            </span>



                            {/* Le contenu actuel de ta carte (titre, badges, inputs…) */}

                            <div className="service-body">

                              <div className="service-head">

                                <div className="service-title">

                                  {l.title} <span className="badge">{l.category}</span>

                                </div>

                                {l.supplier_name && <div className="supplier">{l.supplier_name}</div>}

                              </div>



                              <div className="price-grid">

                                <label className="field">

                                  <span className="label">Prix d'achat €</span>

                                  <input

                                    className="et-input num"

                                    type="number" step="0.01"

                                    value={l.achat_eur ?? ''}

                                    onChange={(e) => {

                                      const eur = Number(e.target.value||0);

                                      const fx  = Number((l.fx_rate ?? fxEuroToUsd) || 0.75);

                                      const usd = eur ? Math.round(eur*fx*100)/100 : (l.achat_usd ?? 0);

                                      updateLine(dayIdx, lineIdx, { achat_eur: eur, fx_rate: fx, achat_usd: usd });

                                    }}

                                  />

                                </label>



                                <label className="field">

                                  <span className="label">€→$</span>

                                  <input

                                    className="et-input num"

                                    type="number" step="0.01"

                                    value={l.fx_rate ?? ''}

                                    onChange={(e) => {

                                      const fx  = Number(e.target.value||0);

                                      const eur = Number(l.achat_eur||0);

                                      const usd = eur ? Math.round(eur*fx*100)/100 : Number(l.achat_usd||0);

                                      updateLine(dayIdx, lineIdx, { fx_rate: fx, achat_usd: usd });

                                    }}

                                  />

                                </label>



                                <label className="field">

                                  <span className="label">Prix d'achat $</span>

                                  <input

                                    className="et-input num"

                                    type="number" step="0.01"

                                    value={l.achat_usd ?? ''}

                                    onChange={(e) => {

                                      const usd = Number(e.target.value||0);

                                      const eur = Number(l.achat_eur||0);

                                      const fx  = eur ? Math.round((usd/eur)*100)/100 : (l.fx_rate ?? fxEuroToUsd);

                                      updateLine(dayIdx, lineIdx, { achat_usd: usd, fx_rate: fx });

                                    }}

                                  />

                                </label>



                                <label className="field">

                                  <span className="label">Prix de vente $</span>

                                  <input

                                    className="et-input num"

                                    type="number" step="0.01"

                                    value={l.vente_usd ?? ''}

                                    onChange={(e) => updateLine(dayIdx, lineIdx, { vente_usd: Number(e.target.value||0) })}

                                  />

                                </label>

                              </div>

                            </div>

                          </div>

                        )}

                      </div>



                      {/* Zone de dépôt AVANT la carte suivante (pour réordonner précisément) */}

                      <div

                        className="service-dropline"

                        onDragOver={allowDrop}

                        onDrop={(e) => dropBefore(e, dayIdx, lineIdx + 1)}

                      />

                    </React.Fragment>

                  ))}

                  {/* Zone de dépôt de fin */}

                  <div

                    className="day-dropzone"

                    onDragOver={allowDrop}

                    onDrop={(e) => dropOnDayEnd(e, dayIdx)}

                  />

                </div>

              </div>

            ))}



            {/* ===== Excel-like preview (new spec) ===== */}

            {renderExcelPreview()}

          </div>

        </div>



        {/* Right rail */}

        <div className="rail right">

          <div className="catalog">

            <input className="cat-button" placeholder="Search name / company" readOnly />

            <div className="chipbar">

              <span className="chip">Hotels</span>

              <span className="chip">Activities</span>

              <span className="chip">Transport</span>

            </div>



            <h4>Popular</h4>

            <button className="cat-button">Louvre ticket — Tiqets <span className="chip">Activity</span> <span className="chip">Tiqets</span></button>

            <button className="cat-button">Seine dinner cruise <span className="chip">Activity</span> <span className="chip">Bateaux</span></button>



            <h4>Insert</h4>
            <div className="insert-grid">
              <button className="cat-button" onClick={()=>addLine(activeDayId ?? q.days[0].id, "Trip info")}>Trip info</button>
              <button className="cat-button" onClick={()=>addLine(activeDayId ?? q.days[0].id, "Internal info")}>Internal info</button>
              <button className="cat-button" onClick={()=>addLine(activeDayId ?? q.days[0].id, "Cost")}>Cost</button>
              <button className="cat-button" onClick={()=>addLine(activeDayId ?? q.days[0].id, "Flight")}>Flight</button>
              <button className="cat-button" onClick={()=>addLine(activeDayId ?? q.days[0].id, "Train")}>Train</button>
              <button className="cat-button" onClick={()=>addLine(activeDayId ?? q.days[0].id, "Ferry")}>Ferry</button>
              <button className="cat-button" onClick={()=>setCarModalOpen(true)}>Car Rental</button>
              <button className="cat-button" onClick={()=>addLine(activeDayId ?? q.days[0].id, "New Hotel")}>New Hotel</button>
              <button className="cat-button" onClick={()=>addLine(activeDayId ?? q.days[0].id, "New Service")}>New Service</button>
            </div>

          </div>

        </div>

      </div>

      {/* Destination Range Modal */}
      {destModal.open && (
        <DestinationRangeModal
          open={destModal.open}
          quoteId={destModal.quoteId ?? ((q && q.id) || null)}
          startDate={destModal.startDate}
          ensureQuoteId={ensureQuoteId}
          onClose={() => setDestModal({ open: false, quoteId: null, startDate: null })}
          onApplied={async () => {
            const qid = destModal.quoteId ?? ((q && q.id) || null);
            setDestModal({ open: false, quoteId: null, startDate: null });
            if (qid) {
              await fetchQuote(qid);
              try {
                await api.repriceQuote(qid);
              } catch (err) {
                console.error("Reprice error:", err);
              }
            }
            console.log("Destinations updated");
          }}
        />
      )}

      {/* Car Rental Modal */}
      {carModalOpen && (
        <CarRentalModal
          open={carModalOpen}
          onClose={() => setCarModalOpen(false)}
        />
      )}

    </div>

  );

}
