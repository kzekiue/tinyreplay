import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

// rrweb is bundled into every output so the SDK is dependency-free for consumers
// and the UMD <script> is fully self-contained.
const tsPlugin = typescript({ tsconfig: './tsconfig.json', declaration: false });

export default [
  // ESM + CJS library builds.
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.js', format: 'es', sourcemap: false },
      { file: 'dist/index.cjs', format: 'cjs', sourcemap: false, exports: 'named' },
    ],
    plugins: [resolve({ browser: true }), commonjs(), tsPlugin],
  },
  // Self-contained, minified UMD bundle (served at /sdk/tinyreplay.umd.js).
  {
    input: 'src/umd.ts',
    output: {
      file: 'dist/tinyreplay.umd.js',
      format: 'umd',
      name: 'TinyReplay',
      exports: 'default',
      sourcemap: false,
    },
    plugins: [resolve({ browser: true }), commonjs(), tsPlugin, terser()],
  },
  // Bundled type declarations.
  {
    input: 'src/index.ts',
    output: { file: 'dist/index.d.ts', format: 'es' },
    plugins: [dts()],
  },
];
