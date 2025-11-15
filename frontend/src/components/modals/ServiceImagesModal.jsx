import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api";

export default function ServiceImagesModal({ open, serviceId, serviceName, images: initialImages, onClose, onImageSelected }) {
  const [images, setImages] = useState(initialImages || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedImageId, setSelectedImageId] = useState(null); // ID de l'image sélectionnée

  // Reload images when modal opens or serviceId changes
  useEffect(() => {
    if (open && serviceId) {
      loadImages();
    }
  }, [open, serviceId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setNewImageUrl("");
      setError("");
      setSelectedImageId(null);
    }
  }, [open]);

  // Set selected image to first available image when images load
  useEffect(() => {
    if (images.length > 0 && !selectedImageId) {
      // Sélectionner la première image disponible par défaut
      setSelectedImageId(images[0].id);
    }
  }, [images, selectedImageId]);

  const loadImages = async () => {
    if (!serviceId) return;
    setLoading(true);
    setError("");
    try {
      const service = await api.getServiceById(serviceId);
      setImages(service.images || []);
    } catch (err) {
      setError("Failed to load images. Please try again.");
      console.error("[ServiceImagesModal] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const urlOk = (u) => {
    if (!u || !u.trim()) return false;
    if (u.length > 500) return false;
    try {
      const x = new URL(u);
      return x.protocol === "http:" || x.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleAddImage = async () => {
    if (!urlOk(newImageUrl)) {
      setError("Invalid URL (http/https only, ≤500 chars, required)");
      return;
    }

    setAdding(true);
    setError("");
    try {
      const newImage = await api.addServiceImage(serviceId, {
        url: newImageUrl.trim(),
        caption: null
      });
      
      console.log("[ServiceImagesModal] Image added successfully:", newImage);
      
      // Save the URL before resetting the form
      const addedUrl = newImageUrl.trim();
      
      // Reset form
      setNewImageUrl("");
      
      // Reload images to get the updated list
      console.log("[ServiceImagesModal] Reloading images after add...");
      const service = await api.getServiceById(serviceId);
      const updatedImages = service.images || [];
      console.log("[ServiceImagesModal] Updated images list:", updatedImages);
      console.log("[ServiceImagesModal] Number of images:", updatedImages.length);
      console.log("[ServiceImagesModal] Manual images:", updatedImages.filter(img => img.source === "manual"));
      
      setImages(updatedImages);
      
      // Select the newly added image
      if (newImage?.id) {
        console.log("[ServiceImagesModal] Selecting image by ID:", newImage.id);
        setSelectedImageId(newImage.id);
      } else {
        // Fallback: find by URL
        const found = updatedImages.find(img => img.url === addedUrl);
        console.log("[ServiceImagesModal] Looking for image by URL:", addedUrl, "Found:", found);
        if (found) {
          setSelectedImageId(found.id);
        }
      }
      
    } catch (err) {
      const errorMsg = err.detail || err.message || "Failed to add image. Please try again.";
      setError(errorMsg);
      console.error("[ServiceImagesModal] Add error:", err);
      console.error("[ServiceImagesModal] Full error object:", JSON.stringify(err, null, 2));
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!confirm("Are you sure you want to delete this image?")) {
      return;
    }

    setDeletingId(imageId);
    setError("");
    try {
      await api.deleteServiceImage(serviceId, imageId);
      // Reload images
      await loadImages();
    } catch (err) {
      setError(err.detail || err.message || "Failed to delete image. Please try again.");
      console.error("[ServiceImagesModal] Delete error:", err);
    } finally {
      setDeletingId(null);
    }
  };

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

  if (!open || !serviceId) {
    return null;
  }

  const importedImages = images.filter(img => img.source === "import");
  const manualImages = images.filter(img => img.source === "manual");
  
  // Debug logs
  useEffect(() => {
    console.log("[ServiceImagesModal] Images state changed:", images);
    console.log("[ServiceImagesModal] Total images:", images.length);
    console.log("[ServiceImagesModal] Imported images count:", importedImages.length);
    console.log("[ServiceImagesModal] Manual images count:", manualImages.length);
    console.log("[ServiceImagesModal] All images with source:", images.map(img => ({ id: img.id, url: img.url?.substring(0, 50), source: img.source })));
  }, [images]);

  const truncateUrl = (url, maxLength = 50) => {
    if (!url) return "";
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + "...";
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
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "800px", width: "90%", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-title">Service Images: {serviceName || `Service #${serviceId}`}</div>

        {loading && (
          <div style={{ padding: "20px", textAlign: "center", color: "#999" }}>
            Loading images...
          </div>
        )}

        {error && (
          <div style={{ padding: "12px", margin: "12px 0", background: "rgba(255,0,0,0.1)", color: "#ff6b6b", borderRadius: "8px" }}>
            {error}
          </div>
        )}

        {!loading && (
          <>
            {/* Selected Image Preview (smaller, at the top) */}
            {selectedImageId && (() => {
              const selectedImg = images.find(img => img.id === selectedImageId);
              if (!selectedImg) return null;
              return (
                <div style={{ marginTop: "20px", marginBottom: "24px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 500, marginBottom: "8px", color: "#ccc" }}>
                    Selected image
                  </div>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "300px",
                      aspectRatio: "16/9",
                      borderRadius: "8px",
                      overflow: "hidden",
                      background: "rgba(255,255,255,0.05)",
                      border: "2px solid var(--accent, #4a9eff)",
                      boxShadow: "0 0 0 2px rgba(74, 158, 255, 0.2)"
                    }}
                  >
                    <img
                      src={selectedImg.url}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block"
                      }}
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.parentElement.innerHTML = '<div style="padding: 40px; color: #999; text-align: center;">Image not available</div>';
                      }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Imported Images Section */}
            <div style={{ marginTop: "20px" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: 600, color: "#e6ecff" }}>
                Imported photo(s)
              </h3>
              {importedImages.length === 0 ? (
                <div style={{ padding: "12px", color: "#999", fontStyle: "italic" }}>
                  No imported images
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                  {importedImages.map((img) => (
                    <div
                      key={img.id}
                      onClick={() => setSelectedImageId(img.id)}
                      style={{
                        border: selectedImageId === img.id ? "2px solid var(--accent, #4a9eff)" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        padding: "8px",
                        background: selectedImageId === img.id ? "rgba(74, 158, 255, 0.1)" : "rgba(255,255,255,0.02)",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: selectedImageId === img.id ? "0 0 0 2px rgba(74, 158, 255, 0.2)" : "none"
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "16/9",
                          background: "rgba(255,255,255,0.05)",
                          borderRadius: "4px",
                          overflow: "hidden",
                          marginBottom: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        {img.url ? (
                          <img
                            src={img.url}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover"
                            }}
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.parentElement.innerHTML = '<div style="padding: 20px; color: #999; text-align: center;">Image not available</div>';
                            }}
                          />
                        ) : (
                          <div style={{ padding: "20px", color: "#999", textAlign: "center" }}>
                            No image
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "#999", wordBreak: "break-all" }}>
                        {truncateUrl(img.url)}
                      </div>
                      {img.caption && (
                        <div style={{ fontSize: "12px", color: "#ccc", marginTop: "4px" }}>
                          {img.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manual Images Section */}
            <div style={{ marginTop: "32px" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: 600, color: "#e6ecff" }}>
                Manual photo(s)
              </h3>
              {manualImages.length === 0 ? (
                <div style={{ padding: "12px", color: "#999", fontStyle: "italic" }}>
                  No manual images yet
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "20px" }}>
                  {manualImages.map((img) => (
                    <div
                      key={img.id}
                      onClick={() => setSelectedImageId(img.id)}
                      style={{
                        border: selectedImageId === img.id ? "2px solid var(--accent, #4a9eff)" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        padding: "8px",
                        background: selectedImageId === img.id ? "rgba(74, 158, 255, 0.1)" : "rgba(255,255,255,0.02)",
                        position: "relative",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: selectedImageId === img.id ? "0 0 0 2px rgba(74, 158, 255, 0.2)" : "none"
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(img.id);
                        }}
                        disabled={deletingId === img.id}
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          background: "rgba(255,0,0,0.8)",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          width: "24px",
                          height: "24px",
                          cursor: deletingId === img.id ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px",
                          opacity: deletingId === img.id ? 0.5 : 1,
                          zIndex: 10
                        }}
                        title="Delete image"
                      >
                        ×
                      </button>
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "16/9",
                          background: "rgba(255,255,255,0.05)",
                          borderRadius: "4px",
                          overflow: "hidden",
                          marginBottom: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        {img.url ? (
                          <img
                            src={img.url}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover"
                            }}
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.parentElement.innerHTML = '<div style="padding: 20px; color: #999; text-align: center;">Image not available</div>';
                            }}
                          />
                        ) : (
                          <div style={{ padding: "20px", color: "#999", textAlign: "center" }}>
                            No image
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "#999", wordBreak: "break-all" }}>
                        {truncateUrl(img.url)}
                      </div>
                      {img.caption && (
                        <div style={{ fontSize: "12px", color: "#ccc", marginTop: "4px" }}>
                          {img.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add Image Form */}
              <div style={{ marginTop: "20px", padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ marginBottom: "12px", fontSize: "14px", fontWeight: 500 }}>
                  Add new image
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "#ccc" }}>
                      Image URL *
                    </label>
                    <input
                      type="url"
                      value={newImageUrl}
                      onChange={(e) => {
                        setNewImageUrl(e.target.value);
                        setError("");
                      }}
                      placeholder="https://..."
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        color: "#e6ecff",
                        fontSize: "14px"
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddImage}
                    disabled={adding || !newImageUrl.trim()}
                    style={{
                      padding: "10px 20px",
                      background: adding || !newImageUrl.trim() ? "rgba(255,255,255,0.1)" : "var(--accent, #4a9eff)",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: adding || !newImageUrl.trim() ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: 500,
                      opacity: adding || !newImageUrl.trim() ? 0.5 : 1
                    }}
                  >
                    {adding ? "Adding..." : "Add image"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => {
              // If an image is selected, call onImageSelected callback
              if (selectedImageId && onImageSelected) {
                const selectedImg = images.find(img => img.id === selectedImageId);
                if (selectedImg) {
                  onImageSelected(selectedImg);
                }
              }
              onClose?.();
            }}
            disabled={loading || adding}
            style={{
              padding: "10px 20px",
              background: "rgba(255,255,255,0.1)",
              color: "#e6ecff",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
              cursor: loading || adding ? "not-allowed" : "pointer",
              fontSize: "14px",
              opacity: loading || adding ? 0.5 : 1
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

