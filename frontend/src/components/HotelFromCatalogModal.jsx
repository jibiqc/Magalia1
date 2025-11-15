import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";

export default function HotelFromCatalogModal({ open=true, data, onClose, onSubmit }) {
  // Debug logs
  useEffect(() => {
    console.log('[HotelFromCatalogModal] Props:', { open, data: !!data, hasData: !!data });
  }, [open, data]);
  
  // Controlled fields - must be declared before early return
  const defaults = data?.defaults || {};
  const [roomType, setRoomType] = useState(defaults?.room_type || "");
  const [breakfast, setBreakfast] = useState(!!defaults?.breakfast);
  const [earlyCI, setEarlyCI] = useState(!!defaults?.early_check_in);
  const [checkIn, setCheckIn] = useState(defaults?.check_in_date || "");
  const [checkOut, setCheckOut] = useState(defaults?.check_out_date || "");
  const [description, setDescription] = useState(defaults?.description || "");
  const [internalNote, setInternalNote] = useState(defaults?.internal_note || "");

  // Update state when data changes
  useEffect(() => {
    if (data?.defaults) {
      const d = data.defaults;
      console.log('[HotelFromCatalogModal] Updating state from defaults:', d);
      setRoomType(d.room_type || "");
      setBreakfast(!!d.breakfast);
      setEarlyCI(!!d.early_check_in);
      setCheckIn(d.check_in_date || "");
      setCheckOut(d.check_out_date || "");
      setDescription(d.description || "");
      setInternalNote(d.internal_note || "");
    } else {
      console.log('[HotelFromCatalogModal] No defaults in data:', data);
    }
  }, [data]);

  // Prevent body scroll and interactions when modal is open
  useEffect(() => {
    if (open && data) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [open, data]);

  if (!open || !data) {
    console.log('[HotelFromCatalogModal] Not rendering:', { open, hasData: !!data });
    return null;
  }
  const { svcFull } = data;
  const hotelName = (defaults?.hotel_name || svcFull?.company || svcFull?.supplier?.name || svcFull?.name || "") || "";
  // Parse stars correctly: extract first number and limit to 5
  const starsStr = String(defaults?.hotel_stars || "").trim();
  const starsMatch = starsStr.match(/^(\d+(?:\.\d+)?)/);
  const starsNum = starsMatch ? Math.min(5, Math.max(1, Math.round(parseFloat(starsMatch[1])))) : null;
  const starsText = starsNum ? `${starsNum}*` : "";
  const url = defaults?.hotel_url || "";

  const disableSave = roomType.trim() === "" || !checkIn || !checkOut;

  const handleSave = () => {
    if (disableSave) return;
    onSubmit({
      room_type: roomType.trim(),
      breakfast,
      early_check_in: earlyCI,
      check_in_date: checkIn,
      check_out_date: checkOut,
      description,
      internal_note: internalNote
    });
  };

  return createPortal(
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
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">{hotelName}{starsText && ` ${starsText}`}</div>
        {url && (
          <div className="modal-subtitle">
            <a href={url} target="_blank" rel="noreferrer" style={{color: "var(--accent)", textDecoration: "underline"}}>{url}</a>
          </div>
        )}

        {/* Room details */}
        <div className="modal-section">
          <div className="modal-section-header">Room details</div>
          <div className="field">
            <label>Room type *</label>
            <input 
              type="text" 
              className="input"
              value={roomType} 
              onChange={(e)=>setRoomType(e.target.value)} 
              placeholder="e.g., 1 suite" 
            />
          </div>
        </div>

        {/* Dates */}
        <div className="modal-section">
          <div className="modal-section-header">Dates</div>
          <div className="grid-2">
            <div className="field">
              <label>Check-in date</label>
              <input 
                type="date" 
                className="input"
                value={checkIn || ''} 
                onChange={(e)=>setCheckIn(e.target.value)} 
              />
            </div>
            <div className="field">
              <label>Check-out date</label>
              <input 
                type="date" 
                className="input"
                value={checkOut || ''} 
                onChange={(e)=>setCheckOut(e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="modal-section">
          <div className="modal-section-header">Options</div>
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
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={earlyCI}
                onChange={(e) => setEarlyCI(e.target.checked)}
              />
              <span>Early Check-in</span>
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
              rows={4} 
              value={description} 
              onChange={(e)=>setDescription(e.target.value)} 
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
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="actions">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={disableSave} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
