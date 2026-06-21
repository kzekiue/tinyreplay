import localFont from 'next/font/local';

/**
 * Self-hosted variable fonts. We ship the woff2 files in the repo and load them
 * with next/font/local rather than next/font/google so the build is hermetic and
 * the running app makes zero external font requests - consistent with
 * TinyReplay's "no external services / no telemetry" promise.
 */

export const sans = localFont({
  src: './fonts/Geist-Variable.woff2',
  weight: '300 700',
  display: 'swap',
  variable: '--font-sans',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});

export const mono = localFont({
  src: './fonts/JetBrainsMono-Variable.woff2',
  weight: '400 700',
  display: 'swap',
  variable: '--font-mono',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
});
