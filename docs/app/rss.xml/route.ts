import { source } from '@/lib/source';
import { siteConfig } from '@/lib/site-config';

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Minimal RSS of the documentation pages. There is no blog, so this is a static
 * index of the docs - upgrade to dated posts if a changelog ever lands.
 */
export function GET(): Response {
  const items = source
    .getPages()
    .map((page) => {
      const title = escape(page.data.title ?? page.url);
      const description = escape(page.data.description ?? '');
      const link = `${siteConfig.siteUrl}${page.url}`;
      return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <description>${description}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>TinyReplay Docs</title>
    <link>${siteConfig.siteUrl}</link>
    <description>Self-hosted session replay. Session replay. Nothing else.</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
