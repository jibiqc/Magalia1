import React, { useState } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";

export default function NewServiceModal({
  open = true,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [category_label, setCategoryLabel] = useState(initialData?.category_label || "");
  const [start_time, setStartTime] = useState(initialData?.start_time || "");
  const [duration, setDuration] = useState(initialData?.duration || "");
  const [price_amount, setPriceAmount] = useState(initialData?.price_amount || "");
  const [currency, setCurrency] = useState(initialData?.currency || "");

  if (!open) return null;

  const handleSubmit = () => {
    onSubmit({ title, description, category_label, start_time, duration, price_amount, currency });
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
          New Service
        </div>

        <div className="dest-modal-body" style={{ padding: 0 }}>
          <div className="field">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder=""
              rows={4}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div className="field">
            <label>Category</label>
            <select
              value={category_label}
              onChange={(e) => setCategoryLabel(e.target.value)}
            >
              <option value="">Select category</option>
              <option value="Small Group">Small Group</option>
              <option value="Private">Private</option>
              <option value="Tickets">Tickets</option>
              <option value="Private Chauffeur">Private Chauffeur</option>
              <option value="Private Transport">Private Transport</option>
              <option value="Restaurant Reservation">Restaurant Reservation</option>
            </select>
          </div>

          <div className="field">
            <label>Start time (HH:mm)</label>
            <input
              type="time"
              value={start_time}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Duration</label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder=""
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

