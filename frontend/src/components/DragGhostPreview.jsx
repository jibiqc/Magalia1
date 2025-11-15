import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * DragGhostPreview - Affiche un aperçu "ghost" de la carte pendant le drag
 * 
 * @param {Object} props
 * @param {HTMLElement} props.sourceElement - L'élément source qui est en train d'être dragué
 * @param {Object} props.position - { x, y } position du curseur
 * @param {boolean} props.visible - Si le ghost doit être visible
 */
export default function DragGhostPreview({ sourceElement, position, visible }) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [previewContent, setPreviewContent] = useState(null);
  const ghostRef = useRef(null);

  // Capturer les dimensions et le contenu de l'élément source
  useEffect(() => {
    if (!sourceElement || !visible) {
      setDimensions({ width: 0, height: 0 });
      setPreviewContent(null);
      return;
    }

    const rect = sourceElement.getBoundingClientRect();
    setDimensions({
      width: rect.width,
      height: rect.height
    });

    // Extraire le contenu textuel principal de la carte
    const serviceCard = sourceElement.querySelector('.service-card');
    if (serviceCard) {
      const titleEl = serviceCard.querySelector('.service-title');
      const subtitleEl = serviceCard.querySelector('.service-subtitle');
      const noteEl = serviceCard.querySelector('.service-note');
      
      const title = titleEl?.textContent?.trim() || '';
      const subtitle = subtitleEl?.textContent?.trim() || '';
      const note = noteEl?.textContent?.trim()?.substring(0, 100) || '';
      
      setPreviewContent({ title, subtitle, note });
    } else {
      // Fallback: utiliser le texte de l'élément
      setPreviewContent({
        title: sourceElement.textContent?.substring(0, 80) || 'Service',
        subtitle: '',
        note: ''
      });
    }
  }, [sourceElement, visible]);

  if (!visible || !position || dimensions.width === 0 || !previewContent) {
    return null;
  }

  const style = {
    position: 'fixed',
    left: `${position.x - dimensions.width / 2}px`,
    top: `${position.y - 20}px`,
    width: `${dimensions.width}px`,
    maxWidth: `${dimensions.width}px`,
    minHeight: `${Math.min(dimensions.height, 150)}px`,
    opacity: 0.85,
    pointerEvents: 'none',
    zIndex: 100000,
    transform: 'rotate(1.5deg)',
    transition: 'none',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), 0 0 0 2px rgba(110, 168, 255, 0.3)',
    borderRadius: '10px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(110, 168, 255, 0.2)',
    overflow: 'hidden',
    padding: '10px',
    fontFamily: 'Arial, sans-serif',
    fontSize: '10pt',
    color: '#002060'
  };

  return createPortal(
    <div
      ref={ghostRef}
      className="drag-ghost-preview"
      style={style}
    >
      {previewContent.title && (
        <div style={{ 
          fontWeight: 700, 
          color: '#002060', 
          marginBottom: previewContent.subtitle ? '4px' : '0',
          fontSize: '10pt',
          lineHeight: '1.3'
        }}>
          {previewContent.title}
        </div>
      )}
      {previewContent.subtitle && (
        <div style={{ 
          fontSize: '9pt', 
          color: '#002060', 
          opacity: 0.8,
          marginBottom: '4px',
          lineHeight: '1.3'
        }}>
          {previewContent.subtitle}
        </div>
      )}
      {previewContent.note && (
        <div style={{ 
          fontSize: '9pt', 
          color: '#002060', 
          opacity: 0.7,
          lineHeight: '1.3',
          marginTop: '4px'
        }}>
          {previewContent.note}
        </div>
      )}
    </div>,
    document.body
  );
}

