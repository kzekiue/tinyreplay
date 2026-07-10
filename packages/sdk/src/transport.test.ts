import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Transport } from './transport';
import type { IngestPayload } from './types';

const payload: IngestPayload = {
  projectId: 'p',
  sessionId: 'b3b1f8e2-1c2d-4a5b-8c9d-0e1f2a3b4c5d',
  batchId: 'b3b1f8e2-1c2d-4a5b-8c9d-0e1f2a3b4c5d',
  recordingInstanceId: 'c3b1f8e2-1c2d-4a5b-8c9d-0e1f2a3b4c5d',
  recordingOrder: 1,
  seq: 0,
  startedAt: 1700000000000,
  url: 'https://example.com/',
  viewport: { w: 1280, h: 720, deviceType: 'desktop', userAgent: 'test' },
  events: [{ type: 2, data: {}, timestamp: 1700000000000 }],
};

describe('Transport', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('POSTs the payload to <endpoint>/api/ingest with JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const t = new Transport({ endpoint: 'https://tr.example.com/', debug: false });
    await t.send(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://tr.example.com/api/ingest');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(opts.body)).toMatchObject({ projectId: 'p', seq: 0 });
  });

  it('retries exactly once on failure then gives up silently', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    vi.stubGlobal('fetch', fetchMock);

    const t = new Transport({ endpoint: 'https://tr.example.com', debug: false });
    const p = t.send(payload);
    await vi.advanceTimersByTimeAsync(2000);
    await p;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).batchId)).toEqual([
      payload.batchId,
      payload.batchId,
    ]);
  });

  it('sendBeacon uses navigator.sendBeacon when available', () => {
    const beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });

    const t = new Transport({ endpoint: 'https://tr.example.com', debug: false });
    t.sendBeacon(payload);

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toBe('https://tr.example.com/api/ingest');
  });
});
