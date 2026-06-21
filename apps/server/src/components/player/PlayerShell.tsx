'use client';

// rrweb's replayer stylesheet: positions .replayer-wrapper and draws the recorded
// mouse cursor. Without it the reconstructed iframe sits unanchored.
import 'rrweb/dist/style.css';

import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { PanelRightIcon, CloseIcon } from '@/components/icons';
import type { SessionRow } from '@/lib/queries';
import { parseReplay } from '@/lib/replay-events';
import { useReplayer } from './use-replayer';
import { SPEEDS, type Speed } from './shortcuts-and-speed';
import { useShortcuts } from './shortcuts';
import { Viewport } from './Viewport';
import { ControlBar } from './ControlBar';
import { SidePanel } from './SidePanel';
import { SharePopover } from './share-popover';

const PANEL_MIN_W = 300;
const PANEL_MAX_W = 640;
const PANEL_STEP = 24;

const clampPanelWidth = (width: number) => Math.max(PANEL_MIN_W, Math.min(PANEL_MAX_W, width));

/** Full console: smoked-glass stage + tactile transport, with a resizable inspector
 *  on the right (a custom slide-in sheet on mobile / theater). `useReplayer.reload()`
 *  powers "Try again". */
export function PlayerShell({ events, session }: { events: unknown[]; session: SessionRow }) {
  // parseReplay sorts by timestamp and drops malformed entries; rrweb MUST be fed
  // THIS sanitized stream (not the raw prop), or its playback baseline drifts from
  // our timeline and a stray bad event throws mid-replay.
  const { meta, entries, events: replayEvents } = useMemo(() => parseReplay(events), [events]);
  const mountRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [theater, setTheater] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [panelW, setPanelW] = useState(380);

  const r = useReplayer(replayEvents, meta, mountRef);

  // Pointer-drag to resize the inspector. The panel is on the right, so dragging
  // the divider left widens it. Deliberately not a 3rd-party panel library.
  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = panelW;
      const onMove = (ev: PointerEvent) =>
        setPanelW(clampPanelWidth(startW + (startX - ev.clientX)));
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [panelW],
  );

  const onResizeKey = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setPanelW((w) => clampPanelWidth(w + PANEL_STEP));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setPanelW((w) => clampPanelWidth(w - PANEL_STEP));
        break;
      case 'Home':
        e.preventDefault();
        setPanelW(PANEL_MIN_W);
        break;
      case 'End':
        e.preventDefault();
        setPanelW(PANEL_MAX_W);
        break;
    }
  }, []);

  // active entry = last entry at or before the playhead
  const activeIndex = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < entries.length; i++) { if (entries[i].t <= r.time) idx = i; else break; }
    return idx;
  }, [entries, r.time]);

  // current URL follows the latest route entry before the playhead
  const currentUrl = useMemo(() => {
    let url = meta.entryUrl;
    for (const e of entries) { if (e.t <= r.time && e.kind === 'route') url = e.url; else if (e.t > r.time) break; }
    return url;
  }, [entries, r.time, meta.entryUrl]);

  const speedUp = useCallback(() => r.setSpeed(nextSpeed(r.speed, 1)), [r]);
  const speedDown = useCallback(() => r.setSpeed(nextSpeed(r.speed, -1)), [r]);
  const handlers = useMemo(() => ({
    toggle: r.toggle, skipForward: r.skipForward, skipBack: r.skipBack,
    speedUp, speedDown, toggleTheater: () => setTheater((v) => !v), exitTheater: () => setTheater(false),
  }), [r.toggle, r.skipForward, r.skipBack, speedUp, speedDown]);
  useShortcuts(handlers, r.status === 'ready');

  // A shared link can carry ?t=<ms>; jump there once playback is ready.
  const searchParams = useSearchParams();
  const seekedRef = useRef(false);
  useEffect(() => {
    if (r.status !== 'ready' || seekedRef.current) return;
    const t = Number(searchParams.get('t'));
    if (Number.isFinite(t) && t > 0) r.seek(t);
    seekedRef.current = true;
  }, [r.status, searchParams, r]);

  const stage = (
    <div className="player-stage">
      <Viewport
        mountRef={mountRef}
        status={r.status}
        errorMsg={r.errorMsg}
        currentUrl={currentUrl}
        playing={r.playing}
        onRetry={r.reload}
        actions={<SharePopover sessionId={session.id} time={r.time} events={events} />}
      />
      <ControlBar
        playing={r.playing} time={r.time} total={r.total} speed={r.speed} entries={entries} theater={theater}
        onToggle={r.toggle} onSkipBack={r.skipBack} onSkipForward={r.skipForward}
        onSeek={r.seek} onSpeed={r.setSpeed} onTheater={() => setTheater((v) => !v)}
      />
    </div>
  );

  const panel = <SidePanel entries={entries} activeIndex={activeIndex} onSeek={r.seek} session={session} />;

  // Inspector docks beside the stage on desktop; on mobile/theater it moves into a
  // slide-in sheet reached via the Details button.
  const overlay = isMobile || theater;

  // ONE tree for every layout. `stage` is always the first child, so React keeps
  // the rrweb mount node's DOM identity when theater/mobile toggles - the player no
  // longer tears down and restarts. Layout is driven entirely by CSS classes.
  return (
    <div className={theater ? 'theater' : 'player'} data-overlay={overlay || undefined}>
      {stage}
      {!overlay && (
        <div
          onPointerDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector"
          aria-valuemin={PANEL_MIN_W}
          aria-valuemax={PANEL_MAX_W}
          aria-valuenow={panelW}
          aria-valuetext={`${panelW}px wide`}
          tabIndex={0}
          className="resizer"
          onKeyDown={onResizeKey}
        />
      )}
      {!overlay && (
        <div className="inspector-slot" style={{ width: panelW }}>
          {panel}
        </div>
      )}
      {overlay && (
        <div className="panel-toggle">
          <button type="button" className="btn" onClick={() => setSheetOpen(true)}>
            <PanelRightIcon size={14} /> Details
          </button>
        </div>
      )}
      {overlay && sheetOpen ? <PanelSheet onClose={() => setSheetOpen(false)}>{panel}</PanelSheet> : null}
    </div>
  );
}

/** Lightweight slide-in sheet - no dialog library. Locks scroll, closes on
 *  backdrop click or Escape. */
function PanelSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Session inspector">
        <div className="sheet-head">
          <span className="label">Inspector</span>
          <button type="button" className="ctl" onClick={onClose} aria-label="Close">
            <CloseIcon size={16} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>{children}</div>
      </div>
    </>
  );
}

function nextSpeed(current: Speed, dir: 1 | -1): Speed {
  const i = SPEEDS.indexOf(current);
  const ni = Math.max(0, Math.min(SPEEDS.length - 1, i + dir));
  return SPEEDS[ni];
}
