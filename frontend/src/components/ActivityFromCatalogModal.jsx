import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";
import { parseHHMM, fmtHm, addMins } from "../utils/duration";
import TimeAmPmField from "./TimeAmPmField";
import { api } from "../lib/api";

export default function ActivityFromCatalogModal({ open=true, data, onClose, onSubmit, onOpenImagesModal }) {
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
  const svcFull = data?.svcFull; // Extract svcFull early to avoid reference errors
  const [description, setDescription] = useState(defaults?.description || "");
  const [startTime, setStartTime] = useState(defaults?.start_time || "");
  const [endTime, setEndTime] = useState(defaults?.end_time || "");
  const [duration, setDuration] = useState(defaults?.duration || "");
  const [internalNote, setInternalNote] = useState(defaults?.internal_note || "");
  const [selectedImages, setSelectedImages] = useState(() => {
    // Initialize with existing selected images from defaults
    const existing = defaults?.selected_images || [];
    return existing;
  });

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
      // Update selected images if provided
      if (d.selected_images && Array.isArray(d.selected_images) && d.selected_images.length > 0) {
        setSelectedImages(d.selected_images);
      } else if (data?.svcFull?.images?.[0]) {
        // If no existing selection, default to first image
        setSelectedImages(prev => {
          if (prev.length === 0) {
            return [data.svcFull.images[0]];
          }
          return prev;
        });
      }
    } else {
      console.log('[ActivityFromCatalogModal] No defaults in data:', data);
    }
    
    // Ensure we have all images loaded (both manual and imported)
    if (data?.svcFull?.images && data.svcFull.images.length > 0) {
      console.log('[ActivityFromCatalogModal] Service has images:', data.svcFull.images.length, 'images');
      console.log('[ActivityFromCatalogModal] Images:', data.svcFull.images.map(img => ({ id: img.id, url: img.url?.substring(0, 50), source: img.source })));
    }
  }, [data]);
  
  // Reload service images when modal opens to ensure we have all images (manual + imported)
  useEffect(() => {
    if (open && data?.svcFull?.id) {
      // Reload service to get all images (including newly added manual ones)
      const reloadImages = async () => {
        try {
          const updated = await api.getServiceById(data.svcFull.id);
          if (updated?.images && updated.images.length > 0) {
            // Update svcFull with fresh images
            if (data.svcFull.images?.length !== updated.images.length) {
              console.log('[ActivityFromCatalogModal] Images updated:', updated.images.length, 'images');
              // Trigger a re-render by updating the data
              // Note: This might need to be handled by the parent component
            }
          }
        } catch (err) {
          console.error('[ActivityFromCatalogModal] Failed to reload images:', err);
        }
      };
      reloadImages();
    }
  }, [open, data?.svcFull?.id]);

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
      internal_note: internalNote,
      selected_images: selectedImages // Include selected images
    });
  };
  
  const toggleImageSelection = (image) => {
    setSelectedImages(prev => {
      const isSelected = prev.some(img => img.id === image.id);
      if (isSelected) {
        // Remove image
        return prev.filter(img => img.id !== image.id);
      } else {
        // Add image (max 2)
        if (prev.length >= 2) {
          // Replace the first one if already at max
          return [prev[1], image];
        }
        return [...prev, image];
      }
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

        {/* Service Images Section */}
        {svcFull?.id && (
          <div className="modal-section" style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "16px" }}>
            <div className="modal-section-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span>Service Images {selectedImages.length > 0 && `(${selectedImages.length}/2 selected)`}</span>
              {onOpenImagesModal && (
                <button
                  type="button"
                  onClick={onOpenImagesModal}
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#e6ecff",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                  title="Manage service images"
                >
                  📷 Manage Images
                </button>
              )}
            </div>
            {svcFull?.images && svcFull.images.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px" }}>
                {/* Display all images (both imported and manual) */}
                {svcFull.images.map((img) => {
                  const isSelected = selectedImages.some(sel => sel.id === img.id);
                  return (
                    <div
                      key={img.id}
                      onClick={() => toggleImageSelection(img)}
                      style={{
                        position: "relative",
                        aspectRatio: "16/9",
                        borderRadius: "8px",
                        overflow: "hidden",
                        background: "rgba(255,255,255,0.05)",
                        border: isSelected ? "2px solid var(--accent, #4a9eff)" : "1px solid rgba(255,255,255,0.1)",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: isSelected ? "0 0 0 2px rgba(74, 158, 255, 0.2)" : "none"
                      }}
                    >
                      <img
                        src={img.url}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                          opacity: isSelected ? 1 : 0.7
                        }}
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.parentElement.innerHTML = '<div style="padding: 20px; color: #999; text-align: center; font-size: 12px;">Image not available</div>';
                        }}
                      />
                      {isSelected && (
                        <div
                          style={{
                            position: "absolute",
                            top: "4px",
                            right: "4px",
                            background: "var(--accent, #4a9eff)",
                            color: "white",
                            borderRadius: "50%",
                            width: "24px",
                            height: "24px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "14px",
                            fontWeight: "bold"
                          }}
                        >
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: "#999", fontStyle: "italic", background: "rgba(255,255,255,0.02)", borderRadius: "8px" }}>
                No image available
              </div>
            )}
          </div>
        )}

        <div className="actions">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

