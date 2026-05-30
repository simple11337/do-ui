# DO-UI Context Pack

A stable, compact reference DO-UI loads at the start of a session. It exists so a fresh chat does not re-fetch the full component catalogs and motion docs. Keep this file stable. Prompt caching saves tokens only when the prefix does not change, so edit it rarely and in one block, not line by line across sessions.

Honest note on token cost: this file saves tokens because it is short and reused, not because of any special encoding. There is no emoji or non-Latin trick that lowers token count here. Shorter and stable is the whole mechanism.

## What DO-UI can pull from

Two registries plus hand-built Framer Motion. Full detail lives in the `reeactbits` skill. This is the index.

### React Bits Pro (paid, shadcn registry, auth via license key)
- Components registry `@reactbits-starter`, 100 animated components, any paid tier.
- Blocks registry `@reactbits-pro`, 158+ page sections, Pro or Ultimate tier.
- Install components with a `-tw` (Tailwind) or `-css` suffix. Install blocks with no suffix.
- Needs `REACTBITS_LICENSE_KEY` in `.env.local` and a `registries` block in `components.json`.
- Files land in `components/react-bits/` and `components/blocks/`.

```bash
npx shadcn@latest add @reactbits-starter/silk-waves-tw
npx shadcn@latest add @reactbits-pro/hero-1
```

### Magic UI (free, MIT, public shadcn registry, no key)
- Install by URL or via a `@magicui` prefix. No auth.
- Files land in `components/magicui/`.
- Best default when budget or licensing matters. Overlaps React Bits, so pick one source per effect.

```bash
npx shadcn@latest add "https://magicui.design/r/marquee.json"
```

High-value slugs: `number-ticker`, `marquee`, `bento-grid`, `animated-beam`, `animated-list`, `dock`, `terminal`, `orbiting-circles`, `text-animate`, `shimmer-button`, `particles`, `meteors`, `retro-grid`, `iphone-15-pro`, `safari`.

### Framer Motion (motion package), hand-built
- `npm install motion`, import from `motion/react`, files need `"use client"`.
- Animate `transform` and `opacity` only in hot paths. Avoid width, height, top, left, margin.
- Variants plus `staggerChildren` for lists. `whileInView` with `viewport={{ once: true }}` for scroll reveals.
- `useScroll` plus `useTransform` for parallax, cheap because it skips React render.
- `AnimatePresence` for exit animations, `layout` and `layoutId` for position morphs.
- Always honor `useReducedMotion`. Drop large translations and autoplay when it is on.

## Navigation (nav node system)

Do not scan the full catalogs or guess block slugs. Resolve nodes on disk with the nav resolver. Only the node you ask for enters context, so this stays cheap as the catalog grows.

ID grammar: `rb.cmp.<slug>` React Bits component, `rb.<category>.<n>` React Bits block, `mui.<slug>` Magic UI, `fm.<slug>` Framer Motion recipe, `dz.<slug>` design pattern, `fn.<slug>` helper script.

Commands (run from the plugin root):
- `node scripts/nav.mjs find "<intent>" [--kind block --tier pro --dep three]` candidate ids
- `node scripts/nav.mjs get <id> [<id>...]` exact install command, deps, edges
- `node scripts/nav.mjs list <prefix>` ids in a namespace, e.g. `list rb.hero`
- `node scripts/nav.mjs related <id>` linked nodes (pairs, alt, requires)
- `node scripts/nav.mjs plan <id>...` merged install order and deduped deps

Catalog `do-ui/nav/nodes.json` holds 273 nodes. Validate with `npm run validate:nodes`.

Version policy (forced newest, then pinned): install commands resolve newest at scaffold time, never a hardcoded old version. Run `node scripts/latest.mjs` as a hard gate before shipping; it fails when any dependency is behind its newest published version. Pin the resolved version in the lockfile so builds stay reproducible.

## Style bans (enforced by scripts/sanity-check.mjs)

- No emojis anywhere.
- No em dash or en dash. Use hyphen, comma, colon, or a new sentence.
- No CSS gradients (linear, radial, conic) and no Tailwind gradient utilities. Use flat color.
- Prose: short sentences, no filler words like comprehensive, robust, seamlessly, leverage, utilize, delve.

## Security policy (top priority, beats visual polish)

Hard rules, enforced for code files by the sanity check:
- No `dangerouslySetInnerHTML` on unsanitized input, no raw `innerHTML` assignment.
- No `eval`, no `new Function`, no `document.write`.
- No secrets in client components. Keys live in `.env.local` and server code only.
- `target="_blank"` requires `rel="noopener noreferrer"`.
- No plain `http://` asset or fetch URLs (localhost excepted).

Soft: pin animation deps, keep shader source local, set a CSP without `unsafe-eval`, read installed component source before shipping.

## Pipeline pointers

- Intake and build flow: `do-ui/pipeline.md`.
- Prompt injection rules for fetched assets: `do-ui/injection-guard.md`.
- Full style rules: `do-ui/style-rules.md`. Security detail: `do-ui/security-policy.md`.
- Run the gate before claiming done: `node scripts/sanity-check.mjs <path>`.
- Clean AI slop from generated code (advisory): `node scripts/no-ai-slop.mjs <path>`. See the `no-ai-slop` skill. Comments explain why, not what. No placeholders, leftover logs, banners, or `as any`.
