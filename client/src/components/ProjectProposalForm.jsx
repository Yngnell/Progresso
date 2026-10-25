import { useEffect } from 'react';
import Letterhead from './Letterhead';

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];
const ORDINAL = { 1: 'st', 2: 'nd', 3: 'rd', 4: 'th' };

// Borderless, centred input that sits inside a table cell (like the printed sheet).
const cellInput =
  'w-full bg-transparent px-2 py-3 text-center text-sm font-semibold text-black outline-none focus:bg-brand-50/70';

const cell = 'border border-black';
const headCell = `${cell} px-2 py-3 text-center text-sm font-bold text-black`;

// PR numbers are automatic and look like 10-003-2026: month of the PR date, the row's
// position (001, 002, 003, ...), and the year.

// Month and year of a PR row: its own date, else the project's start, else today.
function prefixParts(item, startDate) {
  const d = item.prDate
    ? new Date(`${item.prDate}T00:00:00`)
    : startDate
      ? new Date(startDate)
      : new Date();
  const base = Number.isNaN(d.getTime()) ? new Date() : d;
  return { mm: String(base.getMonth() + 1).padStart(2, '0'), yyyy: String(base.getFullYear()) };
}

// The full PR no. of a row, e.g. row 3 with a date in October 2026 -> "10-003-2026".
function prNumber(item, index, startDate) {
  const { mm, yyyy } = prefixParts(item, startDate);
  return `${mm}-${String(index + 1).padStart(3, '0')}-${yyyy}`;
}

export const emptyItem = { prNo: '', prDate: '', requestedBy: '', amount: '' };

function peso(n) {
  return Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Small round button on the side of a row.
function SideButton({ label, onClick, children, tone = 'brand' }) {
  const tones = {
    brand: 'border-brand-600 text-brand-600 hover:bg-brand-50',
    red: 'border-red-400 text-red-500 hover:bg-red-50',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-6 w-6 items-center justify-center rounded-full border bg-white text-sm font-bold leading-none ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

// The Add/Edit Project form, laid out exactly like the SK's "Monthly Itemized List
// of Purchase Request (PR)" sheet: letterhead, bordered table whose rows the admin
// adds with the + button, PREPARED BY / NOTED BY, then the purpose of the request and
// the start/end date and time used for progress monitoring.
// The parent owns the state and renders <form id="project-form"> around this.
export default function ProjectProposalForm({
  form,
  update,
  updateItem,
  addItem,
  removeItem,
  officials,
}) {
  const treasurer = officials.find((o) => /treasurer/i.test(o.position || ''));
  const chairperson = officials.find((o) => /chairperson/i.test(o.position || ''));

  // "For the 3rd Quarter Month of AUGUST C.Y. 2026" follows the start date.
  const basis = form.startDate ? new Date(form.startDate) : new Date();
  const month = basis.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  const monthName = MONTHS[month];
  const year = basis.getFullYear();

  // Keep every row's saved PR no. in step with its position and date: adding, removing
  // or re-dating a row renumbers the list (001, 002, 003, ...).
  useEffect(() => {
    form.items.forEach((item, i) => {
      const wanted = prNumber(item, i, form.startDate);
      if (item.prNo !== wanted) updateItem(i, 'prNo', wanted);
    });
  }, [form.items, form.startDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = form.items.reduce((sum, i) => sum + Number(i.amount || 0), 0);

  return (
    <div className="pb-6">
      <Letterhead />

      <div className="mt-4 text-center">
        <h2 className="text-base font-bold uppercase text-black">
          Monthly Itemized List of Purchase Request (PR)
        </h2>
        <p className="mt-1 text-sm font-bold text-black">
          For the{' '}
          <span className="underline">
            {quarter}
            <sup>{ORDINAL[quarter]}</sup> Quarter Month of {monthName} C.Y. {year}
          </span>
        </p>
      </div>

      {/* Table. The right padding leaves room for the + / x buttons beside the rows. */}
      <div className="mt-6 pr-14">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${headCell} w-14`}>No.</th>
              <th className={headCell}>PR NO.</th>
              <th className={headCell}>DATE OF PR</th>
              <th className={headCell}>REQUESTED BY</th>
              <th className={`${headCell} w-36`}>
                Total
                <br />
                Estimated
                <br />
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {form.items.map((item, i) => (
              <tr key={i}>
                <td className={`${cell} text-center text-sm font-bold text-black`}>{i + 1}</td>
                <td
                  className={`${cell} px-2 py-3 text-center text-sm font-semibold text-black`}
                  data-pr-no
                >
                  {prNumber(item, i, form.startDate)}
                </td>
                <td className={cell}>
                  <input
                    className={cellInput}
                    type="date"
                    value={item.prDate}
                    onChange={(e) => updateItem(i, 'prDate', e.target.value)}
                  />
                </td>
                <td className={cell}>
                  <input
                    className={`${cellInput} uppercase`}
                    value={item.requestedBy}
                    onChange={(e) => updateItem(i, 'requestedBy', e.target.value)}
                    list="official-names"
                    placeholder="Name"
                  />
                </td>
                <td className={`${cell} relative`}>
                  <input
                    className={cellInput}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.amount}
                    onChange={(e) => updateItem(i, 'amount', e.target.value)}
                    placeholder="0.00"
                  />
                  {/* Side buttons: add a row right below this one, or remove this one */}
                  <div className="absolute left-full top-1/2 ml-3 flex -translate-y-1/2 flex-col gap-1">
                    <SideButton label="Add a row below" onClick={() => addItem(i)}>
                      +
                    </SideButton>
                    {form.items.length > 1 && (
                      <SideButton label="Remove this row" tone="red" onClick={() => removeItem(i)}>
                        ×
                      </SideButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            <tr>
              <td
                colSpan={4}
                className={`${cell} px-2 py-4 text-center text-sm font-semibold text-black`}
              >
                Total Amount of Purchase Request for the Month of {monthName}
              </td>
              <td className={`${cell} px-2 py-4 text-center text-sm font-bold text-black`}>
                {peso(total)}
              </td>
            </tr>
          </tbody>
        </table>
        <datalist id="official-names">
          {officials.map((o) => (
            <option key={o.id} value={o.name} />
          ))}
        </datalist>

        {/* Prepared by / Noted by, inside the same outer border as the table */}
        <div className="border border-t-0 border-black px-4 pb-10 pt-3">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-bold uppercase text-black">Prepared by:</p>
              <div className="mt-12 inline-block">
                <p className="border-b-2 border-black text-sm font-bold uppercase text-black">
                  {treasurer ? treasurer.name : ' '}
                </p>
                <p className="mt-0.5 text-center text-sm font-semibold text-black">SK Treasurer</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-left text-sm font-bold uppercase text-black">Noted by:</p>
              <div className="mt-12 inline-block">
                <p className="border-b-2 border-black text-sm font-bold uppercase text-black">
                  {chairperson ? chairperson.name : ' '}
                </p>
                <p className="mt-0.5 text-center text-sm font-semibold text-black">
                  SK Chairperson
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Purpose of request: becomes the project's name and description */}
      <div className="mt-6">
        <label className="text-sm font-bold uppercase text-black">Purpose of request *</label>
        <textarea
          className="input mt-1"
          rows={4}
          value={form.purpose}
          onChange={(e) => update('purpose', e.target.value)}
          placeholder={'First line: the project name (e.g. SK Basketball League 2026)\nNext lines: what it is for and who it will help'}
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          The first line is used as the project name; anything below it is the description.
        </p>
      </div>

      {/* Schedule used for progress monitoring: kept last */}
      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr>
            <th colSpan={2} className={`${headCell} text-xs uppercase`}>
              Progress monitoring · target implementation schedule
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className={`${cell} w-52 px-3 py-2 text-left text-xs font-bold uppercase text-black`}>
              Start (date &amp; time) *
            </th>
            <td className={cell}>
              <input
                className={cellInput}
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
                required
              />
            </td>
          </tr>
          <tr>
            <th scope="row" className={`${cell} w-52 px-3 py-2 text-left text-xs font-bold uppercase text-black`}>
              End (date &amp; time) *
            </th>
            <td className={cell}>
              <input
                className={cellInput}
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => update('endDate', e.target.value)}
                required
              />
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        Progress is calculated automatically from the sessions held when events are linked to the
        project, otherwise from this start and end date and time.
      </p>
    </div>
  );
}
