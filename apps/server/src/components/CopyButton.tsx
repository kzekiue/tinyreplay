'use client';

import { useRef, useState, type ReactNode } from 'react';
import { CopyIcon, CheckIcon } from './icons';

/** Copies a snippet to the clipboard with inline feedback. */
export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (s: 'copied' | 'failed') => {
    setState(s);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 1600);
  };

  let content: ReactNode = (
    <>
      <CopyIcon size={13} /> {label}
    </>
  );
  if (state === 'copied') {
    content = (
      <>
        <CheckIcon size={13} className="t-ok" /> Copied
      </>
    );
  } else if (state === 'failed') {
    content = "Couldn't copy";
  }

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => flash('copied'),
          () => flash('failed'),
        );
      }}
      aria-label={label}
      aria-live="polite"
    >
      {content}
    </button>
  );
}
