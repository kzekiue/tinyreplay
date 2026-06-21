import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Wordmark } from '@/components/logo';

export const GITHUB_URL = 'https://github.com/kzekiue/tinyreplay';

/** Shared nav/footer options for both the home and docs layouts. */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: <Wordmark />,
    transparentMode: 'top',
  },
  githubUrl: GITHUB_URL,
};
