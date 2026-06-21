import Link from 'next/link';
import { FirstRun } from './first-run';

export type BenchKind = 'first-run' | 'idle' | 'no-results';

/** The one bench-empty primitive. Replaces the old IdleStage + EmptyState +
 *  rail-inline trio, so every "nothing loaded" surface speaks one vocabulary.
 *  Only `first-run` is interactive (the waiting poller); the rest are static. */
export function BenchState({ kind }: { kind: BenchKind }) {
  if (kind === 'first-run') return <FirstRun />;

  if (kind === 'no-results') {
    return (
      <div className="empty empty-quiet">
        <h2>No sessions match this filter</h2>
        <p>Change the search term, adjust the filters, or clear everything to see all recordings.</p>
        <Link href="/" className="btn">
          Clear filters
        </Link>
      </div>
    );
  }

  // idle - recordings exist, none selected.
  return (
    <div className="idle-stage">
      <span className="signal-port" aria-hidden="true">
        <span className="lamp is-off" />
      </span>
      <span className="no-signal">No signal</span>
      <h2>Select a recording</h2>
      <p>
        Choose a session from the browser to replay what the user saw. Inputs stay masked,
        and data stays on this server.
      </p>
    </div>
  );
}
