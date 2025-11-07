import React from "react";

export default function TimeAmPmField({ label, value24, onChange }) {
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
    if (!hh || !mm) return onChange("");
    let h = parseInt(hh,10);
    if (ap === "AM" && h === 12) h = 0;
    if (ap === "PM" && h !== 12) h += 12;
    onChange(`${String(h).padStart(2,"0")}:${String(mm).padStart(2,"0")}`);
  };

  const warnMidnight = parts.ap === "AM" && parts.hh === "12";

  return (
    <div className="field">
      <label>{label}</label>
      <div style={{display:"flex", gap:"8px", alignItems:"center"}}>
        <input className="input" style={{width:64}} type="number" min="1" max="12"
               value={parts.hh} onChange={e=>update(e.target.value, parts.mm, parts.ap)} />
        <span>:</span>
        <input className="input" style={{width:64}} type="number" min="0" max="59"
               value={parts.mm} onChange={e=>update(parts.hh, e.target.value, parts.ap)} />
        <select className="select" style={{width:80}}
                value={parts.ap} onChange={e=>update(parts.hh, parts.mm, e.target.value)}>
          <option>AM</option><option>PM</option>
        </select>
      </div>
      {warnMidnight && <div className="time-warn">Warning: it means Midnight</div>}
    </div>
  );
}

