'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { SessionRow, ProjectStat } from '@/lib/queries';
import { ScopeSelector } from './scope-selector';
import { deleteSessionsAction } from '@/app/actions';
import {
  relativeTime,
  formatDateTime,
  formatDuration,
  formatCount,
  formatEntryUrl,
} from '@/lib/format';
import {
  SearchIcon,
  CloseIcon,
  GlobeIcon,
  ClockIcon,
  LayersIcon,
  AlertIcon,
  MonitorIcon,
  SmartphoneIcon,
  TabletIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  deviceIcon,
} from './icons';
import { DateRangeControl } from './DateRangeControl';
import { readToken, setToken } from '@/lib/filter-token';

const DEVICES = [
  { value: '', label: 'All', Icon: null },
  { value: 'desktop', label: 'Desktop', Icon: MonitorIcon },
  { value: 'mobile', label: 'Mobile', Icon: SmartphoneIcon },
  { value: 'tablet', label: 'Tablet', Icon: TabletIcon },
];

// Filter state lives in the `?q=` string as `field:value` tokens (parsed
// server-side by buildFilter). The hardware controls just read/write those
// tokens, so the search field and the switches stay in sync for free. Project
// scope is a faceplate control (see ScopeSelector), not a rail filter.

interface Props {
  sessions: SessionRow[];
  selectedId?: string;
  total: number;
  query: string;
  page: number;
  pageSize: number;
  projects: ProjectStat[];
}

/** Left rail: a hardware-style filter console over a scrolling tray of recording
 *  cards. Selecting a card is RSC navigation; filters serialize into `?q=`. */
export function SessionBrowser({
  sessions,
  selectedId,
  total,
  query,
  page,
  pageSize,
  projects,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(query);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [armed, setArmed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Relative times read the clock, so they can't match between server render and
  // client hydration. Stay null until mounted (the row's suppressHydrationWarning
  // covers the first paint), then tick every 30s to keep "x ago" live.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Clearing the selection disarms the delete confirm.
  useEffect(() => {
    if (selected.size === 0) setArmed(false);
  }, [selected]);

  // Press "/" anywhere to jump to search (unless already typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Apply a new filter string. Stay on the current path so an open recording
  // keeps playing while the tray re-filters around it.
  const apply = (q: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  const setFilter = (k: string, v: string) => {
    const next = setToken(value, k, v);
    setValue(next);
    apply(next);
  };

  const setRange = (v: string) => {
    // Relative range and explicit dates are mutually exclusive.
    let next = setToken(value, 'last', v);
    next = setToken(setToken(next, 'after', ''), 'before', '');
    setValue(next);
    apply(next);
  };

  const setDates = (a: string, b: string) => {
    // Picking explicit dates clears the relative preset.
    let next = setToken(value, 'after', a);
    next = setToken(next, 'before', b);
    if (a || b) next = setToken(next, 'last', '');
    setValue(next);
    apply(next);
  };

  const range = readToken(value, 'last');
  const device = readToken(value, 'device');
  const errorsOnly = readToken(value, 'has') === 'error';

  // Preserve the active filter when navigating to a card.
  const cardHref = (id: string) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return qs ? `/sessions/${id}?${qs}` : `/sessions/${id}`;
  };

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Two-stage: the Delete key arms (rail-foot turns danger-weak), Confirm runs.
  // No native confirm() - the console handles its own destructive intent inline.
  const onDelete = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      await deleteSessionsAction(ids);
      setSelected(new Set());
      setArmed(false);
      router.refresh();
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = offset + sessions.length;
  const selectedLabel = `${selected.size} ${selected.size === 1 ? 'recording' : 'recordings'}`;

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('page', String(p));
    return `${pathname}?${params.toString()}`;
  };

  const armedFoot = (
    <>
      <span className="where">Delete {selectedLabel}? Can&rsquo;t be undone.</span>
      <div className="foot-actions">
        <button type="button" className="btn" disabled={pending} onClick={() => setArmed(false)}>
          Keep
        </button>
        <button type="button" className="btn btn-danger" disabled={pending} onClick={onDelete}>
          {pending ? 'Deleting…' : `Delete ${selected.size}`}
        </button>
      </div>
    </>
  );

  const selectFoot = (
    <>
      <span className="where">{selectedLabel} selected</span>
      <button type="button" className="btn foot-del" onClick={() => setArmed(true)}>
        Delete
      </button>
    </>
  );

  const pagerFoot = (
    <>
      <span className="where">
        {rangeStart}–{rangeEnd} of {total.toLocaleString()}
      </span>
      {totalPages > 1 ? (
        <div className="pager">
          <Link
            href={pageHref(page - 1)}
            className="pg"
            aria-label="Previous page"
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
          >
            <ChevronLeftIcon size={14} />
          </Link>
          <Link
            href={pageHref(page + 1)}
            className="pg"
            aria-label="Next page"
            aria-disabled={page >= totalPages}
            tabIndex={page >= totalPages ? -1 : undefined}
          >
            <ChevronRightIcon size={14} />
          </Link>
        </div>
      ) : null}
    </>
  );

  let footContent: ReactNode = pagerFoot;
  if (selected.size > 0) footContent = armed ? armedFoot : selectFoot;

  return (
    <aside className="workspace-rail" aria-label="Session browser">
      <p className="sr-only" role="status" aria-live="polite">
        {total.toLocaleString()} {total === 1 ? 'session' : 'sessions'}
        {query ? ' match your filter' : ''}
      </p>
      <div className="filters">
        <div className="filter-module">
          <form
            className="search-well"
            onSubmit={(e) => {
              e.preventDefault();
              apply(value.trim());
            }}
          >
            <span className="search-ico">
              <SearchIcon size={15} />
            </span>
            <input
              type="search"
              className="input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Search URL or ID - try device:mobile"
              aria-label="Search sessions"
            />
            {value ? (
              <button
                type="button"
                className="clear"
                aria-label="Clear search"
                onClick={() => {
                  setValue('');
                  apply('');
                }}
              >
                <CloseIcon size={14} />
              </button>
            ) : null}
          </form>
        </div>

        <div className="filter-module">
          <span className="label">Recorded</span>
          <DateRangeControl
            range={range}
            after={readToken(value, 'after')}
            before={readToken(value, 'before')}
            onPreset={setRange}
            onDates={setDates}
          />
        </div>

        <div className="filter-module">
          <span className="label">Device</span>
          <div className="segmented" role="group" aria-label="Device type">
            {DEVICES.map((d) => (
              <button
                key={d.value || 'all'}
                type="button"
                className={`seg${d.Icon ? ' seg-icon' : ''}`}
                aria-pressed={device === d.value}
                aria-label={d.label}
                title={d.label}
                onClick={() => setFilter('device', d.value)}
              >
                {d.Icon ? <d.Icon size={15} /> : d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="chip-row">
          <button
            type="button"
            className="chip"
            aria-pressed={errorsOnly}
            onClick={() => setFilter('has', errorsOnly ? '' : 'error')}
          >
            <span className="chip-led" aria-hidden="true" />
            Errors only
          </button>
          <ScopeSelector projects={projects} />
        </div>
      </div>

      <div className={`rail-list scroll${selected.size > 0 ? ' is-selecting' : ''}`}>
        {sessions.length === 0 ? (
          <div className="rail-empty">
            <span className="label">{query ? 'No sessions found' : 'No recordings yet'}</span>
            <p>{query ? 'Change or clear the filter to see more recordings.' : 'Install the snippet, then reload this page after a session records.'}</p>
          </div>
        ) : (
          sessions.map((s) => {
            const { host, path } = formatEntryUrl(s.url);
            const Dev = deviceIcon(s.device_type);
            return (
              <div key={s.id} className="s-card-wrap">
                <input
                  type="checkbox"
                  className="s-check"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  aria-label={`Select session ${s.id.slice(0, 8)}`}
                />
                <Link
                  href={cardHref(s.id)}
                  className={`s-card${selectedId === s.id ? ' is-selected' : ''}`}
                  aria-current={selectedId === s.id ? 'true' : undefined}
                  // Already open - don't re-navigate (avoids a needless rebuild).
                  onClick={(e) => { if (selectedId === s.id) e.preventDefault(); }}
                >
                  <div className="s-top">
                    <span className="s-id">{s.id.slice(0, 8)}</span>
                    <span
                      className="s-when"
                      title={now === null ? undefined : formatDateTime(s.started_at)}
                      suppressHydrationWarning
                    >
                      {relativeTime(s.started_at, now ?? undefined)}
                    </span>
                  </div>
                  <div className="s-url">
                    <GlobeIcon size={12} />
                    <span>
                      {host ? <span className="host">{host}</span> : null}
                      {path}
                    </span>
                  </div>
                  <div className="s-facts">
                    <span className="fact">
                      <ClockIcon size={11} />
                      {formatDuration(s.duration_ms)}
                    </span>
                    <span className="fact">
                      <LayersIcon size={11} />
                      {formatCount(s.event_count)}
                    </span>
                    <span className="fact">{s.page_count}p</span>
                    <span className="spacer" />
                    {s.error_count > 0 ? (
                      <span className="s-flag is-error" title={`${s.error_count} error${s.error_count === 1 ? '' : 's'}`}>
                        <AlertIcon size={11} />
                        {s.error_count}
                      </span>
                    ) : null}
                    <Dev size={13} aria-hidden="true" />
                  </div>
                </Link>
              </div>
            );
          })
        )}
      </div>

      <div className={`rail-foot${armed ? ' is-armed' : ''}`}>{footContent}</div>
    </aside>
  );
}
