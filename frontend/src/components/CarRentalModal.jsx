import React, { useState } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";

export default function CarRentalModal({
  open = true,
  onClose,
  onSubmit,
  initialData = null,
  startDate = null,
}) {
  const [pickupLocation, setPickupLocation] = useState(initialData?.pickup_loc || "");
  const [dropoffLocation, setDropoffLocation] = useState(initialData?.dropoff_loc || "");
  const [pickupDate, setPickupDate] = useState(initialData?.pickup_date || startDate || "");
  const [pickupTime, setPickupTime] = useState(initialData?.pickup_time || "");
  // Default dropoff date to startDate + 1 day if available
  const getDefaultDropoffDate = () => {
    if (initialData?.dropoff_date) return initialData.dropoff_date;
    if (startDate) {
      const d = new Date(startDate + "T00:00:00");
      d.setDate(d.getDate() + 1);
      return d.toISOString().split("T")[0];
    }
    return "";
  };
  const [dropoffDate, setDropoffDate] = useState(getDefaultDropoffDate());
  const [dropoffTime, setDropoffTime] = useState(initialData?.dropoff_time || "");
  const [expectedDropoffDate, setExpectedDropoffDate] = useState(initialData?.expected_dropoff_date || "");
  const [vehicleType, setVehicleType] = useState(initialData?.vehicle_type || "");
  const [transmission, setTransmission] = useState(initialData?.transmission || "Automatic");
  const [oneWayFee, setOneWayFee] = useState(initialData?.one_way_fee || "");
  const [mileage, setMileage] = useState(initialData?.mileage || "");
  const [insurance, setInsurance] = useState(initialData?.insurance || "");
  const [description, setDescription] = useState(initialData?.notes || initialData?.description || "");
  const [intl_driver_license, setIntlDriverLicense] = useState(initialData?.intl_driver_license !== undefined ? initialData.intl_driver_license : true);
  const [internal_note, setInternalNote] = useState(initialData?.internal_note || "");

  if (!open) return null;

  const handleContinue = () => {
    onSubmit({
      pickup_loc: pickupLocation,
      dropoff_loc: dropoffLocation,
      pickup_date: pickupDate,
      pickup_time: pickupTime,
      dropoff_date: dropoffDate,
      dropoff_time: dropoffTime,
      expected_dropoff_date: expectedDropoffDate,
      vehicle_type: vehicleType,
      transmission: transmission,
      one_way_fee: oneWayFee,
      mileage: mileage,
      insurance: insurance,
      notes: description,
      description: description,
      intl_driver_license: intl_driver_license,
      internal_note: internal_note,
    });
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
        style={{
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">Car Rental Details</div>

        <div className="dest-modal-body" style={{ padding: 0 }}>
          <div className="field">
            <label>Pick-up Location</label>
            <input
              type="text"
              className="input"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>Drop-off Location</label>
            <input
              type="text"
              className="input"
              value={dropoffLocation}
              onChange={(e) => setDropoffLocation(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>Pickup date and time</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="date"
                className="input"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                type="time"
                className="input"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="field">
            <label>Drop-off date and time</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="date"
                className="input"
                value={dropoffDate}
                onChange={(e) => setDropoffDate(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                type="time"
                className="input"
                value={dropoffTime}
                onChange={(e) => setDropoffTime(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="field">
            <label>Expected Drop-off date</label>
            <input
              type="date"
              className="input"
              value={expectedDropoffDate}
              onChange={(e) => setExpectedDropoffDate(e.target.value)}
              placeholder="same as drop-off date"
            />
          </div>

          <div className="field">
            <label>Type of Vehicle</label>
            <input
              type="text"
              className="input"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>Transmission</label>
            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="transmission"
                  value="Automatic"
                  checked={transmission === "Automatic"}
                  onChange={(e) => setTransmission(e.target.value)}
                />
                <span>Automatic</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="transmission"
                  value="manual"
                  checked={transmission === "manual"}
                  onChange={(e) => setTransmission(e.target.value)}
                />
                <span>Manual</span>
              </label>
            </div>
          </div>

          <div className="field">
            <label>Mileage</label>
            <input
              type="text"
              className="input"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="unlimited mileage"
            />
          </div>

          <div className="field">
            <label>Insurance</label>
            <input
              type="text"
              className="input"
              value={insurance}
              onChange={(e) => setInsurance(e.target.value)}
              placeholder="CDW & theft included"
            />
          </div>

          <div className="field">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={intl_driver_license}
                onChange={(e) => setIntlDriverLicense(e.target.checked)}
              />
              <span>International Driver Licence</span>
            </label>
          </div>

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
            <textarea
              className="textarea input-internal-note"
              value={internal_note}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder=""
              rows={3}
            />
          </div>
        </div>

        <div className="actions">
          <button className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleContinue}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(backdrop, document.body);
}

