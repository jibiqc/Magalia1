export const parseHHMM = (s) => {
  if(!s) return null;
  const [h,m] = s.split(":").map(x=>parseInt(x||"0",10));
  return (isNaN(h)||isNaN(m))?null:(h*60+m);
};

export const fmtHm = (mins) => {
  const h = Math.floor(mins/60), m = mins%60;
  return m===0 ? `${h}h` : `${h}h${m}`;
}; // "3h" / "3h30"

export const addMins = (hhmm, delta) => {
  const m0 = parseHHMM(hhmm);
  if(m0==null) return "";
  const m = (m0+delta+1440)%1440;
  const h = String(Math.floor(m/60)).padStart(2,"0");
  const mi = String(m%60).padStart(2,"0");
  return `${h}:${mi}`;
};

