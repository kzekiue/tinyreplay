import type { ReactNode } from 'react';
import {
  RouteIcon, ClickIcon, RageIcon, KeyboardIcon, TerminalIcon, NetworkIcon, AlertIcon,
} from '@/components/icons';
import type { ReplayEntry } from '@/lib/replay-events';

export interface EntryView {
  icon: ReactNode;
  /** Signal tone class (t-route / t-error / …) shared by rows + timeline markers. */
  tone: string;
  /** Timeline marker class suffix, so the scrub studs match the row tones. */
  marker: string;
  label: string;
  detail?: string;
}

function levelTone(level: 'error' | 'warn' | string): string {
  if (level === 'error') return 't-error';
  if (level === 'warn') return 't-warn';
  return 't-mute';
}

/** Single mapping from a parsed entry to its visual identity. Used by rows,
 *  timeline markers, and tooltips so the language is identical everywhere. */
export function viewEntry(e: ReplayEntry): EntryView {
  switch (e.kind) {
    case 'route':
      return { icon: <RouteIcon size={14} />, tone: 't-route', marker: 't-route', label: 'Route change', detail: e.url };
    case 'click':
      return { icon: <ClickIcon size={14} />, tone: 't-mute', marker: 't-mute', label: 'Click' };
    case 'rageclick':
      return { icon: <RageIcon size={14} />, tone: 't-warn', marker: 't-warn', label: 'Rage click', detail: `${e.count} clicks` };
    case 'input':
      return { icon: <KeyboardIcon size={14} />, tone: 't-mute', marker: 't-mute', label: 'Form input', detail: 'masked' };
    case 'console':
      return {
        icon: <TerminalIcon size={14} />,
        tone: levelTone(e.level),
        marker: levelTone(e.level),
        label: `console.${e.level}`,
        detail: e.text,
      };
    case 'network':
      return {
        icon: <NetworkIcon size={14} />,
        tone: (e.status ?? 0) >= 400 ? 't-error' : 't-net',
        marker: (e.status ?? 0) >= 400 ? 't-error' : 't-net',
        label: `${e.method} ${e.status ?? ''}`.trim(),
        detail: e.url,
      };
    case 'error':
      return { icon: <AlertIcon size={14} />, tone: 't-error', marker: 't-error', label: 'Error', detail: e.message };
  }
}
