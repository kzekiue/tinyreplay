import Link from 'next/link';
import { Wordmark } from '@/components/logo';
import { GITHUB_URL } from '@/lib/layout.config';

export function Footer() {
  return (
    <footer className="mt-8 border-t border-[var(--line)] bg-[var(--panel)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Wordmark className="text-[0.95rem]" />
          <span className="font-mono text-[0.78rem] text-[var(--muted)]">
            session replay. nothing else.
          </span>
        </div>
        <nav className="flex gap-5 text-[0.82rem] text-[var(--muted)]">
          <Link href="/docs/getting-started/introduction" className="hover:text-[var(--ink)]">
            Docs
          </Link>
          <Link href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-[var(--ink)]">
            GitHub
          </Link>
          <Link href="/rss.xml" className="hover:text-[var(--ink)]">
            RSS
          </Link>
        </nav>
      </div>
    </footer>
  );
}
