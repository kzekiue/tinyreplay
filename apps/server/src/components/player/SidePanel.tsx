'use client';

import { memo, useState } from 'react';
import type { ReplayEntry } from '@/lib/replay-events';
import type { SessionRow } from '@/lib/queries';
import { ActivityPanel, ConsolePanel, NetworkPanel, ErrorsPanel } from './panels';
import { MetadataPanel } from './MetadataPanel';

function count(entries: ReplayEntry[], kind: ReplayEntry['kind']) {
  return entries.reduce((n, e) => n + (e.kind === kind ? 1 : 0), 0);
}

type Tab = 'activity' | 'console' | 'network' | 'errors' | 'meta';

/** Right-hand tabbed inspector. Tab labels carry live counts so the user sees at a
 *  glance what the session holds. Memoized: the playhead updates parent state every
 *  frame, but this tree only re-renders when the active entry actually changes. */
export const SidePanel = memo(function SidePanel({
  entries, activeIndex, onSeek, session,
}: {
  entries: ReplayEntry[];
  activeIndex: number;
  onSeek: (t: number) => void;
  session: SessionRow;
}) {
  const [tab, setTab] = useState<Tab>('activity');
  const errors = count(entries, 'error');
  const net = count(entries, 'network');
  const logs = count(entries, 'console');

  const tabBtn = (id: Tab, label: string, n?: number, danger?: boolean) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      className="tab"
      onClick={() => setTab(id)}
    >
      {label}
      {n ? <span className={`count${danger ? ' is-danger' : ''}`}>{n}</span> : null}
    </button>
  );

  return (
    <div className="inspector">
      <div className="tabs" role="tablist" aria-label="Session inspector">
        {tabBtn('activity', 'Activity')}
        {tabBtn('console', 'Console', logs)}
        {tabBtn('network', 'Network', net)}
        {tabBtn('errors', 'Errors', errors, true)}
        {tabBtn('meta', 'Metadata')}
      </div>

      <div className="panel" role="tabpanel">
        {tab === 'activity' && <ActivityPanel entries={entries} activeIndex={activeIndex} onSeek={onSeek} />}
        {tab === 'console' && <ConsolePanel entries={entries} activeIndex={activeIndex} onSeek={onSeek} />}
        {tab === 'network' && <NetworkPanel entries={entries} activeIndex={activeIndex} onSeek={onSeek} />}
        {tab === 'errors' && <ErrorsPanel entries={entries} activeIndex={activeIndex} onSeek={onSeek} />}
        {tab === 'meta' && <MetadataPanel session={session} />}
      </div>
    </div>
  );
});
