import React, { useState } from "react";
import HeaderHeroModal from "./modals/HeaderHeroModal";

export default function HeaderHero({ quote, setQuote, activeDest }) {
  const [modalOpen, setModalOpen] = useState(false);

  // Hide if no active destination
  if (!activeDest?.trim()) {
    return null;
  }

  const displayTitle = quote?.display_title || "";
  const heroPhoto1 = quote?.hero_photo_1 || "";
  const heroPhoto2 = quote?.hero_photo_2 || "";

  // Placeholder URL from Unsplash
  const placeholderUrl = "https://source.unsplash.com/303x198/?travel";

  const handleImageError = (e) => {
    // Replace with placeholder on error
    e.target.src = placeholderUrl;
  };

  return (
    <>
      <div className="hero-container">
        <div className="hero-title">{displayTitle || "Document Title"}</div>
        <div className="hero-photos">
          <div className="hero-photo-container">
            <img
              className="hero-photo"
              src={heroPhoto1 || placeholderUrl}
              alt="Hero 1"
              onError={handleImageError}
            />
            <button
              className="hero-edit-btn"
              onClick={() => setModalOpen(true)}
              title="Edit header"
            >
              ✏️
            </button>
          </div>
          <div className="hero-photo-container">
            <img
              className="hero-photo"
              src={heroPhoto2 || placeholderUrl}
              alt="Hero 2"
              onError={handleImageError}
            />
          </div>
        </div>
      </div>

      {modalOpen && (
        <HeaderHeroModal
          open={modalOpen}
          quote={quote}
          onClose={() => setModalOpen(false)}
          onSave={(changes) => {
            setQuote({ ...quote, ...changes });
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}

