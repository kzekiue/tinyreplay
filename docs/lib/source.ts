import { docs } from '@/.source';
import { loader } from 'fumadocs-core/source';
import { getIcon } from '@/lib/icons';

/** The content source: compiled MDX from content/docs, served under /docs. */
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  icon: getIcon,
});
