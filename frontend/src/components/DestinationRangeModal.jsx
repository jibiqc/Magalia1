import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";

export default function DestinationRangeModal({
  open = true,
  quoteId,
  startDate,
  ensureQuoteId,
  onClose,
  onApplied,
}) {
  const [query, setQuery] = useState("");
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [nightsStr, setNightsStr] = useState("1");
  const [selectedDest, setSelectedDest] = useState(null);
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const nightsRef = useRef(null);
  const destWrapRef = useRef(null);

  if (!open) return null;

  const onBackdropClick = useCallback(() => {
    if (!applying) onClose?.();
  }, [applying, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounced fetch destinations
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(async () => {
      if (query.trim().length === 0) {
        setDestinations([]);
        setSelectedDest(null);
        setShowMenu(false);
        return;
      }
      setLoading(true);
      try {
        const results = await api.getDestinations(query);
        setDestinations(results || []);
        // Check if query matches exactly (case-insensitive)
        const exactMatch = results.find(
          (d) => d.name.toLowerCase() === query.trim().toLowerCase()
        );
      setSelectedDest(exactMatch || null);
      setIsCreating(!exactMatch && query.trim().length > 0);
      // Only show menu if there's text and results
      if (query.trim().length > 0) {
        setShowMenu(true);
      }
      } catch (err) {
        setError(`Failed to fetch destinations: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close menu on click-outside
  useEffect(() => {
    const onDocClick = (e) => {
      if (!destWrapRef.current) return;
      if (!destWrapRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleApply = async () => {
    if (applying) return; // Prevent double clicks
    setError(null);
    setApplying(true);
    
    try {
      let qid = quoteId;
      
      // Ensure quoteId exists before proceeding
      if (!qid) {
        try {
          qid = await ensureQuoteId?.();
        } catch (e) {
          setError("Unable to save the quote. Please try again.");
          setApplying(false);
          return;
        }
      }
      
      if (!qid) {
        setError("Quote ID is missing. Save or open a quote, then retry.");
        setApplying(false);
        return;
      }
      
      const finalName = query.trim();
      if (!finalName) {
        setError("Destination name is required");
        setApplying(false);
        return;
      }
      const nights = Math.max(1, parseInt(nightsStr || "1", 10));
      if (nights < 1) {
        setError("Nights must be at least 1");
        setApplying(false);
        return;
      }

      try {
        let destinationName = finalName;

        // If creating new destination
        if (isCreating || !selectedDest) {
          try {
            const created = await api.createDestination(finalName);
            destinationName = created.name;
          } catch (err) {
            // If duplicate, fetch and use existing
            if (err.message.includes("already exists") || err.message.includes("duplicate")) {
              const results = await api.getDestinations(finalName);
              if (results && results.length > 0) {
                destinationName = results[0].name;
              } else {
                throw err;
              }
            } else {
              throw err;
            }
          }
        } else {
          destinationName = selectedDest.name;
        }

        // Patch days
        const nightsNum = Math.max(1, parseInt(nightsStr || "1", 10));
        await api.patchQuoteDays(qid, {
          start_date: startDate,
          nights: nightsNum,
          destination: destinationName,
          overwrite: true,
        });

        // Success - call parent callback
        await onApplied?.();
      } catch (err) {
        setError(err.message || "Failed to update destinations");
      } finally {
        setApplying(false);
      }
    } catch (outerErr) {
      // This catch handles ensureQuoteId errors that weren't caught above
      setError(outerErr.message || "Failed to ensure quote ID");
      setApplying(false);
    }
  };

  const selectDestination = (name) => {
    setQuery(name);
    setSelectedDest({ name });
    setIsCreating(false);
    setShowMenu(false);
    setTimeout(() => nightsRef.current?.focus(), 0);
  };

  const handleSelectDestination = (dest) => {
    selectDestination(dest.name);
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
        zIndex: 99999,               // very high, above everything
        background: "rgba(0,0,0,0.30)" // force translucency (prevents full black)
      }}
      onClick={onBackdropClick}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="dest-modal-card"
        style={{
          width: 380,
          maxWidth: "92vw",
          background: "#1b2436",     // lighter panel
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dest-modal-title" style={{ fontWeight: 700, marginBottom: 10, color: "#e8eefc", fontSize: 18 }}>
          Set destination
        </div>

        <div className="dest-modal-body" style={{ padding: 20 }}>
          <div className="form-field">
            <label>Start Date</label>
            <input type="text" value={startDate} readOnly className="readonly" />
          </div>

          <div ref={destWrapRef} className="form-field dest-typeahead" style={{ position: "relative", marginBottom: 10 }}>
            <label>Destination</label>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                setSelectedDest(null);
                setShowMenu(!!v.trim());
              }}
              onFocus={() => {
                setShowMenu(!!query.trim());
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && destinations.length > 0) {
                  e.preventDefault();
                  selectDestination(destinations[0].name);
                }
              }}
              placeholder="Type to search..."
              className="typeahead-input"
            />
            {loading && <div className="typeahead-loading">Loading...</div>}
            {!loading && showMenu && query.trim().length > 0 && (
              <div className="typeahead-dropdown menu" style={{ position: "absolute", left: 0, right: 0, top: "100%", maxHeight: 220, overflow: "auto", zIndex: 100000, background: "#222c42", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 6, marginTop: 4 }}>
                {destinations.length > 0 && (
                  <>
                    {destinations.map((dest) => (
                      <div
                        key={dest.id || dest.name}
                        className="typeahead-option"
                        onClick={() => handleSelectDestination(dest)}
                      >
                        {dest.name}
                      </div>
                    ))}
                  </>
                )}
                {isCreating && (
                  <div
                    className="typeahead-option typeahead-create"
                    onClick={() => selectDestination(query.trim())}
                  >
                    Add new: <strong>{query.trim()}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-field">
            <label>Nights</label>
            <input
              ref={nightsRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={nightsStr}
              onChange={(e) => {
                // keep only digits; allow empty while typing
                const v = e.target.value.replace(/\D/g, "");
                setNightsStr(v);
              }}
              placeholder="1"
            />
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="dest-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <button className="btn secondary" onClick={onClose} disabled={applying}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleApply} disabled={loading || !query.trim() || applying}>
            {applying ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(backdrop, document.body);
}

