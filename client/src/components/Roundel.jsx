import { PROJECT_STATUS } from '../utils/format';

// ---------------------------------------------------------------------------
// Project marks:
//   StatusRibbon: a project's status as a small pill with a coloured dot.
//   StageSteps:   where a project is in the flow
//                 Proposed -> Planning -> Ongoing -> Completed (On Hold pauses at Ongoing).
// ---------------------------------------------------------------------------

export const STAGES = ['PROPOSED', 'PLANNING', 'ONGOING', 'COMPLETED'];

// sage = done, mustard = waiting, clay = rejected, pine = under way, neutral = paused
const STATUS_TONE = {
  PROPOSED: { pill: 'bg-mustard-wash text-mustard-text', dot: 'bg-mustard' },
  PLANNING: { pill: 'bg-pine-light text-pine', dot: 'bg-pine' },
  ONGOING: { pill: 'bg-pine-light text-pine', dot: 'bg-pine' },
  COMPLETED: { pill: 'bg-sage-wash text-sage-text', dot: 'bg-sage' },
  CANCELLED: { pill: 'bg-clay-wash text-clay-text', dot: 'bg-clay' },
  ON_HOLD: { pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
};

// The status of a project as a pill: dot + word.
export function StatusRibbon({ status, label, className = '' }) {
  const text = label || PROJECT_STATUS[status]?.label || status;
  const tone = STATUS_TONE[status] || STATUS_TONE.PROPOSED;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium leading-5 ${tone.pill} ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
      {text}
    </span>
  );
}

// The four stages as a row of steps: done (sage), current (pine) and still to come.
// A cancelled project stopped at Proposed; an On Hold one is paused at Ongoing.
// showLabels={false} gives the compact bar.
export function StageSteps({ status, showLabels = true, className = '' }) {
  const cancelled = status === 'CANCELLED';
  const onHold = status === 'ON_HOLD';
  const current = cancelled ? 0 : onHold ? STAGES.indexOf('ONGOING') : Math.max(0, STAGES.indexOf(status));
  const label = cancelled
    ? 'Cancelled at the Proposed stage'
    : onHold
      ? 'On hold at the Ongoing stage'
      : `Stage ${current + 1} of ${STAGES.length}: ${PROJECT_STATUS[status]?.label || status}`;
  return (
    <ol className={`flex w-full items-start ${className}`} aria-label={label}>
      {STAGES.map((s, i) => {
        const done = !cancelled && (i < current || status === 'COMPLETED');
        const here = i === current && status !== 'COMPLETED';
        const dot = cancelled && i === 0
          ? 'bg-clay ring-clay'
          : done
            ? 'bg-sage ring-sage'
            : here
              ? onHold
                ? 'bg-mustard ring-mustard'
                : 'bg-pine ring-pine'
              : 'bg-panel ring-slate-300';
        const line = !cancelled && i < current ? 'bg-sage' : 'bg-line';
        return (
          <li key={s} className="flex flex-1 flex-col items-center last:flex-none">
            <div className="flex w-full items-center">
              <span className={`h-3.5 w-3.5 shrink-0 rounded-full ring-2 ${dot}`} aria-hidden="true" />
              {i < STAGES.length - 1 && <span className={`h-0.5 flex-1 ${line}`} aria-hidden="true" />}
            </div>
            {showLabels && (
              <span
                className={`mt-1.5 self-start text-xs ${
                  here || (cancelled && i === 0) ? 'font-bold text-slate-900' : 'text-slate-500'
                }`}
              >
                {onHold && here ? PROJECT_STATUS.ON_HOLD.label : PROJECT_STATUS[s].label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
