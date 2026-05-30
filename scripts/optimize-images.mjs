#!/usr/bin/env node
// Batch convert PNG/JPG under a directory to WebP at quality 80.
// Originals are kept. Skips if WebP sibling already newer.
// Usage: node optimize-images.mjs --dir path [--quality 80] [--replace]

import { readdir, stat, unlink } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

function parseArgs(argv) {
  const opts = { dir: null, quality: 80, replace: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') opts.dir = argv[++i];
    else if (a === '--quality') opts.quality = parseInt(argv[++i], 10);
    else if (a === '--replace') opts.replace = true;
    else { console.error(`unknown flag: ${a}`); process.exit(2); }
  }
  if (!opts.dir) { console.error('usage: optimize-images.mjs --dir path [--quality N] [--replace]'); process.exit(2); }
  return opts;
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && /\.(png|jpe?g)$/i.test(e.name)) yield p;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = resolve(opts.dir);

  let sharp;
  try { sharp = (await import('sharp')).default; }
  catch { console.error('sharp not installed. run: npm install'); process.exit(2); }

  let converted = 0, skipped = 0, removed = 0;
  for await (const file of walk(root)) {
    const out = file.replace(/\.(png|jpe?g)$/i, '.webp');
    let needs = true;
    try {
      const [a, b] = await Promise.all([stat(file), stat(out)]);
      needs = a.mtimeMs > b.mtimeMs;
    } catch { needs = true; }
    if (!needs) { skipped++; continue; }
    await sharp(file).webp({ quality: opts.quality }).toFile(out);
    converted++;
    if (opts.replace) { await unlink(file); removed++; }
  }
  console.log(`optimize-images: converted=${converted} skipped=${skipped} removedOriginals=${removed}`);
}

main().catch(e => { console.error(e.message || e); process.exit(2); });
