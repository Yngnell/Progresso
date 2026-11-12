import { PROJECT_STATUS, STAGE_FLOW } from '../utils/format';

// ---------------------------------------------------------------------------
// Project marks:
//   StatusRibbon: a project's status as a small pill with a coloured dot.
//   StageSteps:   where a project is in the SK project process
//                 Pending Approval > Approved > Purchasing > Fund Release > Implementation >
//                 Liquidation > Completed (On Hold pauses at a stage; Rejected stops at the first).
// ---------------------------------------------------------------------------

export const STAGES = STAGE_FLOW;

// sage = done, mustard = waiting, clay = rejected, pine = under way, neutral = paused or filed
const UNDER_WAY = { pill: 'bg-pine-light text-pine', dot: 'bg-pine' };
const STATUS_TONE = {
  PENDING_APPROVAL: { pill: 'bg-mustard-wash text-mustard-text', dot: 'bg-mustard' },
  APPROVED: UNDER_WAY,
  PURCHASING: UNDER_WAY,
  FUND_RELEASE: UNDER_WAY,
  IMPLEMENTATION: UNDER_WAY,
  LIQUIDATION: UNDER_WAY,
  COMPLETED: { pill: 'bg-sage-wash text-sage-text', dot: 'bg-sage' },
  REJECTED: { pill: 'bg-clay-wash text-clay-text', dot: 'bg-clay' },
  ON_HOLD: { pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  ARCHIVED: { pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-500' },
};

// The status of a project as a pill: dot + word.
export function StatusRibbon({ status, label, className = '' }) {
  const text = label || PROJECT_STATUS[status]?.label || status;
  const tone = STATUS_TONE[status] || STATUS_TONE.PENDING_APPROVAL;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium leading-5 ${tone.pill} ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
      {text}
    </span>
  );
}

// The stages as a row of steps: done (sage), current (pine) and still to come.
// A rejected project stopped at Pending Approval; an On Hold one is paused at the stage it
// was held from (heldFrom); an archived one went all the way. showLabels={false} gives the
// compact bar. Only the current stage is named, unless allLabels (wide pages: every stage is
// named from the sm breakpoint up), so the row never overflows.
export function StageSteps({ status, heldFrom, showLabels = true, allLabels = false, className = '' }) {
  const rejected = status === 'REJECTED';
  const onHold = status === 'ON_HOLD';
  const finished = status === 'COMPLETED' || status === 'ARCHIVED';
  const current = rejected
    ? 0
    : onHold
      ? Math.max(0, STAGES.indexOf(heldFrom || 'IMPLEMENTATION'))
      : finished
        ? STAGES.length - 1
        : Math.max(0, STAGES.indexOf(status));
  const label = rejected
    ? 'Rejected at the Pending Approval stage'
    : onHold
      ? `On hold at the ${PROJECT_STATUS[STAGES[current]].label} stage`
      : `Stage ${current + 1} of ${STAGES.length}: ${PROJECT_STATUS[status]?.label || status}`;
  return (
    <ol className={`flex w-full items-start ${className}`} aria-label={label}>
      {STAGES.map((s, i) => {
        const done = !rejected && (i < current || finished);
        const here = i === current && !finished;
        const dot =
          rejected && i === 0
            ? 'bg-clay ring-clay'
            : done
              ? 'bg-sage ring-sage'
              : here
                ? onHold
                  ? 'bg-mustard ring-mustard'
                  : 'bg-pine ring-pine'
                : 'bg-panel ring-slate-300';
        const line = !rejected && (i < current || finished) ? 'bg-sage' : 'bg-line';
        const named = here || (rejected && i === 0);
        return (
          <li key={s} className="flex flex-1 flex-col items-center last:flex-none">
            <div className="flex w-full items-center">
              <span className={`h-3.5 w-3.5 shrink-0 rounded-full ring-2 ${dot}`} aria-hidden="true" />
              {i < STAGES.length - 1 && <span className={`h-0.5 flex-1 ${line}`} aria-hidden="true" />}
            </div>
            {showLabels && (
              <span
                className={`mt-1.5 max-w-[5.5rem] self-start pr-1 text-xs leading-tight ${
                  named ? 'font-bold text-slate-900' : allLabels ? 'hidden text-slate-500 sm:block' : 'hidden'
                }`}
                aria-current={here ? 'step' : undefined}
              >
                {onHold && here
                  ? `${PROJECT_STATUS.ON_HOLD.label} · ${PROJECT_STATUS[s].label}`
                  : rejected && i === 0
                    ? PROJECT_STATUS.REJECTED.label
                    : PROJECT_STATUS[s].label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
