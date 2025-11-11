import React, { useState, useEffect } from "react";

export default function DayHero({ day, dayIdx, onEdit }) {
  // Exclude first day
  if (dayIdx === 0) return null;

  const imgs = Array.isArray(day?.decorative_images) ? day.decorative_images.slice(0, 2) : [];
  const hasAny = imgs.length > 0;
  // If no images, do not render container (per spec: show nothing on empty days)
  if (!hasAny) return null;

  // Local anti-flicker flags
  const [l1, setL1] = useState(false);
  const [l2, setL2] = useState(false);
  const [e1, setE1] = useState(false);
  const [e2, setE2] = useState(false);

  // Reset when urls change
  useEffect(() => { setL1(false); setE1(false); }, [imgs[0]]);
  useEffect(() => { setL2(false); setE2(false); }, [imgs[1]]);

  const p1 = imgs[0] || "";
  const p2 = imgs[1] || "";
  const ph = "https://source.unsplash.com/303x198/?travel";

  return (
    <div className="day-hero-wrapper" aria-label={`Day ${dayIdx + 1} photos`}>
      <div className="day-hero-container" style={{ backgroundImage: `url('${ph}')` }}>
        {p1 && !e1 && (
          <img
            className="day-hero-img"
            src={p1}
            alt=""
            onLoad={() => setL1(true)}
            onError={() => setE1(true)}
            style={{ opacity: l1 ? 1 : 0 }}
          />
        )}
      </div>
      <div className="day-hero-container" style={{ backgroundImage: `url('${ph}')` }}>
        {p2 && !e2 && (
          <img
            className="day-hero-img"
            src={p2}
            alt=""
            onLoad={() => setL2(true)}
            onError={() => setE2(true)}
            style={{ opacity: l2 ? 1 : 0 }}
          />
        )}
      </div>
      {/* Single edit button overlay for the whole hero block */}
      <button
        type="button"
        className="day-hero-edit-btn"
        onClick={onEdit}
        aria-label="Edit day photos"
        title="Edit day photos"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20l4.6-1.2 8.9-8.9a2.2 2.2 0 0 0 0-3.1l-.2-.2a2.2 2.2 0 0 0-3.1 0L5.3 15.5 4 20z"/>
          <path d="M13.5 6.5l4 4"/>
        </svg>
      </button>
    </div>
  );
}

