#!/usr/bin/env node
// DO-UI nav resolver. A token-cheap lookup over the on-disk node catalog so
// only the requested node enters context, instead of scanning the full skill.
// Read-only. Never runs installs, never touches the network.
//
// Usage:
//   node nav.mjs find "<terms>" [--kind k --tier t --dep d --limit n] [--catalog path] [--json]
//   node nav.mjs get <id> [<id>...]                                   [--catalog path] [--json]
//   node nav.mjs list <prefix>                                        [--catalog path] [--json]
//   node nav.mjs related <id>                                         [--catalog path] [--json]
//   node nav.mjs plan <id> [<id>...]                                  [--catalog path] [--json]
//   node nav.mjs check                                                [--catalog path] [--json]
//
// Exit codes: 0 ok, 1 not found or invalid catalog, 2 bad usage.

import { readFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CATALOG = join(PLUGIN_ROOT, 'do-ui', 'nav', 'nodes.json');

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export async function loadCatalog(path) {
  const text = await readFile(resolve(path), 'utf8');
  return JSON.parse(text);
}

function suggest(nodes, id) {
  const segs = id.split('.');
  const ns2 = segs.slice(0, 2).join('.');
  const ns1 = segs[0];
  const pool = nodes.map((n) => n.id).filter((x) => x !== id);
  let s = pool.filter((x) => x === ns2 || x.startsWith(ns2 + '.'));
  if (s.length === 0) s = pool.filter((x) => x.startsWith(ns1 + '.'));
  return s.sort().slice(0, 5);
}

export function findNodes(nodes, query, filters = {}) {
  const terms = String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  let res = nodes.filter((n) => {
    if (filters.kind && n.kind !== filters.kind) return false;
    if (filters.tier && n.tier !== filters.tier) return false;
    if (filters.dep && !(n.deps || []).includes(filters.dep)) return false;
    return true;
  });

  if (terms.length === 0) {
    const hasFilter = Boolean(filters.kind || filters.tier || filters.dep);
    return hasFilter ? res.slice().sort(byId) : [];
  }

  res = res.filter((n) => {
    const hay = `${n.id} ${n.label} ${(n.tags || []).join(' ')}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
  return res.sort(byId);
}

export function getNodes(nodes, idList) {
  const map = new Map(nodes.map((n) => [n.id, n]));
  const found = [];
  const missing = [];
  const suggestions = {};
  for (const id of idList) {
    if (map.has(id)) found.push(map.get(id));
    else {
      missing.push(id);
      suggestions[id] = suggest(nodes, id);
    }
  }
  return { found, missing, suggestions };
}

export function listNodes(nodes, prefix) {
  const p = prefix.endsWith('.') ? prefix : prefix + '.';
  return nodes.filter((n) => n.id === prefix || n.id.startsWith(p)).sort(byId);
}

export function relatedNodes(nodes, id) {
  const map = new Map(nodes.map((n) => [n.id, n]));
  const node = map.get(id);
  if (!node) return { node: null, requires: [], pairs: [], alt: [], dangling: [] };
  const e = node.edges || {};
  const dangling = [];
  const resolveEdge = (arr) =>
    (arr || [])
      .map((rid) => {
        const t = map.get(rid);
        if (!t) {
          dangling.push(rid);
          return null;
        }
        return t;
      })
      .filter(Boolean);
  return {
    node,
    requires: resolveEdge(e.requires),
    pairs: resolveEdge(e.pairs),
    alt: resolveEdge(e.alt),
    dangling,
  };
}

export function planNodes(nodes, idList) {
  const map = new Map(nodes.map((n) => [n.id, n]));
  const steps = [];
  const missing = [];
  const notes = [];
  const depSet = new Set();
  for (const id of idList) {
    const n = map.get(id);
    if (!n) {
      missing.push(id);
      continue;
    }
    steps.push({ id: n.id, cmd: n.cmd });
    for (const d of n.deps || []) depSet.add(d);
    if (n.note) notes.push(`${n.id}: ${n.note}`);
  }
  return { steps, deps: [...depSet].sort(), missing, notes };
}

export function checkCatalog(nodes) {
  const seen = new Set();
  const dup = new Set();
  for (const n of nodes) {
    if (seen.has(n.id)) dup.add(n.id);
    else seen.add(n.id);
  }
  const idSet = new Set(nodes.map((n) => n.id));
  const danglingEdges = [];
  const selfEdges = [];
  for (const n of nodes) {
    const e = n.edges || {};
    for (const rel of ['requires', 'pairs', 'alt']) {
      for (const t of e[rel] || []) {
        if (t === n.id) selfEdges.push({ id: n.id, rel });
        else if (!idSet.has(t)) danglingEdges.push({ from: n.id, to: t, rel });
      }
    }
  }
  const duplicateIds = [...dup].sort();
  return {
    ok: duplicateIds.length === 0 && danglingEdges.length === 0 && selfEdges.length === 0,
    duplicateIds,
    danglingEdges,
    selfEdges,
  };
}

// ---- CLI ----

function parseArgs(argv) {
  const opts = { _: [], kind: null, tier: null, dep: null, catalog: DEFAULT_CATALOG, json: false, limit: 20 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--kind') opts.kind = argv[++i];
    else if (a === '--tier') opts.tier = argv[++i];
    else if (a === '--dep') opts.dep = argv[++i];
    else if (a === '--catalog') opts.catalog = argv[++i];
    else if (a === '--limit') opts.limit = parseInt(argv[++i], 10);
    else if (a === '--json') opts.json = true;
    else if (a.startsWith('--')) {
      console.error(`unknown flag: ${a}`);
      process.exit(2);
    } else opts._.push(a);
  }
  return opts;
}

function line(n) {
  const deps = (n.deps || []).length ? `  [${n.deps.join(', ')}]` : '';
  return `${n.id}  ${n.label}${deps}`;
}

function printNode(n) {
  console.log(`id: ${n.id}  kind: ${n.kind}  tier: ${n.tier}  reg: ${n.reg}`);
  console.log(`cmd: ${n.cmd}`);
  console.log(`deps: ${(n.deps || []).join(', ') || '-'}`);
  console.log(`tags: ${(n.tags || []).join(', ') || '-'}`);
  const e = n.edges || {};
  const parts = [];
  if ((e.requires || []).length) parts.push(`requires=${e.requires.join(',')}`);
  if ((e.pairs || []).length) parts.push(`pairs=${e.pairs.join(',')}`);
  if ((e.alt || []).length) parts.push(`alt=${e.alt.join(',')}`);
  if (parts.length) console.log(`edges: ${parts.join('  ')}`);
  if (n.note) console.log(`note: ${n.note}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const opts = parseArgs(argv.slice(1));

  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.error('commands: find, get, list, related, plan, check');
    process.exit(2);
  }

  let catalog;
  try {
    catalog = await loadCatalog(opts.catalog);
  } catch (e) {
    console.error(`cannot load catalog ${opts.catalog}: ${e.message}`);
    process.exit(1);
  }
  const nodes = catalog.nodes || [];

  if (cmd === 'find') {
    const query = opts._.join(' ');
    const res = findNodes(nodes, query, { kind: opts.kind, tier: opts.tier, dep: opts.dep });
    const shown = res.slice(0, opts.limit);
    if (opts.json) {
      process.stdout.write(JSON.stringify(shown, null, 2) + '\n');
    } else if (shown.length === 0) {
      console.log('no matches');
    } else {
      for (const n of shown) console.log(line(n));
      if (res.length > shown.length) console.log(`... ${res.length - shown.length} more (raise --limit)`);
    }
    process.exit(0);
  }

  if (cmd === 'get') {
    if (opts._.length === 0) {
      console.error('usage: nav.mjs get <id> [<id>...]');
      process.exit(2);
    }
    const r = getNodes(nodes, opts._);
    if (opts.json) {
      process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    } else {
      r.found.forEach((n, i) => {
        if (i > 0) console.log('');
        printNode(n);
      });
      for (const id of r.missing) {
        const sug = r.suggestions[id] || [];
        console.log(`not found: ${id}${sug.length ? `  did you mean: ${sug.join(', ')}` : ''}`);
      }
    }
    process.exit(r.missing.length ? 1 : 0);
  }

  if (cmd === 'list') {
    if (opts._.length === 0) {
      console.error('usage: nav.mjs list <prefix>');
      process.exit(2);
    }
    const res = listNodes(nodes, opts._[0]);
    if (opts.json) process.stdout.write(JSON.stringify(res, null, 2) + '\n');
    else if (res.length === 0) console.log('no matches');
    else for (const n of res) console.log(line(n));
    process.exit(0);
  }

  if (cmd === 'related') {
    if (opts._.length === 0) {
      console.error('usage: nav.mjs related <id>');
      process.exit(2);
    }
    const r = relatedNodes(nodes, opts._[0]);
    if (!r.node) {
      console.error(`not found: ${opts._[0]}`);
      process.exit(1);
    }
    if (opts.json) {
      process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    } else {
      printNode(r.node);
      const section = (name, arr) => {
        if (arr.length) {
          console.log(`${name}:`);
          for (const n of arr) console.log(`  ${line(n)}`);
        }
      };
      section('requires', r.requires);
      section('pairs', r.pairs);
      section('alt', r.alt);
      if (r.dangling.length) console.log(`dangling: ${r.dangling.join(', ')}`);
    }
    process.exit(0);
  }

  if (cmd === 'plan') {
    if (opts._.length === 0) {
      console.error('usage: nav.mjs plan <id> [<id>...]');
      process.exit(2);
    }
    const r = planNodes(nodes, opts._);
    if (opts.json) {
      process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    } else {
      console.log('install order:');
      for (const s of r.steps) console.log(`  ${s.cmd}`);
      console.log(`deps (resolve newest at install, then pin): ${r.deps.join(', ') || '-'}`);
      if (r.notes.length) {
        console.log('notes:');
        for (const note of r.notes) console.log(`  ${note}`);
      }
      if (r.missing.length) console.log(`missing: ${r.missing.join(', ')}`);
    }
    process.exit(r.missing.length ? 1 : 0);
  }

  if (cmd === 'check') {
    const r = checkCatalog(nodes);
    if (opts.json) {
      process.stdout.write(JSON.stringify({ count: nodes.length, ...r }, null, 2) + '\n');
    } else if (r.ok) {
      console.log(`check: ${nodes.length} nodes, no duplicate ids, no dangling or self edges.`);
    } else {
      if (r.duplicateIds.length) console.error(`duplicate ids: ${r.duplicateIds.join(', ')}`);
      for (const d of r.danglingEdges) console.error(`dangling edge: ${d.from} ${d.rel} -> ${d.to}`);
      for (const s of r.selfEdges) console.error(`self edge: ${s.id} ${s.rel}`);
    }
    process.exit(r.ok ? 0 : 1);
  }

  console.error(`unknown command: ${cmd}`);
  process.exit(2);
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((e) => {
    console.error(e.message || e);
    process.exit(2);
  });
}
