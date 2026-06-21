/**
 * PII / PRIVACY NOTICE
 * --------------------
 * This recorder wraps rrweb. Masking is applied by rrweb at capture time, before
 * any event is buffered or transmitted:
 *   - maskAllInputs masks every <input>/<textarea>/<select> value (default on).
 *   - [data-tr-mask] masks an element's (and its subtree's) text content.
 *   - [data-tr-ignore] blocks an element (and its subtree) from being recorded.
 *
 * Captured for debugging (all stored only on your own TinyReplay server):
 *   - Console output (log/info/warn/error) via rrweb's console plugin. Avoid
 *     logging secrets; console capture records argument values as text.
 *   - Network request METADATA ONLY - method, URL, status, duration. Request and
 *     response HEADERS and BODIES are never read or stored.
 *   - Uncaught errors / unhandled promise rejections (message + stack).
 *
 * The SDK still never captures cookies, localStorage, or sessionStorage (other than
 * its own session id). The recorder ignores its own ingest requests so it never
 * records itself.
 */

import { record } from 'rrweb';
import { getRecordConsolePlugin } from '@rrweb/rrweb-plugin-console-record';
import { buildMaskingOptions } from './masking';
import { Transport } from './transport';
import { getOrCreateSessionId, getViewportMeta } from './session';
import { installNetworkCapture, installErrorCapture } from './capture';
import type { IngestPayload, TinyReplayConfig } from './types';
import { NETWORK_EVENT_TAG, ERROR_EVENT_TAG } from './types';

/** rrweb custom-event tag emitted on SPA route changes. The server counts these
 *  to derive page_count without needing to understand the rest of the stream. */
export const ROUTE_EVENT_TAG = 'tinyreplay/route';

const DEFAULT_FLUSH_INTERVAL = 5000;
/** rrweb full snapshot can be large; cap batches so a flush never exceeds the
 *  server's 500-event limit. Overflow rolls into the next flush. */
const MAX_EVENTS_PER_FLUSH = 500;
/** Hard ceiling on buffered events so a dead network can never grow memory
 *  unbounded. When full, new events are dropped (the initial snapshot at the
 *  front of the buffer is the part a replay cannot live without). */
const MAX_BUFFER_EVENTS = 5000;
/** sendBeacon queues are limited (~64KB); unload flushes go out in small chunks. */
const BEACON_CHUNK_EVENTS = 120;
/** Default max recording duration: 30 minutes. */
const DEFAULT_MAX_DURATION_MS = 30 * 60_000;

export class Recorder {
  private readonly transport: Transport;
  private readonly projectId: string;
  private readonly token?: string;
  private readonly flushInterval: number;
  private readonly maxDurationMs: number;
  private readonly maskAllInputs: boolean;
  private readonly debug: boolean;

  private sessionId = '';
  private buffer: unknown[] = [];
  private seq = 0;
  private startedAt = 0;
  private startUrl = '';

  private stopRecording?: () => void;
  private uninstallNetwork?: () => void;
  private uninstallErrors?: () => void;
  private flushTimer?: ReturnType<typeof setInterval>;
  private maxDurationTimer?: ReturnType<typeof setTimeout>;
  private warnedBufferFull = false;
  private flushing = false;
  private origPushState?: typeof history.pushState;
  private origReplaceState?: typeof history.replaceState;
  private running = false;

  constructor(config: Required<Pick<TinyReplayConfig, 'projectId' | 'endpoint'>> & TinyReplayConfig) {
    this.projectId = config.projectId;
    this.token = config.token;
    this.flushInterval = config.flushInterval ?? DEFAULT_FLUSH_INTERVAL;
    this.maxDurationMs = config.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
    this.maskAllInputs = config.maskAllInputs ?? true;
    this.debug = config.debug ?? false;
    this.transport = new Transport({ endpoint: config.endpoint, debug: this.debug });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.sessionId = getOrCreateSessionId();
    this.startedAt = Date.now();
    this.startUrl = window.location.href;

    const masking = buildMaskingOptions(this.maskAllInputs);
    this.stopRecording = record({
      emit: (event) => {
        if (this.buffer.length >= MAX_BUFFER_EVENTS) {
          if (this.debug && !this.warnedBufferFull) {
            this.warnedBufferFull = true;
            console.warn('[TinyReplay] event buffer full, dropping new events');
          }
          return;
        }
        this.buffer.push(event);
        if (this.debug) console.debug('[TinyReplay] event', event);
      },
      maskAllInputs: masking.maskAllInputs,
      // Per-input opt-out lives in maskInputFn (see masking.ts); data-tr-unmask
      // inputs are captured in the clear, everything else masked.
      maskInputFn: masking.maskInputFn,
      maskTextSelector: masking.maskTextSelector,
      blockSelector: masking.blockSelector,
      plugins: [
        getRecordConsolePlugin({
          level: ['log', 'info', 'warn', 'error'],
          lengthThreshold: 1000,
          stringifyOptions: { stringLengthLimit: 1000, numOfKeysLimit: 50, depthOfLimit: 4 },
        }),
      ],
    });

    this.installRouteTracking();
    this.uninstallNetwork = installNetworkCapture({
      // Never record our own flush traffic - it would create a capture loop.
      ignore: (url) => url.includes('/api/ingest'),
      emit: (entry) => record.addCustomEvent(NETWORK_EVENT_TAG, entry),
    });
    this.uninstallErrors = installErrorCapture({
      emit: (entry) => record.addCustomEvent(ERROR_EVENT_TAG, entry),
    });
    this.flushTimer = setInterval(() => void this.flush(), this.flushInterval);
    if (this.maxDurationMs > 0) {
      this.maxDurationTimer = setTimeout(() => void this.stop(), this.maxDurationMs);
    }
    window.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    // Mobile Safari never fires beforeunload; pagehide is the reliable signal.
    window.addEventListener('pagehide', this.onPageHide);
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.maxDurationTimer) clearTimeout(this.maxDurationTimer);
    window.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    window.removeEventListener('pagehide', this.onPageHide);
    this.uninstallRouteTracking();
    this.uninstallNetwork?.();
    this.uninstallErrors?.();
    this.uninstallNetwork = undefined;
    this.uninstallErrors = undefined;
    this.stopRecording?.();
    this.stopRecording = undefined;

    // Drain everything - stop() is the last chance to get events out.
    let payload: IngestPayload | null;
    while ((payload = this.takePayload())) {
      await this.transport.send(payload);
    }
  }

  /** Async flush over fetch (with one retry inside Transport). Guarded so a slow
   *  send (network + retry can exceed the flush interval) never overlaps the next
   *  tick - concurrent sends would deliver seq out of order to the server. */
  private async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const payload = this.takePayload();
      if (!payload) return;
      await this.transport.send(payload);
    } finally {
      this.flushing = false;
    }
  }

  /** Synchronous best-effort flush for page teardown: drain the buffer as a
   *  series of small beacons (sendBeacon queues are size-limited). */
  private flushBeacon(): void {
    let payload: IngestPayload | null;
    while ((payload = this.takePayload(BEACON_CHUNK_EVENTS))) {
      this.transport.sendBeacon(payload);
    }
  }

  /** Drain up to maxEvents events into a payload, or null if empty. */
  private takePayload(maxEvents: number = MAX_EVENTS_PER_FLUSH): IngestPayload | null {
    if (this.buffer.length === 0) return null;
    const events = this.buffer.splice(0, maxEvents);
    const seq = this.seq++;
    const payload: IngestPayload = {
      projectId: this.projectId,
      sessionId: this.sessionId,
      seq,
      events,
    };
    if (this.token) payload.token = this.token;
    if (seq === 0) {
      payload.startedAt = this.startedAt;
      payload.url = this.startUrl;
      payload.viewport = getViewportMeta();
    }
    return payload;
  }

  private installRouteTracking(): void {
    const onRoute = () => {
      record.addCustomEvent(ROUTE_EVENT_TAG, { url: window.location.href });
    };
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    this.origPushState = history.pushState;
    this.origReplaceState = history.replaceState;
    history.pushState = (...args) => {
      origPush(...args);
      onRoute();
    };
    history.replaceState = (...args) => {
      origReplace(...args);
      onRoute();
    };
    window.addEventListener('popstate', onRoute);
    this.onPopState = onRoute;
  }

  private onPopState?: () => void;

  private uninstallRouteTracking(): void {
    if (this.origPushState) history.pushState = this.origPushState;
    if (this.origReplaceState) history.replaceState = this.origReplaceState;
    if (this.onPopState) window.removeEventListener('popstate', this.onPopState);
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.flushBeacon();
  };

  private readonly onBeforeUnload = (): void => {
    this.flushBeacon();
  };

  private readonly onPageHide = (): void => {
    this.flushBeacon();
  };
}
