#!/usr/bin/env node
// WCAG 2.1 contrast checker. AA body text target: 4.5:1. AA large text: 3:1.
// Usage:
//   node contrast.mjs --fg #112233 --bg #ffffff
//   node contrast.mjs --brief do-ui/brief.json   (checks all palette pairs)

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function parseHex(h) {
  const m = h.replace(/^#/, '').match(/^([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (!m) throw new Error(`bad hex: ${h}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function lum([r, g, b]) {
  const f = v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a, b) {
  const la = lum(parseHex(a));
  const lb = lum(parseHex(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function parseArgs(argv) {
  const opts = { fg: null, bg: null, brief: null, json: false, target: 4.5 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fg') opts.fg = argv[++i];
    else if (a === '--bg') opts.bg = argv[++i];
    else if (a === '--brief') opts.brief = argv[++i];
    else if (a === '--target') opts.target = parseFloat(argv[++i]);
    else if (a === '--json') opts.json = true;
    else { console.error(`unknown flag: ${a}`); process.exit(2); }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  let pairs = [];
  if (opts.brief) {
    const brief = JSON.parse(await readFile(resolve(opts.brief), 'utf8'));
    const palette = brief.palette || [];
    for (let i = 0; i < palette.length; i++) {
      for (let j = 0; j < palette.length; j++) {
        if (i !== j) pairs.push({ fg: palette[i], bg: palette[j] });
      }
    }
  } else if (opts.fg && opts.bg) {
    pairs.push({ fg: opts.fg, bg: opts.bg });
  } else {
    console.error('usage: contrast.mjs --fg HEX --bg HEX  OR  --brief path');
    process.exit(2);
  }

  const results = pairs.map(p => {
    const r = ratio(p.fg, p.bg);
    return { ...p, ratio: Math.round(r * 100) / 100, passesAA: r >= opts.target };
  });

  const fails = results.filter(r => !r.passesAA);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ target: opts.target, results, fails: fails.length }, null, 2) + '\n');
  } else {
    for (const r of results) {
      const mark = r.passesAA ? 'OK  ' : 'FAIL';
      console.log(`  [${mark}] fg=${r.fg} bg=${r.bg} ratio=${r.ratio} (target ${opts.target})`);
    }
    console.log('');
    console.log(fails.length === 0 ? 'contrast: all pairs pass.' : `contrast: ${fails.length} pair(s) fail.`);
  }

  // Single-pair mode: exit on miss. Brief mode: never exit non-zero, just report.
  // The orchestrator decides which pair is actually fg-on-bg.
  if (opts.brief) process.exit(0);
  process.exit(fails.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e.message || e); process.exit(2); });
