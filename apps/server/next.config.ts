import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle for the runtime Docker stage.
  output: 'standalone',
  // The monorepo root, so standalone tracing includes the workspace node_modules.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // better-sqlite3 is a native addon; it must stay external (never bundled).
  serverExternalPackages: ['better-sqlite3'],
  // Lint runs through the root release gate before build.
  eslint: { ignoreDuringBuilds: true },
  // No next/image usage - skip the sharp/libvips binaries (~33MB) entirely.
  images: { unoptimized: true },
  // Keep the standalone output lean: these get traced in but are never
  // needed at runtime (sharp/@img only serve image optimization; typescript
  // only serves next.config.ts loading at build time).
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@img/**',
      'node_modules/sharp/**',
      'node_modules/typescript/**',
    ],
  },
};

export default nextConfig;
