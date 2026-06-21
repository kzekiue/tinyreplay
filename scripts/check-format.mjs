#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const SKIP_EXT = /\.(woff2?|ttf|eot|png|jpe?g|gif|webp|ico|pdf|zip|gz)$/i;
const SKIP_FILES = new Set(['package-lock.json', 'LICENSE']);

function trackedFiles() {
  return execSync('git ls-files', { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const problems = [];

for (const file of trackedFiles()) {
  if (!existsSync(file)) continue;
  if (SKIP_EXT.test(file) || SKIP_FILES.has(file)) continue;

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  if (content.length > 0 && !content.endsWith('\n')) {
    problems.push(`${file}: missing final newline`);
  }

  content.split('\n').forEach((line, index) => {
    if (/[ \t]$/.test(line)) {
      problems.push(`${file}:${index + 1}: trailing whitespace`);
    }
  });
}

if (problems.length > 0) {
  console.error(`check:format found ${problems.length} issue(s):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log('check:format: no issues found.');
