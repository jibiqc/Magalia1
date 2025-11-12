import React, {useEffect, useMemo, useRef, useState, useCallback} from "react";
import { createPortal } from "react-dom";

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
import CatalogActivityModal from "../components/modals/CatalogActivityModal";
import ServiceCard from "../components/ServiceCard";
import HotelFromCatalogModal from "../components/HotelFromCatalogModal";
import TransportFromCatalogModal from "../components/TransportFromCatalogModal";
import ActivityFromCatalogModal from "../components/ActivityFromCatalogModal";
import HeaderHero from "../components/HeaderHero";
import DayHero from "../components/DayHero";
import DayImagesModal from "../components/modals/DayImagesModal";
import DayHeroModal from "../components/modals/DayHeroModal";
import { api } from "../lib/api";
import { fmtDateShortISO, fmtDateLongISO } from "../utils/dateFmt";
import { uid } from "../utils/localId";

// Debug helper (gated by window.__ET_DEBUG)
window.__ET_DEBUG = window.__ET_DEBUG ?? false;
const dbg = (...args) => { if (window.__ET_DEBUG) console.log(...args); };



// ---- Catalog grouping helpers ----
const norm = (s) => (s || "").toString().trim().toLowerCase();
const HOTEL_CATS = new Set(["hotel room","apartment","villa"]);
const isTransportSvc = (s) => norm(s?.category) === "private transfer";
// Vérifier si un service contient "DO NOT USE" dans le nom du supplier
const hasDoNotUse = (s) => {
  const supplier = (s?.supplier_name || s?.company || s?.name || "").toLowerCase();
  return supplier.includes("do not use");
};
// Amélioration de isHotelSvc : exclure explicitement les transports et activités
const isHotelSvc = (s) => {
  const cat = norm(s?.category);
  // Si c'est clairement un transport ou une activité, ce n'est pas un hôtel
  if (cat === "private transfer" || cat === "private driver" || 
      cat === "small group" || cat === "private" || cat === "tickets" ||
      cat === "train" || cat === "flight" || cat === "ferry") {
    return false;
  }
  // Vérifier les catégories d'hôtel
  if (HOTEL_CATS.has(cat)) return true;
  // Vérifier le nom et supplier pour des mots-clés d'hôtel
  const t = norm(`${s?.name||""} ${s?.supplier_name||""}`);
  // Exclure si c'est clairement un transport ou une activité
  if (/\b(transfer|chauffeur|driver|activity|tour|ticket|train|flight|ferry|golf cart|mobility)\b/.test(t)) {
    return false;
  }
  // Inclure si c'est un hôtel, appartement ou villa
  return /\b(hotel|apartment|appartment|villa)\b/.test(t);
};
const inTab = (s, tab) => {
  // Exclure les services avec "DO NOT USE" pour tous les types
  if (hasDoNotUse(s)) return false;
  // Filtrer par type
  return tab === "Hotels" ? isHotelSvc(s) : tab === "Transport" ? isTransportSvc(s) : true;
};

// Utilitaires pour le rendu ServiceCard (utilisent norm et HOTEL_CATS déjà définis)
const isHotelLine = L => HOTEL_CATS.has(norm(L?.category));
const isTransportLine = L => norm(L?.category) === "private transfer";
const repeatStar = n => (Number(n)>0 ? " " + "★".repeat(Math.min(5, Number(n))) : "");
const isFromCatalog = (l) => !!(l?.raw_json?.catalog_id || l?.raw_json?.source === "catalog" || l?.raw_json?.snapshot);
const shouldShowSupplier = (l) => !isFromCatalog(l) && !!l?.supplier_name;
const breakfastYes = v => {
  const s = norm(v);
  return s==="1" || s.includes("breakfast") || s.includes("petit déjeuner") || s.includes("petit dejeuner");
};
const cleanRoom = title => {
  const t = (title||"").replace(/^hotel\s*room\s*/i,"").trim();
  return t || title || "Room";
};

async function enrichLineFromCatalog(lineId, catalogId, setQ) {
  try {
    const full = await api.getServiceById(catalogId);
    setQ(prev => {
      const q = { ...prev, days: prev.days.map(d => {
        if (!Array.isArray(d.lines)) return d;
        let dayUpdated = false;
        let newDayImages = [...(d.decorative_images || [])];
        
        const lines = d.lines.map(L => {
          if (L.id !== lineId) return L;
          const raw = { ...(L.raw_json||{}) };
          raw.fields = full?.fields || raw.fields || {};
          raw.snapshot = raw.snapshot || full || {};
          // Store images in raw_json for future reference
          raw.images = full?.images || [];
          
          // Copy image URLs to decorative_images of the day (avoid duplicates)
          if (full?.images && Array.isArray(full.images)) {
            const imageUrls = full.images
              .map(img => img?.url)
              .filter(url => url && typeof url === 'string' && url.trim() !== '');
            
            // Merge without duplicates
            const existingUrls = new Set(newDayImages);
            imageUrls.forEach(url => {
              if (!existingUrls.has(url)) {
                newDayImages.push(url);
                dayUpdated = true;
              }
            });
          }
          
          return { ...L, raw_json: raw };
        });
        
        // Update day with new decorative_images if any were added
        if (dayUpdated) {
          return { ...d, lines, decorative_images: newDayImages };
        }
        return { ...d, lines };
      })};
      return q;
    });
  } catch {}
}

// Helper function to add service images to day's decorative_images
function addServiceImagesToDay(day, serviceData) {
  if (!serviceData?.images || !Array.isArray(serviceData.images)) {
    return day;
  }
  
  const imageUrls = serviceData.images
    .map(img => img?.url)
    .filter(url => url && typeof url === 'string' && url.trim() !== '');
  
  if (imageUrls.length === 0) {
    return day;
  }
  
  const existingUrls = new Set(day.decorative_images || []);
  const newImages = imageUrls.filter(url => !existingUrls.has(url));
  
  if (newImages.length === 0) {
    return day;
  }
  
  return {
    ...day,
    decorative_images: [...(day.decorative_images || []), ...newImages]
  };
}

// Défaut global pour la marge
const DEFAULT_MARGIN = 0.1627; // 16.27 %
const DEFAULT_FX = 0.75;

const round2 = (v) => Math.round((Number(v)||0)*100)/100;
const round4 = (v) => Math.round((Number(v)||0)*10000)/10000;

// --- Excel extras → normalized fields (fallback for frontend) ---
const CANON_MIN = {
  "Full Description": "full_description",
  "Activity Duration": "activity_duration",
  "Activity Meeting Point": "activity_meeting_point",
  "Start Time": "start_time",
  "Hotel Stars": "hotel_stars",
  "Hotel Check-in time (Company) (Company)": "hotel_check_in_time",
  "Hotel Check-out time (Company) (Company)": "hotel_check_out_time",
  "Hotel URL": "hotel_url",
  "Meal 1": "meal_1",
};

function fieldsFromExtras(extras) {
  if (!extras || typeof extras !== "object") return {};
  const out = {};
  for (const [k,v] of Object.entries(extras)) if (CANON_MIN[k]) out[CANON_MIN[k]] = v;
  return out;
}

const parseLocaleFloat = (s) => {
  if (s == null) return 0;
  if (typeof s === "number") return s;
  return Number(String(s).trim().replace(/\s/g,"").replace(",", ".")) || 0;
};

// ---- Shared total computation used by Excel & left badge ----
// Parité stricte avec l'Excel preview:
// Total = Achats USD (incl. Onspot) + Commission% sur Achats + Ventes USD (incl. Hassle)
function __isPaidCategoryLocal(cat) {
  const c = String(cat || "").toLowerCase();
  // même esprit que l'Excel preview: exclure Trip info / Internal*
  if (c.startsWith("trip info")) return false;
  if (c.startsWith("internal")) return false;
  return true;
}

// --- Date helpers (UTC-only sequencing) ---
function addDaysISO(iso, delta) {
  if (!iso) return iso;
  const d = new Date(iso + "T00:00:00Z"); // force UTC
  d.setUTCDate(d.getUTCDate() + Number(delta||0));
  return d.toISOString().slice(0,10);
}

function computeTotalsUSD(q, localLines, { onspotUsed = 0, hassleUsed = 0, marginStr }) {
  let achatsUsd = 0;
  let ventesUsd = 0;

  // Backend lines
  (q?.days || []).forEach(d => {
    (d?.lines || []).forEach(l => {
      if (l?.deleted) return;
      const cat = l?.category || "";
      const isPaid = typeof isPaidCategory === "function"
        ? isPaidCategory(cat)
        : __isPaidCategoryLocal(cat);
      if (!isPaid) return;

      // backend fields
      if (l?.achat_usd != null) achatsUsd += round2(parseLocaleFloat(l.achat_usd));
      if (l?.vente_usd != null) ventesUsd += round2(parseLocaleFloat(l.vente_usd));
    });
  });

  // Local lines
  (localLines || []).forEach(ll => {
    if (ll?.deleted) return;
    const cat = ll?.category || "";
    const isPaid = typeof isPaidCategory === "function"
      ? isPaidCategory(cat)
      : __isPaidCategoryLocal(cat);
    if (!isPaid) return;

    // local/temp pricing
    const p = ll?.data?.pricing || ll?.data;
    if (p) {
      if (p.purchase_usd != null) achatsUsd += round2(parseLocaleFloat(p.purchase_usd));
      if (p.sale_usd     != null) ventesUsd += round2(parseLocaleFloat(p.sale_usd));
    }
  });

  // Agrégateurs
  achatsUsd = round2(achatsUsd + round2(parseLocaleFloat(onspotUsed)));
  ventesUsd = round2(ventesUsd + round2(parseLocaleFloat(hassleUsed)));

  // Commission: même logique que l'Excel preview (pctStr → /100)
  const pctStr = (marginStr ?? ((Number(q?.margin_pct || 0) * 100).toFixed(2)));
  const commissionPct = round2(parseLocaleFloat(pctStr) / 100);
  const commissionUsd = round2(achatsUsd * commissionPct);

  const grandTotal = round2(achatsUsd + commissionUsd + ventesUsd);
  return { achatsUsd: round2(achatsUsd), ventesUsd: round2(ventesUsd), commissionUsd, grandTotal };
}

const toStr = (v) => (v === undefined || v === null ? "" : String(v));

const effectiveFx = (lineFx, globalFx) => {
  const fx = parseLocaleFloat(lineFx);
  const g  = parseLocaleFloat(globalFx);
  return fx > 0 ? fx : (g > 0 ? g : DEFAULT_FX);
};

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

// ---- Grid naming helpers ----
const truncate50 = (s) => {
  if (!s) return "—";
  const t = String(s);
  return t.length > 50 ? t.slice(0, 50) : t;
};
const nameForGrid = (line) => {
  const cat = norm(line.category);
  const r = line.raw_json || {};
  // prefer raw_json fields, fall back to top-level keys if present
  const from = r.from ?? line.from ?? "";
  const to   = r.to   ?? line.to   ?? "";
  switch (cat) {
    case "flight":
      return truncate50(`Flight ${from}->${to}`);
    case "train":
      return truncate50(`Train ${from}->${to}`);
    case "ferry":
      return truncate50(`Ferry ${from}->${to}`);
    case "car rental":
      return "Car Rental";
    case "new hotel":
      return truncate50(r.hotel_name ?? line.hotel_name ?? line.title ?? "Hotel");
    case "new service":
      return truncate50(r.title ?? line.title ?? "Service");
    case "cost":
      return truncate50(r.title ?? line.title ?? "Cost");
    default:
      return truncate50(line.title ?? line.service_name ?? "—");
  }
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

  start_date: null,

  end_date: null,

  days: [

    { id: (crypto.randomUUID ? crypto.randomUUID() : uid()), date: null, destination: "", lines: [] },

    { id: (crypto.randomUUID ? crypto.randomUUID() : uid()), date: null, destination: "", lines: [] },

    { id: (crypto.randomUUID ? crypto.randomUUID() : uid()), date: null, destination: "", lines: [] },

  ],

  margin_pct: DEFAULT_MARGIN,

  onspot_manual: null,

  hassle_manual: null,

});

// --- Position normalizers: single source of ordering truth is `position` ---
function normalizeQuotePositions(qIn) {
  if (!qIn) return qIn;
  try {
    const q = structuredClone(qIn);
    const days = Array.isArray(q.days) ? q.days : [];
    for (let i = 0; i < days.length; i += 1) {
      if (days[i]) {
        days[i].position = i;
        const lines = Array.isArray(days[i].lines) ? days[i].lines : [];
        for (let j = 0; j < lines.length; j += 1) {
          if (lines[j]) {
            lines[j].position = j;
          }
        }
        days[i].lines = lines;
      }
    }
    q.days = days;
    return q;
  } catch (err) {
    console.error("normalizeQuotePositions error:", err);
    // Fallback: normalize in place without cloning
    const days = Array.isArray(qIn.days) ? qIn.days : [];
    for (let i = 0; i < days.length; i += 1) {
      if (days[i]) {
        days[i].position = i;
        const lines = Array.isArray(days[i].lines) ? days[i].lines : [];
        for (let j = 0; j < lines.length; j += 1) {
          if (lines[j]) {
            lines[j].position = j;
          }
        }
        days[i].lines = lines;
      }
    }
    return qIn;
  }
}

// Hook edit interception: if you already have an edit handler, adapt there instead.
// Example helper to call from your existing "Edit" action:
export function openEditCatalogHotelModal(line, dayIdx, enable, setDraft) {
  if (!enable) return false;
  const cat = (line?.category || '').toLowerCase();
  const isCatalogHotel = cat.includes('hotel')
    && (line?.raw_json?.source === 'catalog' || !!line?.raw_json?.catalog_id);
  if (!isCatalogHotel) return false;
  const r = line.raw_json || {};
  setDraft({
    mode: 'edit',
    svcFull: { id: line.service_id, fields: r.fields || {}, supplier: { name: line.supplier_name } },
    dayIdx,
    lineId: line.id,
    defaults: {
      hotel_name: r.hotel_name || line.supplier_name || '',
      hotel_stars: r.hotel_stars || '',
      hotel_url: r.hotel_url || '',
      room_type: r.room_type || line.title || '',
      breakfast: !!r.breakfast,
      early_check_in: !!r.early_check_in,
      check_in_date: r.check_in_date || '',
      check_out_date: r.check_out_date || '',
      description: r.description || '',
      internal_note: r.internal_note || ''
    }
  });
  return true;
}

export default function QuoteEditor(){

  const [q,setQ] = useState(emptyQuote);

  // Feature flag: enable the dedicated hotel-from-catalog modal
  const enableCatalogHotelModal = useMemo(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const fromUrl = qs.get('enableCatalogHotelModal') === '1';
      // Enable by default for development (can be disabled via ?enableCatalogHotelModal=0)
      if (qs.get('enableCatalogHotelModal') === '0') return false;
      return fromUrl || true; // Default to true for now
    } catch {
      return true; // Default to true for development
    }
  }, []);
  // Draft data for the catalog hotel modal
  // { mode: 'create'|'edit', svcFull?, dayIdx, lineId?, defaults }
  const [catalogHotelDraft, setCatalogHotelDraft] = useState(null);
  
  // Draft data for catalog transport and activity modals
  const [catalogTransportDraft, setCatalogTransportDraft] = useState(null);
  const [catalogActivityDraft, setCatalogActivityDraft] = useState(null);
  const [editingDayImages, setEditingDayImages] = useState(null); // { dayId, day }
  const [editingDayHero, setEditingDayHero] = useState(null); // { dayId, dayIdx }
  
  // Debug: log when catalogHotelDraft changes
  useEffect(() => {
    console.log('[QuoteEditor] catalogHotelDraft changed:', catalogHotelDraft);
  }, [catalogHotelDraft]);

  const [activeDayId,setActiveDayId] = useState(null);

  const totalsRef = useRef(null);

  // --- add: click guard for catalog insertions
  const lastAddAtRef = useRef(0);
  const safeInsertFromCatalog = (svc) => {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now - lastAddAtRef.current < 500) return; // ignore double click / double fire
    lastAddAtRef.current = now;
    insertCatalogService(svc);
  };

  // --- Open control / feedback ---
  const [openId, setOpenId] = useState("");
  const [notice, setNotice] = useState({ msg: "", kind: "info" }); // kind: info|error|success
  const showNotice = (msg, kind="info") => { setNotice({ msg, kind }); setTimeout(()=>setNotice({ msg:"", kind:"info"}), 3000); };
  const [confirmNav, setConfirmNav] = useState({ visible:false, busy:false, action:null }); // action: {type:'new'|'open', id?:string}



  // FX global (par défaut 0.75)

  const [fxEuroToUsd, setFxEuroToUsd] = useState(0.75);



  // (moved openId above)

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
  const [catalogActivityOpen, setCatalogActivityOpen] = useState(false);
  const [editingLine, setEditingLine] = useState(null);
  const [trashOpen, setTrashOpen] = useState(false);

  // local-only services and trash
  const [localLines, setLocalLines] = useState([]);      // LocalLine[]
  const [trashLines, setTrashLines] = useState([]);    // LocalLine[]

  // ---- Services (right rail): Popular (Activity only)
  const [svcPopular, setSvcPopular] = useState([]);
  const [svcLoading, setSvcLoading] = useState(false);
  const [svcError, setSvcError] = useState(null);
  const [svcHoverId, setSvcHoverId] = useState(null);
  const [svcInfoCache, setSvcInfoCache] = useState(new Map()); // id -> full service

  // ---- Services Search (Activity only)
  const [svcQuery, setSvcQuery] = useState("");
  const [svcSLoading, setSvcSLoading] = useState(false);
  const [svcSError, setSvcSError] = useState(null);
  const [svcResults, setSvcResults] = useState([]);
  const [addBusy, setAddBusy] = useState(false);
  
  async function ensureSvcInfo(id) {
    if (!id || svcInfoCache.has(id)) return svcInfoCache.get(id);
    try {
      const full = await api.getServiceById(id);
      setSvcInfoCache(prev => new Map(prev).set(id, full));
      return full;
    } catch { return null; }
  }

  // ---- Service tabs (Activities | Hotels | Transport)
  const [svcTab, setSvcTab] = useState("Activities"); // "Activities" | "Hotels" | "Transport"
  
  // --- Helpers: normalize transport title & stars
  function normTransportTitle(name='') {
    return name
      .replace(/^Meet\s*&\s*gre(et|e) ?private transfer from\s*/i, '')
      .replace(/^Private transfer from\s*/i, '')
      .trim();
  }
  function starsFrom(v) {
    if (!v) return '';
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (!isFinite(n) || n <= 0) return '';
    return '★'.repeat(Math.max(1, Math.min(5, Math.round(n))));
  }
  function starsAbbrFrom(v) {
    if (!v) return '';
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (!isFinite(n) || n <= 0) return '';
    return `${Math.max(1, Math.min(5, Math.round(n)))}*`;
  }
  
  // Right rail item component
  function RightItem({ s }) {
    const tab = svcTab; // "Activities" | "Hotels" | "Transport"
    const [hoverPos, setHoverPos] = useState({x:0,y:0});
    const info = svcInfoCache.get(s.id);
    const fields = info?.fields || info?.extras || {};
    
    // Charger les infos en arrière-plan pour les hôtels si pas encore chargées (pour afficher les étoiles immédiatement)
    useEffect(() => {
      if (tab === 'Hotels' && !info) {
        ensureSvcInfo(s.id);
      }
    }, [tab, s.id, info]);
    
    const onEnter = async (e) => {
      setSvcHoverId(s.id);
      ensureSvcInfo(s.id);
      setHoverPos({ x: e.clientX, y: e.clientY });
    };
    const onMove = (e) => setHoverPos({ x: e.clientX, y: e.clientY });
    const onLeave = () => setSvcHoverId(null);

    let title = '', sub = null;
    
    if (tab === 'Hotels') {
      const supplier = s.supplier_name || s.company || s.name || '';
      // Utiliser s.hotel_stars en premier si disponible, sinon fields (qui seront chargés en arrière-plan)
      const starsAbbr = starsAbbrFrom(
        s.hotel_stars || fields.hotel_stars || fields['Hotel Stars']
      );
      // Nom - 3* (collé, aligné à gauche)
      title = (
        <div className="svc-title">
          {supplier}{starsAbbr ? <span className="svc-stars"> - {starsAbbr}</span> : null}
        </div>
      );
      sub = null;   // pas de deuxième ligne pour l'hôtel
    } else if (tab === 'Transport') {
      title = normTransportTitle(s.name || '');
      sub = s.supplier_name || s.company || null;
    } else {
      title = s.name || '';
      sub = s.supplier_name || s.company || null;
    }

    const hoverText = (fields.full_description || fields['Full Description'] || info?.description || '').trim();

    return (
      <button
        type="button"
        className="svc-item"
        onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); safeInsertFromCatalog(s); }}
        onMouseEnter={onEnter}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {typeof title === 'string' ? <div className="svc-title">{title}</div> : title}
        {sub ? <div className="svc-sub">{sub}</div> : null}
        {svcHoverId === s.id && hoverText && createPortal(
          <div className="svc-hover"
               style={{ left: hoverPos.x - 16, top: hoverPos.y + 16, transform: 'translateX(-100%)' }}>
            <div style={{fontWeight:600, marginBottom:6}}>
              {(typeof title==='string') ? title : (s.supplier_name || s.company || s.name)}
            </div>
            <div>{hoverText}</div>
          </div>,
          document.body
        )}
      </button>
    );
  }
  
  const CATEGORY_GROUPS = {
    Activities: ["small group","private","private chauffeur","tickets"],
    Hotels: ["hotel room","hotel","apartment","appartment","villa"],
    Transport: ["private transfer"]
  };
  const inGroup = (cat, group) => {
    if (!cat) return false;
    const c = String(cat).toLowerCase();
    return CATEGORY_GROUPS[group].some(k => c.includes(k));
  };

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
  const [hoverSlot, setHoverSlot] = useState({ day: -1, index: -1 });

  const allowDrop = (e) => { 
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move'; 
  };

  const readDnd = (e) => {
    const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  };

  // Helper: pick up to 2 image URLs from a day's activities
  const pickImagesForDay = useCallback((dayObj) => {
    if (!dayObj) return [];
    const lines = Array.isArray(dayObj.lines) ? dayObj.lines : [];
    const urls = [];
    for (const l of lines) {
      if ((l?.category || "").toLowerCase() !== "activity") continue;
      const rx = l?.raw_json || {};
      // First check images array (from catalog services)
      if (rx?.images && Array.isArray(rx.images)) {
        for (const img of rx.images) {
          if (img?.url && typeof img.url === "string" && img.url.trim()) {
            urls.push(img.url.trim());
            if (urls.length >= 2) break;
          }
        }
      }
      // Fallback to normalized extras fields
      if (urls.length < 2) {
        const fromExtras = rx?.extras?.image_url || rx?.fields?.image_url || rx?.image_url;
        if (fromExtras && typeof fromExtras === "string" && fromExtras.trim()) {
          urls.push(fromExtras.trim());
        }
      }
      // Stop when we have enough; UI will cap to 2 anyway
      if (urls.length >= 2) break;
    }
    // Return unique, at most 2
    return Array.from(new Set(urls)).slice(0, 2);
  }, []);

  // Helper: recompute decorative_images for a given day index in a draft quote
  const recomputeDayDecorations = useCallback((draftQ, dayIdx) => {
    if (!draftQ?.days?.[dayIdx]) return;
    // Day 1 excluded
    if (dayIdx === 0) { draftQ.days[dayIdx].decorative_images = []; return; }
    const picked = pickImagesForDay(draftQ.days[dayIdx]);
    // If none, clear. If one, keep single slot; UI will render second slot empty on edit
    draftQ.days[dayIdx].decorative_images = picked;
  }, [pickImagesForDay]);









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

      // normalize positions after mutation
      const norm = normalizeQuotePositions({ ...next, dirty: true });
      // Recompute decorations for source and destination days
      try {
        if (typeof fromDay === "number") recomputeDayDecorations(norm, fromDay);
        if (typeof toDay === "number") recomputeDayDecorations(norm, toDay);
      } catch {}
      return norm;

    });

    setDragging(null);

  };




  const dropBefore = (e, toDay, toDispIndex) => {
    e.preventDefault();
    e.stopPropagation(); // Empêcher la propagation pour éviter l'ouverture accidentelle du modal
    const meta = readDnd(e);
    if (!meta) return;

    setQ(prev => {
      const next = structuredClone(prev);
      const srcDay = next.days[meta.fromDay];
      const dstDay = next.days[toDay];

      const dstBack = [...(dstDay.lines || [])];
      const srcBack = [...(srcDay.lines || [])];

      if (!meta.isLocal) {
        // backend → backend
        const fromIdx = meta.fromBackendIndex;
        if (fromIdx < 0) return prev;

        // Vérifier que la ligne n'existe pas déjà dans le jour destination
        const lineId = srcBack[fromIdx]?.id;
        if (lineId && dstBack.some(l => l.id === lineId)) {
          // La ligne existe déjà dans le jour destination, ne pas dupliquer
          console.warn('[dnd] Line already exists in destination day, skipping duplicate');
          return prev;
        }

        const [moved] = srcBack.splice(fromIdx, 1);

        // compute backend insert index from visual index
        let insertBackIdx = Math.min(Math.max(0, toDispIndex), dstBack.length);
        // same-day downward adjustment
        if (meta.fromDay === toDay && fromIdx < insertBackIdx) insertBackIdx -= 1;

        dstBack.splice(insertBackIdx, 0, moved);

      next.days[meta.fromDay].lines = srcBack;
      next.days[toDay].lines = dstBack;
      // Normalize positions first
      const norm = normalizeQuotePositions(next);
      // Recompute decorations for source and destination days
      try {
        if (typeof meta.fromDay === "number") recomputeDayDecorations(norm, meta.fromDay);
        if (typeof toDay === "number") recomputeDayDecorations(norm, toDay);
      } catch {}
      norm.dirty = true;
      return norm;
      }

      // local → update via localLines using absolute anchor
      const dstBackLen = dstBack.length;
      const insertLocalIdx = Math.max(0, toDispIndex - dstBackLen);

      // defer to localLines so we keep one source of truth
      setTimeout(() => {
        setLocalLines(prevLL => {
          const all = [...prevLL];
          const old = all.findIndex(x => x.id === meta.lineId);
          if (old < 0) return prevLL;
          const [moved] = all.splice(old, 1);
          moved.dayId = dstDay.id;

          const dstLocals = all.filter(x => x.dayId === dstDay.id && !x.deleted);
          const anchorId = dstLocals[insertLocalIdx]?.id;
          if (anchorId) {
            const anchorIdx = all.findIndex(x => x.id === anchorId);
            all.splice(anchorIdx, 0, moved);
          } else {
            all.push(moved);
          }
          console.log('[dnd] drop local', {insertLocalIdx, toDispIndex, dstBackLen});
          return all;
        });
      }, 0);

      // Normalize positions first
      const norm = normalizeQuotePositions(next);
      // Recompute decorations for source and destination days
      try {
        if (typeof meta.fromDay === "number") recomputeDayDecorations(norm, meta.fromDay);
        if (typeof toDay === "number") recomputeDayDecorations(norm, toDay);
      } catch {}
      norm.dirty = true;
      return norm;
    });

    setHoverSlot({ day:-1, index:-1 });
  };



  // Helpers pour les dates

  const startDateStr = q.start_date || "";

  const endDateStr = q.end_date || "";

  const onStartDateChange = (e) => setQ(p=>({...p,start_date:e.target.value}));

  const onEndDateChange = (e) => setQ(p=>({...p,end_date:e.target.value}));



  // Handlers

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

  // Helper: convert localLine to normal line format for saving
  const convertLocalLineToNormal = (localLine) => {
    const { category, data } = localLine;
    const d = data || {};
    
    // PRESERVE ALL fields from data in raw_json
    // Start with a copy of all data, then ensure description field exists
    const rawJson = { ...d };
    
    // Generate title based on category (matching ServiceCard logic)
    let title = "";
    
    switch (category) {
      case "Flight": {
        let suffix = "";
        if (d.seat_res_opt === "with" || d.seat_res === true || d.with_seats === true) {
          suffix = " with seat reservations";
        }
        title = `${d.airline || "Airline"} flight from ${d.from || "?"} to ${d.to || "?"}${suffix}`;
        // Ensure description field is set (for export compatibility)
        if (rawJson.description === null || rawJson.description === undefined) {
          rawJson.description = d.note || d.description || null;
        }
        break;
      }
      case "Train": {
        const classType = d.class_type || "First Class";
        let suffix = "";
        if (d.seat_res_choice === "with") suffix = " with seat reservations";
        else if (d.seat_res_choice === "without") suffix = " without seat reservations (open seating)";
        else if (d.seat_res === true) suffix = " with seat reservations";
        else if (d.seat_res === false) suffix = " without seat reservations (open seating)";
        title = `${classType} Train from ${d.from || "?"} to ${d.to || "?"}${suffix}`;
        // Ensure description field is set (for export compatibility)
        if (rawJson.description === null || rawJson.description === undefined) {
          rawJson.description = d.note || d.description || null;
        }
        break;
      }
      case "Ferry": {
        const cls = d.class_type ? `${d.class_type} ` : "";
        let suffix = "";
        if (d.seat_res_choice === "with") suffix = " with seat reservations";
        else if (d.seat_res_choice === "without") suffix = " without seat reservations (open seating)";
        else if (d.seat_res === true) suffix = " with seat reservations";
        else if (d.seat_res === false) suffix = " without seat reservations (open seating)";
        title = `${cls}Ferry from ${d.from || "?"} to ${d.to || "?"}${suffix}`;
        // Ensure description field is set (for export compatibility)
        if (rawJson.description === null || rawJson.description === undefined) {
          rawJson.description = d.note || d.description || null;
        }
        break;
      }
      case "Car Rental": {
        const loc = d.pickup_loc || "?";
        const vehicle = d.vehicle_type || "";
        const tx = (d.transmission && d.transmission !== "Do not precise") ? `${d.transmission.toLowerCase()}, ` : "";
        const mileage = d.mileage || "";
        const ins = d.insurance || "";
        title = `Pick up car in ${loc}, ${vehicle} ${tx}${mileage} ${ins}`.replace(/\s+/g, " ").trim();
        // Ensure description field is set (for export compatibility)
        if (rawJson.description === null || rawJson.description === undefined) {
          rawJson.description = d.notes || d.description || null;
        }
        break;
      }
      case "Trip info": {
        title = d.title || "Trip info";
        // Ensure description field is set (for export compatibility)
        if (rawJson.description === null || rawJson.description === undefined) {
          rawJson.description = d.body || null;
        }
        break;
      }
      default: {
        title = d.title || category || "Service";
        // Ensure description field is set
        if (rawJson.description === null || rawJson.description === undefined) {
          rawJson.description = d.body || d.description || d.note || null;
        }
      }
    }
    
    return {
      service_id: null,
      category: category,
      title: title,
      supplier_name: null,
      visibility: "client",
      achat_eur: null,
      achat_usd: null,
      vente_usd: null,
      fx_rate: null,
      currency: null,
      base_net_amount: null,
      raw_json: rawJson, // Preserve ALL fields from data, including null values
    };
  };

  // Returns boolean: true on success, false on failure
  const saveQuote = async () => {
    if (!q) {
      console.warn("Save: no quote");
      showNotice("Nothing to save", "info");
      return false;
    }
    try {
      console.info("[saveQuote] start", { hasId: !!q.id, localLinesCount: localLines.filter(ll => !ll.deleted).length });
      // ensure positions reflect current visual order before serializing
      const qNorm = normalizeQuotePositions(q);
      if (!qNorm || !qNorm.days) {
        console.error("Save: normalized quote is invalid", qNorm);
        showNotice("Save failed", "error");
        return false;
      }
      
      // Merge localLines into days before saving
      const daysWithLocalLines = qNorm.days.map((d, idx) => {
        // Get localLines for this day that are not deleted
        const dayLocalLines = localLines.filter(ll => ll.dayId === d.id && !ll.deleted);
        
        // Convert localLines to normal lines
        const convertedLocalLines = dayLocalLines.map(convertLocalLineToNormal);
        
        // DEBUG: Log converted lines to verify all fields are preserved
        if (convertedLocalLines.length > 0) {
          console.log("[saveQuote] Converted localLines:", convertedLocalLines.map(ll => ({
            category: ll.category,
            title: ll.title,
            raw_json_keys: Object.keys(ll.raw_json || {}),
            raw_json: ll.raw_json
          })));
          console.log("[saveQuote] Day", idx, "existing lines count:", (d.lines || []).length);
          console.log("[saveQuote] Day", idx, "converted localLines count:", convertedLocalLines.length);
        }
        
        // Merge with existing lines (existing lines first, then converted localLines)
        const allLines = [...(d.lines || []), ...convertedLocalLines];
        
        // DEBUG: Verify merge
        if (convertedLocalLines.length > 0) {
          console.log("[saveQuote] Day", idx, "total lines after merge:", allLines.length);
          console.log("[saveQuote] Day", idx, "all lines categories:", allLines.map(l => l.category));
        }
        
        return {
          position: idx,
          date: d.date,
          destination: d.destination,
          decorative_images: d.decorative_images || [],
          lines: allLines.map((l, liIdx) => {
            // For converted localLines, preserve raw_json as-is (don't add fx if it's already there)
            const rawJson = l.raw_json || {};
            const finalRawJson = convertedLocalLines.some(cl => cl === l)
              ? rawJson  // For converted lines, use raw_json as-is
              : { ...rawJson, fx: (l.fx_rate ?? fxEuroToUsd ?? DEFAULT_FX) };  // For existing lines, add fx
            
            return {
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
              raw_json: finalRawJson,
            };
          }),
        };
      });
      
      // DEBUG: Log payload before sending - show full raw_json for Train/Flight/Ferry/Car Rental/Trip info
      const payloadLines = daysWithLocalLines.flatMap(d => d.lines.map(l => ({
        category: l.category,
        title: l.title,
        raw_json: l.raw_json
      })));
      console.log("[saveQuote] Payload lines with raw_json:", JSON.stringify(payloadLines, null, 2));
      
      // DEBUG: Show full raw_json for specific categories
      const specialLines = payloadLines.filter(l => 
        ["Flight", "Train", "Ferry", "Car Rental", "Trip info"].includes(l.category)
      );
      if (specialLines.length > 0) {
        console.log("[saveQuote] Special lines (Flight/Train/Ferry/Car Rental/Trip info) FULL raw_json:", 
          JSON.stringify(specialLines, null, 2)
        );
      }
      
      const payload = {
        title: qNorm.title,
        display_title: qNorm.display_title,
        hero_photo_1: qNorm.hero_photo_1,
        hero_photo_2: qNorm.hero_photo_2,
        pax: qNorm.pax,
        start_date: qNorm.start_date,
        end_date: qNorm.end_date,
        margin_pct: qNorm.margin_pct,
        onspot_manual: qNorm.onspot_manual,
        hassle_manual: qNorm.hassle_manual,
        days: daysWithLocalLines,
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
          // Clear localLines after successful save (they're now in the database)
          setLocalLines([]);
          setOpenId(String(created.id));
          try {
            const u = new URL(window.location.href);
            u.searchParams.set("quoteId", String(created.id));
            window.history.replaceState(null, "", u.toString());
          } catch {}
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
      
      // DEBUG: Log what the backend returned - show FULL raw_json for Train/Flight/Ferry/Car Rental/Trip info
      const returnedLines = updatedNorm.days?.flatMap(d => d.lines?.map(l => ({
        category: l.category,
        title: l.title,
        raw_json_keys: l.raw_json ? Object.keys(l.raw_json) : [],
        raw_json: l.raw_json
      })) || []) || [];
      console.log("[saveQuote] Backend returned quote:", JSON.stringify(returnedLines, null, 2));
      
      // DEBUG: Show FULL raw_json for specific categories
      const specialReturned = returnedLines.filter(l => 
        ["Flight", "Train", "Ferry", "Car Rental", "Trip info"].includes(l.category)
      );
      if (specialReturned.length > 0) {
        console.log("[saveQuote] Backend returned SPECIAL lines FULL raw_json:", 
          JSON.stringify(specialReturned, null, 2)
        );
      }
      
      setQ({ ...updatedNorm, dirty: false });
      // Clear localLines after successful save (they're now in the database)
      setLocalLines([]);
      try {
        const u = new URL(window.location.href);
        u.searchParams.set("quoteId", String(quoteId));
        window.history.replaceState(null, "", u.toString());
      } catch {}
      showNotice("Saved", "success");
      console.info("[saveQuote] updated ok", { id: quoteId });
      return true;
    } catch (err) {
      console.error("Save error:", err);
      const msg = String(err?.name||err||"");
      showNotice(msg.includes("Abort") ? "Network timeout" : "Save failed", "error");
      return false;
    }
  };

  const fetchQuote = async (quoteId) => {
    if (!quoteId) return;
    try {
      const quoteRaw = await api.getQuote(quoteId);
      const quote = normalizeQuotePositions(quoteRaw); // trust backend order, ensure positions are consistent client-side
      // Assurer que margin_pct a une valeur par défaut
      if (quote.margin_pct == null) quote.margin_pct = DEFAULT_MARGIN;
      setQ(quote);
      setOpenId(String(quoteId));
      // keep URL in sync
      try {
        const u = new URL(window.location.href);
        if (u.searchParams.get("quoteId") !== String(quoteId)) {
          u.searchParams.set("quoteId", String(quoteId));
          window.history.replaceState(null, "", u.toString());
        }
      } catch {}
      // Set activeDayId to first day if available
      if (quote.days && quote.days.length > 0) {
        setActiveDayId(quote.days[0].id);
      }
      showNotice(`Opened #${quoteId}`, "success");
    } catch (err) {
      console.error("Fetch error:", err);
      showNotice("Open failed (check ID)", "error");
    }
  };

  // Update document title with ID and title
  useEffect(()=>{
    const base = "Magal'IA";
    if (q?.id) {
      document.title = `${base} — #${q.id}${q?.title ? " "+q.title : ""}`;
    } else {
      document.title = base;
    }
  }, [q?.id, q?.title]);

  // Auto-open if ?quoteId= is present in URL
  useEffect(() => {
    try {
      const qp = new URLSearchParams(window.location.search);
      const qid = qp.get("quoteId");
      if (qid) fetchQuote(qid);
    } catch {}
  }, []);

  // --- Leave guard on tab close/reload when dirty ---
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!q?.dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [q?.dirty]);

  // Expose quote state for testing (can be removed after verification)
  useEffect(() => {
    window.__lastQuote = q;
  }, [q]);

  // Navigation requests with dirty-check
  const requestNew = () => {
    if (q?.dirty) {
      setConfirmNav({ visible:true, busy:false, action:{ type:"new" } });
    } else {
      handleNew();
    }
  };
  const requestOpen = (id) => {
    const qid = String(id || "").trim();
    if (!qid) return;
    if (q?.dirty) {
      setConfirmNav({ visible:true, busy:false, action:{ type:"open", id: qid } });
    } else {
      fetchQuote(qid);
    }
  };
  const cancelProceed = () => {
    console.info("[nav] cancel");
    console.log("[RIBBON BEFORE CLICK]", { confirmNav });
    setConfirmNav({ visible:false, busy:false, action:null });
    console.log("[RIBBON AFTER SET]", { confirmNav: { visible:false, busy:false, action:null } });
  };
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
  const inflightRef = useRef(false);
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

  // Close ribbon with Escape
  useEffect(() => {
    if (!confirmNav.visible) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelProceed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmNav.visible, cancelProceed]);

  // --- Insert day helpers ---
  const findActiveIndex = useCallback(() => {
    const idx = (q?.days || []).findIndex(d => d.id === activeDayId);
    return idx >= 0 ? idx : -1;
  }, [q, activeDayId]);

  // Active destination for services filtering
  const activeDest = useMemo(() => {
    const i = findActiveIndex();
    return i >= 0 ? (q?.days?.[i]?.destination || "") : "";
  }, [q, findActiveIndex]);

  // Ensure we always have an active day when days exist
  useEffect(() => {
    if (!activeDayId && (q?.days?.length || 0) > 0) {
      setActiveDayId(q.days[0].id);
    }
  }, [q?.days, activeDayId]);

  // Debounced search whenever query or destination changes
  useEffect(() => {
    const qstr = (svcQuery || "").trim();
    if (!qstr) { setSvcResults([]); setSvcSError(null); return; }
    let abort = { v:false };
    setSvcSLoading(true);
    setSvcSError(null);
    const t = setTimeout(async () => {
      try{
        const res = await api.searchServices({
          q: qstr,
          dest: (activeDest || "").trim(),
          limit: 50
        });
        if (!abort.v) {
          const filtered = (Array.isArray(res) ? res : []).filter(r => inTab(r, svcTab));
          setSvcResults(filtered);
        }
      }catch{
        if (!abort.v) setSvcResults([]);
      }finally{
        if (!abort.v) setSvcSLoading(false);
      }
    }, 300);
    return () => { abort.v = true; clearTimeout(t); };
  }, [svcQuery, activeDest, svcTab]);

  function lineFromCatalog(svc) {
    const supplier_name =
      svc.supplier_name ?? svc.supplier?.name ?? svc.company ?? null;

    const snap = { ...(svc || {}) };
    snap.fields = svc?.fields || fieldsFromExtras(svc?.extras || {});

    return {
      id: (typeof crypto!=="undefined" && crypto.randomUUID) ? crypto.randomUUID() : uid(),
      service_id: svc.id,
      category: "Activity",              // keep your current logic for grouping
      title: svc.name ?? "Untitled",
      supplier_name,
      visibility: "client",
      // leave price fields empty now (no pricing in catalog yet)
      achat_eur: null,
      achat_usd: null,
      vente_usd: null,
      fx_rate: null,
      currency: null,
      base_net_amount: null,
      raw_json: {
        source: "catalog",
        catalog_id: svc.id,
        start_destination: svc.start_destination ?? null,
        supplier_id: svc.supplier_id ?? null,
        supplier_ref: supplier_name,
        snapshot: snap,                       // full record with fields for future use
        hydrated: false
      }
    };
  }

  function insertCatalogService(svc) {
    const idx = findActiveIndex();
    if (idx < 0) { showNotice("Select a day first", "info"); return; }
    const d = q.days[idx];
    const categoryLower = (svc?.category || '').toLowerCase();
    const nameLower = (svc?.name || '').toLowerCase();
    
    // VÉRIFIER D'ABORD SI C'EST UN TRANSPORT (avant la vérification hôtel)
    // Cela évite que des services de transport avec "hotel" dans le nom ouvrent le modal hôtel
    const looksTransport = isTransportSvc(svc) || (svcTab === 'Transport' && categoryLower.includes('transfer'));
    
    if (looksTransport) {
      // Fetch full service and open transport modal
      (async () => {
        try {
          const full = await api.getServiceById(svc.id);
          const fields = full?.fields || {};
          const draft = {
            mode: 'create',
            svcFull: full,
            dayIdx: idx,
            defaults: {
              description: (fields?.full_description || full?.full_description || '') || '',
              start_time: (fields?.start_time || '') || '',
              internal_note: ''
            }
          };
          setCatalogTransportDraft(draft);
        } catch (e) {
          console.error(e);
          showNotice("Unable to open transport modal. Falling back to direct insert.", "warn");
          directInsertCatalogLine(svc, d);
        }
      })();
      return;
    }
    
    // PUIS vérifier si c'est un hôtel (seulement si ce n'est PAS un transport)
    // If flag on and the item looks like a Hotel, open the dedicated modal instead of inserting directly.
    // Be robust: rely on current tab, category, or name heuristic.
    const looksHotel =
      enableCatalogHotelModal && (
        (svcTab === 'Hotels') ||
        categoryLower.includes('hotel') ||
        categoryLower.includes('apartment') ||
        categoryLower.includes('villa') ||
        nameLower.includes('hotel') ||
        nameLower.includes('apartment') ||
        nameLower.includes('villa') ||
        (svc?.fields?.hotel_stars) ||
        (svc?.hotel_stars)
      );
    console.log('[insertCatalogService]', { 
      enableCatalogHotelModal, 
      svcTab, 
      svcCategory: svc?.category, 
      svcName: svc?.name,
      svcFields: svc?.fields,
      svcHotelStars: svc?.hotel_stars,
      looksHotel,
      looksTransport
    });
    if (looksHotel) {
      // Fetch full service to hydrate fields before opening the modal
      (async () => {
        try {
          console.log('[insertCatalogService] Fetching full service for hotel modal...', svc.id);
          const full = await api.getServiceById(svc.id);
          console.log('[insertCatalogService] Full service fetched:', full);
          // Compute defaults
          const fields = full?.fields || {};
          const dayDate = d?.date ? new Date(d.date) : new Date();
          // Find last day in same destination, else last day of itinerary
          const dest = d?.destination || null;
          const sameDestDays = (q?.days || []).filter(x => (x?.destination || null) === dest && x?.date);
          const lastDay = sameDestDays.length > 0 ? sameDestDays[sameDestDays.length - 1] : (q?.days || [])[q.days.length - 1];
          const coDate = lastDay?.date ? new Date(lastDay.date) : new Date(dayDate);
          // checkout = day after lastDay
          const checkInISO = dayDate.toISOString().slice(0,10);
          const checkOutBase = new Date(coDate); checkOutBase.setDate(checkOutBase.getDate() + 1);
          const checkOutISO = checkOutBase.toISOString().slice(0,10);
          const meal1 = String(fields?.meal_1 || '').toLowerCase();
          const breakfastDefault = meal1.includes('breakfast');
          const draft = {
            mode: 'create',
            svcFull: full,
            dayIdx: idx,
            defaults: {
              hotel_name: (full?.company || full?.supplier?.name || full?.name || '') || '',
              hotel_stars: (fields?.hotel_stars ?? full?.hotel_stars ?? '') || '',   // avoid null → ''
              hotel_url: (fields?.hotel_url || '') || '',
              room_type: '', // mandatory, left empty by design
              breakfast: !!breakfastDefault,
              early_check_in: false,
              check_in_date: checkInISO,
              check_out_date: checkOutISO,
              description: (fields?.full_description || full?.full_description || '') || '',
              internal_note: ''
            }
          };
          console.log('[insertCatalogService] Setting catalogHotelDraft:', draft);
          setCatalogHotelDraft(draft);
        } catch (e) {
          console.error(e);
          showNotice("Unable to open hotel modal. Falling back to direct insert.", "warn");
          // fallback to previous behavior
          directInsertCatalogLine(svc, d);
        }
      })();
      return;
    }
    
    // Check if it's an activity service (not hotel, not transport)
    const looksActivity = !looksHotel && !looksTransport && (svcTab === 'Activity' || categoryLower.includes('activity') || categoryLower.includes('small group') || categoryLower.includes('private') || categoryLower.includes('tickets'));
    
    if (looksActivity) {
      // Fetch full service and open activity modal
      (async () => {
        try {
          const full = await api.getServiceById(svc.id);
          const fields = full?.fields || {};
          const draft = {
            mode: 'create',
            svcFull: full,
            dayIdx: idx,
            defaults: {
              description: (fields?.full_description || full?.full_description || '') || '',
              start_time: (fields?.start_time || '') || '',
              end_time: (fields?.end_time || '') || '',
              duration: (fields?.duration || '') || '',
              internal_note: ''
            }
          };
          setCatalogActivityDraft(draft);
        } catch (e) {
          console.error(e);
          showNotice("Unable to open activity modal. Falling back to direct insert.", "warn");
          directInsertCatalogLine(svc, d);
        }
      })();
      return;
    }
    
    // do not insert the same catalog service twice on the same day
    const exists = Array.isArray(d?.lines) && d.lines.some(
      (l) => l?.raw_json?.catalog_id === svc.id
    );
    if (exists) return;
    // Default direct insert behavior (non-hotel or flag off)
    directInsertCatalogLine(svc, d);
  }

  // Extracted previous direct insert logic to allow fallback
  function directInsertCatalogLine(svc, dayObj) {
    const line = lineFromCatalog(svc);
    setQ(prev => {
      const qn = { ...prev };
      const idx2 = (qn?.days || []).findIndex(dd => dd.id === dayObj.id);
      if (idx2 < 0) { showNotice("Select a day first", "info"); return prev; }
      const day = { ...qn.days[idx2] };
      day.lines = Array.isArray(day.lines) ? [...day.lines, line] : [line];
      const normalized = normalizeQuotePositions({ ...qn, days: qn.days.map((d3, i3) => i3 === idx2 ? day : d3) });
      normalized.dirty = true;
      return normalized;
    });
    enrichLineFromCatalog(line.id, svc.id, setQ);
  }

  // Load "Popular" for Activity when destination changes
  useEffect(() => {
    if (!activeDest) return;
    let cancelled = false;
    (async () => {
      setSvcLoading(true); setSvcError(null);
      try {
        // Passer la catégorie appropriée selon svcTab
        // Le backend accepte "Activity" comme groupe, ou des catégories individuelles comme "Hotel", "Private Transfer"
        const category = svcTab === "Hotels" ? "Hotel" : 
                        svcTab === "Transport" ? "Private Transfer" : 
                        "Activity";
        const base = await api.getPopularServices({ dest: activeDest, category, limit: 50 });
        let out = (base || []).filter(r => inTab(r, svcTab));

        // Helper pour extraire le supplier (utilisé pour la déduplication des hôtels)
        const getSupplierKey = (x) => {
          if (svcTab === "Hotels") {
            // Pour les hôtels, dédupliquer par supplier (car plusieurs types de chambres peuvent exister)
            return (x.supplier_name || x.company || x.name || "").trim().toLowerCase();
          }
          // Pour les autres types, dédupliquer par id
          return x.id;
        };

        // DÉDUPLIQUER les résultats initiaux
        // Pour les hôtels: par supplier (plusieurs chambres = même hôtel)
        // Pour les autres: par id
        const seen = new Set();
        out = out.filter(x => {
          const key = getSupplierKey(x);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Fallback si peu d'items: seed via search
        if (out.length < 6) {
          const seeds = svcTab === "Hotels" ? ["hotel","apartment","villa"] :
                        svcTab === "Transport" ? ["transfer","chauffeur"] : [""];
          const extra = [];

          for (const q of seeds) {
            const r = await api.searchServices({ q, dest: activeDest, limit: 50 });
            extra.push(...(r||[]));
          }

          const merged = [...out, ...extra.filter(x => inTab(x, svcTab))];
          // dédup par supplier (hôtels) ou id (autres) - déjà fait pour out, mais refaire pour merged
          const seen2 = new Set(out.map(x => getSupplierKey(x)));
          for (const x of merged) {
            const key = getSupplierKey(x);
            if (!seen2.has(key)) {
              seen2.add(key);
              out.push(x);
            }
          }
        }

        out = out.slice(0,12);
        
        // Charger les infos complètes pour les hôtels immédiatement (pour afficher les étoiles)
        if (svcTab === "Hotels") {
          const promises = out.map(s => ensureSvcInfo(s.id));
          await Promise.all(promises);
        }
        
        if (!cancelled) setSvcPopular(out);
      } catch {
        if (!cancelled) setSvcError("Load failed");
      } finally {
        if (!cancelled) setSvcLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeDest, svcTab]);

  function makeNewDay(protoDest = "", dateISO) {
    return {
      id: (typeof crypto!=="undefined" && crypto.randomUUID) ? crypto.randomUUID() : uid(),
      // Do not force "today" if no reference date is available
      date: (dateISO ?? null),
      destination: protoDest || "",
      decorative_images: [],
      lines: []
    };
  }

  const insertDayAt = useCallback((atIndex) => {
    setQ(prev => {
      const prevDays = Array.isArray(prev?.days) ? [...prev.days] : [];
      if (prevDays.length >= 90) { showNotice("Max 90 days", "info"); return prev; }
      const clampIdx = Math.max(0, Math.min(atIndex, prevDays.length));
      const ref = prevDays[Math.min(clampIdx, Math.max(0, prevDays.length - 1))];
      // Shift start_date if inserting before the first day
      const hadStart = !!prev.start_date;
      const shiftedStart = hadStart && clampIdx === 0 ? addDaysISO(prev.start_date, -1) : prev.start_date;
      const startRef = shiftedStart || prev.start_date || null;
      // If no startRef and no ref date, keep date null (no implicit "today")
      const dateISO = startRef
        ? addDaysISO(startRef, clampIdx)
        : (ref?.date ?? null);
      const newDay = makeNewDay(ref?.destination || "", dateISO);
      prevDays.splice(clampIdx, 0, newDay);
      const normalized = normalizeQuotePositions({ ...prev, days: prevDays });
      // Recompute end if we have an effective start
      const effStart = shiftedStart || prev.start_date || null;
      const nextEnd = effStart ? addDaysISO(effStart, Math.max(0, normalized.days.length - 1)) : prev.end_date;
      // Set new active to the inserted day
      setActiveDayId(newDay.id);
      return { ...prev, days: normalized.days, start_date: effStart || prev.start_date, end_date: nextEnd, dirty: true };
    });
  }, [showNotice]);

  const insertDayBefore = useCallback(() => {
    const idx = findActiveIndex();
    if (idx < 0) { showNotice("Select a day first", "info"); return; }
    insertDayAt(idx);
  }, [findActiveIndex, insertDayAt, showNotice]);

  const insertDayAfter = useCallback(() => {
    const idx = findActiveIndex();
    if (idx < 0) { showNotice("Select a day first", "info"); return; }
    insertDayAt(idx + 1);
  }, [findActiveIndex, insertDayAt, showNotice]);

  // --- Global shift of the whole date window by ±1 day ---
  const shiftDates = useCallback((delta) => {
    if (!q?.start_date || !q?.end_date) {
      showNotice("Set start/end dates first", "info");
      return;
    }
    const nextStart = addDaysISO(q.start_date, delta);
    const nextEnd   = addDaysISO(q.end_date,   delta);
    setQ(prev => ({ ...prev, start_date: nextStart, end_date: nextEnd, dirty: true }));
    showNotice(delta < 0 ? "Dates shifted −1" : "Dates shifted +1", "success");
  }, [q, showNotice]);

  // Keyboard shortcuts: [ = −1, ] = +1 (disabled in inputs and with modifiers)
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toUpperCase();
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.isComposing;
      const hasMods = e.altKey || e.ctrlKey || e.metaKey || e.shiftKey;
      if (isTyping || hasMods) return;
      if (e.key === "[") { e.preventDefault(); shiftDates(-1); }
      if (e.key === "]") { e.preventDefault(); shiftDates(+1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shiftDates]);

  // --- Delete active day with min=1 and contiguous dates ---
  const deleteActiveDay = useCallback(() => {
    const days = [...(q?.days || [])];
    if (days.length <= 1) { showNotice("At least 1 day required", "info"); return; }
    const idx = (q?.days || []).findIndex(d => d.id === activeDayId);
    if (idx < 0) { showNotice("Select a day first", "info"); return; }
    // Remove
    days.splice(idx, 1);
    const normalized = normalizeQuotePositions({ ...q, days });
    // Adjust start/end if start_date is defined
    let nextStart = q.start_date || null;
    if (nextStart && idx === 0) {
      nextStart = addDaysISO(nextStart, 1); // first day removed → shift start forward
    }
    let nextEnd = q.end_date || null;
    if (nextStart) {
      nextEnd = addDaysISO(nextStart, Math.max(0, normalized.days.length - 1));
      setQ(prev => ({ ...prev, days: normalized.days, start_date: nextStart, end_date: nextEnd, dirty: true }));
    } else {
      setQ(prev => ({ ...prev, days: normalized.days, dirty: true }));
    }
    // Select new active day
    const pick = normalized.days[Math.min(idx, normalized.days.length - 1)];
    if (pick) setActiveDayId(pick.id);
    showNotice("Day deleted", "success");
  }, [q, activeDayId, showNotice]);

  const ensureQuoteId = async () => {
    // If already have an id, return it
    const existing = (q && q.id) || null;
    if (existing) return existing;

    // Otherwise, trigger save/create flow
    try {
      const payload = {
        title: q.title,
        display_title: q.display_title,
        hero_photo_1: q.hero_photo_1,
        hero_photo_2: q.hero_photo_2,
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






  // Rebuild between start/end if and only if current days do not already match
  useEffect(() => {
    const d0 = new Date(q.start_date + "T00:00:00");
    const d1 = new Date(q.end_date + "T00:00:00");
    if (isNaN(d0) || isNaN(d1)) return;
    const n = Math.max(1, Math.round((d1 - d0) / 86400000) + 1);
    const isoAt = (i) => new Date(d0.getTime() + i * 86400000).toISOString().slice(0, 10);

    // Guard: if length and all dates already match, no-op
    const sameLen = (q.days || []).length === n;
    const datesMatch = sameLen && (q.days || []).every((d, i) => d?.date === isoAt(i));
    if (datesMatch) return;

    // Rebuild from current order, preserving positions; adjust dates by index
    const cur = Array.isArray(q.days) ? [...q.days] : [];
    // Extend or truncate at the end only
    if (cur.length < n) {
      const protoDest = cur[0]?.destination ?? "";
      for (let i = cur.length; i < n; i += 1) {
        cur.push({ id: crypto.randomUUID(), date: isoAt(i), destination: protoDest, lines: [] });
      }
    } else if (cur.length > n) {
      cur.length = n;
    }
    for (let i = 0; i < n; i += 1) {
      if (cur[i]) cur[i] = { ...cur[i], date: isoAt(i) };
    }
    const normalized = normalizeQuotePositions({ ...q, days: cur });
    setQ((prev) => ({ ...prev, days: normalized.days, dirty: prev.dirty }));
    if (!activeDayId && n > 0) setActiveDayId(cur[0].id);
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

  // Onspot/Hassle: use manual if set, else base/defaults; parse robustly (same as Excel preview)
  const onspotUsed = round2(parseLocaleFloat(q?.onspot_manual ?? onspotBase ?? 0));
  const hassleUsed = round2(parseLocaleFloat(q?.hassle_manual ?? hassleDefault ?? 0));

  // Total mémoïsé pour le badge gauche, calqué sur l'Excel preview
  const totalsForBadge = React.useMemo(() => {
    return computeTotalsUSD(q, localLines, { onspotUsed, hassleUsed, marginStr });
  }, [q, localLines, onspotUsed, hassleUsed, marginStr]);

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
        const l = (category==="Internal info")
          ? {...newTripInfo(), category:"Internal info", title:"Internal note (edit only here)"}
          : newPayable(category, `New ${category}`);
        return {...d, lines:[...d.lines, l]};
      });
      return {...prev, days};
    });
  };

  // --- Helpers ---------------------------------------------------------------
  function ensureDropoffTripInfo(next, targetISO){
    if (!targetISO) return;
    const i = next.days.findIndex(d => d.date === targetISO);
    if (i < 0) return;
    const key = "drop off the car";
    const norm = (s)=> (s||"").trim().toLowerCase();
    const lines = next.days[i].lines || [];
    const firstIdx = lines.findIndex(l => l.category==="Trip info" && norm(l.title)===key);
    if (firstIdx === -1){
      lines.push({ id: crypto.randomUUID(), category: "Trip info", title: "Drop off the car" });
      next.days[i].lines = lines;
    }else{
      // garde la première occurrence uniquement
      next.days[i].lines = lines.filter((l, idx) => !(l.category==="Trip info" && norm(l.title)===key && idx!==firstIdx));
    }
  }

  const addLocalLine = (dayId, category, data={}) => {
    const id = crypto.randomUUID();
    setLocalLines(prev => [{ id, dayId, category, data, isLocal:true, deleted:false }, ...prev]);
    setQ(prev => ({ ...prev, dirty: true }));

    // Si Car Rental → s'assurer du Trip info "Drop off the car" à la date attendue
    if (category === "Car Rental"){
      const expectedISO = (data?.expected_dropoff_date || "").slice(0,10);
      if (expectedISO){
        setQ(prev => {
          const next = structuredClone(prev);
          ensureDropoffTripInfo(next, expectedISO);
          return next;
        });
      }
    }
  };

  const findDayIdByISO = (iso) => {
    if (!iso) return null;
    const d = q.days.find(x => String(x.date).slice(0,10) === String(iso).slice(0,10));
    return d ? d.id : null;
  };

  const openEditModal = useCallback((line) => {
    setEditingLine(line);
    
    const cat = (line.category || '').toLowerCase();
    // Check both root level and data.raw_json for catalog detection
    const rawJson = line?.raw_json || line?.data?.raw_json || {};
    const fromCatalog = rawJson?.source === 'catalog' || !!rawJson?.catalog_id;
    
    // PRIORITY: Check for catalog hotels FIRST (before general hotel handling)
    if (cat.includes('hotel') && fromCatalog && enableCatalogHotelModal) {
      // Find the day index for this line
      const dayIdx = q.days.findIndex(d => d.lines?.some(l => l.id === line.id));
      if (dayIdx >= 0) {
        // Ensure raw_json is at root level for openEditCatalogHotelModal
        const lineWithRawJson = line.raw_json ? line : { ...line, raw_json: rawJson };
        // Use the catalog hotel modal
        if (openEditCatalogHotelModal(lineWithRawJson, dayIdx, enableCatalogHotelModal, setCatalogHotelDraft)) {
          return; // Successfully opened catalog hotel modal
        }
      }
    }
    
    // Detect catalog line (for activities and transfers)
    if (fromCatalog) {
      // decide type: Activity if NOT hotel (room/suite) and NOT pure transfer
      const t = (line.title || "").toLowerCase();
      const isHotel = /room|suite|apartment|villa/.test(t) || cat.includes('hotel');
      const isTransfer = /transfer/.test(t) || cat.includes('transfer') || cat.includes('transport');
      
      if (isTransfer) {
        // Open transport modal for editing
        const dayIdx = q.days.findIndex(d => d.lines?.some(l => l.id === line.id));
        if (dayIdx >= 0) {
          const rawJson = line.raw_json || {};
          const svcFull = rawJson.snapshot || {};
          const draft = {
            mode: 'edit',
            svcFull: svcFull,
            dayIdx: dayIdx,
            lineId: line.id,
            defaults: {
              description: line.raw_json?.description || '',
              start_time: line.raw_json?.start_time || '',
              internal_note: line.raw_json?.internal_note || ''
            }
          };
          setCatalogTransportDraft(draft);
          return;
        }
      }
      
      if (!isHotel && !isTransfer) {
        // Open activity modal for editing
        const dayIdx = q.days.findIndex(d => d.lines?.some(l => l.id === line.id));
        if (dayIdx >= 0) {
          const rawJson = line.raw_json || {};
          const svcFull = rawJson.snapshot || {};
          const draft = {
            mode: 'edit',
            svcFull: svcFull,
            dayIdx: dayIdx,
            lineId: line.id,
            defaults: {
              description: line.raw_json?.description || '',
              start_time: line.raw_json?.start_time || '',
              end_time: line.raw_json?.end_time || '',
              duration: line.raw_json?.duration || '',
              internal_note: line.raw_json?.internal_note || ''
            }
          };
          setCatalogActivityDraft(draft);
          return;
        }
        // Fallback to old modal
        setEditingLine(line);
        setCatalogActivityOpen(true);
        return;
      }
    }
    
    // Handle by category (including catalog lines that are hotels/transfers)
    if (cat.includes('hotel')) {
      // Fallback to standard hotel modal (for non-catalog hotels)
      setEditingLine(line);
      setHotelOpen(true);
      return;
    }
    
    if (cat.includes('transfer') || cat.includes('transport')) {
      setEditingLine(line);
      setNewServiceOpen(true);
      return;
    }
    
    // Activities & fallback
    switch(line.category) {
      case "Trip info": setTripInfoOpen(true); break;
      case "Internal info": setInternalInfoOpen(true); break;
      case "Cost": setCostOpen(true); break;
      case "Flight": setFlightOpen(true); break;
      case "Train": setTrainOpen(true); break;
      case "Ferry": setFerryOpen(true); break;
      case "Car Rental": setCarModalOpen(true); break;
      case "New Hotel": setHotelOpen(true); break;
      case "New Service": setNewServiceOpen(true); break;
      default: setNewServiceOpen(true); break; // Activities & fallback
    }
  }, [q, enableCatalogHotelModal, setCatalogHotelDraft]);

  const restoreLine = (id) => {
    setTrashLines(t => t.filter(x=>x.id!==id));
    setLocalLines(l => l.map(x => x.id===id ? {...x, deleted:false} : x));
  };

  const purgeLine = (id) => {
    setTrashLines(t => t.filter(x=>x.id!==id));
    setLocalLines(l => l.filter(x => x.id!==id));
  };



  const totalScroll = ()=> totalsRef.current?.scrollIntoView({behavior:"smooth", block:"start"});

  // Smooth scroll to a service card and apply a brief highlight
  function scrollToLine(lineId) {
    if (!lineId) return;
    const el = document.getElementById(`line-${lineId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      // flash highlight
      el.classList.remove("flash-highlight"); // reset if still present
      // Force reflow to restart animation if clicking twice quickly
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight;
      el.classList.add("flash-highlight");
      window.setTimeout(() => el.classList.remove("flash-highlight"), 1400);
    }
  }



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
    const clamp50 = (s) => (s || "").length > 50 ? (s.slice(0,50) + "…") : (s || "");
    function excelServiceName(line){
      const cat = (line.category || "").toLowerCase();
      const d = line.data || line;
      if (cat === "flight")  return clamp50(`Flight ${d.from || "?"}->${d.to || "?"}`);
      if (cat === "train")   return clamp50(`Train ${d.from || "?"}->${d.to || "?"}`);
      if (cat === "ferry")   return clamp50(`Ferry ${d.from || "?"}->${d.to || "?"}`);
      if (cat === "new hotel" || cat === "hotel") return clamp50(d.hotel_name || line.hotel_name || "Hotel");
      if (cat === "new service" || cat === "activity") return clamp50(d.title || line.title || "Service");
      if (cat === "car rental") return "Car Rental";
      if (cat === "cost") return clamp50(d.title || line.title || "Cost");
      // Trip info / Internal info exclus
      return clamp50(line.title || line.service_name || "—");
    }
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
          name: excelServiceName(line),
          eur, fx, usd, sell,
          lineId: line.id
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

        // Build a line-like object for excelServiceName helper
        const lineForName = { 
          category: line.category, 
          data: line.data || {},
          title: line.data?.title, 
          service_name: line.data?.service_name
        };
        // Build a line-like object for destOf helper (local lines don't have destination directly)
        const lineForDest = { destination: line.data?.destination, city: line.data?.city, data: line.data };
        rows.push({
          dest: destOf(day, lineForDest), // if needed we can wire active day destination later
          name: excelServiceName(lineForName),
          eur, fx, usd, sell,
          lineId: line.id
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

                <td>
                  {r.lineId
                    ? (
                      <button
                        className="link-like"
                        title="Scroll to service"
                        onClick={() => scrollToLine(r.lineId)}
                      >
                        {r.name}
                      </button>
                    )
                    : r.name}
                </td>

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

  // DEBUG: Log state before render
  // dbg('[STATE]', q);

  return (

    <div className="app">

      {/* TOP BAR */}

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
        <div style={{display:"flex",gap:8}}>
          <button
            className={`id-badge ${q?.id ? "" : "ghost"}`}
            title={q?.id ? "Copy quote ID" : "Draft: save to get an ID"}
            disabled={!q?.id}
            onClick={()=>{
              const v = String(q.id);
              navigator.clipboard?.writeText(v).then(()=>showNotice(`Copied #${v}`, "success"));
            }}
          >
            {q?.id ? `#${String(q.id)}` : "Draft"}
          </button>
          <button
            className="id-badge"
            title="Copy open link"
            onClick={()=>{
              const u = new URL(window.location.href);
              if (q?.id) u.searchParams.set("quoteId", String(q.id));
              navigator.clipboard?.writeText(u.toString()).then(()=>showNotice("Link copied", "success"));
            }}
          >
            Copy link
          </button>
        </div>
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

        {q?.id && (
          <button 
            className="btn primary" 
            onClick={async () => {
              if (!q?.id) return;
              try {
                showNotice("Exporting Word document...", "info");
                await api.exportQuoteWord(q.id);
                showNotice("Word document downloaded", "success");
              } catch (err) {
                console.error("Export error:", err);
                showNotice("Export failed", "error");
              }
            }}
            title="Export to Word"
          >
            Export Word
          </button>
        )}

        <button className="btn secondary" onClick={() => setTrashOpen(!trashOpen)} title="Trash">
          🗑 {trashLines.length > 0 && <span>({trashLines.length})</span>}
        </button>

      </div>
      {/* Dirty navigation ribbon: fixed wrapper (non-blocking) + inner (clickable) */}
      {confirmNav.visible && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10001,
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
              outline: "2px solid #9cf",
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
      {/* Non-modal notice, top-left, auto-hides */}
      {notice.msg && (
        <div
          style={{
            position:"fixed", top:10, left:10, zIndex:9990, pointerEvents:"none",
            padding:"8px 12px", borderRadius:8, fontSize:12,
            background: notice.kind==="error" ? "#5b100f"
                     : notice.kind==="success" ? "#0f3d1e"
                     : "#0b1830",
            border:"1px solid rgba(255,255,255,.12)", color:"#e6edf7"
          }}
          aria-live="polite"
        >
          {notice.msg}
        </div>
      )}



      <div className="shell">

        {/* Left rail */}

        <div className="rail">

          <div className="left-list">

            <div className="left-group">
              {/* Global date shift controls */}
              <div style={{display:"flex", gap:8, marginBottom:8}}>
                <button
                  className="day-pill"
                  onClick={() => shiftDates(-1)}
                  title="Shift all dates −1 day ([)"
                  disabled={!q?.start_date || !q?.end_date}
                >
                  Shift −1
                </button>
                <button
                  className="day-pill"
                  onClick={() => shiftDates(+1)}
                  title="Shift all dates +1 day (])"
                  disabled={!q?.start_date || !q?.end_date}
                >
                  Shift +1
                </button>
              </div>

              {/* Insert/Delete controls ABOVE the day list */}
              <button
                className="day-pill"
                onClick={insertDayBefore}
                title="Insert day before active"
                disabled={!activeDayId || findActiveIndex() < 0}
              >
                + Before
              </button>
              <button
                className="day-pill"
                onClick={deleteActiveDay}
                title="Delete active day"
                disabled={!activeDayId || (q?.days?.length||0) <= 1}
                style={{background:"#2a0f13"}}
              >
                Delete day
              </button>

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
                        // Compute initial destination and contiguous nights starting at this day
                        const startISO = d?.date || null;
                        const initialDestination = (d && d.destination) ? d.destination : "";
                        let initialNights = 1;
                        try {
                          if (q?.days && startISO && initialDestination) {
                            // Sort days by date to be safe
                            const daysSorted = [...q.days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
                            const startIdx = daysSorted.findIndex(dd => dd.date === startISO);
                            if (startIdx >= 0) {
                              initialNights = 1;
                              for (let i = startIdx + 1; i < daysSorted.length; i++) {
                                const dd = daysSorted[i];
                                // Stop if null/empty destination or different destination
                                if (!dd?.destination || dd.destination !== initialDestination) break;
                                initialNights += 1;
                              }
                            }
                          } else {
                            initialNights = 1;
                          }
                        } catch (_) {
                          initialNights = 1;
                        }
                        setDestModal({
                          open: true,
                          quoteId: qid,
                          startDate: startISO,
                          initialDestination,
                          initialNights
                        });
                      }}
                    >
                      {/* Destination pin icon, stroked like edit/delete icons (size ~18) */}
                      <svg viewBox="0 0 24 24" width="18" height="18"
                           fill="none" stroke="currentColor" strokeWidth="1.6"
                           strokeLinecap="round" strokeLinejoin="round" role="img"
                           aria-label="Set destination">
                        <path d="M12 21s-6-4.5-6-10a6 6 0 1 1 12 0c0 5.5-6 10-6 10z"/>
                        <circle cx="12" cy="11" r="2.5"/>
                      </svg>
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

              {/* Place + After above the Total row */}
              <button
                className="day-pill"
                onClick={insertDayAfter}
                title="Insert day after active"
                disabled={!activeDayId || findActiveIndex() < 0}
              >
                + After
              </button>

              {/* Total row */}

              <button className="total-pill" onClick={totalScroll}>
                <span>Total: <span className="total-amt">{money(totalsForBadge.grandTotal,{digits:2})}</span></span>
              </button>

            </div>

          </div>

        </div>



        {/* COLONNE CENTRALE */}

        <div className="center-rail">

          <div className="page" id="wordPage">

            {/* ---- tout ce qui suit doit être DEDANS ---- */}

            <HeaderHero quote={q} setQuote={setQ} activeDest={activeDest} />

            {q.days.map((d, dayIdx)=>(

              <div key={d.id} id={`day-${d.id}`} className="day-card">

                {/* DayHero only (above the date). Legacy block below removed */}
                <DayHero
                  day={d}
                  dayIdx={dayIdx}
                  onEdit={() => setEditingDayHero({ dayId: d.id, dayIdx })}
                />

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
                    return (<span>{title}</span>);
                  })()}
                </div>
                
                {/* head-of-day slot */}
                <div
                  className={`drop-slot ${hoverSlot.day===dayIdx && hoverSlot.index===0 ? 'over' : ''}`}
                  onDragOver={(e)=>{allowDrop(e); setHoverSlot({day:dayIdx,index:0});}}
                  onDrop={(e)=> { dropBefore(e, dayIdx, 0); e.stopPropagation(); }}
                />

                <div className="day-services">
                  {(() => {
                    const dayLocal = localLines.filter(l => l.dayId === d.id && !l.deleted);
                    const allLines = [...(d.lines||[]), ...dayLocal];
                    const localCount = dayLocal.length;
                    // Filter out legacy placeholders before mapping
                    const visibleLines = allLines.filter(l => {
                      return !((l.category === "Trip info" || l.category === "Internal info") && (l.title || "").includes("edit me"));
                    });
                    return visibleLines.length > 0 ? visibleLines.map((l, dispIdx) => {
                      // Find original index in allLines for correct positioning
                      const originalIdx = allLines.findIndex(line => line.id === l.id && line === l);
                      const actualDispIdx = originalIdx >= 0 ? originalIdx : dispIdx;
                      const isLocal = l.isLocal || dayLocal.some(ll => ll.id === l.id);
                      const lineIdx = isLocal ? -1 : d.lines.findIndex(line => line.id === l.id);
                      // Use actualDispIdx for hover slot and drop positioning
                      const displayIndex = actualDispIdx;
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
                      // Ensure unique key: combine day id, line id, and index to guarantee uniqueness
                      const uniqueKey = `${d.id}-${l.id || 'no-id'}-${displayIndex}`;
                      return (
                        <React.Fragment key={uniqueKey}>
                          <div
                            className={`drop-slot ${hoverSlot.day===dayIdx && hoverSlot.index===displayIndex ? 'over':''}`}
                            onDragOver={(e)=>{allowDrop(e); setHoverSlot({day:dayIdx,index:displayIndex});}}
                            onDrop={(e)=> { dropBefore(e, dayIdx, displayIndex); e.stopPropagation(); }}
                          />
                          {/* card wrapper */}
                          <div
                            className="draggable-wrap"
                            id={`line-${l.id}`}
                            onDragOver={allowDrop}
                          >
                          <ServiceCard
                            line={lineData}
                            onChangeLocalData={isLocal ? (newData)=>{
                              setLocalLines(prev => prev.map(x => x.id===l.id ? { ...x, data:newData } : x));
                            } : undefined}
                              onDragFromHandle={(e)=>{
                                const meta = {
                                  fromDay: dayIdx,
                                  fromBackendIndex: lineIdx,    // -1 if local
                                  isLocal,
                                  lineId: l.id,
                                  fromDayId: d.id,
                                };
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('application/json', JSON.stringify(meta));
                                e.dataTransfer.setData('text/plain', JSON.stringify(meta)); // fallback
                                console.log('[dnd] dragstart', meta);
                              }}
                            onEdit={() => {
                              if (isLocal) {
                                openEditModal(l);
                              } else {
                                // For backend lines, preserve raw_json at root level for catalog detection
                                const editData = {
                                  id: l.id,
                                  category: l.category,
                                  title: l.title,
                                  supplier_name: l.supplier_name,
                                  service_id: l.service_id,
                                  raw_json: l.raw_json, // Keep raw_json at root for catalog detection
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
                                // For backend lines (including catalog hotels and transports), remove from q.days
                                setQ(prev => {
                                  const qn = { ...prev };
                                  const day = { ...qn.days[dayIdx] };
                                  day.lines = (day.lines || []).filter(line => line.id !== l.id);
                                  const normalized = normalizeQuotePositions({ 
                                    ...qn, 
                                    days: qn.days.map((d, i) => i === dayIdx ? day : d) 
                                  });
                                  normalized.dirty = true;
                                  return normalized;
                                });
                                showNotice("Service deleted", "success");
                              }
                            }}
                          />
                          {isPaidCategory(l.category) && (
                            <div className="price-row-one">
                              {/* Prix d'achat € */}
                              <input
                                className="price-inp price-eur"
                                type="text" inputMode="decimal" placeholder="Prix d'achat €"
                                value={toStr(isLocal ? getPrice("purchase_eur") : getPrice("achat_eur"))}
                                onChange={(e)=> updateAnyLine(isLocal ? { purchase_eur: e.target.value } : { achat_eur: e.target.value })}
                                onBlur={()=>{
                                  const eurVal = isLocal ? getPrice("purchase_eur") : getPrice("achat_eur");
                                  const fxVal  = isLocal ? getPrice("fx_eur_usd")   : getPrice("fx_rate");
                                  const eur = round2(parseLocaleFloat(eurVal));
                                  const fx  = effectiveFx(fxVal, fxEuroToUsd);
                                  const usd = round2(eur * fx);
                                  const usdVal = isLocal ? getPrice("purchase_usd") : getPrice("achat_usd");
                                  updateAnyLine(isLocal ? 
                                    { purchase_eur: eur, purchase_usd: eur>0 ? usd : usdVal } :
                                    { achat_eur: eur,    achat_usd:   eur>0 ? usd : usdVal }
                                  );
                                }}
                              />

                              {/* FX €→$ */}
                              <input
                                className="price-inp fx"
                                type="text" inputMode="decimal" placeholder="€→$"
                                value={(() => {
                                  const fxValRaw = isLocal ? getPrice("fx_eur_usd") : getPrice("fx_rate");
                                  const fxVal = parseLocaleFloat(fxValRaw);
                                  const displayFx = (!fxVal || fxVal <= 0) ? round4(parseLocaleFloat(fxEuroToUsd)) : round4(fxVal);
                                  return toStr(displayFx);
                                })()}
                                onChange={(e)=> updateAnyLine(isLocal ? { fx_eur_usd: e.target.value } : { fx_rate: e.target.value })}
                                onBlur={()=>{
                                  let fxVal = parseLocaleFloat(isLocal ? getPrice("fx_eur_usd") : getPrice("fx_rate"));
                                  if (!fxVal || fxVal <= 0) fxVal = parseLocaleFloat(fxEuroToUsd);
                                  const fx  = round4(fxVal);
                                  const eur = round2(parseLocaleFloat(isLocal ? getPrice("purchase_eur") : getPrice("achat_eur")));
                                  const usd = eur>0 ? round2(eur * fx) : parseLocaleFloat(isLocal ? getPrice("purchase_usd") : getPrice("achat_usd"));
                                  const usdVal = isLocal ? getPrice("purchase_usd") : getPrice("achat_usd");
                                  updateAnyLine(isLocal ? { fx_eur_usd: fx, purchase_usd: eur>0 ? usd : usdVal }
                                                            : { fx_rate: fx,   achat_usd:    eur>0 ? usd : usdVal });
                                }}
                              />

                              {/* Prix d'achat $ */}
                              <input
                                className="price-inp price-usd"
                                type="text" inputMode="decimal" placeholder="Prix d'achat $"
                                value={toStr(isLocal ? getPrice("purchase_usd") : getPrice("achat_usd"))}
                                onChange={(e)=> updateAnyLine(isLocal ? { purchase_usd: e.target.value } : { achat_usd: e.target.value })}
                                onBlur={()=>{
                                  const usd = round2(parseLocaleFloat(isLocal ? getPrice("purchase_usd") : getPrice("achat_usd")));
                                  const eur = round2(parseLocaleFloat(isLocal ? getPrice("purchase_eur") : getPrice("achat_eur")));
                                  const fx  = eur>0 ? round4(usd / eur)
                                                    : round4(parseLocaleFloat(isLocal ? getPrice("fx_eur_usd") : getPrice("fx_rate") ?? fxEuroToUsd));
                                  updateAnyLine(isLocal ? { purchase_usd: usd, fx_eur_usd: fx }
                                                            : { achat_usd: usd,   fx_rate:    fx });
                                }}
                              />

                              {/* Prix de vente $ */}
                              <input
                                className="price-inp sell-usd"
                                type="text" inputMode="decimal" placeholder="Prix de vente $"
                                value={toStr(isLocal ? getPrice("sale_usd") : getPrice("vente_usd"))}
                                onChange={(e)=> updateAnyLine(isLocal ? { sale_usd: e.target.value } : { vente_usd: e.target.value })}
                                onBlur={()=>{
                                  const sellVal = isLocal ? getPrice("sale_usd") : getPrice("vente_usd");
                                  updateAnyLine(isLocal ? { sale_usd: round2(parseLocaleFloat(sellVal)) }
                                                            : { vente_usd: round2(parseLocaleFloat(sellVal)) });
                                }}
                              />
                            </div>
                          )}
                          {isPaidCategory(l.category) && !isLocal && lineIdx >= 0 && shouldShowSupplier(l) && (
                            <div className="line-supplier">{l.supplier_name}</div>
                          )}
                          </div>
                        </React.Fragment>
                      );
                    }) : null;
                  })()}
                  {/* end-of-day slot */}
                  {(() => {
                    const dayLocal = localLines.filter(l => l.dayId === d.id && !l.deleted);
                    const allLines = [...(d.lines||[]), ...dayLocal];
                    const endIndex = allLines.length;        // backend + locals
                    return (
                      <div
                        className={`drop-slot ${hoverSlot.day===dayIdx && hoverSlot.index===endIndex ? 'over':''}`}
                        onDragOver={(e)=>{allowDrop(e); setHoverSlot({day:dayIdx,index:endIndex});}}
                        onDrop={(e)=> { dropBefore(e, dayIdx, endIndex); e.stopPropagation(); }}
                      />
                    );
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

            <div className="chipbar">
              {["Hotels","Activities","Transport"].map(tab => (
                <button
                  key={tab}
                  type="button"
                  className={`chip ${svcTab===tab ? "active" : ""}`}
                  onClick={()=> setSvcTab(tab)}
                  onKeyDown={(e)=> (e.key==="Enter"||e.key===" ") && setSvcTab(tab)}
                  aria-pressed={svcTab===tab}
                >
                  {tab}
                </button>
              ))}
            </div>



            {/* Search (Activity) */}
            <div style={{padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,.06)"}}>
              <div style={{fontWeight:700, opacity:.9, marginBottom:6}}>Search ({svcTab})</div>
              <input
                value={svcQuery}
                onChange={e=>setSvcQuery(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Escape"){ setSvcQuery(""); setSvcResults([]); } }}
                placeholder={`Type to search ${svcTab.toLowerCase()}…`}
                style={{width:"100%", height:36, padding:"0 10px", border:"1px solid rgba(255,255,255,.12)", borderRadius:8, background:"#0f1c33", color:"#e6edf7"}}
              />
              <div style={{marginTop:8}}>
                {svcSLoading && <div style={{opacity:.8}}>Searching…</div>}
                {svcSError && <div style={{color:"#f88"}}>Error: {String(svcSError)}</div>}
                {!svcSLoading && !svcSError && svcQuery.trim() && (
                  <div style={{display:"grid", gridTemplateColumns:"1fr", gap:6}}>
                    {svcResults.map(s => <RightItem key={s.id} s={s} />)}
                    {svcResults.length===0 && <div style={{opacity:.7}}>No results.</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Popular (Activity) */}
            <div style={{padding:"10px 12px"}}>
              <div style={{fontWeight:700, opacity:.9, marginBottom:6}}>Popular ({svcTab})</div>
              {svcLoading && <div style={{opacity:.8}}>Loading…</div>}
              {svcError && <div style={{color:"#f88"}}>Error: {String(svcError)}</div>}
              {!svcLoading && !svcError && (
                <div style={{display:"grid", gridTemplateColumns:"1fr", gap:8}}>
                  {svcPopular.map(s => <RightItem key={s.id} s={s} />)}
                  {svcPopular.length === 0 && <div style={{opacity:.7}}>No popular items for this destination.</div>}
                </div>
              )}
            </div>



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
          initialDestination={destModal.initialDestination || ""}
          initialNights={destModal.initialNights || 1}
          ensureQuoteId={ensureQuoteId}
          onClose={() => setDestModal({ open: false, quoteId: null, startDate: null })}
          onApplied={async () => {
            const qid = destModal.quoteId ?? ((q && q.id) || null);
            setDestModal({ open: false, quoteId: null, startDate: null, initialDestination: "", initialNights: 1 });
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
              // quand on reçoit le payload Car Rental
              addLocalLine(dayId, "Car Rental", payload);
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

      {/* Catalog Activity Modal */}
      <CatalogActivityModal
        open={catalogActivityOpen}
        line={editingLine}
        onClose={() => { setCatalogActivityOpen(false); setEditingLine(null); }}
        onSubmit={(updated) => {
          // Replace the line in q.days[...] and set dirty
          setQ((prev) => {
            const next = structuredClone(prev);
            const d = next.days.find(d => d.lines?.some(l => l.id === updated.id));
            if (d) {
              const idx = d.lines.findIndex(l => l.id === updated.id);
              if (idx >= 0) d.lines[idx] = updated;
            }
            next.dirty = true;
            return next;
          });
          setCatalogActivityOpen(false);
          setEditingLine(null);
        }}
      />

      {/* Hotel-from-catalog modal */}
      {enableCatalogHotelModal && catalogHotelDraft && (
        <HotelFromCatalogModal
          open={!!catalogHotelDraft}
          data={catalogHotelDraft}
          onClose={() => setCatalogHotelDraft(null)}
          onSubmit={(payload) => {
            // payload: { room_type, breakfast, early_check_in, check_in_date, check_out_date, description, internal_note }
            const { mode, svcFull, dayIdx, defaults, lineId } = catalogHotelDraft;
            const hotelName = (defaults?.hotel_name || svcFull?.company || svcFull?.supplier?.name || svcFull?.name || "");
            const supplier_name = hotelName;
            const title = payload.room_type; // mandatory per spec
            const baseRaw = {
              source: "catalog",
              catalog_id: svcFull.id,
              start_destination: svcFull.start_destination ?? null,
              supplier_id: svcFull.supplier_id ?? null,
              supplier_ref: supplier_name,
              hotel_name: hotelName,
              hotel_stars: (defaults?.hotel_stars ?? svcFull?.hotel_stars ?? "") || "",
              hotel_url: (defaults?.hotel_url || ""),
              room_type: payload.room_type || "",
              breakfast: !!payload.breakfast,
              early_check_in: !!payload.early_check_in,
              check_in_date: payload.check_in_date,
              check_out_date: payload.check_out_date,
              description: payload.description || "",
              internal_note: payload.internal_note || "",
              fields: (svcFull?.fields || defaults?.fields || {}),
              snapshot: (svcFull || defaults?.snapshot || {}),
              images: svcFull?.images || [], // Store images in raw_json
              hydrated: true
            };
            const newLine = {
              id: (typeof crypto!=="undefined" && crypto.randomUUID) ? crypto.randomUUID() : uid(),
              service_id: svcFull.id,
              category: "Hotel",
              title,
              supplier_name,
              visibility: "client",
              achat_eur: null, achat_usd: null, vente_usd: null, fx_rate: null,
              currency: null, base_net_amount: null,
              raw_json: baseRaw
            };
            setQ(prev => {
              const qn = { ...prev };
              // En mode edit, rechercher la ligne dans tous les jours (au cas où elle aurait été déplacée)
              if (mode === 'edit' && lineId) {
                let found = false;
                const updatedDays = qn.days.map((day, idx) => {
                  const hasLine = day.lines?.some(L => L.id === lineId);
                  if (hasLine) {
                    found = true;
                    return {
                      ...day,
                      lines: (day.lines || []).map(L => L.id === lineId ? {
                        ...L,
                        title,
                        supplier_name,
                        raw_json: { ...(L.raw_json||{}), ...baseRaw }
                      } : L)
                    };
                  }
                  return day;
                });
                
                if (found) {
                  // La ligne a été trouvée et mise à jour, recalculer les décorations pour le jour concerné
                  const dayWithLine = updatedDays.find(day => day.lines?.some(L => L.id === lineId));
                  if (dayWithLine) {
                    const dayIdx = updatedDays.indexOf(dayWithLine);
                    const d = addServiceImagesToDay(dayWithLine, svcFull);
                    updatedDays[dayIdx] = d;
                    try {
                      recomputeDayDecorations({ ...qn, days: updatedDays }, dayIdx);
                    } catch {}
                  }
                  const normalized = normalizeQuotePositions({ ...qn, days: updatedDays });
                  normalized.dirty = true;
                  return normalized;
                }
                // Si la ligne n'a pas été trouvée, créer une nouvelle ligne dans le jour spécifié (fallback)
              }
              
              // Mode create ou fallback
              let d = { ...qn.days[dayIdx] };
              if (mode === 'edit' && lineId) {
                // Fallback: mettre à jour dans le jour spécifié
                d.lines = (d.lines || []).map(L => L.id === lineId ? {
                  ...L,
                  title,
                  supplier_name,
                  raw_json: { ...(L.raw_json||{}), ...baseRaw }
                } : L);
              } else {
                d.lines = Array.isArray(d.lines) ? [...d.lines, newLine] : [newLine];
              }
              // Add service images to day's decorative_images
              d = addServiceImagesToDay(d, svcFull);
              const normalized = normalizeQuotePositions({ ...qn, days: qn.days.map((x,i)=> i===dayIdx? d : x) });
              normalized.dirty = true;
              return normalized;
            });
            setCatalogHotelDraft(null);
          }}
        />
      )}

      {/* Transport-from-catalog modal */}
      {catalogTransportDraft && (
        <TransportFromCatalogModal
          open={!!catalogTransportDraft}
          data={catalogTransportDraft}
          onClose={() => setCatalogTransportDraft(null)}
          onSubmit={(payload) => {
            // payload: { description, start_time, internal_note }
            const { mode, svcFull, dayIdx, lineId } = catalogTransportDraft;
            const supplier_name = svcFull?.supplier_name ?? svcFull?.supplier?.name ?? svcFull?.company ?? "";
            const title = svcFull?.name || "Transport";
            const baseRaw = {
              source: "catalog",
              catalog_id: svcFull.id,
              start_destination: svcFull.start_destination ?? null,
              supplier_id: svcFull.supplier_id ?? null,
              supplier_ref: supplier_name,
              description: payload.description || "",
              start_time: payload.start_time || "",
              internal_note: payload.internal_note || "",
              snapshot: svcFull || {},
              images: svcFull?.images || [], // Store images in raw_json
              hydrated: true
            };
            const newLine = {
              id: (typeof crypto!=="undefined" && crypto.randomUUID) ? crypto.randomUUID() : uid(),
              service_id: svcFull.id,
              category: "Private Transfer",
              title,
              supplier_name,
              visibility: "client",
              achat_eur: null, achat_usd: null, vente_usd: null, fx_rate: null,
              currency: null, base_net_amount: null,
              raw_json: baseRaw
            };
            setQ(prev => {
              const qn = { ...prev };
              let d = { ...qn.days[dayIdx] };
              if (mode === 'edit' && lineId) {
                d.lines = (d.lines || []).map(L => L.id === lineId ? {
                  ...L,
                  raw_json: { ...(L.raw_json||{}), ...baseRaw }
                } : L);
              } else {
                d.lines = Array.isArray(d.lines) ? [...d.lines, newLine] : [newLine];
              }
              // Add service images to day's decorative_images
              d = addServiceImagesToDay(d, svcFull);
              const normalized = normalizeQuotePositions({ ...qn, days: qn.days.map((x,i)=> i===dayIdx? d : x) });
              normalized.dirty = true;
              return normalized;
            });
            setCatalogTransportDraft(null);
          }}
        />
      )}

      {/* Activity-from-catalog modal */}
      {catalogActivityDraft && (
        <ActivityFromCatalogModal
          open={!!catalogActivityDraft}
          data={catalogActivityDraft}
          onClose={() => setCatalogActivityDraft(null)}
          onSubmit={(payload) => {
            // payload: { description, start_time, end_time, duration, internal_note }
            const { mode, svcFull, dayIdx, lineId } = catalogActivityDraft;
            const supplier_name = svcFull?.supplier_name ?? svcFull?.supplier?.name ?? svcFull?.company ?? "";
            const title = svcFull?.name || "Activity";
            const baseRaw = {
              source: "catalog",
              catalog_id: svcFull.id,
              start_destination: svcFull.start_destination ?? null,
              supplier_id: svcFull.supplier_id ?? null,
              supplier_ref: supplier_name,
              description: payload.description || "",
              start_time: payload.start_time || "",
              end_time: payload.end_time || "",
              duration: payload.duration || "",
              internal_note: payload.internal_note || "",
              snapshot: svcFull || {},
              images: svcFull?.images || [], // Store images in raw_json
              hydrated: true
            };
            const newLine = {
              id: (typeof crypto!=="undefined" && crypto.randomUUID) ? crypto.randomUUID() : uid(),
              service_id: svcFull.id,
              category: "Activity",
              title,
              supplier_name,
              visibility: "client",
              achat_eur: null, achat_usd: null, vente_usd: null, fx_rate: null,
              currency: null, base_net_amount: null,
              raw_json: baseRaw
            };
            setQ(prev => {
              const qn = { ...prev };
              let d = { ...qn.days[dayIdx] };
              if (mode === 'edit' && lineId) {
                d.lines = (d.lines || []).map(L => L.id === lineId ? {
                  ...L,
                  raw_json: { ...(L.raw_json||{}), ...baseRaw }
                } : L);
              } else {
                d.lines = Array.isArray(d.lines) ? [...d.lines, newLine] : [newLine];
              }
              // Add service images to day's decorative_images
              d = addServiceImagesToDay(d, svcFull);
              const normalized = normalizeQuotePositions({ ...qn, days: qn.days.map((x,i)=> i===dayIdx? d : x) });
              normalized.dirty = true;
              return normalized;
            });
            setCatalogActivityDraft(null);
          }}
        />
      )}

      {/* Day images modal */}
      {editingDayImages && (
        <DayImagesModal
          open={!!editingDayImages}
          day={editingDayImages.day}
          onClose={() => setEditingDayImages(null)}
          onSave={(images) => {
            setQ(prev => {
              const qn = { ...prev };
              const dayIdx = qn.days.findIndex(d => d.id === editingDayImages.dayId);
              if (dayIdx >= 0) {
                const updatedDays = [...qn.days];
                updatedDays[dayIdx] = { ...updatedDays[dayIdx], decorative_images: images };
                return { ...qn, days: updatedDays, dirty: true };
              }
              return qn;
            });
            setEditingDayImages(null);
          }}
        />
      )}

      {/* Day hero modal */}
      {editingDayHero && (() => {
        const { dayId, dayIdx } = editingDayHero;
        const day = q.days?.[dayIdx];
        return (
          <DayHeroModal
            initialP1={(day?.decorative_images?.[0]) || ""}
            initialP2={(day?.decorative_images?.[1]) || ""}
            onClose={() => setEditingDayHero(null)}
            onSaved={({ p1, p2 }) => {
              setQ(prev => {
                const next = structuredClone(prev);
                const idx = dayIdx;
                if (!next?.days?.[idx]) return prev;
                const arr = [];
                if (p1?.trim()) arr.push(p1.trim());
                if (p2?.trim()) arr.push(p2.trim());
                next.days[idx].decorative_images = arr;
                next.dirty = true;
                return next;
              });
              setEditingDayHero(null);
            }}
          />
        );
      })()}

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