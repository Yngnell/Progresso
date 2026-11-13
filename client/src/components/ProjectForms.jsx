import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScanText } from 'lucide-react';
import { Button, Input, Modal, Select, Textarea } from './ui';
import ReadOnlyField from './ReadOnlyField';
import { projectsApi, checkFile, FILE_ACCEPT, RECEIPT_ACCEPT } from '../api/projects';
import { errorMessage, fieldErrors } from '../api/budget';
import { formatPeso2, phDayOf, phToday } from '../utils/format';

// The SK Admin's forms on a project page (one dialog each). Every form shows the server's
// message under the field it is about; the server checks everything again.


function FileInput({ label, accept, onChange, error, hint, id }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-control file:border file:border-line file:bg-panel file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-pine-light"
      />
      {hint && !error && <p className="mt-1 text-[13px] text-slate-600">{hint}</p>}
      {error && <p className="mt-1 text-[13px] text-clay-text">{error}</p>}
    </div>
  );
}

// Shared shell: the form name as the header, the form body, Cancel and the save button.
function FormModal({ name, id, busy, saveLabel, saveVariant, closeLabel = 'Cancel', onClose, error, children }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{closeLabel}</Button>
          <Button type="submit" form={id} variant={saveVariant || 'primary'} disabled={busy}>
            {busy ? 'Saving…' : saveLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-5">
        {error && <p className="notice notice-error text-sm" role="alert">{error}</p>}
        {children}
      </div>
    </Modal>
  );
}

// Runs a save: fills the field messages or the general error, else calls onDone.
async function run({ setBusy, setErrors, setError, action, onDone, fallback }) {
  setBusy(true);
  setError(null);
  try {
    onDone(await action());
  } catch (err) {
    const fe = fieldErrors(err);
    setErrors(fe);
    if (!Object.keys(fe).length) setError(errorMessage(err, fallback));
  } finally {
    setBusy(false);
  }
}

// ---------- Expense (Ongoing) ----------
// The amount cannot exceed what is left of the approved cost. "Read receipt" lets Claude fill in
// the amount, date and supplier from the receipt; the SK Admin checks them before saving.
export function ExpenseForm({ project, categories, receiptReading, onClose, onDone }) {
  const [form, setForm] = useState({ description: '', category: '', supplier: '', amount: '', date: phToday() });
  const [receipt, setReceipt] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState(null); // { ok, text }
  const remaining = project.remainingBudget;
  const receiptProblem = receipt ? checkFile(receipt, { receipt: true }) : null;
  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  async function readReceipt() {
    setReadNote(null);
    setReading(true);
    try {
      const r = await projectsApi.readReceipt(receipt);
      if (!r.readable || r.total == null) {
        setReadNote({ ok: false, text: 'The receipt could not be read. Type the amount instead.' });
        return;
      }
      setForm((f) => ({
        ...f,
        amount: String(r.total),
        date: r.date && r.date <= phToday() ? r.date : f.date,
        supplier: r.storeName || f.supplier,
      }));
      setErrors((x) => ({ ...x, amount: undefined, date: undefined }));
      setReadNote({ ok: true, text: `Read ${formatPeso2(r.total)}${r.storeName ? ` from ${r.storeName}` : ''}. Check the values before saving.` });
    } catch (err) {
      setReadNote({ ok: false, text: errorMessage(err, 'The receipt could not be read. Type the amount instead.') });
    } finally {
      setReading(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    const e2 = {};
    if (!form.description.trim()) e2.description = 'Describe the expense';
    if (!form.category) e2.category = 'Choose the category';
    const amt = Number(form.amount);
    if (form.amount === '' || !(amt > 0)) e2.amount = 'The amount must be above zero';
    else if (Math.round(amt * 100) / 100 > remaining) {
      e2.amount = `Only ${formatPeso2(remaining)} of the approved cost is left; this is ${formatPeso2(Math.round((amt - remaining) * 100) / 100)} over.`;
    }
    if (!form.date) e2.date = 'Enter the date';
    else if (form.date > phToday()) e2.date = 'The date cannot be in the future';
    if (!receipt) e2.receipt = 'Upload the receipt';
    else if (receiptProblem) e2.receipt = receiptProblem;
    setErrors(e2);
    if (Object.keys(e2).length) return;
    run({
      setBusy,
      setErrors,
      setError,
      fallback: 'The expense could not be saved. Try again.',
      action: () => projectsApi.addExpense(project.id, { ...form, description: form.description.trim(), receipt }),
      onDone: (res) => onDone(res, `Expense of ${formatPeso2(amt)} recorded.`),
    });
  }

  return (
    <FormModal name="Expense" id="expense-form" busy={busy} saveLabel="Save expense" onClose={onClose} error={error}>
      <div className="grid gap-2 sm:grid-cols-3">
        <ReadOnlyField label="Approved cost" value={formatPeso2(project.approvedCost)} />
        <ReadOnlyField label="Spent so far" value={formatPeso2(project.amountSpent)} />
        <ReadOnlyField label="Remaining" value={formatPeso2(remaining)} tone={remaining <= 0 ? 'bad' : 'good'} />
      </div>
      <form id="expense-form" onSubmit={submit} noValidate className="space-y-4">
        <div>
          <FileInput
            id="expense-receipt"
            label="Receipt"
            accept={RECEIPT_ACCEPT}
            onChange={(f) => {
              setReceipt(f);
              setReadNote(null);
              setErrors((x) => ({ ...x, receipt: f ? checkFile(f, { receipt: true }) || undefined : undefined }));
            }}
            error={errors.receipt}
            hint="PDF, JPG or PNG, up to 10 MB. It is kept in the project files."
          />
          {receiptReading && receipt && !receiptProblem && (
            <Button size="sm" variant="secondary" className="mt-2" onClick={readReceipt} disabled={reading}>
              <ScanText size={16} aria-hidden="true" /> {reading ? 'Reading…' : 'Read receipt'}
            </Button>
          )}
          {readNote && (
            <p className={`mt-2 text-[13px] ${readNote.ok ? 'text-sage-text' : 'text-clay-text'}`} role="status">{readNote.text}</p>
          )}
        </div>
        <Input label="Description" maxLength={200} placeholder="e.g. Snacks for participants" value={form.description} onChange={set('description')} error={errors.description} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Category"
            value={form.category}
            onChange={set('category')}
            error={errors.category}
            options={[{ value: '', label: 'Choose…' }, ...categories.map((c) => ({ value: c, label: c }))]}
          />
          <Input label="Supplier (optional)" maxLength={120} value={form.supplier} onChange={set('supplier')} />
          <Input label="Amount (₱)" type="number" min="0" step="0.01" inputMode="decimal" value={form.amount} onChange={set('amount')} error={errors.amount} />
          <Input label="Date" type="date" max={phToday()} value={form.date} onChange={set('date')} error={errors.date} />
        </div>
      </form>
    </FormModal>
  );
}

// ---------- File Upload ----------
// One project document: its type and the file (PDF, DOCX, JPG or PNG, up to 10 MB).
export function FileForm({ project, documentTypes, onClose, onDone }) {
  const types = Object.entries(documentTypes).filter(([value]) => value !== 'LIQUIDATION');
  const [documentType, setDocumentType] = useState('');
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function submit(e) {
    e.preventDefault();
    const e2 = {};
    if (!documentType) e2.documentType = 'Choose the document type';
    if (!file) e2.file = 'Choose the file to upload';
    else if (checkFile(file)) e2.file = checkFile(file);
    setErrors(e2);
    if (Object.keys(e2).length) return;
    run({
      setBusy,
      setErrors,
      setError,
      fallback: 'The file could not be uploaded. Try again.',
      action: () => projectsApi.addFile(project.id, { file, documentType }),
      onDone: (res) => onDone(res, `“${file.name}” was added to the project files.`),
    });
  }

  return (
    <FormModal name="File Upload" id="file-form" busy={busy} saveLabel="Upload file" onClose={onClose} error={error}>
      <form id="file-form" onSubmit={submit} noValidate className="space-y-4">
        <ReadOnlyField label="Project" value={project.title} />
        <Select
          label="Document type"
          value={documentType}
          onChange={(e) => {
            setDocumentType(e.target.value);
            setErrors((x) => ({ ...x, documentType: undefined }));
          }}
          error={errors.documentType}
          options={[{ value: '', label: 'Choose…' }, ...types.map(([value, label]) => ({ value, label }))]}
        />
        <FileInput
          id="project-file"
          label="File"
          accept={FILE_ACCEPT}
          onChange={(f) => {
            setFile(f);
            setErrors((x) => ({ ...x, file: f ? checkFile(f) || undefined : undefined }));
          }}
          error={errors.file}
          hint="PDF, DOCX, JPG or PNG, up to 10 MB."
        />
      </form>
    </FormModal>
  );
}

// ---------- Completion (Ongoing) ----------
// The approved cost, the actual cost (all expenses) and the unused amount are filled in; the
// participants start from the attendance linked to the project and can be changed. Both reports
// are required. Completing returns the unused amount to the ABYIP item.
export function CompletionForm({ project, ask, onClose, onDone }) {
  const startDay = phDayOf(project.startDate);
  const [form, setForm] = useState({ actualEndDate: phToday(), actualParticipants: '', accomplishmentSummary: '' });
  const [files, setFiles] = useState({ report: null, liquidation: null });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const { data: info } = useQuery({
    queryKey: ['projects', project.id, 'completion-info'],
    queryFn: () => projectsApi.completionInfo(project.id),
  });
  useEffect(() => {
    if (info && !prefilled) {
      setPrefilled(true);
      setForm((f) => (f.actualParticipants === '' ? { ...f, actualParticipants: String(info.attendanceCount) } : f));
    }
  }, [info, prefilled]);
  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };
  const setFile = (k) => (f) => {
    setFiles((x) => ({ ...x, [k]: f }));
    setErrors((x) => ({ ...x, [k]: f ? checkFile(f) || undefined : undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    const e2 = {};
    if (!form.actualEndDate) e2.actualEndDate = 'Enter the actual end date';
    else if (form.actualEndDate > phToday()) e2.actualEndDate = 'The actual end date cannot be in the future';
    else if (startDay && form.actualEndDate < startDay) e2.actualEndDate = 'The actual end date cannot be before the start date';
    const n = Number(form.actualParticipants);
    if (form.actualParticipants === '' || !Number.isInteger(n) || n < 0) e2.actualParticipants = 'Enter the number of participants';
    if (!form.accomplishmentSummary.trim()) e2.accomplishmentSummary = 'Write the accomplishment summary';
    if (!files.report) e2.report = 'Upload the accomplishment report';
    else if (checkFile(files.report)) e2.report = checkFile(files.report);
    if (!files.liquidation) e2.liquidation = 'Upload the liquidation report';
    else if (checkFile(files.liquidation)) e2.liquidation = checkFile(files.liquidation);
    setErrors(e2);
    if (Object.keys(e2).length) return;
    const unused = info ? formatPeso2(info.unused) : 'The unused amount';
    if (!(await ask(`Mark “${project.title}” as completed? ${unused} unused goes back to the ABYIP item, and the project becomes view only.`, { confirmLabel: 'Complete' }))) return;
    run({
      setBusy,
      setErrors,
      setError,
      fallback: 'The project could not be completed. Try again.',
      action: () => projectsApi.complete(project.id, { ...form, accomplishmentSummary: form.accomplishmentSummary.trim(), ...files }),
      onDone: (res) => onDone(res, `The project is completed. ${formatPeso2(res.returned ?? 0)} unused went back to the ABYIP item.`),
    });
  }

  return (
    <FormModal name="Completion" id="completion-form" busy={busy} saveLabel="Complete project" onClose={onClose} error={error}>
      <div className="grid gap-2 sm:grid-cols-3">
        <ReadOnlyField label="Approved cost" value={info ? formatPeso2(info.approvedCost) : '…'} />
        <ReadOnlyField label="Actual cost" value={info ? formatPeso2(info.actualCost) : '…'} hint="Sum of the expenses" />
        <ReadOnlyField label="Unused amount" value={info ? formatPeso2(info.unused) : '…'} tone="good" hint="Returns to the ABYIP item" />
      </div>
      <form id="completion-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Actual end date"
            type="date"
            min={startDay || undefined}
            max={phToday()}
            value={form.actualEndDate}
            onChange={set('actualEndDate')}
            error={errors.actualEndDate}
          />
          <div>
            <Input
              label="Actual participants"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={form.actualParticipants}
              onChange={set('actualParticipants')}
              error={errors.actualParticipants}
            />
            {info && !errors.actualParticipants && (
              <p className="mt-1 text-[13px] text-slate-600">
                {info.attendanceCount} present in the attendance linked to this project.
              </p>
            )}
          </div>
        </div>
        <Textarea
          label="Accomplishment summary"
          rows={4}
          maxLength={5000}
          value={form.accomplishmentSummary}
          onChange={set('accomplishmentSummary')}
          error={errors.accomplishmentSummary}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FileInput id="completion-report" label="Accomplishment report" accept={FILE_ACCEPT} onChange={setFile('report')} error={errors.report} hint="PDF, DOCX, JPG or PNG, up to 10 MB." />
          <FileInput id="completion-liquidation" label="Liquidation report" accept={FILE_ACCEPT} onChange={setFile('liquidation')} error={errors.liquidation} hint="PDF, DOCX, JPG or PNG, up to 10 MB." />
        </div>
      </form>
    </FormModal>
  );
}

// ---------- Cancellation (Approved or Ongoing) ----------
// The reason and the date. The unspent part of the reserve goes back to the ABYIP item;
// expenses and files are kept. A warning shows the amount first, then a confirmation.
export function CancellationForm({ project, ask, onClose, onDone }) {
  const [form, setForm] = useState({ reason: '', date: phToday() });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const unspent = project.remainingBudget;
  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    const e2 = {};
    if (form.reason.trim().length < 10) e2.reason = 'Give the reason (at least 10 characters)';
    if (!form.date) e2.date = 'Enter the cancellation date';
    else if (form.date > phToday()) e2.date = 'The date cannot be in the future';
    setErrors(e2);
    if (Object.keys(e2).length) return;
    const q = `Cancel “${project.title}”? ${formatPeso2(unspent)} not yet spent goes back to the ABYIP item. This cannot be undone.`;
    if (!(await ask(q, { confirmLabel: 'Cancel project', cancelLabel: 'Keep it', variant: 'danger' }))) return;
    run({
      setBusy,
      setErrors,
      setError,
      fallback: 'The project could not be cancelled. Try again.',
      action: () => projectsApi.cancel(project.id, { reason: form.reason.trim(), date: form.date }),
      onDone: (res) => onDone(res, `The project was cancelled. ${formatPeso2(res.returned ?? 0)} went back to the ABYIP item.`),
    });
  }

  return (
    <FormModal name="Cancellation" id="cancel-form" busy={busy} saveLabel="Cancel project" saveVariant="danger" closeLabel="Close" onClose={onClose} error={error}>
      <div className="notice notice-warn text-sm" role="note">
        <p className="font-semibold">{formatPeso2(unspent)} of the reserved amount has not been spent.</p>
        <p className="mt-1">
          It goes back to the ABYIP item when the project is cancelled.
          {project.amountSpent > 0 && ` The ${formatPeso2(project.amountSpent)} already spent stays recorded.`} Expenses and files are kept.
        </p>
      </div>
      <form id="cancel-form" onSubmit={submit} noValidate className="space-y-4">
        <Textarea label="Reason" rows={3} maxLength={2000} value={form.reason} onChange={set('reason')} error={errors.reason} />
        <Input label="Cancellation date" type="date" max={phToday()} value={form.date} onChange={set('date')} error={errors.date} />
      </form>
    </FormModal>
  );
}

export { FileInput, FormModal, run };

