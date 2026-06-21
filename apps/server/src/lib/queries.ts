import { getDb } from './db';
import { log } from './log';

export interface SessionRow {
  id: string;
  project_id: string;
  started_at: number;
  ended_at: number | null;
  duration_ms: number | null;
  url: string;
  user_agent: string | null;
  viewport_w: number | null;
  viewport_h: number | null;
  device_type: string | null;
  page_count: number;
  event_count: number;
  error_count: number;
  created_at: number;
}

export interface IngestInput {
  projectId: string;
  sessionId: string;
  seq: number;
  eventsJson: string;
  eventCount: number;
  /** number of route-change custom events in this batch (drives page_count) */
  routeDelta: number;
  /** number of error custom events in this batch (drives error_count) */
  errorDelta: number;
  endedAt: number;
  // Present only on seq 0:
  startedAt?: number;
  url?: string;
  userAgent?: string;
  viewportW?: number;
  viewportH?: number;
  deviceType?: string;
}

/**
 * Persist one ingest batch atomically: upsert the session row, bump counters,
 * and append the raw events JSON. Wrapped in a transaction so a session and its
 * first events are never half-written.
 */
export function ingestBatch(input: IngestInput): void {
  const db = getDb();
  const tx = db.transaction((i: IngestInput) => {
    if (i.seq === 0) {
      db.prepare(
        `INSERT INTO sessions
           (id, project_id, started_at, ended_at, url, user_agent,
            viewport_w, viewport_h, device_type, page_count, event_count, error_count)
         VALUES
           (@sessionId, @projectId, @startedAt, @endedAt, @url, @userAgent,
            @viewportW, @viewportH, @deviceType, @pageCount, @eventCount, @errorDelta)
         ON CONFLICT(id) DO UPDATE SET
           -- seq 0 is the source of truth for metadata; backfill it even if a
           -- a subsequent batch raced ahead and created a stub row first.
           started_at = excluded.started_at,
           url = excluded.url,
           user_agent = excluded.user_agent,
           viewport_w = excluded.viewport_w,
           viewport_h = excluded.viewport_h,
           device_type = excluded.device_type,
           ended_at = excluded.ended_at,
           event_count = sessions.event_count + excluded.event_count,
           page_count = sessions.page_count + @routeDelta,
           error_count = sessions.error_count + @errorDelta`,
      ).run({
        sessionId: i.sessionId,
        projectId: i.projectId,
        startedAt: i.startedAt ?? i.endedAt,
        endedAt: i.endedAt,
        url: i.url ?? '',
        userAgent: i.userAgent ?? null,
        viewportW: i.viewportW ?? null,
        viewportH: i.viewportH ?? null,
        deviceType: i.deviceType ?? null,
        pageCount: 1 + i.routeDelta,
        eventCount: i.eventCount,
        routeDelta: i.routeDelta,
        errorDelta: i.errorDelta,
      });
    } else {
      // A batch can arrive before seq 0 (concurrent/reordered flushes) or after
      // seq 0 was dropped. Ensure a parent row exists so the events INSERT below
      // never violates the foreign key; seq 0 backfills the real metadata when
      // (if) it lands. Stub uses schema defaults (page_count=1, counts=0).
      // Counters may skew slightly under reorder, but events are never lost.
      db.prepare(
        `INSERT OR IGNORE INTO sessions (id, project_id, started_at, ended_at, url)
         VALUES (@sessionId, @projectId, @endedAt, @endedAt, '')`,
      ).run({ sessionId: i.sessionId, projectId: i.projectId, endedAt: i.endedAt });
      db.prepare(
        `UPDATE sessions SET
           ended_at = @endedAt,
           event_count = event_count + @eventCount,
           page_count = page_count + @routeDelta,
           error_count = error_count + @errorDelta
         WHERE id = @sessionId`,
      ).run({
        sessionId: i.sessionId,
        endedAt: i.endedAt,
        eventCount: i.eventCount,
        routeDelta: i.routeDelta,
        errorDelta: i.errorDelta,
      });
    }

    db.prepare(
      `INSERT INTO events (session_id, seq, events_json) VALUES (?, ?, ?)`,
    ).run(i.sessionId, i.seq, i.eventsJson);
  });
  tx(input);
}

export function getSession(id: string): SessionRow | null {
  const row = getDb().prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as
    | SessionRow
    | undefined;
  return row ?? null;
}

export function listSessions(limit: number, offset: number): SessionRow[] {
  return getDb()
    .prepare(`SELECT * FROM sessions ORDER BY started_at DESC LIMIT ? OFFSET ?`)
    .all(limit, offset) as SessionRow[];
}

export function countSessions(): number {
  const row = getDb().prepare(`SELECT COUNT(*) AS n FROM sessions`).get() as { n: number };
  return row.n;
}

/** Distinct project ids present in the DB, for the toolbar's project dropdown. */
export function listProjects(): string[] {
  return getDb()
    .prepare(`SELECT DISTINCT project_id FROM sessions ORDER BY project_id`)
    .all()
    .map((r) => (r as { project_id: string }).project_id);
}

export interface ProjectStat {
  id: string;
  count: number; // sessions in the project
  errors: number; // sessions with at least one error
}

/** Per-project session + error counts, for the header scope selector. One pass,
 *  alphabetical. `errors` counts sessions that have any error, not total errors. */
export function listProjectStats(): ProjectStat[] {
  return getDb()
    .prepare(
      `SELECT project_id AS id,
              COUNT(*) AS count,
              SUM(CASE WHEN error_count > 0 THEN 1 ELSE 0 END) AS errors
         FROM sessions
        GROUP BY project_id
        ORDER BY project_id`,
    )
    .all() as ProjectStat[];
}

/** Delete sessions by id (and their events via ON DELETE CASCADE). Idempotent -
 *  unknown ids match nothing. Returns the number of sessions removed. */
export function deleteSessions(ids: string[]): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => '?').join(', ');
  return getDb()
    .prepare(`DELETE FROM sessions WHERE id IN (${placeholders})`)
    .run(...ids).changes;
}

export function deleteAllSessions(): number {
  return getDb().prepare('DELETE FROM sessions').run().changes;
}

// Numeric `field:op value` tokens. Maps the public token name → column.
const NUM_FIELDS: Record<string, string> = {
  pages: 'page_count',
  events: 'event_count',
  dur: 'duration_ms',
};

/**
 * Turn a search box string into a parameterized WHERE clause. Supports a tiny
 * `field:value` token vocabulary mixed with free text:
 *   device:mobile  pages:>3  events:>=100  dur:<10s  has:error  project:my-app
 *   after:2026-06-01  before:2026-06-10  last:7d  checkout
 * Numeric ops: > < >= <= = (bare number means =). `dur` is in seconds. `last:Nd`
 * (also h/m) is a relative window ending now. Anything that isn't a recognized
 * token falls back to a free-text LIKE on id/url/device.
 *
 * Operators come from a fixed whitelist (never raw user text) and every value is
 * bound as a parameter, so interpolating `where` into SQL is injection-safe.
 *
 * This is a regex tokenizer, not a full grammar: AND-only tokens plus free text,
 * with no OR, parentheses, or quoted phrases.
 */
const UNIT_MS: Record<string, number> = { d: 86_400_000, h: 3_600_000, m: 60_000 };

function buildFilter(
  query: string,
  now = Date.now(), // injectable for deterministic tests
): { where: string; params: (string | number)[] } {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  const free: string[] = [];

  for (const tok of query.trim().split(/\s+/).filter(Boolean)) {
    const m = /^(\w+):(>=|<=|>|<|=)?(.+)$/.exec(tok);
    const field = m?.[1];
    if (m && field === 'has' && (m[3] === 'error' || m[3] === 'errors')) {
      clauses.push('error_count > 0');
      continue;
    }
    if (m && field === 'project') {
      clauses.push('project_id = ?');
      params.push(m[3]);
      continue;
    }
    if (m && field === 'last') {
      const rm = /^(\d+)([dhm])$/i.exec(m[3]);
      if (rm) {
        clauses.push('started_at >= ?');
        params.push(now - Number(rm[1]) * UNIT_MS[rm[2].toLowerCase()]);
        continue;
      }
    }
    if (m && field === 'device') {
      clauses.push('device_type = ?');
      params.push(m[3].toLowerCase());
      continue;
    }
    if (m && (field === 'after' || field === 'before')) {
      const t = Date.parse(m[3]); // YYYY-MM-DD → UTC midnight
      if (!Number.isNaN(t)) {
        // `before` is inclusive of the whole named day.
        clauses.push(field === 'after' ? 'started_at >= ?' : 'started_at < ?');
        params.push(field === 'after' ? t : t + 86_400_000);
        continue;
      }
    }
    if (m && field && NUM_FIELDS[field]) {
      let n = Number(m[3].replace(/s$/i, ''));
      if (!Number.isNaN(n)) {
        if (field === 'dur') n *= 1000; // seconds → ms
        clauses.push(`${NUM_FIELDS[field]} ${m[2] || '='} ?`);
        params.push(n);
        continue;
      }
    }
    free.push(tok);
  }

  if (free.length) {
    const like = `%${free.join(' ')}%`;
    clauses.push('(id LIKE ? OR url LIKE ? OR device_type LIKE ?)');
    params.push(like, like, like);
  }
  return { where: clauses.length ? clauses.join(' AND ') : '1=1', params };
}

/**
 * Search sessions. Empty term behaves like `listSessions`. See `buildFilter` for
 * the supported `field:value` tokens; read-only, all values bound as parameters.
 */
export function searchSessions(query: string, limit: number, offset: number): SessionRow[] {
  const { where, params } = buildFilter(query);
  return getDb()
    .prepare(`SELECT * FROM sessions WHERE ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as SessionRow[];
}

/** Count of sessions matching a search term (empty term = total count). */
export function countSearchSessions(query: string): number {
  const { where, params } = buildFilter(query);
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM sessions WHERE ${where}`)
    .get(...params) as { n: number };
  return row.n;
}

export const __test = { buildFilter };

/**
 * Load every recorded event for a session, ordered by flush sequence, and
 * flatten the per-batch JSON arrays into a single rrweb event stream.
 * A corrupted batch (bad JSON) is skipped so one damaged row never takes
 * down the whole replay.
 */
export function getSessionEvents(id: string): unknown[] {
  const rows = getDb()
    .prepare(`SELECT events_json FROM events WHERE session_id = ? ORDER BY seq ASC, id ASC`)
    .all(id) as { events_json: string }[];
  const all: unknown[] = [];
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.events_json);
      if (Array.isArray(parsed)) all.push(...parsed);
    } catch {
      log.warn(`skipping corrupted event batch for session ${id}`);
    }
  }
  return all;
}
