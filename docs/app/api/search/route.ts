import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

/** Local Orama search index built from the content source. Powers ⌘K. */
export const { GET } = createFromSource(source);
