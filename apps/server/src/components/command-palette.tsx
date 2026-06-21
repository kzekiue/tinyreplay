'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  SearchIcon,
  KeyboardIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  AlertIcon,
  GlobeIcon,
} from './icons';
import { SHORTCUTS } from './player/shortcuts-and-speed';
import { applyTheme } from '@/lib/theme';
import { relativeTime, formatEntryUrl } from '@/lib/format';
import type { ProjectStat } from '@/lib/queries';

interface SessionHit {
  id: string;
  url: string;
  started_at: number;
  error_count: number;
}

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  run: () => void;
}

const GLOBAL_KEYS = [
  { keys: '⌘ K', label: 'Open command palette' },
  { keys: '/', label: 'Search sessions' },
  { keys: '?', label: 'Keyboard shortcuts' },
];

/** Global command palette + jump-to-session typeahead. Owns the faceplate ⌘K
 *  trigger and a native <dialog> (top layer, focus-trapped, Esc + backdrop
 *  close, focus restored to the trigger on close). */
export function CommandPalette({
  projects = [],
}: {
  projects?: ProjectStat[];
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'commands' | 'help'>('commands');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SessionHit[]>([]);
  const [active, setActive] = useState(0);
  const listId = useId();

  const close = useCallback(() => dialogRef.current?.close(), []);

  const openPalette = useCallback((v: 'commands' | 'help' = 'commands') => {
    setView(v);
    setQ('');
    setHits([]);
    setActive(0);
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    setOpen(true);
  }, []);

  // Global hotkeys: ⌘/Ctrl-K anywhere; ? when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openPalette('commands');
        return;
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        openPalette('help');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openPalette]);

  useEffect(() => {
    if (open && view === 'commands') inputRef.current?.focus();
  }, [open, view]);

  // Session typeahead, debounced and abortable.
  useEffect(() => {
    if (!open || view !== 'commands' || !q.trim()) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/sessions?q=${encodeURIComponent(q.trim())}`, {
          signal: ctrl.signal,
          cache: 'no-store',
        });
        if (r.ok) setHits((await r.json()).sessions ?? []);
      } catch {
        /* aborted */
      }
    }, 150);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q, open, view]);

  const commands: Command[] = useMemo(() => {
    // Only offer scope jumps when there's more than one project to pick between.
    const named = projects.filter((p) => p.id);
    const scopeCmds: Command[] =
      named.length > 1
        ? [
            { id: 'scope-all', label: 'Scope: All projects', icon: <GlobeIcon size={15} />, run: () => router.push('/') },
            ...named.map((p) => ({
              id: `scope-${p.id}`,
              label: `Scope: ${p.id}`,
              icon: <GlobeIcon size={15} />,
              run: () => router.push(`/?q=project:${encodeURIComponent(p.id)}`),
            })),
          ]
        : [];
    return [
      ...scopeCmds,
      { id: 'theme-system', label: 'Theme: System', icon: <MonitorIcon size={15} />, run: () => applyTheme('system') },
      { id: 'theme-light', label: 'Theme: Light', icon: <SunIcon size={15} />, run: () => applyTheme('light') },
      { id: 'theme-dark', label: 'Theme: Dark', icon: <MoonIcon size={15} />, run: () => applyTheme('dark') },
      { id: 'errors', label: 'Show sessions with errors', icon: <AlertIcon size={15} />, run: () => router.push('/?q=has%3Aerror') },
      { id: 'clear', label: 'Clear filters', run: () => router.push('/') },
      { id: 'shortcuts', label: 'Keyboard shortcuts', hint: '?', icon: <KeyboardIcon size={15} />, run: () => setView('help') },
    ];
  }, [router, projects]);

  const shownCmds = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? commands.filter((c) => c.label.toLowerCase().includes(s)) : commands;
  }, [commands, q]);

  const items = useMemo(
    () => [
      ...shownCmds.map((c) => ({ kind: 'cmd' as const, c })),
      ...hits.map((h) => ({ kind: 'session' as const, h })),
    ],
    [shownCmds, hits],
  );

  useEffect(() => setActive(0), [q, hits.length]);

  const activate = (i: number) => {
    const it = items[i];
    if (!it) return;
    if (it.kind === 'cmd') {
      if (it.c.id === 'shortcuts') {
        setView('help');
        return;
      }
      close();
      it.c.run();
    } else {
      close();
      router.push(`/sessions/${it.h.id}`);
    }
  };

  const onKeyNav = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(active);
    }
  };

  return (
    <>
      <button
        type="button"
        className="fp-kbd"
        onClick={() => openPalette('commands')}
        aria-label="Open command palette"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <span aria-hidden="true">⌘K</span>
      </button>

      <dialog
        ref={dialogRef}
        className="cmd"
        aria-label="Command palette"
        onClose={() => {
          setOpen(false);
          setView('commands');
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        {view === 'commands' ? (
          <div className="cmd-body">
            <div className="cmd-search">
              <SearchIcon size={16} />
              <input
                ref={inputRef}
                className="cmd-input"
                placeholder="Search commands or recordings…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyNav}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
                aria-label="Search commands or recordings"
                autoComplete="off"
              />
            </div>
            <ul className="cmd-list" id={listId} role="listbox" aria-label="Results">
              {items.length === 0 ? (
                <li className="cmd-empty">No commands or recordings found</li>
              ) : (
                items.map((it, i) => {
                  const url = it.kind === 'session' ? formatEntryUrl(it.h.url) : null;
                  return (
                    <li
                      key={it.kind === 'cmd' ? it.c.id : it.h.id}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      className={`cmd-item${i === active ? ' is-active' : ''}`}
                      onMouseMove={() => setActive(i)}
                      onClick={() => activate(i)}
                    >
                      {it.kind === 'cmd' ? (
                        <>
                          <span className="cmd-ico">{it.c.icon}</span>
                          <span className="cmd-label">{it.c.label}</span>
                          {it.c.hint ? <kbd className="kbd">{it.c.hint}</kbd> : null}
                        </>
                      ) : (
                        <>
                          <span className="cmd-ico">
                            {it.h.error_count > 0 ? <AlertIcon size={15} className="t-error" /> : <GlobeIcon size={15} />}
                          </span>
                          <span className="cmd-label">
                            <span className="cmd-sid mono">{it.h.id.slice(0, 8)}</span>
                            <span className="cmd-surl">
                              {url?.host}
                              {url?.path}
                            </span>
                          </span>
                          <span className="cmd-when">{relativeTime(it.h.started_at)}</span>
                        </>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : (
          <div className="cmd-body">
            <div className="cmd-help-head">
              <span className="label">Keyboard shortcuts</span>
              <button type="button" className="btn btn-ghost" onClick={() => setView('commands')}>
                Back
              </button>
            </div>
            <div className="cmd-help">
              <section>
                <h3 className="label">Global</h3>
                <ul>
                  {GLOBAL_KEYS.map((s) => (
                    <li key={s.label}>
                      <span>{s.label}</span>
                      <kbd className="kbd">{s.keys}</kbd>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="label">Player</h3>
                <ul>
                  {SHORTCUTS.map((s) => (
                    <li key={s.label}>
                      <span>{s.label}</span>
                      <kbd className="kbd">{s.keys}</kbd>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
