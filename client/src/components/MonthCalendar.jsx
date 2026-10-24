import { dayKey } from '../utils/format';
import EventTypeIcon from './EventTypeIcon';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// A wall-calendar month grid: big condensed day numerals, Sundays in red, today
// circled in the seal's gold and ink. Days with events show them as chips.
// Props: year, month (0-11), events (array), onSelectDay(dateKey), selectedDay.
export default function MonthCalendar({
  year,
  month,
  events = [],
  onSelectDay,
  selectedDay,
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayK = dayKey(new Date());

  // Group events by their day key.
  const byDay = {};
  events.forEach((e) => {
    const k = dayKey(new Date(e.startAt));
    if (!byDay[k]) byDay[k] = [];
    byDay[k].push(e);
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`py-1 font-display text-sm font-bold uppercase tracking-wide ${
              i === 0 ? 'text-red-700' : 'text-slate-600'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={`empty-${i}`} className="h-14 sm:h-24" />;
          const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dayEvents = byDay[k] || [];
          const isToday = k === todayK;
          const isSelected = k === selectedDay;
          const isSunday = (firstDay + d - 1) % 7 === 0;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelectDay && onSelectDay(k)}
              aria-pressed={isSelected}
              aria-label={`${MONTHS[month]} ${d}${dayEvents.length ? `, ${dayEvents.length} events` : ''}`}
              className={`flex h-14 flex-col items-start rounded-lg border p-1 text-left transition-colors sm:h-24 sm:p-1.5 ${
                isSelected
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span
                className={`flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 font-display text-lg font-bold leading-none ${
                  isToday
                    ? 'bg-accent-500 text-ink ring-2 ring-ink'
                    : isSunday
                      ? 'text-red-700'
                      : 'text-slate-800'
                }`}
              >
                {d}
              </span>

              {/* Phones: dots. Wider screens: the event titles. */}
              {dayEvents.length > 0 && (
                <span className="mt-auto flex gap-0.5 sm:hidden" aria-hidden="true">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span key={e.id} className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                  ))}
                </span>
              )}
              <div className="mt-1 hidden w-full flex-col gap-0.5 sm:flex">
                {dayEvents.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    className="flex w-full items-center gap-1 truncate rounded bg-brand-100 px-1 py-px text-xs font-semibold text-brand-800"
                    title={e.title}
                  >
                    <EventTypeIcon type={e.type} size={12} />
                    <span className="truncate">{e.title}</span>
                  </span>
                ))}
                {dayEvents.length > 2 && (
                  <span className="text-xs font-semibold text-slate-600">
                    +{dayEvents.length - 2} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { MONTHS };
