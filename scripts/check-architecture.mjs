#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs'];

function trackedFiles() {
  return execSync('git ls-files', { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function isSource(file) {
  return SOURCE_EXTENSIONS.some((ext) => file.endsWith(ext));
}

function isTest(file) {
  return /\.test\.[tj]sx?$/.test(file);
}

function read(file) {
  return readFileSync(file, 'utf8');
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.normalize(path.join(path.dirname(fromFile), specifier));
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...SOURCE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function collectImports(file, content) {
  const imports = [];
  const re = /\bimport(?:\s+type)?(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(content))) {
    imports.push(match[1]);
  }
  return imports;
}

const files = trackedFiles().filter((file) => existsSync(file) && isSource(file));
const problems = [];

for (const file of files) {
  const content = read(file);
  const productionServer = file.startsWith('apps/server/src/') && !isTest(file);
  const productionDocs = file.startsWith('docs/') && !isTest(file);
  const productionSdk = file.startsWith('packages/sdk/src/') && !isTest(file);

  if (productionServer && file !== 'apps/server/src/lib/config.ts' && /\bprocess\.env\b/.test(content)) {
    problems.push(`${file}: process.env must be read through apps/server/src/lib/config.ts`);
  }

  if (productionDocs && file !== 'docs/lib/site-config.ts' && /\bprocess\.env\b/.test(content)) {
    problems.push(`${file}: process.env must be read through docs/lib/site-config.ts`);
  }

  if (
    productionServer &&
    file !== 'apps/server/src/lib/log.ts' &&
    /\bconsole\.(log|info|warn|error|debug)\b/.test(content)
  ) {
    problems.push(`${file}: production server console usage must go through lib/log.ts`);
  }

  if (
    productionServer &&
    !['apps/server/src/lib/db.ts', 'apps/server/src/lib/queries.ts'].includes(file) &&
    /(from ['"]better-sqlite3['"]|\.prepare\()/.test(content)
  ) {
    problems.push(`${file}: direct SQLite access must stay in persistence modules`);
  }

  if (productionSdk && /from ['"](@\/|apps\/|.*server.*)['"]/.test(content)) {
    problems.push(`${file}: browser SDK must not import server code`);
  }

  if (productionSdk && /from ['"](node:)?(fs|path|crypto)|from ['"]better-sqlite3['"]/.test(content)) {
    problems.push(`${file}: browser SDK must not depend on Node-only modules`);
  }

  const tsIgnore = ['@ts', 'ignore'].join('-');
  if (content.includes(tsIgnore)) {
    problems.push(`${file}: ${tsIgnore} is not allowed`);
  }

  if (/\beval\s*\(|\bnew\s+Function\b/.test(content)) {
    problems.push(`${file}: dynamic code execution is not allowed`);
  }

  if (/from ['"]@tinyreplay\/sdk\/src\//.test(content)) {
    problems.push(`${file}: public API consumers must not deep-import SDK internals`);
  }
}

const graph = new Map();
for (const file of files) {
  const imports = collectImports(file, read(file))
    .map((specifier) => resolveImport(file, specifier))
    .filter(Boolean);
  graph.set(file, imports);
}

const visiting = new Set();
const visited = new Set();
const stack = [];

function visit(file) {
  if (visited.has(file)) return;
  if (visiting.has(file)) {
    const cycle = stack.slice(stack.indexOf(file)).concat(file);
    problems.push(`circular import: ${cycle.join(' -> ')}`);
    return;
  }
  visiting.add(file);
  stack.push(file);
  for (const next of graph.get(file) ?? []) visit(next);
  stack.pop();
  visiting.delete(file);
  visited.add(file);
}

for (const file of files) visit(file);

if (problems.length > 0) {
  console.error(`check:architecture found ${problems.length} issue(s):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log('check:architecture: no issues found.');
