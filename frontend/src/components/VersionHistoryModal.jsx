import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";

export default function VersionHistoryModal({ quoteId, isOpen, onClose }) {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // Load versions when modal opens
  useEffect(() => {
    if (isOpen && quoteId) {
      loadVersions(0);
    } else {
      // Reset state when modal closes
      setVersions([]);
      setSelectedVersion(null);
      setOffset(0);
      setError(null);
    }
  }, [isOpen, quoteId]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const loadVersions = async (newOffset = 0) => {
    if (!quoteId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.getQuoteVersions(quoteId, newOffset, limit, false);
      if (newOffset === 0) {
        setVersions(response.items || []);
      } else {
        setVersions((prev) => [...prev, ...(response.items || [])]);
      }
      setHasMore(response.has_more || false);
      setTotal(response.total || 0);
      setOffset(newOffset + (response.items?.length || 0));
    } catch (err) {
      console.error("[VersionHistoryModal] Error loading versions:", err);
      setError(err.detail || err.message || "Failed to load versions");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    loadVersions(offset);
  };

  const handleVersionClick = async (version) => {
    if (selectedVersion?.id === version.id) {
      setSelectedVersion(null);
      return;
    }
    // Load full version details if needed
    try {
      const detail = await api.getQuoteVersion(quoteId, version.id);
      setSelectedVersion(detail);
    } catch (err) {
      console.error("[VersionHistoryModal] Error loading version detail:", err);
      // Fallback to basic version data
      setSelectedVersion(version);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("fr-FR", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const formatType = (type) => {
    const typeMap = {
      manual: "Manuel",
      auto_export_word: "Export Word",
      auto_export_pdf: "Export PDF",
      auto_export_excel: "Export Excel",
      auto_initial: "Version initiale",
      auto_before_restore: "Avant restauration",
    };
    return typeMap[type] || type;
  };

  const truncateComment = (comment, maxLength = 60) => {
    if (!comment) return "";
    return comment.length > maxLength ? comment.substring(0, maxLength) + "..." : comment;
  };

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="version-history-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="version-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="version-history-header">
          <h2>Historique des versions</h2>
          <button className="close-button" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="version-history-content">
          <div className="version-list-container">
            {loading && versions.length === 0 ? (
              <div className="loading-state">Chargement...</div>
            ) : error ? (
              <div className="error-state">Erreur: {error}</div>
            ) : versions.length === 0 ? (
              <div className="empty-state">Aucune version disponible</div>
            ) : (
              <>
                <div className="version-list">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className={`version-row ${selectedVersion?.id === version.id ? "selected" : ""}`}
                      onClick={() => handleVersionClick(version)}
                    >
                      <div className="version-row-main">
                        <div className="version-label">{version.label}</div>
                        <div className="version-meta">
                          <span className="version-date">{formatDate(version.created_at)}</span>
                          {version.created_by && (
                            <span className="version-user"> • {version.created_by}</span>
                          )}
                          <span className="version-type"> • {formatType(version.type)}</span>
                        </div>
                        {version.comment && (
                          <div className="version-comment-preview">{truncateComment(version.comment)}</div>
                        )}
                        {version.total_price !== null && version.total_price !== undefined && (
                          <div className="version-price">
                            {new Intl.NumberFormat("fr-FR", {
                              style: "currency",
                              currency: "USD",
                            }).format(version.total_price)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {hasMore && (
                  <div className="load-more-container">
                    <button className="load-more-button" onClick={handleLoadMore} disabled={loading}>
                      {loading ? "Chargement..." : "Charger plus"}
                    </button>
                  </div>
                )}
                {total > 0 && (
                  <div className="version-count">
                    {versions.length} / {total} version{total > 1 ? "s" : ""}
                  </div>
                )}
              </>
            )}
          </div>

          {selectedVersion && (
            <div className="version-detail-panel">
              <div className="version-detail-header">
                <h3>Détails de {selectedVersion.label}</h3>
                <button className="close-detail-button" onClick={() => setSelectedVersion(null)}>
                  ×
                </button>
              </div>
              <div className="version-detail-content">
                <div className="detail-row">
                  <strong>Label:</strong> {selectedVersion.label}
                </div>
                <div className="detail-row">
                  <strong>Type:</strong> {formatType(selectedVersion.type)}
                </div>
                <div className="detail-row">
                  <strong>Date de création:</strong> {formatDate(selectedVersion.created_at)}
                </div>
                {selectedVersion.created_by && (
                  <div className="detail-row">
                    <strong>Créé par:</strong> {selectedVersion.created_by}
                  </div>
                )}
                {selectedVersion.export_type && (
                  <div className="detail-row">
                    <strong>Type d'export:</strong> {selectedVersion.export_type}
                  </div>
                )}
                {selectedVersion.export_file_name && (
                  <div className="detail-row">
                    <strong>Fichier:</strong> {selectedVersion.export_file_name}
                  </div>
                )}
                {selectedVersion.total_price !== null && selectedVersion.total_price !== undefined && (
                  <div className="detail-row">
                    <strong>Prix total:</strong>{" "}
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "USD",
                    }).format(selectedVersion.total_price)}
                  </div>
                )}
                {selectedVersion.comment && (
                  <div className="detail-row">
                    <strong>Commentaire:</strong>
                    <div className="detail-comment">{selectedVersion.comment}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .version-history-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          padding: 20px;
        }
        .version-history-modal {
          background: #0b1220;
          color: #e6ecff;
          border-radius: 16px;
          width: 100%;
          max-width: 1400px;
          height: 90vh;
          max-height: 900px;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(255, 255, 255, 0.08);
          pointer-events: auto;
          position: relative;
          z-index: 1;
        }
        .version-history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .version-history-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .close-button {
          background: none;
          border: none;
          color: #e6ecff;
          font-size: 32px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .close-button:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .version-history-content {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        .version-list-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          padding: 20px;
        }
        .version-list {
          flex: 1;
        }
        .version-row {
          background: #0f1729;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .version-row:hover {
          background: #141b2e;
          border-color: rgba(255, 255, 255, 0.15);
        }
        .version-row.selected {
          background: #1a2332;
          border-color: rgba(100, 150, 255, 0.5);
        }
        .version-row-main {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .version-label {
          font-size: 18px;
          font-weight: 600;
          color: #e6ecff;
        }
        .version-meta {
          font-size: 14px;
          color: #a0aec0;
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .version-comment-preview {
          font-size: 14px;
          color: #cbd5e0;
          margin-top: 4px;
        }
        .version-price {
          font-size: 16px;
          font-weight: 600;
          color: #68d391;
          margin-top: 4px;
        }
        .load-more-container {
          display: flex;
          justify-content: center;
          padding: 20px 0;
        }
        .load-more-button {
          background: #1a2332;
          color: #e6ecff;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 10px 20px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        .load-more-button:hover:not(:disabled) {
          background: #1f2937;
          border-color: rgba(255, 255, 255, 0.2);
        }
        .load-more-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .version-count {
          text-align: center;
          color: #a0aec0;
          font-size: 14px;
          padding: 12px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .version-detail-panel {
          width: 400px;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          background: #0f1729;
        }
        .version-detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .version-detail-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        .close-detail-button {
          background: none;
          border: none;
          color: #e6ecff;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .close-detail-button:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .version-detail-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        .detail-row {
          margin-bottom: 16px;
          font-size: 14px;
        }
        .detail-row strong {
          display: block;
          margin-bottom: 4px;
          color: #a0aec0;
          font-weight: 600;
        }
        .detail-comment {
          margin-top: 8px;
          padding: 12px;
          background: #0b1220;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .loading-state,
        .error-state,
        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #a0aec0;
          font-size: 16px;
        }
        .error-state {
          color: #fc8181;
        }
      `}</style>
    </div>,
    document.body
  );
}

