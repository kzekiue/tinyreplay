/**
 * Pure transform: raw rrweb event stream → typed, time-stamped entries that drive
 * every player panel and timeline marker. No rrweb import (we only read a few well
 * known fields), so this runs in RSC, the client, or a test with equal ease.
 *
 * Time (`t`) on every entry is the offset in ms from the session start, which maps
 * directly onto the timeline (0 … totalTime).
 */

// --- rrweb constants we rely on (stable across rrweb v1/v2) ---
const EventType = { FullSnapshot: 2, IncrementalSnapshot: 3, Meta: 4, Custom: 5, Plugin: 6 } as const;
const IncrementalSource = { MouseInteraction: 2, Input: 5 } as const;
const MouseInteractions = { Click: 2 } as const;

const RAGE_WINDOW_MS = 700;
const RAGE_MIN_CLICKS = 3;
const CONSOLE_PLUGIN = 'rrweb/console@1';
const ROUTE_TAG = 'tinyreplay/route';
const NETWORK_TAG = 'tinyreplay/network';
const ERROR_TAG = 'tinyreplay/error';

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

export type ReplayEntry =
  | { kind: 'route'; t: number; url: string }
  | { kind: 'click'; t: number; targetId?: number }
  | { kind: 'rageclick'; t: number; count: number; targetId?: number }
  | { kind: 'input'; t: number; targetId?: number }
  | { kind: 'console'; t: number; level: ConsoleLevel; text: string }
  | { kind: 'network'; t: number; method: string; url: string; status?: number; durationMs?: number }
  | { kind: 'error'; t: number; message: string; stack?: string };

export interface ReplayMeta {
  startTimestamp: number;
  endTimestamp: number;
  totalTime: number;
  width: number;
  height: number;
  entryUrl: string;
  /** rrweb needs ≥2 events including a FullSnapshot to reconstruct anything. */
  replayable: boolean;
}

export interface ParsedReplay {
  meta: ReplayMeta;
  entries: ReplayEntry[];
  /** The event stream with malformed entries dropped - feed THIS to the Replayer. */
  events: unknown[];
}

/** An rrweb event we can safely hand to the Replayer: an object with numeric
 *  type and timestamp. Anything else (corrupted batch content, nulls, strings)
 *  would make the Replayer throw mid-replay. */
function isUsableEvent(ev: unknown): ev is RawEvent {
  return (
    typeof ev === 'object' &&
    ev !== null &&
    typeof (ev as RawEvent).type === 'number' &&
    typeof (ev as RawEvent).timestamp === 'number' &&
    Number.isFinite((ev as RawEvent).timestamp)
  );
}

interface RawEvent {
  type?: number;
  timestamp?: number;
  data?: Record<string, unknown> & {
    source?: number;
    type?: number;
    id?: number;
    href?: string;
    width?: number;
    height?: number;
    tag?: string;
    plugin?: string;
    payload?: unknown;
  };
}

export function parseReplay(raw: unknown[]): ParsedReplay {
  const events = (Array.isArray(raw) ? raw.filter(isUsableEvent) : []).sort(
    (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0),
  );
  const startTimestamp = events.length ? Number(events[0]?.timestamp ?? 0) : 0;
  const endTimestamp = events.length ? Number(events[events.length - 1]?.timestamp ?? startTimestamp) : startTimestamp;

  let width = 0;
  let height = 0;
  let entryUrl = '';
  let hasSnapshot = false;
  const rawClicks: { t: number; targetId?: number }[] = [];
  const out: ReplayEntry[] = [];

  for (const ev of events) {
    const t = Number(ev?.timestamp ?? startTimestamp) - startTimestamp;
    const d = ev?.data ?? {};

    if (ev?.type === EventType.FullSnapshot) {
      hasSnapshot = true;
      continue;
    }

    if (ev?.type === EventType.Meta) {
      if (typeof d.href === 'string') entryUrl = d.href;
      if (typeof d.width === 'number') width = d.width;
      if (typeof d.height === 'number') height = d.height;
      continue;
    }

    if (ev?.type === EventType.IncrementalSnapshot) {
      if (d.source === IncrementalSource.MouseInteraction && d.type === MouseInteractions.Click) {
        rawClicks.push({ t, targetId: typeof d.id === 'number' ? d.id : undefined });
      } else if (d.source === IncrementalSource.Input) {
        out.push({ kind: 'input', t, targetId: typeof d.id === 'number' ? d.id : undefined });
      }
      continue;
    }

    if (ev?.type === EventType.Custom) {
      const payload = (d.payload ?? {}) as Record<string, unknown>;
      if (d.tag === ROUTE_TAG && typeof payload.url === 'string') {
        out.push({ kind: 'route', t, url: payload.url });
      } else if (d.tag === NETWORK_TAG) {
        out.push({
          kind: 'network',
          t,
          method: String(payload.method ?? 'GET'),
          url: String(payload.url ?? ''),
          status: typeof payload.status === 'number' ? payload.status : undefined,
          durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : undefined,
        });
      } else if (d.tag === ERROR_TAG) {
        out.push({
          kind: 'error',
          t,
          message: String(payload.message ?? 'Error'),
          stack: typeof payload.stack === 'string' ? payload.stack : undefined,
        });
      }
      continue;
    }

    if (ev?.type === EventType.Plugin && d.plugin === CONSOLE_PLUGIN) {
      const payload = (d.payload ?? {}) as { level?: string; payload?: unknown[] };
      out.push({
        kind: 'console',
        t,
        level: (payload.level as ConsoleLevel) ?? 'log',
        text: consoleText(payload.payload),
      });
    }
  }

  out.push(...clusterClicks(rawClicks));
  out.sort((a, b) => a.t - b.t);

  return {
    meta: {
      startTimestamp,
      endTimestamp,
      totalTime: Math.max(0, endTimestamp - startTimestamp),
      width,
      height,
      entryUrl,
      replayable: events.length >= 2 && hasSnapshot,
    },
    entries: out,
    events,
  };
}

/** rrweb console plugin stores args pre-stringified (often JSON-quoted). Join them
 *  into one readable line, stripping a single layer of surrounding quotes. */
function consoleText(args: unknown): string {
  if (!Array.isArray(args)) return '';
  return args
    .map((a) => {
      const s = String(a);
      return s.length > 1 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
    })
    .join(' ');
}

/** Collapse bursts of ≥RAGE_MIN_CLICKS on the same node within RAGE_WINDOW_MS into
 *  a single rageclick entry; emit the rest as individual clicks. */
function clusterClicks(clicks: { t: number; targetId?: number }[]): ReplayEntry[] {
  const result: ReplayEntry[] = [];
  let i = 0;
  while (i < clicks.length) {
    let j = i + 1;
    while (
      j < clicks.length &&
      clicks[j].targetId === clicks[i].targetId &&
      clicks[j].t - clicks[j - 1].t <= RAGE_WINDOW_MS
    ) {
      j++;
    }
    const count = j - i;
    if (count >= RAGE_MIN_CLICKS) {
      result.push({ kind: 'rageclick', t: clicks[i].t, count, targetId: clicks[i].targetId });
    } else {
      for (let k = i; k < j; k++) result.push({ kind: 'click', t: clicks[k].t, targetId: clicks[k].targetId });
    }
    i = j;
  }
  return result;
}
