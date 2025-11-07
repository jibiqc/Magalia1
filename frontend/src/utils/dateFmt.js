const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const WEEKDAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function ord(n){ const s=["th","st","nd","rd"], v=n%100; return s[(v-20)%10]||s[v]||s[0]; }

export function fmtDateShortISO(iso){
  const d = new Date(iso + "T00:00:00");
  const wd = WEEKDAYS_SHORT[d.getDay()];
  const m = MONTHS[d.getMonth()];
  const day = d.getDate();
  const y = d.getFullYear();
  return `${wd}, ${m} ${day}${ord(day)} ${y}`;
}

export function fmtDateLongISO(iso){
  const d = new Date(iso + "T00:00:00");
  const wd = WEEKDAYS[d.getDay()];
  const m = MONTHS[d.getMonth()];
  const day = d.getDate();
  const y = d.getFullYear();
  return `${wd}, ${m} ${day}${ord(day)} ${y}`;
}

