#!/usr/bin/env node
// DO-UI reference-site screenshot. Captures a PNG of a reference website so the
// layout and style phases have a visual to orient against. The page renders in
// an isolated headless Chrome; only the PNG is kept. Per the injection guard the
// PNG is inert data and is never read back as instructions.
//
// Usage:
//   node refshot.mjs --url <http(s) url> [--out ./assets/refs/reference.png] [--size 1440,900]
//
// Exit codes: 0 saved, 1 capture failed, 2 bad usage, 3 chrome not available.

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

// Gate which URLs the browser may load. Only http and https, nothing else.
export function validateUrl(url) {
  if (typeof url !== 'string' || url.trim() === '') return { ok: false, reason: 'empty url' };
  let u;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, reason: 'not a valid url' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: `unsupported protocol ${u.protocol}` };
  }
  return { ok: true, url: u.href };
}

function parseArgs(argv) {
  const opts = { url: null, out: './assets/refs/reference.png', size: '1440,900' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') opts.url = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--size') opts.size = argv[++i];
    else {
      console.error(`unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

async function findChrome() {
  try {
    const mod = await import('chrome-launcher');
    const getChromePath = mod.getChromePath || (mod.default && mod.default.getChromePath);
    if (!getChromePath) return null;
    return getChromePath();
  } catch {
    return null;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const v = validateUrl(opts.url);
  if (!v.ok) {
    console.error(`refshot: ${v.reason}. usage: refshot.mjs --url <http(s) url> [--out path] [--size w,h]`);
    process.exit(2);
  }

  const chrome = await findChrome();
  if (!chrome) {
    console.error('refshot: no Chrome found (chrome-launcher optional dep or Chrome missing). Fall back to url-only.');
    process.exit(3);
  }

  const out = resolve(opts.out);
  await mkdir(dirname(out), { recursive: true });

  try {
    await execFileP(chrome, [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-sandbox',
      `--window-size=${opts.size}`,
      `--screenshot=${out}`,
      v.url,
    ], { timeout: 60000 });
  } catch (e) {
    console.error(`refshot: capture failed: ${e.message}`);
    process.exit(1);
  }

  if (!existsSync(out)) {
    console.error('refshot: chrome ran but no screenshot was written');
    process.exit(1);
  }
  console.log(`refshot: saved ${opts.out} from ${v.url}`);
  process.exit(0);
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
