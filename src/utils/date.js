/**
 * Mengonversi objek Date atau string tanggal ke ISO 8601 dengan offset zona waktu Asia/Jakarta (+07:00).
 * Contoh output: "2026-11-22T19:47:28+07:00"
 */
function toWibIsoString(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;

  // Offset WIB adalah +7 jam dari UTC
  const wibTime = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const year = wibTime.getUTCFullYear();
  const month = String(wibTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(wibTime.getUTCDate()).padStart(2, '0');
  const hours = String(wibTime.getUTCHours()).padStart(2, '0');
  const minutes = String(wibTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(wibTime.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`;
}

/**
 * Mem-parse string waktu dari notifikasi Midtrans format "YYYY-MM-DD HH:mm:ss" yang dijamin dalam WIB (UTC+7).
 * Mengembalikan objek Date UTC yang valid untuk disimpan ke database.
 */
function parseMidtransWibTime(timeStr) {
  if (!timeStr) return null;
  try {
    const trimmed = String(timeStr).trim();
    // Konversi "2026-11-22 19:50:00" -> "2026-11-22T19:50:00+07:00"
    const isoWithOffset = trimmed.replace(' ', 'T') + '+07:00';
    const parsedDate = new Date(isoWithOffset);
    if (isNaN(parsedDate.getTime())) return null;
    return parsedDate;
  } catch (err) {
    return null;
  }
}

module.exports = {
  toWibIsoString,
  parseMidtransWibTime,
};
