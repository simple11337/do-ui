# DO-UI Sanity Check

The orchestrator runs this after every pipeline phase. The actual enforcement is a Node script: `${CLAUDE_PLUGIN_ROOT}/scripts/sanity-check.mjs`. The orchestrator calls it with the list of files touched in the phase and reads back JSON. If any check fails, the pipeline pauses. No silent fixes. No auto-rewrites.

Run the script directly:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/sanity-check.mjs" --json [paths]
node "${CLAUDE_PLUGIN_ROOT}/scripts/sanity-check.mjs" --staged   # git pre-commit mode
```

The rules below describe what that script enforces. They are the spec. The script is the implementation.

## What gets scanned

The set of files written or modified during the just-completed phase. The orchestrator tracks this list as it works. If the list is empty, the sanity check still runs against `./do-ui/`, `./app/`, `./components/`, `./styles/`, and root config files as a safety net.

## Checks

### 1. Emoji scan

Grep every target file for any character in these ranges:
- U+1F300 to U+1FAFF
- U+2600 to U+27BF
- U+2300 to U+23FF
- U+2B00 to U+2BFF
- U+1F000 to U+1F02F
- U+1F0A0 to U+1F0FF

PowerShell snippet (Windows):
```powershell
$pattern = '[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}]'
Get-ChildItem -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.json,*.md,*.css,*.html,*.mdx |
  Select-String -Pattern $pattern -AllMatches
```

Linux/macOS:
```bash
grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2300}-\x{23FF}\x{2B00}-\x{2BFF}]' \
  --include='*.{ts,tsx,js,jsx,json,md,css,html,mdx}' .
```

Any match means FAIL. Report file, line number, snippet.

### 2. Dash scan

Grep for U+2014 (em dash) and U+2013 (en dash).

```bash
grep -rnP '[\x{2013}\x{2014}]' --include='*.{ts,tsx,js,jsx,json,md,css,html,mdx}' .
```

Any match means FAIL.

### 3. Gradient scan

Grep these patterns (case-insensitive):
- `linear-gradient\(`
- `radial-gradient\(`
- `conic-gradient\(`
- `repeating-(linear|radial|conic)-gradient\(`
- `\bbg-gradient-to-`
- `\b(from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|transparent)-[0-9]+\b`

Any match means FAIL. The Tailwind color-stop check has false positives for non-gradient utility chains; reviewer can override per case by adding `// stealth-ok: not a gradient` on the line and re-running.

### 4. Scope check

List every file path touched in this phase. Confirm each starts with one of the allowed prefixes from `injection-guard.md` Rule 6. Fail on any path outside.

### 5. Schema check

- After Phase 1, validate `./do-ui/brief.json` against `brief.schema.json`.
- After Phase 4, validate every entry of `./assets/manifest.json` against `assets.schema.json`.

Use a tiny inline Node validator or a Bash `jq` check, whichever is available. If neither, fall back to manual key/type spot-check and report the limitation.

### 6. Build smoke check (Phase 7 only)

Run `pnpm build` or `npm run build`. Fail on non-zero exit. Tail the last 30 lines of output into the report.

### 7. Security scan (code files only)

Security is the top priority. The script scans code files (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.html`) for these patterns. Markdown and JSON docs are not security-scanned. Full rationale is in `security-policy.md`.

- `xss-html`: `dangerouslySetInnerHTML`, raw `innerHTML` or `outerHTML` assignment, `insertAdjacentHTML`.
- `dynamic-eval`: `eval(`, `new Function(`, `document.write(`.
- `mixed-content`: `http://` other than `localhost` or `127.0.0.1`.
- `hardcoded-secret`: a quoted value of 12 or more characters assigned to an identifier named like api key, secret, token, password, private key, or license key.
- `tabnabbing`: `target="_blank"` on a line that has no `noopener`.

Any match means FAIL. Report file, line, rule, snippet.

## Output format on failure

```
SANITY CHECK FAILED at Phase {n}
Rule violated: {rule name}
Hits:
  {file}:{line}: {snippet}
  {file}:{line}: {snippet}
Action: pipeline paused. Fix the files or ask for revise.
```

## Output format on pass

```
Sanity check passed for Phase {n}.
Files scanned: {count}
Rules checked: emoji, dash, gradient, security, scope{, schema}{, build}
```

## Escape hatches

There are two escape hatches. A single-line comment `// stealth-ok: {reason}` on the same line as a flagged token tells the gradient scanner to skip that line. A `// security-ok` comment on the same line skips the security scan for that line, and must carry a documented reason. Neither is for silencing a real finding. The emoji and dash scanners have no escape hatch. If something legitimately needs an em dash (a quoted source text, for example), it goes into a non-scanned file outside the project (out of scope).
