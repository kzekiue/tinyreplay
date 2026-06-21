import { formatDateTime, formatDuration, formatCount, formatBrowser } from '@/lib/format';
import type { SessionRow } from '@/lib/queries';

/** Session metadata, rendered inside the inspector's Metadata tab.
 *  Stat cells read like recessed instrument displays; the definition list keeps
 *  the precise technical fields aligned and monospaced. */
export function MetadataPanel({ session }: { session: SessionRow }) {
  const browser = formatBrowser(session.user_agent);
  const viewport = session.viewport_w && session.viewport_h ? `${session.viewport_w}×${session.viewport_h}` : '-';

  return (
    <div className="scroll scroll-stage" style={{ flex: 1, minHeight: 0 }}>
      <div className="meta-body">
        <div className="meta-stats">
          <Stat label="Duration" value={formatDuration(session.duration_ms)} />
          <Stat label="Events" value={formatCount(session.event_count)} />
          <Stat label="Pages" value={String(session.page_count)} />
          <Stat label="Device" value={session.device_type ?? 'unknown'} cap />
        </div>

        <hr className="meta-divider" />

        <dl className="meta-list">
          <dt>Started</dt>
          <dd>{formatDateTime(session.started_at)}</dd>
          <dt>Viewport</dt>
          <dd className="mono">{viewport}</dd>
          {browser ? (<><dt>Browser</dt><dd>{browser}</dd></>) : null}
          <dt>Entry URL</dt>
          <dd className="mono">{session.url}</dd>
          <dt>Session</dt>
          <dd className="mono">{session.id}</dd>
        </dl>
      </div>
    </div>
  );
}

function Stat({ label, value, cap }: { label: string; value: string; cap?: boolean }) {
  return (
    <div className="stat-cell">
      <div className="label">{label}</div>
      <div className={`val${cap ? ' cap' : ''}`}>{value}</div>
    </div>
  );
}
