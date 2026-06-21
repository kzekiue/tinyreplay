import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';
import { config as env } from '@/lib/config';

/**
 * Dashboard auth: when DASHBOARD_PASSWORD is set, every page requires HTTP
 * Basic auth (any username). Ingestion, the health probe, and the SDK bundle
 * stay open - browsers on recorded sites must reach them without credentials.
 */
export function middleware(req: NextRequest): NextResponse {
  const password = env.dashboardPassword();
  if (!password) return NextResponse.next();

  if (isAuthorized(req.headers.get('authorization'), password)) {
    return NextResponse.next();
  }
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="TinyReplay", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except: ingestion + health APIs, the served SDK bundle,
  // Next static assets, and favicon.
  matcher: ['/((?!api/ingest|api/health|sdk/|_next/static|_next/image|favicon.ico).*)'],
};
