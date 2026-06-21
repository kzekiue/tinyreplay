export const SPEEDS = [1, 2, 4, 8] as const;
export type Speed = (typeof SPEEDS)[number];

export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'Space', label: 'Play / pause' },
  { keys: '→', label: 'Skip forward 10s' },
  { keys: '←', label: 'Skip back 10s' },
  { keys: '↑', label: 'Speed up' },
  { keys: '↓', label: 'Slow down' },
  { keys: 'F', label: 'Theater mode' },
  { keys: 'Esc', label: 'Exit theater' },
];
