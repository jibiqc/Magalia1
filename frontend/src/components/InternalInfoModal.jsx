import React, { useState } from "react";

export default function InternalInfoModal({ open=true, onClose, onSubmit, initialData=null }) {
  const [body, setBody] = useState(initialData?.body || "");

  if (!open) return null;

  const handleSubmit = () => onSubmit({ body });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{minWidth:720, maxWidth:960}} onClick={e=>e.stopPropagation()}>
        <h2 className="modal-title">Internal info</h2>

        <div className="field">
          <label>Body</label>
          <textarea className="textarea" rows={8} value={body} onChange={e=>setBody(e.target.value)} placeholder="Notes for internal use only" />
        </div>

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleSubmit}>Continue</button>
        </div>
      </div>
    </div>
  );
}
