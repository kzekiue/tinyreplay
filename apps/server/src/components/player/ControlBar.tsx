'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon, ExpandIcon, ShrinkIcon, KeyboardIcon,
} from '@/components/icons';
import { formatClock } from '@/lib/format';
import { Timeline } from './Timeline';
import { SHORTCUTS, type Speed, SPEEDS } from './shortcuts-and-speed';
import type { ReplayEntry } from '@/lib/replay-events';

/** Bottom transport deck: play/pause · skip · time · tape timeline · speed switch ·
 *  theater · help. Every control wired to a real handler. Below 720px the timeline
 *  takes its own full-width row so the scrub track never collapses. */
export function ControlBar({
  playing, time, total, speed, entries, theater,
  onToggle, onSkipBack, onSkipForward, onSeek, onSpeed, onTheater,
}: {
  playing: boolean;
  time: number;
  total: number;
  speed: Speed;
  entries: ReplayEntry[];
  theater: boolean;
  onToggle: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onSeek: (ms: number) => void;
  onSpeed: (s: Speed) => void;
  onTheater: () => void;
}) {
  return (
    <div className="player-controls">
      <button
        type="button"
        className="ctl ctl-primary"
        data-playing={playing}
        onClick={onToggle}
        aria-label={playing ? 'Pause' : 'Play'}
        title={playing ? 'Pause (Space)' : 'Play (Space)'}
      >
        {playing ? <PauseIcon size={16} /> : <PlayIcon size={15} />}
      </button>

      <button type="button" className="ctl" onClick={onSkipBack} aria-label="Skip back 10 seconds" title="Back 10s (←)">
        <SkipBackIcon size={16} />
      </button>
      <button type="button" className="ctl" onClick={onSkipForward} aria-label="Skip forward 10 seconds" title="Forward 10s (→)">
        <SkipForwardIcon size={16} />
      </button>

      <span className="clock">
        <strong>{formatClock(time)}</strong> / {formatClock(total)}
      </span>

      <div className="timeline-slot">
        <Timeline time={time} total={total} entries={entries} onSeek={onSeek} />
      </div>

      <span className="controls-right">
        <span className="speed-group" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className="speed-btn"
              aria-pressed={s === speed}
              onClick={() => onSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </span>

        <HelpPopover />

        <button type="button" className="ctl" onClick={onTheater} aria-label="Theater mode" title="Theater (F)">
          {theater ? <ShrinkIcon size={15} /> : <ExpandIcon size={15} />}
        </button>
      </span>
    </div>
  );
}

/** Self-contained keyboard-help popover - no menu library, closes on outside
 *  click or Escape. Hidden on coarse pointers where shortcuts are meaningless. */
function HelpPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="help-pop" ref={ref}>
      <button
        type="button"
        className="ctl"
        aria-label="Keyboard shortcuts"
        aria-expanded={open}
        title="Keyboard shortcuts"
        onClick={() => setOpen((v) => !v)}
      >
        <KeyboardIcon size={15} />
      </button>
      {open ? (
        <div className="help-card" role="dialog" aria-label="Keyboard shortcuts">
          <h3>Keyboard</h3>
          <ul>
            {SHORTCUTS.map((s) => (
              <li key={s.label}>
                {s.label} <span className="kbd">{s.keys}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
