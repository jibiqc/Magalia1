import React, { useState } from "react";

export default function TripInfoModal({ open=true, onClose, onSubmit, initialData=null }) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [body, setBody]   = useState(initialData?.body  || "");

  if (!open) return null;

  const handleSubmit = () => onSubmit({ title, body });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{minWidth:720, maxWidth:960}} onClick={e=>e.stopPropagation()}>
        <h2 className="modal-title">Trip info</h2>

        <div className="field">
          <label>Title<span style={{color:"#ef4444"}}> *</span></label>
          <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g., Check-in details" />
        </div>

        <div className="field">
          <label>Body</label>
          <textarea className="textarea" rows={6} value={body} onChange={e=>setBody(e.target.value)} placeholder="Practical information to show to the client" />
        </div>

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!title.trim()} onClick={handleSubmit}>Continue</button>
        </div>
      </div>
    </div>
  );
}
