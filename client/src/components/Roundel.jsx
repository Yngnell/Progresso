import { PROJECT_STATUS } from '../utils/format';

// ---------------------------------------------------------------------------
// The two signature marks of the system, both taken from the SK Salinas 1 seal:
//   ProgressRoundel: a project's progress drawn as the seal's ring.
//   StatusRibbon:    a project's status drawn as the seal's swallowtail banner.
// ---------------------------------------------------------------------------

const INK = '#0A0C10'; // the seal's black ring
const TRACK = '#E9EEF7';
const AZURE = '#2F7FE6';
const GOLD = '#F2B705';
const GOLD_DARK = '#CB8F00';
const GREEN = '#538A1B';

const SIZES = { sm: 52, md: 80, lg: 132 };

const SCHEDULE_WORDS = {
  ON_TRACK: 'Ongoing',
  BEHIND: 'Behind schedule',
  COMPLETED: 'Completed',
};

// Progress ring.
//  - ink ring with the seal's two side dots frames it
//  - the arc is the real progress (azure; amber when behind, green when done)
//  - the gold tick is where the project should be by now, from its dates
//  - the number is the official percentage
export function ProgressRoundel({ value = 0, breakdown, size = 'md', className = '' }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const schedule = breakdown?.schedule;
  const expected = breakdown?.expected;
  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.md;
  const small = px < 64;

  const R = 34;
  const C = 2 * Math.PI * R;
  const arc =
    pct >= 100 || schedule === 'COMPLETED'
      ? GREEN
      : schedule === 'BEHIND'
          ? GOLD_DARK
          : AZURE;

  // Position of the "expected by now" tick, measured from 12 o'clock
  const showTick = expected != null && schedule && schedule !== 'COMPLETED';
  const theta = ((Math.max(0, Math.min(100, expected ?? 0)) / 100) * 360 - 90) * (Math.PI / 180);
  const tick = (r) => [50 + r * Math.cos(theta), 50 + r * Math.sin(theta)];
  const [tx1, ty1] = tick(27.5);
  const [tx2, ty2] = tick(41);

  const words = SCHEDULE_WORDS[schedule];
  const label = `${pct} percent complete${words ? `, ${words.toLowerCase()}` : ''}${
    showTick ? `, expected ${expected} percent by now` : ''
  }`;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      className={`shrink-0 ${className}`}
    >
      <circle cx="50" cy="50" r="47" fill="#fff" stroke={INK} strokeWidth="5" />
      <circle cx="50" cy="50" r={R} fill="none" stroke={TRACK} strokeWidth="11" />
      {pct > 0 && (
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={arc}
          strokeWidth="11"
          strokeDasharray={`${(C * pct) / 100} ${C}`}
          transform="rotate(-90 50 50)"
        />
      )}
      {/* the seal's two separator dots */}
      <circle cx="8" cy="50" r="2.3" fill={INK} />
      <circle cx="92" cy="50" r="2.3" fill={INK} />
      {showTick && (
        <>
          <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke={INK} strokeWidth="6" />
          <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke={GOLD} strokeWidth="3" />
        </>
      )}
      <text
        x="50"
        y="51"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Barlow Condensed', Barlow, sans-serif"
        fontWeight="700"
        fontSize={small ? (pct >= 100 ? 24 : 28) : pct >= 100 ? 25 : 30}
        fill={INK}
      >
        {pct}
        {/* At the smallest size the percent sign would touch the ring, so it is dropped */}
        {!small && (
          <tspan fontSize="15" dy="-6" fontWeight="600">
            %
          </tspan>
        )}
      </text>
    </svg>
  );
}

// The words that go with a roundel: how the project stands against its dates.
export function ScheduleWords({ breakdown, className = '' }) {
  const schedule = breakdown?.schedule;
  const words = SCHEDULE_WORDS[schedule];
  if (!words) return null;
  const tone = {
    ON_TRACK: 'text-brand-700',
    BEHIND: 'text-amber-700',
    COMPLETED: 'text-green-700',
  }[schedule];
  const dot = {
    ON_TRACK: 'bg-brand-500',
    BEHIND: 'bg-accent-500',
    COMPLETED: 'bg-green-600',
  }[schedule];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${tone} ${className}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {words}
    </span>
  );
}

const RIBBON_TONE = {
  PROPOSED: 'bg-slate-600 text-white',
  PLANNING: 'bg-brand-600 text-white',
  ONGOING: 'bg-accent-500 text-ink',
  COMPLETED: 'bg-green-600 text-white',
  CANCELLED: 'bg-red-600 text-white',
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
