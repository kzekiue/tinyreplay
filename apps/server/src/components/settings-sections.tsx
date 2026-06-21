'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeControl } from './faceplate-controls';
import { ThemePicker } from './theme-picker';
import { setRetentionAction, reclaimSpaceAction, deleteAllSessionsAction } from '@/app/actions';

function fmtBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} KB`;
  return `${n} B`;
}

const PRESETS = [
  { d: 0, label: 'Keep forever' },
  { d: 7, label: '7 days' },
  { d: 30, label: '30 days' },
  { d: 90, label: '90 days' },
];

export function RetentionSection({ initial }: { initial: number }) {
  const [days, setDays] = useState(initial);
  const [custom, setCustom] = useState('');
  const [pending, start] = useTransition();
  const apply = (d: number) => {
    setDays(d);
    start(() => setRetentionAction(d));
  };
  const isPreset = PRESETS.some((p) => p.d === days);
  return (
    <section className="set-section">
      <div className="set-head">
        <h2>Retention</h2>
        <p>Automatically delete recordings older than this window. TinyReplay checks once an hour.</p>
      </div>
      <div className="segmented set-presets" role="group" aria-label="Retention window">
        {PRESETS.map((p) => (
          <button
            key={p.d}
            type="button"
            className="seg"
            aria-pressed={days === p.d}
            disabled={pending}
            onClick={() => apply(p.d)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <form
        className="set-custom"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number.parseInt(custom, 10);
          if (Number.isFinite(n) && n > 0) {
            apply(n);
            setCustom('');
          }
        }}
      >
        <input
          className="input"
          type="number"
          min="1"
          placeholder="Custom days"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          aria-label="Custom retention days"
        />
        <button type="submit" className="btn" disabled={pending || !custom}>
          Save days
        </button>
        {!isPreset ? <span className="set-note">Currently {days} days.</span> : null}
      </form>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="set-stat">
      <span className="label">{label}</span>
      <span className="set-stat-v mono">{value}</span>
    </div>
  );
}

export function StorageSection({
  sizeBytes,
  freeBytes,
  sessions,
}: {
  sizeBytes: number;
  freeBytes: number | null;
  sessions: number;
}) {
  const [pending, start] = useTransition();
  return (
    <section className="set-section">
      <div className="set-head">
        <h2>Storage</h2>
        <p>Local SQLite storage on this machine. Recordings stay on this server.</p>
      </div>
      <div className="set-readout">
        <Stat label="Database size" value={fmtBytes(sizeBytes)} />
        <Stat label="Recordings" value={sessions.toLocaleString()} />
        <Stat label="Free disk" value={freeBytes != null ? fmtBytes(freeBytes) : '-'} />
      </div>
      <button type="button" className="btn" disabled={pending} onClick={() => start(() => reclaimSpaceAction())}>
        {pending ? 'Reclaiming…' : 'Reclaim space'}
      </button>
      <p className="set-note">Applies retention now and compacts the database file.</p>
    </section>
  );
}

export function ThemeSection() {
  return (
    <section className="set-section">
      <div className="set-head">
        <h2>Theme</h2>
        <p>Choose the console finish and whether it follows your system theme.</p>
      </div>
      <ThemePicker />
      <div className="set-subhead">
        <span className="label">Appearance</span>
        <ThemeControl />
      </div>
    </section>
  );
}

export function MaskingSection() {
  return (
    <section className="set-section">
      <div className="set-head">
        <h2>Masking</h2>
        <p>
          Privacy masking happens in the SDK at capture time, before anything reaches this server -
          inputs and flagged elements are never recorded. Use `data-tr-mask` for sensitive text,
          `data-tr-ignore` for blocked regions, and `data-tr-unmask` only for non-sensitive fields.
        </p>
      </div>
    </section>
  );
}

export function DangerSection({ count }: { count: number }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      await deleteAllSessionsAction();
      setArmed(false);
      router.refresh();
    });
  return (
    <section className="set-section set-danger">
      <div className="set-head">
        <h2>Delete recordings</h2>
        <p>Permanently delete every recording stored on this server. This cannot be undone.</p>
      </div>
      {armed ? (
        <div className="set-armed">
          <span>Delete all {count.toLocaleString()} recordings?</span>
          <button type="button" className="btn" disabled={pending} onClick={() => setArmed(false)}>
            Keep recordings
          </button>
          <button type="button" className="btn btn-danger" disabled={pending} onClick={run}>
            {pending ? 'Deleting…' : `Delete ${count.toLocaleString()}`}
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-danger" disabled={count === 0} onClick={() => setArmed(true)}>
          Delete all recordings
        </button>
      )}
    </section>
  );
}
