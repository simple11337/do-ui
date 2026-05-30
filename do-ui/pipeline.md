# TEXTURA Pipeline

Seven phases. Each phase has a goal, required inputs, produced outputs, quality checks, and the reference tools that fit it. The orchestrator runs them in order, sanity-checks after each, and asks the user to continue, pause, or revise.

Animation defaults baked into every phase that touches motion:
- Scroll-driven: GSAP + ScrollTrigger
- Load-in and physics: React Spring
- Component state (hover, tap, drag): Framer Motion
- Every animation respects `prefers-reduced-motion: reduce`

Style defaults:
- No gradients. Flat colors only.
- No emojis in source.
- No em or en dashes in source.

---

## Phase 1. Brief

**Goal.** Turn the question-round answers into a single validated brief file.

**Inputs.** Q1 to Q8 answers.

**Outputs.**
- `./do-ui/brief.json` (validated against `brief.schema.json`)
- `./do-ui/content.json` (extracted copy: headline, subheadline, features[3], cta, footer)

**Reference tools.** Perplexity, Claude.ai for copy polish.

**Quality checks.** Schema valid. Required fields present. Tone field is one of the allowed buckets.

---

## Phase 2. Layout

**Goal.** Recreate the structural layout. Components only. No images, no motion yet. The black and white step is conditional on `visual.bwLayoutPass`. If true, build the structure in grayscale first with no color, then add color in Phase 3. If false, build the styled layout directly using the visual direction and whatever reference exists. Do not default to a white background with bordered cards.

**Inputs.** Brief, including `visual`. Whichever reference exists, in order of preference: stripped B&W image (only when `bwLayoutPass` is true), color screenshot, reference site screenshot (`references.siteShot`), or the text description. If none, work from the brief alone.

**Outputs.**
- `./app/page.tsx`
- `./app/layout.tsx`
- `./components/Section.tsx`, `./components/Container.tsx`, plus one component per distinct region detected in the reference (Hero, Features, CTA, Footer, etc.)

**Reference tools.** Dribbble, Behance, Awwwards (for structural ideas only, never copied verbatim).

**Quality checks.**
- Component tree mirrors the regions in the reference, or the sections implied by the brief when there is no reference
- Semantic HTML (header, main, section, footer)
- All headings in correct order (h1 once, h2 for sections)
- Layout works at 360px, 768px, 1280px, 1920px

---

## Phase 3. Style

**Goal.** Apply palette, fonts, and the chosen visual direction. Still no images or motion.

**Inputs.** Palette hex codes. Font names. `visual.base` (light, dark, colored) and `visual.surface` (bordered, borderless, elevated).

**Outputs.**
- `./styles/tokens.css` with CSS custom properties: `--color-bg`, `--color-fg`, `--color-accent`, `--color-muted`, `--font-display`, `--font-body`, spacing scale, radius scale.
- `./app/layout.tsx` updated with `next/font` loaders.
- `./tailwind.config.ts` extended with token references.

**Reference tools.** Google Fonts, Coolors (as data inputs).

**Quality checks.**
- AA contrast 4.5:1 on body text against background
- No raw hex colors in components, only token references
- No gradients (sanity check enforces)
- Font fallback chain present
- Background follows `visual.base` and surfaces follow `visual.surface`. No unrequested white background or default card borders.

---

## Phase 4. Assets

**Goal.** Pull 3D models, videos, images, and fonts. Save under `./assets/`. Wire them into components.

**Inputs.** URLs gathered in Q5.

**Outputs.**
- Files under `./assets/models/`, `./assets/video/`, `./assets/images/`, `./assets/fonts/`
- `./assets/manifest.json` (validated against `assets.schema.json`)
- Components updated to reference local asset paths

**Delegation.** Every URL fetch goes through the `do-ui-asset-fetcher` subagent via the Task tool. The orchestrator never calls WebFetch.

**Reference tools.** Sketchfab, OpenArt, Kling 3.0, Pinterest (as URL data sources).

**Quality checks.**
- Manifest schema valid
- Every asset path referenced in code exists on disk
- 3D models load with `<model-viewer>` or react-three-fiber stub
- Videos have both MP4 and WebM where possible

---

## Phase 5. Animations

**Goal.** Add motion per references. Scroll, load-in, hover.

**Inputs.** Pinterest/Dribbble animation references from Q6.

**Outputs.**
- `./components/motion/*.tsx` (named, reusable wrappers: `FadeUp`, `Parallax`, `ScrollPin`, `Magnetic`)
- Page components wrapped with motion primitives
- `./styles/motion.css` for any pure-CSS keyframes

**Reference tools.** GSAP docs, React Spring docs, Framer Motion docs.

**Quality checks.**
- `@media (prefers-reduced-motion: reduce)` block disables all non-essential motion
- No animation runs longer than 1200ms unless it is a passive loop
- Initial state is the final state with `opacity-0` removed (no FOUC)
- No layout shift from animations (transform/opacity only)

---

## Phase 6. Optimize

**Goal.** Make it fast. Make it accessible.

**Inputs.** Built site as-is.

**Outputs.** Optimized assets and config tweaks. No new components.

**Reference tools.** Squoosh (manual), `sharp` CLI, `ffmpeg`.

**Checklist.**
- PNG and JPG converted to WebP at quality 80, originals removed unless used as a fallback
- Video loops re-encoded to MP4 + WebM at 2 MB or less
- All images have explicit `width` and `height` attributes
- Above-the-fold images use `priority` on `next/image`
- Fonts preloaded with `<link rel="preload" as="font" crossorigin>`
- `loading="lazy"` on below-fold images
- Lighthouse Performance target: 90 or higher

---

## Phase 7. Deploy

**Goal.** Produce a deployable build for the target chosen in Q8.

**Inputs.** Deploy target.

**Outputs.**
- `./vercel.json` if Vercel
- `./netlify.toml` if Netlify
- `./next.config.mjs` with `output: 'export'` if static
- `./README.md` updated with build and deploy commands
- Git ignore confirmed (`./assets/` may or may not ship; default is yes, override on request)

**Reference tools.** Vercel docs, Netlify docs, Hostinger docs.

**Quality checks.**
- `pnpm build` (or `npm run build`) exits 0
- Output size summary printed
- No secret keys or env values committed
- Deploy command documented in README

---

## Notes for the orchestrator

After each phase, print:
```
Phase {n} {name} complete.
Files written: {list}
Sanity check: {pass | fail}
Continue? (continue / pause / revise)
```

If the user says `revise`, ask which file or which decision, then re-run only the affected step. Do not redo earlier phases unless the brief itself changes.
