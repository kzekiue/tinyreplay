'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A moulded feature card. Lifts slightly on hover; fades up on scroll.
 * <FeatureCard label="ONE DOCKER COMMAND" index={0}>Local SQLite storage.</FeatureCard>
 */
export function FeatureCard({
  label,
  index = 0,
  children,
  className,
}: {
  label: string;
  index?: number;
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={reduced ? undefined : { y: -3 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'group relative flex flex-col gap-1.5 rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface)] bg-[image:var(--key-face)] px-4 py-3.5',
        'shadow-[var(--key-raise)] transition-shadow duration-200 hover:shadow-[var(--key-hover)]',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]" />
        <span className="tr-label text-[var(--ink-2)]">{label}</span>
      </div>
      <div className="text-[0.875rem] leading-snug text-[var(--muted)] [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {children}
      </div>
    </motion.div>
  );
}
