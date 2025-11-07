import React, { useState } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";

export default function InternalInfoModal({
  open = true,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const [body, setBody] = useState(initialData?.body || "");

  if (!open) return null;

  const handleSubmit = () => {
    onSubmit({ body });
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
        className="dest-modal-card"
        style={{
          width: 420,
          maxWidth: "92vw",
          background: "#1b2436",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dest-modal-title" style={{ fontWeight: 700, marginBottom: 16, color: "#e8eefc", fontSize: 18 }}>
          Internal Info
        </div>

        <div className="dest-modal-body" style={{ padding: 0 }}>
          <div className="field">
            <label>Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder=""
              rows={6}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>
        </div>

        <div className="dest-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "16px 0 0", borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 16 }}>
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

