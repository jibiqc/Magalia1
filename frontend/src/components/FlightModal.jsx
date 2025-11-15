import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";
import TimeAmPmField from "./TimeAmPmField";

export default function FlightModal({
  open = true,
  onClose,
  onSubmit,
  initialData = null,
}) {
  // Initialiser avec des valeurs par défaut, pas avec initialData (pour éviter les duplications)
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [airline, setAirline] = useState("");
  const [class_of_service, setClassOfService] = useState("");
  const [dep_time, setDepTime] = useState("");
  const [arr_time, setArrTime] = useState("");
  const [description, setDescription] = useState("");
  const [internal_note, setInternalNote] = useState("");
  // Seat reservation radio: "with" | "none" (default: with)
  const [seat_res_opt, setSeatResOpt] = useState("with");

  // Mettre à jour l'état quand initialData change ou quand le modal s'ouvre (pour l'édition)
  useEffect(() => {
    if (open) {
      if (initialData) {
        setFrom(initialData.from || "");
        setTo(initialData.to || "");
        setAirline(initialData.airline || "");
        setClassOfService(initialData.class_of_service || "");
        setDepTime(initialData.dep_time || "");
        setArrTime(initialData.arr_time || "");
        setDescription(initialData.note || initialData.description || "");
        setInternalNote(initialData.internal_note || "");
        const seatOpt = initialData.seat_res_opt ?? (initialData.with_seats ? "with" : "none") ?? "with";
        setSeatResOpt(seatOpt);
      } else {
        setFrom("");
        setTo("");
        setAirline("");
        setClassOfService("");
        setDepTime("");
        setArrTime("");
        setDescription("");
        setInternalNote("");
        setSeatResOpt("with");
      }
    }
  }, [initialData, open]);

  if (!open) return null;

  const handleSubmit = () => {
    onSubmit({
      from, to, airline, class_of_service, dep_time, arr_time,
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

        {/* Route information */}
        <div className="modal-section">
          <div className="modal-section-header">Route</div>
          <div className="grid-2">
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
          </div>
        </div>

        {/* Flight details */}
        <div className="modal-section">
          <div className="modal-section-header">Flight details</div>
          <div className="grid-2">
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
            <div className="field">
              <label>Class of service</label>
              <input
                type="text"
                className="input"
                value={class_of_service}
                onChange={(e) => setClassOfService(e.target.value)}
                placeholder="e.g., Business, Economy, 1st, 2nd"
              />
            </div>
          </div>
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
        </div>

        {/* Times */}
        <div className="modal-section">
          <div className="modal-section-header">Schedule</div>
          <div className="time-row">
            <TimeAmPmField label="Departure time" value24={dep_time} onChange={setDepTime} />
            <TimeAmPmField label="Arrival time" value24={arr_time} onChange={setArrTime} />
          </div>
          <div className="time-help">Enter time in AM/PM. Typing 13:30 will auto-convert to 1:30 PM.</div>
        </div>

        {/* Description */}
        <div className="modal-section">
          <div className="modal-section-header">Description</div>
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
        </div>

        {/* Internal note */}
        <div className="modal-section">
          <div className="modal-section-header">Internal note</div>
          <div className="field">
            <label>Internal note</label>
            <textarea
              className="textarea"
              value={internal_note}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder=""
              rows={3}
            />
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

