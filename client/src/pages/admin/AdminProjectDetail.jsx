import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { ArrowLeft, CircleCheck, FileText, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import OverflowMenu from '../../components/OverflowMenu';
import { StageSteps, StatusRibbon } from '../../components/Roundel';
import { Button, Card } from '../../components/ui';
import PhotoGallery from '../../components/PhotoGallery';
import DeletionRequestModal from '../../components/DeletionRequestModal';
import { formatPeso, formatDate, formatDateTime } from '../../utils/format';
import { isAdmin, isManager, isWorker } from '../../utils/roles';

const cardTitle = 'font-display text-2xl font-bold uppercase tracking-wide text-slate-900';
const errorText = (err, fallback) => err?.response?.data?.message || fallback;

// One project and its stage in the flow:
//   Proposed  -> the Barangay Chairman approves (Planning) or rejects (Cancelled)
//   Planning  -> the SK Admin saves the schedule (Ongoing)
//   Ongoing   -> the SK Admin uploads the receipt liquidation and keeps the optional
//                checklist, then clicks "Project Completed" (Completed)
// Completed and Cancelled projects live in Archives and are view only.
export default function AdminProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isChairman = user?.role === 'CHAIRMAN';
  const isSkAdmin = user?.role === 'ADMIN';
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectsApi.get(id),
  });
  const project = data?.project;

  // Every step returns the updated project; refresh the lists and the Dashboard too.
  const refresh = (res) => {
    if (res?.project) qc.setQueryData(['projects', id], (old) => ({ ...old, project: { ...res.project, photos: old?.project?.photos } }));
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
    qc.invalidateQueries({ queryKey: ['deletion-requests'] });
    setError('');
  };
  const onFail = (fallback) => (err) => setError(errorText(err, fallback));

  const restoreMutation = useMutation({
    mutationFn: () => projectsApi.restore(id),
    onSuccess: refresh,
    onError: onFail('Could not restore the project'),
  });
  const withdrawMutation = useMutation({
    mutationFn: () => projectsApi.withdrawDeletion(id),
    onSuccess: refresh,
    onError: onFail('Could not withdraw the request'),
  });

  if (isLoading) return <p className="text-slate-600">Loading…</p>;
  if (isError || !project)
    return (
      <div className="text-center">
        <p className="text-slate-600">Project not found.</p>
        <Link to="/admin/projects" className="mt-2 inline-block text-brand-600">
          ← Back to Projects
        </Link>
      </div>
    );

  const deleted = Boolean(project.archivedAt);
  const closed = project.status === 'COMPLETED' || project.status === 'CANCELLED';
  // Completed, cancelled and deleted projects are view only.
  const viewOnly = deleted || closed;
  const canUploadPictures = isWorker(user) && !viewOnly;
  const canDeletePicture = (p) => !viewOnly && (isManager(user) || (p.uploadedById && p.uploadedById === user?.id));
  // Most recent deletion request (server returns only the latest one).
  const deletion = project.deletionRequests?.[0];
  const back = deleted
    ? { to: '/admin/archive?tab=deleted', label: 'Archives' }
    : closed
      ? { to: `/admin/archive?tab=${project.status === 'COMPLETED' ? 'completed' : 'cancelled'}`, label: 'Archives' }
      : { to: '/admin/projects', label: 'Projects' };

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
              onClick={() => {
                if (window.confirm(`Restore "${project.title}"?`)) restoreMutation.mutate();
              }}
            >
              Restore project
            </Button>
          )}
        </div>
      )}
      {!deleted && closed && (
        <p className="mt-3 rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          This project is in Archives under {project.status === 'COMPLETED' ? 'Completed' : 'Cancelled'}. It is view only.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <StatusRibbon status={project.status} />
          <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none tracking-wide text-slate-900">
            {project.title}
          </h1>
          {project.category && <p className="mt-1 text-slate-600">{project.category}</p>}
          <StageSteps status={project.status} className="mt-4 max-w-xl" />
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
          onDecided={refresh}
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
      {deleteOpen && <DeletionRequestModal project={project} onClose={() => setDeleteOpen(false)} />}

      {error && <p className="mt-3 text-sm font-medium text-red-600" role="alert">{error}</p>}

      {/* The current stage */}
      {!deleted && (
        <StagePanel
          project={project}
          isChairman={isChairman}
          isSkAdmin={isSkAdmin}
          onDone={refresh}
          onFail={onFail}
        />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Details */}
          <Card className="p-6">
            <h2 className={cardTitle}>Details</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {project.description || 'No description provided.'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
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
            {project.reviewRemarks && (
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
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-sm text-slate-600">
                  <tr>
                    <th className="py-2">No.</th>
                    <th className="py-2">PR no.</th>
                    <th className="py-2">Date of PR</th>
                    <th className="py-2">Requested by</th>
                    <th className="py-2 text-right">Estimated amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {project.requestItems.map((r, i) => (
                    <tr key={r.id}>
                      <td className="py-2 text-slate-500">{i + 1}</td>
                      <td className="py-2 text-slate-700">{r.prNo || '—'}</td>
                      <td className="py-2 text-slate-500">{formatDate(r.prDate)}</td>
                      <td className="py-2 uppercase text-slate-700">{r.requestedBy || '—'}</td>
                      <td className="py-2 text-right font-medium text-slate-700">{formatPeso(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td className="py-2 font-semibold text-slate-700" colSpan={4}>
                      Total
                    </td>
                    <td className="py-2 text-right font-semibold text-slate-800">
                      {formatPeso(project.requestItems.reduce((s, r) => s + Number(r.amount || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </Card>
          )}

          {/* Liquidation and checklist: from Ongoing on (view only once closed) */}
          {(project.status === 'ONGOING' || project.status === 'COMPLETED' || (project.liquidationFiles || []).length > 0) && (
            <Liquidation
              project={project}
              canEdit={isSkAdmin && !viewOnly && project.status === 'ONGOING'}
              onDone={refresh}
              onFail={onFail}
            />
          )}
          {(project.status === 'ONGOING' || (project.checklistItems || []).length > 0) && (
            <Checklist
              project={project}
              canEdit={isSkAdmin && !viewOnly && project.status === 'ONGOING'}
              onDone={refresh}
              onFail={onFail}
            />
          )}

          {/* Pictures (also shown on the public project page) */}
          <Card className="p-6">
            <h2 className={cardTitle}>Pictures</h2>
            <p className="mt-1 mb-4 text-sm text-slate-600">
              Pictures of the work appear on the public project page so residents can see it.
              The uploader and the SK Chairperson can delete a picture.
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
              <span className="font-semibold text-slate-800">{formatPeso(project.budget)}</span>
            </div>
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
    </div>
  );
}

// What the current stage needs, and from whom.
function StagePanel({ project, isChairman, isSkAdmin, onDone, onFail }) {
  if (project.status === 'PROPOSED') {
    return isChairman ? (
      <ReviewPanel project={project} onDone={onDone} onFail={onFail} />
    ) : (
      <Notice tone="slate">
        <span className="font-semibold">Proposed.</span> Waiting for the Barangay Chairman to approve or
        reject this Project Request.
      </Notice>
    );
  }
  if (project.status === 'CANCELLED') {
    return (
      <Notice tone="red">
        <p className="font-semibold">
          {project.approvalState === 'REJECTED'
            ? `Rejected by ${project.reviewedBy?.name || 'the Barangay Chairman'}`
            : 'Project cancelled'}
        </p>
        {(project.reviewRemarks || project.cancelReason) && (
          <p className="mt-1">{project.reviewRemarks || project.cancelReason}</p>
        )}
      </Notice>
    );
  }
  if (project.status === 'PLANNING') {
    return isSkAdmin ? (
      <ScheduleForm project={project} onDone={onDone} onFail={onFail} />
    ) : (
      <Notice tone="slate">
        <span className="font-semibold">Planning.</span> Approved by the Barangay Chairman. Waiting for the SK
        Admin to set the schedule.
      </Notice>
    );
  }
  if (project.status === 'ONGOING') {
    return <CompletePanel project={project} isSkAdmin={isSkAdmin} onDone={onDone} onFail={onFail} />;
  }
  return (
    <Notice tone="green">
      <span className="font-semibold">Completed.</span> The receipt liquidation was uploaded and the project was
      marked as completed.
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

// Proposed: the Barangay Chairman approves (-> Planning) or rejects (-> Cancelled).
function ReviewPanel({ project, onDone, onFail }) {
  const [remarks, setRemarks] = useState('');
  const review = useMutation({
    mutationFn: (decision) => projectsApi.review(project.id, { decision, remarks: remarks.trim() }),
    onSuccess: onDone,
    onError: onFail('Could not save your decision'),
  });
  function decide(decision) {
    const question =
      decision === 'APPROVE'
        ? `Approve "${project.title}"? It moves to Planning.`
        : `Reject "${project.title}"? It is cancelled and moves to Archives under Cancelled.`;
    if (window.confirm(question)) review.mutate(decision);
  }
  return (
    <Card className="mt-4 p-5">
      <h2 className="text-lg font-bold text-slate-900">Approve or reject this Project Request</h2>
      <label className="label mt-3" htmlFor="review-remarks">
        Remarks (optional)
      </label>
      <textarea
        id="review-remarks"
        className="input"
        rows={2}
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" disabled={review.isPending} onClick={() => decide('APPROVE')}>
          <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" />
          Approve
        </Button>
        <Button variant="danger" disabled={review.isPending} onClick={() => decide('REJECT')}>
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
          Reject
        </Button>
      </div>
    </Card>
  );
}

// Planning: the SK Admin saves the schedule; the project becomes Ongoing.
function ScheduleForm({ project, onDone, onFail }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [problem, setProblem] = useState('');
  const save = useMutation({
    mutationFn: () =>
      projectsApi.setSchedule(project.id, {
        startDate: new Date(start).toISOString(),
        endDate: new Date(end).toISOString(),
      }),
    onSuccess: onDone,
    onError: onFail('Could not save the schedule'),
  });
  function submit(e) {
    e.preventDefault();
    if (!start || !end) return setProblem('Enter the start and the end date and time.');
    if (new Date(end) <= new Date(start)) return setProblem('The end date and time must be later than the start.');
    setProblem('');
    save.mutate();
  }
  return (
    <Card className="mt-4 p-5">
      <h2 className="text-lg font-bold text-slate-900">Set the schedule</h2>
      <p className="mt-1 text-sm text-slate-600">Saving the schedule moves the project to Ongoing.</p>
      <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={submit}>
        <label>
          <span className="label">Start date and time *</span>
          <input type="datetime-local" className="input" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label>
          <span className="label">End date and time *</span>
          <input
            type="datetime-local"
            className="input"
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </label>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save schedule'}
        </Button>
      </form>
      {problem && <p className="mt-2 text-sm font-medium text-red-600" role="alert">{problem}</p>}
    </Card>
  );
}

// Ongoing: "Project Completed" once the liquidation is uploaded and the checklist is done.
function CompletePanel({ project, isSkAdmin, onDone, onFail }) {
  const complete = useMutation({
    mutationFn: () => projectsApi.complete(project.id),
    onSuccess: onDone,
    onError: onFail('Could not mark the project as completed'),
  });
  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Ongoing</h2>
          <p className="text-sm text-slate-600">
            Upload the receipt liquidation and finish the checklist (if any), then mark the project as completed.
          </p>
        </div>
        {isSkAdmin && (
          <Button
            variant="primary"
            disabled={!project.canComplete || complete.isPending}
            onClick={() => {
              if (window.confirm(`Mark "${project.title}" as completed? It moves to Archives under Completed.`)) {
                complete.mutate();
              }
            }}
          >
            <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" />
            Project Completed
          </Button>
        )}
      </div>
      {!project.canComplete && (
        <div className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <p className="font-semibold">Still missing:</p>
          <ul className="mt-1 list-disc pl-5">
            {(project.completeMissing || []).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// Receipt liquidation files (JPG, PNG or PDF). Required before completion.
function Liquidation({ project, canEdit, onDone, onFail }) {
  const [fileKey, setFileKey] = useState(0); // changing it clears the file input
  const files = project.liquidationFiles || [];
  const upload = useMutation({
    mutationFn: (list) => projectsApi.uploadLiquidation(project.id, list),
    onSuccess: (res) => {
      setFileKey((k) => k + 1);
      onDone(res);
    },
    onError: (err) => {
      setFileKey((k) => k + 1);
      onFail('Could not upload the files')(err);
    },
  });
  const remove = useMutation({
    mutationFn: (fileId) => projectsApi.deleteLiquidation(project.id, fileId),
    onSuccess: onDone,
    onError: onFail('Could not delete the file'),
  });
  async function view(fileId) {
    try {
      await projectsApi.openLiquidation(project.id, fileId);
    } catch (err) {
      onFail('Could not open the file. It may be missing.')(err);
    }
  }
  return (
    <Card className="p-6">
      <h2 className={cardTitle}>Receipt liquidation</h2>
      <p className="mt-1 text-sm text-slate-600">
        Receipts as JPG, PNG or PDF (up to 5 MB each). At least one file is required before the project can be
        marked as completed.
      </p>
      {canEdit && (
        <label className="btn btn-accent mt-4 cursor-pointer px-4 py-2 text-[15px] focus-within:ring-2 focus-within:ring-brand-500">
          <Upload size={18} strokeWidth={1.75} aria-hidden="true" />
          {upload.isPending ? 'Uploading…' : 'Upload files'}
          <input
            key={fileKey}
            type="file"
            multiple
            className="sr-only"
            accept="image/jpeg,image/png,application/pdf"
            disabled={upload.isPending}
            onChange={(e) => {
              const list = e.target.files;
              if (list && list.length > 0) upload.mutate(list);
            }}
          />
        </label>
      )}
      {files.length === 0 ? (
        <p className="mt-4 text-slate-600">No liquidation files uploaded yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <FileText size={18} strokeWidth={1.75} className="shrink-0 text-slate-500" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800" title={f.originalName}>
                {f.originalName}
              </span>
              <span className="text-sm text-slate-500">{formatDate(f.createdAt)}</span>
              <button type="button" className="text-sm font-semibold text-brand-700 hover:text-brand-800" onClick={() => view(f.id)}>
                View
              </button>
              {canEdit && (
                <button
                  type="button"
                  className="text-sm font-semibold text-red-600 hover:text-red-700"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete "${f.originalName}"?`)) remove.mutate(f.id);
                  }}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// Optional checklist. When it has items, all of them must be checked before completion.
function Checklist({ project, canEdit, onDone, onFail }) {
  const items = project.checklistItems || [];
  const [label, setLabel] = useState('');
  const [editing, setEditing] = useState(null); // { id, label }
  const add = useMutation({
    mutationFn: () => projectsApi.addChecklistItem(project.id, label.trim()),
    onSuccess: (res) => {
      setLabel('');
      onDone(res);
    },
    onError: onFail('Could not add the item'),
  });
  const update = useMutation({
    mutationFn: ({ itemId, data }) => projectsApi.updateChecklistItem(project.id, itemId, data),
    onSuccess: (res) => {
      setEditing(null);
      onDone(res);
    },
    onError: onFail('Could not update the item'),
  });
  const remove = useMutation({
    mutationFn: (itemId) => projectsApi.deleteChecklistItem(project.id, itemId),
    onSuccess: onDone,
    onError: onFail('Could not delete the item'),
  });
  const done = items.filter((i) => i.done).length;
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={cardTitle}>Checklist</h2>
        {items.length > 0 && (
          <span className="text-sm font-semibold text-slate-700">
            {done} of {items.length} done
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Optional. If you add items, all of them must be checked before the project can be marked as completed.
      </p>
      {canEdit && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (label.trim()) add.mutate();
          }}
        >
          <input className="input flex-1" placeholder="New checklist item" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={!label.trim() || add.isPending}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Add
          </Button>
        </form>
      )}
      {items.length === 0 ? (
        <p className="mt-4 text-slate-600">No checklist items.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-green-600"
                checked={item.done}
                disabled={!canEdit || update.isPending}
                aria-label={`Done: ${item.label}`}
                onChange={(e) => update.mutate({ itemId: item.id, data: { done: e.target.checked } })}
              />
              {editing?.id === item.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editing.label.trim()) update.mutate({ itemId: item.id, data: { label: editing.label.trim() } });
                  }}
                >
                  <input
                    className="input flex-1"
                    value={editing.label}
                    onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                    aria-label="Checklist item"
                    autoFocus
                  />
                  <Button type="submit" size="sm" variant="primary" disabled={update.isPending}>
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <span className={`flex-1 ${item.done ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{item.label}</span>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        className="text-slate-500 hover:text-slate-800"
                        aria-label={`Edit ${item.label}`}
                        onClick={() => setEditing({ id: item.id, label: item.label })}
                      >
                        <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-700"
                        aria-label={`Delete ${item.label}`}
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete "${item.label}"?`)) remove.mutate(item.id);
                        }}
                      >
                        <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// A pending deletion request. The Barangay Chairman approves (-> Archives > Deleted) or
// rejects it with remarks; the admins can withdraw it.
function DeletionPending({ deletion, canWithdraw, withdrawing, onWithdraw, isChairman, onDecided }) {
  const [remarks, setRemarks] = useState('');
  const [problem, setProblem] = useState('');
  const decide = useMutation({
    mutationFn: (decision) => projectsApi.reviewDeletion(deletion.id, { decision, remarks: remarks.trim() }),
    onSuccess: () => onDecided(),
    onError: (err) => setProblem(errorText(err, 'Could not save the decision')),
  });
  function choose(decision) {
    if (decision === 'REJECT' && !remarks.trim()) return setProblem('Please write remarks before rejecting.');
    if (decision === 'APPROVE' && !window.confirm('Approve this deletion? The project moves to Archives under Deleted; nothing is erased.')) return;
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
