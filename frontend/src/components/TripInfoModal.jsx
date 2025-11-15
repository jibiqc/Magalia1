import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function TripInfoModal({ open=true, onClose, onSubmit, initialData=null, defaultDate=null }) {
  // Initialiser avec des valeurs par défaut, pas avec initialData (pour éviter les duplications)
  const [title, setTitle] = useState("");
  const [body, setBody]   = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateError, setDateError] = useState("");

  // Mettre à jour l'état quand initialData change ou quand le modal s'ouvre (pour l'édition)
  useEffect(() => {
    if (open) {
      if (initialData) {
        setTitle(initialData.title || "");
        setBody(initialData.body || "");
        // Use existing dates from data, or fallback to defaultDate
        setStartDate(initialData.start_date || initialData.startDate || defaultDate || "");
        setEndDate(initialData.end_date || initialData.endDate || defaultDate || "");
      } else {
        setTitle("");
        setBody("");
        // Prefill both dates with defaultDate (the day's date)
        const dateValue = defaultDate || "";
        setStartDate(dateValue);
        setEndDate(dateValue);
      }
      setDateError("");
    }
  }, [initialData, open, defaultDate]);

  // Validate dates when they change
  useEffect(() => {
    if (startDate && endDate && startDate > endDate) {
      setDateError("End date must not be earlier than start date");
    } else {
      setDateError("");
    }
  }, [startDate, endDate]);

  if (!open) return null;

  const handleSubmit = () => {
    if (dateError) return; // Prevent submission if validation fails
    onSubmit({ 
      title, 
      body,
      start_date: startDate,
      end_date: endDate
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
        style={{
          minWidth: 720, 
          maxWidth: 960,
          position: "relative",
          zIndex: 100000,
          pointerEvents: "auto"
        }} 
        onClick={e=>e.stopPropagation()}
      >
        <h2 className="modal-title">Trip info</h2>

        <div className="field">
          <label>Title<span style={{color:"#ef4444"}}> *</span></label>
          <input 
            className="input" 
            type="text"
            value={title} 
            onChange={e=>setTitle(e.target.value)} 
            placeholder="e.g., Check-in details"
            style={{
              position: "relative",
              zIndex: 1,
              pointerEvents: "auto"
            }}
          />
        </div>

        <div className="field">
          <label>Body</label>
          <textarea 
            className="textarea" 
            rows={6} 
            value={body} 
            onChange={e=>setBody(e.target.value)} 
            placeholder="Practical information to show to the client"
            style={{
              position: "relative",
              zIndex: 1,
              pointerEvents: "auto"
            }}
          />
        </div>

        <div className="field">
          <label>Start date</label>
          <input 
            className="input" 
            type="date"
            value={startDate} 
            onChange={e=>setStartDate(e.target.value)} 
            style={{
              position: "relative",
              zIndex: 1,
              pointerEvents: "auto"
            }}
          />
        </div>

        <div className="field">
          <label>End date</label>
          <input 
            className="input" 
            type="date"
            value={endDate} 
            onChange={e=>setEndDate(e.target.value)} 
            style={{
              position: "relative",
              zIndex: 1,
              pointerEvents: "auto"
            }}
          />
          {dateError && (
            <div style={{ color: "#ef4444", fontSize: "0.875rem", marginTop: "4px" }}>
              {dateError}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!title.trim() || !!dateError} onClick={handleSubmit}>Continue</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
