import { describe, it, expect, beforeEach } from 'vitest';
import { allowRequest, resetRateLimitForTests } from './rate-limit';

describe('rate limiter', () => {
  beforeEach(() => resetRateLimitForTests());

  it('allows up to 100 requests then blocks the 101st', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 100; i++) {
      expect(allowRequest('1.2.3.4', t0)).toBe(true);
    }
    expect(allowRequest('1.2.3.4', t0)).toBe(false);
  });

  it('tracks IPs independently', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 100; i++) allowRequest('1.1.1.1', t0);
    expect(allowRequest('1.1.1.1', t0)).toBe(false);
    expect(allowRequest('2.2.2.2', t0)).toBe(true);
  });

  it('honours the RATE_LIMIT_PER_MIN env override', () => {
    process.env.RATE_LIMIT_PER_MIN = '2';
    try {
      resetRateLimitForTests();
      const t0 = 1_000_000;
      expect(allowRequest('3.3.3.3', t0)).toBe(true);
      expect(allowRequest('3.3.3.3', t0)).toBe(true);
      expect(allowRequest('3.3.3.3', t0)).toBe(false);
    } finally {
      delete process.env.RATE_LIMIT_PER_MIN;
    }
  });

  it('refills over time', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 100; i++) allowRequest('9.9.9.9', t0);
    expect(allowRequest('9.9.9.9', t0)).toBe(false);
    // After 600ms, one token (100/60000 * 600 = 1) has refilled.
    expect(allowRequest('9.9.9.9', t0 + 600)).toBe(true);
  });

  it('rejects new IPs while all tracked buckets are active', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10_000; i++) {
      expect(allowRequest(`10.0.${Math.floor(i / 256)}.${i % 256}`, t0)).toBe(true);
    }

    expect(allowRequest('11.0.0.1', t0)).toBe(false);
    expect(allowRequest('11.0.0.1', t0 + 60_000)).toBe(true);
  });
});
