import { ArchitectureDiagram } from '@/components/mdx/architecture-diagram';
import { FadeUp } from '@/components/motion/fade-up';

export function ArchitectureSection() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-12">
      <FadeUp>
        <p className="tr-label mb-2 flex items-center gap-2">
          <span className="h-px w-6 bg-[var(--accent-line)]" />
          How it flows
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
          Five small parts, one direction.
        </h2>
        <p className="mt-2 max-w-md text-[0.92rem] text-[var(--muted)]">
          Events flow one way: captured in the browser, batched, posted to the
          ingest API, and written to SQLite. The dashboard only ever reads them
          back.
        </p>
      </FadeUp>
      <ArchitectureDiagram />
    </section>
  );
}
