import React, { useState, useEffect } from "react";

export default function CarRentalModal({
  open = true,
  onClose,
  onSubmit,
  initialData = null,
  startDate = null,
}) {
  if (!open) return null;

  // --- dates par défaut
  const initialDrop = initialData?.dropoff_date || (startDate
    ? (() => { const d=new Date(`${startDate}T00:00:00`); d.setDate(d.getDate()+1); return d.toISOString().split("T")[0];})()
    : ""
  );

  const [pickup_loc, setPickupLoc]     = useState(initialData?.pickup_loc || "");
  const [dropoff_loc, setDropoffLoc]   = useState(initialData?.dropoff_loc || "");
  const [pickup_date, setPickupDate]   = useState(initialData?.pickup_date || startDate || "");
  const [pickup_time, setPickupTime]   = useState(initialData?.pickup_time || "");
  const [dropoff_date, setDropoffDate] = useState(initialDrop);
  const [dropoff_time, setDropoffTime] = useState(initialData?.dropoff_time || "");
  // par défaut, Expected = Drop-off
  const [expected_dropoff_date, setExpected] =
    useState(initialData?.expected_dropoff_date || initialDrop);

  // Si l'utilisateur renseigne Drop-off date et que Expected est vide, on le préremplit
  useEffect(()=>{
    if (dropoff_date && !expected_dropoff_date) setExpected(dropoff_date);
  }, [dropoff_date]); // eslint-disable-line

  // NOTE: "Manual" en majuscule pour que le binding fonctionne
  const [transmission, setTransmission] = useState(
    initialData?.transmission || "Automatic"
  );
  const [vehicle_type, setVehicleType]  = useState(initialData?.vehicle_type || "");
  const [one_way_fee, setOneWayFee]     = useState(initialData?.one_way_fee || "");
  // défauts demandés
  const [mileage, setMileage]           = useState(initialData?.mileage || "unlimited mileage");
  const [insurance, setInsurance]       = useState(initialData?.insurance || "CDW & theft included");
  const [description, setDescription]   = useState(initialData?.notes || initialData?.description || "");
  const [intl_driver_license, setIDL]   = useState(
    initialData?.intl_driver_license !== undefined ? initialData.intl_driver_license : true
  );
  const [internal_note, setInternalNote] = useState(initialData?.internal_note || "");

  // quand l'utilisateur choisit la Drop-off date, si Expected est vide → on l'aligne
  const onChangeDropoffDate = (v) => {
    setDropoffDate(v);
    if (!expected_dropoff_date) setExpected(v);
  };

  const handleContinue = () => {
    onSubmit({
      pickup_loc, dropoff_loc,
      pickup_date, pickup_time,
      dropoff_date, dropoff_time,
      expected_dropoff_date,
      vehicle_type,
      transmission: transmission === "Do not precise" ? "" : transmission,
      one_way_fee, mileage, insurance,
      notes: description, description,
      intl_driver_license,
      internal_note,
    });
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card" style={{ minWidth: 760, maxWidth: 940 }}>
        <h2>Car rental</h2>

        <div className="field">
          <label>Pick-up location</label>
          <input className="input" value={pickup_loc} onChange={e=>setPickupLoc(e.target.value)} />
        </div>

        <div className="field">
          <label>Drop-off location</label>
          <input className="input" value={dropoff_loc} onChange={e=>setDropoffLoc(e.target.value)} />
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Pick-up date</label>
            <input className="input" type="date" value={pickup_date} onChange={e=>setPickupDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Pick-up time</label>
            <input className="input" placeholder="e.g. 10:30" value={pickup_time} onChange={e=>setPickupTime(e.target.value)} />
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Drop-off date</label>
            <input className="input" type="date" value={dropoff_date} onChange={e=>onChangeDropoffDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Drop-off time</label>
            <input className="input" placeholder="e.g. 14:15" value={dropoff_time} onChange={e=>setDropoffTime(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Expected drop-off date (To advise client to drop-off the car)</label>
          <input className="input" type="date" value={expected_dropoff_date} onChange={e=>setExpected(e.target.value)} />
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Vehicle type</label>
            <input className="input" placeholder="SUV, Compact…" value={vehicle_type} onChange={e=>setVehicleType(e.target.value)} />
          </div>
          <div className="field">
            <label>Transmission</label>
            <div className="radio-pills">
              <button type="button"
                className={`radio-pill ${transmission==="Automatic" ? "selected":""}`}
                onClick={()=> setTransmission("Automatic")}>Automatic</button>
              <button type="button"
                className={`radio-pill ${transmission==="Manual" ? "selected":""}`}
                onClick={()=> setTransmission("Manual")}>Manual</button>
              <button type="button"
                className={`radio-pill ${transmission==="Do not precise" ? "selected":""}`}
                onClick={()=> setTransmission("Do not precise")}>Do not precise</button>
            </div>
          </div>
        </div>

        <div className="grid-3">
          <div className="field">
            <label>One-way fee (USD)</label>
            <input className="input" inputMode="decimal" value={one_way_fee} onChange={e=>setOneWayFee(e.target.value)} />
          </div>
          <div className="field">
            <label>Mileage</label>
            <input className="input" value={mileage} onChange={e=>setMileage(e.target.value)} />
          </div>
          <div className="field">
            <label>Insurance</label>
            <input className="input" value={insurance} onChange={e=>setInsurance(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Description</label>
          <textarea className="textarea" rows={3} value={description} onChange={e=>setDescription(e.target.value)} />
        </div>

        <div className="field">
          <label className="chk">
            <input type="checkbox" checked={intl_driver_license} onChange={e=>setIDL(e.target.checked)} />
            International driver licence required
          </label>
        </div>

        <div className="field">
          <label>Internal note</label>
          <textarea className="textarea" rows={2} value={internal_note} onChange={e=>setInternalNote(e.target.value)} />
        </div>

        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleContinue}>Continue</button>
        </div>
      </div>
    </div>
  );
}
