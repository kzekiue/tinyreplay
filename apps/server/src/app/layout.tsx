import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { sans, mono } from './fonts';
import {
  THEME_COOKIE,
  FAMILY_COOKIE,
  THEME_SCRIPT,
  isThemePref,
  isThemeFamily,
  type ThemePref,
  type ThemeFamily,
} from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'TinyReplay',
  description: 'Self-hosted session replay in one Docker command.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#1c1b18' },
    { media: '(prefers-color-scheme: light)', color: '#f5f4f1' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const cookie = jar.get(THEME_COOKIE)?.value;
  const pref: ThemePref = isThemePref(cookie) ? cookie : 'system';
  const fam = jar.get(FAMILY_COOKIE)?.value;
  const family: ThemeFamily = isThemeFamily(fam) ? fam : 'classic';
  // The server can't read the OS preference; render a best-effort attribute and
  // let THEME_SCRIPT correct `system` before paint (hence suppressHydrationWarning).
  const initial = pref === 'light' ? 'light' : 'dark';
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      data-theme={initial}
      data-theme-pref={pref}
      data-theme-family={family}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
