// NO TELEMETRY
// This route only receives session events from the SDK and writes them to the
// local SQLite database. It makes no outbound calls of any kind.

import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ingestSchema, countRouteEvents, countErrorEvents } from '@/lib/validate';
import { ingestBatch } from '@/lib/queries';
import { allowRequest } from '@/lib/rate-limit';
import { corsHeaders } from '@/lib/cors';
import { config } from '@/lib/config';
import { log } from '@/lib/log';

// better-sqlite3 is a native module - force the Node.js runtime, not Edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tokensMatch(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** When INGEST_TOKEN is set, the request must carry it in the body (`token`)
 *  or as `Authorization: Bearer <token>`. Body wins because sendBeacon flushes
 *  cannot set headers. */
function checkIngestToken(req: NextRequest, bodyToken: string | undefined): boolean {
  const expected = config.ingestToken();
  if (!expected) return true;
  if (tokensMatch(bodyToken, expected)) return true;
  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : undefined;
  return tokensMatch(bearer, expected);
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function json(
  body: unknown,
  status: number,
  origin: string | null,
): NextResponse {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) });
}

export function OPTIONS(req: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const origin = req.headers.get('origin');

  // 1. Content-Type check.
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return json({ ok: false, error: 'invalid_payload', message: 'expected application/json' }, 400, origin);
  }

  // 2. Rate limit per IP.
  if (!allowRequest(clientIp(req))) {
    return json({ ok: false, error: 'rate_limited' }, 429, origin);
  }

  // 3. Size limit - trust Content-Length when present, verify the real bytes
  //    after reading either way.
  const limit = config.maxPayloadBytes();
  const declared = Number.parseInt(req.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(declared) && declared > limit) {
    return json({ ok: false, error: 'payload_too_large' }, 413, origin);
  }
  const text = await req.text();
  if (Buffer.byteLength(text) > limit) {
    return json({ ok: false, error: 'payload_too_large' }, 413, origin);
  }

  // 4. Parse + validate body shape.
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json({ ok: false, error: 'invalid_payload', message: 'malformed JSON' }, 400, origin);
  }

  const parsed = ingestSchema.safeParse(raw);
  if (!parsed.success) {
    return json(
      { ok: false, error: 'invalid_payload', message: parsed.error.issues[0]?.message ?? 'invalid' },
      400,
      origin,
    );
  }
  const body = parsed.data;

  // 5. Ingestion token (only when INGEST_TOKEN is configured).
  if (!checkIngestToken(req, body.token)) {
    return json({ ok: false, error: 'unauthorized' }, 401, origin);
  }

  // 6. Persist.
  try {
    ingestBatch({
      projectId: body.projectId,
      sessionId: body.sessionId,
      // Older SDKs do not carry a delivery id. Keep accepting them, but only
      // clients that resend a stable batchId can be deduplicated on retry.
      batchId: body.batchId ?? randomUUID(),
      recordingInstanceId: body.recordingInstanceId ?? `legacy-${body.sessionId}`,
      recordingOrder: body.recordingOrder ?? 0,
      seq: body.seq,
      eventsJson: JSON.stringify(body.events),
      eventCount: body.events.length,
      routeDelta: countRouteEvents(body.events),
      errorDelta: countErrorEvents(body.events),
      endedAt: Date.now(),
      startedAt: body.startedAt,
      url: body.url,
      userAgent: body.viewport?.userAgent,
      viewportW: body.viewport?.w,
      viewportH: body.viewport?.h,
      deviceType: body.viewport?.deviceType,
    });
  } catch (err) {
    // The payload already passed validation, so a persist failure here is the
    // store, not the request: disk full, db locked, I/O error. Answer 503 so the
    // SDK treats it as transient and retries on its next flush rather than
    // dropping the batch.
    log.error('ingest failed, store unavailable', err);
    return json({ ok: false, error: 'store_unavailable' }, 503, origin);
  }

  return json({ ok: true }, 200, origin);
}
