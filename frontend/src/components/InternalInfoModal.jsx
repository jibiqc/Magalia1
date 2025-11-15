import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import RichTextEditor from "./RichTextEditor";

export default function InternalInfoModal({ open=true, onClose, onSubmit, initialData=null }) {
  const [body, setBody] = useState(initialData?.body || "");

  // Mettre à jour l'état quand initialData change ou quand le modal s'ouvre (pour l'édition)
  useEffect(() => {
    if (open) {
      if (initialData) {
        setBody(initialData.body || "");
      } else {
        setBody("");
      }
    }
  }, [initialData, open]);

  if (!open) return null;

  const handleSubmit = () => onSubmit({ body });

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
        <h2 className="modal-title">Internal info</h2>

        <div className="field">
          <label>Body</label>
          <RichTextEditor 
            value={body}
            onChange={setBody}
            placeholder="Notes for internal use only"
            rows={8}
          />
        </div>

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleSubmit}>Continue</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
