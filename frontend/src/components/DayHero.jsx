import React, { useState, useEffect, useRef } from "react";

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
  const img1Ref = useRef(null);
  const img2Ref = useRef(null);

  // Reset when urls change
  useEffect(() => { setL1(false); setE1(false); }, [imgs[0]]);
  useEffect(() => { setL2(false); setE2(false); }, [imgs[1]]);

  // Check if images are already loaded (cached)
  useEffect(() => {
    if (img1Ref.current && img1Ref.current.complete && img1Ref.current.naturalWidth > 0 && !l1) {
      setL1(true);
    }
  }, [imgs[0], l1]);
  useEffect(() => {
    if (img2Ref.current && img2Ref.current.complete && img2Ref.current.naturalWidth > 0 && !l2) {
      setL2(true);
    }
  }, [imgs[1], l2]);

  const p1 = imgs[0] || "";
  const p2 = imgs[1] || "";
  const ph = "https://source.unsplash.com/303x198/?travel";

  return (
    <div className="day-hero-wrapper" aria-label={`Day ${dayIdx + 1} photos`}>
      <div className="day-hero-container" style={{ backgroundImage: `url('${ph}')` }}>
        {p1 && !e1 && (
          <img
            ref={img1Ref}
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
            ref={img2Ref}
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

