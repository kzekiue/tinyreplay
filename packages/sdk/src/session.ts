import type { DeviceType, ViewportMeta } from './types';

const STORAGE_KEY = 'tinyreplay_session_id';

/**
 * Generate a RFC4122 v4 UUID. Uses crypto.randomUUID when available,
 * otherwise falls back to crypto.getRandomValues so we never pull in a dependency.
 */
export function generateSessionId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  // Per RFC4122 §4.4: set version (4) and variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}

/**
 * Get the current session id, generating and persisting a new one if absent.
 * We use sessionStorage (not localStorage) so the id clears on tab close - a
 * session is scoped to a single tab lifetime, never tracked across visits.
 */
export function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = generateSessionId();
    sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // sessionStorage can throw (private mode, disabled storage). Fall back to
    // an in-memory id so recording still works for the current page load.
    return generateSessionId();
  }
}

export function detectDeviceType(): DeviceType {
  const ua = navigator.userAgent;
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function getViewportMeta(): ViewportMeta {
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    deviceType: detectDeviceType(),
    userAgent: navigator.userAgent,
  };
}
