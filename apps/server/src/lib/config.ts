/**
 * The single place every server env knob is read and parsed.
 *
 * Each value is a function read lazily at call time (not a constant evaluated
 * at import) so the running process reflects its environment - and so tests can
 * set process.env per case. This module is import-safe in both the Node and the
 * Edge (middleware) runtimes: it only touches process.env, nothing native.
 */

/** Parse a positive-integer env var, falling back when unset/invalid/<=0. */
function positiveInt(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  /** Dashboard HTTP Basic password. Unset = dashboard is open. */
  dashboardPassword: (): string | undefined => process.env.DASHBOARD_PASSWORD || undefined,

  /** Ingest bearer token. Unset = ingest is open. */
  ingestToken: (): string | undefined => process.env.INGEST_TOKEN || undefined,

  /** Comma-separated CORS allowlist, or "*" for any origin. */
  allowedOrigins: (): string => process.env.ALLOWED_ORIGINS ?? '*',

  /** Max ingest body size in bytes; larger bodies get a 413. */
  maxPayloadBytes: (): number => positiveInt('MAX_PAYLOAD_BYTES', 5_000_000),

  /** Ingest requests allowed per minute per IP. */
  rateLimitPerMin: (): number => positiveInt('RATE_LIMIT_PER_MIN', 100),

  /** Days to retain sessions; 0 = keep forever (unset/invalid/<=0). */
  retentionDays: (): number => {
    const n = Number.parseInt(process.env.RETENTION_DAYS ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  },

  /** Explicit SQLite path (tests use ':memory:'); overrides dataDir when set. */
  dbPath: (): string | undefined => process.env.TINYREPLAY_DB_PATH || undefined,

  /** Directory holding the SQLite file; defaults to <cwd>/data in db.ts. */
  dataDir: (): string | undefined => process.env.DATA_DIR || undefined,
} as const;
