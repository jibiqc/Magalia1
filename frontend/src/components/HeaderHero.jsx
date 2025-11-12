import React, { useState, useCallback, useEffect, useRef } from "react";
import HeaderHeroModal from "./modals/HeaderHeroModal";
import { api } from "../lib/api";

// Icon component for edit button (matching ServiceCard style)
function Icon({ name, className = "", size = 18 }) {
  const common = { width: size, height: size, className, fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", role: "img" };
  if (name === "edit") {
    return (<svg viewBox="0 0 24 24" aria-label="Edit" {...common}><path d="M4 20l4.6-1.2 8.9-8.9a2.2 2.2 0 0 0 0-3.1l-.2-.2a2.2 2.2 0 0 0-3.1 0L5.3 15.5 4 20z"/><path d="M13.5 6.5l4 4"/><path d="M4 20h6"/></svg>);
  }
  return null;
}

export default function HeaderHero({ quote, setQuote, activeDest, showActionIcons = true, showImages = true }) {
  const [modalOpen, setModalOpen] = useState(false);

  const title = quote?.display_title || "";
  const p1 = quote?.hero_photo_1 || "";
  const p2 = quote?.hero_photo_2 || "";

  // Anti-flicker: track load/error state per image
  const [img1Loaded, setImg1Loaded] = useState(false);
  const [img2Loaded, setImg2Loaded] = useState(false);
  const [img1Error, setImg1Error] = useState(false);
  const [img2Error, setImg2Error] = useState(false);
  const img1Ref = useRef(null);
  const img2Ref = useRef(null);

  // Reset flags when URL changes
  const safeSet1 = useCallback(() => { setImg1Loaded(false); setImg1Error(false); }, []);
  const safeSet2 = useCallback(() => { setImg2Loaded(false); setImg2Error(false); }, []);
  useEffect(() => { safeSet1(); }, [p1, safeSet1]);
  useEffect(() => { safeSet2(); }, [p2, safeSet2]);

  // Check if images are already loaded (cached)
  useEffect(() => {
    if (img1Ref.current && img1Ref.current.complete && img1Ref.current.naturalWidth > 0 && !img1Loaded) {
      setImg1Loaded(true);
    }
  }, [p1, img1Loaded]);
  useEffect(() => {
    if (img2Ref.current && img2Ref.current.complete && img2Ref.current.naturalWidth > 0 && !img2Loaded) {
      setImg2Loaded(true);
    }
  }, [p2, img2Loaded]);

  // Suggest up to 2 photos when both empty: resolve dest_id(s) then GET /destinations/photos
  useEffect(() => {
    const bothEmpty = !p1 && !p2;
    if (!bothEmpty) return;
    // collect distinct destination names in quote
    const names = Array.from(
      new Set((quote?.days || []).map(d => (d?.destination || "").trim()).filter(Boolean))
    );
    if (names.length === 0) return;
    let aborted = false;
    (async () => {
      try {
        const destIds = [];
        for (const name of names) {
          // use existing API to fetch destinations by query and find exact match ignoring case
          const results = await api.getDestinations(name);
          const match = (results || []).find(d => d.name?.toLowerCase() === name.toLowerCase());
          if (match?.id) destIds.push(match.id);
        }
        const picks = [];
        for (const id of destIds) {
          if (picks.length >= 2) break;
          const photos = await api.getDestinationPhotos(id, 5);
          for (const ph of photos || []) {
            if (picks.length < 2 && ph?.photo_url) picks.push(ph.photo_url);
          }
        }
        if (!aborted && picks.length) {
          setQuote(prev => ({ ...prev, hero_photo_1: picks[0] || "", hero_photo_2: picks[1] || "", dirty: true }));
        }
      } catch {}
    })();
    return () => { aborted = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.id]); // run once per quote

  // Hide header when no active destination per UX rule
  if (!activeDest?.trim()) return null;

  return (
    <>
      <div className="hero-container">
        <div className="hero-title">{title || "Document Title"}</div>
        {showImages && (
        <div className="hero-photos">
          {/* Photo 1 with container-first placeholder and load gating */}
          <div
            className="hero-photo-container"
            style={{ backgroundImage: "url('https://source.unsplash.com/303x198/?travel')" }}
            aria-label="Header photo 1"
          >
            {p1 && !img1Error && (
              <img
                ref={img1Ref}
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
                ref={img2Ref}
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
          {showActionIcons && (
            <button
              type="button"
              className="icon-vert hero-edit"
              onClick={() => setModalOpen(true)}
              aria-label="Edit header"
              title="Edit header"
            >
              <Icon name="edit" />
            </button>
          )}
        </div>
        )}
      </div>

      {modalOpen && (
        <HeaderHeroModal
          open={modalOpen}
          quote={quote}
          activeDest={activeDest}
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

