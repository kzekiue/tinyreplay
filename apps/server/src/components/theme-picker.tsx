'use client';

import { useEffect, useState } from 'react';
import { THEME_FAMILIES, isThemeFamily, applyThemeFamily, type ThemeFamily } from '@/lib/theme';

/** Card copy + a representative light/dark swatch set per theme. The swatches
 *  are brand colours mirrored from globals.css - enough for a faithful mini
 *  preview without coupling the card to the page cascade. */
const THEMES: Record<
  ThemeFamily,
  { name: string; desc: string; light: Swatch; dark: Swatch }
> = {
  classic: {
    name: 'Classic',
    desc: 'Tactile industrial hardware. The flagship.',
    dark: sw('15.5% 0.006 80', '23% 0.008 80', '95% 0.005 80', '67% 0.142 55', '28% 0.008 80'),
    light: sw('95.5% 0.004 85', '99.4% 0.002 85', '24% 0.012 85', '58% 0.16 52', '89% 0.006 85'),
  },
  foundry: {
    name: 'Foundry',
    desc: 'A midnight workshop. Warm graphite and brass.',
    dark: sw('13% 0.012 60', '20% 0.016 56', '92% 0.012 70', '72% 0.12 75', '26% 0.016 56'),
    light: sw('90% 0.022 75', '96.5% 0.015 80', '28% 0.032 60', '54% 0.13 60', '82% 0.024 72'),
  },
  signal: {
    name: 'Signal',
    desc: 'A precise, flat software tool. Quiet confidence.',
    dark: sw('16% 0.006 255', '24% 0.008 255', '96% 0.004 255', '70% 0.115 225', '30% 0.008 255'),
    light: sw('97% 0.003 255', '100% 0 0', '26% 0.01 255', '56% 0.13 230', '91% 0.005 255'),
  },
  modern: {
    name: 'Modern',
    desc: 'Frosted glass and a soft gradient. Refined indigo.',
    dark: sw('15% 0.022 275', '28% 0.026 271', '96% 0.01 270', '70% 0.16 278', '40% 0.02 272'),
    light: sw('96.5% 0.006 265', '99% 0.002 265', '28% 0.025 275', '56% 0.18 274', '85% 0.02 272'),
  },
};

interface Swatch {
  bg: string;
  surface: string;
  ink: string;
  accent: string;
  line: string;
}
function sw(bg: string, surface: string, ink: string, accent: string, line: string): Swatch {
  return {
    bg: `oklch(${bg})`,
    surface: `oklch(${surface})`,
    ink: `oklch(${ink})`,
    accent: `oklch(${accent})`,
    line: `oklch(${line})`,
  };
}

function Preview({ s, label }: { s: Swatch; label: string }) {
  return (
    <div
      className="tp-prev"
      style={
        {
          '--p-bg': s.bg,
          '--p-surface': s.surface,
          '--p-ink': s.ink,
          '--p-accent': s.accent,
          '--p-line': s.line,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <span className="tp-prev-bar" />
      <div className="tp-prev-body">
        <span className="tp-prev-key" />
        <span className="tp-prev-line" />
        <span className="tp-prev-line tp-prev-line-short" />
      </div>
      <span className="tp-prev-tag">{label}</span>
    </div>
  );
}

/** Visual-theme card picker. Writes the family cookie and applies it live;
 *  appearance (light/dark/system) is the separate segmented control below. */
export function ThemePicker() {
  const [family, setFamily] = useState<ThemeFamily>('classic');

  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme-family');
    if (isThemeFamily(attr ?? undefined)) setFamily(attr as ThemeFamily);
  }, []);

  const choose = (next: ThemeFamily) => {
    setFamily(next);
    applyThemeFamily(next);
  };

  return (
    <div className="tp-grid" role="radiogroup" aria-label="Visual theme">
      {THEME_FAMILIES.map((f) => {
        const t = THEMES[f];
        const active = family === f;
        return (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={active}
            className={`tp-card${active ? ' is-active' : ''}`}
            onClick={() => choose(f)}
          >
            <div className="tp-previews">
              <Preview s={t.light} label="Light" />
              <Preview s={t.dark} label="Dark" />
            </div>
            <div className="tp-meta">
              <span className="tp-name">{t.name}</span>
              <span className="tp-desc">{t.desc}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
