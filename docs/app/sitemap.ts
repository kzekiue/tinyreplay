import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { siteConfig } from '@/lib/site-config';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const docs = source.getPages().map((page) => ({
    url: `${siteConfig.siteUrl}${page.url}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [
    { url: siteConfig.siteUrl, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    ...docs,
  ];
}
