// Copies the built UMD SDK bundle into public/sdk so the server can serve it at
// /sdk/tinyreplay.umd.js.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const srcDir = join(root, '../../packages/sdk/dist');
const destDir = join(root, 'public/sdk');

// Only the bundle itself - never the sourcemap, public/sdk is served as-is.
const files = ['tinyreplay.umd.js'];

function buildSdk() {
  execFileSync('npm', ['run', 'build', '-w', '@tinyreplay/sdk'], {
    cwd: join(root, '../..'),
    stdio: 'inherit',
  });
}

mkdirSync(destDir, { recursive: true });
// Drop a stale sourcemap left behind by older builds.
rmSync(join(destDir, 'tinyreplay.umd.js.map'), { force: true });

if (!existsSync(join(srcDir, 'tinyreplay.umd.js'))) {
  console.log('[copy-sdk] SDK bundle not found; building @tinyreplay/sdk first.');
  buildSdk();
}

let copied = 0;
for (const f of files) {
  const src = join(srcDir, f);
  if (existsSync(src)) {
    copyFileSync(src, join(destDir, f));
    copied++;
  }
}

if (copied !== files.length) throw new Error('SDK bundle copy failed.');

console.log(`[copy-sdk] copied ${copied} file(s) to public/sdk/`);
