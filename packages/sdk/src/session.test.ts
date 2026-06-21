import { describe, it, expect, beforeEach } from 'vitest';
import { generateSessionId, getOrCreateSessionId } from './session';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('session id', () => {
  beforeEach(() => sessionStorage.clear());

  it('generateSessionId returns a UUID v4', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateSessionId()).toMatch(UUID_V4);
    }
  });

  it('getOrCreateSessionId persists a single id across calls', () => {
    const a = getOrCreateSessionId();
    const b = getOrCreateSessionId();
    expect(a).toBe(b);
    expect(a).toMatch(UUID_V4);
  });
});
