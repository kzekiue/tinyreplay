'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ReplayDevice } from '@/components/home/replay-device';
import { Button } from '@/components/ui/button';
import { GITHUB_URL } from '@/lib/layout.config';

const COMMAND = 'docker compose up --build';

const ease = [0.22, 1, 0.36, 1] as const;

function CommandChip() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable - the command is visible to copy by hand */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="tr-well group flex w-full items-center gap-2.5 rounded-[var(--radius)] px-3 py-2.5 text-left font-mono text-[0.8rem] transition-colors hover:bg-[var(--surface)]"
    >
      <span className="select-none text-[var(--accent-ink)]">$</span>
      <span className="min-w-0 flex-1 truncate text-[var(--ink-2)]">{COMMAND}</span>
      <span className="tr-label shrink-0 normal-case tracking-normal text-[var(--faint)] group-hover:text-[var(--ink-2)]">
        {copied ? 'copied' : 'copy'}
      </span>
    </button>
  );
}

export function Hero() {
  const reduced = useReducedMotion();
  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease },
        };

  return (
    <section className="relative mx-auto max-w-3xl px-5 pt-20 pb-12 sm:pt-28">
      <div className="tr-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-72" />

      <motion.p {...rise(0)} className="tr-label mb-5 flex items-center gap-2">
        <span className="h-px w-6 bg-[var(--accent-line)]" />
        Small self-hosted session replay
      </motion.p>

      <motion.h1
        {...rise(0.06)}
        className="text-balance text-4xl font-semibold leading-[1.04] tracking-tight text-[var(--ink)] sm:text-6xl"
      >
        See exactly
        <br />
        what your users did.
      </motion.h1>

      <motion.p
        {...rise(0.12)}
        className="mt-6 max-w-xl text-[0.98rem] leading-relaxed text-[var(--muted)]"
      >
        TinyReplay records browser sessions, stores them in one SQLite file, and
        replays them on your own server.
        <span className="mt-2 block font-mono text-[0.84rem] text-[var(--ink-2)]">
          No analytics. No accounts. No cloud.
        </span>
      </motion.p>

      <motion.div {...rise(0.18)} className="mt-7 max-w-xl">
        <CommandChip />
      </motion.div>

      <motion.div {...rise(0.24)} className="mt-4 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/docs/getting-started/introduction">Get Started</Link>
        </Button>
        <Button variant="surface" asChild>
          <Link href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub ↗
          </Link>
        </Button>
      </motion.div>

      {/* A session replaying in the machined unit. */}
      <motion.div
        {...rise(0.32)}
        className="relative mt-12"
      >
        {/* Ambient anodized bloom behind the unit. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-8 -top-10 bottom-0 -z-10 opacity-60"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 30%, var(--accent-weak), transparent 70%)',
          }}
        />
        <ReplayDevice />
      </motion.div>
    </section>
  );
}
