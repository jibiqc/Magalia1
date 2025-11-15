import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function DayImagesModal({ open, day, onClose, onSave }) {
  const [image1, setImage1] = useState("");
  const [image2, setImage2] = useState("");
  const [err, setErr] = useState("");

  const urlOk = (u) => {
    if (!u) return true; // empty allowed
    if (u.length > 500) return false;
    try { const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:"; } catch { return false; }
  };

  // Update state when day changes
  useEffect(() => {
    if (day && open) {
      const images = day.decorative_images || [];
      setImage1(images[0] || "");
      setImage2(images[1] || "");
      setErr("");
    }
  }, [day, open]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [open]);

  if (!open || !day) {
    return null;
  }

  const handleSave = () => {
    // validate URLs
    if (!urlOk(image1) || !urlOk(image2)) {
      setErr("Invalid URL (http/https only, ≤500 chars)");
      return;
    }

    // Build array of non-empty URLs
    const images = [image1.trim(), image2.trim()].filter(url => url !== "");
    
    onSave(images);
    onClose();
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
          <h2>Edit Day Images</h2>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Image 1 URL</label>
            <input
              type="url"
              value={image1}
              onChange={(e) => { setImage1(e.target.value); setErr(""); }}
              placeholder="http(s)://... (leave empty to hide)"
            />
          </div>
          <div className="form-row">
            <label>Image 2 URL</label>
            <input
              type="url"
              value={image2}
              onChange={(e) => { setImage2(e.target.value); setErr(""); }}
              placeholder="http(s)://... (leave empty to hide)"
            />
          </div>
          {err ? <div className="form-error">{err}</div> : null}
        </div>
        <div className="modal-footer" style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={handleSave}>
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




