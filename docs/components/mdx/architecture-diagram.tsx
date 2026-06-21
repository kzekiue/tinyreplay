'use client';

import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

type Node = { label: string; sub: string; tag: string };

const NODES: Node[] = [
  { label: 'Browser SDK', sub: 'rrweb capture + masking', tag: '01' },
  { label: 'Batch Transport', sub: 'buffer · flush · beacon', tag: '02' },
  { label: 'Ingest API', sub: 'POST /api/ingest', tag: '03' },
  { label: 'SQLite', sub: 'sessions · events (WAL)', tag: '04' },
  { label: 'Replay Dashboard', sub: 'scrub · inspect', tag: '05' },
];

// One dot travels the whole chain, handing off segment to segment: each
// connector moves for `TRAVEL`s starting right as the one above finishes, then
// every connector shares the same period so they never drift out of sync.
const TRAVEL = 0.5;
const END_PAUSE = 1.1;

function Connector({
  index,
  count,
  reduced,
}: {
  index: number;
  count: number;
  reduced: boolean;
}) {
  const period = count * TRAVEL + END_PAUSE;
  return (
    <div className="relative mx-auto h-7 w-px bg-[var(--line-strong)]">
      {!reduced && (
        <motion.span
          className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[var(--accent)]"
          style={{ boxShadow: '0 0 8px 1px var(--accent)' }}
          initial={{ top: -2, opacity: 0 }}
          animate={{ top: ['-2px', '26px'], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: TRAVEL,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatDelay: period - TRAVEL,
            delay: index * TRAVEL,
          }}
        />
      )}
    </div>
  );
}

/** Vertical Browser→Transport→Ingest→SQLite→Dashboard flow with pulses. */
export function ArchitectureDiagram({ className }: { className?: string }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <div className={cn('my-8 flex flex-col items-center', className)}>
      {NODES.map((n, i) => (
        <div key={n.tag} className="flex flex-col items-center">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
            className="flex w-[min(20rem,80vw)] items-center gap-3 rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface)] bg-[image:var(--key-face)] px-4 py-3 shadow-[var(--key-raise)]"
          >
            <span className="tr-lcd grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] font-mono text-[0.66rem]">
              {n.tag}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.9rem] font-medium text-[var(--ink)]">
                {n.label}
              </span>
              <span className="block font-mono text-[0.7rem] text-[var(--muted)]">
                {n.sub}
              </span>
            </span>
          </motion.div>
          {i < NODES.length - 1 && (
            <Connector index={i} count={NODES.length - 1} reduced={reduced} />
          )}
        </div>
      ))}
    </div>
  );
}
