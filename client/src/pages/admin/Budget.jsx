import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import KpiCard from '../../components/KpiCard';
import ReadOnlyField from '../../components/ReadOnlyField';
import { Button, Card, EmptyState, Input, Modal, Select, Textarea } from '../../components/ui';
import { budgetApi, errorMessage, fieldErrors } from '../../api/budget';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/roles';
import { formatPeso2 } from '../../utils/format';
import { useConfirm } from '../../components/ConfirmDialog';

const THIS_YEAR = new Date().getFullYear();

// Budget & ABYIP: the Annual Budget (the SK budget of a year) and the ABYIP items it funds.
// The SK Admin records them; the Barangay Chairman views them. Every balance comes from the server.
export default function Budget() {
  const { user } = useAuth();
  const canEdit = isAdmin(user);
  const qc = useQueryClient();
  const [year, setYear] = useState(null);
  const [notice, setNotice] = useState(null);
  const [budgetForm, setBudgetForm] = useState(null); // {} new, or the budget being edited
  const [itemForm, setItemForm] = useState(null); // {} new, or the item being edited

  const budgetsQ = useQuery({ queryKey: ['budgets'], queryFn: budgetApi.listBudgets });
  const budgets = budgetsQ.data?.budgets || [];
  const fundSources = budgetsQ.data?.fundSources || {};

  // The years to choose from: every year with a budget, and this year.
  const years = useMemo(
    () => [...new Set([THIS_YEAR, ...budgets.map((b) => b.year)])].sort((a, b) => b - a),
    [budgets]
  );
  useEffect(() => {
    if (year === null && budgetsQ.data) {
      setYear(budgets.some((b) => b.year === THIS_YEAR) || !budgets.length ? THIS_YEAR : budgets[0].year);
    }
  }, [year, budgetsQ.data, budgets]);

  const itemsQ = useQuery({
    queryKey: ['abyip', year],
    queryFn: () => budgetApi.listItems({ year }),
    enabled: year !== null,
  });
  const items = itemsQ.data?.items || [];
  const summary = itemsQ.data?.summary;
  const centers = itemsQ.data?.centers || [];
  const quarters = itemsQ.data?.quarters || ['Q1', 'Q2', 'Q3', 'Q4'];
  const yearBudget = budgets.find((b) => b.year === year);

  function saved(text) {
    setNotice({ ok: true, text });
    qc.invalidateQueries({ queryKey: ['budgets'] });
    qc.invalidateQueries({ queryKey: ['abyip'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget & ABYIP"
        description={
          canEdit
            ? 'Record the SK budget of each year and the programs it funds in the Annual Barangay Youth Investment Program (ABYIP).'
            : 'The SK budget of each year and the programs it funds in the Annual Barangay Youth Investment Program. View only.'
        }
        actions={
          canEdit && (
            <>
              <Button variant="secondary" onClick={() => setBudgetForm({})}>
                <Plus size={18} aria-hidden="true" /> Annual budget
              </Button>
              <Button onClick={() => setItemForm({ year })} disabled={!yearBudget}>
                <Plus size={18} aria-hidden="true" /> ABYIP item
              </Button>
            </>
          )
        }
      />

      {notice && (
        <p className={`notice text-sm font-medium ${notice.ok ? 'notice-ok' : 'notice-error'}`} role="status">
          {notice.text}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Year"
          className="w-40"
          value={year ?? ''}
          onChange={(e) => setYear(Number(e.target.value))}
          options={years.map((y) => ({ value: y, label: String(y) }))}
        />
      </div>

      {budgetsQ.isLoading || year === null ? (
        <p className="text-slate-600">Loading…</p>
      ) : !yearBudget ? (
        <EmptyState
          title={`No SK budget for ${year} yet`}
          description={
            canEdit
              ? 'Record the year’s total SK budget first. ABYIP items can then be added within it.'
              : 'The SK Admin has not recorded this year’s budget yet.'
          }
          action={canEdit && <Button onClick={() => setBudgetForm({ year })}>Record the {year} budget</Button>}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label={`SK budget ${year}`} value={formatPeso2(yearBudget.totalBudget)} note={fundSources[yearBudget.fundSource]} />
            <KpiCard
              label="Allotted to ABYIP items"
              value={formatPeso2(summary?.allotted ?? yearBudget.allotted)}
              meter={yearBudget.totalBudget ? ((summary?.allotted ?? 0) / yearBudget.totalBudget) * 100 : 0}
            />
            <KpiCard
              label="Unallotted budget"
              value={formatPeso2(summary?.unallotted ?? yearBudget.unallotted)}
              note="Still free for new ABYIP items"
              tone="green"
            />
          </div>

          <Card className="overflow-hidden">
            <div className="card-head flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h2 className="section-title">ABYIP items {year}</h2>
            </div>
            {itemsQ.isLoading ? (
              <p className="px-5 py-4 text-slate-600">Loading…</p>
            ) : !items.length ? (
              <p className="px-5 py-6 text-slate-600">
                No ABYIP items for {year} yet.{canEdit && ' Add one with “ABYIP item”; Project Requests are funded from them.'}
              </p>
            ) : (
              <ItemsTable items={items} canEdit={canEdit} onEdit={(it) => setItemForm(it)} />
            )}
          </Card>
        </>
      )}

      <Card className="overflow-hidden">
        <div className="card-head px-5 py-4">
          <h2 className="section-title">Annual budgets</h2>
        </div>
        {!budgets.length ? (
          <p className="px-5 py-6 text-slate-600">No annual budget recorded yet.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="table-notebook">
              <thead>
                <tr>
                  <th>Year</th>
                  <th className="text-right">Total SK budget</th>
                  <th>Fund source</th>
                  <th className="text-right">Unallotted</th>
                  <th>Remarks</th>
                  {canEdit && <th className="w-px"><span className="sr-only">Edit</span></th>}
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => (
                  <tr key={b.id}>
                    <td className="font-medium">{b.year}</td>
                    <td className="whitespace-nowrap text-right">{formatPeso2(b.totalBudget)}</td>
                    <td>{fundSources[b.fundSource] || b.fundSource}</td>
                    <td className="whitespace-nowrap text-right">{formatPeso2(b.unallotted)}</td>
                    <td className="max-w-xs text-slate-600">{b.remarks || '—'}</td>
                    {canEdit && (
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => setBudgetForm(b)} aria-label={`Edit the ${b.year} budget`}>
                          <Pencil size={16} aria-hidden="true" /> Edit
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {budgetForm && (
        <BudgetForm
          budget={budgetForm}
          fundSources={fundSources}
          onClose={() => setBudgetForm(null)}
          onSaved={(b, isNew) => {
            setBudgetForm(null);
            setYear(b.year);
            saved(isNew ? `The ${b.year} SK budget is recorded.` : `The ${b.year} SK budget is updated.`);
          }}
        />
      )}
      {itemForm && (
        <ItemForm
          item={itemForm}
          budgets={budgets}
          centers={centers}
          quarters={quarters}
          onClose={() => setItemForm(null)}
          onSaved={(it, isNew) => {
            setItemForm(null);
            setYear(it.year);
            saved(isNew ? `“${it.name}” is added to the ${it.year} ABYIP.` : `“${it.name}” is updated.`);
          }}
        />
      )}
    </div>
  );
}

function ItemsTable({ items, canEdit, onEdit }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="table-notebook">
        <thead>
          <tr>
            <th>Program / project</th>
            <th>Center of participation</th>
            <th>Quarter</th>
            <th className="text-right">Allotted</th>
            <th className="text-right">Used & reserved</th>
            <th className="text-right">Remaining</th>
            {canEdit && <th className="w-px"><span className="sr-only">Edit</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>
                <p className="font-medium text-ink">{it.name}</p>
                {it.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{it.description}</p>}
              </td>
              <td>{it.center}</td>
              <td>{it.targetQuarter}</td>
              <td className="whitespace-nowrap text-right">{formatPeso2(it.allottedAmount)}</td>
              <td className="whitespace-nowrap text-right">{formatPeso2(it.reserved + it.used)}</td>
              <td className={`whitespace-nowrap text-right font-semibold ${it.remaining > 0 ? 'text-sage-text' : 'text-slate-600'}`}>
                {formatPeso2(it.remaining)}
              </td>
              {canEdit && (
                <td>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(it)} aria-label={`Edit ${it.name}`}>
                    <Pencil size={16} aria-hidden="true" /> Edit
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Annual Budget. One record per year; the year cannot change once saved.
function BudgetForm({ budget, fundSources, onClose, onSaved }) {
  const isNew = !budget.id;
  const [form, setForm] = useState({
    year: budget.year ?? THIS_YEAR,
    totalBudget: budget.totalBudget ?? '',
    fundSource: budget.fundSource ?? '',
    remarks: budget.remarks ?? '',
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ask, askDialog] = useConfirm();
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  function check() {
    const e = {};
    const y = Number(form.year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) e.year = 'Enter a valid year';
    if (form.totalBudget === '' || !(Number(form.totalBudget) > 0)) e.totalBudget = 'The total SK budget must be above zero';
    if (!form.fundSource) e.fundSource = 'Choose the fund source';
    return e;
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const e2 = check();
    setErrors(e2);
    if (Object.keys(e2).length) return;
    if (!isNew && !(await ask(`Are you sure you want to update the ${budget.year} SK budget?`))) return;
    setBusy(true);
    try {
      const data = { ...form, year: Number(form.year), totalBudget: Number(form.totalBudget) };
      const res = isNew ? await budgetApi.createBudget(data) : await budgetApi.updateBudget(budget.id, data);
      onSaved(res.budget, isNew);
    } catch (err) {
      setErrors(fieldErrors(err));
      if (!Object.keys(fieldErrors(err)).length) setError(errorMessage(err, 'The budget could not be saved. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Annual Budget"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="budget-form" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Save budget' : 'Save changes'}</Button>
        </>
      }
    >
      <form id="budget-form" onSubmit={submit} className="space-y-4 pb-5" noValidate>
        {error && <p className="notice notice-error text-sm" role="alert">{error}</p>}
        {isNew ? (
          <Input label="Year" type="number" min="2000" max="2100" value={form.year} onChange={set('year')} error={errors.year} />
        ) : (
          <ReadOnlyField label="Year" value={budget.year} hint="One budget per year; the year cannot change." />
        )}
        <Input
          label="Total SK budget (₱)"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={form.totalBudget}
          onChange={set('totalBudget')}
          error={errors.totalBudget}
        />
        <Select
          label="Fund source"
          value={form.fundSource}
          onChange={set('fundSource')}
          error={errors.fundSource}
          options={[{ value: '', label: 'Choose…' }, ...Object.entries(fundSources).map(([value, label]) => ({ value, label }))]}
        />
        <Textarea label="Remarks (optional)" rows={3} maxLength={500} value={form.remarks} onChange={set('remarks')} />
      </form>
      {askDialog}
    </Modal>
  );
}

// ABYIP Item. The allotments of a year cannot exceed its SK budget.
function ItemForm({ item, budgets, centers, quarters, onClose, onSaved }) {
  const isNew = !item.id;
  const [form, setForm] = useState({
    year: item.year ?? budgets[0]?.year ?? THIS_YEAR,
    name: item.name ?? '',
    center: item.center ?? '',
    description: item.description ?? '',
    allottedAmount: item.allottedAmount ?? '',
    targetQuarter: item.targetQuarter ?? '',
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ask, askDialog] = useConfirm();
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  // What is still free in the chosen year (this item's own allotment counts as free while editing).
  const yearBudget = budgets.find((b) => b.year === Number(form.year));
  const own = !isNew && Number(form.year) === item.year ? Number(item.allottedAmount) : 0;
  const available = yearBudget ? Math.round((yearBudget.unallotted + own) * 100) / 100 : null;
  const committed = isNew ? 0 : Math.round((item.reserved + item.used) * 100) / 100;

  function check() {
    const e = {};
    if (!yearBudget) e.year = 'Choose a year that has an SK budget';
    if (!form.name.trim()) e.name = 'Enter the program or project name';
    if (!form.center) e.center = 'Choose the center of participation';
    const amt = Number(form.allottedAmount);
    if (form.allottedAmount === '' || !(amt > 0)) e.allottedAmount = 'The allotted amount must be above zero';
    else if (available !== null && amt > available) e.allottedAmount = `Only ${formatPeso2(available)} of the ${form.year} budget is not yet allotted.`;
    else if (amt < committed) e.allottedAmount = `Projects already use ${formatPeso2(committed)} of this item; the allotment cannot be lower.`;
    if (!form.targetQuarter) e.targetQuarter = 'Choose the target quarter';
    return e;
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const e2 = check();
    setErrors(e2);
    if (Object.keys(e2).length) return;
    if (!isNew && !(await ask(`Are you sure you want to update “${item.name}”?`))) return;
    setBusy(true);
    try {
      const data = { ...form, year: Number(form.year), allottedAmount: Number(form.allottedAmount) };
      const res = isNew ? await budgetApi.createItem(data) : await budgetApi.updateItem(item.id, data);
      onSaved(res.item, isNew);
    } catch (err) {
      setErrors(fieldErrors(err));
      if (!Object.keys(fieldErrors(err)).length) setError(errorMessage(err, 'The ABYIP item could not be saved. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="ABYIP Item"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="item-form" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Save item' : 'Save changes'}</Button>
        </>
      }
    >
      <form id="item-form" onSubmit={submit} className="space-y-4 pb-5" noValidate>
        {error && <p className="notice notice-error text-sm" role="alert">{error}</p>}
        <ReadOnlyField
          label={isNew ? `Unallotted budget of ${form.year}` : `Available for this item in ${form.year}`}
          value={available === null ? 'No SK budget for this year' : formatPeso2(available)}
          tone={available === null || available <= 0 ? 'bad' : undefined}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Year"
            value={form.year}
            onChange={set('year')}
            error={errors.year}
            disabled={committed > 0}
            options={budgets.map((b) => ({ value: b.year, label: String(b.year) }))}
          />
          <Select
            label="Target quarter"
            value={form.targetQuarter}
            onChange={set('targetQuarter')}
            error={errors.targetQuarter}
            options={[{ value: '', label: 'Choose…' }, ...quarters.map((q) => ({ value: q, label: q }))]}
          />
        </div>
        <Input label="Program / project name" maxLength={200} value={form.name} onChange={set('name')} error={errors.name} />
        <Select
          label="Center of participation"
          value={form.center}
          onChange={set('center')}
          error={errors.center}
          options={[{ value: '', label: 'Choose…' }, ...centers.map((c) => ({ value: c, label: c }))]}
        />
        <Textarea label="Description (optional)" rows={3} maxLength={2000} value={form.description} onChange={set('description')} />
        <Input
          label="Allotted amount (₱)"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={form.allottedAmount}
          onChange={set('allottedAmount')}
          error={errors.allottedAmount}
        />
        {committed > 0 && (
          <p className="text-[13px] text-slate-600">Projects already use {formatPeso2(committed)} of this item.</p>
        )}
      </form>
      {askDialog}
    </Modal>
  );
}
