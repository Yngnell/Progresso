import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CircleCheck, ClipboardCheck, FileText, Pencil, Play, Receipt, Send, Trash2, Upload, X } from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { useAuth } from '../../context/AuthContext';
import OverflowMenu from '../../components/OverflowMenu';
import { StageSteps, StatusRibbon } from '../../components/Roundel';
import { Button, Card } from '../../components/ui';
import DeletionRequestModal from '../../components/DeletionRequestModal';
import { useConfirm } from '../../components/ConfirmDialog';
import DownloadButton from '../../components/DownloadButton';
import ProjectReviewForm from '../../components/ProjectReviewForm';
import { CancellationForm, CompletionForm, ExpenseForm, FileForm } from '../../components/ProjectForms';
import { CLOSED_STATUSES, EDITABLE_STATUSES, formatDate, formatPeso2 } from '../../utils/format';

const errorText = (err, fallback) => err?.response?.data?.message || fallback;
const DECISION = {
  APPROVE: { label: 'Approved', className: 'text-sage-text' },
  RETURN: { label: 'Returned for revision', className: 'text-orange-800' },
  REJECT: { label: 'Rejected', className: 'text-clay-text' },
};
// Statuses in which files can be added or removed (the server checks the same).
const FILE_OPEN = ['DRAFT', 'FOR_REVISION', 'APPROVED', 'ONGOING'];
const ARCHIVE_TAB = { COMPLETED: 'completed', REJECTED: 'rejected', CANCELLED: 'cancelled' };

// One project in the SK project process. The SK Admin works on it through the project forms;
// the Barangay Chairman reviews it (Review). Rejected, completed, cancelled and deleted projects
// are view only.
export default function AdminProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isChairman = user?.role === 'CHAIRMAN';
  const isSkAdmin = user?.role === 'ADMIN' || user?.role === 'OFFICIAL';
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [note, setNote] = useState(location.state?.notice || '');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [ask, askDialog] = useConfirm();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectsApi.get(id),
  });
  const project = data?.project;
  const documentTypes = data?.documentTypes || {};

  // Every step returns the updated project; refresh the lists, balances and the Dashboard too.
  const refresh = (res, message) => {
    setNote(message || '');
    setError('');
    if (res?.project) qc.setQueryData(['projects', id], (old) => ({ ...old, project: res.project }));
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['abyip'] });
    qc.invalidateQueries({ queryKey: ['budgets'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
    qc.invalidateQueries({ queryKey: ['deletion-requests'] });
  };
  const fail = (fallback) => (err) => {
    setNote('');
    setError(errorText(err, fallback));
  };

  const restoreMutation = useMutation({
    mutationFn: () => projectsApi.restore(id),
    onSuccess: (res) => refresh(res, 'The project was restored. It is back in the Projects list.'),
    onError: fail('Could not restore the project'),
  });
  const withdrawMutation = useMutation({
    mutationFn: () => projectsApi.withdrawDeletion(id),
    onSuccess: () => refresh(null, 'The deletion request was withdrawn.'),
    onError: fail('Could not withdraw the request'),
  });

  if (isLoading) return <p className="text-slate-600">Loading…</p>;
  if (isError || !project)
    return (
      <div className="text-center">
        <p className="text-slate-600">Project not found.</p>
        <Link to="/admin/projects" className="mt-2 inline-block font-semibold text-pine">
          ← Back to Projects
        </Link>
      </div>
    );

  const deleted = Boolean(project.archivedAt);
  const closed = CLOSED_STATUSES.includes(project.status);
  const viewOnly = deleted || closed;
  const deletion = project.deletionRequests?.[0];
  const back = deleted
    ? { to: '/admin/archive?tab=deleted', label: 'Archives' }
    : closed
      ? { to: `/admin/archive?tab=${ARCHIVE_TAB[project.status]}`, label: 'Archives' }
      : isChairman && project.status === 'PENDING'
        ? { to: '/admin/approvals', label: 'Approvals' }
        : { to: '/admin/projects', label: 'Projects' };
  const shows = (statuses) => statuses.includes(project.status);

  return (
    <div className="min-w-0">
      <Link to={back.to} className="inline-flex items-center gap-1 text-sm font-semibold text-pine hover:underline">
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to {back.label}
      </Link>

      {deleted && (
        <div className="notice mt-3">
          <p className="font-semibold">Deleted on {formatDate(project.archivedAt)}. The records are kept and cannot be changed.</p>
          {project.archivedReason && <p className="mt-1"><span className="font-medium">Reason:</span> {project.archivedReason}</p>}
          {isChairman && (
            <Button
              size="sm"
              className="mt-2"
              disabled={restoreMutation.isPending}
              onClick={async () => {
                if (await ask(`Are you sure you want to restore "${project.title}"? It returns to the Projects list.`)) restoreMutation.mutate();
              }}
            >
              Restore project
            </Button>
          )}
        </div>
      )}
      {!deleted && closed && (
        <p className="notice mt-3 font-semibold">
          This project is {project.statusLabel.toLowerCase()} and kept in Archives. It is view only.
        </p>
      )}

      <div className="mt-4 flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <StatusRibbon status={project.status} />
          <h1 className="page-title mt-2 break-words">{project.title}</h1>
          {project.abyipItem && (
            <p className="mt-3 text-slate-600">
              ABYIP {project.abyipItem.year} · {project.abyipItem.name} · {project.abyipItem.center}
            </p>
          )}
          <StageSteps status={project.status} className="mt-4 max-w-xl" />
        </div>
        {isSkAdmin && !viewOnly && deletion?.status !== 'PENDING' && (
          <OverflowMenu items={[{ label: 'Request deletion', Icon: Trash2, danger: true, onClick: () => setDeleteOpen(true) }]} />
        )}
      </div>

      {deletion?.status === 'PENDING' && (
        <DeletionPending
          deletion={deletion}
          canWithdraw={isSkAdmin && !viewOnly}
          withdrawing={withdrawMutation.isPending}
          onWithdraw={() => withdrawMutation.mutate()}
          isChairman={isChairman}
          onDecided={(msg) => refresh(null, msg)}
        />
      )}
      {deletion?.status === 'REJECTED' && !deleted && (
        <div className="notice notice-warn mt-4 text-sm">
          <p className="font-semibold">Deletion request rejected by {deletion.reviewedByName || 'the Barangay Chairman'}</p>
          {deletion.reviewRemarks && <p className="mt-1">{deletion.reviewRemarks}</p>}
        </div>
      )}
      {deleteOpen && (
        <DeletionRequestModal project={project} onClose={() => setDeleteOpen(false)} onSent={(t) => refresh(null, t)} />
      )}
      {note && <p className="notice notice-ok mt-4" role="status">{note}</p>}
      {error && <p className="notice notice-error mt-4" role="alert">{error}</p>}

      {!deleted && (
        <ActionPanel
          project={project}
          isSkAdmin={isSkAdmin}
          isChairman={isChairman}
          ask={ask}
          onDone={refresh}
          onFail={fail}
          navigate={navigate}
        />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Summary project={project} />
          <Breakdown project={project} />
          {(shows(['ONGOING', 'COMPLETED', 'CANCELLED']) || project.expenses?.length > 0) && (
            <RecordExpenses
              project={project}
              meta={data}
              canRecord={isSkAdmin && !deleted && project.status === 'ONGOING'}
              ask={ask}
              onDone={refresh}
              onFail={fail}
            />
          )}
          {project.status === 'COMPLETED' && <Completion project={project} />}
          {project.status === 'CANCELLED' && <Cancellation project={project} />}
          <Files
            project={project}
            documentTypes={documentTypes}
            canDelete={isSkAdmin && !deleted && FILE_OPEN.includes(project.status)}
            canUpload={isSkAdmin && !deleted && FILE_OPEN.includes(project.status)}
            ask={ask}
            onDone={refresh}
            onFail={fail}
          />
        </div>

        <div className="min-w-0 space-y-6">
          <Money project={project} />
          <Reviews project={project} />
        </div>
      </div>
      {askDialog}
    </div>
  );
}

// What happens next, and the buttons for it (by status and role).
function ActionPanel({ project, isSkAdmin, isChairman, ask, onDone, onFail, navigate }) {
  const [form, setForm] = useState(null); // which form dialog is open
  const closeForm = () => setForm(null);
  const formDone = (res, text) => {
    setForm(null);
    onDone(res, text);
  };
  const start = useMutation({
    mutationFn: () => projectsApi.start(project.id),
    onSuccess: (res) => onDone(res, 'The project has started. It is now Ongoing.'),
    onError: onFail('The project could not be started.'),
  });
  const submit = useMutation({
    mutationFn: () => projectsApi.submit(project.id),
    onSuccess: (res) => onDone(res, 'The request was submitted to the Barangay Chairman for approval.'),
    onError: (err) => {
      const missing = err?.response?.data?.errors;
      if (missing && Object.keys(missing).length) {
        navigate(`/admin/projects/${project.id}/edit`, { state: { errors: missing, error: 'Complete the request before submitting it.' } });
      } else onFail('The request could not be submitted.')(err);
    },
  });

  let text = null;
  let actions = null;
  if (EDITABLE_STATUSES.includes(project.status)) {
    text = project.status === 'DRAFT'
      ? 'Draft: only the SK Admin sees it. Submit it when it is complete.'
      : 'Returned for revision: change what the Barangay Chairman asked for, then submit it again.';
    if (isSkAdmin) {
      actions = (
        <>
          <Button variant="secondary" onClick={() => navigate(`/admin/projects/${project.id}/edit`)}>
            <Pencil size={16} aria-hidden="true" /> Edit request
          </Button>
          <Button
            disabled={submit.isPending}
            onClick={async () => {
              if (await ask('Submit this Project Request to the Barangay Chairman for approval? It cannot be edited while it is being reviewed.')) submit.mutate();
            }}
          >
            <Send size={16} aria-hidden="true" /> {submit.isPending ? 'Submitting…' : 'Submit for Approval'}
          </Button>
        </>
      );
    }
  } else if (project.status === 'PENDING') {
    text = isChairman
      ? 'This request is waiting for your decision.'
      : `Submitted on ${formatDate(project.submittedAt)}. Waiting for the Barangay Chairman’s decision.`;
    if (isChairman) {
      actions = (
        <Button onClick={() => setForm('review')}>
          <ClipboardCheck size={16} aria-hidden="true" /> Review this request
        </Button>
      );
    }
  } else if (project.status === 'APPROVED') {
    text = `Approved on ${formatDate(project.approvedAt)}. The estimated cost is reserved from the ABYIP item.`;
    if (isSkAdmin) {
      actions = (
        <>
          <Button variant="ghost" onClick={() => setForm('cancel')}>
            <Ban size={16} aria-hidden="true" /> Cancel project
          </Button>
          <Button
            disabled={start.isPending}
            onClick={async () => {
              if (await ask(`Start “${project.title}” now? It becomes Ongoing, and expenses can then be recorded.`)) start.mutate();
            }}
          >
            <Play size={16} aria-hidden="true" /> {start.isPending ? 'Starting…' : 'Start project'}
          </Button>
        </>
      );
    }
  } else if (project.status === 'ONGOING') {
    text = 'Ongoing: record expenses and files, then complete the project.';
    if (isSkAdmin) {
      actions = (
        <>
          <Button variant="ghost" onClick={() => setForm('cancel')}>
            <Ban size={16} aria-hidden="true" /> Cancel project
          </Button>
          <Button onClick={() => setForm('complete')}>
            <CircleCheck size={16} aria-hidden="true" /> Complete project
          </Button>
        </>
      );
    }
  }
  if (!text) return null;
  return (
    <Card className="mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[15px] text-ink">{text}</p>
      {actions && <div className="actions-stack flex flex-wrap gap-2">{actions}</div>}
      {form === 'review' && <ProjectReviewForm projectId={project.id} onClose={closeForm} onDone={formDone} />}
      {form === 'cancel' && <CancellationForm project={project} ask={ask} onClose={closeForm} onDone={formDone} />}
      {form === 'complete' && <CompletionForm project={project} ask={ask} onClose={closeForm} onDone={formDone} />}
    </Card>
  );
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="mt-0.5 break-words text-slate-800">{children || '—'}</dd>
    </div>
  );
}

function Summary({ project }) {
  return (
    <Card className="p-6">
      <h2 className="section-title">Project Request</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Venue">{project.location}</Field>
        <Field label="Dates">
          {project.startDate ? `${formatDate(project.startDate)} – ${formatDate(project.endDate)}` : null}
        </Field>
        <Field label="Target participants">{project.targetParticipants}</Field>
        <Field label="Prepared by">{project.proposedByName || project.createdBy?.name}</Field>
      </dl>
      <div className="mt-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-600">Description</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-800">{project.description || '—'}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-600">Objectives</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-800">{project.objectives || '—'}</p>
        </div>
      </div>
    </Card>
  );
}

function Breakdown({ project }) {
  const rows = project.budgetRows || [];
  return (
    <Card className="overflow-hidden">
      <div className="card-head px-6 py-4">
        <h2 className="section-title">Budget breakdown</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 py-5 text-slate-600">No budget rows yet.</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="table-notebook">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Quantity</th>
                <th className="text-right">Unit cost</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.item}</td>
                  <td className="text-right">{Number(r.quantity).toLocaleString('en-PH')}</td>
                  <td className="whitespace-nowrap text-right">{formatPeso2(r.unitCost)}</td>
                  <td className="whitespace-nowrap text-right font-medium">{formatPeso2(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line">
                <td colSpan={3} className="px-4 py-3 font-semibold">Estimated cost</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatPeso2(project.estimatedCost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

// Approved cost, spent so far and remaining (or, before approval, the estimate and the ABYIP balance).
function Money({ project }) {
  const approved = ['APPROVED', 'ONGOING', 'COMPLETED', 'CANCELLED'].includes(project.status);
  const line = (label, value, strong, tone) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`whitespace-nowrap ${strong ? 'font-number text-xl' : 'font-semibold'} ${tone || 'text-ink'}`}>{value}</span>
    </div>
  );
  return (
    <Card className="p-6">
      <h2 className="section-title">Budget</h2>
      <div className="mt-3 divide-y divide-dashed divide-line">
        {approved ? (
          <>
            {line('Approved cost', formatPeso2(project.approvedCost))}
            {line('Spent so far', formatPeso2(project.amountSpent))}
            {line(
              project.status === 'COMPLETED' ? 'Unused (returned)' : project.status === 'CANCELLED' ? 'Unspent (returned)' : 'Remaining',
              formatPeso2(project.remainingBudget),
              true,
              project.remainingBudget < 0 ? 'text-clay-text' : undefined
            )}
          </>
        ) : (
          <>
            {line('Estimated cost', formatPeso2(project.estimatedCost), true)}
            {project.abyipRemaining != null && line('ABYIP item balance', formatPeso2(project.abyipRemaining))}
          </>
        )}
      </div>
    </Card>
  );
}

// Review history: every decision of the Barangay Chairman.
function Reviews({ project }) {
  const reviews = project.reviews || [];
  return (
    <Card className="p-6">
      <h2 className="section-title">Review history</h2>
      {reviews.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          {project.status === 'DRAFT' ? 'Not submitted yet.' : 'No decision yet.'}
        </p>
      ) : (
        <ol className="mt-3 space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="border-l-2 border-line pl-3">
              <p className={`text-sm font-semibold ${DECISION[r.decision]?.className || ''}`}>{DECISION[r.decision]?.label || r.decision}</p>
              <p className="text-[13px] text-slate-600">{r.reviewer?.name || 'Barangay Chairman'} · {formatDate(r.reviewedAt)}</p>
              {r.remarks && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{r.remarks}</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// Record Expenses: the button to record one (SK Admin, while Ongoing) and the expenses recorded.
function RecordExpenses({ project, meta, canRecord, ask, onDone, onFail }) {
  const list = project.expenses || [];
  const canRemove = canRecord;
  const [recording, setRecording] = useState(false);
  const remove = useMutation({
    mutationFn: (expenseId) => projectsApi.deleteExpense(project.id, expenseId),
    onSuccess: (res) => onDone(res, 'The expense was removed. Its receipt stays in the project files.'),
    onError: onFail('The expense could not be removed.'),
  });
  return (
    <Card className="overflow-hidden">
      <div className="card-head flex flex-wrap items-start justify-between gap-3 px-6 py-4">
        <h2 className="section-title">Record Expenses</h2>
        <div className="flex flex-wrap items-start gap-2">
          {canRecord && (
            <Button size="sm" onClick={() => setRecording(true)}>
              <Receipt size={16} aria-hidden="true" /> Record expense
            </Button>
          )}
          <DownloadButton
            label="Receipts"
            empty={!(project.liquidationFiles || []).some((f) => ['RECEIPT', 'LIQUIDATION'].includes(f.documentType) && f.mimeType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
            onDownload={() => projectsApi.downloadSection(project, 'receipt-liquidation')}
          />
        </div>
      </div>
      {recording && (
        <ExpenseForm
          project={project}
          categories={meta?.expenseCategories || []}
          receiptReading={Boolean(meta?.receiptReading)}
          onClose={() => setRecording(false)}
          onDone={(res, text) => {
            setRecording(false);
            onDone(res, text);
          }}
        />
      )}
      {list.length === 0 ? (
        <p className="px-6 py-5 text-slate-600">No expenses recorded yet.</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="table-notebook">
            <thead>
              <tr>
                <th>Date</th>
                <th>Receipt</th>
                <th>Category</th>
                <th>Supplier</th>
                <th className="text-right">Amount</th>
                {canRemove && <th className="w-px"><span className="sr-only">Remove</span></th>}
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{formatDate(e.date)}</td>
                  <td>
                    {e.fileId ? (
                      <button type="button" className="text-left font-medium text-pine hover:underline" onClick={() => projectsApi.openFile(project.id, e.fileId)}>
                        {e.item}
                      </button>
                    ) : (
                      e.item
                    )}
                  </td>
                  <td>{e.category || '—'}</td>
                  <td>{e.supplier || '—'}</td>
                  <td className="whitespace-nowrap text-right font-medium">{formatPeso2(e.amount)}</td>
                  {canRemove && (
                    <td>
                      <button
                        type="button"
                        className="rounded-control p-1.5 text-slate-600 hover:bg-clay-wash hover:text-clay-text"
                        aria-label={`Remove the expense ${e.item}`}
                        disabled={remove.isPending}
                        onClick={async () => {
                          if (await ask(`Remove the expense “${e.item}” (${formatPeso2(e.amount)})? Use this only for a wrong entry; the receipt stays in the files.`)) remove.mutate(e.id);
                        }}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line">
                <td colSpan={4} className="px-4 py-3 font-semibold">Spent so far</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatPeso2(project.amountSpent)}</td>
                {canRemove && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

function Completion({ project }) {
  return (
    <Card className="p-6">
      <h2 className="section-title">Completion</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Actual end date">{formatDate(project.actualEndDate)}</Field>
        <Field label="Actual participants">{project.actualParticipants}</Field>
      </dl>
      <p className="mt-4 text-sm font-semibold text-slate-600">Accomplishment summary</p>
      <p className="mt-1 whitespace-pre-wrap text-slate-800">{project.accomplishmentSummary || '—'}</p>
    </Card>
  );
}

function Cancellation({ project }) {
  return (
    <Card className="p-6">
      <h2 className="section-title">Cancellation</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Date">{formatDate(project.cancelDate)}</Field>
        <Field label="Reason">{project.cancelReason}</Field>
      </dl>
    </Card>
  );
}

// The project files (File Upload, plus the request attachments, receipts and completion reports).
function Files({ project, documentTypes, canDelete, canUpload, ask, onDone, onFail }) {
  const files = project.liquidationFiles || [];
  const [uploading, setUploading] = useState(false);
  const remove = useMutation({
    mutationFn: (fileId) => projectsApi.deleteFile(project.id, fileId),
    onSuccess: (res) => onDone(res, 'The file was removed.'),
    onError: onFail('The file could not be removed.'),
  });
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="section-title">Files</h2>
        {canUpload && (
          <Button size="sm" onClick={() => setUploading(true)}>
            <Upload size={16} aria-hidden="true" /> Upload file
          </Button>
        )}
      </div>
      {uploading && (
        <FileForm
          project={project}
          onClose={() => setUploading(false)}
          onDone={(res, text) => {
            setUploading(false);
            onDone(res, text);
          }}
        />
      )}
      {files.length === 0 ? (
        <p className="mt-2 text-slate-600">No files yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2.5">
              <FileText size={18} className="shrink-0 text-slate-600" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <button type="button" className="block max-w-full truncate text-left font-medium text-pine hover:underline" onClick={() => projectsApi.openFile(project.id, f.id).catch(onFail('The file could not be opened.'))}>
                  {f.originalName}
                </button>
                <p className="text-[13px] text-slate-600">
                  {documentTypes[f.documentType] || f.documentType}
                  {f.description ? ` · ${f.description}` : ''} · {formatDate(f.createdAt)}
                </p>
              </div>
              {canDelete && (
                <button
                  type="button"
                  className="rounded-control p-1.5 text-slate-600 hover:bg-clay-wash hover:text-clay-text"
                  aria-label={`Remove ${f.originalName}`}
                  disabled={remove.isPending}
                  onClick={async () => {
                    if (await ask(`Remove “${f.originalName}” from the project files?`)) remove.mutate(f.id);
                  }}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DeletionPending({ deletion, canWithdraw, withdrawing, onWithdraw, isChairman, onDecided }) {
  const [remarks, setRemarks] = useState('');
  const [problem, setProblem] = useState('');
  const [ask, askDialog] = useConfirm();
  const decide = useMutation({
    mutationFn: (decision) => projectsApi.reviewDeletion(deletion.id, { decision, remarks: remarks.trim() }),
    onSuccess: (_res, decision) =>
      onDecided(
        decision === 'APPROVE'
          ? 'The deletion was approved. The project is now in Archives under Deleted.'
          : 'The deletion request was rejected. The project stays in Projects.'
      ),
    onError: (err) => setProblem(errorText(err, 'Could not save the decision')),
  });
  async function choose(decision) {
    if (decision === 'REJECT' && !remarks.trim()) return setProblem('Please write remarks before rejecting.');
    const question =
      decision === 'APPROVE'
        ? 'Are you sure you want to approve this deletion? The project moves to Archives under Deleted; nothing is erased.'
        : 'Are you sure you want to reject this deletion request? The project stays in Projects.';
    if (!(await ask(question))) return;
    setProblem('');
    decide.mutate(decision);
  }
  return (
    <div className="notice notice-error mt-4 text-sm">
      <p className="font-semibold">Deletion requested — awaiting the Barangay Chairman’s approval</p>
      <p className="mt-1"><span className="font-medium">Reason:</span> {deletion.reason}</p>
      <p className="mt-1 text-xs">Requested by {deletion.requestedByName} on {formatDate(deletion.createdAt)}</p>
      {canWithdraw && (
        <Button size="sm" variant="secondary" className="mt-2" disabled={withdrawing} onClick={onWithdraw}>
          Withdraw request
        </Button>
      )}
      {isChairman && (
        <div className="mt-3 border-t border-red-200 pt-3">
          <label className="label" htmlFor="deletion-remarks">Remarks</label>
          <textarea
            id="deletion-remarks"
            className="input"
            rows={2}
            placeholder="Required when rejecting the request"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
          {problem && <p className="mt-1 text-sm">{problem}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="danger" disabled={decide.isPending} onClick={() => choose('APPROVE')}>Approve deletion</Button>
            <Button size="sm" variant="secondary" disabled={decide.isPending} onClick={() => choose('REJECT')}>Reject request</Button>
          </div>
        </div>
      )}
      {askDialog}
    </div>
  );
}
