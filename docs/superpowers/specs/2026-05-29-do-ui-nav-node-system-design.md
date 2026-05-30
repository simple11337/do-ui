# do-ui navigation node system (nav)

Date: 2026-05-29
Status: approved, in implementation

## Problem

When scaffolding a site, Claude scans the 928-line `reeactbits` skill or guesses block slugs (hero-1 through hero-13). React Bits blocks have no per-item index, Framer Motion has no catalog at all, and there is no single manifest mapping "I need X" to the exact install command. That guessing and doc-scanning wastes tokens and produces wrong slugs.

## Goal

A graph catalog of every callable thing (components, page blocks, motion recipes, design patterns, helper scripts) stored on disk and queried through a tiny CLI, so only the node actually needed enters context. Plus a deterministic gate that forces newest-at-install packages with lockfile pinning.

## Non-goals

- No symbolic or cipher "language" to save tokens. It does not work that way; tokens are counted on the literal text. The legitimate version is a terse, consistent plain-text schema with short stable IDs.
- `nav.mjs` never executes install commands and never touches the network.
- The catalog does not store live version numbers. `latest.mjs` is the live version authority.

## Token efficiency levers (the real ones)

1. Catalog lives on disk and is resolved per query, so the full catalog never enters context.
2. A small, stable entry index in `context-pack.md` keeps prompt caching warm.
3. A terse, consistent node schema with short stable IDs is genuinely fewer tokens than prose.

## Files

| Piece | Path | Role |
|---|---|---|
| Catalog data | `do-ui/nav/nodes.json` | Source of truth. Never loaded into context. |
| Schema | `do-ui/schemas/nodes.schema.json` | Validates the catalog via the existing ajv flow. |
| Resolver CLI | `scripts/nav.mjs` | The function Claude calls. Read-only, no network, never executes commands. |
| Version gate | `scripts/latest.mjs` | Forces newest packages. Hard gate using the npm toolchain. |
| Tests | `tests/nav.test.mjs`, `tests/latest.test.mjs` | node:test, no new deps. |
| Entry index | append to `do-ui/context-pack.md` | Stable node map: namespaces, command grammar, entry IDs. |
| Wiring | `reeactbits` SKILL.md, `agents/do-ui-orchestrator.md`, `commands/makeui.md`, `package.json`, `scripts/doctor.mjs` | Tell Claude to use `nav` and run the gates. |

Location decision: the script and data live in this git-tracked plugin repo (next to the other 12 scripts). The global `reeactbits` skill gets a pointer to it.

## Node ID grammar

Short, namespaced, stable, plain text. No cipher.

```
rb.cmp.<slug>      React Bits Pro component (starter tier)
rb.<category>.<n>  React Bits Pro page block (hero, pricing, nav, ...)
mui.<slug>         Magic UI component
fm.<slug>          Framer Motion recipe
dz.<slug>          design / style pattern
fn.<slug>          do-ui helper script
```

## Node schema

```json
{
  "id": "rb.hero.7",
  "kind": "block",
  "reg": "@reactbits-pro",
  "tier": "pro",
  "label": "hero, variant 7",
  "cmd": "npx shadcn@latest add @reactbits-pro/hero-7-tw",
  "deps": ["three", "motion"],
  "tags": ["hero", "landing", "above-fold"],
  "edges": { "requires": [], "pairs": ["rb.nav.3"], "alt": ["rb.hero.1", "rb.hero.2"] },
  "note": "variant detail not documented in source"
}
```

`kind` is one of component, block, recipe, design, fn. `tier` is one of starter, pro, free, builtin, na.

## CLI (scripts/nav.mjs)

```
node scripts/nav.mjs find "hero 3d" [--kind block --tier pro --dep three]
node scripts/nav.mjs get rb.hero.7 [more ids...]
node scripts/nav.mjs list rb.hero | list fm
node scripts/nav.mjs related rb.hero.7
node scripts/nav.mjs plan rb.hero.7 rb.nav.3
```

Deterministic output, stable ordering, exit codes 0 found / 1 not found / 2 bad usage. A miss on `get` prints `not found` plus nearest `find` suggestions.

## Version policy (forced newest, then pinned)

- Node `cmd` fields and install steps never hardcode an old version; they resolve newest at scaffold time.
- `scripts/latest.mjs` runs `npm outdated --json` in the target project and asserts every dependency equals its latest published version. It exits nonzero (hard gate) when any dep is stale. The comparison is a pure, unit-tested function `findStale()`.
- The lockfile pins the resolved newest version, so builds stay reproducible and supply-chain-safe.
- This intentionally overrides the `security-policy.md` soft rule "pin deps" toward "newest, then pin". Reproducibility is preserved by the lockfile, not by floating ranges.

## Safety and error handling

`nav.mjs` is read-only, no network, never runs installs. The catalog is schema-validated (`validate:nodes`). Validation also detects duplicate IDs and dangling or cyclic edges. No new network surface is added; `latest.mjs` only shells out to the npm toolchain.

## Testing

`tests/nav.test.mjs` (node:test): find hit, miss, multi-term, filters; get hit, miss-with-suggestions, multi-id; list; related edge resolution and dangling-edge handling; plan dependency union; determinism (same query, identical output); empty catalog; unknown id and kind; duplicate id; self-edge and cyclic pairs (no infinite loop). `tests/latest.test.mjs`: `findStale()` pure logic. `package.json` gains `"test": "node --test"`.

## Wiring

`context-pack.md` gets the stable node map. The `reeactbits` SKILL.md gets a Navigation section pointing at `nav.mjs` as the entry point (the existing tables stay as human-readable reference and seed the catalog). The orchestrator instructs use of `nav` during component and block selection and runs `validate:nodes` and the `latest.mjs` gate. `makeui.md` gains one preamble line. `package.json` gains `nav`, `validate:nodes`, `latest`, and `test` scripts. `doctor.mjs` runs `validate:nodes`.

## Catalog population

272 nodes: 101 React Bits components, 101 React Bits blocks, 33 Magic UI components, 12 Framer Motion recipes, 11 design patterns, 14 helper scripts (the last two include the new `fn.nav` and `fn.latest`).

Source of truth was the real `reeactbits` SKILL.md tables. The `build-nav-catalog` workflow reliably extracted the motion recipes, design patterns, and helper scripts, but its extractors returned empty for the React Bits and Magic UI tables and its verify agent wrongly reported those tables as absent. A grep confirmed the tables exist (components at SKILL.md line 210, blocks at 339), so those three groups were transcribed directly from the file rather than trusted from the workflow. Slugs and install commands are verbatim; block variants are enumerated from the real per-category counts (for example hero-1 through hero-13). Block install commands take no suffix; component commands take `-tw`.

Edges: the eight canonical landing-page blocks (navigation-1, hero-1, features-1, social-proof-1, pricing-1, faq-1, cta-1, footer-1) are linked as `pairs` so `related` returns a full page from any section. Other nodes use `list` to find siblings.
