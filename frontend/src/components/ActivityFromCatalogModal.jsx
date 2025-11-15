import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";
import { parseHHMM, fmtHm, addMins } from "../utils/duration";
import TimeAmPmField from "./TimeAmPmField";

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
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">{activityName}</div>
        {(supplierName || categoryDisplay || providerUrl) && (
          <div className="modal-subtitle">
            {supplierName && <span>{supplierName}</span>}
            {supplierName && categoryDisplay && <span> • </span>}
            {categoryDisplay && <span>{categoryDisplay}</span>}
            {providerUrl && (
              <>
                {(supplierName || categoryDisplay) && <br />}
                <a href={providerUrl} target="_blank" rel="noreferrer" style={{color: "var(--accent)", textDecoration: "underline"}}>
                  {providerUrl.length > 50 ? providerUrl.substring(0, 50) + '...' : providerUrl}
                </a>
              </>
            )}
          </div>
        )}

        {/* Description */}
        <div className="modal-section">
          <div className="modal-section-header">Description</div>
          <div className="field">
            <label>Description</label>
            <textarea 
              className="textarea"
              rows={4} 
              value={description} 
              onChange={(e)=>setDescription(e.target.value)} 
            />
          </div>
        </div>

        {/* Schedule */}
        <div className="modal-section">
          <div className="modal-section-header">Schedule</div>
          <div className="grid-2">
            <TimeAmPmField label="Start time" value24={startTime} onChange={setStartTime} />
            <TimeAmPmField label="End time" value24={endTime} onChange={handleEndChange} />
          </div>
          <div className="field">
            <label>Duration</label>
            <input 
              type="text" 
              className="input"
              value={duration} 
              onChange={(e)=>handleDurChange(e.target.value)} 
              placeholder="e.g., 3h or 3h30"
            />
          </div>
        </div>

        {/* Internal note */}
        <div className="modal-section">
          <div className="modal-section-header">Internal note</div>
          <div className="field">
            <label>Internal note</label>
            <textarea
              className="textarea"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="actions">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

