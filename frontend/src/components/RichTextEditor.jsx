import React, { useRef, useEffect, useState } from "react";

export default function RichTextEditor({ value = "", onChange, placeholder = "", rows = 3, maxLength }) {
  const editorRef = useRef(null);
  const [html, setHtml] = useState(value);

  useEffect(() => {
    // Toujours mettre à jour le contenu quand value change
    const currentHtml = editorRef.current?.innerHTML || "";
    const normalizedValue = value || "";
    
    // Comparer le HTML normalisé pour éviter les mises à jour inutiles
    if (currentHtml !== normalizedValue) {
      setHtml(normalizedValue);
      if (editorRef.current) {
        editorRef.current.innerHTML = normalizedValue;
      }
    }
  }, [value]);

  const handleInput = (e) => {
    const newHtml = e.target.innerHTML;
    setHtml(newHtml);
    onChange?.(newHtml);
  };

  const execCommand = (cmd, value = null) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const handleLink = () => {
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().trim().length > 0;
    
    let url = prompt(
      hasSelection 
        ? "Entrez l'URL du lien pour le texte sélectionné:" 
        : "Entrez l'URL du lien:",
      "https://"
    );
    
    if (url) {
      // Si pas de sélection, on crée un lien avec l'URL comme texte
      if (!hasSelection) {
        const linkText = prompt("Entrez le texte du lien:", url);
        if (linkText) {
          execCommand("insertHTML", `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`);
        }
      } else {
        execCommand("createLink", url);
        // S'assurer que les liens s'ouvrent dans un nouvel onglet
        const links = editorRef.current?.querySelectorAll("a");
        links?.forEach(link => {
          if (!link.target) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          }
        });
      }
    }
  };

  const ToolbarButton = ({ cmd, value, onClick, children, title }) => (
    <button
      type="button"
      className="rich-text-toolbar-btn"
      onClick={onClick || (() => execCommand(cmd, value))}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar">
        <ToolbarButton cmd="bold" title="Gras">
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton cmd="italic" title="Italique">
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton cmd="underline" title="Souligné">
          <u>U</u>
        </ToolbarButton>
        <div className="rich-text-toolbar-separator" />
        <ToolbarButton cmd="foreColor" value="#000000" title="Couleur du texte">
          <span style={{ color: "#000" }}>A</span>
        </ToolbarButton>
        <ToolbarButton cmd="backColor" value="#ffff00" title="Surlignage">
          <span style={{ backgroundColor: "#ffff00" }}>A</span>
        </ToolbarButton>
        <div className="rich-text-toolbar-separator" />
        <ToolbarButton
          onClick={handleLink}
          title="Insérer un lien"
        >
          🔗
        </ToolbarButton>
        <div className="rich-text-toolbar-separator" />
        <ToolbarButton cmd="removeFormat" title="Supprimer le formatage">
          ✕
        </ToolbarButton>
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="rich-text-editor-content textarea input-internal-note"
        onInput={handleInput}
        data-placeholder={placeholder}
        style={{
          minHeight: `${rows * 1.5}em`,
          maxHeight: "300px",
          overflowY: "auto",
          padding: "8px 12px",
          border: "1px solid #ccc",
          borderTop: "none",
          borderRadius: "0 0 4px 4px",
          outline: "none",
          background: "#ffffff",
          color: "#1f2937",
        }}
        suppressContentEditableWarning
      />
      {maxLength && (
        <div className="char-counter">
          {(html?.replace(/<[^>]*>/g, "").length || 0)}/{maxLength}
        </div>
      )}
    </div>
  );
}

