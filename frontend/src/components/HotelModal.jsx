import React, { useState } from "react";
import { createPortal } from "react-dom";

export default function HotelModal({ open, onClose, onSubmit, initialData }) {
  const [hotel_name, setHotelName] = useState(initialData?.hotel_name || "");
  const [stars, setStars] = useState(initialData?.stars || 0);
  const [room_type, setRoomType] = useState(initialData?.room_type || "");
  const [breakfast, setBreakfast] = useState(!!initialData?.breakfast);
  const [hotel_url, setHotelUrl] = useState(initialData?.hotel_url || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [internal_note, setInternalNote] = useState(initialData?.internal_note || "");

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-card dest-modal">
        <h2>New Hotel</h2>

        <label className="label">Hotel name</label>
        <input value={hotel_name} onChange={e=>setHotelName(e.target.value)} />

        <label className="label">Stars</label>
        <input type="number" min={0} max={5} value={stars} onChange={e=>setStars(+e.target.value||0)} />

        <label className="label">Room type</label>
        <input value={room_type} onChange={e=>setRoomType(e.target.value)} />

        <label className="checkbox">
          <input type="checkbox" checked={breakfast} onChange={e=>setBreakfast(e.target.checked)} />
          &nbsp;Breakfast included
        </label>

        <label className="label">Website</label>
        <input value={hotel_url} onChange={e=>setHotelUrl(e.target.value)} />

        <label className="label">Description</label>
        <textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} />

        <label className="label">Internal note</label>
        <textarea rows={3} value={internal_note} onChange={e=>setInternalNote(e.target.value)} />

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={()=>onSubmit({ hotel_name, stars, room_type, breakfast, hotel_url, description, internal_note })}>
            Continue
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
