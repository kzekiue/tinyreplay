// Liveness/readiness probe + store-health source for the faceplate lamp.
// Verifies SQLite is queryable and reports honest capacity (size, free disk,
// session count). Unauthenticated by design so orchestrators can poll it; makes
// no outbound calls.

import { NextResponse } from 'next/server';
import { SCHEMA_VERSION, storeStats } from '@/lib/db';
import { log } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Free-disk thresholds for the store-health status. Fixed, measurable triggers.
const WARN_FREE_BYTES = 1_000_000_000; // 1 GB: flag early, writes still fine
const FAIL_FREE_BYTES = 100_000_000; //  100 MB: writes at real risk

export function GET(): NextResponse {
  try {
    const { sizeBytes, freeBytes, sessions } = storeStats();
    let status: 'ok' | 'degraded' | 'failing' = 'ok';
    if (freeBytes != null && freeBytes < FAIL_FREE_BYTES) status = 'failing';
    else if (freeBytes != null && freeBytes < WARN_FREE_BYTES) status = 'degraded';
    return NextResponse.json({ ok: true, status, schemaVersion: SCHEMA_VERSION, sizeBytes, freeBytes, sessions });
  } catch (err) {
    log.error('health check failed', err);
    return NextResponse.json({ ok: false, status: 'failing' }, { status: 500 });
  }
}
