import React, { useState } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";

export default function HotelModal({
  open = true,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const [hotel_name, setHotelName] = useState(initialData?.hotel_name || "");
  const [stars, setStars] = useState(initialData?.stars || "");
  const [room_type, setRoomType] = useState(initialData?.room_type || "");
  const [breakfast, setBreakfast] = useState(initialData?.breakfast || false);
  const [hotel_url, setHotelUrl] = useState(initialData?.hotel_url || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [price_amount, setPriceAmount] = useState(initialData?.price_amount || "");
  const [currency, setCurrency] = useState(initialData?.currency || "");

  if (!open) return null;

  const handleSubmit = () => {
    onSubmit({ hotel_name, stars, room_type, breakfast, hotel_url, description, price_amount, currency });
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
          Hotel
        </div>

        <div className="dest-modal-body" style={{ padding: 0 }}>
          <div className="field">
            <label>Hotel name</label>
            <input
              type="text"
              value={hotel_name}
              onChange={(e) => setHotelName(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>Stars (0-5)</label>
            <input
              type="number"
              min="0"
              max="5"
              value={stars}
              onChange={(e) => setStars(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>Room type</label>
            <input
              type="text"
              value={room_type}
              onChange={(e) => setRoomType(e.target.value)}
              placeholder="e.g., 1 suite, 2 double rooms"
            />
          </div>

          <div className="field">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={breakfast}
                onChange={(e) => setBreakfast(e.target.checked)}
              />
              <span>Breakfast</span>
            </label>
          </div>

          <div className="field">
            <label>Hotel URL</label>
            <input
              type="url"
              value={hotel_url}
              onChange={(e) => setHotelUrl(e.target.value)}
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
            <button
              type="button"
              className="btn secondary"
              style={{ opacity: 0.5, cursor: "not-allowed" }}
              disabled
            >
              Fetch hotel details
            </button>
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

