import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";

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
      setRoomType(d.room_type || "");
      setBreakfast(!!d.breakfast);
      setEarlyCI(!!d.early_check_in);
      setCheckIn(d.check_in_date || "");
      setCheckOut(d.check_out_date || "");
      setDescription(d.description || "");
      setInternalNote(d.internal_note || "");
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
      className="modal-backdrop" 
      role="dialog" 
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div 
        className="modal card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="text-lg font-semibold" style={{display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap'}}>
            <span>{hotelName}</span>
            {starsText && <span>{starsText}</span>}
          </div>
          {url ? (
            <div className="mt-1">
              <a href={url} target="_blank" rel="noreferrer">{url}</a>
            </div>
          ) : null}
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Room type *</label>
            <input type="text" value={roomType} onChange={(e)=>setRoomType(e.target.value)} placeholder="e.g., 1 suite" />
          </div>
          {/* Dates block directly under room type */}
          <div className="form-row dates-grid">
            <div>
              <label>Check-in date</label>
              <input type="date" value={checkIn || ''} onChange={(e)=>setCheckIn(e.target.value)} />
            </div>
            <div>
              <label>Check-out date</label>
              <input type="date" value={checkOut || ''} onChange={(e)=>setCheckOut(e.target.value)} />
            </div>
          </div>
          {/* Toggles below dates - same row */}
          <div className="form-row toggles-row">
            <label><input type="checkbox" checked={breakfast} onChange={(e)=>setBreakfast(e.target.checked)} /> Breakfast</label>
            <label><input type="checkbox" checked={earlyCI} onChange={(e)=>setEarlyCI(e.target.checked)} /> Early Check-in</label>
          </div>
          <div className="form-row">
            <label>Description</label>
            <textarea rows={4} value={description} onChange={(e)=>setDescription(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Internal note</label>
            <textarea rows={3} value={internalNote} onChange={(e)=>setInternalNote(e.target.value)} />
          </div>
          {/* lock note removed as requested */}
        </div>
        <div className="modal-footer" style={{display:'flex', gap:12, justifyContent:'flex-end'}}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" disabled={disableSave} onClick={handleSave}>Save</button>
        </div>
      </div>
      <style>{`
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;user-select:none;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none}
        .modal.card{background:#0b1220;color:#e6ecff;border-radius:16px;min-width:560px;max-width:720px;padding:20px;border:1px solid rgba(255,255,255,0.08);pointer-events:auto;user-select:text;position:relative;z-index:1}
        .form-row{margin-top:12px;display:flex;flex-direction:column;gap:6px}
        .modal-header{margin-bottom:8px}
        .modal-footer button[disabled]{opacity:0.5;cursor:not-allowed}
        input, textarea{background:#0f1729;color:#e6ecff;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:8px}
        label{font-weight:500}
        a{color:#a9c7ff;text-decoration:underline}
        .dates-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:center}
        .toggles-row{display:flex;flex-direction:row;gap:24px;align-items:center;flex-wrap:wrap}
      `}</style>
    </div>,
    document.body
  );
}
