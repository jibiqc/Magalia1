import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";
import TimeAmPmField from "./TimeAmPmField";

export default function TransportFromCatalogModal({ open=true, data, onClose, onSubmit }) {
  // Debug logs
  useEffect(() => {
    console.log('[TransportFromCatalogModal] Props:', { open, data: !!data, hasData: !!data });
  }, [open, data]);
  
  // Controlled fields - must be declared before early return
  const defaults = data?.defaults || {};
  const [description, setDescription] = useState(defaults?.description || "");
  const [startTime, setStartTime] = useState(defaults?.start_time || "");
  const [internalNote, setInternalNote] = useState(defaults?.internal_note || "");

  // Update state when data changes
  useEffect(() => {
    if (data?.defaults) {
      const d = data.defaults;
      setDescription(d.description || "");
      setStartTime(d.start_time || "");
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
    console.log('[TransportFromCatalogModal] Not rendering:', { open, hasData: !!data });
    return null;
  }

  const { svcFull } = data;
  const transportName = svcFull?.name || "";
  const supplierName = svcFull?.supplier?.name || svcFull?.company || "";
  const category = svcFull?.category || "";

  const handleSave = () => {
    onSubmit({
      description,
      start_time: startTime,
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
        <div className="modal-title">{transportName}</div>
        {(supplierName || category) && (
          <div className="modal-subtitle">
            {supplierName && <span>{supplierName}</span>}
            {supplierName && category && <span> • </span>}
            {category && <span>{category}</span>}
          </div>
        )}

        {/* Schedule */}
        <div className="modal-section">
          <div className="modal-section-header">Schedule</div>
          <TimeAmPmField label="Start time" value24={startTime} onChange={setStartTime} />
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
          <button className="btn primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>,
    document.body
  );
}


