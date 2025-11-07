export const fmtAMPM = (hhmm) => {
  if (!hhmm) return "";
  // accepts "15:05" -> "3:05 pm"
  const [hStr,mStr] = hhmm.split(":");
  let h = parseInt(hStr||"0",10);
  const m = (mStr||"00").padStart(2,"0");
  const suf = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m} ${suf}`;
};

