import { createMDX } from 'fumadocs-mdx/next';
import path from 'node:path';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Monorepo: pin the file-tracing root to the repo root so Next stops guessing
  // from stray lockfiles.
  outputFileTracingRoot: path.join(import.meta.dirname, '..'),
  // Linting runs as a separate step, not as a build blocker.
  eslint: { ignoreDuringBuilds: true },
  webpack(nextConfig) {
    const iconsPath = path.join(
      import.meta.dirname,
      '../node_modules/fumadocs-ui/dist/icons.js',
    );
    nextConfig.resolve.alias = {
      ...nextConfig.resolve.alias,
      [iconsPath]: path.join(import.meta.dirname, 'lib/fumadocs-icons.tsx'),
    };
    return nextConfig;
  },
};

export default withMDX(config);
