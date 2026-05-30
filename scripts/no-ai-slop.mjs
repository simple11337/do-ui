#!/usr/bin/env node
// DO-UI no-ai-slop flagger. Reports AI slop in code. Never deletes anything.
// Slop means: redundant comments that restate code, leftover stubs and TODOs,
// debug remnants, bloated JSDoc and decorative banners, lazy type escapes.
//
// Usage:
//   node no-ai-slop.mjs [path ...]          scan paths (default: cwd)
//   node no-ai-slop.mjs --json [path ...]   machine-readable report
//   node no-ai-slop.mjs --staged            scan only git-staged files
// Exit codes: 0 clean, 1 slop found, 2 bad invocation.
//
// This is advisory. It points at lines a human should look at. It cannot tell
// a useful comment from a redundant one with certainty, so it never edits.
// Opt a single line out with a trailing // slop-ok comment.

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname, resolve, relative } from 'node:path';
import { execSync } from 'node:child_process';

const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'out', 'dist', '.vercel',
  '.turbo', 'coverage', '.cache'
]);

const OPT_OUT_RE = /\/\/\s*slop-ok\b/;

// Redundant comment openers. These are the phrasings AI reaches for when it
// narrates code instead of explaining intent.
const REDUNDANT_OPENER_RE = /^(?:imports?|renders?|rendering|returns?|returning|define[sd]?|creates?|creating|initiali[sz]e[sd]?|sets? up|sets? the|handles? the|gets? the|loops? through|maps? over|iterates? over|destructure[sd]?|state for|ref for|props? for|the main|this (?:component|function|hook|class|method|file|page|section|module|variable)|component that|function that|helper (?:function|to)|a (?:function|helper|component) that|start of|end of)\b/i;

// Decorative banner: a comment that is mostly punctuation.
const BANNER_RE = /^[=*\-#~_.\s]{6,}$/;

// Placeholder and stub phrasings.
const PLACEHOLDER_RE = /\b(?:your code here|implement me|implement this|placeholder|rest of (?:the )?(?:code|implementation|logic|component)|add (?:your |more |the )?[\w ]* here|coming soon|fill (?:this )?in|stub|not implemented|to be implemented)\b/i;
const TODO_RE = /\b(?:TODO|FIXME|XXX|HACK)\b/;

// Debug remnants.
const CONSOLE_RE = /\bconsole\.(?:log|debug|info|trace)\s*\(/;
const DEBUGGER_RE = /\bdebugger\b\s*;?/;

// Lazy type escapes.
const TS_SUPPRESS_RE = /@ts-(?:ignore|nocheck|expect-error)\b/;
const AS_ANY_RE = /\bas\s+any\b/;

// JSDoc filler.
const JSDOC_VOID_RE = /@returns?\s*\{\s*void\s*\}/i;
const JSDOC_BARE_PARAM_RE = /@param\s+\{[^}]+\}\s+\S+\s*$/;

function commentText(line) {
  // Returns the inner text of a single-line comment, or null if not a comment.
  const t = line.trim();
  let m;
  if ((m = t.match(/^\/\/\s?(.*)$/))) return m[1].trim();
  if ((m = t.match(/^\{?\/\*\s?(.*?)\s*\*\/\}?$/))) return m[1].trim();
  if ((m = t.match(/^\*\s?(.*)$/))) return m[1].trim();   // jsdoc body line
  if ((m = t.match(/^\/\*\s?(.*)$/))) return m[1].trim();  // block open
  return null;
}

function looksLikeCode(text) {
  if (!text) return false;
  if (/[;{}]\s*$/.test(text)) return true;
  if (/=>/.test(text)) return true;
  if (/\b(?:const|let|var|function|return|import|export|class)\b.*[=({]/.test(text)) return true;
  if (/^<\/?[A-Za-z][\w.]*[\s/>]/.test(text)) return true;  // commented out JSX
  return false;
}

function scanLine(line) {
  if (OPT_OUT_RE.test(line)) return [];
  const hits = [];
  const text = commentText(line);

  if (text !== null) {
    if (BANNER_RE.test(text)) hits.push({ rule: 'banner', snippet: line.trim().slice(0, 60) });
    else if (REDUNDANT_OPENER_RE.test(text)) hits.push({ rule: 'redundant-comment', snippet: text.slice(0, 60) });
    else if (looksLikeCode(text)) hits.push({ rule: 'commented-code', snippet: text.slice(0, 60) });

    if (PLACEHOLDER_RE.test(text)) hits.push({ rule: 'placeholder', snippet: text.slice(0, 60) });
    if (TODO_RE.test(text)) hits.push({ rule: 'todo-left', snippet: text.slice(0, 60) });
    if (JSDOC_VOID_RE.test(text) || JSDOC_BARE_PARAM_RE.test(line)) {
      hits.push({ rule: 'jsdoc-filler', snippet: text.slice(0, 60) });
    }
  }

  // Code-line checks (run regardless of comment status).
  if (CONSOLE_RE.test(line)) hits.push({ rule: 'debug-console', snippet: line.match(CONSOLE_RE)[0] });
  if (DEBUGGER_RE.test(line)) hits.push({ rule: 'debugger', snippet: 'debugger' });
  if (TS_SUPPRESS_RE.test(line)) hits.push({ rule: 'ts-suppress', snippet: line.match(TS_SUPPRESS_RE)[0] });
  if (AS_ANY_RE.test(line)) hits.push({ rule: 'as-any', snippet: 'as any' });

  return hits;
}

function parseArgs(argv) {
  const opts = { json: false, staged: false, paths: [] };
  for (const a of argv) {
    if (a === '--json') opts.json = true;
    else if (a === '--staged') opts.staged = true;
    else if (a.startsWith('--')) { console.error(`unknown flag: ${a}`); process.exit(2); }
    else opts.paths.push(a);
  }
  if (opts.paths.length === 0 && !opts.staged) opts.paths = [process.cwd()];
  return opts;
}

async function* walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(join(dir, e.name));
    } else if (e.isFile() && SCAN_EXT.has(extname(e.name))) {
      yield join(dir, e.name);
    }
  }
}

async function collect(paths) {
  const out = [];
  for (const p of paths) {
    const abs = resolve(p);
    let s;
    try { s = await stat(abs); } catch { continue; }
    if (s.isDirectory()) { for await (const f of walk(abs)) out.push(f); }
    else if (s.isFile() && SCAN_EXT.has(extname(abs))) out.push(abs);
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

async function scanFile(file) {
  let text;
  try { text = await readFile(file, 'utf8'); } catch { return []; }
  const lines = text.split(/\r?\n/);
  const rel = relative(process.cwd(), file).replace(/\\/g, '/');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    for (const h of scanLine(lines[i])) hits.push({ file: rel, line: i + 1, ...h });
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
      clean: allHits.length === 0
    }, null, 2));
    process.stdout.write('\n');
  } else if (allHits.length === 0) {
    console.log(`no-ai-slop pass. ${files.length} files scanned. no slop found.`);
  } else {
    console.error(`no-ai-slop found ${allHits.length} item(s) to review across ${files.length} files:`);
    for (const h of allHits) console.error(`  ${h.file}:${h.line}: [${h.rule}] ${h.snippet}`);
    console.error('\nAdvisory only. Review each, then remove by hand or with a targeted edit. Add // slop-ok to keep a line on purpose.');
  }
  process.exit(allHits.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
