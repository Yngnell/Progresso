import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { ArrowLeft, Ban, CircleCheck, FileText, Paperclip, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import OverflowMenu from '../../components/OverflowMenu';
import { ProgressRoundel, ScheduleWords, StatusRibbon } from '../../components/Roundel';
import { Button, Card } from '../../components/ui';
import { totalSpent } from '../../components/ProjectCard';
import ProjectChecklist from '../../components/ProjectChecklist';
import DeletionRequestModal from '../../components/DeletionRequestModal';
import ProjectStatusDialog from '../../components/ProjectStatusDialog';
import { formatPeso, formatDate, formatDateTime } from '../../utils/format';

export default function AdminProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isChairman = user?.role === 'CHAIRMAN';
  const qc = useQueryClient();
  const [expenseForm, setExpenseForm] = useState({ item: '', amount: '', date: '', voucherNo: '' });
  const [receiptFile, setReceiptFile] = useState(null);
  const [fileKey, setFileKey] = useState(0); // changing it clears the file input
  const [error, setError] = useState('');
  const [taskError, setTaskError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusDialog, setStatusDialog] = useState(null); // 'complete' | 'cancel' | null

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectsApi.get(id),
  });
  const project = data?.project;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['projects', id] });
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };

  const addExpenseMutation = useMutation({
    mutationFn: (formData) => projectsApi.addExpense(id, formData),
    onSuccess: () => {
      invalidate();
      setExpenseForm({ item: '', amount: '', date: '', voucherNo: '' });
      setReceiptFile(null);
      setFileKey((k) => k + 1);
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to add expense'),
  });

  const attachReceiptMutation = useMutation({
    mutationFn: ({ expenseId, file }) => projectsApi.attachReceipt(id, expenseId, file),
    onSuccess: invalidate,
    onError: (err) => setError(err.response?.data?.message || 'Could not upload the receipt'),
  });

  async function viewReceipt(expenseId) {
    try {
      await projectsApi.openReceipt(id, expenseId);
    } catch (err) {
      setError('Could not open the receipt. It may be missing.');
    }
  }

  const restoreMutation = useMutation({
    mutationFn: () => projectsApi.restore(id),
    onSuccess: invalidate,
    onError: (err) => setError(err.response?.data?.message || 'Could not restore the project'),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId) => projectsApi.removeExpense(id, expenseId),
    onSuccess: invalidate,
  });

  const addTaskMutation = useMutation({
    mutationFn: (payload) => projectsApi.addTask(id, payload),
    onSuccess: () => {
      setTaskError('');
      invalidate();
    },
    onError: (err) => setTaskError(err.response?.data?.message || 'Failed to add task'),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, ...payload }) => projectsApi.updateTask(id, taskId, payload),
    onSuccess: invalidate,
    onError: (err) => setTaskError(err.response?.data?.message || 'Failed to update task'),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId) => projectsApi.removeTask(id, taskId),
    onSuccess: invalidate,
  });

  const withdrawMutation = useMutation({
    mutationFn: () => projectsApi.withdrawDeletion(id),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['deletion-requests'] });
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not withdraw the request'),
  });

  // An expense is a manual deduction from the budget, so its receipt is required.
  function handleAddExpense(e) {
    e.preventDefault();
    setError('');
    if (!receiptFile) {
      setError('Please upload the receipt as proof of this expense.');
      return;
    }
    const formData = new FormData();
    formData.append('item', expenseForm.item);
    formData.append('amount', expenseForm.amount);
    if (expenseForm.date) formData.append('date', expenseForm.date);
    if (expenseForm.voucherNo) formData.append('voucherNo', expenseForm.voucherNo);
    formData.append('receipt', receiptFile);
    addExpenseMutation.mutate(formData);
  }

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

  // The chairman only views and approves; an archived project is read-only for everyone.
  const archived = Boolean(project.archivedAt);
  const readOnly = isChairman || archived;
  const spent = totalSpent(project);
  const remaining = Number(project.budget || 0) - spent;
  // Most recent deletion request (server returns only the latest one).
  const deletion = project.deletionRequests?.[0];

  return (
    <div>
      <Link
        to={archived ? '/admin/archive' : '/admin/projects'}
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to{' '}
        {archived ? 'the Archive' : 'Projects'}
      </Link>

      {archived && (
        <div className="mt-3 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold">
            Archived on {formatDate(project.archivedAt)}. The records are kept and cannot be
            changed.
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

      <div className="mt-4 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-5">
          <ProgressRoundel
            value={project.progress}
            breakdown={project.progressBreakdown}
            size="lg"
          />
          <div className="min-w-0">
            <StatusRibbon status={project.status} />
            <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none tracking-wide text-slate-900">
              {project.title}
            </h1>
            {project.category && <p className="mt-1 text-slate-600">{project.category}</p>}
            <ScheduleWords breakdown={project.progressBreakdown} className="mt-1" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (project.status === 'PLANNING' || project.status === 'ONGOING') && (
            <Button variant="primary" onClick={() => setStatusDialog('complete')}>
              <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" />
              Mark as completed
            </Button>
          )}
          {project.status !== 'PROPOSED' && project.approvalState !== 'REJECTED' && (
            <Link to={`/admin/projects/${id}/report`}>
              <Button variant="secondary">
                <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
                Generate report
              </Button>
            </Link>
          )}
          {/* The risky actions live in a quiet menu so they never compete with the main ones */}
          {!readOnly && (
            <OverflowMenu
              items={[
                project.status !== 'COMPLETED' &&
                  project.status !== 'CANCELLED' && {
                    label: 'Cancel project',
                    Icon: Ban,
                    danger: true,
                    onClick: () => setStatusDialog('cancel'),
                  },
                deletion?.status !== 'PENDING' && {
                  label: 'Request deletion',
                  Icon: Trash2,
                  danger: true,
                  onClick: () => setDeleteOpen(true),
                },
              ]}
            />
          )}
        </div>
      </div>

      {/* Deletion request state */}
      {deletion?.status === 'PENDING' && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Deletion requested — awaiting the chairman’s approval</p>
          <p className="mt-1">
            <span className="font-medium">Reason:</span> {deletion.reason}
          </p>
          <p className="mt-1 text-xs text-red-600">
            Requested by {deletion.requestedByName} on {formatDate(deletion.createdAt)}
          </p>
          {!readOnly && (
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              disabled={withdrawMutation.isPending}
              onClick={() => withdrawMutation.mutate()}
            >
              Withdraw request
            </Button>
          )}
        </div>
      )}
      {deletion?.status === 'REJECTED' && (
        <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">
            Deletion request rejected by {deletion.reviewedByName || 'the chairman'}
          </p>
          {deletion.reviewRemarks && <p className="mt-1">{deletion.reviewRemarks}</p>}
        </div>
      )}
      {deleteOpen && (
        <DeletionRequestModal project={project} onClose={() => setDeleteOpen(false)} />
      )}
      {statusDialog && (
        <ProjectStatusDialog
          project={project}
          mode={statusDialog}
          onClose={() => setStatusDialog(null)}
        />
      )}

      {/* Rejected proposal / cancelled / completed records */}
      {project.approvalState === 'REJECTED' && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">
            Proposal rejected by {project.reviewedBy?.name || 'the chairman'}
          </p>
          {project.reviewRemarks && <p className="mt-1">{project.reviewRemarks}</p>}
          <p className="mt-1 text-xs">
            This proposal is closed. Propose a different program that fits the youth’s needs.
          </p>
        </div>
      )}
      {project.status === 'CANCELLED' && project.approvalState !== 'REJECTED' && project.cancelReason && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Project cancelled</p>
          <p className="mt-1">{project.cancelReason}</p>
        </div>
      )}
      {project.status === 'COMPLETED' && project.councilApprovedOn && (
        <p className="mt-3 text-sm text-slate-600">
          Completed with SK council approval on {formatDate(project.councilApprovedOn)}
          {project.councilResolutionNo ? ` (${project.councilResolutionNo})` : ''}
        </p>
      )}

      {/* Chairman review state */}
      {project.status === 'PROPOSED' && (
        <div
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            project.approvalState === 'RETURNED'
              ? 'bg-amber-50 text-amber-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {project.approvalState === 'RETURNED' ? (
            <>
              <p className="font-semibold">
                Returned by {project.reviewedBy?.name || 'the chairman'} for revision
              </p>
              {project.reviewRemarks && <p className="mt-1">{project.reviewRemarks}</p>}
              {!readOnly && (
                <p className="mt-1 text-xs">
                  Edit the project to address this; saving it resubmits it for approval.
                </p>
              )}
            </>
          ) : (
            <p>
              <span className="font-semibold">Awaiting chairman approval.</span> Progress and the
              public listing start once the Barangay Chairman approves this project.
            </p>
          )}
        </div>
      )}
      {project.status !== 'PROPOSED' && project.approvalState === 'APPROVED' && project.reviewedAt && (
        <p className="mt-3 text-sm text-slate-600">
          Approved by {project.reviewedBy?.name || 'the Barangay Chairman'} on{' '}
          {formatDate(project.reviewedAt)}
          {project.reviewRemarks ? ` — “${project.reviewRemarks}”` : ''}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Details */}
          <Card className="p-6">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">Details</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {project.description || 'No description provided.'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-sm font-semibold text-slate-600">Venue</p>
                <p className="text-slate-700">{project.location || '—'}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600">Timeline</p>
                <p className="text-slate-700">
                  {formatDateTime(project.startDate)} – {formatDateTime(project.endDate)}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600">Prepared by</p>
                <p className="text-slate-700">
                  {project.proposedByName
                    ? `${project.proposedByName}${
                        project.proposedByPosition ? ` (${project.proposedByPosition})` : ''
                      }`
                    : project.createdBy?.name || '—'}
                </p>
              </div>
            </div>
          </Card>

          {/* Purchase requests (the sheet filled in on the proposal form) */}
          {(project.requestItems || []).length > 0 && (
            <Card className="p-6">
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">Purchase requests</h2>
              <p className="mt-1 text-sm text-slate-600">
                The project budget is the total of these requests.
              </p>
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
                      <td className="py-2 text-right font-medium text-slate-700">
                        {formatPeso(r.amount)}
                      </td>
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

          {/* Progress & checklist */}
          <Card className="p-6">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">Progress &amp; Checklist</h2>
            <p className="mt-1 text-sm text-slate-600">
              Progress is calculated automatically: with linked events (scheduled sessions) it is
              the sessions already held; otherwise it follows the start and end dates. The
              checklist is a to-do list and does not change the percentage. Only marking the
              project Completed (with SK council approval) sets it to 100%.
            </p>
            <div className="mt-4">
              <ProjectChecklist
                project={project}
                onAdd={
                  readOnly
                    ? undefined
                    : (form, reset) => addTaskMutation.mutate(form, { onSuccess: reset })
                }
                onToggle={
                  readOnly
                    ? undefined
                    : (t) => updateTaskMutation.mutate({ taskId: t.id, done: !t.done })
                }
                onRemove={
                  readOnly
                    ? undefined
                    : (t) => {
                        if (window.confirm(`Remove task "${t.title}"?`)) {
                          deleteTaskMutation.mutate(t.id);
                        }
                      }
                }
                adding={addTaskMutation.isPending}
                error={taskError}
                eventLink={(ev) => `/admin/calendar/${ev.id}`}
              />
            </div>
          </Card>

          {/* Expenses */}
          <Card className="p-6">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">Expenses</h2>
            <p className="mt-1 text-sm text-slate-600">
              Each expense is deducted from the budget and needs its receipt (photo or PDF, up to
              5 MB) as proof.
            </p>

            {!readOnly && (
            <form onSubmit={handleAddExpense} className="mt-4 flex flex-wrap items-end gap-2">
              <input
                className="input min-w-[140px] flex-1"
                placeholder="Item"
                value={expenseForm.item}
                onChange={(e) => setExpenseForm({ ...expenseForm, item: e.target.value })}
                required
              />
              <input
                className="input w-32"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Amount"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                required
              />
              <input
                className="input w-40"
                type="date"
                value={expenseForm.date}
                onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
              />
              <input
                className="input w-40"
                placeholder="Voucher / OR no."
                value={expenseForm.voucherNo}
                onChange={(e) => setExpenseForm({ ...expenseForm, voucherNo: e.target.value })}
              />
              <div className="w-full">
                <label className="label">Receipt * (JPG, PNG, WebP or PDF)</label>
                <input
                  key={fileKey}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="block w-full text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-4 file:py-2 file:text-[15px] file:font-semibold file:text-slate-700 hover:file:border-slate-400 hover:file:bg-slate-50"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                />
              </div>
              <Button type="submit" variant="primary" disabled={addExpenseMutation.isPending}>
                <Plus size={18} strokeWidth={2} aria-hidden="true" />
                {addExpenseMutation.isPending ? 'Uploading…' : 'Add expense'}
              </Button>
            </form>
            )}

            <div className="mt-4">
              {(project.expenses || []).length === 0 ? (
                <p className="text-slate-600">No expenses recorded yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-sm text-slate-600">
                    <tr>
                      <th className="py-2">Item</th>
                      <th className="py-2">Date</th>
                      <th className="py-2">Voucher no.</th>
                      <th className="py-2 text-right">Amount</th>
                      <th className="py-2 pl-4">Receipt</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {project.expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2 text-slate-700">{e.item}</td>
                        <td className="py-2 text-slate-500">{formatDate(e.date)}</td>
                        <td className="py-2 text-slate-500">{e.voucherNo || '—'}</td>
                        <td className="py-2 text-right font-medium text-slate-700">
                          {formatPeso(e.amount)}
                        </td>
                        <td className="py-2 pl-4">
                          {e.receiptFile ? (
                            <button
                              type="button"
                              className="text-xs font-medium text-brand-600 hover:text-brand-700"
                              onClick={() => viewReceipt(e.id)}
                              title={e.receiptName}
                            >
                              <Paperclip size={14} strokeWidth={1.75} className="mr-1 inline" aria-hidden="true" />View
                            </button>
                          ) : (
                            <span className="text-xs font-medium text-amber-600">No receipt</span>
                          )}
                          {!readOnly && (
                            <label className="ml-2 cursor-pointer text-sm text-slate-600 hover:text-slate-700">
                              {e.receiptFile ? 'Replace' : 'Attach'}
                              <input
                                type="file"
                                className="hidden"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                onChange={(ev) => {
                                  const file = ev.target.files?.[0];
                                  ev.target.value = '';
                                  if (file) attachReceiptMutation.mutate({ expenseId: e.id, file });
                                }}
                              />
                            </label>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {!readOnly && (
                            <button
                              className="text-xs text-red-600 hover:text-red-700"
                              onClick={() => deleteExpenseMutation.mutate(e.id)}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>

        {/* Right column: budget + team */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">Budget</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Total budget</span>
                <span className="font-semibold text-slate-800">{formatPeso(project.budget)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Spent</span>
                <span className="font-semibold text-slate-800">{formatPeso(spent)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="text-slate-500">Remaining</span>
                <span className={`font-semibold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatPeso(remaining)}
                </span>
              </div>
              {(project.expenses || []).length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipts on file</span>
                  <span className="font-semibold text-slate-800">
                    {project.expenses.filter((e) => e.receiptFile).length} of{' '}
                    {project.expenses.length}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">Team</h2>
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

