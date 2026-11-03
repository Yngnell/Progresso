// Dates typed in a form ("2026-11-03T16:00") carry no time zone. The server runs in UTC
// on Railway, so such a value would be read as 4 PM UTC = midnight in the Philippines.
// Read zone-less values as Philippine time (UTC+8); values with a zone are kept as they are.
const NO_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

function parsePhDate(value) {
  if (value instanceof Date) return value;
  const s = String(value).trim();
  return new Date(NO_ZONE.test(s) ? `${s}+08:00` : s);
}

module.exports = { parsePhDate };
