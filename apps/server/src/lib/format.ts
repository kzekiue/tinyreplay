/** Small, dependency-free formatting helpers for the dashboard. */

export function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = now - ts;
  if (diff < 0) return 'now';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return sec <= 1 ? 'now' : `${sec} seconds ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? '1 minute ago' : `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? '1 hour ago' : `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return day === 1 ? '1 day ago' : `${day} days ago`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return mon === 1 ? '1 month ago' : `${mon} months ago`;
  const yr = Math.floor(mon / 12);
  return yr === 1 ? '1 year ago' : `${yr} years ago`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null || ms < 0) return '-';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/** Derive a friendly browser name from a user-agent string. */
export function formatBrowser(ua: string | null): string | null {
  if (!ua) return null;
  // Order matters: Edge/Opera/Brave masquerade as Chrome, so test them first.
  if (/\bEdg(?:e|A|iOS)?\//.test(ua)) return 'Edge';
  if (/\bOPR\/|\bOpera\b/.test(ua)) return 'Opera';
  if (/\bFirefox\/|\bFxiOS\//.test(ua)) return 'Firefox';
  if (/\bChrome\/|\bCriOS\//.test(ua)) return 'Chrome';
  if (/\bVersion\/.*\bSafari\//.test(ua) || /\biPhone|iPad\b/.test(ua)) return 'Safari';
  if (/\bSafari\//.test(ua)) return 'Safari';
  return null;
}

/** Compact count: 1234 -> "1.2k". Keeps small numbers exact. */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (n < 1_000_000) return Math.round(n / 1000) + 'k';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'm';
}

/** Pretty path + host for a recorded entry URL, gracefully handling bad input. */
export function formatEntryUrl(raw: string): { host: string; path: string } {
  try {
    const u = new URL(raw);
    const path = (u.pathname + u.search) || '/';
    return { host: u.host, path };
  } catch {
    return { host: '', path: raw || '/' };
  }
}

/** ms → `m:ss` clock (e.g. 67000 → "1:07"). For the player transport/timeline. */
export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
