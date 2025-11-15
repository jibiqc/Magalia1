import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { fmtDateShortISO } from "../../utils/dateFmt";
import "../../styles/quote.css";

// Helper: add days to ISO date string
function addDaysISO(iso, delta) {
  if (!iso) return iso;
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Number(delta || 0));
  return d.toISOString().slice(0, 10);
}

// Helper: get blocks of consecutive days with same destination
function getDestinationBlocks(days) {
  const blocks = [];
  let currentBlock = null;
  
  days.forEach((day, idx) => {
    const dest = day?.destination || "";
    if (!currentBlock || currentBlock.destination !== dest) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = {
        destination: dest,
        startIdx: idx,
        endIdx: idx,
        dayIds: [day.id]
      };
    } else {
      currentBlock.endIdx = idx;
      currentBlock.dayIds.push(day.id);
    }
  });
  
  if (currentBlock) blocks.push(currentBlock);
  return blocks;
}

// Helper: get first service title from a day
function getFirstServiceTitle(day) {
  if (!day?.lines || day.lines.length === 0) return null;
  const firstLine = day.lines[0];
  return firstLine?.title || null;
}

// Helper: recalculate dates based on new order, preserving the original first day's date as anchor
function recalculateDates(days, originalFirstDayDate) {
  if (!days || days.length === 0) return days;
  
  // Use the original first day's date as anchor (never changes)
  if (!originalFirstDayDate) {
    // If no original first day date, try to use current first day's date
    const firstDay = days[0];
    if (!firstDay?.date) return days; // No date available, can't recalculate
    const anchorDate = firstDay.date;
    return days.map((day, index) => {
      const dayOffset = index;
      const newDate = addDaysISO(anchorDate, dayOffset);
      return { ...day, date: newDate };
    });
  }
  
  // Always use the original first day's date as anchor
  const anchorDate = originalFirstDayDate;
  
  // Recalculate all dates based on position relative to original first day
  // First day (index 0) always gets the original first day's date
  return days.map((day, index) => {
    const dayOffset = index; // Offset from first day (0-based)
    const newDate = addDaysISO(anchorDate, dayOffset);
    return {
      ...day,
      date: newDate
    };
  });
}

export default function DayManagerModal({
  open,
  days: initialDays,
  onClose,
  onApply,
  onDeleteDay // Callback to handle day deletion (move services to trash)
}) {
  const [localDays, setLocalDays] = useState([]);
  const [originalFirstDayDate, setOriginalFirstDayDate] = useState(null); // Store original first day's date
  const [draggingDayId, setDraggingDayId] = useState(null);
  const [draggingBlockId, setDraggingBlockId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(-1);
  const [draggingType, setDraggingType] = useState(null); // 'day' or 'block'

  // Initialize local copy when modal opens and store original first day date
  useEffect(() => {
    if (open && initialDays) {
      const cloned = structuredClone(initialDays);
      setLocalDays(cloned);
      // Store the date of the first day in the original order
      setOriginalFirstDayDate(cloned[0]?.date || null);
    }
  }, [open, initialDays]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [open]);

  if (!open || !initialDays) {
    return null;
  }

  const blocks = getDestinationBlocks(localDays);

  // Handle day drag start
  const handleDayDragStart = (e, dayId, dayIndex) => {
    setDraggingDayId(dayId);
    setDraggingType('day');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'day', dayId, dayIndex }));
  };

  // Handle block drag start
  const handleBlockDragStart = (e, block) => {
    setDraggingBlockId(block.dayIds[0]);
    setDraggingType('block');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'block', block }));
  };

  // Handle drag over
  const handleDragOver = (e, targetIndex) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(targetIndex);
  };

  // Handle drop
  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      
      if (data.type === 'day') {
        // Reorder single day
        const sourceIndex = localDays.findIndex(d => d.id === data.dayId);
        if (sourceIndex === -1 || sourceIndex === targetIndex) {
          setDragOverIndex(-1);
          setDraggingDayId(null);
          setDraggingType(null);
          return;
        }
        
        const newDays = [...localDays];
        const [moved] = newDays.splice(sourceIndex, 1);
        newDays.splice(targetIndex, 0, moved);
        // Recalculate dates based on new order, preserving original first day date
        const recalculatedDays = recalculateDates(newDays, originalFirstDayDate);
        setLocalDays(recalculatedDays);
      } else if (data.type === 'block') {
        // Reorder entire block
        const block = data.block;
        const sourceStartIdx = block.startIdx;
        const sourceEndIdx = block.endIdx;
        const blockSize = sourceEndIdx - sourceStartIdx + 1;
        
        // Check if target is within the source block
        if (targetIndex >= sourceStartIdx && targetIndex <= sourceEndIdx) {
          // Dropping on the same block, no change needed
          setDragOverIndex(-1);
          setDraggingBlockId(null);
          setDraggingType(null);
          return;
        }
        
        const newDays = [...localDays];
        const blockDays = newDays.splice(sourceStartIdx, blockSize);
        
        // Calculate adjusted target index
        // If source was before target, we need to adjust because we removed items
        const adjustedTarget = sourceStartIdx < targetIndex 
          ? targetIndex - blockSize
          : targetIndex;
        
        // Ensure target index is valid
        const finalTarget = Math.max(0, Math.min(adjustedTarget, newDays.length));
        
        newDays.splice(finalTarget, 0, ...blockDays);
        // Recalculate dates based on new order, preserving original first day date
        const recalculatedDays = recalculateDates(newDays, originalFirstDayDate);
        setLocalDays(recalculatedDays);
      }
    } catch (err) {
      console.error('Error handling drop:', err);
    }
    
    setDragOverIndex(-1);
    setDraggingDayId(null);
    setDraggingBlockId(null);
    setDraggingType(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDragOverIndex(-1);
    setDraggingDayId(null);
    setDraggingBlockId(null);
    setDraggingType(null);
  };

  // Add day before
  const handleAddBefore = (dayIndex) => {
    if (localDays.length >= 90) {
      alert("Maximum 90 days allowed");
      return;
    }
    
    const refDay = localDays[dayIndex];
    const newDate = refDay?.date ? addDaysISO(refDay.date, -1) : null;
    const newDay = {
      id: crypto.randomUUID(),
      date: newDate,
      destination: refDay?.destination || "",
      lines: []
    };
    
    const newDays = [...localDays];
    newDays.splice(dayIndex, 0, newDay);
    // Recalculate dates based on new order, preserving original first day date
    const recalculatedDays = recalculateDates(newDays, originalFirstDayDate);
    setLocalDays(recalculatedDays);
  };

  // Add day after
  const handleAddAfter = (dayIndex) => {
    if (localDays.length >= 90) {
      alert("Maximum 90 days allowed");
      return;
    }
    
    const refDay = localDays[dayIndex];
    const newDate = refDay?.date ? addDaysISO(refDay.date, 1) : null;
    const newDay = {
      id: crypto.randomUUID(),
      date: newDate,
      destination: refDay?.destination || "",
      lines: []
    };
    
    const newDays = [...localDays];
    newDays.splice(dayIndex + 1, 0, newDay);
    // Recalculate dates based on new order
    const recalculatedDays = recalculateDates(newDays);
    setLocalDays(recalculatedDays);
  };

  // Delete day
  const handleDelete = (dayIndex) => {
    if (localDays.length <= 1) {
      alert("At least 1 day is required");
      return;
    }
    
    const dayToDelete = localDays[dayIndex];
    if (!confirm(`Delete day ${fmtDateShortISO(dayToDelete.date || '')}?`)) {
      return;
    }
    
    // Move services to trash via callback
    if (onDeleteDay && dayToDelete.lines && dayToDelete.lines.length > 0) {
      onDeleteDay(dayToDelete);
    }
    
    const newDays = [...localDays];
    newDays.splice(dayIndex, 1);
    // Recalculate dates based on new order, preserving original first day date
    const recalculatedDays = recalculateDates(newDays, originalFirstDayDate);
    setLocalDays(recalculatedDays);
  };

  // Shift all dates
  const handleShiftDates = (delta) => {
    const newDays = localDays.map(day => ({
      ...day,
      date: day.date ? addDaysISO(day.date, delta) : null
    }));
    setLocalDays(newDays);
    // Update the original first day date when shifting
    if (originalFirstDayDate) {
      setOriginalFirstDayDate(addDaysISO(originalFirstDayDate, delta));
    }
  };

  // Apply changes
  const handleApply = () => {
    // Normalize positions
    const normalized = localDays.map((day, idx) => ({
      ...day,
      position: idx
    }));
    onApply(normalized);
    onClose();
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
        if (e.target === e.currentTarget) onClose();
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0b1220",
          color: "#e6ecff",
          borderRadius: "16px",
          minWidth: "600px",
          maxWidth: "800px",
          maxHeight: "90vh",
          padding: "24px",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>Edit itinerary days</h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#e6ecff",
              cursor: "pointer",
              fontSize: "24px",
              padding: "0",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Shift controls */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          <button
            className="day-pill"
            onClick={() => handleShiftDates(-1)}
            disabled={!localDays.some(d => d.date)}
            style={{ flex: 1 }}
          >
            Shift −1 day
          </button>
          <button
            className="day-pill"
            onClick={() => handleShiftDates(+1)}
            disabled={!localDays.some(d => d.date)}
            style={{ flex: 1 }}
          >
            Shift +1 day
          </button>
        </div>

        {/* Blocks section */}
        {blocks.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "14px", fontWeight: 500, marginBottom: "8px", color: "var(--ink-dim)" }}>
              Destination blocks (drag to reorder)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {blocks.map((block, blockIdx) => {
                const isDragging = draggingType === 'block' && draggingBlockId === block.dayIds[0];
                return (
                  <div
                    key={`block-${block.startIdx}`}
                    draggable
                    onDragStart={(e) => handleBlockDragStart(e, block)}
                    onDragEnd={handleDragEnd}
                    style={{
                      padding: "8px 12px",
                      background: isDragging ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      cursor: "move",
                      fontSize: "13px",
                      opacity: isDragging ? 0.5 : 1,
                      border: "1px solid rgba(255,255,255,0.15)"
                    }}
                  >
                    {block.destination || "(No destination)"} — {block.dayIds.length} day{block.dayIds.length > 1 ? 's' : ''}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Days list */}
        <div style={{ flex: 1, overflowY: "auto", marginBottom: "20px" }}>
          <div style={{ fontSize: "14px", fontWeight: 500, marginBottom: "8px", color: "var(--ink-dim)" }}>
            Days (drag to reorder)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {localDays.map((day, dayIndex) => {
              const isDragging = draggingType === 'day' && draggingDayId === day.id;
              const isDragOver = dragOverIndex === dayIndex;
              const firstServiceTitle = getFirstServiceTitle(day);
              
              return (
                <div
                  key={day.id}
                  draggable
                  onDragStart={(e) => handleDayDragStart(e, day.id, dayIndex)}
                  onDragOver={(e) => handleDragOver(e, dayIndex)}
                  onDrop={(e) => handleDrop(e, dayIndex)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px",
                    background: isDragOver 
                      ? "rgba(255,255,255,0.15)" 
                      : isDragging 
                        ? "rgba(255,255,255,0.1)" 
                        : "rgba(255,255,255,0.05)",
                    borderRadius: "8px",
                    border: isDragOver ? "2px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.1)",
                    cursor: "move",
                    opacity: isDragging ? 0.5 : 1,
                    transition: "all 0.2s"
                  }}
                >
                  {/* Drag handle */}
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "grab",
                      color: "var(--ink-dim)"
                    }}
                  >
                    ⋮⋮
                  </div>
                  
                  {/* Day info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 500 }}>
                      {day.date ? fmtDateShortISO(day.date) : "(No date)"}
                      {day.destination && ` — ${day.destination}`}
                    </div>
                    {firstServiceTitle && (
                      <div style={{ fontSize: "12px", color: "var(--ink-dim)", marginTop: "2px" }}>
                        {firstServiceTitle}
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      onClick={() => handleAddBefore(dayIndex)}
                      disabled={localDays.length >= 90}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "4px",
                        color: "#e6ecff",
                        cursor: "pointer"
                      }}
                      title="Add day before"
                    >
                      + Before
                    </button>
                    <button
                      onClick={() => handleAddAfter(dayIndex)}
                      disabled={localDays.length >= 90}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "4px",
                        color: "#e6ecff",
                        cursor: "pointer"
                      }}
                      title="Add day after"
                    >
                      + After
                    </button>
                    <button
                      onClick={() => handleDelete(dayIndex)}
                      disabled={localDays.length <= 1}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        background: "#2a0f13",
                        border: "1px solid rgba(255,0,0,0.3)",
                        borderRadius: "4px",
                        color: "#ff8888",
                        cursor: localDays.length <= 1 ? "not-allowed" : "pointer",
                        opacity: localDays.length <= 1 ? 0.5 : 1
                      }}
                      title="Delete day"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              color: "#e6ecff",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            style={{
              padding: "10px 20px",
              background: "#2563eb",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500
            }}
          >
            Apply changes
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

