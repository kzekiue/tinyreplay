'use client';

import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/* One loop length drives the whole unit: the cursor walks the screen while the
   playhead crosses the track, so the event ticks line up with the clicks. */
const T = 7;
const EVENTS = [0.12, 0.34, 0.56, 0.8] as const; // click moments == tick positions

/* Cursor path through the replayed app: idle, nav, card, field, button, idle. */
const STOPS = {
  t: [0, ...EVENTS, 1],
  left: ['17%', '67%', '29%', '57%', '79%', '17%'],
  top: ['31%', '17%', '57%', '71%', '85%', '31%'],
};

function Bar({ w, className }: { w: string; className?: string }) {
  return (
    <span
      className={cn('block h-1.5 rounded-[1px] bg-[var(--line-strong)]', className)}
      style={{ width: w }}
    />
  );
}

export function ReplayDevice({ className }: { className?: string }) {
  const reduced = useReducedMotion();

  return (
    <div
      className={cn(
        'tr-raise-2 overflow-hidden rounded-[var(--radius-lg)]',
        className,
      )}
    >
      {/* Faceplate header */}
      <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-3.5 py-2.5">
        <span className="tr-label normal-case tracking-normal text-[var(--ink-2)]">
          replay
        </span>
        <span className="tr-label text-[var(--faint)]">session 4f2a9c</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="tr-lcd flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 font-mono text-[0.66rem]">
            <i className="size-1.5 rounded-full bg-[var(--danger)] shadow-[0_0_6px_var(--danger)]" />
            REC
          </span>
          <i className="tr-screw" aria-hidden />
        </span>
      </div>

      {/* Recessed glass screen: the session being replayed */}
      <div className="bg-[var(--inset)] p-3 shadow-[var(--track)]">
        <div className="tr-well relative flex aspect-[16/10] flex-col overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface)]">
          {/* browser chrome */}
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5">
            <span className="flex gap-1" aria-hidden>
              <i className="size-1.5 rounded-full bg-[var(--line-strong)]" />
              <i className="size-1.5 rounded-full bg-[var(--line-strong)]" />
              <i className="size-1.5 rounded-full bg-[var(--line-strong)]" />
            </span>
            <span className="tr-well rounded-[3px] px-2 py-[3px] font-mono text-[0.6rem] text-[var(--faint)]">
              app.acme.io/checkout
            </span>
          </div>

          {/* page body (wireframe) */}
          <div className="relative flex-1 p-3">
            {/* top nav */}
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-[2px] bg-[var(--accent-line)]" />
              <span className="ml-auto flex gap-2">
                <Bar w="22px" />
                <Bar w="22px" />
                <span className="block h-1.5 w-[22px] rounded-[1px] bg-[var(--accent-line)]" />
              </span>
            </div>

            {/* heading */}
            <div className="mt-4 space-y-1.5">
              <Bar w="62%" className="h-2" />
              <Bar w="40%" className="h-2 bg-[var(--line)]" />
            </div>

            {/* columns: copy + card */}
            <div className="mt-4 flex gap-3">
              <div className="flex-1 space-y-1.5 pt-0.5">
                <Bar w="100%" className="bg-[var(--line)]" />
                <Bar w="92%" className="bg-[var(--line)]" />
                <Bar w="78%" className="bg-[var(--line)]" />
              </div>
              <div className="tr-well grid w-[34%] place-items-center rounded-[3px] py-3">
                <Bar w="60%" className="bg-[var(--line-strong)]" />
              </div>
            </div>

            {/* masked field - privacy, on screen */}
            <div className="mt-3 flex items-center gap-2">
              <div className="tr-well flex flex-1 items-center rounded-[3px] px-2 py-1.5 font-mono text-[0.62rem] tracking-[0.25em] text-[var(--faint)]">
                ••••••••••
              </div>
              <span className="rounded-[3px] bg-[var(--accent)] px-3 py-1.5 text-[0.6rem] font-medium text-[oklch(99%_0.02_60)] shadow-[var(--raise-1)]">
                Pay
              </span>
            </div>
          </div>

          {/* the replayed cursor */}
          {reduced ? (
            <span
              className="absolute left-[57%] top-[71%] size-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_10px_2px_var(--accent-line)]"
              aria-hidden
            />
          ) : (
            <motion.span
              aria-hidden
              className="absolute z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_10px_2px_var(--accent-line)]"
              animate={{ left: STOPS.left, top: STOPS.top }}
              transition={{
                duration: T,
                times: STOPS.t,
                ease: 'easeInOut',
                repeat: Infinity,
              }}
            >
              <motion.span
                className="absolute inset-0 rounded-full ring-1 ring-[var(--accent)]"
                animate={{ scale: [1, 1, 2.4, 1, 2.4, 1, 2.4, 1, 2.4, 1, 1], opacity: [0, 0, 0.7, 0, 0.7, 0, 0.7, 0, 0.7, 0, 0] }}
                transition={{
                  duration: T,
                  times: [0, 0.1, 0.16, 0.22, 0.36, 0.42, 0.56, 0.62, 0.8, 0.86, 1],
                  repeat: Infinity,
                }}
              />
            </motion.span>
          )}
        </div>
      </div>

      {/* Scrubber */}
      <div className="space-y-2.5 border-t border-[var(--line)] bg-[var(--panel)] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="tr-lcd rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-[0.66rem] tabular-nums">
            00:54
          </span>
          {/* milled track with event ticks + playhead */}
          <div className="tr-track relative h-2 flex-1 rounded-[var(--radius-pill)]">
            {EVENTS.map((e) => (
              <i
                key={e}
                className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-line)]"
                style={{ left: `${e * 100}%` }}
                aria-hidden
              />
            ))}
            {reduced ? (
              <span className="absolute left-[57%] top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-line)]" />
            ) : (
              <motion.span
                className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-line)]"
                animate={{ left: ['2%', '98%'] }}
                transition={{ duration: T, ease: 'easeInOut', repeat: Infinity }}
              />
            )}
          </div>
          <span className="tr-lcd rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-[0.66rem] tabular-nums text-[var(--faint)]">
            02:18
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="tr-key grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-2)]">
            {/* pause - it's playing */}
            <span className="flex gap-[3px]" aria-hidden>
              <i className="h-2.5 w-[3px] rounded-[1px] bg-current" />
              <i className="h-2.5 w-[3px] rounded-[1px] bg-current" />
            </span>
          </span>
          <span className="tr-lcd rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-[0.66rem]">
            1×
          </span>
          <span className="tr-label text-[var(--faint)]">318 events</span>
          <span className="ml-auto tr-label text-[var(--faint)]">
            wal · sqlite
          </span>
        </div>
      </div>
    </div>
  );
}
