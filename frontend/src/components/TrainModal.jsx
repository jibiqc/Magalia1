import React, { useState } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";

export default function TrainModal({
  open = true,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const [from, setFrom] = useState(initialData?.from || "");
  const [to, setTo] = useState(initialData?.to || "");
  const [class_type, setClassType] = useState(initialData?.class_type || "");
  const [dep_time, setDepTime] = useState(initialData?.dep_time || "");
  const [arr_time, setArrTime] = useState(initialData?.arr_time || "");
  const [seat_res, setSeatRes] = useState(initialData?.seat_res || false);
  const [note, setNote] = useState(initialData?.note || "");
  const [internal_note, setInternalNote] = useState(initialData?.internal_note || "");

  if (!open) return null;

  const handleSubmit = () => {
    onSubmit({ from, to, class_type, dep_time, arr_time, seat_res, note, internal_note });
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
        <div className="modal-title">Train</div>

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
            <label>Class type</label>
            <input
              type="text"
              className="input"
              value={class_type}
              onChange={(e) => setClassType(e.target.value)}
              placeholder="First Class Train"
            />
          </div>

          <div className="field">
            <label>Departure time (HH:mm)</label>
            <input
              type="time"
              className="input"
              value={dep_time}
              onChange={(e) => setDepTime(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Arrival time (HH:mm)</label>
            <input
              type="time"
              className="input"
              value={arr_time}
              onChange={(e) => setArrTime(e.target.value)}
            />
          </div>

          <div className="field">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={seat_res}
                onChange={(e) => setSeatRes(e.target.checked)}
              />
              <span>Seat reservations</span>
            </label>
          </div>

          <div className="field">
            <label>Note</label>
            <textarea
              className="textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder=""
              rows={3}
            />
          </div>

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

