// Maps backend enum values to label + badge tone for display.
export const PROJECT_STATUS = {
  PROPOSED: { label: 'Proposed', tone: 'slate' },
  PLANNING: { label: 'Planning', tone: 'blue' },
  ONGOING: { label: 'Ongoing', tone: 'amber' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'red' },
};

export const NEWS_STATUS = {
  DRAFT: { label: 'Draft', tone: 'slate' },
  PUBLISHED: { label: 'Published', tone: 'green' },
};

export const EVENT_TYPE = {
  MEETING: { label: 'Meeting', tone: 'blue' },
  SESSION: { label: 'Session', tone: 'slate' },
  ACTIVITY: { label: 'Activity', tone: 'green' },
  APPOINTMENT: { label: 'Appointment', tone: 'amber' },
};

export const ATTENDANCE_STATUS = {
  PRESENT: { label: 'Present', tone: 'green' },
  ABSENT: { label: 'Absent', tone: 'red' },
  LATE: { label: 'Late', tone: 'amber' },
  EXCUSED: { label: 'Excused', tone: 'slate' },
};

// Format a number as Philippine Peso.
export function formatPeso(amount) {
  const n = Number(amount || 0);
  return '₱' + n.toLocaleString('en-PH', { maximumFractionDigits: 2 });
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
