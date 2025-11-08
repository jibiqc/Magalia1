import React, { useState } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";
import TimeAmPmField from "./TimeAmPmField";

export default function FlightModal({
  open = true,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const [from, setFrom] = useState(initialData?.from || "");
  const [to, setTo] = useState(initialData?.to || "");
  const [airline, setAirline] = useState(initialData?.airline || "");
  const [dep_time, setDepTime] = useState(initialData?.dep_time || "");
  const [arr_time, setArrTime] = useState(initialData?.arr_time || "");
  const [description, setDescription] = useState(initialData?.note || initialData?.description || "");
  const [internal_note, setInternalNote] = useState(initialData?.internal_note || "");
  // Seat reservation radio: "with" | "none" (default: with)
  const [seat_res_opt, setSeatResOpt] = useState(
    initialData?.seat_res_opt
      ?? (initialData?.with_seats ? "with" : "none")
      ?? "with"
  );

  if (!open) return null;

  const handleSubmit = () => {
    onSubmit({
      from, to, airline, dep_time, arr_time,
      seat_res_opt,                    // persisted choice
      note: description, description, internal_note
    });
  };

  const backdrop = (
    <div
      className="dest-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        background: "rgba(0,0,0,0.30)"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">Flight</div>

        <div className="dest-modal-body" style={{ padding: 0 }}>
          <div className="field">
            <label>From</label>
            <input
              type="text"
              className="input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>To</label>
            <input
              type="text"
              className="input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>Airline</label>
            <input
              type="text"
              className="input"
              value={airline}
              onChange={(e) => setAirline(e.target.value)}
              placeholder=""
            />
          </div>

          {/* Seat reservation (radio pills) */}
          <div className="field">
            <label>Seat reservation</label>
            <div className="seat-radio">
              <button
                type="button"
                className={`seat-pill ${seat_res_opt==="with" ? "active":""}`}
                onClick={()=> setSeatResOpt("with")}
              >With seat reservation</button>
              <button
                type="button"
                className={`seat-pill ${seat_res_opt==="none" ? "active":""}`}
                onClick={()=> setSeatResOpt("none")}
              >Do not precise</button>
            </div>
          </div>

          <div className="time-row">
            <TimeAmPmField label="Departure time" value24={dep_time} onChange={setDepTime} />
            <TimeAmPmField label="Arrival time" value24={arr_time} onChange={setArrTime} />
          </div>
          <div className="time-help">Enter time in AM/PM. Typing 13:30 will auto-convert to 1:30 PM.</div>

          <div className="field">
            <label>Description</label>
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder=""
              rows={3}
            />
          </div>

          <div className="field">
            <label>Internal note</label>
            <textarea
              className="textarea input-internal-note"
              value={internal_note}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder=""
              rows={3}
              maxLength={1000}
              aria-describedby="flight-internalnote-counter"
            />
            <div id="flight-internalnote-counter" className="char-counter">
              {internal_note?.length || 0}/1000
            </div>
          </div>
        </div>

        <div className="actions">
          <button className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleSubmit}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(backdrop, document.body);
}

