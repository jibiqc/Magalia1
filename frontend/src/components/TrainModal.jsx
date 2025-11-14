import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";
import TimeAmPmField from "./TimeAmPmField";
import RichTextEditor from "./RichTextEditor";

export default function TrainModal({
  open = true,
  onClose,
  onSubmit,
  initialData = null,
}) {
  // Initialiser avec des valeurs par défaut, pas avec initialData (pour éviter les duplications)
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [class_type, setClassType] = useState("");
  const [dep_time, setDepTime] = useState("");
  const [arr_time, setArrTime] = useState("");
  const [description, setDescription] = useState("");
  const [internal_note, setInternalNote] = useState("");
  // Tri-state radio: "with" | "without" | "none"
  const [seat_res_choice, setSeatChoice] = useState("with");

  // Mettre à jour l'état quand initialData change ou quand le modal s'ouvre (pour l'édition)
  useEffect(() => {
    if (open) {
      if (initialData) {
        setFrom(initialData.from || "");
        setTo(initialData.to || "");
        setClassType(initialData.class_type || "");
        setDepTime(initialData.dep_time || "");
        setArrTime(initialData.arr_time || "");
        setDescription(initialData.note || initialData.description || "");
        setInternalNote(initialData.internal_note || "");
        const seatChoice = initialData.seat_res_choice || (initialData.seat_res === true ? "with" : initialData.seat_res === false ? "without" : "with");
        setSeatChoice(seatChoice);
      } else {
        setFrom("");
        setTo("");
        setClassType("");
        setDepTime("");
        setArrTime("");
        setDescription("");
        setInternalNote("");
        setSeatChoice("with");
      }
    }
  }, [initialData, open]);

  if (!open) return null;

  const handleSubmit = () => {
    onSubmit({ from, to, class_type, dep_time, arr_time, seat_res_choice, note: description, description, internal_note });
  };

  const backdrop = (
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
      aria-modal="true"
      role="dialog"
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">Train</div>

        <div className="dest-modal-body" style={{ padding: 0 }}>
          <div className="field">
            <label>From</label>
            <input
              type="text"
              className="input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>To</label>
            <input
              type="text"
              className="input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder=""
            />
          </div>

          {/* Row: Class type (left)  |  Seat reservation (right) */}
          <div className="row-split">
            <div className="field">
              <label>Class type</label>
              <input
                type="text"
                className="input"
                value={class_type}
                onChange={(e) => setClassType(e.target.value)}
                placeholder="First Class Train"
              />
            </div>
            <div className="field seat-field">
              <label>Seat reservation</label>
              <div className="seatbox">
                <label className={`seatopt ${seat_res_choice==="with"?"active":""}`}>
                  <input type="radio" name="train-seat" className="sr-only" checked={seat_res_choice==="with"} onChange={()=>setSeatChoice("with")} />
                  <span>with seat reservations</span>
                </label>
                <label className={`seatopt ${seat_res_choice==="without"?"active":""}`}>
                  <input type="radio" name="train-seat" className="sr-only" checked={seat_res_choice==="without"} onChange={()=>setSeatChoice("without")} />
                  <span>without seat reservations (open seating)</span>
                </label>
                <label className={`seatopt ${seat_res_choice==="none"?"active":""}`}>
                  <input type="radio" name="train-seat" className="sr-only" checked={seat_res_choice==="none"} onChange={()=>setSeatChoice("none")} />
                  <span>do not precise</span>
                </label>
              </div>
            </div>
          </div>

          <TimeAmPmField label="Departure time" value24={dep_time} onChange={setDepTime} />

          <TimeAmPmField label="Arrival time" value24={arr_time} onChange={setArrTime} />

          <div className="field">
            <label>Description</label>
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder=""
              rows={3}
            />
          </div>

          <div className="field">
            <label>Internal note</label>
            <RichTextEditor
              value={internal_note}
              onChange={setInternalNote}
              placeholder=""
              rows={3}
            />
          </div>
        </div>

        <div className="actions">
          <button className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleSubmit}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(backdrop, document.body);
}

