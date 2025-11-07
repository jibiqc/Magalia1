import { fmtAMPM } from "../utils/timeFmt";

export default function ServiceCard({ line, onEdit, onDelete }) {
  const { category } = line;
  // For backend lines, data might be in line directly; for local lines, it's in line.data
  const data = line.data || line;
  // Build a compact, read-only summary per category
  let title = category, subtitle = "", note = "";

  switch(category){
    case "Trip info":
      title = data?.title || "Trip info";
      subtitle = (data?.body || "").slice(0,120);
      break;
    case "Internal info":
      title = "Internal only";
      subtitle = (data?.body || "").slice(0,140);
      break;
    case "Cost":
      title = data?.title || "Cost";
      subtitle = data?.amount ? `$${data.amount}` : "";
      note = (data?.body || "");
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
      <div className="service-head">
        <div className="service-title">{title}</div>
        <div className="service-actions">
          <button aria-label="Edit" className="icon-btn" onClick={onEdit}>✎</button>
          <button aria-label="Delete" className="icon-btn" onClick={onDelete}>🗑</button>
        </div>
      </div>
      {subtitle && <div className="service-sub">{subtitle}</div>}
      {note && <div className="service-note">{note}</div>}
      {internal && <div className="badge-internal">Internal only</div>}
    </div>
  );
}

