import React, { useState, useCallback, useEffect } from "react";
import HeaderHeroModal from "./modals/HeaderHeroModal";

// Icon component for edit button (matching ServiceCard style)
function Icon({ name, className = "", size = 18 }) {
  const common = { width: size, height: size, className, fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", role: "img" };
  if (name === "edit") {
    return (<svg viewBox="0 0 24 24" aria-label="Edit" {...common}><path d="M4 20l4.6-1.2 8.9-8.9a2.2 2.2 0 0 0 0-3.1l-.2-.2a2.2 2.2 0 0 0-3.1 0L5.3 15.5 4 20z"/><path d="M13.5 6.5l4 4"/><path d="M4 20h6"/></svg>);
  }
  return null;
}

export default function HeaderHero({ quote, setQuote, activeDest }) {
  const [modalOpen, setModalOpen] = useState(false);

  const title = quote?.display_title || "";
  const p1 = quote?.hero_photo_1 || "";
  const p2 = quote?.hero_photo_2 || "";

  // Anti-flicker: track load/error state per image
  const [img1Loaded, setImg1Loaded] = useState(false);
  const [img2Loaded, setImg2Loaded] = useState(false);
  const [img1Error, setImg1Error] = useState(false);
  const [img2Error, setImg2Error] = useState(false);

  // Reset flags when URL changes
  const safeSet1 = useCallback(() => { setImg1Loaded(false); setImg1Error(false); }, []);
  const safeSet2 = useCallback(() => { setImg2Loaded(false); setImg2Error(false); }, []);
  useEffect(() => { safeSet1(); }, [p1, safeSet1]);
  useEffect(() => { safeSet2(); }, [p2, safeSet2]);

  // Hide header when no active destination per UX rule
  if (!activeDest?.trim()) return null;

  return (
    <>
      <div className="hero-container">
        <div className="hero-title">{title || "Document Title"}</div>
        <div className="hero-photos">
          {/* Photo 1 with container-first placeholder and load gating */}
          <div
            className="hero-photo-container"
            style={{ backgroundImage: "url('https://source.unsplash.com/303x198/?travel')" }}
            aria-label="Header photo 1"
          >
            {p1 && !img1Error && (
              <img
                className="hero-photo"
                src={p1}
                alt=""
                onLoad={() => setImg1Loaded(true)}
                onError={() => setImg1Error(true)}
                style={{ opacity: img1Loaded ? 1 : 0 }}
              />
            )}
          </div>

          {/* Photo 2 with container-first placeholder and load gating */}
          <div
            className="hero-photo-container"
            style={{ backgroundImage: "url('https://source.unsplash.com/303x198/?travel')" }}
            aria-label="Header photo 2"
          >
            {p2 && !img2Error && (
              <img
                className="hero-photo"
                src={p2}
                alt=""
                onLoad={() => setImg2Loaded(true)}
                onError={() => setImg2Error(true)}
                style={{ opacity: img2Loaded ? 1 : 0 }}
              />
            )}
          </div>

          {/* Single edit button overlay for the whole hero block.
              Reuse the same visual class as services: .icon-vert */}
          <button
            type="button"
            className="icon-vert hero-edit"
            onClick={() => setModalOpen(true)}
            aria-label="Edit header"
            title="Edit header"
          >
            <Icon name="edit" />
          </button>
        </div>
      </div>

      {modalOpen && (
        <HeaderHeroModal
          open={modalOpen}
          quote={quote}
          onClose={() => setModalOpen(false)}
          onSave={(changes) => {
            // Parent update without flicker
            setQuote((prev) => ({ ...prev, ...changes }));
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}

