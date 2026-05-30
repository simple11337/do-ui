#!/usr/bin/env node
// Install a pre-commit hook in the current git repo that runs DO-UI sanity check
// on staged files. Uses plain .git/hooks/pre-commit (no husky dependency).
// Usage: node install-hooks.mjs [--force]

import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function gitRoot() {
  try { return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim(); }
  catch { console.error('not a git repository'); process.exit(2); }
}

function main() {
  const force = process.argv.includes('--force');
  const root = gitRoot();
  const hooksDir = join(root, '.git', 'hooks');
  const hookPath = join(hooksDir, 'pre-commit');

  if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });

  if (existsSync(hookPath) && !force) {
    const current = readFileSync(hookPath, 'utf8');
    if (!current.includes('DO-UI sanity check')) {
      console.error(`pre-commit already exists at ${hookPath}. re-run with --force to overwrite.`);
      process.exit(1);
    }
  }

  const sanityScript = join(PLUGIN_ROOT, 'scripts', 'sanity-check.mjs').replace(/\\/g, '/');

  const body = `#!/usr/bin/env sh
# DO-UI sanity check
# Auto-installed by do-ui/scripts/install-hooks.mjs
node "${sanityScript}" --staged
status=$?
if [ $status -ne 0 ]; then
  echo ""
  echo "DO-UI sanity check failed. Fix the violations or commit with --no-verify if you must."
  exit $status
fi
`;
  writeFileSync(hookPath, body, { encoding: 'utf8' });
  try { chmodSync(hookPath, 0o755); } catch {}
  console.log(`installed pre-commit hook at ${hookPath}`);
  console.log(`points at ${sanityScript}`);
}

main();
