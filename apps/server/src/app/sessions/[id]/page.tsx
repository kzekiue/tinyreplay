import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession, getSessionEvents } from '@/lib/queries';
import { Workspace } from '@/components/Workspace';
import { PlayerShell } from '@/components/player/PlayerShell';
import { ArrowLeftIcon } from '@/components/icons';
import { formatBrowser, formatDateTime, relativeTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ReplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { id } = await params;
  const { page, q } = await searchParams;
  const current = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);

  const session = getSession(id);
  if (!session) notFound();

  const events = getSessionEvents(id);
  const browser = formatBrowser(session.user_agent);
  const viewport =
    session.viewport_w && session.viewport_h ? `${session.viewport_w}×${session.viewport_h}` : null;
  const facts = [
    session.device_type ?? 'unknown',
    browser,
    viewport,
    relativeTime(session.started_at),
  ].filter(Boolean);

  return (
    <Workspace q={q ?? ''} page={current} selectedId={id}>
      <div className="main-head">
        <Link
          href={q ? `/?q=${encodeURIComponent(q)}` : '/'}
          className="btn btn-ghost btn-icon back"
          aria-label="Back to sessions"
        >
          <ArrowLeftIcon size={16} />
        </Link>
        <span className="ident">{session.id.slice(0, 8)}</span>
        <span className="sep" aria-hidden="true" />
        <span className="meta" title={formatDateTime(session.started_at)}>
          {facts.join(' · ')}
        </span>
      </div>
      <div className="main-body">
        <PlayerShell events={events} session={session} />
      </div>
    </Workspace>
  );
}
