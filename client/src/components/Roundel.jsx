import { PROJECT_STATUS } from '../utils/format';

// ---------------------------------------------------------------------------
// Project marks:
//   StatusRibbon:    a project's status as a chip in its fixed colour.
//   StageSteps:      where a project is in the process
//                    Request -> Review -> Approved -> Ongoing -> Completed.
//   ProgressMeter:   the progress percentage from the latest Form 5 update.
// ---------------------------------------------------------------------------

export const STAGES = ['DRAFT', 'PENDING', 'APPROVED', 'ONGOING', 'COMPLETED'];
const STAGE_LABEL = { DRAFT: 'Request', PENDING: 'Review', APPROVED: 'Approved', ONGOING: 'Ongoing', COMPLETED: 'Completed' };

// Fixed status colours: Draft gray, Pending yellow, For Revision orange, Approved green,
// Rejected red, Ongoing blue, Completed dark green, Cancelled dark gray.
const STATUS_TONE = {
  DRAFT: { pill: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-300', dot: 'bg-slate-400' },
  PENDING: { pill: 'bg-mustard-wash text-mustard-text ring-1 ring-inset ring-amber-200', dot: 'bg-mustard' },
  FOR_REVISION: { pill: 'bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-200', dot: 'bg-orange-500' },
  APPROVED: { pill: 'bg-sage-wash text-sage-text ring-1 ring-inset ring-green-200', dot: 'bg-sage' },
  REJECTED: { pill: 'bg-clay-wash text-clay-text ring-1 ring-inset ring-red-200', dot: 'bg-clay' },
  ONGOING: { pill: 'bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200', dot: 'bg-blue-600' },
  COMPLETED: { pill: 'bg-brand-700 text-white', dot: 'bg-white' },
  CANCELLED: { pill: 'bg-slate-600 text-white', dot: 'bg-slate-200' },
};
// Older stage names (kept only in old records)
STATUS_TONE.PROPOSED = STATUS_TONE.PENDING;
STATUS_TONE.PLANNING = STATUS_TONE.APPROVED;
STATUS_TONE.ON_HOLD = STATUS_TONE.ONGOING;

// The status of a project as a chip: dot + word.
export function StatusRibbon({ status, label, className = '' }) {
  const text = label || PROJECT_STATUS[status]?.label || status;
  const tone = STATUS_TONE[status] || STATUS_TONE.DRAFT;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium leading-5 ${tone.pill} ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
      {text}
    </span>
  );
}

// Which step a status stands on, and whether the process stopped there.
function stepOf(status) {
  switch (status) {
    case 'DRAFT':
    case 'FOR_REVISION':
      return { index: 0 };
    case 'PENDING':
    case 'PROPOSED':
      return { index: 1 };
    case 'REJECTED':
      return { index: 1, stopped: 'Rejected' };
    case 'APPROVED':
    case 'PLANNING':
      return { index: 2 };
    case 'ONGOING':
    case 'ON_HOLD':
      return { index: 3 };
    case 'COMPLETED':
      return { index: 4, done: true };
    case 'CANCELLED':
      return { index: 3, stopped: 'Cancelled' };
    default:
      return { index: 0 };
  }
}

// The five steps as a row: done (sage), current (pine), stopped (clay) and still to come.
// showLabels={false} gives the compact bar.
export function StageSteps({ status, showLabels = true, className = '' }) {
  const { index, stopped, done: finished } = stepOf(status);
  const label = stopped
    ? `${stopped} at the ${STAGE_LABEL[STAGES[index]]} step`
    : `Step ${index + 1} of ${STAGES.length}: ${STAGE_LABEL[STAGES[index]]}`;
  return (
    <ol className={`flex w-full items-start ${className}`} aria-label={label}>
      {STAGES.map((s, i) => {
        const done = finished || i < index;
        const here = i === index && !finished;
        const dot = here && stopped
          ? 'bg-clay ring-clay'
          : done
            ? 'bg-sage ring-sage'
            : here
              ? 'bg-pine ring-pine'
              : 'bg-panel ring-slate-300';
        const line = i < index ? 'bg-sage' : 'bg-line';
        return (
          <li key={s} className="flex flex-1 flex-col items-center last:flex-none">
            <div className="flex w-full items-center">
              <span className={`h-3.5 w-3.5 shrink-0 rounded-full ring-2 ${dot}`} aria-hidden="true" />
              {i < STAGES.length - 1 && <span className={`h-0.5 flex-1 ${line}`} aria-hidden="true" />}
            </div>
            {showLabels && (
              <span className={`mt-1.5 self-start text-xs ${here ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                {here && stopped ? stopped : STAGE_LABEL[s]}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Progress (0-100) as a bar with the number.
export function ProgressMeter({ value = 0, className = '', label = 'Progress' }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-ink">{pct}%</span>
      </div>
      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-pine transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
