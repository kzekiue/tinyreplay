import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests } from '@/lib/db';
import { GET } from './route';

describe('GET /api/health', () => {
  beforeEach(() => {
    process.env.TINYREPLAY_DB_PATH = ':memory:';
    resetDbForTests();
  });

  it('returns ok with the schema version when the database is reachable', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.schemaVersion).toBeGreaterThanOrEqual(1);
  });
});
