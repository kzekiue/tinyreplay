'use client';

import { memo } from 'react';
import { formatClock } from '@/lib/format';
import type { ReplayEntry } from '@/lib/replay-events';
import { viewEntry } from './entry-meta';

/** One event row in the inspector: time · icon · label · detail. Click seeks the
 *  playhead there. `active` highlights the row the playhead currently sits on.
 *  Memoized so long lists only repaint the two rows whose `active` flag flipped. */
export const EntryRow = memo(function EntryRow({
  entry, active, onSeek,
}: {
  entry: ReplayEntry;
  active: boolean;
  onSeek: (t: number) => void;
}) {
  const v = viewEntry(entry);
  return (
    <button
      type="button"
      onClick={() => onSeek(entry.t)}
      className={`entry-row${active ? ' is-active' : ''}`}
    >
      <span className="time">{formatClock(entry.t)}</span>
      <span className={`ico ${v.tone}`}>{v.icon}</span>
      <span className="what">{v.label}</span>
      {v.detail ? <span className="detail">{v.detail}</span> : null}
    </button>
  );
});
