'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MonitorIcon, SunIcon, MoonIcon, AlertIcon, SettingsIcon } from './icons';
import { THEME_PREFS, isThemePref, applyTheme, type ThemePref } from '@/lib/theme';

// ---- Store health: one poll, shared by the lamp and the banner -------------

type HealthStatus = 'unknown' | 'ok' | 'degraded' | 'failing' | 'offline';

interface Health {
  status: HealthStatus;
  sizeBytes?: number;
  freeBytes?: number | null;
  sessions?: number;
}

const HealthContext = createContext<Health>({ status: 'unknown' });
const useHealth = () => useContext(HealthContext);

function fmtBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} KB`;
  return `${n} B`;
}

/** Polls /api/health every 30s and shares the result. Network failure ⇒ offline;
 *  a 500 ⇒ failing; otherwise the server's own status verdict. */
export function HealthProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<Health>({ status: 'unknown' });

  useEffect(() => {
    let alive = true;
    const ping = async () => {
      try {
        const r = await fetch('/api/health', { cache: 'no-store' });
        if (!alive) return;
        if (!r.ok) {
          setHealth({ status: 'failing' });
          return;
        }
        const d = await r.json();
        setHealth({
          status: (d.status as HealthStatus) ?? 'ok',
          sizeBytes: d.sizeBytes,
          freeBytes: d.freeBytes,
          sessions: d.sessions,
        });
      } catch {
        if (alive) setHealth({ status: 'offline' });
      }
    };
    ping();
    const id = setInterval(ping, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return <HealthContext.Provider value={health}>{children}</HealthContext.Provider>;
}


/** Honest failure surface: one line under the faceplate, only when the store is
 *  degraded or failing. */
export function HealthBanner() {
  const h = useHealth();
  if (h.status !== 'degraded' && h.status !== 'failing') return null;
  const failing = h.status === 'failing';
  const free = h.freeBytes != null ? ` ${fmtBytes(h.freeBytes)} free.` : '';
  return (
    <div className={`health-banner${failing ? ' is-fail' : ''}`} role="alert">
      <AlertIcon size={14} aria-hidden="true" />
      <span>
        {failing
          ? `Storage failing - new recordings may not be saved.${free}`
          : `Low disk space - recordings may soon stop saving.${free}`}
      </span>
      <Link href="/settings" className="health-banner-link">
        Manage storage
      </Link>
    </div>
  );
}

/** Settings gear for the faceplate right zone; seated when on the route. */
export function SettingsLink() {
  const path = usePathname();
  return (
    <Link
      href="/settings"
      className="fp-icon-link"
      aria-label="Settings"
      aria-current={path.startsWith('/settings') ? 'page' : undefined}
    >
      <SettingsIcon size={16} />
    </Link>
  );
}

const THEME_META: Record<ThemePref, { label: string; Icon: typeof MonitorIcon }> = {
  system: { label: 'System theme', Icon: MonitorIcon },
  light: { label: 'Light theme', Icon: SunIcon },
  dark: { label: 'Dark theme', Icon: MoonIcon },
};

/** A milled three-position switch: System / Light / Dark. Writes the cookie and
 *  drives `data-theme` live; the stage follows the theme too. */
export function ThemeControl() {
  const [pref, setPref] = useState<ThemePref>('system');

  // Hydrate from the attribute the pre-paint script already resolved.
  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme-pref');
    if (isThemePref(attr ?? undefined)) setPref(attr as ThemePref);
  }, []);

  // While following the OS, react to OS changes live.
  useEffect(() => {
    if (pref !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);

  const choose = (next: ThemePref) => {
    setPref(next);
    applyTheme(next);
  };

  return (
    <div className="fp-theme" role="group" aria-label="Theme">
      {THEME_PREFS.map((p) => {
        const { label, Icon } = THEME_META[p];
        return (
          <button
            key={p}
            type="button"
            className="fp-seg"
            aria-pressed={pref === p}
            aria-label={label}
            title={label}
            onClick={() => choose(p)}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
