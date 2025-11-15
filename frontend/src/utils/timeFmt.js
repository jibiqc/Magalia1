export const fmtAMPM = (hhmm) => {
  if (!hhmm) return "";
  // Nettoyer la chaîne en supprimant "am"/"pm" s'ils sont présents
  const cleaned = String(hhmm).trim().replace(/\s*(am|pm)\s*$/i, '');
  // accepts "15:05" -> "3:05 pm"
  const [hStr,mStr] = cleaned.split(":");
  let h = parseInt(hStr||"0",10);
  // Extraire uniquement les chiffres des minutes (au cas où il y aurait encore du texte)
  const m = (mStr||"00").replace(/\D/g, '').padStart(2,"0");
  const suf = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m} ${suf}`;
};

