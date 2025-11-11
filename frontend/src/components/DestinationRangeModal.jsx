import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";

export default function DestinationRangeModal({
  open = true,
  quoteId,
  startDate,
  initialDestination = "",
  initialNights = 1,
  ensureQuoteId,
  onClose,
  onApplied,
}) {
  const [destInput, setDestInput] = useState("");  // will initialize from props on open
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [nightsStr, setNightsStr] = useState("1");  // will initialize from props on open
  const [selectedDest, setSelectedDest] = useState(null);
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const debounceRef = useRef(null);
  const nightsRef = useRef(null);
  const destWrapRef = useRef(null);

  // Initialize fields when modal opens or startDate/initial props change
  useEffect(() => {
    if (!open) return;
    // Initialize destination input
    const initDest = (initialDestination || "").trim();
    setDestInput(initDest);
    // Initialize nights from props, guard minimum 1
    const n = Math.max(1, parseInt(String(initialNights || 1), 10));
    setNightsStr(String(n));
    // Reset selection state if prefilled
    if (initDest) {
      setSelectedDest({ name: initDest });
      setIsCreating(false);
    } else {
      setSelectedDest(null);
    }
    setError(null);
  }, [open, startDate, initialDestination, initialNights]);

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
      if (destInput.trim().length === 0) {
        setSuggestions([]);
        setSelectedDest(null);
        setShowMenu(false);
        return;
      }
      setLoading(true);
      try {
        const results = await api.getDestinations(destInput);
        setSuggestions(results || []);
        // Check if query matches exactly (case-insensitive)
        const exactMatch = results.find(
          (d) => d.name.toLowerCase() === destInput.trim().toLowerCase()
        );
        setSelectedDest(exactMatch || null);
        setIsCreating(!exactMatch && destInput.trim().length > 0);
        // Only show menu if there's text and results
        if (destInput.trim().length > 0) {
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
  }, [destInput]);

  // Autofocus Nights when modal opens
  useEffect(() => {
    if (open) setTimeout(() => nightsRef.current?.focus(), 0);
  }, [open]);

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
      
      const finalName = destInput.trim();
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
        let destinationName = destInput.trim();

        // If creating new destination
        if (isCreating || !selectedDest) {
          try {
            const created = await api.createDestination(destinationName);
            destinationName = created.name;
          } catch (err) {
            // If duplicate, fetch and use existing
            if (err.message.includes("already exists") || err.message.includes("duplicate")) {
              const results = await api.getDestinations(destinationName);
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
        const payload = {
          start_date: startDate,
          nights,
          destination: destinationName,
          overwrite: true,
        };
        await api.patchQuoteDays(qid, payload);

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
    setDestInput(name);
    setShowMenu(false);
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
          {/* Start Date (read-only) */}
          <div className="form-field field">
            <label>Start Date</label>
            <input type="text" value={startDate} readOnly className="readonly" />
          </div>

          {/* Nights FIRST */}
          <div className="form-field field">
            <label>Nights</label>
            <input
              ref={nightsRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={nightsStr}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, ""); // digits only; allow empty
                setNightsStr(v);
              }}
              placeholder="1"
            />
          </div>

          {/* Destination SECOND (typeahead) */}
          <div ref={destWrapRef} className="form-field dest-typeahead field" style={{ position: "relative" }}>
            <label>Destination</label>
            <input
              type="text"
              value={destInput}
              onChange={(e) => {
                const v = e.target.value;
                setDestInput(v);
                setSelectedDest(null);
                setShowMenu(!!v.trim());
              }}
              onFocus={() => setShowMenu(!!destInput?.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions.length > 0) {
                  e.preventDefault();
                  selectDestination(suggestions[0].name);
                }
              }}
              placeholder="Type a city"
              className="typeahead-input"
            />
            {loading && <div className="typeahead-loading">Loading...</div>}
            {showMenu && suggestions.length > 0 && (
              <div className="menu" style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "100%",
                maxHeight: 220,
                overflow: "auto",
                zIndex: 100000,
                background: "#222c42",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 6,
                marginTop: 4
              }}>
                {suggestions.map((opt) => (
                  <div
                    key={opt.id || opt.name}
                    className="typeahead-option menu-item"
                    onClick={() => selectDestination(opt.name)}
                  >
                    {opt.name}
                  </div>
                ))}
                {isCreating && (
                  <div
                    className="typeahead-option typeahead-create menu-item"
                    onClick={() => selectDestination(destInput.trim())}
                  >
                    Add new: <strong>{destInput.trim()}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prefill hint sentence, non-blocking */}
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 12 }}>
            {destInput?.trim()
              ? <>Apply "{destInput.trim()}" for {Math.max(1, parseInt(nightsStr || "1", 10))} night(s) from {startDate}.</>
              : <>Choose a destination and number of nights starting from {startDate}.</>}
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="dest-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <button className="btn secondary" onClick={onClose} disabled={applying}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleApply} disabled={loading || !destInput.trim() || applying}>
            {applying ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(backdrop, document.body);
}

