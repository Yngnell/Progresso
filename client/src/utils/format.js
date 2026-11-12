// Maps backend enum values to label + badge tone for display.
// The SK project process: Pending Approval > Approved > Purchasing > Fund Release >
// Implementation > Liquidation > Completed (plus Rejected, On Hold and Archived).
export const PROJECT_STATUS = {
  PENDING_APPROVAL: { label: 'Pending Approval', tone: 'amber' },
  APPROVED: { label: 'Approved', tone: 'blue' },
  PURCHASING: { label: 'Purchasing', tone: 'blue' },
  FUND_RELEASE: { label: 'Fund Release', tone: 'blue' },
  IMPLEMENTATION: { label: 'Implementation', tone: 'blue' },
  LIQUIDATION: { label: 'Liquidation', tone: 'blue' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  ON_HOLD: { label: 'On Hold', tone: 'slate' },
  ARCHIVED: { label: 'Archived', tone: 'slate' },
};

// The stages a project moves through, in order.
export const STAGE_FLOW = ['PENDING_APPROVAL', 'APPROVED', 'PURCHASING', 'FUND_RELEASE', 'IMPLEMENTATION', 'LIQUIDATION', 'COMPLETED'];
// Approved and being carried out (can be held, and moved on with "Proceed to Next Stage").
export const WORK_STAGES = ['APPROVED', 'PURCHASING', 'FUND_RELEASE', 'IMPLEMENTATION', 'LIQUIDATION'];
// The schedule is running: Purchasing to Liquidation (shown as "Ongoing" on the public site).
export const RUNNING_STAGES = ['PURCHASING', 'FUND_RELEASE', 'IMPLEMENTATION', 'LIQUIDATION'];

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

// Peso with exactly two decimals (liquidation amounts).
export function formatPeso2(amount) {
  const n = Number(amount || 0);
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
