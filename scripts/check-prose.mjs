#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const BINARY_EXTENSIONS = /\.(woff2?|ttf|eot|png|jpe?g|gif|webp|ico|pdf|zip|gz)$/i;

const EXCLUDED_FILES = new Set([
  'package-lock.json',
  'LICENSE',
  'scripts/check-prose.mjs',
]);

const TERMS = [
  ['cl', 'aude'],
  ['anth', 'ropic'],
  ['chat', 'gpt'],
  ['open', 'ai'],
  ['co', 'pilot'],
  ['gem', 'ini'],
  ['pony', 'tail'],
  ['wind', 'surf'],
  ['language ', 'mo', 'del'],
  ['mo', 'del', '-gen', 'erated'],
  ['ag', 'ent', '-gen', 'erated'],
  ['gen', 'erated ', 'by'],
  ['imple', 'mentation ', 'pl', 'an'],
  ['au', 'dit ', 'report'],
  ['clean', 'up ', 'report'],
  ['final ', 'sum', 'mary'],
  ['task ', 'list'],
  ['enterprise', '-grade'],
  ['battle', '-tested'],
  ['production', '-ready'],
  ['revo', 'lutionary'],
  ['cut', 'ting', '-edge'],
];

const termRe = new RegExp(
  TERMS.map((parts) => parts.join('').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') +
    `|\\b${['l', 'lm'].join('')}\\b|${['a', 'i'].join('')}[- ]${['gen', 'erated'].join('')}|\\b(${['TO', 'DO'].join('')}|${['FIX', 'ME'].join('')}|${['HA', 'CK'].join('')}|XXX)\\b`,
  'i',
);
const EM_DASH = String.fromCharCode(0x2014);

function trackedFiles() {
  return execSync('git ls-files', { encoding: 'utf8' })
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

const problems = [];

for (const file of trackedFiles()) {
  if (!existsSync(file)) continue;
  if (BINARY_EXTENSIONS.test(file) || EXCLUDED_FILES.has(file)) continue;

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  content.split('\n').forEach((line, index) => {
    const lineNo = index + 1;
    const col = line.indexOf(EM_DASH);
    if (col !== -1) problems.push(`${file}:${lineNo}:${col + 1}: em dash`);
    if (termRe.test(line)) problems.push(`${file}:${lineNo}: forbidden content: ${line.trim()}`);
  });
}

if (problems.length > 0) {
  console.error(`check:forbidden found ${problems.length} issue(s):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log('check:forbidden: no issues found.');
