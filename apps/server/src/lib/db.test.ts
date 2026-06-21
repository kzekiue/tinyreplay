import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { getDb, resetDbForTests, deleteSessionsOlderThan, SCHEMA_VERSION } from './db';

describe('db migrations', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tinyreplay-db-'));
    process.env.TINYREPLAY_DB_PATH = path.join(tmpDir, 'test.db');
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    delete process.env.TINYREPLAY_DB_PATH;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('stamps a fresh database with the current schema version', () => {
    const db = getDb();
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
  });

  it('creates the sessions and events tables', () => {
    const db = getDb();
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('sessions');
    expect(names).toContain('events');
  });

  it('reopening an existing database is a no-op and keeps data', () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO sessions (id, project_id, started_at, url) VALUES (?, ?, ?, ?)`,
    ).run('s1', 'p', Date.now(), 'https://example.com/');

    resetDbForTests();
    const reopened = getDb();
    expect(reopened.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
    const row = reopened.prepare(`SELECT id FROM sessions WHERE id = 's1'`).get();
    expect(row).toEqual({ id: 's1' });
  });

  it('deleteSessionsOlderThan removes expired sessions and their events', () => {
    const db = getDb();
    const now = Date.now();
    const old = now - 40 * 86_400_000;
    const insertSession = db.prepare(
      `INSERT INTO sessions (id, project_id, started_at, url) VALUES (?, 'p', ?, 'u')`,
    );
    const insertEvents = db.prepare(
      `INSERT INTO events (session_id, seq, events_json) VALUES (?, 0, '[]')`,
    );
    insertSession.run('old-session', old);
    insertEvents.run('old-session');
    insertSession.run('new-session', now);
    insertEvents.run('new-session');

    const removed = deleteSessionsOlderThan(30);

    expect(removed).toBe(1);
    const ids = db.prepare(`SELECT id FROM sessions`).all() as { id: string }[];
    expect(ids).toEqual([{ id: 'new-session' }]);
    const events = db.prepare(`SELECT session_id FROM events`).all() as { session_id: string }[];
    expect(events).toEqual([{ session_id: 'new-session' }]);
  });

  it('V2 migration backfills error_count and tolerates corrupt batches', () => {
    const dbPath = process.env.TINYREPLAY_DB_PATH!;
    // Build a pre-V2 database (user_version = 1) with data, then let getDb() migrate.
    const raw = new Database(dbPath);
    raw.exec(`
      CREATE TABLE sessions (id TEXT PRIMARY KEY, project_id TEXT, started_at INTEGER, url TEXT,
        page_count INTEGER DEFAULT 1, event_count INTEGER DEFAULT 0);
      CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, seq INTEGER, events_json TEXT);
    `);
    raw.prepare(`INSERT INTO sessions (id, project_id, started_at, url) VALUES (?, 'p', 1, 'u')`).run('s-err');
    raw.prepare(`INSERT INTO sessions (id, project_id, started_at, url) VALUES (?, 'p', 2, 'u')`).run('s-clean');
    raw.prepare(`INSERT INTO sessions (id, project_id, started_at, url) VALUES (?, 'p', 3, 'u')`).run('s-corrupt');
    const ev = raw.prepare(`INSERT INTO events (session_id, seq, events_json) VALUES (?, ?, ?)`);
    ev.run('s-err', 0, JSON.stringify([
      { type: 5, data: { tag: 'tinyreplay/error', payload: {} }, timestamp: 1 },
      { type: 5, data: { tag: 'tinyreplay/error', payload: {} }, timestamp: 2 },
      { type: 3, data: {}, timestamp: 3 },
    ]));
    ev.run('s-clean', 0, JSON.stringify([{ type: 3, data: {}, timestamp: 1 }]));
    ev.run('s-corrupt', 0, '{"truncated": tru'); // invalid JSON - must not abort the migration
    raw.pragma('user_version = 1');
    raw.close();

    const db = getDb();
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
    const counts = Object.fromEntries(
      (db.prepare(`SELECT id, error_count FROM sessions`).all() as { id: string; error_count: number }[]).map(
        (r) => [r.id, r.error_count],
      ),
    );
    expect(counts).toEqual({ 's-err': 2, 's-clean': 0, 's-corrupt': 0 });
  });

  it('does not re-run migrations on a database already at the current version', () => {
    getDb();
    resetDbForTests();
    // Would throw if CREATE TABLE ran again without IF NOT EXISTS guarding -
    // more importantly, future ALTER-style migrations must be skipped.
    expect(() => getDb()).not.toThrow();
  });
});
