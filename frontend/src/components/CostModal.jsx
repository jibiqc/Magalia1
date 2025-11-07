import React, { useState } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";

export default function CostModal({
  open = true,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [body, setBody] = useState(initialData?.body || "");
  const [amount, setAmount] = useState(initialData?.amount || "");
  const [currency, setCurrency] = useState(initialData?.currency || "");

  if (!open) return null;

  const handleSubmit = () => {
    onSubmit({ title, body, amount, currency });
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
        <div className="modal-title">Cost</div>

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
            <label>Amount</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>Currency</label>
            <select
              className="select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="">Select currency</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>

          <div className="field">
            <label>Body</label>
            <textarea
              className="textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder=""
              rows={4}
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

