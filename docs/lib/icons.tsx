import type { ReactElement } from 'react';

/**
 * Tiny inline icon set for sidebar sections. Hand-drawn 16px strokes instead of
 * pulling a whole icon dependency - the docs only need a handful.
 */
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const paths: Record<string, ReactElement> = {
  rocket: (
    <svg {...base}>
      <path d="M5 11c-1.5 0-3 1.5-3 3 0-1.5 1.5-3 3-3Z" />
      <path d="M8.5 9.5 6.5 7.5c1-3 3.5-5 6.5-5 0 3-2 5.5-5 6.5Z" />
      <circle cx="10.5" cy="5.5" r="0.6" />
    </svg>
  ),
  cube: (
    <svg {...base}>
      <path d="M8 1.6 14 5v6l-6 3.4L2 11V5Z" />
      <path d="M2 5l6 3.4L14 5" />
      <path d="M8 8.4V14.4" />
    </svg>
  ),
  server: (
    <svg {...base}>
      <rect x="2.2" y="2.4" width="11.6" height="4.2" rx="1" />
      <rect x="2.2" y="9.4" width="11.6" height="4.2" rx="1" />
      <path d="M4.6 4.5h0.01M4.6 11.5h0.01" />
    </svg>
  ),
  shield: (
    <svg {...base}>
      <path d="M8 1.8 13 3.6v3.8c0 3.2-2.1 5.3-5 6.8-2.9-1.5-5-3.6-5-6.8V3.6Z" />
      <path d="M5.8 8 7.4 9.6 10.4 6.2" />
    </svg>
  ),
  flow: (
    <svg {...base}>
      <rect x="2" y="2.4" width="4.4" height="3.2" rx="0.8" />
      <rect x="9.6" y="10.4" width="4.4" height="3.2" rx="0.8" />
      <path d="M4.2 5.6v3.2a2 2 0 0 0 2 2h3.4" />
    </svg>
  ),
};

/** Resolver passed to the Fumadocs loader; maps a meta.json `icon` string. */
export function getIcon(name?: string): ReactElement | undefined {
  if (!name) return undefined;
  return paths[name];
}
