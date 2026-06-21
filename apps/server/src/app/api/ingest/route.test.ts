import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { resetDbForTests, getDb } from '@/lib/db';
import { resetRateLimitForTests } from '@/lib/rate-limit';

const SID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '5.5.5.5', ...headers },
    body: JSON.stringify(body),
  });
}

const validSeq0 = {
  projectId: 'demo',
  sessionId: SID,
  seq: 0,
  startedAt: 1700000000000,
  url: 'https://example.com/',
  viewport: { w: 1280, h: 720, deviceType: 'desktop', userAgent: 'test' },
  events: [{ type: 2, data: {}, timestamp: 1700000000000 }],
};

describe('POST /api/ingest', () => {
  beforeEach(() => {
    process.env.TINYREPLAY_DB_PATH = ':memory:';
    resetDbForTests();
    resetRateLimitForTests();
  });

  it('accepts a valid payload and writes rows', async () => {
    const res = await POST(makeRequest(validSeq0));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const session = getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(SID) as
      | { url: string; event_count: number }
      | undefined;
    expect(session?.url).toBe('https://example.com/');
    expect(session?.event_count).toBe(1);

    const eventRows = getDb().prepare('SELECT COUNT(*) AS n FROM events WHERE session_id = ?').get(SID) as { n: number };
    expect(eventRows.n).toBe(1);
  });

  it('rejects a non-JSON content type with 400', async () => {
    const res = await POST(makeRequest(validSeq0, { 'content-type': 'text/plain' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_payload');
  });

  it('rejects a payload missing required seq-0 fields with 400', async () => {
    const { url: _url, ...noUrl } = validSeq0;
    void _url;
    const res = await POST(makeRequest(noUrl));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_payload');
  });

  it('rejects an empty events array with 400', async () => {
    const res = await POST(makeRequest({ ...validSeq0, events: [] }));
    expect(res.status).toBe(400);
  });

  it('rejects a body over MAX_PAYLOAD_BYTES with 413', async () => {
    process.env.MAX_PAYLOAD_BYTES = '1000';
    try {
      const big = { ...validSeq0, events: [{ type: 2, data: { blob: 'x'.repeat(2000) }, timestamp: 1 }] };
      const res = await POST(makeRequest(big));
      expect(res.status).toBe(413);
      expect((await res.json()).error).toBe('payload_too_large');
    } finally {
      delete process.env.MAX_PAYLOAD_BYTES;
    }
  });

  describe('when INGEST_TOKEN is set', () => {
    beforeEach(() => {
      process.env.INGEST_TOKEN = 'test-token';
      return () => {
        delete process.env.INGEST_TOKEN;
      };
    });

    it('rejects a payload without a token with 401', async () => {
      const res = await POST(makeRequest(validSeq0));
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('unauthorized');
    });

    it('rejects a wrong token with 401', async () => {
      const res = await POST(makeRequest({ ...validSeq0, token: 'nope' }));
      expect(res.status).toBe(401);
    });

    it('accepts a matching token in the body', async () => {
      const res = await POST(makeRequest({ ...validSeq0, token: 'test-token' }));
      expect(res.status).toBe(200);
    });

    it('accepts a matching Authorization bearer token', async () => {
      const res = await POST(
        makeRequest(validSeq0, { authorization: 'Bearer test-token' }),
      );
      expect(res.status).toBe(200);
    });
  });

  it('returns 429 once the per-IP budget is exhausted', async () => {
    for (let i = 0; i < 100; i++) {
      await POST(makeRequest({ ...validSeq0, sessionId: SID, seq: i }));
    }
    const res = await POST(makeRequest({ ...validSeq0, seq: 101 }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('rate_limited');
  });
});
