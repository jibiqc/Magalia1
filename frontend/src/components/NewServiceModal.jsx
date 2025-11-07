import React, { useState } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";
import { parseHHMM, fmtHm, addMins } from "../utils/duration";
import TimeAmPmField from "./TimeAmPmField";

export default function NewServiceModal({
  open = true,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [category_label, setCategoryLabel] = useState(initialData?.category_label || "");
  const [start_time, setStartTime] = useState(initialData?.start_time || "");
  const [end_time, setEndTime] = useState(initialData?.end_time || "");
  const [duration, setDuration] = useState(initialData?.duration || "");
  const [internal_note, setInternalNote] = useState(initialData?.internal_note || "");

  if (!open) return null;

  const handleSubmit = () => {
    onSubmit({ title, description, category_label, start_time, end_time, duration, internal_note });
  };

  const handleEndChange = (v) => {
    setEndTime(v);
    const startMins = parseHHMM(start_time);
    const endMins = parseHHMM(v);
    if (startMins != null && endMins != null) {
      const d = ((endMins - startMins + 1440) % 1440);
      setDuration(fmtHm(d));
    }
  };

  const handleDurChange = (v) => {
    setDuration(v);
    const m = /(\d+)h(?:(\d{1,2}))?/.exec(v);
    const startMins = parseHHMM(start_time);
    if (startMins != null && m) {
      const mins = (parseInt(m[1]) * 60 + (parseInt(m[2] || "0")));
      setEndTime(addMins(start_time, mins));
    }
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
        <div className="modal-title">New Service</div>

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
            <label>Category</label>
            <select
              className="select"
              value={category_label}
              onChange={(e) => setCategoryLabel(e.target.value)}
            >
              <option value="">Select category</option>
              <option value="Small Group">Small Group</option>
              <option value="Private">Private</option>
              <option value="Tickets">Tickets</option>
              <option value="Private Chauffeur">Private Chauffeur</option>
              <option value="Private Transport">Private Transport</option>
              <option value="Restaurant Reservation">Restaurant Reservation</option>
            </select>
          </div>

          <TimeAmPmField label="Start time" value24={start_time} onChange={setStartTime} />

          <TimeAmPmField label="End time" value24={end_time} onChange={handleEndChange} />

          <div className="field">
            <label>Duration</label>
            <input
              type="text"
              className="input"
              value={duration}
              onChange={(e) => handleDurChange(e.target.value)}
              placeholder="e.g., 3h or 3h30"
            />
          </div>

          <div className="field">
            <label>Internal note</label>
            <textarea
              className="textarea input-internal-note"
              value={internal_note}
              onChange={(e) => setInternalNote(e.target.value)}
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
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(backdrop, document.body);
}

