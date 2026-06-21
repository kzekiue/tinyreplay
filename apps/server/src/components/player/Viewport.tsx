'use client';

import { GlobeIcon, AlertIcon } from '@/components/icons';
import type { PlayerStatus } from './use-replayer';

/** The smoked-glass stage the Replayer mounts into. rrweb scales its own iframe to
 *  fit; we frame it and center it. A status lamp on the rail tracks playback, and
 *  the honest current URL reads out beside it - no fake browser chrome. Overlays
 *  cover loading and the empty / unsupported / error terminal states. */
export function Viewport({
  mountRef, status, errorMsg, currentUrl, playing, onRetry, actions,
}: {
  mountRef: React.RefObject<HTMLDivElement | null>;
  status: PlayerStatus;
  errorMsg: string;
  currentUrl: string;
  playing: boolean;
  onRetry: () => void;
  actions?: React.ReactNode;
}) {
  const ready = status === 'ready';
  const OVERLAY_TITLE: Record<'empty' | 'unsupported' | 'error', string> = {
    empty: 'No replayable events',
    unsupported: "Recording can't be replayed",
    error: 'Replay engine failed',
  };
  const overlayTitle =
    status === 'empty' || status === 'unsupported' || status === 'error'
      ? OVERLAY_TITLE[status]
      : '';
  return (
    <>
      <div className="stage-rail">
        <span className={`vp-status${ready && playing ? ' is-live' : ''}`}>
          <span className="vp-dot" aria-hidden="true" />
          {ready && playing ? 'Playing' : 'Paused'}
        </span>
        <span className="url">
          <GlobeIcon size={13} style={{ flexShrink: 0 }} />
          <span>{currentUrl || '-'}</span>
        </span>
        {actions}
      </div>

      <div className="stage-viewport">
        <div ref={mountRef} className={`stage-mount${ready ? ' is-ready' : ''}`} />

        {status === 'loading' && (
          <div className="stage-overlay">
            <span className="loading-bar" aria-hidden="true" />
            <p className="mono" style={{ fontSize: '0.75rem' }}>Rebuilding replay…</p>
          </div>
        )}

        {(status === 'empty' || status === 'unsupported' || status === 'error') && (
          <div className="stage-overlay" role="alert">
            <AlertIcon size={22} />
            <h2>{overlayTitle}</h2>
            <p>
              {status === 'empty'
                ? 'This session ended before TinyReplay captured enough events to rebuild the page.'
                : errorMsg}
            </p>
            {status === 'error' && (
              <button type="button" className="btn" onClick={onRetry} style={{ marginTop: '0.25rem' }}>
                Reload replay
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
