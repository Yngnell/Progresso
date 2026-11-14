import { PROJECT_STATUS } from '../utils/format';

// ---------------------------------------------------------------------------
// Project marks:
//   StatusRibbon:    a project's status as a chip in its fixed colour.
//   StageSteps:      where a project is in the process
//                    Request -> Review -> Approved -> Ongoing -> Completed.
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

// Soft colour of the current step's label badge: Request gray, Review blue, Approved teal,
// Ongoing orange, Completed green (the other steps stay plain). A stopped process is red there.
const STAGE_BADGE = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  PENDING: 'bg-blue-50 text-blue-700 ring-blue-200',
  APPROVED: 'bg-teal-50 text-teal-700 ring-teal-200',
  ONGOING: 'bg-orange-50 text-orange-700 ring-orange-200',
  COMPLETED: 'bg-green-50 text-green-700 ring-green-200',
  STOPPED: 'bg-red-50 text-red-700 ring-red-200',
  OTHER: 'bg-transparent text-slate-500 ring-line', // every step but the current one
};

// The five steps as a row: done (sage), current (pine), stopped (clay) and still to come.
// showLabels={false} gives the compact bar. badges puts the step names under the bar as
// coloured badges (one line each, evenly spaced; they continue on a second line on narrow cards).
export function StageSteps({ status, showLabels = true, badges = false, className = '' }) {
  const { index, stopped, done: finished } = stepOf(status);
  const label = stopped
    ? `${stopped} at the ${STAGE_LABEL[STAGES[index]]} step`
    : `Step ${index + 1} of ${STAGES.length}: ${STAGE_LABEL[STAGES[index]]}`;
  if (badges) {
    return (
      <div className={`w-full ${className}`}>
        <div aria-hidden="true">
          <StageSteps status={status} showLabels={false} />
        </div>
        <ol className="mt-2.5 flex flex-wrap gap-x-2 gap-y-2" aria-label={label}>
          {STAGES.map((s, i) => {
            // Only the step the project is on now gets its colour (a completed project is on Completed).
            const here = i === index;
            const tone = here ? (stopped ? STAGE_BADGE.STOPPED : STAGE_BADGE[s]) : STAGE_BADGE.OTHER;
            return (
              <li
                key={s}
                aria-current={here ? 'step' : undefined}
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset ${tone}`}
              >
                {here && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />}
                {here && stopped ? stopped : STAGE_LABEL[s]}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }
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

