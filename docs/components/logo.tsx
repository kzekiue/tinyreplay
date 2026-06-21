import { cn } from '@/lib/utils';

/**
 * The TinyReplay wordmark: the name in white, closed by one anodized full stop.
 * Pure type, no glyph - the dot is the whole brand. Used in the nav and footer.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn('font-semibold tracking-tight text-[var(--ink)]', className)}
    >
      tinyreplay<span className="text-[var(--accent)]">.</span>
    </span>
  );
}
