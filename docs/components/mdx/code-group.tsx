'use client';

import {
  Children,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

/** One labelled panel inside a <CodeGroup>. Wraps a fenced code block. */
export function CodeGroupPanel({
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return <>{children}</>;
}

type PanelEl = ReactElement<{ label: string; children: ReactNode }>;

/**
 * Tabbed code with a sliding active indicator. Children are <CodeGroupPanel>s;
 * the fenced code inside keeps Fumadocs syntax highlighting + copy button.
 */
export function CodeGroup({ children }: { children: ReactNode }) {
  const panels = Children.toArray(children).filter(
    (c): c is PanelEl => isValidElement(c),
  );
  const [active, setActive] = useState(0);

  return (
    <div className="tr-raise-2 my-6 overflow-hidden rounded-[var(--radius-lg)]">
      <div className="border-b border-[var(--line)] bg-[var(--panel)] p-2">
        <div
          role="tablist"
          className="tr-track flex gap-[3px] rounded-[var(--radius-sm)] p-1"
        >
          {panels.map((p, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={active === i}
              onClick={() => setActive(i)}
              className={cn(
                'flex-1 rounded-[calc(var(--radius-sm)-1px)] px-3 py-1.5 font-mono text-[0.74rem] font-medium',
                'origin-bottom transition-[color,background-color,box-shadow,transform] duration-150',
                active === i
                  ? 'bg-[var(--surface)] bg-[image:var(--key-face)] text-[var(--accent-ink)] shadow-[var(--key-raise)]'
                  : 'text-[var(--muted)] hover:bg-[var(--hover-film)] hover:text-[var(--ink)] active:translate-y-px',
              )}
            >
              {p.props.label}
            </button>
          ))}
        </div>
      </div>
      <div className="[&_figure]:my-0 [&_pre]:rounded-none [&_pre]:border-0">
        {panels[active]}
      </div>
    </div>
  );
}
