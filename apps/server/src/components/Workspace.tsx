import type { ReactNode } from 'react';
import {
  searchSessions,
  countSearchSessions,
  countSessions,
  listProjectStats,
} from '@/lib/queries';
import { AppHeader } from './app-header';
import { SessionBrowser } from './SessionBrowser';
import { BenchState, type BenchKind } from './bench-state';

export const PAGE_SIZE = 50;

/** The unified console shell: faceplate, persistent session browser, and a main
 *  bench. With no recording selected the bench shows one of the BenchState
 *  cases (first-run / idle / no-results); a selected recording renders into
 *  `children`. */
export function Workspace({
  q = '',
  page = 1,
  selectedId,
  children,
}: {
  q?: string;
  page?: number;
  selectedId?: string;
  children?: ReactNode;
}) {
  const query = q.trim();
  const current = Math.max(1, page);
  const offset = (current - 1) * PAGE_SIZE;

  const total = countSearchSessions(query);
  const sessions = searchSessions(query, PAGE_SIZE, offset);
  const projects = listProjectStats();
  const isEmpty = countSessions() === 0; // store empty ⇒ no recordings at all

  // first-run when the store is empty; no-results when a filter matches nothing;
  // otherwise the idle "no signal" bench.
  let benchKind: BenchKind = 'idle';
  if (isEmpty) benchKind = 'first-run';
  else if (total === 0 && query) benchKind = 'no-results';

  const HEAD_META: Record<BenchKind, string> = {
    'first-run': 'No recordings yet',
    'no-results': 'No sessions match this filter',
    idle: 'Select a recording',
  };
  const headMeta = HEAD_META[benchKind];

  return (
    <div
      className={`workspace${selectedId ? ' has-selection' : ''}${
        benchKind === 'first-run' ? ' show-bench' : ''
      }`}
    >
      <AppHeader />
      <div className="workspace-body">
        <SessionBrowser
          sessions={sessions}
          selectedId={selectedId}
          total={total}
          query={query}
          page={current}
          pageSize={PAGE_SIZE}
          projects={projects}
        />
        <main className="workspace-main">
          {children ?? (
            <>
              <div className="main-head">
                <span className="meta">{headMeta}</span>
              </div>
              <div className="main-body">
                <BenchState kind={benchKind} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
