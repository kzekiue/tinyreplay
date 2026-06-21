'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { ProjectStat } from '@/lib/queries';
import { readToken, setToken } from '@/lib/filter-token';

/** Header scope selector. A project is a scope (which app am I in), not a
 *  refinement filter, so it lives on the faceplate, not in the rail. Reads and
 *  writes the same `project:` token as the search box, preserving any other
 *  active filters. Adapts to project count: nothing at 1 or fewer, a segmented
 *  bank at 2 to 4, an LCD readout plus popover at 5 or more.
 *
 *  Unnamed (project_id = '') sessions cannot be expressed as a token because the
 *  value is empty, so they are not offered as a scope; they only show under
 *  "All". */
export function ScopeSelector({ projects }: { projects: ProjectStat[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const active = readToken(q, 'project');

  const named = projects.filter((p) => p.id);
  if (named.length < 2) return null; // no scope to choose

  const total = projects.reduce((n, p) => n + p.count, 0);

  // Switching scope changes context, so land on the tray (no open session) but
  // keep the rest of the filter string intact.
  const go = (id: string) => {
    const next = setToken(q, 'project', id);
    router.push(next ? `/?q=${encodeURIComponent(next)}` : '/');
  };

  if (named.length <= 4) {
    return (
      <div className="scope-seg" role="group" aria-label="Project scope">
        <button
          type="button"
          className="seg"
          aria-pressed={active === ''}
          onClick={() => go('')}
        >
          All
        </button>
        {named.map((p) => (
          <button
            key={p.id}
            type="button"
            className="seg scope-segbtn"
            aria-pressed={active === p.id}
            onClick={() => go(p.id)}
            title={p.id}
          >
            <span className="scope-name">{p.id}</span>
            {p.errors > 0 ? <span className="scope-warn" aria-label="has errors">!</span> : null}
          </button>
        ))}
      </div>
    );
  }

  const cur = active ? named.find((p) => p.id === active) : null;

  return (
    <details className="scope">
      <summary className="scope-face" aria-label="Project scope">
        <span className={`scope-led${active ? ' is-on' : ''}`} aria-hidden="true" />
        <span className="scope-cur">{cur ? cur.id : 'All projects'}</span>
        <span className="scope-count mono">{(cur ? cur.count : total).toLocaleString()}</span>
        <span className="scope-caret" aria-hidden="true">▾</span>
      </summary>
      <div className="scope-menu" role="menu">
        <Row label="All projects" count={total} on={!active} onPick={() => go('')} />
        {named.map((p) => (
          <Row
            key={p.id}
            label={p.id}
            count={p.count}
            errors={p.errors}
            on={active === p.id}
            onPick={() => go(p.id)}
          />
        ))}
      </div>
    </details>
  );
}

function Row({
  label,
  count,
  errors = 0,
  on,
  onPick,
}: {
  label: string;
  count: number;
  errors?: number;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={on}
      className={`scope-row${on ? ' is-on' : ''}`}
      title={label}
      onClick={(e) => {
        e.currentTarget.closest('details')?.removeAttribute('open');
        onPick();
      }}
    >
      <span className={`scope-led${on ? ' is-on' : ''}`} aria-hidden="true" />
      <span className="scope-rowname">{label}</span>
      {errors > 0 ? <span className="scope-warn" aria-label="has errors">!</span> : null}
      <span className="scope-count mono">{count.toLocaleString()}</span>
    </button>
  );
}
