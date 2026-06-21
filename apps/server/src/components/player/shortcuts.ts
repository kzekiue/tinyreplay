'use client';

import { useEffect, useRef } from 'react';
import { SHORTCUTS } from './shortcuts-and-speed';
export { SHORTCUTS };

export interface ShortcutHandlers {
  toggle: () => void;
  skipForward: () => void;
  skipBack: () => void;
  speedUp: () => void;
  speedDown: () => void;
  toggleTheater: () => void;
  exitTheater: () => void;
}

function typingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
}

/** Binds the player keyboard map. No-ops while the user is typing in a field.
 *  Handlers are read through a ref so the listener binds once per `enabled`
 *  change, not on every render (they close over fast-changing playhead state). */
export function useShortcuts(h: ShortcutHandlers, enabled: boolean) {
  const ref = useRef(h);
  ref.current = h;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (typingTarget(e.target)) return;
      const handlers = ref.current;
      switch (e.key) {
        case ' ': e.preventDefault(); handlers.toggle(); break;
        case 'ArrowRight': e.preventDefault(); handlers.skipForward(); break;
        case 'ArrowLeft': e.preventDefault(); handlers.skipBack(); break;
        case 'ArrowUp': e.preventDefault(); handlers.speedUp(); break;
        case 'ArrowDown': e.preventDefault(); handlers.speedDown(); break;
        case 'f': case 'F': e.preventDefault(); handlers.toggleTheater(); break;
        case 'Escape': handlers.exitTheater(); break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}
