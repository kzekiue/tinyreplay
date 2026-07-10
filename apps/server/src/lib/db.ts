import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { config } from '@/lib/config';
import { log } from '@/lib/log';

/**
 * SQLite connection singleton with PRAGMA user_version migrations: on open,
 * every migration whose 1-based index exceeds the stored user_version runs in
 * a transaction, then the version is stamped. Append new migrations to
 * MIGRATIONS - never edit shipped entries.
 */

let db: Database.Database | null = null;

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER,
  duration_ms INTEGER GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
    THEN ended_at - started_at
    ELSE NULL END
  ) VIRTUAL,
  url         TEXT NOT NULL,
  user_agent  TEXT,
  viewport_w  INTEGER,
  viewport_h  INTEGER,
  device_type TEXT,
  page_count  INTEGER NOT NULL DEFAULT 1,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  events_json TEXT NOT NULL,
  received_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
`;

// V2: per-session error count, for the `has:error` filter. Backfilled in pure
// SQL via JSON1: error events are rrweb custom events (type 5) tagged
// 'tinyreplay/error'. json_valid guards old corrupt batches so a bad row cannot
// abort the migration. The backfill scans existing events once, at upgrade time.
const SCHEMA_V2 = `
ALTER TABLE sessions ADD COLUMN error_count INTEGER NOT NULL DEFAULT 0;

UPDATE sessions SET error_count = (
  SELECT COUNT(*)
  FROM (SELECT events_json AS ej FROM events
        WHERE session_id = sessions.id AND json_valid(events_json)) v,
       json_each(v.ej) je
  WHERE json_extract(je.value, '$.type') = 5
    AND json_extract(je.value, '$.data.tag') = 'tinyreplay/error'
);
`;

const SCHEMA_V3 = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// V4: batch ids deduplicate retries, and recorder identity/order separates
// restarted sequence counters. Rebuild events so these fields are non-null
// invariants; historical rows are copied intact with deterministic legacy ids.
const SCHEMA_V4 = `
CREATE TABLE events_v4 (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id            TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  seq                   INTEGER NOT NULL,
  batch_id              TEXT NOT NULL,
  recording_instance_id TEXT NOT NULL,
  recording_order       INTEGER NOT NULL,
  events_json           TEXT NOT NULL,
  received_at           INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

INSERT INTO events_v4
  (id, session_id, seq, batch_id, recording_instance_id, recording_order, events_json, received_at)
SELECT
  id,
  session_id,
  seq,
  'legacy-' || id,
  'legacy-' || session_id,
  0,
  events_json,
  received_at
FROM events;

DROP TABLE events;
ALTER TABLE events_v4 RENAME TO events;

CREATE INDEX idx_events_session_id ON events(session_id);
CREATE UNIQUE INDEX idx_events_session_batch_id ON events(session_id, batch_id);
`;

// V5: session summaries belong to the newest recorder lifecycle, independent
// of network arrival order. The instance id is a deterministic tie-breaker for
// malformed clients that reuse a recording order. Backfill from V4 events;
// metadata values themselves cannot be reconstructed from historical event JSON.
const SCHEMA_V5 = `
ALTER TABLE sessions ADD COLUMN metadata_recording_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN metadata_recording_instance_id TEXT NOT NULL DEFAULT '';

UPDATE sessions
SET
  metadata_recording_order = COALESCE((
    SELECT recording_order
    FROM events
    WHERE session_id = sessions.id
    ORDER BY recording_order DESC, recording_instance_id DESC, id DESC
    LIMIT 1
  ), 0),
  metadata_recording_instance_id = COALESCE((
    SELECT recording_instance_id
    FROM events
    WHERE session_id = sessions.id
    ORDER BY recording_order DESC, recording_instance_id DESC, id DESC
    LIMIT 1
  ), 'legacy-' || id);
`;

const MIGRATIONS: string[] = [SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5];

export const SCHEMA_VERSION = MIGRATIONS.length;

function migrate(conn: Database.Database): void {
  const current = conn.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    conn.transaction(() => {
      conn.exec(MIGRATIONS[v]);
      conn.pragma(`user_version = ${v + 1}`);
    })();
  }
}

function resolveDbPath(): string {
  // TINYREPLAY_DB_PATH wins (used by tests, may be ':memory:').
  const explicit = config.dbPath();
  if (explicit) return explicit;
  const dir = config.dataDir() || path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'tinyreplay.db');
}

export function getDb(): Database.Database {
  if (db) return db;
  const conn = new Database(resolveDbPath());
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');
  migrate(conn);
  db = conn;
  startRetentionSweeper();
  return db;
}

/** Liveness + capacity snapshot for the health probe. Cheap: a count, a file
 *  stat, and a filesystem stat. `freeBytes` is null when the FS can't report it
 *  (e.g. an in-memory test db). Throws if the db itself is unreadable - the
 *  health route maps that to a failing store. */
export function storeStats(): { sizeBytes: number; freeBytes: number | null; sessions: number } {
  const sessions = (getDb().prepare('SELECT count(*) AS c FROM sessions').get() as { c: number }).c;
  const p = resolveDbPath();
  let sizeBytes = 0;
  let freeBytes: number | null = null;
  try {
    sizeBytes = fs.statSync(p).size;
  } catch {
    /* :memory: or not yet flushed */
  }
  try {
    const s = fs.statfsSync(p === ':memory:' ? process.cwd() : path.dirname(p));
    freeBytes = s.bavail * s.bsize;
  } catch {
    /* statfs unsupported on this platform */
  }
  return { sizeBytes, freeBytes, sessions };
}

/**
 * Delete sessions whose recording started more than `days` days ago. Their
 * events go with them (ON DELETE CASCADE). Returns the number of sessions
 * removed.
 */
export function deleteSessionsOlderThan(days: number): number {
  const cutoff = Date.now() - days * 86_400_000;
  const result = getDb().prepare(`DELETE FROM sessions WHERE started_at < ?`).run(cutoff);
  return result.changes;
}

// ---- Persisted settings (key/value) ----------------------------------------

const KEY_RETENTION = 'retention_days';

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

/** Effective retention: a persisted value wins, else the RETENTION_DAYS env
 *  default. 0 = keep forever. */
export function getRetentionDays(): number {
  const s = getSetting(KEY_RETENTION);
  if (s != null) {
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return config.retentionDays();
}

export function setRetentionDays(days: number): void {
  setSetting(KEY_RETENTION, String(Math.max(0, Math.floor(days))));
}

/** Apply retention now and compact the file. Returns sessions removed. */
export function reclaimSpace(): { removed: number } {
  const days = getRetentionDays();
  const removed = days > 0 ? deleteSessionsOlderThan(days) : 0;
  getDb().exec('VACUUM');
  return { removed };
}

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
let sweepTimer: ReturnType<typeof setInterval> | null = null;

/** Hourly retention sweep. Reads the effective retention each tick so a change
 *  made in settings takes effect within the hour without a restart; a value of
 *  0 (keep forever) makes the tick a no-op. */
function startRetentionSweeper(): void {
  if (sweepTimer) return;
  const sweep = () => {
    const days = getRetentionDays();
    if (days <= 0) return;
    try {
      const removed = deleteSessionsOlderThan(days);
      if (removed > 0) log.info(`retention: removed ${removed} session(s) older than ${days}d`);
    } catch (err) {
      log.error('retention sweep failed', err);
    }
  };
  sweep();
  sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
  // Never keep the process alive just for the sweeper.
  sweepTimer.unref?.();
}

/** Test helper: drop the singleton so the next getDb() opens a fresh database. */
export function resetDbForTests(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
  if (db) {
    db.close();
    db = null;
  }
}
