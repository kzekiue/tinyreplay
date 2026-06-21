import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import type { MDXComponents } from 'mdx/types';

import { Callout } from '@/components/mdx/callout';
import { CodePre } from '@/components/mdx/code-pre';
import { Terminal } from '@/components/mdx/terminal';
import { FeatureCard } from '@/components/mdx/feature-card';
import { ArchitectureDiagram } from '@/components/mdx/architecture-diagram';
import { CodeGroup, CodeGroupPanel } from '@/components/mdx/code-group';
import { TinyReplayLimitsTable } from '@/components/mdx/limits-table';

/** Components available in every MDX file without an explicit import. */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    pre: CodePre,
    Steps,
    Step,
    Callout,
    Terminal,
    FeatureCard,
    ArchitectureDiagram,
    CodeGroup,
    CodeGroupPanel,
    TinyReplayLimitsTable,
    ...components,
  };
}
