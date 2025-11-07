import React, { useState } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";

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
  const [note, setNote] = useState(initialData?.note || "");
  const [price_amount, setPriceAmount] = useState(initialData?.price_amount || "");
  const [currency, setCurrency] = useState(initialData?.currency || "");
  const [internal_note, setInternalNote] = useState(initialData?.internal_note || "");

  if (!open) return null;

  const handleSubmit = () => {
    onSubmit({ from, to, airline, dep_time, arr_time, note, price_amount, currency, internal_note });
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
        className="dest-modal-card"
        style={{
          width: 420,
          maxWidth: "92vw",
          background: "#1b2436",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dest-modal-title" style={{ fontWeight: 700, marginBottom: 16, color: "#e8eefc", fontSize: 18 }}>
          Flight
        </div>

        <div className="dest-modal-body" style={{ padding: 0 }}>
          <div className="field">
            <label>From</label>
            <input
              type="text"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>To</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>Airline</label>
            <input
              type="text"
              value={airline}
              onChange={(e) => setAirline(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>Departure time (HH:mm)</label>
            <input
              type="time"
              value={dep_time}
              onChange={(e) => setDepTime(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Arrival time (HH:mm)</label>
            <input
              type="time"
              value={arr_time}
              onChange={(e) => setArrTime(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder=""
              rows={3}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div className="field">
            <label>Price amount</label>
            <input
              type="number"
              step="0.01"
              value={price_amount}
              onChange={(e) => setPriceAmount(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="">Select currency</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>

          <div className="field">
            <label>Internal note</label>
            <textarea
              value={internal_note}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder=""
              rows={3}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>
        </div>

        <div className="dest-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "16px 0 0", borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 16 }}>
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

