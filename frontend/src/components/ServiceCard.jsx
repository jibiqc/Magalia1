import React, { useState } from "react";
import { fmtAMPM } from "../utils/timeFmt";
import PriceGrid from "./PriceGrid";

// Helper to print duration as "3hrs 30mins"
const humanDur = (d) => {
  if (!d) return "";
  const m = /(\d+)h(?:(\d{1,2}))?/.exec(d.trim());
  if (!m) return d;
  const H = parseInt(m[1]), M = parseInt(m[2]||"0");
  return `Duration: ${H}hrs${M ? ` ${M}mins` : ""}`;
};

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

export default function ServiceCard({ line, onEdit, onDelete, onDuplicate, onChangeLocalData }) {
  const { category } = line;
  // For backend lines, data might be in line directly; for local lines, it's in line.data
  const data = line.data || line;
  // Build a compact, read-only summary per category
  let title = category, subtitle = "", note = "", showMore = false;
  const [expanded, setExpanded] = useState(false);

  switch(category){
    case "Trip info":
      title = data?.title || "Trip info";
      const bodyText = data?.body || "";
      subtitle = expanded ? bodyText : bodyText.slice(0, 80);
      showMore = bodyText.length > 80;
      break;
    case "Internal info":
      title = ""; // no title
      subtitle = ""; // none
      // body in data.body
      note = data?.body || "";
      break;
    case "Cost":
      title = data?.title || "Cost";
      subtitle = "";
      note = data?.body || "";
      break;
    case "Flight":
      title = `${data?.airline||"Airline"} flight from ${data?.from||"?"} to ${data?.to||"?"}`;
      subtitle = `Departure at ${fmtAMPM(data?.dep_time)}; arrival at ${fmtAMPM(data?.arr_time)} – Schedule subject to change`;
      note = data?.note || "";
      break;
    case "Train": {
      const withSeats = data?.seat_res ? " with seat reservations" : "";
      title = `${data?.class_type || "First Class Train"} from ${data?.from||"?"} to ${data?.to||"?"}${withSeats}`;
      subtitle = `Departure at ${fmtAMPM(data?.dep_time)}; arrival at ${fmtAMPM(data?.arr_time)} – Schedule subject to change`;
      note = data?.note || "";
      break;
    }
    case "Ferry":
      title = `Ferry from ${data?.from||"?"} to ${data?.to||"?"}`;
      subtitle = `Departure ${fmtAMPM(data?.dep_time)}; Arrival ${fmtAMPM(data?.arr_time)} – Schedule subject to change`;
      note = data?.note || "";
      break;
    case "New Hotel": {
      const h = data;
      const stars = h?.stars && h.stars !== "NA" ? " " + "★".repeat(Math.min(5, Number(h.stars))) : " ****";
      // Head line in bold color
      title = `${h?.room_type || ""}${h?.breakfast ? ", breakfast & VAT taxes included" : ", VAT taxes included"} at ${h?.hotel_name || "Hotel"}${stars}`;
      // Body long description (URL shown separately as link)
      subtitle = "";
      note = h?.description || "";
      break;
    }
    case "New Service": {
      const s = data;
      title = s?.title || "Service";
      const at = s?.start_time ? ` at ${fmtAMPM(s.start_time)}` : "";
      const line2 = humanDur(s?.duration);
      subtitle = [ (s?.start_time && s?.title) ? `${s.title}${at}` : "", line2 ].filter(Boolean).join("\n");
      note = s?.description || "";
      break;
    }
    case "Car Rental": {
      const l = data;
      // Line 1
      title = `Pick up car in ${l?.pickup_loc || "?"}${l?.pickup_airport ? " " + l.pickup_airport : ""}, ${l?.vehicle_type || ""}${l?.transmission ? ` ${l.transmission.toLowerCase()}` : ""} ${l?.mileage || ""} ${l?.insurance || ""}`.replace(/\s+/g," ").trim();

      // One-way fee line if present
      const feeLine = (l?.one_way_fee && Number(l.one_way_fee) > 0)
        ? `Estimate One Way Fee: $${Number(l.one_way_fee).toFixed(0)} – to be paid locally`
        : "";

      // Licence paragraph if checked
      const licenceLine = l?.intl_driver_license
        ? `An international driver's license is mandatory to pick up the car. A physical hard copy is required, as digital copies are not accepted locally. Please note that it may take up to 15 days to obtain the license.`
        : "";

      subtitle = ""; // not used
      note = [feeLine, licenceLine].filter(Boolean).join("\n\n");
      break;
    }
  }

  const internal = category==="Internal info" || category==="Cost";
  const isInternalOnly = category==="Internal info";
  const wrapperCls = `service-card ${internal ? "internal" : ""} ${category==="Trip info" ? "tripinfo":""}`;

  return (
    <div className={wrapperCls}>
      <div className="svc-actions-col">
        <button className="icon-vert" aria-label="Edit" onClick={onEdit}>✎</button>
        <button className="icon-vert" aria-label="Duplicate" onClick={onDuplicate}>⧉</button>
        <button className="icon-vert drag-handle" aria-label="Move" data-drag-handle="true">↕</button>
        <button className="icon-vert" aria-label="Delete" onClick={onDelete}>🗑</button>
      </div>
      <div className="svc-body">
        {/* Head row */}
        {title ? (
          <div className="service-head">
            <div className="service-title">{title}</div>
          </div>
        ) : null}
        {/* For internal info, show body directly */}
        {category === "Internal info" ? (
          <>
            {note && <div className="service-note svc-internal-note">{note}</div>}
            <div className="badge-internal">Internal only</div>
          </>
        ) : (
          <>
            {subtitle && <div className="service-sub">{subtitle}</div>}
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
        {category === "Cost" && (
          <div className="price-grid">
            <div className="price-row">
              <span className="price-label">Amount:</span>
              <span className="price-value">{data?.amount ? `$${data.amount}` : "$0.00"}</span>
            </div>
            <div className="price-row">
              <span className="price-label">Currency:</span>
              <span className="price-value">{data?.currency || "USD"}</span>
            </div>
          </div>
        )}
        {category === "Cost" && <div className="badge-internal">Internal only</div>}
        {category !== "Trip info" && category !== "Internal info" && (
          <PriceGrid
            value={data?.pricing}
            onChange={(p)=>{
              // persist into localLines
              if (onChangeLocalData) {
                onChangeLocalData({ ...data, pricing: p });
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

