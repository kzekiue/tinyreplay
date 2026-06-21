// Isolate from the real data dir: an in-memory db per fresh getDb().
process.env.TINYREPLAY_DB_PATH = ':memory:';

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetDbForTests,
  getSetting,
  setSetting,
  getRetentionDays,
  setRetentionDays,
} from './db';

describe('settings store', () => {
  beforeEach(() => resetDbForTests());

  it('round-trips a key/value and upserts', () => {
    expect(getSetting('x')).toBeNull();
    setSetting('x', 'hi');
    expect(getSetting('x')).toBe('hi');
    setSetting('x', 'bye');
    expect(getSetting('x')).toBe('bye');
  });

  it('retention: persisted wins, 0 = keep forever, clamps negatives', () => {
    expect(getRetentionDays()).toBe(0); // no env, no setting → keep forever
    setRetentionDays(30);
    expect(getRetentionDays()).toBe(30);
    setRetentionDays(0);
    expect(getRetentionDays()).toBe(0);
    setRetentionDays(-5);
    expect(getRetentionDays()).toBe(0); // clamped, treated as keep-forever
  });
});
