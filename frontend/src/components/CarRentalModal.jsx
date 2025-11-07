import React, { useState } from "react";
import { createPortal } from "react-dom";
import "../styles/quote.css";

export default function CarRentalModal({
  open = true,
  onClose,
}) {
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropoffDate, setDropoffDate] = useState("");
  const [dropoffTime, setDropoffTime] = useState("");
  const [expectedDropoffDate, setExpectedDropoffDate] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [transmission, setTransmission] = useState("automatic");
  const [oneWayFee, setOneWayFee] = useState("");
  const [mileage, setMileage] = useState("");
  const [insurance, setInsurance] = useState("");

  if (!open) return null;

  const handleContinue = () => {
    // No API calls yet, just close
    onClose?.();
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
        className="dest-modal-card"
        style={{
          width: 420,
          maxWidth: "92vw",
          background: "#1b2436",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dest-modal-title" style={{ fontWeight: 700, marginBottom: 16, color: "#e8eefc", fontSize: 18 }}>
          Car Rental
        </div>

        <div className="dest-modal-body" style={{ padding: 0 }}>
          <div className="field">
            <label>Pick-up Location</label>
            <input
              type="text"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>Drop-off Location</label>
            <input
              type="text"
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
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                type="time"
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
                value={dropoffDate}
                onChange={(e) => setDropoffDate(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                type="time"
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
              value={expectedDropoffDate}
              onChange={(e) => setExpectedDropoffDate(e.target.value)}
              placeholder="same as drop-off date"
            />
          </div>

          <div className="field">
            <label>Type of Vehicle</label>
            <input
              type="text"
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
                  value="automatic"
                  checked={transmission === "automatic"}
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
            <label>One-way fee</label>
            <input
              type="number"
              step="0.01"
              value={oneWayFee}
              onChange={(e) => setOneWayFee(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="field">
            <label>Mileage</label>
            <input
              type="text"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="unlimited mileage"
            />
          </div>

          <div className="field">
            <label>Insurance</label>
            <input
              type="text"
              value={insurance}
              onChange={(e) => setInsurance(e.target.value)}
              placeholder="CDW & theft included"
            />
          </div>
        </div>

        <div className="dest-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "16px 0 0", borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 16 }}>
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

