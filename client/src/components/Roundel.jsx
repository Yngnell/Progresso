import { PROJECT_STATUS } from '../utils/format';

// ---------------------------------------------------------------------------
// Project marks taken from the SK Salinas 1 seal:
//   StatusRibbon: a project's status drawn as the seal's swallowtail banner.
//   StageSteps:   where a project is in the flow
//                 Proposed -> Planning -> Ongoing -> Completed (On Hold pauses at Ongoing).
// ---------------------------------------------------------------------------

export const STAGES = ['PROPOSED', 'PLANNING', 'ONGOING', 'COMPLETED'];

const RIBBON_TONE = {
  PROPOSED: 'bg-slate-600 text-white',
  PLANNING: 'bg-brand-600 text-white',
  ONGOING: 'bg-accent-500 text-ink',
  COMPLETED: 'bg-green-600 text-white',
  CANCELLED: 'bg-red-600 text-white',
  ON_HOLD: 'bg-slate-400 text-ink',
};

// Swallowtail banner for a project's status, like the red ribbon on the seal.
export function StatusRibbon({ status, label, className = '' }) {
  const text = label || PROJECT_STATUS[status]?.label || status;
  return (
    <span
      className={`seal-type inline-flex items-center whitespace-nowrap px-4 py-0.5 text-[13px] leading-5 ${
        RIBBON_TONE[status] || RIBBON_TONE.PROPOSED
      } ${className}`}
      style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 7px) 50%, 100% 100%, 0 100%, 7px 50%)' }}
    >
      {text}
    </span>
  );
}

// The four stages as a row of steps: done (green), current (gold) and still to come.
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
          ? 'bg-red-600 ring-red-600'
          : done
            ? 'bg-green-600 ring-green-600'
            : here
              ? onHold
                ? 'bg-slate-400 ring-ink'
                : 'bg-accent-500 ring-ink'
              : 'bg-white ring-slate-300';
        const line = !cancelled && i < current ? 'bg-green-600' : 'bg-slate-200';
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
