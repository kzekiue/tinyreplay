import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock rrweb so we can assert on recording lifecycle without a real DOM capture.
// vi.hoisted keeps these definitions available to the hoisted vi.mock factory.
const { recordFn, stopFn } = vi.hoisted(() => {
  const stopFn = vi.fn();
  const recordFn = Object.assign(vi.fn(() => stopFn), { addCustomEvent: vi.fn() });
  return { recordFn, stopFn };
});

vi.mock('rrweb', () => ({ record: recordFn }));
// The console plugin moved to its own package; stub it so recorder.ts resolves.
vi.mock('@rrweb/rrweb-plugin-console-record', () => ({
  getRecordConsolePlugin: vi.fn(() => ({ name: 'console', observer: vi.fn(), options: {} })),
}));

import { TinyReplay } from './index';

describe('TinyReplay.init', () => {
  beforeEach(() => {
    recordFn.mockClear();
    stopFn.mockClear();
    sessionStorage.clear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('calling init() twice only starts recording once', async () => {
    TinyReplay.init({ endpoint: 'http://localhost:3000', projectId: 'p' });
    TinyReplay.init({ endpoint: 'http://localhost:3000', projectId: 'p' });
    expect(recordFn).toHaveBeenCalledTimes(1);
    await TinyReplay.stop();
  });

  it('does not start recording when config is incomplete', () => {
    // @ts-expect-error intentionally invalid config
    TinyReplay.init({ endpoint: 'http://localhost:3000' });
    expect(recordFn).not.toHaveBeenCalled();
  });

  it('can restart after stop() with a new batch id even though seq restarts', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{"ok":true}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    TinyReplay.init({ endpoint: 'http://localhost:3000', projectId: 'p' });
    (recordFn.mock.calls[0][0].emit as (event: unknown) => void)({ type: 2 });
    await TinyReplay.stop();
    expect(stopFn).toHaveBeenCalledTimes(1);
    TinyReplay.init({ endpoint: 'http://localhost:3000', projectId: 'p' });
    (recordFn.mock.calls[1][0].emit as (event: unknown) => void)({ type: 2 });
    expect(recordFn).toHaveBeenCalledTimes(2);
    await TinyReplay.stop();

    const [firstBody, secondBody] = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body as string));
    expect(firstBody.sessionId).toBe(secondBody.sessionId);
    expect([firstBody.seq, secondBody.seq]).toEqual([0, 0]);
    expect(firstBody.batchId).not.toBe(secondBody.batchId);
    expect(firstBody.recordingInstanceId).not.toBe(secondBody.recordingInstanceId);
    expect([firstBody.recordingOrder, secondBody.recordingOrder]).toEqual([1, 2]);
  });
});
