import React, { useState } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";

export default function TripInfoModal({
  open = true,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [body, setBody] = useState(initialData?.body || "");

  if (!open) return null;

  const handleSubmit = () => {
    onSubmit({ title, body });
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
        <div className="modal-title">Trip Info</div>

        <div className="dest-modal-body" style={{ padding: 0 }}>
          <div className="field">
            <label>Title</label>
            <input
              type="text"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>Body</label>
            <textarea
              className="textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder=""
              rows={6}
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

