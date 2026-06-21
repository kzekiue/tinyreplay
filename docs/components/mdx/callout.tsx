import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'note' | 'info' | 'warn' | 'danger' | 'ok';

const TONE: Record<Variant, { bar: string; ink: string; glyph: string }> = {
  note: { bar: 'var(--line-strong)', ink: 'var(--ink-2)', glyph: '·' },
  info: { bar: 'var(--accent)', ink: 'var(--accent-ink)', glyph: 'i' },
  warn: { bar: 'var(--warn)', ink: 'var(--warn)', glyph: '!' },
  danger: { bar: 'var(--danger)', ink: 'var(--danger)', glyph: '×' },
  ok: { bar: 'var(--ok)', ink: 'var(--ok)', glyph: '✓' },
};

/**
 * A bordered aside with a machined left rail and a monospace glyph chip.
 * <Callout type="warn" title="Heads up">…</Callout>
 */
export function Callout({
  type = 'info',
  title,
  children,
}: {
  type?: Variant;
  title?: string;
  children: ReactNode;
}) {
  const tone = TONE[type];
  return (
    <div className="tr-raise my-5 flex gap-3 rounded-[var(--radius)] p-4">
      <span
        aria-hidden
        className="tr-well mt-0.5 grid size-5 shrink-0 place-items-center rounded-[var(--radius-sm)] font-mono text-[0.7rem] leading-none"
        style={{ color: tone.ink }}
      >
        {tone.glyph}
      </span>
      <div className="min-w-0 text-[0.92rem] leading-relaxed text-[var(--ink-2)] [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {title && (
          <p
            className={cn('mb-1 font-medium')}
            style={{ color: 'var(--ink)' }}
          >
            {title}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
