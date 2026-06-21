/**
 * Network + error capture for the recorder. Deliberately decoupled from rrweb: each
 * installer takes an `emit` callback so the recorder decides how to forward the data
 * (it uses rrweb custom events). This keeps the hooks unit-testable in jsdom.
 *
 * PRIVACY: network capture is METADATA ONLY - method, url, status, timing. Request
 * and response headers and bodies are never read. Do not add body capture here.
 */

const MAX_STACK = 2000;

export interface NetworkEntryPayload {
  method: string;
  url: string;
  status: number;
  durationMs: number;
}
export type NetworkEmit = (entry: NetworkEntryPayload) => void;

export interface ErrorEntryPayload {
  message: string;
  stack?: string;
}
export type ErrorEmit = (entry: ErrorEntryPayload) => void;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url ?? '';
}
function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input === 'object' && input !== null && 'method' in input) {
    return String((input as Request).method ?? 'GET').toUpperCase();
  }
  return 'GET';
}

/** Patch fetch + XHR to emit request metadata. `ignore(url)` suppresses the SDK's
 *  own ingest traffic. Returns an uninstall that restores the originals. */
export function installNetworkCapture({ ignore, emit }: { ignore: (url: string) => boolean; emit: NetworkEmit }): () => void {
  const origFetch = window.fetch;
  const OrigXHR = window.XMLHttpRequest;

  window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const url = urlOf(input);
    if (ignore(url)) return origFetch(input as never, init);
    const method = methodOf(input, init);
    const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    try {
      const res = await origFetch(input as never, init);
      emit({ method, url, status: res.status, durationMs: Math.round((performance?.now?.() ?? Date.now()) - start) });
      return res;
    } catch (err) {
      emit({ method, url, status: 0, durationMs: Math.round((performance?.now?.() ?? Date.now()) - start) });
      throw err;
    }
  } as typeof window.fetch;

  class PatchedXHR extends OrigXHR {
    private _trMethod = 'GET';
    private _trUrl = '';
    private _trStart = 0;
    override open(method: string, url: string | URL, ...rest: unknown[]): void {
      this._trMethod = String(method).toUpperCase();
      this._trUrl = typeof url === 'string' ? url : url.href;
      // @ts-expect-error XMLHttpRequest.open has no overload typing a rest parameter; forward the originals unchanged.
      return super.open(method, url, ...rest);
    }
    override send(body?: Document | XMLHttpRequestBodyInit | null): void {
      if (!ignore(this._trUrl)) {
        this._trStart = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        this.addEventListener('loadend', () => {
          emit({
            method: this._trMethod,
            url: this._trUrl,
            status: this.status,
            durationMs: Math.round((performance?.now?.() ?? Date.now()) - this._trStart),
          });
        });
      }
      return super.send(body);
    }
  }
  window.XMLHttpRequest = PatchedXHR as unknown as typeof XMLHttpRequest;

  return () => {
    window.fetch = origFetch;
    window.XMLHttpRequest = OrigXHR;
  };
}

/** Capture uncaught errors + unhandled promise rejections. Returns an uninstall. */
export function installErrorCapture({ emit }: { emit: ErrorEmit }): () => void {
  const onError = (e: ErrorEvent) => {
    emit({
      message: e.message || 'Error',
      stack: e.error?.stack?.slice(0, MAX_STACK),
    });
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    const r = e.reason;
    emit({
      message: typeof r?.message === 'string' ? r.message : String(r),
      stack: typeof r?.stack === 'string' ? r.stack.slice(0, MAX_STACK) : undefined,
    });
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
