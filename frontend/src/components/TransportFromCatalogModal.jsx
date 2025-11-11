import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
        <div className="modal-header" style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
          <div className="text-lg font-semibold">
            {transportName}
          </div>
          {supplierName && (
            <div style={{opacity: 0.8}}>
              {supplierName}
            </div>
          )}
          {category && (
            <div style={{opacity: 0.7, fontSize: '0.9em'}}>
              {category}
            </div>
          )}
        </div>
        <div className="modal-body">
          <TimeAmPmField label="Start time" value24={startTime} onChange={setStartTime} />
          <div className="form-row">
            <label>Description</label>
            <textarea rows={4} value={description} onChange={(e)=>setDescription(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Internal note</label>
            <textarea rows={3} value={internalNote} onChange={(e)=>setInternalNote(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer" style={{display:'flex', gap:12, justifyContent:'flex-end'}}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={handleSave}>Save</button>
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
        input[disabled]{opacity:0.7;cursor:not-allowed}
      `}</style>
    </div>,
    document.body
  );
}

