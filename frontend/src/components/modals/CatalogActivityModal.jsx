import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import TimeAmPmField from "../TimeAmPmField";

export default function CatalogActivityModal({ open, line, onClose, onSubmit }) {
  if (!open || !line) return null;

  // Snapshot from catalog import
  const snap = line?.raw_json?.snapshot || {};
  const f = snap.fields || {};

  const [title, setTitle] = useState(line.title || f.name || "");
  const company =
    line.supplier_name || f.supplier_name || line.raw_json?.supplier_name || "";
  const category = line.category || f.category || "Activity";

  const [startTime, setStartTime] = useState(f.start_time || "");
  const [endTime, setEndTime] = useState(f.end_time || "");
  const [duration, setDuration] = useState(
    (f.duration_minutes && String(f.duration_minutes)) || ""
  );
  const [description, setDescription] = useState(
    line.description || f.full_description || ""
  );
  const [internalNote, setInternalNote] = useState(line.internal_note || "");

  // Normalize HH:MM 24h
  const norm24 = (v) =>
    (v || "").trim().match(/^([01]?\d|2[0-3]):[0-5]\d$/) ? v : "";

  const onSave = () => {
    const upd = { ...line };

    // visible fields
    upd.title = title.trim() || line.title;
    upd.description = description || "";
    upd.internal_note = internalNote || "";

    // persist user edits for later exports
    const prev = (upd.raw_json && upd.raw_json.overrides) || {};
    upd.raw_json = {
      ...(upd.raw_json || {}),
      overrides: {
        ...prev,
        activity: {
          start_time: norm24(startTime),
          end_time: norm24(endTime),
          duration_minutes: duration ? Number(duration) : "",
          title: upd.title,
          description: upd.description,
          internal_note: upd.internal_note,
        },
      },
    };

    onSubmit?.(upd);
    onClose?.();
  };

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-card" role="dialog" aria-modal="true" style={{minWidth: 680}}>
        <div className="modal-header">
          <h3>Edit Activity (catalog)</h3>
        </div>
        <div className="dest-modal-body" style={{display:"grid", gap:"12px"}}>
          <label className="fld">
            <span>Title</span>
            <input value={title} onChange={(e)=>setTitle(e.target.value)} />
          </label>
          <div className="grid two">
            <label className="fld">
              <span>Company (read-only)</span>
              <input value={company} readOnly />
            </label>
            <label className="fld">
              <span>Category (read-only)</span>
              <input value={category} readOnly />
            </label>
          </div>
          <div className="grid three" style={{alignItems:"end"}}>
            <TimeAmPmField label="Start time" value24={startTime} onChange={setStartTime} />
            <TimeAmPmField label="End time" value24={endTime} onChange={setEndTime} />
            <label className="fld">
              <span>Duration (min)</span>
              <input inputMode="numeric" value={duration} onChange={(e)=>setDuration(e.target.value.replace(/[^\d]/g,""))} />
            </label>
          </div>
          <label className="fld">
            <span>Description</span>
            <textarea rows={5} value={description} onChange={(e)=>setDescription(e.target.value)} />
          </label>
          { (f.provider_service_url || f.service_url) ? (
            <a className="link" href={(f.provider_service_url || f.service_url)} target="_blank" rel="noreferrer">
              Service URL ↗
            </a>
          ) : null }
          <label className="fld">
            <span>Internal note</span>
            <textarea rows={3} value={internalNote} onChange={(e)=>setInternalNote(e.target.value)} />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

