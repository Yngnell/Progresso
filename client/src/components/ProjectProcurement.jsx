import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { projectsApi } from '../api/projects';
import { settingsApi } from '../api/settings';
import { officialsApi } from '../api/officials';
import { useConfirm } from './ConfirmDialog';
import { Button, Card, Modal } from './ui';
import { formatPeso2 } from '../utils/format';
import { formReadiness, makeProjectForm } from '../utils/projectForms';

// The buying side of a project, typed once and reused everywhere:
//   ItemsCard   - the things to buy (from the Project Request form)
//   CanvassCard - the suppliers' quotations; the lowest complete one wins
//   FormsCard   - the auto-made PDF forms (Activity Design to Liquidation Report)

const cardTitle = 'section-title';
const errorText = (err, fallback) => err?.response?.data?.message || fallback;
const lineTotal = (price, qty) => Math.round(Number(price || 0) * qty * 100) / 100;

export function ItemsCard({ project }) {
  const items = project.items || [];
  return (
    <Card className="p-6">
      <h2 className={cardTitle}>Items to buy</h2>
      <p className="mt-1 text-sm text-slate-600">From the Project Request. Change them with Edit on the Projects page.</p>
      <table className="table-notebook table-stack mt-3">
        <thead>
          <tr>
            <th className="py-2">No.</th>
            <th className="py-2">Item</th>
            <th className="py-2">Unit</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Est. unit cost</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i, n) => (
            <tr key={i.id}>
              <td data-label="No." className="py-2 text-slate-500">{n + 1}</td>
              <td data-label="Item" className="py-2 text-slate-800">{i.description}</td>
              <td data-label="Unit" className="py-2 text-slate-600">{i.unit || '—'}</td>
              <td data-label="Qty" className="py-2 text-right text-slate-700">{i.quantity}</td>
              <td data-label="Est. unit cost" className="py-2 text-right text-slate-700">{formatPeso2(i.estUnitCost)}</td>
              <td data-label="Amount" className="py-2 text-right font-medium text-slate-800">
                {formatPeso2(lineTotal(i.estUnitCost, i.quantity))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line">
            <td data-label="" className="py-2 font-semibold text-slate-700" colSpan={5}>Total</td>
            <td data-label="Total" className="py-2 text-right font-semibold text-slate-800">{formatPeso2(project.itemsTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}

const MIN_QUOTATIONS = 3;

// Supplier quotations. The SK Admin types each supplier's unit prices; the system totals them
// and marks the lowest quotation that prices every item (it goes on the Abstract and the PO).
export function CanvassCard({ project, canEdit, onDone, onFail }) {
  const items = project.items || [];
  const quotations = project.quotations || [];
  const [editing, setEditing] = useState(null); // null | 'new' | quotation
  const [ask, askDialog] = useConfirm();
  const remove = useMutation({
    mutationFn: (q) => projectsApi.deleteQuotation(project.id, q.id),
    onSuccess: (res, q) => onDone(res, { note: `The quotation of ${q.supplierName} was deleted.` }),
    onError: onFail('Could not delete the quotation'),
  });
  const complete = quotations.filter((q) => q.complete).length;
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={cardTitle}>Canvass (supplier quotations)</h2>
        <span className={`text-sm font-semibold ${complete >= MIN_QUOTATIONS ? 'text-sage-text' : 'text-slate-700'}`}>
          {complete} of {MIN_QUOTATIONS} quotations
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Ask at least {MIN_QUOTATIONS} suppliers for their prices (print the Request for Quotation), then type them here.
        The lowest quotation that prices every item is used for the Abstract of Canvass and the Purchase Order.
      </p>
      {canEdit && (
        <Button variant="secondary" className="mt-4" onClick={() => setEditing('new')}>
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
          Add quotation
        </Button>
      )}
      {quotations.length === 0 ? (
        <p className="mt-4 text-slate-600">No quotations yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="table-notebook min-w-max">
            <thead>
              <tr>
                <th className="py-2">Item</th>
                {quotations.map((q) => (
                  <th key={q.id} className={`py-2 text-right ${q.id === project.winningQuotationId ? 'bg-sage-wash' : ''}`}>
                    {q.supplierName}
                    {q.id === project.winningQuotationId && <span className="block text-xs font-semibold normal-case text-sage-text">Lowest</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="py-2 text-slate-800">
                    {i.description} <span className="text-slate-500">× {i.quantity}</span>
                  </td>
                  {quotations.map((q) => (
                    <td key={q.id} className={`py-2 text-right text-slate-700 ${q.id === project.winningQuotationId ? 'bg-sage-wash' : ''}`}>
                      {q.prices?.[i.id] != null ? formatPeso2(lineTotal(q.prices[i.id], i.quantity)) : <span className="text-slate-400">no price</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line">
                <td className="py-2 font-semibold text-slate-700">Total</td>
                {quotations.map((q) => (
                  <td key={q.id} className={`py-2 text-right font-semibold text-slate-900 ${q.id === project.winningQuotationId ? 'bg-sage-wash' : ''}`}>
                    {formatPeso2(q.total)}
                    {!q.complete && <span className="block text-xs font-normal text-amber-800">incomplete</span>}
                  </td>
                ))}
              </tr>
              {canEdit && (
                <tr>
                  <td />
                  {quotations.map((q) => (
                    <td key={q.id} className="py-2 text-right">
                      <span className="inline-flex gap-3">
                        <button type="button" className="text-slate-600 hover:text-slate-900" aria-label={`Edit ${q.supplierName}`} onClick={() => setEditing(q)}>
                          <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="text-red-600 hover:text-red-700"
                          aria-label={`Delete ${q.supplierName}`}
                          disabled={remove.isPending}
                          onClick={async () => {
                            if (await ask(`Delete the quotation of ${q.supplierName}?`, { confirmLabel: 'Delete', cancelLabel: 'Cancel', variant: 'danger' })) {
                              remove.mutate(q);
                            }
                          }}
                        >
                          <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </span>
                    </td>
                  ))}
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}
      {editing && (
        <QuotationModal
          project={project}
          quotation={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(res, text) => {
            setEditing(null);
            onDone(res, { note: text });
          }}
        />
      )}
      {askDialog}
    </Card>
  );
}

function QuotationModal({ project, quotation, onClose, onSaved }) {
  const items = project.items || [];
  const [supplierName, setSupplierName] = useState(quotation?.supplierName || '');
  const [supplierAddress, setSupplierAddress] = useState(quotation?.supplierAddress || '');
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(items.map((i) => [i.id, quotation?.prices?.[i.id] != null ? String(quotation.prices[i.id]) : '']))
  );
  const [problem, setProblem] = useState('');
  const save = useMutation({
    mutationFn: (data) =>
      quotation ? projectsApi.updateQuotation(project.id, quotation.id, data) : projectsApi.addQuotation(project.id, data),
    onSuccess: (res) => onSaved(res, `The quotation of ${supplierName.trim()} was saved.`),
    onError: (err) => setProblem(errorText(err, 'Could not save the quotation')),
  });
  const total = items.reduce((sum, i) => sum + (prices[i.id] === '' ? 0 : lineTotal(prices[i.id], i.quantity)), 0);
  function submit(e) {
    e.preventDefault();
    if (!supplierName.trim()) return setProblem("Enter the supplier's name.");
    setProblem('');
    save.mutate({ supplierName: supplierName.trim(), supplierAddress: supplierAddress.trim(), prices });
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={quotation ? 'Edit quotation' : 'Add quotation'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="quotation-form" variant="primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="quotation-form" onSubmit={submit} className="pb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Supplier name *</span>
            <input className="input" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
          </label>
          <label className="block">
            <span className="label">Address</span>
            <input className="input" value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)} />
          </label>
        </div>
        <p className="mt-4 text-sm text-slate-600">Type the supplier's unit price for each item. Leave it empty if they did not quote it.</p>
        <ul className="mt-2 divide-y divide-slate-100">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="min-w-0 flex-1 text-sm text-slate-800">
                {i.description} <span className="text-slate-500">× {i.quantity}{i.unit ? ` ${i.unit}` : ''}</span>
              </span>
              <input
                className="input w-36 text-right"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="Unit price"
                aria-label={`Unit price: ${i.description}`}
                value={prices[i.id]}
                onChange={(e) => setPrices((p) => ({ ...p, [i.id]: e.target.value }))}
              />
              <span className="w-28 text-right text-sm font-medium text-slate-700">
                {prices[i.id] === '' ? '—' : formatPeso2(lineTotal(prices[i.id], i.quantity))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-right text-sm font-semibold text-slate-900">Total: {formatPeso2(total)}</p>
        {problem && <p className="mt-2 text-sm font-medium text-red-600" role="alert">{problem}</p>}
      </form>
    </Modal>
  );
}

// The auto-made forms. A form that cannot be made yet says what it needs.
export function FormsCard({ project }) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const { data: officialsData } = useQuery({
    queryKey: ['officials', 'active'],
    queryFn: () => officialsApi.list({ active: 'true' }),
  });
  async function make(form) {
    setBusy(form.key);
    setMsg(null);
    try {
      const { settings } = await settingsApi.get();
      await makeProjectForm(form.key, { project, settings, officials: officialsData?.officials || [] });
      setMsg({ ok: true, text: `${form.label} downloaded.` });
    } catch (err) {
      console.error(err);
      setMsg({ ok: false, text: `The ${form.label} could not be made. Try again.` });
    } finally {
      setBusy('');
    }
  }
  return (
    <Card className="p-6">
      <h2 className={cardTitle}>Forms</h2>
      <p className="mt-1 text-sm text-slate-600">Filled in from this project, ready to print and sign.</p>
      {msg && (
        <p className={`notice mt-3 ${msg.ok ? 'notice-ok' : 'notice-error'}`} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {formReadiness(project).map((f) => (
          <li key={f.key}>
            <button
              type="button"
              disabled={!f.ready || Boolean(busy)}
              onClick={() => make(f)}
              className="flex w-full items-start gap-2 rounded-control px-2 py-1.5 text-left text-sm hover:bg-pine-light disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <FileDown size={18} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${f.ready ? 'text-pine' : 'text-slate-400'}`} aria-hidden="true" />
              <span>
                <span className={`block font-medium ${f.ready ? 'text-slate-900' : 'text-slate-500'}`}>
                  {busy === f.key ? 'Making…' : f.label}
                </span>
                {!f.ready && <span className="block text-xs text-slate-500">{f.why}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
