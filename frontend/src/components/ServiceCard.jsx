import React, { useState, useEffect, useRef } from "react";
import { fmtAMPM } from "../utils/timeFmt";

const isNonEmpty = v => v !== undefined && v !== null && String(v).trim() !== "";

const isCatalog = (l) => !!l?.raw_json?.catalog_id;
const isFromCatalog = (l) => !!(l?.raw_json?.catalog_id || l?.raw_json?.source === "catalog" || l?.raw_json?.snapshot);
const shouldShowSupplier = (l) => !isFromCatalog(l) && !!l?.supplier_name;
const getF = (l) => l?.raw_json?.fields || {};
const getS = (l) => l?.raw_json?.snapshot || {};
const normYes = (v) => {
  const s = String(v ?? '').toLowerCase();
  return s === '1' || s === 'yes' || s.includes('breakfast');
};
const normStars = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const n = Number.parseFloat(s.replace(/[^\d.]/g, ''));
  if (!isFinite(n) || n <= 0) return '';
  return ' ' + '★'.repeat(Math.max(1, Math.min(5, Math.round(n))));
};
const inferRoom = (t) =>
  (t || '').replace(/\bat\b.*$/i, '').replace(/^(hotel\s*)?room\b[:\-]?\s*/i, '').trim() || 'Room';
const isHotel = (line) => {
  const f = getF(line), s = getS(line);
  return ['Hotel room', 'Apartment', 'Villa'].includes(line?.category)
      || !!(f.hotel_stars || f.hotel_url || s['Hotel Stars'] || s['Hotel URL']);
};
const isTransfer = (line) => line?.category === 'Private Transfer';
const clamp = (s, n=200) => !s ? "" : (s.length > n ? s.slice(0, n).trim() + "…" : s);
function breakfastIncluded(meal1) {
  if (!meal1) return false;
  const s = String(meal1).toLowerCase();
  return s.includes("breakfast") || s.includes("b&b");
}

// Small inline icon component used for actions and the info tip
function Icon({ name, className = "", size = 18 }) {
  const common = { width: size, height: size, className, fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", role: "img" };
  switch (name) {
    case "move":
      return (<svg viewBox="0 0 24 24" aria-label="Move" {...common}><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><path d="M12 3l-2 2m2-2l2 2M12 21l-2-2m2 2l2-2M3 12l2-2m-2 2l2 2M21 12l-2-2m2 2l-2 2"/><circle cx="12" cy="12" r="1.4"/></svg>);
    case "delete":
      return (<svg viewBox="0 0 24 24" aria-label="Delete" {...common}><path d="M4 7h16"/><path d="M10 3h4a2 2 0 0 1 2 2v2H8V5a2 2 0 0 1 2-2z"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M10 11v6M14 11v6"/></svg>);
    case "duplicate":
      return (<svg viewBox="0 0 24 24" aria-label="Duplicate" {...common}><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M5 5h10a2 2 0 0 1 2 2v10"/></svg>);
    case "edit":
      return (<svg viewBox="0 0 24 24" aria-label="Edit" {...common}><path d="M4 20l4.6-1.2 8.9-8.9a2.2 2.2 0 0 0 0-3.1l-.2-.2a2.2 2.2 0 0 0-3.1 0L5.3 15.5 4 20z"/><path d="M13.5 6.5l4 4"/><path d="M4 20h6"/></svg>);
    case "info":
      return (<svg viewBox="0 0 24 24" aria-label="Internal note" {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 11h2v6h-2"/></svg>);
    default: return null;
  }
}

// Helper to print duration as "3h 30m" (from minutes)
export function humanDur(d){
  const n = Number(
    typeof d === "string" ? d.trim() : d
  );
  if (!Number.isFinite(n) || n < 0) return "";
  const mins = Math.round(n);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// Parse duration strings like "3h30", "3h", "90m", "150"
function prettyDur(v){
  if (v == null) return "";
  const t = String(v).trim();
  if (!t) return "";
  // 3h30 or 3:30 or "3 30"
  let m = t.match(/^(\d+)\s*(?:h|:|\s)\s*(\d{1,2})$/i);
  if (m) return humanDur(parseInt(m[1],10)*60 + parseInt(m[2],10));
  // 3h
  m = t.match(/^(\d+)\s*h$/i);
  if (m) return humanDur(parseInt(m[1],10)*60);
  // 90m / 90min
  m = t.match(/^(\d+)\s*m(?:in)?$/i);
  if (m) return humanDur(parseInt(m[1],10));
  // plain minutes "150"
  if (/^\d+$/.test(t)) return humanDur(parseInt(t,10));
  // leave as-is if unknown format
  return t;
}

function minsBetween24(a,b){
  if (!a || !b) return null;
  const [ah,am]=a.split(":").map(Number), [bh,bm]=b.split(":").map(Number);
  if ([ah,am,bh,bm].some(x=>Number.isNaN(x))) return null;
  const s=ah*60+am, e=bh*60+bm;
  return e>=s ? (e-s) : -1;
}

// URL helpers for hotel links
const normalizeUrl = (u) => {
  if (!u) return "";
  const s = u.trim();
  if (/^https?:\/\//i.test(s)) return s;
  return "https://" + s;
};

const displayUrl = (u) => {
  try {
    const url = new URL(normalizeUrl(u));
    return (url.host + url.pathname).replace(/\/$/, "");
  } catch { return u; }
};

// Utilitaires locaux pour le rendu
const _n = s => (s||"").toString().trim().toLowerCase();
const HOTEL_CATS = new Set(["hotel room","apartment","villa"]);
const isHotelLine = L => HOTEL_CATS.has(_n(L?.category));
const isTransportLine = L => _n(L?.category) === "private transfer";
const repeatStar = n => (Number(n)>0 ? " " + "★".repeat(Math.min(5, Number(n))) : "");
const breakfastYes = v => {
  const s = _n(v);
  return s==="1" || s.includes("breakfast") || s.includes("petit déjeuner") || s.includes("petit dejeuner");
};
const cleanRoom = title => {
  const t = (title||"").replace(/^hotel\s*room\s*/i,"").trim();
  return t || title || "Room";
};

// Helper function to convert ordinal suffixes (1st, 2nd, 3rd, etc.) to superscript
function formatOrdinals(text) {
  if (typeof text !== 'string') return text;
  
  // Pattern to match ordinal numbers: 1st, 2nd, 3rd, 4th, etc.
  const ordinalPattern = /(\d+)(st|nd|rd|th)/gi;
  
  const parts = [];
  let lastIndex = 0;
  let match;
  
  while ((match = ordinalPattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    // Add number with superscript suffix
    parts.push(
      <React.Fragment key={match.index}>
        {match[1]}
        <sup>{match[2]}</sup>
      </React.Fragment>
    );
    
    lastIndex = ordinalPattern.lastIndex;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  // If no matches found, return original text
  return parts.length > 0 ? <>{parts}</> : text;
}

export default function ServiceCard({ line, onEdit, onDelete, onDuplicate, onChangeLocalData, onDragStart, showActionIcons = true, showDescriptions = true }) {
  const { category } = line;
  // For backend lines, data is in raw_json; for local lines, it's in line.data
  // Merge raw_json into data for backend lines so all fields are accessible
  const data = line.data || (line.raw_json ? { ...line.raw_json } : {}) || line;
  // Build a compact, read-only summary per category
  let subtitle = "", note = "", showMore = false;
  let isInternal = false;
  const inlineBadges = [];
  const [expanded, setExpanded] = useState(false);
  const tooltipRef = useRef(null);
  const noteRef = useRef(null);

  const f = getF(line);
  const s = getS(line);

  let title = line.title || line.category || 'Service';

  // HÔTEL
  if (isHotel(line)) {
    // Pour les hôtels du catalogue, utiliser les données de raw_json
    const isCatalogHotel = !!(line?.raw_json?.catalog_id && line?.category === "Hotel");
    
    let room, company, stars;
    if (isCatalogHotel) {
      // Hôtel du catalogue : utiliser raw_json
      room = line.raw_json.room_type || '';
      company = line.raw_json.hotel_name || line.provider_name || line.supplier_name || '';
      stars = normStars(line.raw_json.hotel_stars || '');
    } else {
      // Hôtel classique : logique existante
      room = f.room_name || s['Room Name'] || inferRoom(line.title);
      company = line.provider_name || s['Company'] || line.supplier_name || '';
      stars = normStars(f.hotel_stars || s['Hotel Stars']);
    }
    
    // Prefer explicit user choice saved in raw_json.breakfast over inferred fields
    const bfFromJson = (line?.raw_json?.breakfast === true) ? 'breakfast & VAT included'
                      : (line?.raw_json?.breakfast === false) ? 'VAT included'
                      : null;
    const bf = bfFromJson ?? (normYes(f.meal_1 || s['Meal 1']) ? 'breakfast & VAT included' : 'VAT included');
    const eci = line?.raw_json?.early_check_in ? ', early check-in guaranteed' : '';
    title = `${room}${eci}, ${bf} at ${company}${stars}`;
  } else if (!isTransfer(line)) {
    // ACTIVITÉ
    // Check if it's a catalog activity
    const isCatalogActivity = !!(line?.raw_json?.catalog_id && line?.category === "Activity");
    
    if (isCatalogActivity) {
      // For catalog activities: "Titre at (start_time)" if start_time exists
      const startTime = line.raw_json?.start_time || '';
      // Vérifier que startTime n'est pas vide après trim
      if (startTime && String(startTime).trim() !== '') {
        // Nettoyer le start_time en supprimant "am"/"pm" s'ils sont présents
        const cleanedTime = String(startTime).trim().replace(/\s*(am|pm)\s*$/i, '');
        title = `${title} at ${fmtAMPM(cleanedTime)}`;
      }
      // Duration will be set in subtitle below
      // Description will be set in note below
    } else {
      // Regular activity: existing logic
      const st = f.start_time || s['Start Time'];
      if (st) title = `${title} at ${st}`;
    }
  }

  // DESCRIPTION + URL
  // For catalog hotels, prefer raw_json.description (user-edited) over fields
  const isCatalogHotel = !!(line?.raw_json?.catalog_id && line?.category === "Hotel");
  const isCatalogActivity = !!(line?.raw_json?.catalog_id && line?.category === "Activity");
  // For catalog activities, description is handled in note (via switch case), so don't use fullDesc
  const fullDesc = isHotel(line) && (line?.raw_json?.source === 'catalog' || isCatalogHotel) && line?.raw_json?.description
    ? line.raw_json.description
    : (!isCatalogActivity ? (f.full_description || s['Full Description'] || '') : '');
  // Pour les hôtels du catalogue, utiliser raw_json.hotel_url
  const hotelUrl = isCatalogHotel 
    ? (line.raw_json.hotel_url || '')
    : (f.hotel_url || s['Hotel URL'] || f.website || s['Website'] || '');

  // TEXT LINK for hotel URL
  const hotelUrlText = (hotelUrl || '').trim();

  // Badge catégorie masqué pour le catalogue et pour Trip info, Internal info, Cost, Train, Flight, Ferry, Car Rental, New Hotel, New Service
  const showChip = !isCatalog(line) && !!line.category && 
                   category !== "Trip info" && 
                   category !== "Internal info" && 
                   category !== "Cost" &&
                   category !== "Train" &&
                   category !== "Flight" &&
                   category !== "Ferry" &&
                   category !== "Car Rental" &&
                   category !== "New Hotel" &&
                   category !== "New Service";
  
  // Legacy compatibility for chips section
  const isActivity = !isHotel(line) && !isTransfer(line) && (line?.category && ["Small Group","Private","Private Chauffeur","Tickets"].includes(line.category));
  const looksHotel = !!(f.hotel_stars || f.hotel_check_in_time || f.hotel_check_out_time || f.hotel_url);

  switch(category){
    case "Trip info": {
      const s = data;
      title = s?.title || "Trip info";
      subtitle = "";
      note = s?.body || "";
      break;
    }
    case "Internal info": {
      title = "Internal info";
      subtitle = "";
      note = data?.body || "";
      isInternal = true; // assure l'application du style fond clair + badge
      break;
    }
    case "Cost": {
      const c = data; // {title, body}
      title = c?.title || "Internal cost";
      subtitle = ""; // rien sous le titre
      // note visible sous le titre (avant la grille de prix)
      note = c?.body || "";
      inlineBadges.push(<span key="internal" className="internal-badge">Internal only</span>);
      break;
    }
    case "Flight": {
      // Back-compat: legacy boolean seat_res or with_seats
      let suffix = "";
      const choice = data?.seat_res_opt;
      if (choice === "with") {
        suffix = " with seat reservations";
      } else if (data?.seat_res === true || data?.with_seats === true) {
        suffix = " with seat reservations";
      }
      const cls = data?.class_of_service ? `${data.class_of_service} ` : "";
      const airline = data?.airline || "Airline";
      title = formatOrdinals(`${cls}${airline} flight from ${data?.from||"?"} to ${data?.to||"?"}${suffix}`);
      subtitle = `Departure at ${fmtAMPM(data?.dep_time)}; arrival at ${fmtAMPM(data?.arr_time)} – Schedule subject to change`;
      note = data?.note || "";
      break;
    }
    case "Train": {
      // Afficher "train" en minuscule après le class_type
      const classType = data?.class_type || "First Class";
      const base = `${classType} train from ${data?.from||"?"} to ${data?.to||"?"}`;
      // Back-compat: legacy boolean seat_res
      let suffix = "";
      const choice = data?.seat_res_choice;
      if (choice === "with")        suffix = " with seat reservations";
      else if (choice === "without") suffix = " without seat reservations (open seating)";
      else if (choice === "none")    suffix = "";
      else if (data?.seat_res === true)  suffix = " with seat reservations";
      else if (data?.seat_res === false) suffix = " without seat reservations (open seating)";
      title = formatOrdinals(base + suffix);
      subtitle = `Departure at ${fmtAMPM(data?.dep_time)}; arrival at ${fmtAMPM(data?.arr_time)} – Schedule subject to change`;
      note = data?.note || "";
      break;
    }
    case "Ferry": {
      const cls = data?.class_type ? `${data.class_type} ` : "";
      // Back-compat: legacy boolean seat_res
      let suffix = "";
      const choice = data?.seat_res_choice;
      if (choice === "with")        suffix = " with seat reservations";
      else if (choice === "without") suffix = " without seat reservations (open seating)";
      else if (choice === "none")    suffix = "";
      else if (data?.seat_res === true)  suffix = " with seat reservations";
      else if (data?.seat_res === false) suffix = " without seat reservations (open seating)";
      title = formatOrdinals(`${cls}Ferry from ${data?.from||"?"} to ${data?.to||"?"}${suffix}`);
      subtitle = `Departure ${fmtAMPM(data?.dep_time)}; Arrival ${fmtAMPM(data?.arr_time)} – Schedule subject to change`;
      note = data?.note || "";
      break;
    }
    case "New Hotel": {
      const h = data;
      // Étoiles
      const starCount = Number(h?.stars);
      const stars =
        h?.stars && h.stars !== "NA"
          ? " " + "★".repeat(Math.min(5, isNaN(starCount) ? 0 : starCount))
          : "";
      // Bloc room - afficher juste le room_type sans le "1"
      const room = h?.room_type || null;
      // Options
      const opts = [];
      if (h?.early_checkin) opts.push("early check-in guaranteed");
      opts.push(h?.breakfast ? "breakfast & VAT taxes included" : "VAT taxes included");
      // Titre final
      title = [room, opts.join(", "), `at ${h?.hotel_name || "Hotel"}${stars}`]
        .filter(Boolean)
        .join(", ");
      subtitle = "";
      // Prefer description from raw_json when present
      note = line?.raw_json?.description || h?.description || "";
      break;
    }
    case "Activity": {
      // Check if it's a catalog activity
      const isCatalogActivity = !!(line?.raw_json?.catalog_id);
      if (isCatalogActivity) {
        // For catalog activities: title already set above with "at (start_time)" if applicable
        // Duration in subtitle
        const duration = line.raw_json?.duration || '';
        if (duration && String(duration).trim() !== "") {
          subtitle = `Duration: ${prettyDur(duration)}`;
        }
        // Description in note
        note = line.raw_json?.description || '';
      } else {
        // Regular activity: use existing logic
        const s = data || {};
        title = (s.title || "Activity") + (s.start_time ? ` at ${fmtAMPM(s.start_time)}` : "");
        const mins = minsBetween24(s.start_time, s.end_time);
        let durationLine = "";
        if (mins && mins > 0) durationLine = `Duration: ${humanDur(mins)}`;
        else if (mins === -1) durationLine = "⚠ End time before start time";
        else if (s.duration && String(s.duration).trim()!=="") {
          durationLine = `Duration: ${prettyDur(s.duration)}`;
        }
        subtitle = [durationLine, s.description || ""].filter(Boolean).join("\n");
        note = "";
      }
      break;
    }
    case "New Service": {
      const s = data || {};
      title = (s.title || "Service") + (s.start_time ? ` at ${fmtAMPM(s.start_time)}` : "");
      const mins = minsBetween24(s.start_time, s.end_time);
      let durationLine = "";
      if (mins && mins > 0) durationLine = `Duration: ${humanDur(mins)}`;
      else if (mins === -1) durationLine = "⚠ End time before start time";
      else if (s.duration && String(s.duration).trim()!=="") {
        durationLine = `Duration: ${prettyDur(s.duration)}`;
      }
      subtitle = [durationLine, s.description || ""].filter(Boolean).join("\n");
      note = "";
      break;
    }
    case "Car Rental": {
      const l = data;
      const loc = l?.pickup_loc || "?";
      const atAir = l?.pickup_airport ? " " + l.pickup_airport : "";
      const vehicle = l?.vehicle_type || "";
      const tx = (l?.transmission && l.transmission !== "Do not precise")
        ? `${l.transmission.toLowerCase()}, `
        : "";
      const mileage = l?.mileage || "";
      const ins = l?.insurance || "";
      title = `Pick up car in ${loc}${atAir}, ${vehicle} ${tx}${mileage} ${ins}`.replace(/\s+/g," ").trim();

      const feeLine = (l?.one_way_fee && Number(l.one_way_fee) > 0)
        ? `Estimate One Way Fee: $${Number(l.one_way_fee).toFixed(0)} – to be paid locally`
        : "";

      // description juste avant la licence
      const desc = l?.description ? l.description : "";
      const additionalItemsLine = l?.additional_items_paid_on_site
        ? `<em>Items such as additional insurance, GPS devices, child seats, and additional insurance must be paid for on site.</em>`
        : "";
      const licenceLine = l?.intl_driver_license
        ? `An international driver's license is mandatory to pick up the car. A physical hard copy is required, as digital copies are not accepted locally. Please note that it may take up to 15 days to obtain the license.`
        : "";

      subtitle = ""; // non utilisé
      note = [feeLine, desc, additionalItemsLine, licenceLine].filter(Boolean).join("\n\n");
      break;
    }
  }

  const internal = category==="Internal info" || category==="Cost" || isInternal;
  const isInternalOnly = category==="Internal info";
  const wrapperCls = `service-card ${internal ? "internal" : ""} ${category==="Trip info" ? "tripinfo":""}`;
  // Prefer internal_note from raw_json when present (for catalog hotels)
  const internalNote = line?.raw_json?.internal_note || (data && (data.internal_note || data.internalNote)) || line.internal_note || "";

  // S'assurer que les liens dans les notes internes s'ouvrent dans un nouvel onglet
  useEffect(() => {
    const updateLinks = (container) => {
      if (container) {
        const links = container.querySelectorAll("a");
        links.forEach(link => {
          if (!link.target) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          }
        });
      }
    };
    
    updateLinks(tooltipRef.current);
    updateLinks(noteRef.current);
  }, [internalNote, note]);

  const meta = [];
  if (category !== "Cost" && category !== "Trip info" && category !== "Internal info") {
    if (data?.amount != null && data.amount !== "")
      meta.push(`Amount: $${Number(data.amount||0).toFixed(2)}`);
    if (data?.currency)
      meta.push(`Currency: ${String(data.currency).toUpperCase()}`);
  }

  return (
    <div 
      className={`${wrapperCls} ${onDragStart ? 'draggable-card' : ''}`}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
    >
      <div className="svc-body">
        {/* Head row */}
        {title ? (
          <div className="service-head">
            <div className="service-title">
              {title}
              {showChip && <span className="chip">{category}</span>}
              {internalNote ? (
                <span className="svc-note-tip" tabIndex={0} aria-haspopup="dialog" aria-expanded="false" aria-label="Show internal note">
                  <Icon name="info" className="svc-note-icon" />
                  <span 
                    ref={tooltipRef}
                    className="svc-note-tooltip svc-internal-note-rich" 
                    role="tooltip"
                    dangerouslySetInnerHTML={{ __html: internalNote }}
                  />
                </span>
              ) : null}
              {inlineBadges?.length ? <span className="title-badges">{inlineBadges}</span> : null}
              {isInternal && <span className="badge-internal">INTERNAL ONLY</span>}
            </div>
            {showActionIcons && (
              <div 
                className="svc-actions-inline" 
                aria-label="Card actions"
                onMouseDown={(e) => e.stopPropagation()}
                onDragStart={(e) => e.stopPropagation()}
              >
                {/* Order: Edit, Duplicate, Delete */}
                <button 
                  className="icon-vert" 
                  aria-label="Edit" 
                  onClick={onEdit}
                  onMouseDown={(e) => e.stopPropagation()}
                  onDragStart={(e) => e.stopPropagation()}
                >
                  <Icon name="edit" />
                </button>
                <button 
                  className="icon-vert" 
                  aria-label="Duplicate" 
                  onClick={onDuplicate}
                  onMouseDown={(e) => e.stopPropagation()}
                  onDragStart={(e) => e.stopPropagation()}
                >
                  <Icon name="duplicate" />
                </button>
                <button 
                  className="icon-vert" 
                  aria-label="Delete" 
                  onClick={onDelete}
                  onMouseDown={(e) => e.stopPropagation()}
                  onDragStart={(e) => e.stopPropagation()}
                >
                  <Icon name="delete" />
                </button>
              </div>
            )}
          </div>
        ) : null}
        {/* For internal info, show body directly */}
        {category === "Internal info" ? (
          <>
            {note && (
              <div 
                ref={noteRef}
                className="service-note svc-internal-note svc-internal-note-rich"
                dangerouslySetInnerHTML={{ __html: note }}
              />
            )}
          </>
        ) : (
          <>
            {subtitle && showDescriptions ? (
              <div className="service-subtitle" style={{ whiteSpace: "pre-line" }}>
                {subtitle}
              </div>
            ) : null}
            {showMore && (
              <button className="show-more-btn" onClick={() => setExpanded(!expanded)}>
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
            {note && showDescriptions && (
              <div 
                className="service-note"
                dangerouslySetInnerHTML={category === "Car Rental" ? { __html: note } : undefined}
              >
                {category !== "Car Rental" ? note : null}
              </div>
            )}
            {category === "New Hotel" && data?.hotel_url?.trim() && showDescriptions && (
              <div className="svc-hotel-link">
                <a
                  href={normalizeUrl(data.hotel_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="svc-link"
                  aria-label="Open hotel website"
                >
                  {displayUrl(data.hotel_url)}
                </a>
              </div>
            )}
          </>
        )}
        {meta.length > 0 && (
          <div className="svc-meta">
            {meta.map((m,i)=><div key={i} className="meta-row">{m}</div>)}
          </div>
        )}
        {shouldShowSupplier(line) && (
          <div className="supplier">{line.supplier_name}</div>
        )}
        {/* Description */}
        {fullDesc && showDescriptions ? <p className="desc">{fullDesc}</p> : null}
        {/* Hotel: plain URL text, no pills */}
        {isHotel(line) && hotelUrlText && showDescriptions ? (
          <div className="hotel-url">
            <a href={hotelUrlText} target="_blank" rel="noreferrer">{hotelUrlText}</a>
          </div>
        ) : null}
        {/* NON-hotel: keep existing pills */}
        {!isHotel(line) && (isActivity || looksHotel) ? (
          <div className="meta chips" style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
            {isActivity && (
              <>
                {isNonEmpty(f.activity_duration) && <span className="chip">⏱ {f.activity_duration}</span>}
                {isNonEmpty(f.activity_meeting_point) && <span className="chip">📍 {clamp(f.activity_meeting_point, 100)}</span>}
                {isNonEmpty(f.start_time) && <span className="chip">🕒 {f.start_time}</span>}
              </>
            )}
            {looksHotel && (
              <>
                {isNonEmpty(f.hotel_stars) && <span className="chip">{String(f.hotel_stars).trim()}★</span>}
                {isNonEmpty(f.hotel_check_in_time) && <span className="chip">Check-in {f.hotel_check_in_time}</span>}
                {isNonEmpty(f.hotel_check_out_time) && <span className="chip">Check-out {f.hotel_check_out_time}</span>}
                {isNonEmpty(f.hotel_url) && showDescriptions && (
                  <a className="chip" href={f.hotel_url} target="_blank" rel="noreferrer">Website ↗</a>
                )}
                {breakfastIncluded(f.meal_1) && <span className="chip">Breakfast included</span>}
              </>
            )}
          </div>
        ) : null}
        {/* Price inputs are now handled uniformly in QuoteEditor for all paying services */}
      </div>
    </div>
  );
}

