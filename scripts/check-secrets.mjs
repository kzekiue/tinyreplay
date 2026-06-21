#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const SKIP_EXT = /\.(woff2?|ttf|eot|png|jpe?g|gif|webp|ico|pdf|zip|gz)$/i;
const SKIP_FILES = new Set(['package-lock.json']);

const PATTERNS = [
  [/-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, 'private key'],
  [/\bgh[pousr]_[A-Za-z0-9_]{30,}\b/, 'GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/\b(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*['"][^'"]{12,}['"]/i, 'hardcoded secret'],
];

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

  content.split('\n').forEach((line, index) => {
    for (const [pattern, label] of PATTERNS) {
      if (pattern.test(line)) {
        problems.push(`${file}:${index + 1}: possible ${label}`);
      }
    }
  });
}

if (problems.length > 0) {
  console.error(`check:secrets found ${problems.length} issue(s):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log('check:secrets: no issues found.');
