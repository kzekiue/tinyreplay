'use client';

import { useState } from 'react';
import { TerminalIcon, NetworkIcon, AlertIcon, ActivityIcon } from '@/components/icons';
import { formatClock } from '@/lib/format';
import type { ReplayEntry, ConsoleLevel } from '@/lib/replay-events';
import { EntryRow } from './EntryRow';

type Kind = ReplayEntry['kind'];

function PanelEmpty({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="panel-empty">
      <span className="ico t-mute" style={{ display: 'inline-flex' }}>{icon}</span>
      <span className="label">{title}</span>
      <p>{description}</p>
    </div>
  );
}

function Scroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="scroll scroll-stage" style={{ flex: 1, minHeight: 0 }}>
      {children}
    </div>
  );
}

const ALL: Kind[] = ['route', 'click', 'rageclick', 'input', 'console', 'network', 'error'];

export function ActivityPanel({ entries, activeIndex, onSeek }: { entries: ReplayEntry[]; activeIndex: number; onSeek: (t: number) => void }) {
  const rows = entries.map((e, i) => ({ e, i })).filter(({ e }) => ALL.includes(e.kind));
  if (rows.length === 0) {
    return <PanelEmpty icon={<ActivityIcon size={20} />} title="No activity captured" description="This session has no recorded interactions yet." />;
  }
  return (
    <Scroll>
      <div className="entry-list">
        {rows.map(({ e, i }) => <EntryRow key={i} entry={e} active={i === activeIndex} onSeek={onSeek} />)}
      </div>
    </Scroll>
  );
}

export function ConsolePanel({ entries, activeIndex, onSeek }: { entries: ReplayEntry[]; activeIndex: number; onSeek: (t: number) => void }) {
  const [levels, setLevels] = useState<ConsoleLevel[]>([]);
  const logs = entries.filter((e) => e.kind === 'console');
  if (logs.length === 0) {
    return <PanelEmpty icon={<TerminalIcon size={20} />} title="No console output" description="No console activity was recorded in this session." />;
  }
  const toggle = (lv: ConsoleLevel) =>
    setLevels((cur) => (cur.includes(lv) ? cur.filter((x) => x !== lv) : [...cur, lv]));
  const shown = entries
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.kind === 'console' && (levels.length === 0 || levels.includes(e.level as ConsoleLevel)));

  return (
    <>
      <div className="level-filter" role="group" aria-label="Filter console levels">
        {(['log', 'info', 'warn', 'error'] as ConsoleLevel[]).map((lv) => (
          <button key={lv} type="button" className="level-btn" aria-pressed={levels.includes(lv)} onClick={() => toggle(lv)}>
            {lv}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="panel-empty">
          <p>No {levels.join(' / ')} output. Clear the filter to see everything.</p>
        </div>
      ) : (
        <Scroll>
          <div className="entry-list">
            {shown.map(({ e, i }) => <EntryRow key={i} entry={e} active={i === activeIndex} onSeek={onSeek} />)}
          </div>
        </Scroll>
      )}
    </>
  );
}

export function NetworkPanel({ entries, activeIndex, onSeek }: { entries: ReplayEntry[]; activeIndex: number; onSeek: (t: number) => void }) {
  const rows = entries.map((e, i) => ({ e, i })).filter(({ e }) => e.kind === 'network');
  if (rows.length === 0) {
    return <PanelEmpty icon={<NetworkIcon size={20} />} title="No network activity" description="No requests were recorded in this session." />;
  }
  return (
    <Scroll>
      <table className="net-table">
        <thead>
          <tr>
            <th>Method</th>
            <th>URL</th>
            <th className="num">Status</th>
            <th className="num">Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ e, i }) => {
            if (e.kind !== 'network') return null;
            const bad = (e.status ?? 0) >= 400 || e.status === 0;
            return (
              <tr key={i} className={i === activeIndex ? 'is-active' : undefined}>
                <td className="method">{e.method}</td>
                <td className="url-cell" title={e.url}>{e.url}</td>
                <td className="num"><span className={`net-status${bad ? ' is-bad' : ''}`}>{e.status || 'ERR'}</span></td>
                <td className="num">
                  <button
                    type="button"
                    className="net-time"
                    onClick={() => onSeek(e.t)}
                    aria-label={`Seek to network request at ${formatClock(e.t)}`}
                  >
                    {e.durationMs != null ? `${e.durationMs}ms` : 'seek'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Scroll>
  );
}

export function ErrorsPanel({ entries, onSeek }: { entries: ReplayEntry[]; activeIndex: number; onSeek: (t: number) => void }) {
  const errs = entries.map((e, i) => ({ e, i })).filter(({ e }) => e.kind === 'error');
  if (errs.length === 0) {
    return <PanelEmpty icon={<AlertIcon size={20} />} title="No errors" description="No uncaught errors were recorded in this session." />;
  }
  return (
    <Scroll>
      <div>
        {errs.map(({ e }, idx) => {
          if (e.kind !== 'error') return null;
          return (
            <details key={idx} className="error-item">
              <summary>
                <AlertIcon size={14} className="t-error" style={{ flexShrink: 0, transform: 'translateY(2px)' }} />
                <button type="button" className="time" onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); onSeek(e.t); }}>
                  {formatClock(e.t)}
                </button>
                <span className="msg">{e.message}</span>
              </summary>
              {e.stack ? <pre className="stack">{e.stack}</pre> : null}
            </details>
          );
        })}
      </div>
    </Scroll>
  );
}
