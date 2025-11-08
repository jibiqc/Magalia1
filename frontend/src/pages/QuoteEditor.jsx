import React, {useEffect, useMemo, useRef, useState, useCallback} from "react";

import "../styles/quote.css";
import DestinationRangeModal from "../components/DestinationRangeModal";
import CarRentalModal from "../components/CarRentalModal";
import TripInfoModal from "../components/TripInfoModal";
import InternalInfoModal from "../components/InternalInfoModal";
import CostModal from "../components/CostModal";
import FlightModal from "../components/FlightModal";
import TrainModal from "../components/TrainModal";
import FerryModal from "../components/FerryModal";
import HotelModal from "../components/HotelModal";
import NewServiceModal from "../components/NewServiceModal";
import ServiceCard from "../components/ServiceCard";
import { api } from "../lib/api";
import { fmtDateShortISO, fmtDateLongISO } from "../utils/dateFmt";
import { uid } from "../utils/localId";



// Défaut global pour la marge
const DEFAULT_MARGIN = 0.1627; // 16.27 %
const DEFAULT_FX = 0.75;

const round2 = (v) => Math.round((Number(v)||0)*100)/100;
const round4 = (v) => Math.round((Number(v)||0)*10000)/10000;

const parseLocaleFloat = (s) => {
  if (s == null) return 0;
  if (typeof s === "number") return s;
  return Number(String(s).trim().replace(/\s/g,"").replace(",", ".")) || 0;
};

const toStr = (v) => (v === undefined || v === null ? "" : String(v));

const effectiveFx = (lineFx, globalFx) => {
  const fx = parseLocaleFloat(lineFx);
  const g  = parseLocaleFloat(globalFx);
  return fx > 0 ? fx : (g > 0 ? g : DEFAULT_FX);
};

// Normaliseur pour les catégories (insensible à la casse et aux espaces)
const norm = (s) => (s || "").trim().toLowerCase();

// Source unique de vérité pour les catégories payantes
const PAID_CATS = new Set([
  "activity","hotel","transport","private transfer","private","small group",
  "tickets","flight","train","ferry","apartment","villa","private driver",
  "new hotel","new service","cost","car rental"
]);

const isPaidCategory = (cat) => PAID_CATS.has(norm(cat));

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
  // Other modals state
  const [tripInfoOpen, setTripInfoOpen] = useState(false);
  const [internalInfoOpen, setInternalInfoOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [flightOpen, setFlightOpen] = useState(false);
  const [trainOpen, setTrainOpen] = useState(false);
  const [ferryOpen, setFerryOpen] = useState(false);
  const [hotelOpen, setHotelOpen] = useState(false);
  const [newServiceOpen, setNewServiceOpen] = useState(false);
  const [editingLine, setEditingLine] = useState(null);
  const [trashOpen, setTrashOpen] = useState(false);

  // local-only services and trash
  const [localLines, setLocalLines] = useState([]);      // LocalLine[]
  const [trashLines, setTrashLines] = useState([]);    // LocalLine[]

  // Compute safe currentQuoteId
  const currentQuoteId = (q && q.id) || null;

  // Commission edit state
  const [marginStr, setMarginStr] = useState(toStr(q.margin_pct ?? 0.1627));
  useEffect(() => {
    // initialisation depuis q.margin_pct si dispo
    if (q?.margin_pct != null) setMarginStr(String(round2(q.margin_pct*100)));
  }, [q?.id]); // quand on ouvre une quote

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
            raw_json: { ...(l.raw_json || {}), fx: (l.fx_rate ?? fxEuroToUsd ?? DEFAULT_FX) },
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

      // Vérification de sécurité
      if (!next.days?.[dayIdx]?.lines?.[lineIdx]) {
        console.warn("[updateLine] Ligne introuvable", { dayIdx, lineIdx });
        return next;
      }

      Object.assign(next.days[dayIdx].lines[lineIdx], patch);

      next.dirty = true;

      return next;

    });

  };

  // recalcul au BLUR selon les règles
  const rederiveLine = (di, li, lastEdited) => {
    setQ(prev => {
      const next = structuredClone(prev);
      const line = next.days[di].lines[li];

      const eur = parseLocaleFloat(line.achat_eur);
      const usd = parseLocaleFloat(line.achat_usd);
      const fx  = effectiveFx(parseLocaleFloat(line.fx_rate), fxEuroToUsd);

      if (lastEdited === "eur") {
        if (eur != null && fx != null) line.achat_usd = round2(eur * fx);
      } else if (lastEdited === "fx") {
        if (eur != null && fx != null) line.achat_usd = round2(eur * fx);
      } else if (lastEdited === "usd") {
        if (eur != null && usd != null && eur !== 0) line.fx_rate = round6(usd / eur);
      }

      next.dirty = true;
      return next;
    });
  };

  const getLineFx = (line) => Number(line.fx_rate ?? fxEuroToUsd ?? DEFAULT_FX);






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
    return 9 * onspotCards * tripDays;
  }, [q.pax, q.days]);

  const hassleDefault = useMemo(()=> 150 * (q.pax || 0), [q.pax]);

  // Valeurs effectives avec override
  const onspotAuto = round2(onspotDefault);
  const onspotBase = Math.max(onspotAuto, 27);
  const onspotValue = useMemo(()=> {
    const manual = parseLocaleFloat(q.onspot_manual);
    return manual != null ? manual : onspotBase;
  }, [q.onspot_manual, onspotBase]);
  const hassleValue = useMemo(()=> {
    const manual = parseLocaleFloat(q.hassle_manual);
    return manual != null ? manual : round2(hassleDefault);
  }, [q.hassle_manual, hassleDefault]);



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

  const addLocalLine = (dayId, category, data) => {
    const line = { id: uid(), dayId, category, data, isLocal: true, deleted: false };
    setLocalLines(prev => [line, ...prev]);
    console.log("[addLocalLine]", { dayId, category, data });
  };

  const findDayIdByDate = (iso) => {
    const day = q.days.find(d => d.date === iso);
    return day ? day.id : (q.days[0]?.id || null);
  };

  const openEditModal = useCallback((line) => {
    setEditingLine(line);
    const category = line.category;
    switch(category) {
      case "Trip info": setTripInfoOpen(true); break;
      case "Internal info": setInternalInfoOpen(true); break;
      case "Cost": setCostOpen(true); break;
      case "Flight": setFlightOpen(true); break;
      case "Train": setTrainOpen(true); break;
      case "Ferry": setFerryOpen(true); break;
      case "Car Rental": setCarModalOpen(true); break;
      case "New Hotel": setHotelOpen(true); break;
      case "New Service": setNewServiceOpen(true); break;
    }
  }, []);

  const restoreLine = (id) => {
    setTrashLines(t => t.filter(x=>x.id!==id));
    setLocalLines(l => l.map(x => x.id===id ? {...x, deleted:false} : x));
  };

  const purgeLine = (id) => {
    setTrashLines(t => t.filter(x=>x.id!==id));
    setLocalLines(l => l.filter(x => x.id!==id));
  };



  const totalScroll = ()=> totalsRef.current?.scrollIntoView({behavior:"smooth", block:"start"});



  // Recalculate totals (trigger re-render)

  const recalculateTotals = () => {

    setQ(prev => ({...prev})); // Force re-render to recalc

  };



  // Render Excel preview table

  function renderExcelPreview() {
    console.debug('[excel] recompute', Date.now(), q?.days?.length);

    // Helpers: destination and naming
    const truncate = (s, n = 60) => {
      const t = String(s || "").trim();
      return t.length > n ? t.slice(0, n - 1) + "…" : t;
    };
    const hotelLike = new Set(["hotel","new hotel"]);
    const destOf = (day, line) => {
      // Robust fallback chain
      return (
        (day && day.destination) ||
        line?.destination ||
        line?.city ||
        line?.data?.city ||
        ""
      );
    };
    const nameOf = (line) => {
      const isHotel = hotelLike.has(norm(line?.category));
      const raw = isHotel
        ? (line?.hotel_name || line?.title || line?.service_name || "—")
        : (line?.title || line?.service_name || "—");
      return truncate(raw);
    };

    // Agrège toutes les lignes "payantes"

    const rows = [];



    // Onspot/Hassle: use manual if set, else base/defaults; parse robustly
    const onspotUsed = round2(parseLocaleFloat(q?.onspot_manual ?? onspotBase ?? 0));
    const hassleUsed = round2(parseLocaleFloat(q?.hassle_manual ?? hassleDefault ?? 0));



    // Onspot row (meta). Keep numeric columns at 0 to avoid double counting in reduce.
    rows.push({

      dest: "",

      name: "Onspot",

      eur: 0,

      fx: "",

      usd: 0,

      sell: 0,

      kind: "meta"

    });



    // Hassle row (meta). Keep numeric columns at 0 to avoid double counting.
    rows.push({

      dest: "",

      name: "Hassle",

      eur: 0,

      fx: "",

      usd: 0,

      sell: 0,

      kind: "meta"

    });



    // Lignes payantes par jour (backend)
    q.days.forEach((day) => {
      let printedDest = false;
      (day.lines || []).forEach((line) => {
        if (!isPaidCategory(line.category)) {
          console.debug("[skip non-paid]", line.category);
          return;
        }

        const eur = round2(parseLocaleFloat(line.achat_eur));
        const fx  = effectiveFx(line.fx_rate, fxEuroToUsd);
        // si achat_usd vide mais eur>0, on calcule
        const usdRaw  = line.achat_usd;
        const usdCalc = eur>0 ? round2(eur * fx) : 0;
        const usd = (usdRaw===undefined || usdRaw===null || usdRaw==="") ? usdCalc : round2(parseLocaleFloat(usdRaw));
        const sell = round2(parseLocaleFloat(line.vente_usd));

        rows.push({
          dest: printedDest ? "" : destOf(day, line),
          name: nameOf(line),
          eur, fx, usd, sell
        });
        printedDest = true;
      });
    });

    // Lignes payantes locales (si présentes) — incluses aussi dans l'aperçu
    q.days.forEach((day) => {
      const dayLocal = localLines.filter(ll => ll.dayId === day.id && !ll.deleted);
      dayLocal.forEach((line) => {
        if (!isPaidCategory(line.category)) return;
        // Extract prices from local line data.pricing or data directly
        const pricing = line.data?.pricing || {};
        const eur = round2(parseLocaleFloat(pricing.purchase_eur || line.data?.purchase_eur));
        const fx  = effectiveFx(pricing.fx_eur_usd || line.data?.fx_eur_usd, fxEuroToUsd);
        const usdRaw  = pricing.purchase_usd || line.data?.purchase_usd;
        const usdCalc = eur>0 ? round2(eur * fx) : 0;
        const usd = (usdRaw===undefined || usdRaw===null || usdRaw==="") ? usdCalc : round2(parseLocaleFloat(usdRaw));
        const sell = round2(parseLocaleFloat(pricing.sale_usd || line.data?.sale_usd));

        // Build a line-like object for nameOf helper
        const lineForName = { category: line.category, hotel_name: line.data?.hotel_name, title: line.data?.title, service_name: line.data?.service_name };
        // Build a line-like object for destOf helper (local lines don't have destination directly)
        const lineForDest = { destination: line.data?.destination, city: line.data?.city, data: line.data };
        rows.push({
          dest: destOf(day, lineForDest), // if needed we can wire active day destination later
          name: nameOf(lineForName),
          eur, fx, usd, sell
        });
      });
    });



    // Compute totals from rows to avoid drift; meta rows carry zeros
    const totalsFromRows = rows.reduce(
      (acc, r) => {
        acc.eur  += Number(r.eur  || 0);
        acc.usd  += Number(r.usd  || 0);
        acc.sell += Number(r.sell || 0);
        return acc;
      },
      { eur: 0, usd: 0, sell: 0 }
    );
    // Add meta values once
    totalsFromRows.usd  = round2(totalsFromRows.usd  + onspotUsed);
    totalsFromRows.sell = round2(totalsFromRows.sell + hassleUsed);
    const totalEur  = round2(totalsFromRows.eur);
    const totalUsd  = round2(totalsFromRows.usd);
    const totalSell = round2(totalsFromRows.sell);

    // Summary uses the same totals for consistency
    const achatsUsdSummary = totalUsd;   // Σ achats + Onspot
    const ventesUsdSummary = totalSell;  // Σ ventes + Hassle
    // Ensure Commission % shows 2 decimals in UI. Use marginStr when present, else derive from q.margin_pct.
    const pctStr = (marginStr ?? ((Number(q.margin_pct || 0) * 100).toFixed(2)));
    const commissionPct = round2(parseLocaleFloat(pctStr) / 100); // 16.27 -> 0.1627
    const commissionUsd = round2(achatsUsdSummary * commissionPct);
    const grandTotal = round2(achatsUsdSummary + commissionUsd + ventesUsdSummary);

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

                <td className="num">{r.fx !== "" ? Number(r.fx).toFixed(4) : ""}</td>



                {/* USD: vide pour Hassle, input pour Onspot */}
                <td className={r.name === "Onspot" ? "cell-right" : "num"}>
                  {r.name === "Onspot" ? (
                    <input
                      className="money-cell"
                      value={q.onspot_manual != null ? q.onspot_manual : onspotBase}
                      onChange={(e) => {
                        setQ(prev => ({ ...prev, onspot_manual: e.target.value }));
                      }}
                      onBlur={(e) => {
                        const v = parseLocaleFloat(e.target.value);
                        setQ(prev => {
                          const next = structuredClone(prev);
                          next.onspot_manual = v != null ? round2(v) : null;
                          next.dirty = true;
                          return next;
                        });
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
                        setQ(prev => ({ ...prev, hassle_manual: e.target.value }));
                      }}
                      onBlur={(e) => {
                        const v = parseLocaleFloat(e.target.value);
                        setQ(prev => {
                          const next = structuredClone(prev);
                          next.hassle_manual = v != null ? round2(v) : null;
                          next.dirty = true;
                          return next;
                        });
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
            {/* Achats USD (includes Onspot) */}
            <div className="label">Prix d'achat (USD)</div>
            <div></div>
            <div className="value">{asMoney(achatsUsdSummary)}</div>

            {/* Commission: global percent, always active */}
            <div className="label">Commission</div>
            <div className="middle" style={{display:'flex', alignItems:'center', gap:6}}>
              <input
                className="margin-inp"
                type="text"
                inputMode="decimal"
                placeholder="16.27"
                value={pctStr}
                onChange={(e)=> setMarginStr(e.target.value)}
                onBlur={(e)=>{
                  const currentValue = e.target.value || marginStr || ((Number(q.margin_pct || 0) * 100).toFixed(2));
                  const pctLocal = round2(parseLocaleFloat(currentValue)/100); // 16.27 → 0.1627
                  setMarginStr((parseLocaleFloat(currentValue)).toFixed(2));   // keep 2 decimals in UI
                  setQ(prev => ({...prev, margin_pct: pctLocal, dirty:true}));
                }}
              />
              <span className="pct-suffix">%</span>
            </div>
            <div className="value">{asMoney(commissionUsd)}</div>

            {/* Ventes USD (includes Hassle) */}
            <div className="label">Prix de vente (USD)</div>
            <div></div>
            <div className="value">{asMoney(ventesUsdSummary)}</div>

            {/* Total = Achats + Commission + Ventes */}
            <div className="total label">Total</div>
            <div></div>
            <div className="total value">{asMoney(grandTotal)}</div>
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

        <div className="fx-wrap"><span>€→$</span><input className="fx-global-inp" type="text" inputMode="decimal" placeholder="€→$" value={toStr(fxEuroToUsd)} onChange={(e)=> setFxEuroToUsd(e.target.value)} onBlur={()=> setFxEuroToUsd(round2(parseLocaleFloat(fxEuroToUsd)))} /></div>



        <button className="btn primary" onClick={saveQuote}>Save</button>

        <button className="btn secondary" onClick={() => setTrashOpen(!trashOpen)} title="Trash">
          🗑 {trashLines.length > 0 && <span>({trashLines.length})</span>}
        </button>

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
                <span>Total: <span className="total-amt">{money(calc.grandRounded,{digits:0})}</span></span>
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



                {d.lines.length===0 && localLines.filter(ll => ll.dayId === d.id && !ll.deleted).length === 0 && <div className="hint">No services yet… Add from the right panel.</div>}

                <div className="day-services">
                  {(() => {
                    const dayLocal = localLines.filter(l => l.dayId === d.id && !l.deleted);
                    const allLines = [...(d.lines||[]), ...dayLocal];
                    return allLines.map((l, idx) => {
                      const isLocal = l.isLocal || dayLocal.some(ll => ll.id === l.id);
                      const lineIdx = isLocal ? -1 : d.lines.findIndex(line => line.id === l.id);
                      // Helper: update backend or local line seamlessly
                      const updateAnyLine = (patch) => {
                        if (isLocal) {
                          // local lines: update in localLines state
                          setLocalLines(prev => prev.map(ll => {
                            if (ll.id === l.id) {
                              // Merge patch into data.pricing for local lines
                              const currentPricing = ll.data?.pricing || {};
                              return { 
                                ...ll, 
                                data: { 
                                  ...ll.data, 
                                  pricing: { ...currentPricing, ...patch }
                                }
                              };
                            }
                            return ll;
                          }));
                          setQ(prev => ({ ...prev, dirty: true })); // mark dirty so preview recomputes
                        } else {
                          updateLine(dayIdx, lineIdx, patch);
                        }
                      };
                      // For local lines, use { category, data }; for backend lines, pass the line as-is
                      const lineData = isLocal ? { category: l.category, data: l.data || {}, isLocal: true } : { category: l.category || "", ...l };
                      // Get price values: from l directly for backend, from l.data.pricing for local
                      const getPrice = (field) => {
                        if (isLocal) {
                          return l.data?.pricing?.[field] ?? l.data?.[field] ?? "";
                        }
                        return l[field] ?? "";
                      };
                      return (
                        <React.Fragment key={isLocal ? l.id : (l.id || `line-${idx}`)}>
                          <ServiceCard
                            line={lineData}
                            onChangeLocalData={isLocal ? (newData)=>{
                              setLocalLines(prev => prev.map(x => x.id===l.id ? { ...x, data:newData } : x));
                            } : undefined}
                            onEdit={() => {
                              if (isLocal) {
                                openEditModal(l);
                              } else {
                                // For backend lines, convert to local format for editing
                                const editData = {
                                  id: l.id,
                                  category: l.category,
                                  data: {
                                    title: l.title || "",
                                    body: l.raw_json?.body || "",
                                    ...(l.raw_json || {})
                                  }
                                };
                                openEditModal(editData);
                              }
                            }}
                            onDuplicate={() => {
                              if (isLocal) {
                                addLocalLine(l.dayId, l.category, JSON.parse(JSON.stringify(l.data || {})));
                              }
                            }}
                            onDelete={() => {
                              if (isLocal) {
                                setLocalLines(prev => prev.map(x => x.id===l.id ? {...x, deleted:true} : x));
                                const victim = localLines.find(x => x.id === l.id);
                                if (victim) setTrashLines(t => [victim, ...t]);
                              } else {
                                // For backend lines, we could mark for deletion or convert to local
                                // For now, just remove from display (would need backend delete later)
                              }
                            }}
                          />
                          {isPaidCategory(l.category) && (
                            <div className="price-row-one">
                              {/* Prix d'achat € */}
                              <input
                                className="price-inp"
                                type="text" inputMode="decimal" placeholder="Prix d'achat €"
                                value={toStr(isLocal ? getPrice("purchase_eur") : getPrice("achat_eur"))}
                                onChange={(e)=> updateAnyLine(isLocal ? { purchase_eur: e.target.value } : { achat_eur: e.target.value })}
                                onBlur={()=>{
                                  const eurVal = isLocal ? getPrice("purchase_eur") : getPrice("achat_eur");
                                  const fxVal = isLocal ? getPrice("fx_eur_usd") : getPrice("fx_rate");
                                  const eur = round2(parseLocaleFloat(eurVal));
                                  const fx  = effectiveFx(fxVal, fxEuroToUsd);
                                  const usd = round2(eur * fx);
                                  const usdVal = isLocal ? getPrice("purchase_usd") : getPrice("achat_usd");
                                  updateAnyLine(isLocal ? 
                                    { purchase_eur: eur, purchase_usd: eur>0 ? usd : usdVal } :
                                    { achat_eur: eur, achat_usd: eur>0 ? usd : usdVal }
                                  );
                                }}
                              />

                              {/* FX €→$ */}
                              <input
                                className="price-inp"
                                type="text" inputMode="decimal" placeholder="€→$"
                                value={
                                  // display default FX if empty/zero
                                  (() => {
                                    const fxValRaw = isLocal ? getPrice("fx_eur_usd") : getPrice("fx_rate");
                                    const fxVal = parseLocaleFloat(fxValRaw);
                                    const displayFx = (!fxVal || fxVal <= 0) 
                                      ? round4(parseLocaleFloat(fxEuroToUsd))
                                      : round4(fxVal);
                                    return toStr(displayFx);
                                  })()
                                }
                                onChange={(e)=> updateAnyLine(isLocal ? { fx_eur_usd: e.target.value } : { fx_rate: e.target.value })}
                                onBlur={()=>{
                                  // If empty or zero, commit default FX; always keep 4 decimals in state
                                  const fxValRaw = isLocal ? getPrice("fx_eur_usd") : getPrice("fx_rate");
                                  let fxVal = parseLocaleFloat(fxValRaw);
                                  if (!fxVal || fxVal <= 0) fxVal = parseLocaleFloat(fxEuroToUsd);
                                  const fx  = round4(fxVal);
                                  const eurVal = isLocal ? getPrice("purchase_eur") : getPrice("achat_eur");
                                  const eur = round2(parseLocaleFloat(eurVal));
                                  const usd = eur>0 ? round2(eur * fx) : parseLocaleFloat(isLocal ? getPrice("purchase_usd") : getPrice("achat_usd"));
                                  const usdVal = isLocal ? getPrice("purchase_usd") : getPrice("achat_usd");
                                  updateAnyLine(isLocal ?
                                    { fx_eur_usd: fx, purchase_usd: eur>0 ? usd : usdVal } :
                                    { fx_rate: fx, achat_usd: eur>0 ? usd : usdVal }
                                  );
                                }}
                              />

                              {/* Prix d'achat $ */}
                              <input
                                className="price-inp"
                                type="text" inputMode="decimal" placeholder="Prix d'achat $"
                                value={toStr(isLocal ? getPrice("purchase_usd") : getPrice("achat_usd"))}
                                onChange={(e)=> updateAnyLine(isLocal ? { purchase_usd: e.target.value } : { achat_usd: e.target.value })}
                                onBlur={()=>{
                                  const usdVal = isLocal ? getPrice("purchase_usd") : getPrice("achat_usd");
                                  const eurVal = isLocal ? getPrice("purchase_eur") : getPrice("achat_eur");
                                  const usd = round2(parseLocaleFloat(usdVal));
                                  const eur = round2(parseLocaleFloat(eurVal));
                                  // Si € est saisi, on recalcule FX = $ / €
                                  const fxVal = isLocal ? getPrice("fx_eur_usd") : getPrice("fx_rate");
                                  const fx  = eur>0 ? round4(usd / eur) : round4(parseLocaleFloat(fxVal ?? fxEuroToUsd));
                                  updateAnyLine(isLocal ?
                                    { purchase_usd: usd, fx_eur_usd: fx } :
                                    { achat_usd: usd, fx_rate: fx }
                                  );
                                }}
                              />

                              {/* Prix de vente $ (indépendant) */}
                              <input
                                className="price-inp"
                                type="text" inputMode="decimal" placeholder="Prix de vente $"
                                value={toStr(isLocal ? getPrice("sale_usd") : getPrice("vente_usd"))}
                                onChange={(e)=> updateAnyLine(isLocal ? { sale_usd: e.target.value } : { vente_usd: e.target.value })}
                                onBlur={()=> {
                                  const sellVal = isLocal ? getPrice("sale_usd") : getPrice("vente_usd");
                                  updateAnyLine(isLocal ? 
                                    { sale_usd: round2(parseLocaleFloat(sellVal)) } :
                                    { vente_usd: round2(parseLocaleFloat(sellVal)) }
                                  );
                                }}
                              />
                            </div>
                          )}
                          {isPaidCategory(l.category) && !isLocal && lineIdx >= 0 && l.supplier_name && (
                            <div className="line-supplier">{l.supplier_name}</div>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()}
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
              <button className="cat-button" onClick={()=>{setEditingLine(null); setTripInfoOpen(true);}}>Trip info</button>
              <button className="cat-button" onClick={()=>{setEditingLine(null); setInternalInfoOpen(true);}}>Internal info</button>
              <button className="cat-button" onClick={()=>{setEditingLine(null); setCostOpen(true);}}>Cost</button>
              <button className="cat-button" onClick={()=>{setEditingLine(null); setTrainOpen(true);}}>Train</button>
              <button className="cat-button" onClick={()=>{setEditingLine(null); setFlightOpen(true);}}>Flight</button>
              <button className="cat-button" onClick={()=>{setEditingLine(null); setFerryOpen(true);}}>Ferry</button>
              <button className="cat-button" onClick={()=>{setEditingLine(null); setCarModalOpen(true);}}>Car Rental</button>
              <button className="cat-button" onClick={()=>{setEditingLine(null); setHotelOpen(true);}}>New Hotel</button>
              <button className="cat-button" onClick={()=>{setEditingLine(null); setNewServiceOpen(true);}}>New Service</button>
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
          onClose={() => { setCarModalOpen(false); setEditingLine(null); }}
          onSubmit={(payload) => {
            const currentDay = q.days.find(d => d.id === activeDayId) || q.days[0];
            const dayId = currentDay?.id;
            if (dayId) {
              addLocalLine(dayId, "Car Rental", payload);
              if (payload.expected_dropoff_date) {
                const dropoffDayId = findDayIdByDate(payload.expected_dropoff_date);
                if (dropoffDayId) {
                  addLocalLine(dropoffDayId, "Trip info", { title: "Drop off the car", body: "" });
                }
              }
            }
            setCarModalOpen(false);
            setEditingLine(null);
          }}
          initialData={editingLine?.data || null}
          startDate={q.days.find(d => d.id === activeDayId)?.date || null}
        />
      )}

      {/* Trip Info Modal */}
      {tripInfoOpen && (
        <TripInfoModal
          open={tripInfoOpen}
          onClose={() => { setTripInfoOpen(false); setEditingLine(null); }}
          onSubmit={(payload) => {
            const currentDay = q.days.find(d => d.id === activeDayId) || q.days[0];
            const dayId = currentDay?.id;
            if (dayId) {
              if (editingLine) {
                setLocalLines(prev => prev.map(l => l.id === editingLine.id ? { ...l, data: payload } : l));
              } else {
                addLocalLine(dayId, "Trip info", payload);
              }
            }
            setTripInfoOpen(false);
            setEditingLine(null);
          }}
          initialData={editingLine?.data || null}
        />
      )}

      {/* Internal Info Modal */}
      {internalInfoOpen && (
        <InternalInfoModal
          open={internalInfoOpen}
          onClose={() => { setInternalInfoOpen(false); setEditingLine(null); }}
          onSubmit={(payload) => {
            const currentDay = q.days.find(d => d.id === activeDayId) || q.days[0];
            const dayId = currentDay?.id;
            if (dayId) {
              if (editingLine) {
                setLocalLines(prev => prev.map(l => l.id === editingLine.id ? { ...l, data: payload } : l));
              } else {
                addLocalLine(dayId, "Internal info", payload);
              }
            }
            setInternalInfoOpen(false);
            setEditingLine(null);
          }}
          initialData={editingLine?.data || null}
        />
      )}

      {/* Cost Modal */}
      {costOpen && (
        <CostModal
          open={costOpen}
          onClose={() => { setCostOpen(false); setEditingLine(null); }}
          onSubmit={(payload) => {
            const currentDay = q.days.find(d => d.id === activeDayId) || q.days[0];
            const dayId = currentDay?.id;
            if (dayId) {
              if (editingLine) {
                setLocalLines(prev => prev.map(l => l.id === editingLine.id ? { ...l, data: payload } : l));
              } else {
                addLocalLine(dayId, "Cost", payload);
              }
            }
            setCostOpen(false);
            setEditingLine(null);
          }}
          initialData={editingLine?.data || null}
        />
      )}

      {/* Flight Modal */}
      {flightOpen && (
        <FlightModal
          open={flightOpen}
          onClose={() => { setFlightOpen(false); setEditingLine(null); }}
          onSubmit={(payload) => {
            const currentDay = q.days.find(d => d.id === activeDayId) || q.days[0];
            const dayId = currentDay?.id;
            if (dayId) {
              if (editingLine) {
                setLocalLines(prev => prev.map(l => l.id === editingLine.id ? { ...l, data: payload } : l));
              } else {
                addLocalLine(dayId, "Flight", payload);
              }
            }
            setFlightOpen(false);
            setEditingLine(null);
          }}
          initialData={editingLine?.data || null}
        />
      )}

      {/* Train Modal */}
      {trainOpen && (
        <TrainModal
          open={trainOpen}
          onClose={() => { setTrainOpen(false); setEditingLine(null); }}
          onSubmit={(payload) => {
            const currentDay = q.days.find(d => d.id === activeDayId) || q.days[0];
            const dayId = currentDay?.id;
            if (dayId) {
              if (editingLine) {
                setLocalLines(prev => prev.map(l => l.id === editingLine.id ? { ...l, data: payload } : l));
              } else {
                addLocalLine(dayId, "Train", payload);
              }
            }
            setTrainOpen(false);
            setEditingLine(null);
          }}
          initialData={editingLine?.data || null}
        />
      )}

      {/* Ferry Modal */}
      {ferryOpen && (
        <FerryModal
          open={ferryOpen}
          onClose={() => { setFerryOpen(false); setEditingLine(null); }}
          onSubmit={(payload) => {
            const currentDay = q.days.find(d => d.id === activeDayId) || q.days[0];
            const dayId = currentDay?.id;
            if (dayId) {
              if (editingLine) {
                setLocalLines(prev => prev.map(l => l.id === editingLine.id ? { ...l, data: payload } : l));
              } else {
                addLocalLine(dayId, "Ferry", payload);
              }
            }
            setFerryOpen(false);
            setEditingLine(null);
          }}
          initialData={editingLine?.data || null}
        />
      )}

      {/* Hotel Modal */}
      {hotelOpen && (
        <HotelModal
          open={hotelOpen}
          onClose={() => { setHotelOpen(false); setEditingLine(null); }}
          onSubmit={(payload) => {
            const currentDay = q.days.find(d => d.id === activeDayId) || q.days[0];
            const dayId = currentDay?.id;
            if (dayId) {
              if (editingLine) {
                setLocalLines(prev => prev.map(l => l.id === editingLine.id ? { ...l, data: payload } : l));
              } else {
                addLocalLine(dayId, "New Hotel", payload);
              }
            }
            setHotelOpen(false);
            setEditingLine(null);
          }}
          initialData={editingLine?.data || null}
        />
      )}

      {/* New Service Modal */}
      {newServiceOpen && (
        <NewServiceModal
          open={newServiceOpen}
          onClose={() => { setNewServiceOpen(false); setEditingLine(null); }}
          onSubmit={(payload) => {
            const currentDay = q.days.find(d => d.id === activeDayId) || q.days[0];
            const dayId = currentDay?.id;
            if (dayId) {
              if (editingLine) {
                setLocalLines(prev => prev.map(l => l.id === editingLine.id ? { ...l, data: payload } : l));
              } else {
                addLocalLine(dayId, "New Service", payload);
              }
            }
            setNewServiceOpen(false);
            setEditingLine(null);
          }}
          initialData={editingLine?.data || null}
        />
      )}

      {/* Trash Drawer */}
      {trashOpen && (
        <div className="trash-drawer" onClick={(e) => { if (e.target === e.currentTarget) setTrashOpen(false); }}>
          <div className="trash-content" onClick={(e) => e.stopPropagation()}>
            <div className="trash-header">
              <h3>Trash ({trashLines.length})</h3>
              <button className="icon-btn" onClick={() => setTrashOpen(false)}>✕</button>
            </div>
            <div className="trash-body">
              {trashLines.length === 0 ? (
                <div className="hint">Trash is empty</div>
              ) : (
                trashLines.map((line) => (
                  <div key={line.id} className="trash-item">
                    <div className="trash-item-info">
                      <strong>{line.category}</strong>
                      <span>{line.data?.title || line.data?.hotel_name || line.data?.from || "Untitled"}</span>
                    </div>
                    <div className="trash-item-actions">
                      <button className="btn small" onClick={() => { restoreLine(line.id); }}>Restore</button>
                      <button className="btn small danger" onClick={() => { purgeLine(line.id); }}>Delete permanently</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>

  );

}
