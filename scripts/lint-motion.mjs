#!/usr/bin/env node
// Confirm motion components handle prefers-reduced-motion.
// Looks for one of:
//   - useReducedMotion() hook (framer-motion)
//   - matchMedia('(prefers-reduced-motion: reduce)')
//   - @media (prefers-reduced-motion: reduce) in adjacent .css
//   - data-reduced-motion attribute
// Usage: node lint-motion.mjs [--dir components/motion] [--json]

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, dirname, basename } from 'node:path';

const TARGETS = /\.(tsx|jsx|ts|js)$/i;

const REDUCED_PATTERNS = [
  /useReducedMotion\s*\(/,
  /matchMedia\s*\(\s*['"`]\(prefers-reduced-motion:\s*reduce\)['"`]\s*\)/,
  /prefers-reduced-motion\s*:\s*reduce/,
  /data-reduced-motion/
];

function parseArgs(argv) {
  const opts = { dir: 'components/motion', json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') opts.dir = argv[++i];
    else if (a === '--json') opts.json = true;
    else { console.error(`unknown flag: ${a}`); process.exit(2); }
  }
  return opts;
}

async function* walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && TARGETS.test(e.name)) yield p;
  }
}

async function checkFile(file) {
  const text = await readFile(file, 'utf8');
  for (const re of REDUCED_PATTERNS) if (re.test(text)) return { file, ok: true };

  // Adjacent .css sibling?
  const cssCandidates = [
    file.replace(TARGETS, '.css'),
    join(dirname(file), `${basename(file, extname(file))}.module.css`)
  ];
  for (const c of cssCandidates) {
    try {
      const ctext = await readFile(c, 'utf8');
      if (/@media\s*\([^)]*prefers-reduced-motion:\s*reduce/.test(ctext)) {
        return { file, ok: true, via: c };
      }
    } catch {}
  }
  return { file, ok: false };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = resolve(opts.dir);
  try { await stat(root); }
  catch {
    console.error(`dir not found: ${root}`);
    process.exit(2);
  }

  const results = [];
  for await (const f of walk(root)) results.push(await checkFile(f));
  const fails = results.filter(r => !r.ok);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ scanned: results.length, fails }, null, 2) + '\n');
  } else {
    for (const r of results) {
      console.log(`  [${r.ok ? 'OK  ' : 'FAIL'}] ${r.file}${r.via ? ` (via ${r.via})` : ''}`);
    }
    console.log('');
    console.log(fails.length === 0
      ? `lint-motion: all ${results.length} files handle reduced motion.`
      : `lint-motion: ${fails.length}/${results.length} files missing reduced-motion handling.`);
  }
  process.exit(fails.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e.message || e); process.exit(2); });
