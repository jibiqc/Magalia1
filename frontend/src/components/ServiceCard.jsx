import React, { useState } from "react";
import { fmtAMPM } from "../utils/timeFmt";

export default function ServiceCard({ line, onEdit, onDelete, onDuplicate }) {
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
      title = "Internal only";
      const internalBody = data?.body || "";
      subtitle = expanded ? internalBody : internalBody.slice(0, 80);
      showMore = internalBody.length > 80;
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
    case "Train":
      title = `${data?.class_type||"First Class Train"} from ${data?.from||"?"} to ${data?.to||"?"}${data?.seat_res ? " with seat reservations":""}`;
      subtitle = `Departure at ${fmtAMPM(data?.dep_time)}; arrival at ${fmtAMPM(data?.arr_time)} – Schedule subject to change`;
      note = data?.note || "";
      break;
    case "Ferry":
      title = `Ferry from ${data?.from||"?"} to ${data?.to||"?"}`;
      subtitle = `Departure ${fmtAMPM(data?.dep_time)}; Arrival ${fmtAMPM(data?.arr_time)} – Schedule subject to change`;
      note = data?.note || "";
      break;
    case "New Hotel":
      title = `${data?.hotel_name||"Hotel"}${data?.stars ? " " + "★".repeat(Math.min(5, Number(data.stars))) : ""}`;
      subtitle = data?.room_type ? (data?.breakfast ? `${data.room_type}, breakfast & VAT taxes included` : `${data.room_type}, VAT taxes included`) : "";
      note = data?.description || "";
      break;
    case "New Service":
      title = data?.title || "Service";
      subtitle = (data?.description||"").slice(0,120);
      break;
    case "Car Rental":
      title = `Pick up ${data?.pickup_loc||"?"} (${data?.pickup_date||""} ${fmtAMPM(data?.pickup_time)}) → Drop off ${data?.dropoff_loc||"?"} (${data?.dropoff_date||""} ${fmtAMPM(data?.dropoff_time)})`;
      subtitle = `${data?.vehicle_type||"Vehicle"} • ${data?.transmission||"Automatic"}${data?.one_way_fee ? ` • One-way fee $${data.one_way_fee}`:""}${data?.mileage ? ` • ${data.mileage}`:""}${data?.insurance ? ` • ${data.insurance}`:""}`;
      break;
  }

  const internal = category==="Internal info" || category==="Cost";

  return (
    <div className={`service-card ${internal ? "internal" : ""}`}>
      <div className="svc-actions-col">
        <button className="icon-vert" aria-label="Edit" onClick={onEdit}>✎</button>
        <button className="icon-vert" aria-label="Duplicate" onClick={onDuplicate}>⧉</button>
        <button className="icon-vert drag-handle" aria-label="Move" data-drag-handle="true">↕</button>
        <button className="icon-vert" aria-label="Delete" onClick={onDelete}>🗑</button>
      </div>
      <div className="svc-body">
        <div className="service-head">
          <div className="service-title">{title}</div>
        </div>
        {subtitle && <div className="service-sub">{subtitle}</div>}
        {showMore && (
          <button className="show-more-btn" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
        {note && <div className="service-note">{note}</div>}
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
        {internal && <div className="badge-internal">Internal only</div>}
      </div>
    </div>
  );
}

