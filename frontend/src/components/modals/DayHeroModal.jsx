import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api";

export default function DayHeroModal({ quoteId, dayId, initialP1 = "", initialP2 = "", onClose, onSaved }) {
  const [selectedUrls, setSelectedUrls] = useState([]); // Array of URLs in selection order (max 2)
  const [manualUrlInput, setManualUrlInput] = useState("");
  const [candidateImages, setCandidateImages] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [err, setErr] = useState("");

  const urlOk = (u) => {
    if (!u) return false;
    if (u.length > 500) return false;
    try {
      const x = new URL(u);
      return x.protocol === "http:" || x.protocol === "https:";
    } catch {
      return false;
    }
  };

  // Initialize selectedUrls from initialP1 and initialP2
  useEffect(() => {
    const urls = [];
    if (initialP1?.trim()) urls.push(initialP1.trim());
    if (initialP2?.trim()) urls.push(initialP2.trim());
    setSelectedUrls(urls);
  }, [initialP1, initialP2]);

  // Load candidate images when modal opens
  useEffect(() => {
    if (quoteId && dayId) {
      setLoadingCandidates(true);
      api.getDayImageCandidates(quoteId, dayId)
        .then(images => {
          setCandidateImages(images || []);
        })
        .catch(err => {
          console.error("[DayHeroModal] Failed to load candidates:", err);
          setCandidateImages([]);
        })
        .finally(() => {
          setLoadingCandidates(false);
        });
    }
  }, [quoteId, dayId]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const isMaxReached = selectedUrls.length >= 2;

  const handleAddManual = () => {
    const url = manualUrlInput.trim();
    if (!url) {
      setErr("Please enter a URL");
      return;
    }
    if (!urlOk(url)) {
      setErr("Invalid URL (http/https only, ≤500 chars)");
      return;
    }
    if (selectedUrls.includes(url)) {
      setErr("This image is already selected");
      return;
    }
    if (isMaxReached) {
      setErr("Maximum 2 images allowed. Remove one first.");
      return;
    }
    
    setSelectedUrls(prev => [...prev, url]);
    setManualUrlInput("");
    setErr("");
  };

  const handleToggleCandidate = (url) => {
    if (selectedUrls.includes(url)) {
      // Remove
      setSelectedUrls(prev => prev.filter(u => u !== url));
    } else {
      // Add
      if (isMaxReached) {
        setErr("Maximum 2 images allowed. Remove one first.");
        return;
      }
      setSelectedUrls(prev => [...prev, url]);
      setErr("");
    }
  };

  const handleRemove = (url) => {
    setSelectedUrls(prev => prev.filter(u => u !== url));
    setErr("");
  };

  const handleSave = () => {
    // Validate all selected URLs
    for (const url of selectedUrls) {
      if (!urlOk(url)) {
        setErr(`Invalid URL in selection: ${url}`);
        return;
      }
    }
    
    // Send p1 and p2 in order (first selected = p1, second = p2)
    const p1 = selectedUrls[0] || "";
    const p2 = selectedUrls[1] || "";
    onSaved({ p1, p2 });
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
      <div className="modal card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "900px", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h2>Edit Day Photos</h2>
        </div>
        <div className="modal-body">
          {err ? <div className="form-error">{err}</div> : null}

          {/* Section 1: Selected Images */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: 600, color: "#e6ecff" }}>
              Selected Images ({selectedUrls.length}/2)
            </h3>
            {selectedUrls.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#999", fontStyle: "italic", background: "rgba(255,255,255,0.02)", borderRadius: "8px" }}>
                No images selected
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                {selectedUrls.map((url, idx) => (
                  <div
                    key={url}
                    style={{
                      position: "relative",
                      aspectRatio: "16/9",
                      borderRadius: "8px",
                      overflow: "hidden",
                      background: "rgba(255,255,255,0.05)",
                      border: "2px solid var(--accent, #4a9eff)",
                      boxShadow: "0 0 0 2px rgba(74, 158, 255, 0.2)"
                    }}
                  >
                    <img
                      src={url}
                      alt={`Selected ${idx + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block"
                      }}
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.parentElement.innerHTML = '<div style="padding: 20px; color: #999; text-align: center; font-size: 12px;">Image not available</div>';
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "4px",
                        left: "4px",
                        background: "var(--accent, #4a9eff)",
                        color: "white",
                        borderRadius: "4px",
                        padding: "2px 6px",
                        fontSize: "11px",
                        fontWeight: "bold"
                      }}
                    >
                      {idx === 0 ? "Photo 1" : "Photo 2"}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(url)}
                      style={{
                        position: "absolute",
                        top: "4px",
                        right: "4px",
                        background: "rgba(255,0,0,0.8)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        width: "24px",
                        height: "24px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                        fontWeight: "bold"
                      }}
                      title="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Add by URL */}
          <div style={{ marginBottom: "24px", padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: 600, color: "#e6ecff" }}>
              Add by URL
            </h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="url"
                value={manualUrlInput}
                onChange={(e) => {
                  setManualUrlInput(e.target.value);
                  setErr("");
                }}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !isMaxReached) {
                    handleAddManual();
                  }
                }}
                placeholder="http(s)://..."
                disabled={isMaxReached}
                style={{
                  flex: 1,
                  background: "#0f1729",
                  color: "#e6ecff",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "10px",
                  padding: "8px",
                  opacity: isMaxReached ? 0.5 : 1
                }}
              />
              <button
                type="button"
                onClick={handleAddManual}
                disabled={isMaxReached || !manualUrlInput.trim()}
                style={{
                  padding: "8px 16px",
                  background: isMaxReached || !manualUrlInput.trim() ? "rgba(255,255,255,0.1)" : "var(--accent, #4a9eff)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  cursor: isMaxReached || !manualUrlInput.trim() ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: 500,
                  opacity: isMaxReached || !manualUrlInput.trim() ? 0.5 : 1
                }}
              >
                Add
              </button>
            </div>
            {isMaxReached && (
              <div style={{ marginTop: "8px", fontSize: "12px", color: "#999", fontStyle: "italic" }}>
                Maximum 2 images reached. Remove one to add more.
              </div>
            )}
          </div>

          {/* Section 3: Images from services */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: 600, color: "#e6ecff" }}>
              Images from today's services
            </h3>
            {loadingCandidates ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#999" }}>
                Loading images...
              </div>
            ) : candidateImages.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#999", fontStyle: "italic", background: "rgba(255,255,255,0.02)", borderRadius: "8px" }}>
                No images available from services on this day
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px" }}>
                {candidateImages.map((img) => {
                  const isSelected = selectedUrls.includes(img.url);
                  return (
                    <div
                      key={img.url}
                      onClick={() => !isMaxReached || isSelected ? handleToggleCandidate(img.url) : null}
                      style={{
                        position: "relative",
                        aspectRatio: "16/9",
                        borderRadius: "8px",
                        overflow: "hidden",
                        background: "rgba(255,255,255,0.05)",
                        border: isSelected ? "2px solid var(--accent, #4a9eff)" : "1px solid rgba(255,255,255,0.1)",
                        cursor: isMaxReached && !isSelected ? "not-allowed" : "pointer",
                        transition: "all 0.2s",
                        boxShadow: isSelected ? "0 0 0 2px rgba(74, 158, 255, 0.2)" : "none",
                        opacity: isMaxReached && !isSelected ? 0.5 : 1
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
                      {img.service_name && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "0",
                            left: "0",
                            right: "0",
                            background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                            color: "white",
                            padding: "4px 8px",
                            fontSize: "11px",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                            whiteSpace: "nowrap"
                          }}
                          title={img.service_name}
                        >
                          {img.service_name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
        .modal.card{background:#0b1220;color:#e6ecff;border-radius:16px;min-width:560px;max-width:900px;padding:20px;border:1px solid rgba(255,255,255,0.08);pointer-events:auto;user-select:text;position:relative;z-index:1}
        .form-row{margin-top:12px;display:flex;flex-direction:column;gap:6px}
        .modal-header{margin-bottom:8px}
        .modal-header h2{margin:0;font-size:18px;font-weight:600}
        .modal-footer button[disabled]{opacity:0.5;cursor:not-allowed}
        input{background:#0f1729;color:#e6ecff;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:8px}
        label{font-weight:500}
        .form-error{color:#f88;margin-top:8px;font-size:14px;padding:8px;background:rgba(255,0,0,0.1);border-radius:8px}
        .modal-footer button{padding:10px 20px;background:rgba(255,255,255,0.1);color:#e6ecff;border:1px solid rgba(255,255,255,0.1);border-radius:6px;cursor:pointer;font-size:14px}
        .modal-footer button:last-child{background:var(--accent, #4a9eff);color:white;border:none}
      `}</style>
    </div>,
    document.body
  );
}
