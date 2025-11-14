import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "../../styles/quote.css";
import RichTextEditor from "../RichTextEditor";

export default function CatalogActivityModal({
  open = true,
  onClose,
  onSubmit,
  line = null,
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [internal_note, setInternalNote] = useState("");

  // Initialize from line when it changes or when modal opens
  useEffect(() => {
    if (open && line) {
      setTitle(line.title || "");
      setDescription(line.raw_json?.snapshot?.description || line.raw_json?.snapshot?.body || "");
      setInternalNote(line.raw_json?.snapshot?.internal_note || "");
    } else if (open && !line) {
      setTitle("");
      setDescription("");
      setInternalNote("");
    }
  }, [line, open]);

  if (!open || !line) return null;

  const handleSubmit = () => {
    // Create updated line preserving all original properties
    const updated = {
      ...line,
      title: title.trim() || line.title,
      raw_json: {
        ...line.raw_json,
        snapshot: {
          ...line.raw_json?.snapshot,
          description: description.trim() || line.raw_json?.snapshot?.description,
          body: description.trim() || line.raw_json?.snapshot?.body,
          internal_note: internal_note.trim() || line.raw_json?.snapshot?.internal_note,
        },
      },
    };
    onSubmit(updated);
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
        <div className="modal-title">Edit Activity</div>

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
            <label>Description</label>
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder=""
              rows={4}
            />
          </div>

          <div className="field">
            <label>Internal note</label>
            <RichTextEditor
              value={internal_note}
              onChange={setInternalNote}
              placeholder=""
              rows={3}
            />
          </div>
        </div>

        <div className="actions">
          <button className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleSubmit}>
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(backdrop, document.body);
}
