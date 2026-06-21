'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ShareIcon, CopyIcon, CheckIcon, ClockIcon, DownloadIcon } from '@/components/icons';
import { formatClock } from '@/lib/format';

/** Session-contextual share menu. Native popover → renders in the top layer, so
 *  the stage's `overflow: hidden` can't clip it. Positioned to the trigger on
 *  open (no CSS anchor-positioning dependency). */
export function SharePopover({
  sessionId,
  time,
  events,
}: {
  sessionId: string;
  time: number;
  events: unknown[];
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<'link' | 'time' | null>(null);
  const popId = useId();

  // Position the popover under/right-aligned to the trigger each time it opens.
  useEffect(() => {
    const pop = popRef.current;
    const btn = btnRef.current;
    if (!pop || !btn) return;
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState !== 'open') return;
      const b = btn.getBoundingClientRect();
      pop.style.top = `${b.bottom + 6}px`;
      pop.style.left = `${Math.max(8, b.right - pop.offsetWidth)}px`;
    };
    pop.addEventListener('toggle', onToggle);
    return () => pop.removeEventListener('toggle', onToggle);
  }, []);

  const link = () => `${location.origin}/sessions/${sessionId}`;

  const copy = async (key: 'link' | 'time', url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(events)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tinyreplay-${sessionId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    popRef.current?.hidePopover();
  };

  return (
    <>
      <button ref={btnRef} type="button" className="vp-btn" popoverTarget={popId} aria-label="Share session">
        <ShareIcon size={14} />
      </button>
      <div ref={popRef} id={popId} popover="auto" className="share-pop">
        <button type="button" className="share-item" onClick={() => copy('link', link())}>
          {copied === 'link' ? <CheckIcon size={14} className="t-ok" /> : <CopyIcon size={14} />}
          Copy session link
        </button>
        <button type="button" className="share-item" onClick={() => copy('time', `${link()}?t=${Math.floor(time)}`)}>
          {copied === 'time' ? <CheckIcon size={14} className="t-ok" /> : <ClockIcon size={14} />}
          Copy link at {formatClock(time)}
        </button>
        <button type="button" className="share-item" onClick={exportJson}>
          <DownloadIcon size={14} />
          Export JSON
        </button>
      </div>
    </>
  );
}
