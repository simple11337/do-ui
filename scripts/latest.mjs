#!/usr/bin/env node
// DO-UI latest version gate. Forces newest packages: it asserts every
// dependency in the current project is at its newest published version.
// Resolution happens through the npm toolchain (npm outdated), so this adds
// no raw network code. Pin the resolved version in the lockfile afterward.
//
// Usage:
//   node latest.mjs [--allow pkg1,pkg2] [--json]
//   (run inside the target project, where package.json and node_modules live)
//
// Exit codes: 0 all newest, 1 one or more deps stale, 2 toolchain error.

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Turn parsed `npm outdated --json` into the list of deps that are not newest.
// A dep is stale when its installed version differs from latest, or when it is
// not installed at all. allow is a list of package names to ignore.
export function findStale(outdated, allow = []) {
  const skip = new Set(allow);
  const stale = [];
  for (const [name, info] of Object.entries(outdated || {})) {
    if (skip.has(name)) continue;
    const latest = info && info.latest;
    if (!latest) continue;
    const current = info.current == null ? null : info.current;
    if (current !== latest) stale.push({ name, current, latest });
  }
  return stale.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function parseArgs(argv) {
  const opts = { allow: [], json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--allow') opts.allow = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--json') opts.json = true;
    else {
      console.error(`unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

function readOutdated() {
  // npm outdated exits 1 when anything is outdated, so capture stdout either way.
  try {
    const out = execSync('npm outdated --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim() ? JSON.parse(out) : {};
  } catch (e) {
    const out = (e.stdout || '').toString().trim();
    if (out) {
      try {
        return JSON.parse(out);
      } catch {
        throw new Error('could not parse npm outdated output');
      }
    }
    return {};
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  let outdated;
  try {
    outdated = readOutdated();
  } catch (e) {
    console.error(`latest gate: ${e.message}`);
    process.exit(2);
  }
  const stale = findStale(outdated, opts.allow);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ ok: stale.length === 0, stale }, null, 2) + '\n');
  } else if (stale.length === 0) {
    console.log('latest gate: all dependencies are at their newest version.');
  } else {
    console.error('latest gate: stale dependencies (install newest, then pin the lockfile):');
    for (const s of stale) console.error(`  ${s.name}: ${s.current ?? 'not installed'} -> ${s.latest}`);
  }
  process.exit(stale.length === 0 ? 0 : 1);
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
