import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api";

export default function HeaderHeroModal({ open, quote, onClose, onSave }) {
  const [displayTitle, setDisplayTitle] = useState(quote?.display_title || "");
  const [heroPhoto1, setHeroPhoto1] = useState(quote?.hero_photo_1 || "");
  const [heroPhoto2, setHeroPhoto2] = useState(quote?.hero_photo_2 || "");
  const [saving, setSaving] = useState(false);

  // Update state when quote changes
  useEffect(() => {
    if (quote) {
      setDisplayTitle(quote.display_title || "");
      setHeroPhoto1(quote.hero_photo_1 || "");
      setHeroPhoto2(quote.hero_photo_2 || "");
    }
  }, [quote]);

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

  if (!open || !quote) {
    return null;
  }

  const handleSave = async () => {
    if (!quote.id) {
      // If quote has no ID, just update local state
      onSave({
        display_title: displayTitle.trim() || null,
        hero_photo_1: heroPhoto1.trim() || null,
        hero_photo_2: heroPhoto2.trim() || null,
      });
      return;
    }

    setSaving(true);
    try {
      const changes = {
        display_title: displayTitle.trim() || null,
        hero_photo_1: heroPhoto1.trim() || null,
        hero_photo_2: heroPhoto2.trim() || null,
      };

      // Build full payload with existing quote data
      const payload = {
        ...quote,
        display_title: changes.display_title,
        hero_photo_1: changes.hero_photo_1,
        hero_photo_2: changes.hero_photo_2,
      };

      await api.saveQuote(quote.id, payload);
      onSave(changes);
    } catch (error) {
      console.error("[HeaderHeroModal] Save error:", error);
      alert("Failed to save header. Please try again.");
    } finally {
      setSaving(false);
    }
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
          <h2>Edit Document Header</h2>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Display Title</label>
            <input
              type="text"
              value={displayTitle}
              onChange={(e) => setDisplayTitle(e.target.value)}
              placeholder="Enter document title"
            />
          </div>
          <div className="form-row">
            <label>Hero Photo 1 URL</label>
            <input
              type="url"
              value={heroPhoto1}
              onChange={(e) => setHeroPhoto1(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="form-row">
            <label>Hero Photo 2 URL</label>
            <input
              type="url"
              value={heroPhoto2}
              onChange={(e) => setHeroPhoto2(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
        <div className="modal-footer" style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
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
      `}</style>
    </div>,
    document.body
  );
}

