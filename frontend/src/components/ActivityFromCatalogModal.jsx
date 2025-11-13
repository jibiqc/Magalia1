import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { parseHHMM, fmtHm, addMins } from "../utils/duration";
import TimeAmPmField from "./TimeAmPmField";
import RichTextEditor from "./RichTextEditor";

export default function ActivityFromCatalogModal({ open=true, data, onClose, onSubmit }) {
  // Debug logs
  useEffect(() => {
    console.log('[ActivityFromCatalogModal] Props:', { open, data: !!data, hasData: !!data });
    if (data) {
      console.log('[ActivityFromCatalogModal] Full data object:', data);
      console.log('[ActivityFromCatalogModal] Data.defaults:', data.defaults);
    }
  }, [open, data]);
  
  // Controlled fields - must be declared before early return
  const defaults = data?.defaults || {};
  const [description, setDescription] = useState(defaults?.description || "");
  const [startTime, setStartTime] = useState(defaults?.start_time || "");
  const [endTime, setEndTime] = useState(defaults?.end_time || "");
  const [duration, setDuration] = useState(defaults?.duration || "");
  const [internalNote, setInternalNote] = useState(defaults?.internal_note || "");

  // Update state when data changes
  useEffect(() => {
    if (data?.defaults) {
      const d = data.defaults;
      console.log('[ActivityFromCatalogModal] Updating state from defaults:', d);
      setDescription(d.description || "");
      setStartTime(d.start_time || "");
      setEndTime(d.end_time || "");
      setDuration(d.duration || "");
      setInternalNote(d.internal_note || "");
    } else {
      console.log('[ActivityFromCatalogModal] No defaults in data:', data);
    }
  }, [data]);

  // Prevent body scroll and interactions when modal is open
  useEffect(() => {
    if (open && data) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [open, data]);

  if (!open || !data) {
    console.log('[ActivityFromCatalogModal] Not rendering:', { open, hasData: !!data });
    return null;
  }

  const { svcFull } = data;
  const activityName = svcFull?.name || "";
  const supplierName = svcFull?.supplier?.name || svcFull?.company || "";
  const providerUrl = defaults?.provider_service_url || svcFull?.fields?.provider_service_url || "";
  const category = svcFull?.category || "";
  
  // Category display mapping
  const categoryDisplay = {
    "Small Group": "Small Group",
    "Private": "Private",
    "Private Chauffeur": "Private Chauffeur",
    "Tickets": "Tickets"
  }[category] || category;

  // Handle end time change - calculate duration
  const handleEndChange = (v) => {
    setEndTime(v);
    const startMins = parseHHMM(startTime);
    const endMins = parseHHMM(v);
    if (startMins != null && endMins != null) {
      const d = ((endMins - startMins + 1440) % 1440);
      setDuration(fmtHm(d));
    }
  };

  // Handle duration change - calculate end time
  const handleDurChange = (v) => {
    setDuration(v);
    const m = /(\d+)h(?:(\d{1,2}))?/.exec(v);
    const startMins = parseHHMM(startTime);
    if (startMins != null && m) {
      const mins = (parseInt(m[1]) * 60 + (parseInt(m[2] || "0")));
      setEndTime(addMins(startTime, mins));
    }
  };

  const handleSave = () => {
    onSubmit({
      description,
      start_time: startTime,
      end_time: endTime,
      duration,
      internal_note: internalNote
    });
  };

  return createPortal(
    <div 
      className="modal-backdrop" 
      role="dialog" 
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div 
        className="modal card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
          <div className="text-lg font-semibold">
            {activityName}
          </div>
          {supplierName && (
            <div style={{opacity: 0.8}}>
              {supplierName}
            </div>
          )}
          {providerUrl ? (
            <div>
              <a href={providerUrl} target="_blank" rel="noreferrer">
                {providerUrl.length > 50 ? providerUrl.substring(0, 50) + '...' : providerUrl}
              </a>
            </div>
          ) : null}
          {categoryDisplay && (
            <div style={{opacity: 0.7, fontSize: '0.9em'}}>
              {categoryDisplay}
            </div>
          )}
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Description</label>
            <textarea rows={4} value={description} onChange={(e)=>setDescription(e.target.value)} />
          </div>
          <TimeAmPmField label="Start time" value24={startTime} onChange={setStartTime} />
          <TimeAmPmField label="End time" value24={endTime} onChange={handleEndChange} />
          <div className="form-row">
            <label>Duration</label>
            <input 
              type="text" 
              value={duration} 
              onChange={(e)=>handleDurChange(e.target.value)} 
              placeholder="e.g., 3h or 3h30"
            />
          </div>
          <div className="form-row">
            <label>Internal note</label>
            <RichTextEditor rows={3} value={internalNote} onChange={setInternalNote} />
          </div>
        </div>
        <div className="modal-footer" style={{display:'flex', gap:12, justifyContent:'flex-end'}}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={handleSave}>Save</button>
        </div>
      </div>
      <style>{`
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;user-select:none;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none}
        .modal.card{background:#0b1220;color:#e6ecff;border-radius:16px;min-width:560px;max-width:720px;padding:20px;border:1px solid rgba(255,255,255,0.08);pointer-events:auto;user-select:text;position:relative;z-index:1}
        .form-row{margin-top:12px;display:flex;flex-direction:column;gap:6px}
        .modal-header{margin-bottom:8px}
        .modal-footer button[disabled]{opacity:0.5;cursor:not-allowed}
        input, textarea{background:#0f1729;color:#e6ecff;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:8px}
        label{font-weight:500}
        a{color:#a9c7ff;text-decoration:underline}
        input[disabled]{opacity:0.7;cursor:not-allowed}
      `}</style>
    </div>,
    document.body
  );
}

