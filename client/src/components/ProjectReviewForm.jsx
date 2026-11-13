import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ExternalLink, FileText } from 'lucide-react';
import { Button, Modal } from './ui';
import ReadOnlyField from './ReadOnlyField';
import { formTitle } from './FormHeader';
import { useConfirm } from './ConfirmDialog';
import { projectsApi } from '../api/projects';
import { errorMessage, fieldErrors } from '../api/budget';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatPeso2, phToday } from '../utils/format';

const DECISIONS = [
  { value: 'APPROVE', label: 'Approve', hint: 'The estimated cost is reserved from the ABYIP item.' },
  { value: 'RETURN', label: 'Return for Revision', hint: 'The SK Admin changes the request and submits it again.' },
  { value: 'REJECT', label: 'Reject', hint: 'The request is closed and kept in Archives.' },
];
const CONFIRM = {
  APPROVE: { q: 'Approve this Project Request? Its estimated cost will be reserved from the ABYIP item.', label: 'Approve' },
  RETURN: { q: 'Return this Project Request to the SK Admin for revision?', label: 'Return' },
  REJECT: { q: 'Reject this Project Request? It will be closed and moved to Archives.', label: 'Reject', variant: 'danger' },
};
const DONE = {
  APPROVE: 'was approved. Its estimated cost is now reserved from the ABYIP item.',
  RETURN: 'was returned to the SK Admin for revision.',
  REJECT: 'was rejected and moved to Archives.',
};

// Form 4 · Review (Barangay Chairman). A read-only summary of the Pending request, then the
// decision. Remarks are required to return or reject. The reviewer and the date are filled in.
export default function ProjectReviewForm({ projectId, onClose, onDone }) {
  const { user } = useAuth();
  const [decision, setDecision] = useState('');
  const [remarks, setRemarks] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [ask, askDialog] = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ['projects', projectId], queryFn: () => projectsApi.get(projectId) });
  const p = data?.project;
  const types = data?.documentTypes || {};

  const cost = Number(p?.estimatedCost || 0);
  const balance = p?.abyipRemaining;
  const short = balance != null && cost > balance ? Math.round((cost - balance) * 100) / 100 : 0;

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const e2 = {};
    if (!decision) e2.decision = 'Choose Approve, Return for Revision or Reject';
    else if (decision !== 'APPROVE' && !remarks.trim()) {
      e2.remarks = `Write the remarks: the SK Admin needs to know why it is ${decision === 'RETURN' ? 'returned' : 'rejected'}`;
    } else if (decision === 'APPROVE' && short > 0) {
      e2.decision = `The ABYIP item is ${formatPeso2(short)} short of the estimated cost. Return it for revision instead.`;
    }
    setErrors(e2);
    if (Object.keys(e2).length) return;
    const c = CONFIRM[decision];
    if (!(await ask(c.q, { confirmLabel: c.label, variant: c.variant }))) return;
    setBusy(true);
    try {
      const res = await projectsApi.review(projectId, { decision, remarks: remarks.trim() });
      onDone(res, `“${p.title}” ${DONE[decision]}`);
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      if (!Object.keys(fe).length) setError(errorMessage(err, 'The decision could not be saved. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      size="xl"
      onClose={onClose}
      title={formTitle(4, 'Review')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form="review-form"
            variant={decision === 'REJECT' ? 'danger' : 'primary'}
            disabled={busy || isLoading || !p}
          >
            {busy ? 'Saving…' : decision ? `${DECISIONS.find((d) => d.value === decision).label}` : 'Save decision'}
          </Button>
        </>
      }
    >
      {isLoading || !p ? (
        <p className="pb-5 text-slate-600">Loading…</p>
      ) : (
        <form id="review-form" onSubmit={submit} className="space-y-5 pb-5" noValidate>
          {error && <p className="notice notice-error text-sm" role="alert">{error}</p>}
          {p.status !== 'PENDING' && (
            <p className="notice notice-warn text-sm">This request is no longer waiting for a decision.</p>
          )}

          <section aria-label="Request summary">
            <h3 className="font-display text-lg text-ink">{p.title}</h3>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">
              <Item label="ABYIP item">
                {p.abyipItem ? `${p.abyipItem.name} (ABYIP ${p.abyipItem.year})` : '—'}
              </Item>
              <Item label="Target participants">{p.targetParticipants}</Item>
              <Item label="Dates">{p.startDate ? `${formatDate(p.startDate)} – ${formatDate(p.endDate)}` : '—'}</Item>
              <Item label="Venue">{p.location}</Item>
            </dl>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ReadOnlyField label="Estimated cost" value={formatPeso2(cost)} />
              <ReadOnlyField
                label="Remaining ABYIP balance"
                value={balance == null ? '—' : formatPeso2(balance)}
                tone={short > 0 ? 'bad' : undefined}
                hint={short > 0 ? `${formatPeso2(short)} short of the estimated cost.` : balance != null ? `${formatPeso2(balance - cost)} left after approval.` : null}
              />
            </div>
          </section>

          <section className="rounded-control border border-line">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              aria-expanded={showDetails}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-medium text-pine"
            >
              Full description and budget breakdown
              <ChevronDown size={18} className={`shrink-0 transition-transform ${showDetails ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {showDetails && (
              <div className="space-y-4 border-t border-dashed border-line px-4 py-4 text-[15px]">
                <div>
                  <p className="text-sm font-semibold text-slate-600">Description</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800">{p.description || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600">Objectives</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800">{p.objectives || '—'}</p>
                </div>
                <ul className="divide-y divide-line rounded-control border border-line">
                  {(p.budgetRows || []).map((r) => (
                    <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2 text-sm">
                      <span className="min-w-0 font-medium text-ink">{r.item}</span>
                      <span className="text-slate-600">
                        {Number(r.quantity).toLocaleString('en-PH')} × {formatPeso2(r.unitCost)} ={' '}
                        <span className="font-semibold text-ink">{formatPeso2(r.total)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link to={`/admin/projects/${p.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-pine hover:underline">
                  Open the project page <ExternalLink size={14} aria-hidden="true" />
                </Link>
              </div>
            )}
          </section>

          <section>
            <p className="label">Files</p>
            {(p.liquidationFiles || []).length === 0 ? (
              <p className="text-sm text-slate-600">No files attached.</p>
            ) : (
              <ul className="space-y-1.5">
                {p.liquidationFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-sm">
                    <FileText size={16} className="shrink-0 text-slate-600" aria-hidden="true" />
                    <button
                      type="button"
                      className="min-w-0 truncate text-left font-medium text-pine hover:underline"
                      onClick={() => projectsApi.openFile(p.id, f.id).catch(() => setError('The file could not be opened.'))}
                    >
                      {f.originalName}
                    </button>
                    <span className="shrink-0 text-slate-600">· {types[f.documentType] || f.documentType}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <fieldset>
            <legend className="label">Decision</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {DECISIONS.map((d) => (
                <label
                  key={d.value}
                  className={`flex cursor-pointer flex-col rounded-control border px-3 py-2.5 transition-colors ${
                    decision === d.value ? 'border-pine bg-pine-light' : 'border-line bg-white hover:bg-paper'
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium text-ink">
                    <input
                      type="radio"
                      name="decision"
                      value={d.value}
                      checked={decision === d.value}
                      onChange={() => {
                        setDecision(d.value);
                        setErrors({});
                      }}
                      className="accent-[var(--pine)]"
                    />
                    {d.label}
                  </span>
                  <span className="mt-1 text-[13px] text-slate-600">{d.hint}</span>
                </label>
              ))}
            </div>
            {errors.decision && <p className="mt-1 text-[13px] text-clay-text">{errors.decision}</p>}
          </fieldset>

          <div>
            <label className="label" htmlFor="review-remarks">
              Remarks {decision === 'RETURN' || decision === 'REJECT' ? '(required)' : '(optional)'}
            </label>
            <textarea
              id="review-remarks"
              className="input"
              rows={3}
              maxLength={2000}
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                setErrors((x) => ({ ...x, remarks: undefined }));
              }}
            />
            {errors.remarks && <p className="mt-1 text-[13px] text-clay-text">{errors.remarks}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ReadOnlyField label="Reviewer" value={user?.name} />
            <ReadOnlyField label="Date" value={formatDate(`${phToday()}T00:00:00+08:00`)} />
          </div>
        </form>
      )}
      {askDialog}
    </Modal>
  );
}

function Item({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="mt-0.5 break-words text-slate-800">{children || '—'}</dd>
    </div>
  );
}
