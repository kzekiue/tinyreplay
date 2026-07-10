export interface TinyReplayConfig {
  /** Base URL of your TinyReplay server (no trailing slash). */
  endpoint: string;
  /** Arbitrary project identifier string. */
  projectId: string;
  /** Ingestion token, required only if the server sets INGEST_TOKEN. Sent in
   *  the payload body (sendBeacon cannot set headers). */
  token?: string;
  /** ms between batch flushes, default 5000. */
  flushInterval?: number;
  /** Max recording duration in ms, default 30 minutes. Recording stops and
   *  flushes when reached; the page keeps working untouched. */
  maxDurationMs?: number;
  /** default true - mask all form inputs. */
  maskAllInputs?: boolean;
  /** default false - log events to console. */
  debug?: boolean;
}

export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface ViewportMeta {
  w: number;
  h: number;
  deviceType: DeviceType;
  userAgent: string;
}

/**
 * The shape of a single ingest request body. Mirrors the server's zod schema.
 * `events` carries raw rrweb events; we never inspect or reshape them here.
 */
export interface IngestPayload {
  projectId: string;
  /** Present only when the SDK was configured with a token. */
  token?: string;
  sessionId: string;
  /** Stable across retries of this payload; unique for every newly created batch. */
  batchId: string;
  /** Stable for one Recorder lifecycle; changes when recording starts again. */
  recordingInstanceId: string;
  /** Monotonic within a browser tab session; orders Recorder lifecycles. */
  recordingOrder: number;
  seq: number;
  startedAt?: number;
  url?: string;
  viewport?: ViewportMeta;
  // rrweb eventWithTime[] - kept as unknown[] so the SDK stays decoupled from rrweb's internal types.
  events: unknown[];
}

/** rrweb custom-event tags the SDK emits for network + error capture. The server
 *  stores them verbatim; the dashboard parser reads them back. */
export const NETWORK_EVENT_TAG = 'tinyreplay/network';
export const ERROR_EVENT_TAG = 'tinyreplay/error';
