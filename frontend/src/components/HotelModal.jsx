import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";

export default function HotelModal({
  open = true,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const [hotel_name, setHotelName] = useState(initialData?.hotel_name || "");
  const [stars, setStars] = useState(initialData?.stars || "4");
  const [room_type, setRoomType] = useState(initialData?.room_type || "");
  const [breakfast, setBreakfast] = useState(initialData?.breakfast !== undefined ? initialData.breakfast : true);
  const [hotel_url, setHotelUrl] = useState(initialData?.hotel_url || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [internal_note, setInternalNote] = useState(initialData?.internal_note || "");

  // Mettre à jour l'état quand initialData change ou quand le modal s'ouvre (pour l'édition)
  useEffect(() => {
    if (open) {
      if (initialData) {
        setHotelName(initialData.hotel_name || "");
        setStars(initialData.stars || "4");
        setRoomType(initialData.room_type || "");
        setBreakfast(initialData.breakfast !== undefined ? initialData.breakfast : true);
        setHotelUrl(initialData.hotel_url || "");
        setDescription(initialData.description || "");
        setInternalNote(initialData.internal_note || "");
      } else {
        setHotelName("");
        setStars("4");
        setRoomType("");
        setBreakfast(true);
        setHotelUrl("");
        setDescription("");
        setInternalNote("");
      }
    }
  }, [initialData, open]);

  if (!open) return null;

  const handleSubmit = () => {
    onSubmit({ hotel_name, stars, room_type, breakfast, hotel_url, description, internal_note });
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
        <div className="modal-title">Hotel</div>

        {/* Hotel information */}
        <div className="modal-section">
          <div className="modal-section-header">Hotel information</div>
          <div className="field">
            <label>Hotel name</label>
            <input
              type="text"
              className="input"
              value={hotel_name}
              onChange={(e) => setHotelName(e.target.value)}
              placeholder=""
            />
          </div>
          <div className="field">
            <label>Stars</label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
              {["NA", "1", "2", "3", "4", "5"].map((val) => (
                <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="stars"
                    value={val}
                    checked={stars === val}
                    onChange={(e) => setStars(e.target.value)}
                  />
                  <span>{val === "NA" ? "N/A" : val + "★"}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Hotel URL</label>
            <input
              type="url"
              className="input"
              value={hotel_url}
              onChange={(e) => setHotelUrl(e.target.value)}
              placeholder=""
            />
          </div>
        </div>

        {/* Room details */}
        <div className="modal-section">
          <div className="modal-section-header">Room details</div>
          <div className="field">
            <label>Room type</label>
            <input
              type="text"
              className="input"
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
              rows={4}
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

