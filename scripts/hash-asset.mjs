#!/usr/bin/env node
// Cross-platform SHA-256 hash for a file. Replaces certutil vs sha256sum split.
// Usage: node hash-asset.mjs <file> [--json]

import { createReadStream, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

async function hashFile(path) {
  return new Promise((res, rej) => {
    const h = createHash('sha256');
    const s = createReadStream(path);
    s.on('data', c => h.update(c));
    s.on('end', () => res(h.digest('hex')));
    s.on('error', rej);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const file = args.find(a => !a.startsWith('--'));
  if (!file) {
    console.error('usage: hash-asset.mjs <file> [--json]');
    process.exit(2);
  }
  const abs = resolve(file);
  let s;
  try { s = statSync(abs); }
  catch { console.error(`not found: ${abs}`); process.exit(2); }

  const sha = await hashFile(abs);
  if (json) {
    process.stdout.write(JSON.stringify({ file: abs, bytes: s.size, sha256: sha }) + '\n');
  } else {
    console.log(`${sha}  ${abs}  (${s.size} bytes)`);
  }
}

main().catch(e => { console.error(e); process.exit(2); });
