'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReplayMeta } from '@/lib/replay-events';
import { type Speed } from './shortcuts-and-speed';

export type PlayerStatus = 'loading' | 'ready' | 'error' | 'empty' | 'unsupported';
const SKIP_MS = 10_000;

interface ReplayerLike {
  play(offset?: number): void;
  pause(offset?: number): void;
  getCurrentTime(): number;
  setConfig(c: { speed: number }): void;
  destroy?: () => void;
  $destroy?: () => void;
}

/** Scale rrweb's recorded-size wrapper to fit our container, centered. Recorded
 *  dimensions come from the Meta event; if a session has none, fall back to the
 *  size rrweb gave the iframe. Returns false when nothing is measurable yet.
 *  Called synchronously right after pause() so the first painted frame is already
 *  fitted (otherwise the native-size recording flashes "zoomed in" each rebuild),
 *  and again from a ResizeObserver on later size changes. */
function fitStage(mount: HTMLElement, meta: ReplayMeta): boolean {
  const wrapper = mount.querySelector('.replayer-wrapper') as HTMLElement | null;
  const iframe = wrapper?.querySelector('iframe');
  if (!wrapper) return false;
  const w = meta.width || iframe?.offsetWidth || 0;
  const h = meta.height || iframe?.offsetHeight || 0;
  if (!w || !h || !mount.clientWidth || !mount.clientHeight) return false;
  const scale = Math.min(mount.clientWidth / w, mount.clientHeight / h, 1);
  wrapper.style.transform = `translate(-50%, -50%) scale(${scale})`;
  wrapper.style.position = 'absolute';
  wrapper.style.left = '50%';
  wrapper.style.top = '50%';
  return true;
}

/**
 * Drives rrweb's low-level Replayer. Mounts it into `mountRef`, advances a playhead
 * via requestAnimationFrame, and exposes imperative controls. All playback chrome
 * (control bar, timeline) is our own - rrweb only reconstructs the DOM.
 */
export function useReplayer(
  events: unknown[],
  meta: ReplayMeta,
  mountRef: React.RefObject<HTMLDivElement | null>,
) {
  const [status, setStatus] = useState<PlayerStatus>('loading');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0); // ms offset
  const [speed, setSpeedState] = useState<Speed>(1);
  const [errorMsg, setErrorMsg] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const replayerRef = useRef<ReplayerLike | null>(null);
  const rafRef = useRef<number | null>(null);
  // Read by the init effect without retriggering it: reload keeps the chosen speed.
  const speedRef = useRef<Speed>(1);
  speedRef.current = speed;
  // Read by the init effect to restore the playhead on reload (without retriggering).
  const timeRef = useRef(0);
  timeRef.current = time;
  const total = meta.totalTime;

  // --- init / teardown ---
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (!meta.replayable) { setStatus('empty'); return; }

    let cancelled = false;
    setStatus('loading');

    void import('rrweb')
      .then(({ Replayer }) => {
        if (cancelled || !mount) return;
        mount.innerHTML = '';
        try {
          const replayer = new Replayer(events as never, {
            root: mount,
            speed: speedRef.current,
            skipInactive: false,
            showWarning: false,
            // A short, fading trail behind the cursor. The warm tone is a fixed
            // rgba because the trail is canvas-drawn and cannot read a CSS var.
            mouseTail: { duration: 360, lineCap: 'round', lineWidth: 4, strokeStyle: 'rgba(255, 138, 76, 0.5)' },
          }) as unknown as ReplayerLike;
          // Render a frame immediately - the Replayer constructor alone leaves the
          // stage blank until play()/pause() is called. Restores the prior playhead
          // (paused) on a reload instead of jumping to 0.
          replayer.pause(Math.min(timeRef.current, total));
          // pause() has already built and sized the DOM, so scale NOW - before the
          // stage is revealed - so the recording never flashes at native size.
          fitStage(mount, meta);
          replayerRef.current = replayer;
          setStatus('ready');
          setPlaying(false);
        } catch {
          if (!cancelled) { setErrorMsg('TinyReplay could not rebuild this recording. It may be missing its first event batch.'); setStatus('unsupported'); }
        }
      })
      .catch(() => {
        if (!cancelled) { setErrorMsg('TinyReplay could not load the replay engine. Check the connection and try again.'); setStatus('error'); }
      });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const r = replayerRef.current;
      r?.$destroy?.();
      r?.destroy?.();
      replayerRef.current = null;
      if (mount) mount.innerHTML = '';
    };
  }, [events, meta.replayable, mountRef, reloadKey, total]);

  /** Re-run the init effect against the same mount node (powers "Try again"). */
  const reload = useCallback(() => {
    setTime(0);
    setPlaying(false);
    setReloadKey((k) => k + 1);
  }, []);

  // Keep the fit current when the container resizes (the synchronous fit in init
  // already handles the initial paint). Observe the iframe too: the container
  // doesn't resize on a record switch, so it alone would miss a late iframe size.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || status !== 'ready') return;
    const fit = () => fitStage(mount, meta);
    const ro = new ResizeObserver(fit);
    ro.observe(mount);
    const iframe = mount.querySelector('.replayer-wrapper iframe');
    if (iframe) ro.observe(iframe);
    fit();
    return () => ro.disconnect();
  }, [status, meta, mountRef]);

  // --- playhead loop ---
  const tick = useCallback(() => {
    const r = replayerRef.current;
    if (!r) return;
    const current = Math.min(r.getCurrentTime(), total);
    setTime(current);
    if (current >= total) { setPlaying(false); return; }
    rafRef.current = requestAnimationFrame(tick);
  }, [total]);

  const play = useCallback((at?: number) => {
    const r = replayerRef.current;
    if (!r) return;
    // At (or past) the end with no explicit target, restart from the beginning.
    const resume = time >= total ? 0 : time;
    const from = at !== undefined ? at : resume;
    r.play(Math.min(from, total));
    if (from !== time) setTime(from);
    setPlaying(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick, time, total]);

  const pause = useCallback(() => {
    const r = replayerRef.current;
    if (!r) return;
    r.pause();
    setPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const toggle = useCallback(() => { (playing ? pause : play)(); }, [playing, pause, play]);

  const seek = useCallback((ms: number) => {
    const r = replayerRef.current;
    if (!r || total <= 0) return;
    const clamped = Math.max(0, Math.min(ms, total));
    setTime(clamped);
    if (playing) { r.play(clamped); } else { r.pause(clamped); }
  }, [playing, total]);

  const skip = useCallback((delta: number) => seek(time + delta), [seek, time]);
  const skipForward = useCallback(() => skip(SKIP_MS), [skip]);
  const skipBack = useCallback(() => skip(-SKIP_MS), [skip]);

  const setSpeed = useCallback((s: Speed) => {
    setSpeedState(s);
    replayerRef.current?.setConfig({ speed: s });
  }, []);

  return {
    status, errorMsg, playing, time, total, speed,
    play, pause, toggle, seek, skipForward, skipBack, setSpeed, reload,
  };
}
