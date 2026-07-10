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
      `INSERT INTO events
         (session_id, seq, batch_id, recording_instance_id, recording_order, events_json)
       VALUES (?, 0, ?, ?, 1, '[]')`,
    );
    insertSession.run('old-session', old);
    insertEvents.run('old-session', 'old-batch', 'old-recorder');
    insertSession.run('new-session', now);
    insertEvents.run('new-session', 'new-batch', 'new-recorder');

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
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        seq INTEGER,
        events_json TEXT,
        received_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
      );
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

  it('V4 preserves duplicate sequences, backfills batch ids, and adds the idempotency index', () => {
    const dbPath = process.env.TINYREPLAY_DB_PATH!;
    const raw = new Database(dbPath);
    raw.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        url TEXT NOT NULL,
        page_count INTEGER NOT NULL DEFAULT 1,
        event_count INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        events_json TEXT NOT NULL,
        received_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
      );
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE INDEX idx_events_session_id ON events(session_id);
      CREATE INDEX custom_events_seq ON events(seq);
      CREATE TABLE event_audit (event_id INTEGER NOT NULL);
      CREATE TRIGGER custom_events_audit AFTER INSERT ON events
      BEGIN
        INSERT INTO event_audit (event_id) VALUES (NEW.id);
      END;
    `);
    raw.prepare(`INSERT INTO sessions (id, project_id, started_at, url, page_count, event_count, error_count)
                 VALUES ('s1', 'p', 1, 'u', 3, 3, 2)`).run();
    const insert = raw.prepare(`INSERT INTO events (session_id, seq, events_json) VALUES ('s1', ?, ?)`);
    insert.run(0, JSON.stringify([{ type: 2 }, { type: 5, data: { tag: 'tinyreplay/route' } }]));
    insert.run(0, JSON.stringify([{ type: 2 }, { type: 5, data: { tag: 'tinyreplay/error' } }]));
    insert.run(1, JSON.stringify([{ type: 5, data: { tag: 'tinyreplay/error' } }]));
    raw.pragma('user_version = 3');
    raw.close();

    const db = getDb();
    expect(db.prepare(`SELECT COUNT(*) AS n FROM events WHERE session_id = 's1'`).get()).toEqual({ n: 3 });
    expect(db.prepare(`SELECT event_count, page_count, error_count FROM sessions WHERE id = 's1'`).get()).toEqual({
      event_count: 3,
      page_count: 3,
      error_count: 2,
    });
    expect(db.prepare(`SELECT batch_id, recording_instance_id, recording_order FROM events WHERE session_id = 's1' ORDER BY id`).all()).toEqual([
      { batch_id: 'legacy-1', recording_instance_id: 'legacy-s1', recording_order: 0 },
      { batch_id: 'legacy-2', recording_instance_id: 'legacy-s1', recording_order: 0 },
      { batch_id: 'legacy-3', recording_instance_id: 'legacy-s1', recording_order: 0 },
    ]);
    expect(db.prepare(`SELECT metadata_recording_order, metadata_recording_instance_id FROM sessions WHERE id = 's1'`).get()).toEqual({
      metadata_recording_order: 0,
      metadata_recording_instance_id: 'legacy-s1',
    });
    const indexes = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'events' ORDER BY name`).all();
    expect(indexes).toEqual([
      { name: 'idx_events_session_batch_id' },
      { name: 'idx_events_session_id' },
    ]);
    expect(db.prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'custom_events_audit'`).all()).toEqual([]);
    db.prepare(
      `INSERT INTO events
         (session_id, seq, batch_id, recording_instance_id, recording_order, events_json)
       VALUES ('s1', 0, 'new-batch', 'new-recorder', 1, '[]')`,
    ).run();
    expect(() =>
      db.prepare(
        `INSERT INTO events
           (session_id, seq, batch_id, recording_instance_id, recording_order, events_json)
         VALUES ('s1', 1, 'new-batch', 'new-recorder', 1, '[]')`,
      ).run(),
    ).toThrow();
    expect(() =>
      db.prepare(
        `INSERT INTO events
           (session_id, seq, batch_id, recording_instance_id, recording_order, events_json)
         VALUES ('s1', 2, NULL, 'new-recorder', 1, '[]')`,
      ).run(),
    ).toThrow();
  });

  it('does not re-run migrations on a database already at the current version', () => {
    getDb();
    resetDbForTests();
    // Would throw if CREATE TABLE ran again without IF NOT EXISTS guarding -
    // more importantly, future ALTER-style migrations must be skipped.
    expect(() => getDb()).not.toThrow();
  });
});
