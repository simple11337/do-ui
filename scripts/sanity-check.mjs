#!/usr/bin/env node
// DO-UI sanity check. Scans files for emojis, em/en dashes, CSS gradients.
// Usage:
//   node sanity-check.mjs [path ...]          scan paths (default: cwd)
//   node sanity-check.mjs --json [path ...]   machine-readable report
//   node sanity-check.mjs --staged            scan only git-staged files
// Exit codes: 0 clean, 1 violations found, 2 bad invocation.

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname, resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.mdx', '.css', '.scss', '.html', '.svg'
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'out', 'dist', '.vercel',
  '.turbo', 'coverage', '.cache'
]);

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/u;
const DASH_RE = /[–—]/;
const CSS_GRADIENT_RE = /(linear|radial|conic)-gradient\s*\(|repeating-(linear|radial|conic)-gradient\s*\(/i;
const TW_GRADIENT_RE = /\bbg-gradient-to-(t|tr|r|br|b|bl|l|tl)\b/;
const TW_STOP_RE = /\b(from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|transparent)(-\d{2,3})?\b/;

const OPT_OUT_RE = /\/\/\s*stealth-ok\b/;

// Security rules. Enforced for code files only (not markdown or json docs).
// Opt a single line out with a trailing // security-ok comment, and only
// with a documented reason. Do not use it to silence a real finding.
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.html']);
const SEC_OPT_OUT_RE = /\/\/\s*security-ok\b/;
const SECURITY_RULES = [
  { rule: 'xss-html', re: /dangerouslySetInnerHTML|\.(?:inner|outer)HTML\s*=|insertAdjacentHTML\s*\(/ },
  { rule: 'dynamic-eval', re: /\beval\s*\(|new\s+Function\s*\(|document\.write\s*\(/ },
  { rule: 'mixed-content', re: /\bhttp:\/\/(?!localhost|127\.0\.0\.1)/ },
  { rule: 'hardcoded-secret', re: /(?:api[_-]?key|secret|token|password|private[_-]?key|license[_-]?key)\s*[:=]\s*["'][A-Za-z0-9_\-]{12,}["']/i },
];
const TARGET_BLANK_RE = /target\s*=\s*["'{]?_blank/;
const NOOPENER_RE = /noopener/;

function parseArgs(argv) {
  const opts = { json: false, staged: false, paths: [] };
  for (const a of argv) {
    if (a === '--json') opts.json = true;
    else if (a === '--staged') opts.staged = true;
    else if (a.startsWith('--')) {
      console.error(`unknown flag: ${a}`);
      process.exit(2);
    } else opts.paths.push(a);
  }
  if (opts.paths.length === 0 && !opts.staged) opts.paths = [process.cwd()];
  return opts;
}

async function* walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(join(dir, e.name));
    } else if (e.isFile()) {
      if (SCAN_EXT.has(extname(e.name))) yield join(dir, e.name);
    }
  }
}

async function collect(paths) {
  const out = [];
  for (const p of paths) {
    const abs = resolve(p);
    let s;
    try { s = await stat(abs); } catch { continue; }
    if (s.isDirectory()) {
      for await (const f of walk(abs)) out.push(f);
    } else if (s.isFile() && SCAN_EXT.has(extname(abs))) {
      out.push(abs);
    }
  }
  return out;
}

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf8' });
    return out.split('\n').filter(Boolean).filter(f => SCAN_EXT.has(extname(f)));
  } catch {
    console.error('not a git repo or git not available');
    process.exit(2);
  }
}

function scanLine(line) {
  const hits = [];
  if (EMOJI_RE.test(line)) hits.push({ rule: 'emoji', snippet: line.match(EMOJI_RE)[0] });
  if (DASH_RE.test(line)) hits.push({ rule: 'dash', snippet: line.match(DASH_RE)[0] });
  if (!OPT_OUT_RE.test(line)) {
    if (CSS_GRADIENT_RE.test(line)) hits.push({ rule: 'gradient', snippet: line.match(CSS_GRADIENT_RE)[0] });
    if (TW_GRADIENT_RE.test(line)) hits.push({ rule: 'tw-gradient', snippet: line.match(TW_GRADIENT_RE)[0] });
    if (TW_STOP_RE.test(line) && /\bbg-gradient-/.test(line)) {
      hits.push({ rule: 'tw-gradient-stop', snippet: line.match(TW_STOP_RE)[0] });
    }
  }
  return hits;
}

function scanSecurityLine(line) {
  if (SEC_OPT_OUT_RE.test(line)) return [];
  const hits = [];
  for (const { rule, re } of SECURITY_RULES) {
    if (re.test(line)) hits.push({ rule, snippet: line.match(re)[0].trim() });
  }
  if (TARGET_BLANK_RE.test(line) && !NOOPENER_RE.test(line)) {
    hits.push({ rule: 'tabnabbing', snippet: line.match(TARGET_BLANK_RE)[0] });
  }
  return hits;
}

// Files inside the plugin that legitimately mention banned tokens by name
// (rule definitions, scan patterns, the README ban table).
const SELF_DOC_WHITELIST = [
  'do-ui/style-rules.md',
  'do-ui/sanity-check.md',
  'do-ui/injection-guard.md',
  'do-ui/pipeline.md',
  'do-ui/security-policy.md',
  'do-ui/context-pack.md',
  'agents/do-ui-orchestrator.md',
  'agents/do-ui-asset-fetcher.md',
  'scripts/sanity-check.mjs',
  'README.md'
].map(p => resolve(PLUGIN_ROOT, p));

function isPluginSelfDoc(file) {
  const abs = resolve(file);
  return SELF_DOC_WHITELIST.includes(abs);
}

async function scanFile(file) {
  if (isPluginSelfDoc(file)) return [];
  let text;
  try { text = await readFile(file, 'utf8'); } catch { return []; }
  const lines = text.split(/\r?\n/);
  const isCode = CODE_EXT.has(extname(file));
  const rel = relative(process.cwd(), file).replace(/\\/g, '/');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    for (const h of scanLine(lines[i])) {
      hits.push({ file: rel, line: i + 1, ...h });
    }
    if (isCode) {
      for (const h of scanSecurityLine(lines[i])) {
        hits.push({ file: rel, line: i + 1, ...h });
      }
    }
  }
  return hits;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const files = opts.staged ? getStagedFiles().map(f => resolve(f)) : await collect(opts.paths);
  const allHits = [];
  for (const f of files) allHits.push(...(await scanFile(f)));

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      filesScanned: files.length,
      hits: allHits,
      passed: allHits.length === 0
    }, null, 2));
    process.stdout.write('\n');
  } else {
    if (allHits.length === 0) {
      console.log(`sanity-check pass. ${files.length} files scanned. no violations.`);
    } else {
      console.error(`sanity-check FAIL. ${files.length} files scanned. ${allHits.length} violations:`);
      for (const h of allHits) {
        console.error(`  ${h.file}:${h.line}: [${h.rule}] ${h.snippet}`);
      }
    }
  }
  process.exit(allHits.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
