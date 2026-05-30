#!/usr/bin/env node
// DO-UI doctor. Checks runtime, deps, project structure.
// Usage: node doctor.mjs [--json]

import { existsSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const checks = [];

function check(name, fn) {
  try {
    const r = fn();
    checks.push({ name, ok: r.ok, detail: r.detail });
  } catch (e) {
    checks.push({ name, ok: false, detail: e.message });
  }
}

function nodeVersion() {
  const v = process.versions.node;
  const major = parseInt(v.split('.')[0], 10);
  return { ok: major >= 20, detail: `node ${v} (need >= 20)` };
}

function npmVersion() {
  try {
    const v = execSync('npm --version', { encoding: 'utf8' }).trim();
    return { ok: true, detail: `npm ${v}` };
  } catch {
    return { ok: false, detail: 'npm not found in PATH' };
  }
}

function gitAvailable() {
  try {
    const v = execSync('git --version', { encoding: 'utf8' }).trim();
    return { ok: true, detail: v };
  } catch {
    return { ok: false, detail: 'git not in PATH' };
  }
}

async function hasModule(name) {
  try {
    await import(name);
    return { ok: true, detail: `${name} resolvable` };
  } catch {
    return { ok: false, detail: `${name} missing. run: npm install` };
  }
}

function pluginStructure() {
  const required = [
    '.claude-plugin/plugin.json',
    'commands/makeui.md',
    'agents/do-ui-orchestrator.md',
    'agents/do-ui-asset-fetcher.md',
    'do-ui/injection-guard.md',
    'do-ui/style-rules.md',
    'do-ui/security-policy.md',
    'do-ui/pipeline.md',
    'do-ui/sanity-check.md',
    'do-ui/context-pack.md',
    'do-ui/schemas/brief.schema.json',
    'do-ui/schemas/assets.schema.json',
    'do-ui/schemas/nodes.schema.json',
    'do-ui/nav/nodes.json',
    'scripts/nav.mjs',
    'scripts/latest.mjs',
    'scripts/refshot.mjs',
    'scripts/no-ai-slop.mjs',
    'skills/no-ai-slop/SKILL.md'
  ];
  const missing = required.filter(f => !existsSync(join(PLUGIN_ROOT, f)));
  return missing.length === 0
    ? { ok: true, detail: `${required.length} plugin files present at ${PLUGIN_ROOT}` }
    : { ok: false, detail: `missing under ${PLUGIN_ROOT}: ${missing.join(', ')}` };
}

function navCatalog() {
  const out = execSync('node scripts/nav.mjs check --json', { cwd: PLUGIN_ROOT, encoding: 'utf8' });
  const r = JSON.parse(out);
  return { ok: r.ok, detail: `${r.count} nodes, ${r.ok ? 'no duplicate ids or broken edges' : 'integrity errors'}` };
}

function projectStructure() {
  const cwd = process.cwd();
  const dirs = ['app', 'components', 'styles', 'assets', 'do-ui', 'public'];
  const present = dirs.filter(d => existsSync(join(cwd, d)) && statSync(join(cwd, d)).isDirectory());
  return { ok: true, detail: `present in cwd: ${present.join(', ') || 'none'} (informational)` };
}

async function main() {
  const json = process.argv.includes('--json');

  check('node version', nodeVersion);
  check('npm available', npmVersion);
  check('git available', gitAvailable);
  checks.push({ name: 'ajv installed', ...(await hasModule('ajv')) });
  checks.push({ name: 'sharp installed', ...(await hasModule('sharp')) });
  checks.push({ name: 'lighthouse installed (optional)', ...(await hasModule('lighthouse')) });
  checks.push({ name: 'acorn installed (optional)', ...(await hasModule('acorn')) });
  check('plugin structure', pluginStructure);
  check('nav catalog', navCatalog);
  check('project structure', projectStructure);

  const failed = checks.filter(c => !c.ok && !c.name.includes('optional'));

  if (json) {
    process.stdout.write(JSON.stringify({ checks, ok: failed.length === 0 }, null, 2) + '\n');
  } else {
    for (const c of checks) {
      const mark = c.ok ? 'OK  ' : (c.name.includes('optional') ? 'opt ' : 'FAIL');
      console.log(`  [${mark}] ${c.name}: ${c.detail}`);
    }
    console.log('');
    console.log(failed.length === 0
      ? 'doctor: all required checks passed.'
      : `doctor: ${failed.length} required check(s) failed.`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
