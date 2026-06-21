import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installNetworkCapture, installErrorCapture, type NetworkEmit } from './capture';

describe('installNetworkCapture', () => {
  let uninstall: () => void;
  const origFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;
    window.fetch = global.fetch;
  });
  afterEach(() => {
    uninstall?.();
    global.fetch = origFetch;
  });

  it('emits metadata for a fetch (method, url, status) and no body', async () => {
    const emit = vi.fn<NetworkEmit>();
    uninstall = installNetworkCapture({ ignore: () => false, emit });
    await window.fetch('https://api.test/cart', { method: 'POST' });
    expect(emit).toHaveBeenCalledTimes(1);
    const arg = emit.mock.calls[0][0];
    expect(arg).toMatchObject({ method: 'POST', url: 'https://api.test/cart', status: 200 });
    expect(typeof arg.durationMs).toBe('number');
    expect(Object.keys(arg)).not.toContain('body'); // metadata only
  });

  it('does not emit for ignored URLs (the SDK\'s own ingest)', async () => {
    const emit = vi.fn<NetworkEmit>();
    uninstall = installNetworkCapture({ ignore: (u) => u.includes('/api/ingest'), emit });
    await window.fetch('https://app.test/api/ingest', { method: 'POST' });
    expect(emit).not.toHaveBeenCalled();
  });

  it('restores the original fetch on uninstall', () => {
    const before = window.fetch;
    const u = installNetworkCapture({ ignore: () => false, emit: vi.fn() });
    expect(window.fetch).not.toBe(before);
    u();
    expect(window.fetch).toBe(before);
  });
});

describe('installErrorCapture', () => {
  it('emits a payload for window error events with message + stack', () => {
    const emit = vi.fn();
    const uninstall = installErrorCapture({ emit });
    window.dispatchEvent(
      new ErrorEvent('error', { message: 'boom', filename: 'a.js', lineno: 3, colno: 5, error: new Error('boom') }),
    );
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0]).toMatchObject({ message: 'boom' });
    uninstall();
  });
});
