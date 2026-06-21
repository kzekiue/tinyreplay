/**
 * Basic-auth check for the dashboard, gated by DASHBOARD_PASSWORD. Runs in
 * Next middleware (edge runtime), so it uses only web-standard APIs - no
 * node:crypto. The username is ignored; only the password matters.
 */

/** Constant-time string equality (length is allowed to leak, values are not). */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function isAuthorized(authorizationHeader: string | null, password: string): boolean {
  if (!authorizationHeader || !authorizationHeader.startsWith('Basic ')) return false;
  let decoded: string;
  try {
    decoded = atob(authorizationHeader.slice('Basic '.length));
  } catch {
    return false;
  }
  const colon = decoded.indexOf(':');
  if (colon === -1) return false;
  // Everything after the first colon is the password (passwords may contain colons).
  return timingSafeEqualStr(decoded.slice(colon + 1), password);
}
