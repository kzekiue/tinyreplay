'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './icons';
import { nextRange } from '@/lib/date-range';

const PRESETS = [
  { value: '', label: 'Any time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const short = (s: string) => {
  const d = parse(s);
  return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}` : '';
};

/** The "Recorded" control: a tactile face that opens a mechanical tray with
 *  range presets and a one-month calendar. Range = pick a start day, then an end
 *  day. Everything is written back through the parent's filter handlers - this
 *  owns only which month is on screen and whether the tray is open. */
export function DateRangeControl({
  range, after, before, onPreset, onDates,
}: {
  range: string;
  after: string;
  before: string;
  onPreset: (v: string) => void;
  onDates: (after: string, before: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parse(after) ?? parse(before) ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // Face label reflects whichever mode is active.
  let label = 'Any time';
  if (range) label = PRESETS.find((p) => p.value === range)?.label ?? range;
  else if (after && before) label = `${short(after)} – ${short(before)}`;
  else if (after) label = `From ${short(after)}`;
  else if (before) label = `Until ${short(before)}`;
  const active = !!(range || after || before);

  // Build the 6×7 grid for the displayed month (leading days from prev month).
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const todayY = ymd(new Date());

  const pick = (d: Date) => onDates(...nextRange(after, before, ymd(d)));

  const inRange = (v: string) => after && before && v >= after && v <= before;
  const isEdge = (v: string) => v === after || v === before;

  return (
    <div className="daterange" ref={ref}>
      <button
        type="button"
        className={`dr-face${active ? ' is-set' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarIcon size={14} />
        <span className="dr-val">{label}</span>
        {active ? (
          <span
            className="dr-clear"
            role="button"
            tabIndex={0}
            aria-label="Clear date filter"
            onClick={(e) => { e.stopPropagation(); onPreset(''); onDates('', ''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onPreset(''); onDates('', ''); } }}
          >
            <CloseIcon size={12} />
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="dr-tray" role="dialog" aria-label="Recorded date range">
          <div className="dr-presets">
            {PRESETS.map((p) => (
              <button
                key={p.value || 'any'}
                type="button"
                className="dr-preset"
                aria-pressed={range === p.value && !after && !before}
                onClick={() => { onPreset(p.value); setOpen(false); }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="dr-cal">
            <div className="dr-cal-head">
              <button type="button" className="dr-nav" aria-label="Previous month"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                <ChevronLeftIcon size={15} />
              </button>
              <span className="dr-month">{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
              <button type="button" className="dr-nav" aria-label="Next month"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                <ChevronRightIcon size={15} />
              </button>
            </div>
            <div className="dr-dow">{DOW.map((d, i) => <span key={i}>{d}</span>)}</div>
            <div className="dr-grid">
              {days.map((d, i) => {
                const v = ymd(d);
                const out = d.getMonth() !== month.getMonth();
                const cls = [
                  'dr-day',
                  out ? 'is-out' : '',
                  v === todayY ? 'is-today' : '',
                  inRange(v) ? 'is-in' : '',
                  isEdge(v) ? 'is-edge' : '',
                ].filter(Boolean).join(' ');
                return (
                  <button key={i} type="button" className={cls} onClick={() => pick(d)}>
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
