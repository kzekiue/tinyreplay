import './global.css';
import { Geist, JetBrains_Mono } from 'next/font/google';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { siteConfig } from '@/lib/site-config';

// Same pairing as the dashboard: one sans for chrome, one mono for data + code.
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: 'TinyReplay - Self-hosted session replay',
    template: '%s · TinyReplay',
  },
  description:
    'Small self-hosted session replay. Records browser sessions, stores them in SQLite, and replays them on your own server.',
  keywords: [
    'session replay',
    'self-hosted',
    'rrweb',
    'privacy',
    'sqlite',
    'open source',
  ],
  openGraph: {
    type: 'website',
    siteName: 'TinyReplay',
    url: siteConfig.siteUrl,
    title: 'TinyReplay - Self-hosted session replay',
    description:
      'Records browser sessions, stores them in SQLite, and replays them on your own server.',
    images: ['/og'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TinyReplay - Self-hosted session replay',
    description: 'Small self-hosted session replay.',
    images: ['/og'],
  },
  alternates: {
    types: { 'application/rss+xml': `${siteConfig.siteUrl}/rss.xml` },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#1a1917' },
    { media: '(prefers-color-scheme: light)', color: '#f7f7f5' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <RootProvider
          theme={{
            defaultTheme: 'dark',
            enableSystem: false,
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
