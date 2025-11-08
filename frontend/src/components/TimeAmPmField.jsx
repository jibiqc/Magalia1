import React, { useEffect, useState } from "react";

export default function TimeAmPmField({
  label,
  value24,
  onChange,
  showHint = false,
  hintText = "Enter time in AM/PM. Typing 13:30 will auto-convert to 1:30 PM."
}) {
  // Local state to keep typing stable and avoid caret jumps.
  const toParts = (v) => {
    if (!v) return { hh: "", mm: "", ap: "AM" };
    let [H, M] = String(v).split(":");
    const Hn = Math.max(0, Math.min(23, parseInt(H || "0", 10)));
    const ap = Hn >= 12 ? "PM" : "AM";
    let h = Hn % 12; if (h === 0) h = 12;
    return { hh: String(h), mm: (M ?? "").slice(0, 2), ap };
  };

  const [{ hh, mm, ap }, setParts] = useState(toParts(value24));

  // Sync if parent value changes externally.
  useEffect(() => {
    setParts(toParts(value24));
  }, [value24]);

  const emitIfComplete = (nhh, nmm, nap) => {
    // Only emit when minutes have two digits to avoid parent overwriting input mid-typing
    if (!nhh || !nmm || nmm.length !== 2) return;
    let h = parseInt(nhh, 10);
    let m = parseInt(nmm, 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return;
    if (nap === "AM" && h === 12) h = 0;
    if (nap === "PM" && h !== 12) h += 12;
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  const warnMidnight = ap === "AM" && hh === "12";

  return (
    <div className="field">
      <label>{label}</label>
      <div style={{display:"flex", gap:"8px", alignItems:"center"}}>
        <input
          className="input"
          style={{ width: 64 }}
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={`${label} hour (AM/PM)`}
          value={hh}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
            if (raw === "") { setParts({ hh: "", mm, ap }); return; }
            let n = parseInt(raw, 10);
            if (!Number.isFinite(n)) return;
            let apNext = ap;
            let h;
            if (n === 0) { h = 12; apNext = "AM"; }
            else if (n >= 13 && n <= 23) { h = n - 12; apNext = "PM"; }
            else { h = Math.max(1, Math.min(12, n)); }
            const hhNext = String(h);
            setParts({ hh: hhNext, mm, ap: apNext });
            emitIfComplete(hhNext, mm, apNext);
          }}
          onBlur={() => {
            // Normalize on blur
            if (!hh) return;
            const hhNext = String(Math.max(1, Math.min(12, parseInt(hh, 10) || 12)));
            const mmNorm = (mm && mm.length === 2) ? mm : "00";
            setParts({ hh: hhNext, mm: mmNorm, ap });
            emitIfComplete(hhNext, mmNorm, ap);
          }}
        />
        <span>:</span>
        <input
          className="input"
          style={{ width: 64 }}
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={`${label} minutes`}
          value={mm}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
            if (raw === "") { setParts({ hh, mm: "", ap }); return; }
            // Do not pad while typing; clamp only when 2 digits entered
            let mmNext = raw;
            if (raw.length === 2) {
              const n = Math.max(0, Math.min(59, parseInt(raw, 10) || 0));
              mmNext = String(n).padStart(2, "0");
            }
            setParts({ hh, mm: mmNext, ap });
            emitIfComplete(hh, mmNext, ap);
          }}
          onBlur={() => {
            // On blur, pad to two digits and clamp into 00–59
            let mmNorm = mm;
            if (!mmNorm) mmNorm = "00";
            if (mmNorm.length === 1) mmNorm = `0${mmNorm}`;
            const n = Math.max(0, Math.min(59, parseInt(mmNorm, 10) || 0));
            mmNorm = String(n).padStart(2, "0");
            setParts({ hh, mm: mmNorm, ap });
            emitIfComplete(hh, mmNorm, ap);
          }}
        />
        <select
          className="select"
          style={{ width: 80 }}
          aria-label={`${label} AM/PM selector`}
          value={ap}
          onChange={(e) => {
            const apNext = e.target.value;
            setParts({ hh, mm, ap: apNext });
            emitIfComplete(hh, mm, apNext);
          }}>
          <option>AM</option><option>PM</option>
        </select>
      </div>
      {showHint && <div className="time-hint">{hintText}</div>}
      {warnMidnight && <div className="time-warn">Warning: it means Midnight</div>}
    </div>
  );
}

