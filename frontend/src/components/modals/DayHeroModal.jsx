import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function DayHeroModal({ initialP1 = "", initialP2 = "", onClose, onSaved }) {
  const [p1, setP1] = useState(initialP1);
  const [p2, setP2] = useState(initialP2);
  const [err, setErr] = useState("");

  const urlOk = (u) => {
    if (!u) return true; // empty allowed → slot stays empty
    if (u.length > 500) return false;
    try { const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:"; } catch { return false; }
  };

  // Update state when props change
  useEffect(() => {
    setP1(initialP1);
    setP2(initialP2);
    setErr("");
  }, [initialP1, initialP2]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const onSave = () => {
    if (!urlOk(p1) || !urlOk(p2)) {
      setErr("Invalid URL (http/https only, ≤500 chars)");
      return;
    }
    onSaved({ p1: p1?.trim() || "", p2: p2?.trim() || "" });
  };

  return createPortal(
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Day Photos</h2>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Photo 1 URL</label>
            <input
              type="url"
              value={p1}
              onChange={(e) => { setP1(e.target.value); setErr(""); }}
              placeholder="http(s)://... (leave empty to hide)"
            />
          </div>
          <div className="form-row">
            <label>Photo 2 URL</label>
            <input
              type="url"
              value={p2}
              onChange={(e) => { setP2(e.target.value); setErr(""); }}
              placeholder="http(s)://... (leave empty to hide)"
            />
          </div>
          {err ? <div className="form-error">{err}</div> : null}
        </div>
        <div className="modal-footer" style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={onSave}>
            Save
          </button>
        </div>
      </div>
      <style>{`
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;user-select:none;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none}
        .modal.card{background:#0b1220;color:#e6ecff;border-radius:16px;min-width:560px;max-width:720px;padding:20px;border:1px solid rgba(255,255,255,0.08);pointer-events:auto;user-select:text;position:relative;z-index:1}
        .form-row{margin-top:12px;display:flex;flex-direction:column;gap:6px}
        .modal-header{margin-bottom:8px}
        .modal-header h2{margin:0;font-size:18px;font-weight:600}
        .modal-footer button[disabled]{opacity:0.5;cursor:not-allowed}
        input{background:#0f1729;color:#e6ecff;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:8px}
        label{font-weight:500}
        .form-error{color:#f88;margin-top:8px;font-size:14px}
      `}</style>
    </div>,
    document.body
  );
}



