'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

export type TermLine = { text: string; tone?: 'muted' | 'ok' | 'accent' };

/**
 * A machined terminal that types its command, then streams startup log lines.
 * Animation starts when scrolled into view and respects reduced-motion.
 */
export function Terminal({
  command,
  lines = [],
  title = 'bash',
  className,
}: {
  command: string;
  lines?: TermLine[];
  title?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -20% 0px' });
  const reduced = useReducedMotion();

  const [typed, setTyped] = useState(reduced ? command : '');
  const [shown, setShown] = useState(reduced ? lines.length : 0);

  useEffect(() => {
    if (reduced || !inView) return;
    let i = 0;
    const type = setInterval(() => {
      i += 1;
      setTyped(command.slice(0, i));
      if (i >= command.length) clearInterval(type);
    }, 24);
    return () => clearInterval(type);
  }, [command, inView, reduced]);

  useEffect(() => {
    if (reduced || !inView) return;
    if (typed !== command) return;
    let n = 0;
    const reveal = setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= lines.length) clearInterval(reveal);
    }, 220);
    return () => clearInterval(reveal);
  }, [typed, command, lines.length, inView, reduced]);

  return (
    <div
      ref={ref}
      className={cn(
        'tr-raise-2 my-6 overflow-hidden rounded-[var(--radius-lg)]',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-3.5 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <i className="size-2.5 rounded-full bg-[var(--inset)] shadow-[var(--well)]" />
          <i className="size-2.5 rounded-full bg-[var(--inset)] shadow-[var(--well)]" />
          <i className="size-2.5 rounded-full bg-[var(--inset)] shadow-[var(--well)]" />
        </span>
        <span className="tr-label ml-1 normal-case tracking-normal">{title}</span>
        <span className="ml-auto flex gap-2.5" aria-hidden>
          <i className="tr-screw" />
          <i className="tr-screw" />
        </span>
      </div>
      <div className="bg-[var(--inset)] px-4 py-3.5 font-mono text-[0.82rem] leading-relaxed shadow-[var(--track)]">
        <div className="flex">
          <span className="mr-2 select-none text-[var(--accent-ink)]">$</span>
          <span className="text-[var(--ink)]">
            {typed}
            {typed !== command && !reduced && (
              <span className="ml-px inline-block h-[1.1em] w-[0.5ch] translate-y-[0.15em] animate-pulse bg-[var(--accent)] align-middle" />
            )}
          </span>
        </div>
        <div className="mt-1 space-y-0.5">
          {lines.slice(0, shown).map((l, i) => (
            <div
              key={i}
              className={cn(
                'transition-opacity duration-300',
                l.tone === 'ok' && 'text-[var(--ok)]',
                l.tone === 'accent' && 'text-[var(--accent-ink)]',
                (!l.tone || l.tone === 'muted') && 'text-[var(--muted)]',
              )}
            >
              {l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
