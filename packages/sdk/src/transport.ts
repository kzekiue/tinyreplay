// NO TELEMETRY
// This file's sole purpose is to POST recorded session events to the
// user's own TinyReplay server (config.endpoint). It makes no other network
// calls and reports nothing to any third party.

import type { IngestPayload } from './types';

const INGEST_PATH = '/api/ingest';
const RETRY_DELAY_MS = 2000;

export interface TransportOptions {
  endpoint: string;
  debug: boolean;
}

export class Transport {
  private readonly url: string;
  private readonly debug: boolean;

  constructor(opts: TransportOptions) {
    this.url = opts.endpoint.replace(/\/+$/, '') + INGEST_PATH;
    this.debug = opts.debug;
  }

  /**
   * Send a batch. Retries once after RETRY_DELAY_MS on failure, then drops the
   * batch silently - recording must never block or break the host page.
   */
  async send(payload: IngestPayload): Promise<void> {
    try {
      await this.post(payload);
    } catch (err) {
      this.log('flush failed, retrying once', err);
      await delay(RETRY_DELAY_MS);
      try {
        await this.post(payload);
      } catch (err2) {
        this.log('flush failed again, dropping batch', err2);
      }
    }
  }

  /**
   * Best-effort synchronous send for page-unload. sendBeacon is preferred here
   * because the browser guarantees delivery even as the page is torn down,
   * which fetch (even with keepalive) does not reliably do on unload.
   */
  sendBeacon(payload: IngestPayload): void {
    try {
      const body = JSON.stringify(payload);
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        const ok = navigator.sendBeacon(this.url, blob);
        if (ok) return;
      }
      // Fallback: keepalive fetch (fire-and-forget).
      void fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch (err) {
      this.log('beacon failed', err);
    }
  }

  private async post(payload: IngestPayload): Promise<void> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`ingest responded ${res.status}`);
    }
  }

  private log(...args: unknown[]): void {
    if (this.debug) console.warn('[TinyReplay]', ...args);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
