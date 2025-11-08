import React, { useState } from "react";
import { fmtAMPM } from "../utils/timeFmt";

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

export default function ServiceCard({ line, onEdit, onDelete, onDuplicate, onChangeLocalData, onDragFromHandle }) {
  const { category } = line;
  // For backend lines, data might be in line directly; for local lines, it's in line.data
  const data = line.data || line;
  // Build a compact, read-only summary per category
  let title = category, subtitle = "", note = "", showMore = false;
  let isInternal = false;
  const inlineBadges = [];
  const [expanded, setExpanded] = useState(false);

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
      const withSeats = data?.seat_res === true ? " with seat reservations" : "";
      title = `${data?.airline||"Airline"} flight from ${data?.from||"?"} to ${data?.to||"?"}${withSeats}`;
      subtitle = `Departure at ${fmtAMPM(data?.dep_time)}; arrival at ${fmtAMPM(data?.arr_time)} – Schedule subject to change`;
      note = data?.note || "";
      break;
    }
    case "Train": {
      const base = `${data?.class_type || "First Class Train"} from ${data?.from||"?"} to ${data?.to||"?"}`;
      const suffix = (data?.seat_res === false)
        ? " without seat reservations (open seating)"
        : " with seat reservations";
      title = base + suffix;
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
      title = `${cls}Ferry from ${data?.from||"?"} to ${data?.to||"?"}${suffix}`;
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
      // Bloc room
      const room = h?.room_type ? `1 ${h.room_type}` : null;
      // Options
      const opts = [];
      if (h?.early_checkin) opts.push("early check-in guaranteed");
      opts.push(h?.breakfast ? "breakfast & VAT taxes included" : "VAT taxes included");
      // Titre final
      title = [room, opts.join(", "), `at ${h?.hotel_name || "Hotel"}${stars}`]
        .filter(Boolean)
        .join(", ");
      subtitle = "";
      note = h?.description || "";
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
      const licenceLine = l?.intl_driver_license
        ? `An international driver's license is mandatory to pick up the car. A physical hard copy is required, as digital copies are not accepted locally. Please note that it may take up to 15 days to obtain the license.`
        : "";

      subtitle = ""; // non utilisé
      note = [feeLine, desc, licenceLine].filter(Boolean).join("\n\n");
      break;
    }
  }

  const internal = category==="Internal info" || category==="Cost" || isInternal;
  const isInternalOnly = category==="Internal info";
  const wrapperCls = `service-card ${internal ? "internal" : ""} ${category==="Trip info" ? "tripinfo":""}`;
  const internalNote = (data && (data.internal_note || data.internalNote)) || line.internal_note || "";

  const meta = [];
  if (category !== "Cost" && category !== "Trip info" && category !== "Internal info") {
    if (data?.amount != null && data.amount !== "")
      meta.push(`Amount: $${Number(data.amount||0).toFixed(2)}`);
    if (data?.currency)
      meta.push(`Currency: ${String(data.currency).toUpperCase()}`);
  }

  return (
    <div className={wrapperCls}>
      <div className="svc-body">
        {/* Head row */}
        {title ? (
          <div className="service-head">
            <div className="service-title">
              {title}
              {internalNote ? (
                <span className="svc-note-tip" tabIndex={0} aria-haspopup="dialog" aria-expanded="false" aria-label="Show internal note">
                  <Icon name="info" className="svc-note-icon" />
                  <span className="svc-note-tooltip" role="tooltip">{internalNote}</span>
                </span>
              ) : null}
              {inlineBadges?.length ? <span className="title-badges">{inlineBadges}</span> : null}
              {isInternal && <span className="badge-internal">INTERNAL ONLY</span>}
            </div>
            <div className="svc-actions-inline" aria-label="Card actions">
              {/* Order: Edit, Move, Duplicate, Delete */}
              <button className="icon-vert" aria-label="Edit" onClick={onEdit}><Icon name="edit" /></button>
              <button
                className="icon-vert drag-handle"
                aria-label="Move"
                title="Drag to move"
                draggable
                onDragStart={(e)=> onDragFromHandle && onDragFromHandle(e)}
              >
                <Icon name="move" />
              </button>
              <button className="icon-vert" aria-label="Duplicate" onClick={onDuplicate}><Icon name="duplicate" /></button>
              <button className="icon-vert" aria-label="Delete" onClick={onDelete}><Icon name="delete" /></button>
            </div>
          </div>
        ) : null}
        {/* For internal info, show body directly */}
        {category === "Internal info" ? (
          <>
            {note && <div className="service-note svc-internal-note">{note}</div>}
          </>
        ) : (
          <>
            {subtitle ? (
              <div className="service-subtitle" style={{ whiteSpace: "pre-line" }}>
                {subtitle}
              </div>
            ) : null}
            {showMore && (
              <button className="show-more-btn" onClick={() => setExpanded(!expanded)}>
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
            {note && <div className="service-note">{note}</div>}
            {category === "New Hotel" && data?.hotel_url?.trim() && (
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
        {/* Price inputs are now handled uniformly in QuoteEditor for all paying services */}
      </div>
    </div>
  );
}

