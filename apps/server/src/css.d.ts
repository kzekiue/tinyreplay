// CSS is handled by Next at build time, not by the type checker. Declaring the
// module shape keeps `tsc --noEmit` (npm run typecheck) from failing on the
// side-effect `import './globals.css'` / `import 'rrweb/dist/style.css'`.
declare module '*.css';
