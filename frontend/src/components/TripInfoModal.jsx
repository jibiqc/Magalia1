import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function TripInfoModal({ open=true, onClose, onSubmit, initialData=null }) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [body, setBody]   = useState(initialData?.body  || "");

  // Mettre à jour l'état quand initialData change ou quand le modal s'ouvre (pour l'édition)
  useEffect(() => {
    if (open) {
      if (initialData) {
        setTitle(initialData.title || "");
        setBody(initialData.body || "");
      } else {
        setTitle("");
        setBody("");
      }
    }
  }, [initialData, open]);

  if (!open) return null;

  const handleSubmit = () => onSubmit({ title, body });

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

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!title.trim()} onClick={handleSubmit}>Continue</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
