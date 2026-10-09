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
