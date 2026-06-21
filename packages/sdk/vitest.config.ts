import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // rrweb ships an ESM "module" entry but no "exports" map, so its CJS "main"
    // gets picked under type:module and blows up. Inlining routes it through
    // Vite's transform, which handles the CJS/ESM interop.
    server: {
      deps: {
        inline: [/rrweb/],
      },
    },
  },
});
