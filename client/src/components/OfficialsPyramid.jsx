import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import OfficialAvatar from './OfficialAvatar';

// The Sangguniang Kabataan Officials as a 3-level pyramid:
//   top:    the SK Chairperson (centered)
//   middle: the SK Secretary and the SK Treasurer (side by side)
//   bottom: the SK Kagawads (side by side, wrapping to more rows when needed)
// Every card is the same size. The connecting lines are drawn from the cards' real
// positions (measured after layout), so they stay right when a row wraps or, on a phone,
// when the levels stack. Used on the public SK Officials page and in Settings.

const isChair = (o) => /chair/i.test(o.position || '');
const isSecretary = (o) => /secretary/i.test(o.position || '');
const isTreasurer = (o) => /treasurer/i.test(o.position || '');

export function pyramidLevels(officials) {
  const top = officials.filter(isChair);
  const middle = [...officials.filter(isSecretary), ...officials.filter((o) => !isSecretary(o) && isTreasurer(o))];
  const bottom = officials.filter((o) => !isChair(o) && !isSecretary(o) && !isTreasurer(o));
  return [top, middle, bottom].filter((level) => level.length > 0);
}

function OfficialCard({ official }) {
  return (
    <article
      data-card
      className="card flex h-48 w-40 flex-col items-center justify-start px-3 pt-5 text-center"
      aria-label={`${official.name}, ${official.position}`}
    >
      <OfficialAvatar
        official={official}
        className="h-20 w-20 ring-2 ring-line"
        letterClass="font-display text-3xl text-pine"
      />
      <p className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{official.name}</p>
      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-slate-600">{official.position}</p>
    </article>
  );
}

const STUB = 14; // px: short line between a card and its horizontal bar
const RAIL = 14; // px: the side rail sits this far left of a wrapped level

// Line segments joining one level (parents) to the next (children). Rects are relative to
// the pyramid box. Wrapped child rows each get a bar, joined by a rail on their left side.
function connect(parents, children) {
  const segs = [];
  const cx = (r) => r.left + r.width / 2;
  // Parents: one card, or a bar under several cards; the line starts at its middle.
  const pBottom = Math.max(...parents.map((r) => r.bottom));
  let ax = (Math.min(...parents.map(cx)) + Math.max(...parents.map(cx))) / 2;
  let ay = pBottom;
  if (parents.length > 1) {
    ay = pBottom + STUB;
    parents.forEach((r) => segs.push([cx(r), r.bottom, cx(r), ay]));
    segs.push([Math.min(...parents.map(cx)), ay, Math.max(...parents.map(cx)), ay]);
  }
  // Children grouped into rows (cards that share a top).
  const rows = [];
  [...children].sort((a, b) => a.top - b.top || a.left - b.left).forEach((r) => {
    const row = rows.find((x) => Math.abs(x[0].top - r.top) < 4);
    if (row) row.push(r);
    else rows.push([r]);
  });
  const railX = Math.min(...children.map((r) => r.left)) - RAIL;
  const busYs = rows.map((row) => row[0].top - STUB);
  rows.forEach((row, i) => {
    const xs = row.map(cx);
    let from = Math.min(...xs);
    let to = Math.max(...xs);
    if (i === 0) {
      from = Math.min(from, ax);
      to = Math.max(to, ax);
    }
    if (rows.length > 1) from = Math.min(from, railX);
    if (to > from) segs.push([from, busYs[i], to, busYs[i]]);
    row.forEach((r) => segs.push([cx(r), busYs[i], cx(r), r.top]));
  });
  segs.push([ax, ay, ax, busYs[0]]);
  if (rows.length > 1) segs.push([railX, busYs[0], railX, busYs[busYs.length - 1]]);
  return segs;
}

export default function OfficialsPyramid({ officials }) {
  const levels = pyramidLevels(officials);
  const boxRef = useRef(null);
  const [lines, setLines] = useState({ segs: [], w: 0, h: 0 });

  const measure = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    const origin = box.getBoundingClientRect();
    const rectsOf = (el) =>
      [...el.querySelectorAll('[data-card]')].map((c) => {
        const r = c.getBoundingClientRect();
        return { left: r.left - origin.left, top: r.top - origin.top, width: r.width, bottom: r.bottom - origin.top };
      });
    const groups = [...box.querySelectorAll('[data-level]')].map(rectsOf).filter((g) => g.length);
    const segs = [];
    for (let i = 0; i + 1 < groups.length; i++) segs.push(...connect(groups[i], groups[i + 1]));
    setLines({ segs, w: origin.width, h: origin.height });
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [measure, officials]);

  return (
    <div ref={boxRef} className="relative mx-auto flex w-full flex-col items-center gap-14 py-2">
      <svg
        className="pointer-events-none absolute inset-0"
        width={lines.w}
        height={lines.h}
        aria-hidden="true"
      >
        {lines.segs.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#B9AE99" strokeWidth="2" strokeLinecap="square" />
        ))}
      </svg>
      {levels.map((level, i) => (
        <div
          key={i}
          data-level
          className="relative flex w-full flex-col items-center gap-10 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-5 sm:gap-y-10"
        >
          {level.map((o) => (
            <OfficialCard key={o.id} official={o} />
          ))}
        </div>
      ))}
    </div>
  );
}
