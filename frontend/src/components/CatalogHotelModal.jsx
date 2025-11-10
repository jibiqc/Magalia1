import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function CatalogHotelModal({ open, onClose, onSubmit, initialData }) {
  const [form, setForm] = useState(() => ({ ...(initialData || {}) }));

  useEffect(() => {
    setForm({ ...(initialData || {}) });
  }, [initialData]);

  const hotelName = initialData?.hotel_name || initialData?.hotelName || "";
  const stars = initialData?.stars || 0;
  const website = initialData?.website || "";

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" style={{pointerEvents: 'auto'}} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal-card dest-modal" style={{pointerEvents: 'auto'}} onClick={(e) => e.stopPropagation()}>
        <h2>{`${hotelName} – ${stars || 0}*`}</h2>
        {website ? (
          <div style={{ marginTop: -8, marginBottom: 10 }}>
            <a href={website} target="_blank" rel="noreferrer">{website}</a>
          </div>
        ) : null}

        <label className="label">Room name</label>
        <input type="text" value={form.room_name || ""} onChange={e=>setForm(f=>({...f, room_name:e.target.value}))} />

        <div className="grid grid-2">
          <div>
            <label className="label">Check-in date</label>
            <input type="date" value={form.check_in || ""} onChange={e=>setForm(f=>({...f, check_in:e.target.value}))} />
          </div>
          <div>
            <label className="label">Check-out date</label>
            <input type="date" value={form.check_out || ""} onChange={e=>setForm(f=>({...f, check_out:e.target.value}))} />
          </div>
        </div>

        <div className="grid grid-2">
          <label className="checkbox">
            <input type="checkbox" checked={!!form.breakfast} onChange={e=>setForm(f=>({...f, breakfast:e.target.checked}))} />
            &nbsp;Breakfast included
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={!!form.early_checkin} onChange={e=>setForm(f=>({...f, early_checkin:e.target.checked}))} />
            &nbsp;Early check-in
          </label>
        </div>

        <label className="label">Description</label>
        <textarea rows={6} style={{width:"100%"}}
                  value={form.description || ""} onChange={e=>setForm(f=>({...f, description:e.target.value}))} />

        <label className="label">Internal note</label>
        <textarea rows={3} style={{width:"100%"}}
                  value={form.internal_note || ""} onChange={e=>setForm(f=>({...f, internal_note:e.target.value}))} />

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={() => onSubmit({
            room_name: form.room_name?.trim() || '',
            description: form.description?.trim() || '',
            website: initialData.website || '',        // lien affiché, pas édité
            check_in: form.check_in,
            check_out: form.check_out,
            breakfast: !!form.breakfast,
            early_checkin: !!form.early_checkin,
            stars: Number(initialData.stars)||0,
            hotel_name: initialData.hotel_name || initialData.hotelName || ''
          })}>
            Continue
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

