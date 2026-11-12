import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { Archive, ArrowLeft, ArrowRight, Circle, CircleCheck, Eye, FileText, Pause, Play, Send, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import OverflowMenu from '../../components/OverflowMenu';
import { StageSteps, StatusRibbon } from '../../components/Roundel';
import { Button, Card, Modal } from '../../components/ui';
import PhotoGallery from '../../components/PhotoGallery';
import DeletionRequestModal from '../../components/DeletionRequestModal';
import ProjectReviewPanel from '../../components/ProjectReviewPanel';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  PROJECT_STATUS,
  STAGE_FLOW,
  WORK_STAGES,
  formatPeso,
  formatPeso2,
  formatDate,
  formatDateTime,
  toDateTimeLocal,
} from '../../utils/format';
import { isAdmin, isManager, isWorker } from '../../utils/roles';

const cardTitle = 'section-title';
const errorText = (err, fallback) => err?.response?.data?.message || fallback;
const stageName = (s) => PROJECT_STATUS[s]?.label || s;

// What the SK Admin does at each stage (shown above the stage's actions).
const STAGE_HELP = {
  PENDING_APPROVAL:
    'Upload and check the Project Proposal, SK Resolution and Meeting Minutes, then submit the request to the Barangay Chairman.',
  APPROVED: 'Set the start and end of the project, then proceed to Purchasing.',
  PURCHASING:
    'Upload and check the Purchase Request, at least 3 Supplier Canvasses, the Abstract of Canvass and the Purchase Order.',
  FUND_RELEASE: 'Upload and check the Obligation Request, the Disbursement Voucher and the Check or Cash Advance Record.',
  IMPLEMENTATION:
    'Upload and check the Attendance Sheet, at least 3 Activity Photos, the Delivery Receipt and the Inspection or Acceptance Report.',
  LIQUIDATION: 'Upload and check the Liquidation Report and the Official Receipts or Sales Invoices, and enter the amount spent.',
};

// Uploads: PDF, JPG or PNG only, up to 10 MB each (the server checks the same).
const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const MAX_FILE_MB = 10;
function fileProblem(files) {
  for (const f of files) {
    const okType = /\.(pdf|jpe?g|png)$/i.test(f.name) && ['application/pdf', 'image/jpeg', 'image/png'].includes(f.type);
    if (!okType) return `"${f.name}" is not a PDF, JPG or PNG file.`;
    if (f.size > MAX_FILE_MB * 1024 * 1024) return `"${f.name}" is larger than ${MAX_FILE_MB} MB.`;
  }
  return '';
}

// One project and its place in the SK project process:
//   Pending Approval -> Approved -> Purchasing -> Fund Release -> Implementation -> Liquidation -> Completed
// The SK Admin uploads and checks each stage's documents and moves the project on; the
// Barangay Chairman approves or rejects the submitted request and otherwise only views.
// Completed, rejected, archived and deleted projects are view only.
export default function AdminProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isChairman = user?.role === 'CHAIRMAN';
  const isSkAdmin = user?.role === 'ADMIN';
  const qc = useQueryClient();
  const [notice, setNotice] = useState(null); // { ok, text }
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [ask, askDialog] = useConfirm();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectsApi.get(id),
  });
  const project = data?.project;

  // Every step returns the updated project; refresh the lists and the Dashboard too.
  const refresh = (res, message) => {
    if (res?.project) qc.setQueryData(['projects', id], (old) => ({ ...old, project: { ...res.project, photos: old?.project?.photos } }));
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
    qc.invalidateQueries({ queryKey: ['deletion-requests'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
    setNotice(message ? { ok: true, text: message } : null);
  };
  const onFail = (fallback) => (err) => setNotice({ ok: false, text: errorText(err, fallback) });

  const restoreMutation = useMutation({
    mutationFn: () => projectsApi.restore(id),
    onSuccess: (res) => refresh(res, 'The project was restored.'),
    onError: onFail('Could not restore the project'),
  });
  const withdrawMutation = useMutation({
    mutationFn: () => projectsApi.withdrawDeletion(id),
    onSuccess: () => refresh(null, 'The deletion request was withdrawn.'),
    onError: onFail('Could not withdraw the request'),
  });

  if (isLoading) return <p className="text-slate-600">Loading…</p>;
  if (isError || !project)
    return (
      <div className="text-center">
        <p className="text-slate-600">Project not found.</p>
        <Link to="/admin/projects" className="mt-2 inline-block text-brand-700">
          ← Back to Projects
        </Link>
      </div>
    );

  const deleted = Boolean(project.archivedAt);
  const closed = ['COMPLETED', 'REJECTED', 'ARCHIVED'].includes(project.status);
  // Completed, rejected, archived and deleted projects are view only.
  const viewOnly = deleted || closed;
  const archiveTab = { COMPLETED: 'completed', REJECTED: 'rejected', ARCHIVED: 'archived' }[project.status];
  const canUploadPictures = isWorker(user) && !viewOnly;
  const canDeletePicture = (p) => !viewOnly && (isManager(user) || (p.uploadedById && p.uploadedById === user?.id));
  // Most recent deletion request (server returns only the latest one).
  const deletion = project.deletionRequests?.[0];
  const back = deleted
    ? { to: '/admin/archive?tab=deleted', label: 'Archives' }
    : closed
      ? { to: `/admin/archive?tab=${archiveTab}`, label: 'Archives' }
      : isChairman && project.status === 'PENDING_APPROVAL'
        ? { to: '/admin/approvals', label: 'Approvals' }
        : { to: '/admin/projects', label: 'Projects' };
  // The stage whose documents count now (an On Hold project keeps the stage it paused at).
  const docStage = project.status === 'ON_HOLD' ? project.heldFromStatus : project.status;
  const showAmounts =
    docStage === 'LIQUIDATION' || project.status === 'COMPLETED' || project.status === 'ARCHIVED' || project.amountSpent != null;

  return (
    <div>
      <Link
        to={back.to}
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to {back.label}
      </Link>

      {deleted && (
        <div className="mt-3 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold">
            Deleted on {formatDate(project.archivedAt)}. The records are kept and cannot be changed.
          </p>
          {project.archivedReason && (
            <p className="mt-1">
              <span className="font-medium">Reason:</span> {project.archivedReason}
            </p>
          )}
          {isChairman && (
            <Button
              size="sm"
              variant="primary"
              className="mt-2"
              disabled={restoreMutation.isPending}
              onClick={async () => {
                if (await ask(`Restore "${project.title}"?`, { confirmLabel: 'Restore', cancelLabel: 'Cancel' })) {
                  restoreMutation.mutate();
                }
              }}
            >
              Restore project
            </Button>
          )}
        </div>
      )}
      {!deleted && closed && (
        <p className="mt-3 rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          This project is in Archives under {stageName(project.status)}. It is view only.
        </p>
      )}

      <div className="mt-4 flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <StatusRibbon status={project.status} />
          <h1 className="mt-2 page-title">{project.title}</h1>
          {project.category && <p className="mt-1 text-slate-600">{project.category}</p>}
          <StageSteps
            status={project.status}
            heldFrom={project.heldFromStatus}
            allLabels
            className="mt-4 max-w-3xl"
          />
        </div>
        {/* Deletion is a quiet menu item, not a red button */}
        {isAdmin(user) && !viewOnly && deletion?.status !== 'PENDING' && (
          <OverflowMenu
            items={[{ label: 'Request deletion', Icon: Trash2, danger: true, onClick: () => setDeleteOpen(true) }]}
          />
        )}
      </div>

      {/* Deletion request state */}
      {deletion?.status === 'PENDING' && (
        <DeletionPending
          deletion={deletion}
          canWithdraw={isAdmin(user) && !viewOnly}
          withdrawing={withdrawMutation.isPending}
          onWithdraw={() => withdrawMutation.mutate()}
          isChairman={isChairman}
          onDecided={() => refresh(null, 'Your decision on the deletion request was saved.')}
          ask={ask}
        />
      )}
      {deletion?.status === 'REJECTED' && !deleted && (
        <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">
            Deletion request rejected by {deletion.reviewedByName || 'the chairman'}
          </p>
          {deletion.reviewRemarks && <p className="mt-1">{deletion.reviewRemarks}</p>}
        </div>
      )}
      {deleteOpen && (
        <DeletionRequestModal
          project={project}
          onClose={() => setDeleteOpen(false)}
          onSent={(text) => setNotice({ ok: true, text })}
        />
      )}

      {notice && (
        <p className={`notice mt-4 ${notice.ok ? 'notice-ok' : 'notice-error'}`} role={notice.ok ? 'status' : 'alert'}>
          {notice.text}
        </p>
      )}

      {/* The current stage and what it needs */}
      {!deleted && (
        <StagePanel
          project={project}
          isChairman={isChairman}
          isSkAdmin={isSkAdmin}
          onDone={refresh}
          onFail={onFail}
          ask={ask}
        />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Required documents, stage by stage */}
          <StageDocuments project={project} canEdit={isSkAdmin && !viewOnly} onDone={refresh} ask={ask} />

          {showAmounts && (
            <LiquidationAmounts
              project={project}
              canEdit={isSkAdmin && !viewOnly && project.status === 'LIQUIDATION'}
              onDone={refresh}
              onFail={onFail}
            />
          )}

          <StageHistory logs={project.stageLogs || []} />

          {/* Details */}
          <Card className="p-6">
            <h2 className={cardTitle}>Details</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {project.description || 'No description provided.'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-sm font-semibold text-slate-600">ABYIP item</p>
                <p className="text-slate-700">{project.abyipItem || '—'}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600">Venue</p>
                <p className="text-slate-700">{project.location || '—'}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600">Schedule</p>
                <p className="text-slate-700">
                  {project.startDate && project.endDate
                    ? `${formatDateTime(project.startDate)} – ${formatDateTime(project.endDate)}`
                    : 'Not set yet'}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600">Prepared by</p>
                <p className="text-slate-700">
                  {project.proposedByName
                    ? `${project.proposedByName}${project.proposedByPosition ? ` (${project.proposedByPosition})` : ''}`
                    : project.createdBy?.name || '—'}
                </p>
              </div>
              {project.reviewedAt && (
                <div>
                  <p className="text-sm font-semibold text-slate-600">
                    {project.approvalState === 'REJECTED' ? 'Rejected by' : 'Approved by'}
                  </p>
                  <p className="text-slate-700">
                    {project.reviewedBy?.name || 'the Barangay Chairman'} on {formatDate(project.reviewedAt)}
                  </p>
                </div>
              )}
            </div>
            {project.reviewRemarks && project.status !== 'REJECTED' && (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-semibold">Remarks:</span> {project.reviewRemarks}
              </p>
            )}
          </Card>

          {/* Purchase requests (the sheet filled in on the Project Request form) */}
          {(project.requestItems || []).length > 0 && (
            <Card className="p-6">
              <h2 className={cardTitle}>Purchase requests</h2>
              <p className="mt-1 text-sm text-slate-600">The project budget is the total of these requests.</p>
              <table className="table-notebook table-stack mt-3">
                <thead>
                  <tr>
                    <th className="py-2">No.</th>
                    <th className="py-2">PR no.</th>
                    <th className="py-2">Date of PR</th>
                    <th className="py-2">Requested by</th>
                    <th className="py-2 text-right">Estimated amount</th>
                  </tr>
                </thead>
                <tbody>
                  {project.requestItems.map((r, i) => (
                    <tr key={r.id}>
                      <td data-label="No." className="py-2 text-slate-500">{i + 1}</td>
                      <td data-label="PR no." className="py-2 text-slate-700">{r.prNo || '—'}</td>
                      <td data-label="Date of PR" className="py-2 text-slate-500">{formatDate(r.prDate)}</td>
                      <td data-label="Requested by" className="py-2 uppercase text-slate-700">{r.requestedBy || '—'}</td>
                      <td data-label="Estimated amount" className="py-2 text-right font-medium text-slate-700">{formatPeso(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line">
                    <td data-label="" className="py-2 font-semibold text-slate-700" colSpan={4}>
                      Total
                    </td>
                    <td data-label="Total" className="py-2 text-right font-semibold text-slate-800">
                      {formatPeso(project.requestItems.reduce((s, r) => s + Number(r.amount || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </Card>
          )}

          {/* Pictures (also shown on the public project page) */}
          <Card className="p-6">
            <h2 className={cardTitle}>Pictures</h2>
            <p className="mt-1 mb-4 text-sm text-slate-600">
              Pictures of the work appear on the public project page so residents can see it.
              The uploader and the SK Admin can delete a picture.
            </p>
            <PhotoGallery
              photos={project.photos}
              target={{ projectId: project.id }}
              canUpload={canUploadPictures}
              canDelete={canDeletePicture}
              onChange={() => qc.invalidateQueries({ queryKey: ['projects', id] })}
              emptyText="No pictures yet."
            />
          </Card>
        </div>

        {/* Right column: budget + team */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className={cardTitle}>Budget</h2>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-slate-500">Total budget</span>
              <span className="font-semibold text-slate-800">{formatPeso2(project.budget)}</span>
            </div>
            {project.amountSpent != null && (
              <>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-slate-500">Amount spent</span>
                  <span className="font-semibold text-slate-800">{formatPeso2(project.amountSpent)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-slate-500">Amount returned</span>
                  <span className="font-semibold text-slate-800">{formatPeso2(project.amountReturned)}</span>
                </div>
              </>
            )}
          </Card>

          <Card className="p-6">
            <h2 className={cardTitle}>Team</h2>
            {(project.officials || []).length === 0 ? (
              <p className="mt-2 text-slate-600">No team members assigned.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {project.officials.map((o) => (
                  <li key={o.id} className="flex items-center gap-2 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                      {o.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-slate-700">{o.name}</p>
                      <p className="text-sm text-slate-600">{o.position}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      {askDialog}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The current stage: what it needs, from whom, and its actions.
// ---------------------------------------------------------------------------
function StagePanel({ project, isChairman, isSkAdmin, onDone, onFail, ask }) {
  const s = project.status;
  if (s === 'PENDING_APPROVAL') {
    if (project.submittedAt) {
      return isChairman ? (
        <ProjectReviewPanel project={project} onDone={onDone} onFail={onFail} />
      ) : (
        <Notice tone="amber">
          <span className="font-semibold">Submitted on {formatDateTime(project.submittedAt)}.</span> Waiting for the
          Barangay Chairman to approve or reject this Project Request. Its documents are locked until then.
        </Notice>
      );
    }
    return isSkAdmin ? (
      <SubmitPanel project={project} onDone={onDone} onFail={onFail} ask={ask} />
    ) : (
      <Notice tone="slate">
        <span className="font-semibold">Pending Approval.</span> The SK Admin is still preparing the documents of this
        request. It appears in Approvals once it is submitted.
      </Notice>
    );
  }
  if (s === 'REJECTED') {
    return (
      <Notice tone="red">
        <p className="font-semibold">
          Rejected by {project.reviewedBy?.name || 'the Barangay Chairman'}
          {project.reviewedAt ? ` on ${formatDate(project.reviewedAt)}` : ''}
        </p>
        <p className="mt-1">
          <span className="font-medium">Remarks:</span> {project.rejectionRemarks || project.reviewRemarks || '—'}
        </p>
      </Notice>
    );
  }
  if (WORK_STAGES.includes(s)) {
    return isSkAdmin ? (
      <>
        {s === 'APPROVED' && <ScheduleForm project={project} onDone={onDone} onFail={onFail} ask={ask} />}
        <ProceedPanel project={project} onDone={onDone} onFail={onFail} ask={ask} />
      </>
    ) : (
      <Notice tone="slate">
        <span className="font-semibold">{stageName(s)}.</span> The SK Admin is completing this stage. {STAGE_HELP[s]}
      </Notice>
    );
  }
  if (s === 'ON_HOLD') {
    return <HoldPanel project={project} isSkAdmin={isSkAdmin} onDone={onDone} onFail={onFail} ask={ask} />;
  }
  if (s === 'COMPLETED') {
    return <CompletedPanel project={project} isSkAdmin={isSkAdmin} onDone={onDone} onFail={onFail} ask={ask} />;
  }
  return (
    <Notice tone="slate">
      <span className="font-semibold">Archived.</span> This completed project was filed away. It is view only.
    </Notice>
  );
}

function Notice({ tone, children }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    red: 'bg-red-50 text-red-800',
    green: 'bg-green-50 text-green-800',
    amber: 'bg-amber-50 text-amber-900',
  };
  return <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

// What still stands between the stage and the next step.
function MissingList({ items }) {
  if (!items?.length) return null;
  return (
    <div className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
      <p className="font-semibold">Still missing:</p>
      <ul className="mt-1 list-disc pl-5">
        {items.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

// Pending Approval (not yet submitted): the SK Admin submits once the documents are complete.
function SubmitPanel({ project, onDone, onFail, ask }) {
  const submit = useMutation({
    mutationFn: () => projectsApi.submit(project.id),
    onSuccess: (res) => onDone(res, 'The request was submitted. The Barangay Chairman has been notified.'),
    onError: onFail('Could not submit the request'),
  });
  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-lg font-bold text-slate-900">Pending Approval: prepare the request</h2>
          <p className="text-sm text-slate-600">{STAGE_HELP.PENDING_APPROVAL}</p>
        </div>
        <Button
          variant="primary"
          disabled={!project.canSubmit || submit.isPending}
          onClick={async () => {
            const yes = await ask(
              `Submit "${project.title}" to the Barangay Chairman? Its documents are locked until the Barangay Chairman decides.`,
              { title: 'Submit for approval?', confirmLabel: 'Submit', cancelLabel: 'Cancel' }
            );
            if (yes) submit.mutate();
          }}
        >
          <Send size={18} strokeWidth={1.75} aria-hidden="true" />
          {submit.isPending ? 'Submitting…' : 'Submit for Approval'}
        </Button>
      </div>
      <MissingList items={project.stageMissing} />
    </Card>
  );
}

// Approved: the SK Admin sets the start and end; needed before Purchasing.
function ScheduleForm({ project, onDone, onFail, ask }) {
  const [start, setStart] = useState(project.startDate ? toDateTimeLocal(project.startDate) : '');
  const [end, setEnd] = useState(project.endDate ? toDateTimeLocal(project.endDate) : '');
  const [problem, setProblem] = useState('');
  const nowLocal = toDateTimeLocal(new Date());
  const save = useMutation({
    mutationFn: () =>
      projectsApi.setSchedule(project.id, {
        startDate: new Date(start).toISOString(),
        endDate: new Date(end).toISOString(),
      }),
    onSuccess: (res) => onDone(res, 'The schedule was saved.'),
    onError: onFail('Could not save the schedule'),
  });
  // Checks the dates, then asks for confirmation before saving.
  async function submit(e) {
    e.preventDefault();
    if (!start || !end) return setProblem('Enter the start and the end date and time.');
    if (new Date(start) < new Date(Date.now() - 60 * 1000)) return setProblem('The start date and time cannot be in the past.');
    if (new Date(end) <= new Date(start)) return setProblem('The end date and time must be later than the start.');
    setProblem('');
    if (await ask('Save this schedule?', { confirmLabel: 'Save', cancelLabel: 'Cancel' })) save.mutate();
  }
  return (
    <Card className="mt-4 p-5">
      <h2 className="text-lg font-bold text-slate-900">Set the schedule</h2>
      <p className="mt-1 text-sm text-slate-600">
        {project.startDate
          ? `Saved: ${formatDateTime(project.startDate)} – ${formatDateTime(project.endDate)}. You can still change it while the project is Approved.`
          : 'The project can proceed to Purchasing once its schedule is saved.'}
      </p>
      <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={submit}>
        <label>
          <span className="label">Start date and time *</span>
          <input
            type="datetime-local"
            className="input"
            value={start}
            min={nowLocal}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </label>
        <label>
          <span className="label">End date and time *</span>
          <input
            type="datetime-local"
            className="input"
            value={end}
            min={start || nowLocal}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </label>
        <Button type="submit" variant="secondary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save schedule'}
        </Button>
      </form>
      {problem && <p className="mt-2 text-sm font-medium text-red-600" role="alert">{problem}</p>}
    </Card>
  );
}

// Approved to Liquidation: "Proceed to Next Stage" (disabled until the stage is complete) and Hold.
function ProceedPanel({ project, onDone, onFail, ask }) {
  const next = project.nextStatus;
  const proceed = useMutation({
    mutationFn: () => projectsApi.nextStage(project.id),
    onSuccess: (res) =>
      onDone(
        res,
        next === 'COMPLETED' ? 'The project is completed. It is now in Archives under Completed.' : `The project moved to ${stageName(next)}.`
      ),
    onError: onFail('Could not move the project to the next stage'),
  });
  const hold = useMutation({
    mutationFn: () => projectsApi.toggleHold(project.id),
    onSuccess: (res) => onDone(res, 'The project is on hold.'),
    onError: onFail('Could not put the project on hold'),
  });
  const busy = proceed.isPending || hold.isPending;
  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-lg font-bold text-slate-900">{stageName(project.status)}</h2>
          <p className="text-sm text-slate-600">{STAGE_HELP[project.status]}</p>
        </div>
        <div className="actions-stack flex w-full flex-wrap gap-2 sm:w-auto">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              const yes = await ask(
                `Put "${project.title}" on hold? It stays at ${stageName(project.status)} and resumes there.`,
                { title: 'Put on hold?', confirmLabel: 'Hold', cancelLabel: 'Cancel' }
              );
              if (yes) hold.mutate();
            }}
          >
            <Pause size={18} strokeWidth={1.75} aria-hidden="true" />
            Hold
          </Button>
          <Button
            variant="primary"
            disabled={!project.canProceed || busy}
            onClick={async () => {
              const yes = await ask(
                next === 'COMPLETED'
                  ? `Mark "${project.title}" as completed? It moves to Archives under Completed and becomes view only.`
                  : `Move "${project.title}" from ${stageName(project.status)} to ${stageName(next)}? This stage's documents can no longer be changed.`,
                { title: 'Proceed to the next stage?', confirmLabel: 'Proceed', cancelLabel: 'Cancel' }
              );
              if (yes) proceed.mutate();
            }}
          >
            Proceed to Next Stage
            <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </div>
      </div>
      <MissingList items={project.stageMissing} />
    </Card>
  );
}

// On Hold: paused at a stage. The SK Admin resumes it there.
function HoldPanel({ project, isSkAdmin, onDone, onFail, ask }) {
  const resume = useMutation({
    mutationFn: () => projectsApi.toggleHold(project.id),
    onSuccess: (res) => onDone(res, `The project resumed at ${stageName(project.heldFromStatus)}.`),
    onError: onFail('Could not resume the project'),
  });
  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-lg font-bold text-slate-900">On Hold at {stageName(project.heldFromStatus)}</h2>
          <p className="text-sm text-slate-600">
            The project is paused. Its documents cannot be changed and it cannot move on until it is resumed.
          </p>
        </div>
        {isSkAdmin && (
          <Button
            variant="primary"
            disabled={resume.isPending}
            onClick={async () => {
              const yes = await ask(`Resume "${project.title}" at ${stageName(project.heldFromStatus)}?`, {
                title: 'Resume the project?',
                confirmLabel: 'Resume',
                cancelLabel: 'Cancel',
              });
              if (yes) resume.mutate();
            }}
          >
            <Play size={18} strokeWidth={1.75} aria-hidden="true" />
            Resume
          </Button>
        )}
      </div>
    </Card>
  );
}

// Completed: view only; the SK Admin can archive it.
function CompletedPanel({ project, isSkAdmin, onDone, onFail, ask }) {
  const archive = useMutation({
    mutationFn: () => projectsApi.archive(project.id),
    onSuccess: (res) => onDone(res, 'The project was archived. It is now in Archives under Archived.'),
    onError: onFail('Could not archive the project'),
  });
  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-lg font-bold text-slate-900">Completed</h2>
          <p className="text-sm text-slate-600">Every stage is done and its documents are on file.</p>
        </div>
        {isSkAdmin && (
          <Button
            variant="secondary"
            disabled={archive.isPending}
            onClick={async () => {
              const yes = await ask(`Archive "${project.title}"? It moves to Archives under Archived and stays view only.`, {
                title: 'Archive this project?',
                confirmLabel: 'Archive',
                cancelLabel: 'Cancel',
              });
              if (yes) archive.mutate();
            }}
          >
            <Archive size={18} strokeWidth={1.75} aria-hidden="true" />
            Archive
          </Button>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Required documents of each stage reached so far. The current stage's checklist is
// editable by the SK Admin (upload, preview, check, delete); earlier stages are view only.
// ---------------------------------------------------------------------------
function StageDocuments({ project, canEdit, onDone, ask }) {
  const [msg, setMsg] = useState(null); // { ok, text }
  const [preview, setPreview] = useState(null); // the file being previewed
  const docStage = project.status === 'ON_HOLD' ? project.heldFromStatus : project.status;
  const reached =
    project.status === 'REJECTED'
      ? 0
      : ['COMPLETED', 'ARCHIVED'].includes(project.status)
        ? STAGE_FLOW.length
        : STAGE_FLOW.indexOf(docStage);
  // The stage whose files the SK Admin may change now (none while submitted or on hold).
  const editableStage =
    canEdit && project.status !== 'ON_HOLD' && !(project.status === 'PENDING_APPROVAL' && project.submittedAt)
      ? project.status
      : null;
  const groups = (project.checklist || [])
    .filter((g) => STAGE_FLOW.indexOf(g.stage) <= reached)
    .sort((a, b) => STAGE_FLOW.indexOf(b.stage) - STAGE_FLOW.indexOf(a.stage)); // newest stage first

  const say = (ok, text) => setMsg({ ok, text });
  const done = (text) => (res) => {
    onDone(res);
    say(true, text);
  };
  const failed = (fallback) => (err) => say(false, errorText(err, fallback));

  const upload = useMutation({
    mutationFn: ({ doc, files }) => projectsApi.uploadDocuments(project.id, doc.id, files),
    onSuccess: (res, { doc, files }) =>
      done(`${files.length} file${files.length === 1 ? '' : 's'} uploaded to ${doc.name}. Check ${files.length === 1 ? 'it' : 'them'} after reviewing.`)(res),
    onError: failed('Could not upload the files'),
  });
  const check = useMutation({
    mutationFn: ({ file, value }) => projectsApi.checkDocument(project.id, file.id, value),
    onSuccess: (res, { file, value }) => done(value ? `"${file.originalName}" is checked.` : `"${file.originalName}" is no longer checked.`)(res),
    onError: failed('Could not update the check mark'),
  });
  const remove = useMutation({
    mutationFn: (file) => projectsApi.deleteDocument(project.id, file.id),
    onSuccess: (res, file) => done(`"${file.originalName}" was deleted.`)(res),
    onError: failed('Could not delete the file'),
  });
  const busy = upload.isPending || check.isPending || remove.isPending;

  if (groups.length === 0) return null;
  return (
    <Card className="p-6">
      <h2 className={cardTitle}>Required documents</h2>
      <p className="mt-1 text-sm text-slate-600">
        Each stage needs its documents uploaded and checked before the project moves on. PDF, JPG or PNG, up to{' '}
        {MAX_FILE_MB} MB each.
      </p>
      {msg && (
        <p className={`notice mt-3 ${msg.ok ? 'notice-ok' : 'notice-error'}`} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
      <div className="mt-4 space-y-5">
        {groups.map((g) => {
          const editable = g.stage === editableStage;
          const doneCount = g.documents.filter((d) => d.complete).length;
          return (
            <section key={g.stage} aria-labelledby={`stage-docs-${g.stage}`} className="rounded-lg border border-line">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line bg-slate-50 px-4 py-2.5">
                <h3 id={`stage-docs-${g.stage}`} className="font-semibold text-slate-900">
                  {g.label}
                  {g.stage === docStage && !['COMPLETED', 'ARCHIVED'].includes(project.status) && (
                    <span className="ml-2 text-sm font-normal text-slate-600">(current stage)</span>
                  )}
                </h3>
                <span className={`text-sm font-semibold ${g.complete ? 'text-sage-text' : 'text-slate-700'}`}>
                  {doneCount} of {g.documents.length} complete
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.documents.map((d) => (
                  <DocumentRow
                    key={d.id}
                    doc={d}
                    editable={editable}
                    busy={busy}
                    onUpload={(files) => {
                      const problem = fileProblem(files);
                      if (problem) return say(false, problem);
                      upload.mutate({ doc: d, files });
                    }}
                    onCheck={(file, value) => check.mutate({ file, value })}
                    onPreview={setPreview}
                    onDelete={async (file) => {
                      const yes = await ask(`Delete "${file.originalName}" from ${d.name}?`, {
                        confirmLabel: 'Delete',
                        cancelLabel: 'Cancel',
                        variant: 'danger',
                      });
                      if (yes) remove.mutate(file);
                    }}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <FilePreview projectId={project.id} file={preview} onClose={() => setPreview(null)} />
    </Card>
  );
}

function DocumentRow({ doc, editable, busy, onUpload, onCheck, onPreview, onDelete }) {
  const [inputKey, setInputKey] = useState(0); // changing it clears the file input
  const needs = doc.minFiles > 1 ? `At least ${doc.minFiles} checked files` : 'One checked file';
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {doc.complete ? (
          <CircleCheck size={20} strokeWidth={1.75} className="shrink-0 text-sage" aria-label="Complete" />
        ) : (
          <Circle size={20} strokeWidth={1.75} className="shrink-0 text-slate-400" aria-label="Not complete" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{doc.name}</p>
          <p className="text-sm text-slate-600">
            {needs} · {doc.checkedCount} checked of {doc.files.length} uploaded
          </p>
        </div>
        {editable && (
          <label
            className={`btn btn-secondary cursor-pointer px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-brand-500 ${
              busy ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <Upload size={16} strokeWidth={1.75} aria-hidden="true" />
            Upload
            <input
              key={inputKey}
              type="file"
              multiple
              className="sr-only"
              accept={ACCEPT}
              disabled={busy}
              aria-label={`Upload files for ${doc.name}`}
              onChange={(e) => {
                const list = [...(e.target.files || [])];
                setInputKey((k) => k + 1);
                if (list.length > 0) onUpload(list);
              }}
            />
          </label>
        )}
      </div>
      {doc.files.length > 0 && (
        <ul className="mt-2 space-y-2 sm:pl-8">
          {doc.files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <label className={`flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1 ${editable ? 'cursor-pointer' : ''}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-green-700"
                  checked={f.isChecked}
                  disabled={!editable || busy}
                  onChange={(e) => onCheck(f, e.target.checked)}
                  aria-label={`Checked: ${f.originalName}`}
                />
                <FileText size={16} strokeWidth={1.75} className="shrink-0 text-slate-500" aria-hidden="true" />
                <span className="min-w-0 truncate text-slate-800" title={f.originalName}>
                  {f.originalName}
                </span>
              </label>
              <span className="text-slate-500">
                {formatDate(f.uploadedAt)}
                {f.uploadedBy?.name ? ` · ${f.uploadedBy.name}` : ''}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800"
                onClick={() => onPreview(f)}
              >
                <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
                Preview
              </button>
              {editable && (
                <button
                  type="button"
                  className="font-semibold text-red-600 hover:text-red-700"
                  disabled={busy}
                  onClick={() => onDelete(f)}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// Shows an uploaded file in a dialog (the file needs the login token, so it is fetched as a blob).
function FilePreview({ projectId, file, onClose }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return undefined;
    }
    let objectUrl = null;
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    projectsApi
      .documentBlob(projectId, file.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, file]);
  const isPdf = file?.mimeType === 'application/pdf';
  return (
    <Modal
      open={Boolean(file)}
      onClose={onClose}
      size="xl"
      title={file?.originalName || 'Preview'}
      footer={
        <>
          {url && (
            <a className="btn btn-secondary px-4 py-2 text-[15px]" href={url} target="_blank" rel="noreferrer">
              Open in a new tab
            </a>
          )}
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="pb-5">
        {failed ? (
          <p className="text-sm text-red-600">The file could not be opened. It may be missing.</p>
        ) : !url ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : isPdf ? (
          <iframe title={file?.originalName || 'Preview'} src={url} className="h-[65vh] w-full rounded border border-line" />
        ) : (
          <img src={url} alt={file?.originalName || ''} className="mx-auto max-h-[65vh] w-auto rounded border border-line" />
        )}
      </div>
    </Modal>
  );
}

// Liquidation: budget, amount spent (entered by the SK Admin) and amount returned (budget - spent).
function LiquidationAmounts({ project, canEdit, onDone, onFail }) {
  const [spent, setSpent] = useState(project.amountSpent != null ? String(Number(project.amountSpent)) : '');
  const [problem, setProblem] = useState('');
  const budget = Number(project.budget || 0);
  const spentNumber = spent === '' ? null : Number(spent);
  const returned = spentNumber == null || Number.isNaN(spentNumber) ? null : Math.round((budget - spentNumber) * 100) / 100;
  const save = useMutation({
    mutationFn: () => projectsApi.update(project.id, { amountSpent: spentNumber }),
    onSuccess: (res) => onDone(res, 'The amount spent was saved.'),
    onError: onFail('Could not save the amount spent'),
  });
  function submit(e) {
    e.preventDefault();
    if (spentNumber == null || Number.isNaN(spentNumber) || spentNumber < 0) return setProblem('Enter the amount spent (0 or more).');
    if (spentNumber > budget) return setProblem('The amount spent cannot be more than the budget.');
    setProblem('');
    save.mutate();
  }
  const shownReturned = canEdit ? returned : project.amountReturned;
  return (
    <Card className="p-6">
      <h2 className={cardTitle}>Liquidation</h2>
      <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-semibold text-slate-600">Budget</dt>
          <dd className="mt-0.5 font-display text-xl text-slate-900">{formatPeso2(budget)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-600">Amount spent</dt>
          <dd className="mt-0.5 font-display text-xl text-slate-900">
            {project.amountSpent != null ? formatPeso2(project.amountSpent) : 'Not entered yet'}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-600">Amount returned</dt>
          <dd className="mt-0.5 font-display text-xl text-slate-900">
            {shownReturned != null ? formatPeso2(shownReturned) : '—'}
          </dd>
        </div>
      </dl>
      {canEdit && (
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={submit}>
          <label className="block">
            <span className="label">Amount spent (₱) *</span>
            <input
              type="number"
              className="input w-48"
              min={0}
              max={budget}
              step="0.01"
              inputMode="decimal"
              value={spent}
              onChange={(e) => setSpent(e.target.value)}
              aria-describedby="returned-hint"
              required
            />
          </label>
          <Button type="submit" variant="secondary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save amount'}
          </Button>
          <p id="returned-hint" className="w-full text-sm text-slate-600">
            Amount returned = budget − amount spent
            {returned != null && !Number.isNaN(returned) ? ` = ${formatPeso2(returned)}` : ''}.
          </p>
        </form>
      )}
      {problem && <p className="mt-2 text-sm font-medium text-red-600" role="alert">{problem}</p>}
    </Card>
  );
}

// Every stage change: date, from, to, who, remarks.
function StageHistory({ logs }) {
  return (
    <Card className="p-6">
      <h2 className={cardTitle}>Stage history</h2>
      {logs.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No stage changes recorded yet.</p>
      ) : (
        <table className="table-notebook table-stack mt-3">
          <thead>
            <tr>
              <th className="py-2">Date</th>
              <th className="py-2">From</th>
              <th className="py-2">To</th>
              <th className="py-2">Changed by</th>
              <th className="py-2">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td data-label="Date" className="py-2 text-slate-600">{formatDateTime(l.changedAt)}</td>
                <td data-label="From" className="py-2 text-slate-700">{l.fromStatus ? stageName(l.fromStatus) : '—'}</td>
                <td data-label="To" className="py-2 font-medium text-slate-800">{stageName(l.toStatus)}</td>
                <td data-label="Changed by" className="py-2 text-slate-700">{l.changedBy?.name || '—'}</td>
                <td data-label="Remarks" className="py-2 text-slate-600">{l.remarks || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// A pending deletion request. The Barangay Chairman approves (-> Archives > Deleted) or
// rejects it with remarks; the admins can withdraw it.
function DeletionPending({ deletion, canWithdraw, withdrawing, onWithdraw, isChairman, onDecided, ask }) {
  const [remarks, setRemarks] = useState('');
  const [problem, setProblem] = useState('');
  const decide = useMutation({
    mutationFn: (decision) => projectsApi.reviewDeletion(deletion.id, { decision, remarks: remarks.trim() }),
    onSuccess: () => onDecided(),
    onError: (err) => setProblem(errorText(err, 'Could not save the decision')),
  });
  async function choose(decision) {
    if (decision === 'REJECT' && !remarks.trim()) return setProblem('Please write remarks before rejecting.');
    if (
      decision === 'APPROVE' &&
      !(await ask('Approve this deletion? The project moves to Archives under Deleted; nothing is erased.', {
        confirmLabel: 'Approve',
        cancelLabel: 'Cancel',
        variant: 'danger',
      }))
    )
      return;
    setProblem('');
    decide.mutate(decision);
  }
  return (
    <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
      <p className="font-semibold">Deletion requested — awaiting the Barangay Chairman’s approval</p>
      <p className="mt-1">
        <span className="font-medium">Reason:</span> {deletion.reason}
      </p>
      <p className="mt-1 text-xs text-red-600">
        Requested by {deletion.requestedByName} on {formatDate(deletion.createdAt)}
      </p>
      {canWithdraw && (
        <Button size="sm" variant="secondary" className="mt-2" disabled={withdrawing} onClick={onWithdraw}>
          Withdraw request
        </Button>
      )}
      {isChairman && (
        <div className="mt-3 border-t border-red-100 pt-3">
          <label className="label" htmlFor="deletion-remarks">
            Remarks
          </label>
          <textarea
            id="deletion-remarks"
            className="input"
            rows={2}
            placeholder="Required when rejecting the request"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
          {problem && <p className="mt-1 text-sm text-red-600">{problem}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="danger" disabled={decide.isPending} onClick={() => choose('APPROVE')}>
              Approve deletion
            </Button>
            <Button size="sm" variant="secondary" disabled={decide.isPending} onClick={() => choose('REJECT')}>
              Reject request
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
