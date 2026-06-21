// Lightweight session lookup for the command palette's jump-to-session
// typeahead. Reuses the same filter the rail uses; returns only the fields the
// palette renders. Local read, no outbound calls.

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { searchSessions } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX = 8;

export function GET(req: NextRequest): NextResponse {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const rows = searchSessions(q, MAX, 0).map((s) => ({
    id: s.id,
    url: s.url,
    started_at: s.started_at,
    error_count: s.error_count,
  }));
  return NextResponse.json({ sessions: rows });
}
