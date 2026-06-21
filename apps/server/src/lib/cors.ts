/**
 * CORS handling driven by ALLOWED_ORIGINS (comma-separated, or "*" for any).
 * Default is "*" so the demo works out of the box; lock it down in production.
 */

import { config } from '@/lib/config';

function allowedOrigins(): string[] {
  return config
    .allowedOrigins()
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function resolveAllowOrigin(requestOrigin: string | null): string | null {
  const allowed = allowedOrigins();
  if (allowed.includes('*')) return '*';
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return null;
}

export function corsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = resolveAllowOrigin(requestOrigin);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
