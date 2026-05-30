#!/usr/bin/env node
// Generate a black-and-white copy of a reference image. Used for Q2.
// Usage: node grayscale.mjs --in path [--out path]

import { resolve, dirname, basename, extname, join } from 'node:path';
import { existsSync } from 'node:fs';

function parseArgs(argv) {
  const opts = { in: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') opts.in = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else { console.error(`unknown flag: ${a}`); process.exit(2); }
  }
  if (!opts.in) {
    console.error('usage: grayscale.mjs --in path [--out path]');
    process.exit(2);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const src = resolve(opts.in);
  if (!existsSync(src)) {
    console.error(`input not found: ${src}`);
    process.exit(2);
  }
  const out = opts.out
    ? resolve(opts.out)
    : join(dirname(src), `${basename(src, extname(src))}-bw${extname(src)}`);

  let sharp;
  try { sharp = (await import('sharp')).default; }
  catch { console.error('sharp not installed. run: npm install'); process.exit(2); }

  await sharp(src).grayscale().toFile(out);
  console.log(`wrote ${out}`);
}

main().catch(e => { console.error(e.message || e); process.exit(2); });
