import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Plus, Trash2, X } from 'lucide-react';
import FormHeader from '../../components/FormHeader';
import ReadOnlyField from '../../components/ReadOnlyField';
import { StatusRibbon } from '../../components/Roundel';
import { Button, Card, Input, Textarea } from '../../components/ui';
import { useConfirm } from '../../components/ConfirmDialog';
import { projectsApi, checkFile, FILE_ACCEPT } from '../../api/projects';
import { budgetApi, errorMessage, fieldErrors } from '../../api/budget';
import { EDITABLE_STATUSES, formatDate, formatPeso2, phDayOf } from '../../utils/format';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
let rowKey = 0;
const newRow = (r = {}) => ({
  key: ++rowKey,
  item: r.item ?? '',
  quantity: r.quantity != null ? String(Number(r.quantity)) : '',
  unitCost: r.unitCost != null ? String(Number(r.unitCost)) : '',
});
const rowTotal = (r) => {
  const q = Number(r.quantity);
  const u = Number(r.unitCost);
  return Number.isFinite(q) && Number.isFinite(u) && r.quantity !== '' && r.unitCost !== '' ? round2(round2(q) * round2(u)) : 0;
};
const blankRow = (r) => !r.item.trim() && r.quantity === '' && r.unitCost === '';

// The two attachments of a request; both go into the project files.
const ATTACHMENTS = [
  { type: 'ACTIVITY_DESIGN', label: 'Activity design' },
  { type: 'SK_RESOLUTION', label: 'SK Resolution' },
];

const emptyForm = () => ({
  title: '',
  abyipItemId: '',
  description: '',
  objectives: '',
  targetParticipants: '',
  location: '',
  startDate: '',
  endDate: '',
  rows: [newRow()],
});

// Form 3 · Project Request (SK Admin). New requests and drafts or requests returned for
// revision. "Save as Draft" keeps it with the SK Admin; "Submit for Approval" sends it to the
// Barangay Chairman (every field is needed and the cost must fit the ABYIP item's balance).
export default function ProjectRequestForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [ask, askDialog] = useConfirm();
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState({}); // type -> File chosen, uploaded on save
  const [errors, setErrors] = useState(location.state?.errors || {});
  const [error, setError] = useState(location.state?.error || null);
  const [busy, setBusy] = useState(null); // 'draft' | 'submit'
  const loadedFor = useRef(null);

  const projectQ = useQuery({ queryKey: ['projects', id], queryFn: () => projectsApi.get(id), enabled: Boolean(id) });
  const project = projectQ.data?.project;
  const itemsQ = useQuery({ queryKey: ['abyip', 'all'], queryFn: () => budgetApi.listItems({}) });
  const items = itemsQ.data?.items || [];

  // Fill the form once from the saved request.
  useEffect(() => {
    if (!project || loadedFor.current === project.id) return;
    loadedFor.current = project.id;
    setForm({
      title: project.title || '',
      abyipItemId: project.abyipItemId || '',
      description: project.description || '',
      objectives: project.objectives || '',
      targetParticipants: project.targetParticipants != null ? String(project.targetParticipants) : '',
      location: project.location || '',
      startDate: phDayOf(project.startDate),
      endDate: phDayOf(project.endDate),
      rows: project.budgetRows?.length ? project.budgetRows.map(newRow) : [newRow()],
    });
  }, [project]);

  // The chosen item's balance available to this request (its own cost is not counted).
  const balanceQ = useQuery({
    queryKey: ['abyip', 'item', form.abyipItemId, id || 'new'],
    queryFn: () => budgetApi.getItem(form.abyipItemId, id ? { excludeProject: id } : {}),
    enabled: Boolean(form.abyipItemId),
  });
  const balance = form.abyipItemId ? balanceQ.data?.item : null;

  const estimatedCost = useMemo(() => round2(form.rows.reduce((s, r) => s + rowTotal(r), 0)), [form.rows]);
  const shortage = balance ? round2(estimatedCost - balance.remaining) : 0;

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
    setErrors((x) => ({ ...x, [k]: undefined, ...(k === 'abyipItemId' ? { estimatedCost: undefined } : {}) }));
  };
  const setRow = (i, k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, rows: f.rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
    setError(null);
    setErrors((x) => ({ ...x, [`rows.${i}.${k}`]: undefined, rows: undefined, estimatedCost: undefined }));
  };
  const addRow = () => setForm((f) => ({ ...f, rows: [...f.rows, newRow()] }));
  // Removing a row shifts the rows below it, so their messages are cleared.
  const removeRow = (i) => {
    setForm((f) => ({ ...f, rows: f.rows.length > 1 ? f.rows.filter((_, j) => j !== i) : [newRow()] }));
    setErrors((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !k.startsWith('rows'))));
  };

  // The same checks as the server, so most mistakes show before anything is sent.
  function check(submit) {
    const e = {};
    if (!form.title.trim()) e.title = 'Enter the project title';
    if (form.targetParticipants !== '' && !(Number.isInteger(Number(form.targetParticipants)) && Number(form.targetParticipants) >= 1)) {
      e.targetParticipants = 'Enter a whole number of participants (at least 1)';
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) e.endDate = 'The end date cannot be before the start date';
    form.rows.forEach((r, i) => {
      if (blankRow(r)) return;
      if (!r.item.trim()) e[`rows.${i}.item`] = 'Enter the item';
      if (r.quantity === '' || !(Number(r.quantity) > 0)) e[`rows.${i}.quantity`] = 'Above zero';
      if (r.unitCost === '' || !(Number(r.unitCost) >= 0)) e[`rows.${i}.unitCost`] = 'Zero or more';
    });
    for (const [type, file] of Object.entries(files)) {
      const bad = checkFile(file);
      if (bad) e[`file.${type}`] = bad;
    }
    if (submit) {
      if (!form.abyipItemId) e.abyipItemId = 'Choose the ABYIP item that funds this project';
      if (!form.description.trim()) e.description = 'Describe the project';
      if (!form.objectives.trim()) e.objectives = 'Write the objectives';
      if (!form.targetParticipants) e.targetParticipants = e.targetParticipants || 'Enter the target number of participants';
      if (!form.location.trim()) e.location = 'Enter the venue';
      if (!form.startDate) e.startDate = 'Enter the start date';
      if (!form.endDate) e.endDate = e.endDate || 'Enter the end date';
      if (!form.rows.some((r) => !blankRow(r))) e.rows = 'Add at least one budget breakdown row';
      else if (!(estimatedCost > 0)) e.rows = 'The estimated cost must be above zero';
      if (balance && shortage > 0) {
        e.estimatedCost = `The estimated cost is ${formatPeso2(shortage)} more than the remaining balance of “${balance.name}” (${formatPeso2(balance.remaining)}).`;
      }
    }
    return e;
  }

  async function save(submit) {
    setError(null);
    const e = check(submit);
    setErrors(e);
    if (Object.keys(e).length) {
      setError('Check the fields marked below.');
      return;
    }
    if (submit && !(await ask('Submit this Project Request to the Barangay Chairman for approval? It cannot be edited while it is being reviewed.'))) return;
    setBusy(submit ? 'submit' : 'draft');
    let savedId = id;
    try {
      const body = {
        ...form,
        rows: form.rows.map(({ item, quantity, unitCost }) => ({ item, quantity, unitCost })),
      };
      const res = id ? await projectsApi.update(id, body) : await projectsApi.create(body);
      savedId = res.project.id;
      for (const [type, file] of Object.entries(files)) {
        if (!file) continue;
        await projectsApi.addFile(savedId, { file, documentType: type });
      }
      setFiles({});
      if (submit) await projectsApi.submit(savedId);
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['projects', savedId] });
      qc.invalidateQueries({ queryKey: ['abyip'] });
      navigate(`/admin/projects/${savedId}`, {
        state: {
          notice: submit
            ? `“${form.title.trim()}” was submitted to the Barangay Chairman for approval.`
            : `“${form.title.trim()}” was saved as a draft.`,
        },
      });
    } catch (err) {
      const fe = fieldErrors(err);
      const msg = Object.keys(fe).length ? 'Check the fields marked below.' : errorMessage(err, 'The request could not be saved. Try again.');
      if (!id && savedId) {
        // The draft was saved but not submitted: continue on the draft's own page.
        navigate(`/admin/projects/${savedId}/edit`, { replace: true, state: { errors: fe, error: `Saved as a draft, but not submitted. ${msg}` } });
      } else {
        setErrors(fe);
        setError(msg);
      }
      qc.invalidateQueries({ queryKey: ['projects', savedId] });
    } finally {
      setBusy(null);
    }
  }

  async function removeSavedFile(file) {
    if (!(await ask(`Remove “${file.originalName}” from this request?`))) return;
    try {
      await projectsApi.deleteFile(id, file.id);
      qc.invalidateQueries({ queryKey: ['projects', id] });
    } catch (err) {
      setError(errorMessage(err, 'The file could not be removed.'));
    }
  }

  if (id && projectQ.isLoading) return <p className="text-slate-600">Loading…</p>;
  if (id && !project) return <p className="notice notice-error">This project could not be found.</p>;
  if (project && !EDITABLE_STATUSES.includes(project.status)) {
    return (
      <div className="space-y-4">
        <p className="notice notice-warn">
          This request is {project.statusLabel?.toLowerCase()} and can no longer be edited.
        </p>
        <Link to={`/admin/projects/${id}`} className="font-semibold text-pine underline">Back to the project</Link>
      </div>
    );
  }

  const returned = project?.status === 'FOR_REVISION' ? project.reviews?.[0] : null;
  const groups = groupByYear(items);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <Link
        to={id ? `/admin/projects/${id}` : '/admin/projects'}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-pine hover:underline"
      >
        <ArrowLeft size={16} aria-hidden="true" /> {id ? 'Back to the project' : 'Back to Projects'}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <FormHeader
          number={3}
          name="Project Request"
          description="Save it as a draft while it is being prepared. Submitting sends it to the Barangay Chairman for approval."
        />
        {project && <StatusRibbon status={project.status} />}
      </div>

      {returned && (
        <div className="notice notice-warn">
          <p className="font-semibold">Returned for revision by {returned.reviewer?.name || 'the Barangay Chairman'} on {formatDate(returned.reviewedAt)}</p>
          <p className="mt-1 whitespace-pre-line">{returned.remarks}</p>
        </div>
      )}
      {error && <p className="notice notice-error" role="alert">{error}</p>}

      <form noValidate onSubmit={(e) => { e.preventDefault(); save(false); }} className="space-y-6">
        <Card className="space-y-4 p-5 sm:p-6">
          <h2 className="section-title">Project details</h2>
          <Input label="Project title" maxLength={200} value={form.title} onChange={set('title')} error={errors.title} />

          <div>
            <label className="label" htmlFor="abyip-item">ABYIP item</label>
            <select id="abyip-item" className="input" value={form.abyipItemId} onChange={set('abyipItemId')}>
              <option value="">Choose the ABYIP item that funds this project…</option>
              {groups.map(([year, list]) => (
                <optgroup key={year} label={`ABYIP ${year}`}>
                  {list.map((it) => (
                    <option key={it.id} value={it.id}>{`${it.name} (${it.targetQuarter} · ${it.center})`}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {errors.abyipItemId && <p className="mt-1 text-[13px] text-clay-text">{errors.abyipItemId}</p>}
            {!itemsQ.isLoading && !items.length && (
              <p className="mt-1 text-[13px] text-slate-600">
                No ABYIP items yet. Add one in <Link to="/admin/budget" className="font-semibold text-pine underline">Budget &amp; ABYIP</Link> first.
              </p>
            )}
          </div>
          {form.abyipItemId && (
            <ReadOnlyField
              label="Remaining balance of this ABYIP item"
              value={balance ? formatPeso2(balance.remaining) : 'Loading…'}
              hint={
                balance &&
                (shortage > 0
                  ? `This request is ${formatPeso2(shortage)} over the balance.`
                  : `${formatPeso2(round2(balance.remaining - estimatedCost))} will be left after this request.`)
              }
              tone={balance && shortage > 0 ? 'bad' : undefined}
            />
          )}

          <Textarea label="Description" rows={4} maxLength={5000} value={form.description} onChange={set('description')} error={errors.description} />
          <Textarea label="Objectives" rows={3} maxLength={5000} value={form.objectives} onChange={set('objectives')} error={errors.objectives} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Target participants"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={form.targetParticipants}
              onChange={set('targetParticipants')}
              error={errors.targetParticipants}
            />
            <Input label="Venue" maxLength={200} value={form.location} onChange={set('location')} error={errors.location} />
            <Input label="Start date" type="date" value={form.startDate} onChange={set('startDate')} error={errors.startDate} />
            <Input label="End date" type="date" min={form.startDate || undefined} value={form.endDate} onChange={set('endDate')} error={errors.endDate} />
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="section-title">Budget breakdown</h2>
          <p className="mt-1 text-sm text-slate-600">Each row’s total is quantity × unit cost. The estimated cost is their sum.</p>
          <div className="mt-4 hidden grid-cols-[minmax(0,1fr)_6rem_8rem_8rem_2.5rem] gap-2 text-[13px] font-medium uppercase tracking-wide text-slate-600 sm:grid">
            <span>Item</span><span>Quantity</span><span>Unit cost (₱)</span><span className="text-right">Total</span><span />
          </div>
          <ol className="mt-2 space-y-3">
            {form.rows.map((r, i) => (
              <li key={r.key} className="grid grid-cols-2 gap-2 rounded-control border border-line p-3 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_8rem_2.5rem] sm:items-start sm:border-0 sm:p-0">
                <RowField className="col-span-2 sm:col-span-1" label="Item" error={errors[`rows.${i}.item`]}>
                  <input className="input" aria-label={`Row ${i + 1} item`} maxLength={200} value={r.item} onChange={setRow(i, 'item')} />
                </RowField>
                <RowField label="Quantity" error={errors[`rows.${i}.quantity`]}>
                  <input className="input" aria-label={`Row ${i + 1} quantity`} type="number" min="0" step="any" inputMode="decimal" value={r.quantity} onChange={setRow(i, 'quantity')} />
                </RowField>
                <RowField label="Unit cost (₱)" error={errors[`rows.${i}.unitCost`]}>
                  <input className="input" aria-label={`Row ${i + 1} unit cost`} type="number" min="0" step="0.01" inputMode="decimal" value={r.unitCost} onChange={setRow(i, 'unitCost')} />
                </RowField>
                <RowField label="Total">
                  <div className="flex min-h-[var(--control-height)] items-center justify-end rounded-control border border-line bg-slate-100 px-3 text-[15px] font-medium text-slate-700" aria-label={`Row ${i + 1} total`}>
                    {formatPeso2(rowTotal(r))}
                  </div>
                </RowField>
                <div className="flex items-end justify-end sm:items-center">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="rounded-control p-2.5 text-slate-600 hover:bg-clay-wash hover:text-clay-text"
                    aria-label={`Remove row ${i + 1}`}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {errors.rows && <p className="mt-2 text-[13px] text-clay-text">{errors.rows}</p>}
          <Button variant="secondary" size="sm" className="mt-3" onClick={addRow}>
            <Plus size={16} aria-hidden="true" /> Add row
          </Button>
          <div className="mt-5 sm:ml-auto sm:max-w-xs">
            <ReadOnlyField label="Estimated cost" value={formatPeso2(estimatedCost)} tone={errors.estimatedCost ? 'bad' : undefined} />
            {errors.estimatedCost && <p className="mt-1 text-[13px] text-clay-text">{errors.estimatedCost}</p>}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="section-title">Attachments</h2>
          <p className="mt-1 text-sm text-slate-600">PDF, DOCX, JPG or PNG, up to 10 MB. They are kept in the project files.</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {ATTACHMENTS.map(({ type, label }) => {
              const saved = (project?.liquidationFiles || []).filter((f) => f.documentType === type);
              const chosen = files[type];
              return (
                <div key={type}>
                  <p className="label">{label}</p>
                  {saved.map((f) => (
                    <div key={f.id} className="mb-2 flex items-center gap-2 rounded-control border border-line bg-panel px-3 py-2 text-sm">
                      <FileText size={16} className="shrink-0 text-slate-600" aria-hidden="true" />
                      <button type="button" className="min-w-0 flex-1 truncate text-left font-medium text-pine hover:underline" onClick={() => projectsApi.openFile(id, f.id)}>
                        {f.originalName}
                      </button>
                      <button type="button" onClick={() => removeSavedFile(f)} className="rounded-control p-1 text-slate-600 hover:text-clay-text" aria-label={`Remove ${f.originalName}`}>
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  <input
                    type="file"
                    accept={FILE_ACCEPT}
                    aria-label={`${label} file`}
                    className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-control file:border file:border-line file:bg-panel file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-pine-light"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setFiles((x) => ({ ...x, [type]: file }));
                      setErrors((x) => ({ ...x, [`file.${type}`]: checkFile(file) || undefined }));
                    }}
                  />
                  {chosen && !errors[`file.${type}`] && <p className="mt-1 text-[13px] text-slate-600">Uploaded when you save.</p>}
                  {errors[`file.${type}`] && <p className="mt-1 text-[13px] text-clay-text">{errors[`file.${type}`]}</p>}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="actions-stack flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" type="submit" disabled={Boolean(busy)}>
            {busy === 'draft' ? 'Saving…' : 'Save as Draft'}
          </Button>
          <Button variant="primary" onClick={() => save(true)} disabled={Boolean(busy)}>
            {busy === 'submit' ? 'Submitting…' : 'Submit for Approval'}
          </Button>
        </div>
      </form>
      {askDialog}
    </div>
  );
}

// A cell of the breakdown: its label shows only on phones (the header row labels the columns).
function RowField({ label, error, className = '', children }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="mb-1 block text-[13px] font-medium text-slate-600 sm:hidden">{label}</span>
      {children}
      {error && <p className="mt-1 text-[13px] text-clay-text">{error}</p>}
    </div>
  );
}

function groupByYear(items) {
  const map = new Map();
  for (const it of items) {
    if (!map.has(it.year)) map.set(it.year, []);
    map.get(it.year).push(it);
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0]);
}
