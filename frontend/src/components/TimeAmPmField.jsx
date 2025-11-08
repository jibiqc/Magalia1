import React from "react";

export default function TimeAmPmField({
  label,
  value24,
  onChange,
  showHint = false,
  hintText = "Enter time in AM/PM. Typing 13:30 will auto-convert to 1:30 PM."
}) {
  // value24 like "13:05" or "".
  const toParts = (v) => {
    if (!v) return { hh:"", mm:"", ap:"AM" };
    let [H,M] = v.split(":"); H = parseInt(H||"0",10);
    const ap = H >= 12 ? "PM" : "AM";
    let h = H % 12; if (h === 0) h = 12;
    return { hh:String(h), mm:(M||"00"), ap };
  };
  const parts = toParts(value24);

  const update = (hh, mm, ap) => {
    // Allow partial entry; if minutes are empty, default to "00" so typing hours works.
    if (!hh) return onChange("");
    let h = parseInt(hh,10);
    let m = (mm === "" || mm == null) ? "00" : mm;
    if (ap === "AM" && h === 12) h = 0;
    if (ap === "PM" && h !== 12) h += 12;
    onChange(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
  };

  const warnMidnight = parts.ap === "AM" && parts.hh === "12";

  return (
    <div className="field">
      <label>{label}</label>
      <div style={{display:"flex", gap:"8px", alignItems:"center"}}>
        <input className="input" style={{width:64}}
          inputMode="numeric" pattern="[0-9]*"
          aria-label={`${label} hour (AM/PM)`}
          value={parts.hh}
          onChange={e=>{
            const v = e.target.value.replace(/\D/g,'').slice(0,2);
            // allow empty while typing
            if (v === "") return onChange("");
            let h = Math.max(1, Math.min(12, parseInt(v,10)));
            update(String(h), parts.mm, parts.ap);
          }}
        />
        <span>:</span>
        <input className="input" style={{width:64}}
          inputMode="numeric" pattern="[0-9]*"
          aria-label={`${label} minutes`}
          value={parts.mm}
          onChange={e=>{
            const v = e.target.value.replace(/\D/g,'').slice(0,2);
            // If empty, keep hours/AP and default minutes to "00" for now.
            if (v === "") return update(parts.hh, "", parts.ap);
            let m = Math.max(0, Math.min(59, parseInt(v,10)));
            update(parts.hh, String(m).padStart(2,"0"), parts.ap);
          }}
        />
        <select className="select" style={{width:80}}
                aria-label={`${label} AM/PM selector`}
                value={parts.ap} onChange={e=>update(parts.hh, parts.mm, e.target.value)}>
          <option>AM</option><option>PM</option>
        </select>
      </div>
      {showHint && <div className="time-hint">{hintText}</div>}
      {warnMidnight && <div className="time-warn">Warning: it means Midnight</div>}
    </div>
  );
}

