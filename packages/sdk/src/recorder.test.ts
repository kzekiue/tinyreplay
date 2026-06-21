import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { recordFn, stopFn } = vi.hoisted(() => {
  const stopFn = vi.fn();
  const recordFn = Object.assign(vi.fn(() => stopFn), { addCustomEvent: vi.fn() });
  return { recordFn, stopFn };
});

vi.mock('rrweb', () => ({ record: recordFn }));
vi.mock('@rrweb/rrweb-plugin-console-record', () => ({
  getRecordConsolePlugin: vi.fn(() => ({ name: 'console', observer: vi.fn(), options: {} })),
}));

import { Recorder } from './recorder';

type EmitFn = (event: unknown) => void;

function emitFrom(call = 0): EmitFn {
  return recordFn.mock.calls[call][0].emit as EmitFn;
}

describe('Recorder', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    recordFn.mockClear();
    stopFn.mockClear();
    sessionStorage.clear();
    fetchMock = vi.fn(() => Promise.resolve(new Response('{"ok":true}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes the configured token in every flushed payload', async () => {
    const r = new Recorder({
      endpoint: 'http://localhost:3000',
      projectId: 'p',
      token: 'test-token',
    });
    r.start();
    emitFrom()({ type: 2 });
    await r.stop();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.token).toBe('test-token');
    expect(body.seq).toBe(0);
  });

  it('omits token from the payload when not configured', async () => {
    const r = new Recorder({ endpoint: 'http://localhost:3000', projectId: 'p' });
    r.start();
    emitFrom()({ type: 2 });
    await r.stop();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect('token' in body).toBe(false);
  });

  it('stop() drains the whole buffer', async () => {
    const r = new Recorder({ endpoint: 'http://localhost:3000', projectId: 'p' });
    r.start();
    const emit = emitFrom();
    for (let i = 0; i < 1200; i++) emit({ type: 3, i });
    await r.stop();

    // 1200 events / 500 per batch = 3 payloads, seq 0..2.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body as string));
    expect(bodies.map((b) => b.seq)).toEqual([0, 1, 2]);
    expect(bodies.reduce((n, b) => n + b.events.length, 0)).toBe(1200);
  });

  it('caps the in-memory buffer and drops new events when full', async () => {
    const r = new Recorder({ endpoint: 'http://localhost:3000', projectId: 'p' });
    r.start();
    const emit = emitFrom();
    for (let i = 0; i < 5100; i++) emit({ type: 3, i });
    await r.stop();

    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body as string));
    expect(bodies.reduce((n, b) => n + b.events.length, 0)).toBe(5000);
    // The oldest events (the snapshot) survive; the overflow is what's dropped.
    expect(bodies[0].events[0].i).toBe(0);
  });

  it('flushes via sendBeacon in chunks on pagehide', () => {
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon });
    const r = new Recorder({ endpoint: 'http://localhost:3000', projectId: 'p' });
    r.start();
    const emit = emitFrom();
    for (let i = 0; i < 300; i++) emit({ type: 3, i });

    window.dispatchEvent(new Event('pagehide'));

    // 300 events / 120 per beacon chunk = 3 beacons.
    expect(beacon).toHaveBeenCalledTimes(3);
    void r.stop();
  });

  it('stops recording after maxDurationMs', () => {
    vi.useFakeTimers();
    try {
      const r = new Recorder({
        endpoint: 'http://localhost:3000',
        projectId: 'p',
        maxDurationMs: 10_000,
      });
      r.start();
      expect(stopFn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(10_001);
      expect(stopFn).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
