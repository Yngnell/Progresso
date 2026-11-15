import { formatDate, formatPeso2 } from './format';

// The whole project, from the request to its completion, as stages of Field/Details rows.
// Used by the Barangay Chairman's project table and its "Project details" PDF, so both show
// the same thing. A value is text (or null when there is nothing yet), or a list of items:
//   { text }                                  a line of text
//   { before, fileId, fileName, after }       a line with a project file in it
const DECISION_LABEL = { APPROVE: 'Approved', RETURN: 'Returned for revision', REJECT: 'Rejected' };

export function projectStages(project, documentTypes = {}) {
  const approved = ['APPROVED', 'ONGOING', 'COMPLETED', 'CANCELLED'].includes(project.status);
  const reviews = [...(project.reviews || [])].reverse(); // oldest first
  const breakdown = project.budgetRows || [];
  const expenses = project.expenses || [];
  const files = project.liquidationFiles || [];
  const date = (d) => (d ? formatDate(d) : null);
  const stages = [];

  stages.push(['Project Request', [
    ['Project Name', project.title],
    ['Status', project.archivedAt ? `${project.statusLabel} (deleted)` : project.statusLabel],
    ['ABYIP Program', project.abyipItem ? `${project.abyipItem.name} (ABYIP ${project.abyipItem.year})` : null],
    ['Category', project.category || project.abyipItem?.center],
    ['Description', project.description],
    ['Objectives', project.objectives],
    ['Venue', project.location],
    ['Target Participants', project.targetParticipants],
    ['Start Date', date(project.startDate)],
    ['End Date', date(project.endDate)],
    ['Budget Breakdown', breakdown.length
      ? breakdown.map((r) => ({ text: `${r.item}: ${Number(r.quantity).toLocaleString('en-PH')} × ${formatPeso2(r.unitCost)} = ${formatPeso2(r.total)}` }))
      : null],
    ['Estimated Cost', formatPeso2(project.estimatedCost)],
    ['Proposed By', project.proposedByName || project.createdBy?.name],
    ['Date Submitted', date(project.submittedAt)],
  ]]);

  const reviewRows = reviews.length
    ? reviews.map((r, i) => [
        reviews.length > 1 ? `Decision ${i + 1}` : 'Decision',
        `${DECISION_LABEL[r.decision] || r.decision} by ${r.reviewer?.name || 'the Barangay Chairman'} on ${formatDate(r.reviewedAt)}${r.remarks ? `\nRemarks: ${r.remarks}` : ''}`,
      ])
    : [['Decision', project.status === 'DRAFT' ? 'Not submitted yet.' : 'No decision yet.']];
  if (!approved && project.abyipRemaining != null) reviewRows.push(['ABYIP Program Balance', formatPeso2(project.abyipRemaining)]);
  stages.push(['Review', reviewRows]);

  if (approved || project.approvedAt) {
    stages.push(['Approval', [
      ['Date Approved', date(project.approvedAt)],
      ['Approved Cost', formatPeso2(project.approvedCost)],
    ]]);
  }

  if (['ONGOING', 'COMPLETED', 'CANCELLED'].includes(project.status) || expenses.length) {
    const left = project.status === 'COMPLETED' ? 'Unused Amount (returned)' : project.status === 'CANCELLED' ? 'Unspent Amount (returned)' : 'Remaining Budget';
    stages.push(['Implementation', [
      ['Date Started', date(project.startedAt)],
      ['Expenses', expenses.length
        ? expenses.map((e) => {
            const after = `${e.category ? ` · ${e.category}` : ''}${e.supplier ? ` · ${e.supplier}` : ''} · ${formatPeso2(e.amount)}`;
            return e.fileId
              ? { before: `${formatDate(e.date)} · `, fileId: e.fileId, fileName: e.item, after }
              : { text: `${formatDate(e.date)} · ${e.item}${after}` };
          })
        : 'No expenses recorded yet.'],
      ['Amount Spent', formatPeso2(project.amountSpent)],
      [left, formatPeso2(project.remainingBudget)],
    ]]);
  }

  stages.push(['Files', [
    ['Project Files', files.length
      ? files.map((f) => ({ fileId: f.id, fileName: f.originalName, after: ` · ${documentTypes[f.documentType] || f.documentType} · ${formatDate(f.createdAt)}` }))
      : 'No files yet.'],
  ]]);

  if (project.status === 'REJECTED') {
    const last = reviews[reviews.length - 1];
    stages.push(['Rejection', [
      ['Date Rejected', date(project.reviewedAt || last?.reviewedAt)],
      ['Reason for Rejection', project.reviewRemarks || last?.remarks],
    ]]);
  }
  if (project.status === 'COMPLETED') {
    stages.push(['Completion', [
      ['Date Completed', date(project.completedAt)],
      ['Actual End Date', date(project.actualEndDate)],
      ['Actual Participants', project.actualParticipants],
      ['Accomplishment Summary', project.accomplishmentSummary],
    ]]);
  }
  if (project.status === 'CANCELLED') {
    stages.push(['Cancellation', [
      ['Date Cancelled', date(project.cancelDate || project.cancelledAt)],
      ['Reason for Cancellation', project.cancelReason],
    ]]);
  }
  if (project.archivedAt) {
    stages.push(['Deletion', [
      ['Date Deleted', date(project.archivedAt)],
      ['Reason for Deletion', project.archivedReason],
    ]]);
  }
  return stages;
}

// A value as plain text (lists become one line per item); '—' when empty.
export function valueText(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map((it) => it.text ?? `${it.before || ''}${it.fileName || ''}${it.after || ''}`).join('\n');
  return String(value);
}

// The newest file of a document type (e.g. the accomplishment report), or null.
export function latestFile(project, documentType) {
  const list = (project.liquidationFiles || []).filter((f) => f.documentType === documentType);
  return list.length ? list[list.length - 1] : null;
}
