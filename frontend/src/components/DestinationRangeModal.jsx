import React, { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";

export default function DestinationRangeModal({
  open = true,
  quoteId,
  startDate,
  ensureQuoteId,
  onClose,
  onApplied,
}) {
  if (!open) return null;

  const [query, setQuery] = useState("");
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nights, setNights] = useState(1);
  const [selectedDest, setSelectedDest] = useState(null);
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Debounced fetch destinations
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(async () => {
      if (query.trim().length === 0) {
        setDestinations([]);
        setSelectedDest(null);
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
      await api.patchQuoteDays(qid, {
        start_date: startDate,
        nights: nights,
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
  };

  const handleSelectDestination = (dest) => {
    setQuery(dest.name);
    setSelectedDest(dest);
    setIsCreating(false);
  };

  return (
    <div
      id="dest-range-modal-root"
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <div className="modal-title">Set destination</div>

        <div className="modal-body">
          <div className="form-field">
            <label>Start Date</label>
            <input type="text" value={startDate} readOnly className="readonly" />
          </div>

          <div className="form-field">
            <label>Destination</label>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedDest(null);
              }}
              placeholder="Type to search..."
              className="typeahead-input"
            />
            {loading && <div className="typeahead-loading">Loading...</div>}
            {!loading && query.trim().length > 0 && (
              <div className="typeahead-dropdown">
                {destinations.length > 0 && (
                  <>
                    {destinations.map((dest) => (
                      <div
                        key={dest.id}
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
                    onClick={() => {
                      setSelectedDest({ name: query.trim() });
                      setIsCreating(true);
                    }}
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
              type="number"
              min="1"
              value={nights}
              onChange={(e) => setNights(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="modal-footer">
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
}

