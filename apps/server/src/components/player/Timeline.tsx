'use client';

import { useMemo, useRef } from 'react';
import { formatClock } from '@/lib/format';
import type { ReplayEntry } from '@/lib/replay-events';
import { viewEntry } from './entry-meta';

/** Markers worth surfacing on the tape. Clicks/inputs are too frequent to pin
 *  individually - they live in the inspector; the timeline shows signal only. */
const MARKER_KINDS: ReplayEntry['kind'][] = ['route', 'rageclick', 'error', 'network'];

/** Scrubbable magnetic-tape timeline. The lit playhead tracks position; raised
 *  studs mark events and seek on click. Click/drag the tape to seek; it is a
 *  proper slider for keyboard users (arrows nudge 5s, Home/End jump). */
export function Timeline({
  time, total, entries, onSeek,
}: {
  time: number;
  total: number;
  entries: ReplayEntry[];
  onSeek: (ms: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = total > 0 ? Math.min(100, (time / total) * 100) : 0;

  const seekFromPointer = (clientX: number) => {
    const el = trackRef.current;
    if (!el || total <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * total);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (total <= 0) return;
    const step = 5000;
    switch (e.key) {
      case 'ArrowLeft': case 'ArrowDown': e.preventDefault(); onSeek(Math.max(0, time - step)); break;
      case 'ArrowRight': case 'ArrowUp': e.preventDefault(); onSeek(Math.min(total, time + step)); break;
      case 'Home': e.preventDefault(); onSeek(0); break;
      case 'End': e.preventDefault(); onSeek(total); break;
    }
  };

  const markers = useMemo(
    () => entries.filter((e) => MARKER_KINDS.includes(e.kind)),
    [entries],
  );

  return (
    <div
      ref={trackRef}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seekFromPointer(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons === 1) seekFromPointer(e.clientX); }}
      onKeyDown={onKeyDown}
      tabIndex={0}
      className="timeline"
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(time)}
      aria-valuetext={`${formatClock(time)} of ${formatClock(total)}`}
    >
      <div className="tape" aria-hidden="true" />
      <div className="progress" style={{ width: `${pct}%` }} aria-hidden="true" />

      {markers.map((e, i) => {
        const v = viewEntry(e);
        const left = total > 0 ? (e.t / total) * 100 : 0;
        return (
          <button
            key={i}
            type="button"
            onClick={(ev) => { ev.stopPropagation(); onSeek(e.t); }}
            onPointerDown={(ev) => ev.stopPropagation()}
            className={`timeline-marker ${v.marker}`}
            style={{ left: `${left}%` }}
            title={`${formatClock(e.t)} · ${v.label}${v.detail ? ` · ${v.detail}` : ''}`}
            aria-label={`${v.label} at ${formatClock(e.t)}`}
          />
        );
      })}

      <div className="playhead" style={{ left: `${pct}%` }} aria-hidden="true" />
    </div>
  );
}
