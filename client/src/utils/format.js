// Maps backend enum values to label + badge tone for display.
// The SK project process (see server/src/utils/projectStatus.js). The older stage names stay
// only so an old link or record still shows a word.
export const PROJECT_STATUS = {
  DRAFT: { label: 'Draft', tone: 'slate' },
  PENDING: { label: 'Pending', tone: 'amber' },
  FOR_REVISION: { label: 'For Revision', tone: 'amber' },
  APPROVED: { label: 'Approved', tone: 'green' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  ONGOING: { label: 'Ongoing', tone: 'blue' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'slate' },
  PROPOSED: { label: 'Pending', tone: 'amber' },
  PLANNING: { label: 'Approved', tone: 'green' },
  ON_HOLD: { label: 'Ongoing', tone: 'blue' },
};

// Statuses still in progress (Projects page) and closed ones (Archives).
export const ACTIVE_STATUSES = ['DRAFT', 'PENDING', 'FOR_REVISION', 'APPROVED', 'ONGOING'];
export const CLOSED_STATUSES = ['COMPLETED', 'REJECTED', 'CANCELLED'];
// The SK Admin may change a request only while it is a draft or returned for revision.
export const EDITABLE_STATUSES = ['DRAFT', 'FOR_REVISION'];

// Today's date in the Philippines as YYYY-MM-DD (for date inputs).
export const phToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
// A saved date as YYYY-MM-DD in the Philippines (for date inputs).
export const phDayOf = (d) => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) : '');

export const EVENT_TYPE = {
  MEETING: { label: 'Meeting', tone: 'blue' },
  SESSION: { label: 'Session', tone: 'slate' },
  ACTIVITY: { label: 'Activity', tone: 'green' },
  APPOINTMENT: { label: 'Appointment', tone: 'amber' },
};

// Present: scanned the event's QR code. Absent: an official who had not scanned when the event ended.
export const ATTENDANCE_STATUS = {
  PRESENT: { label: 'Present', tone: 'green' },
  ABSENT: { label: 'Absent', tone: 'red' },
};

// Format a number as Philippine Peso.
export function formatPeso(amount) {
  const n = Number(amount || 0);
  return '₱' + n.toLocaleString('en-PH', { maximumFractionDigits: 2 });
}

// Peso with exactly two decimals (receipts, budgets), e.g. ₱125,000.00 or -₱1,500.00.
export function formatPeso2(amount) {
  const n = Number(amount || 0);
  const text = Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '-₱' : '₱') + text;
}

// Format an ISO date string to a readable date.
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format an ISO datetime to date + time (12-hour).
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Format just the time portion.
export function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Convert an ISO string to the value needed by <input type="datetime-local">.
export function toDateTimeLocal(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// YYYY-MM-DD key for a Date, used to match calendar day cells.
export function dayKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
