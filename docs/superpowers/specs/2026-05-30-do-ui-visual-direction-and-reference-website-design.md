# do-ui visual direction and reference website

Date: 2026-05-30
Status: approved, implemented

## Problem

The skill forced a fixed visual baseline and a screenshot reference, and never asked for a reference website. Concretely:

- The question round (orchestrator Q2) required a screenshot plus a stripped black-and-white copy.
- Pipeline Phase 2 forced building the layout from that black-and-white reference ("No color, no images, no motion yet"), so output tended toward a plain white, bordered baseline.
- No question or schema field existed for a reference website used as orientation.

## Goal

Stop defaulting to border/white. Ask the user for a visual direction and an optional reference website, and make the black-and-white layout pass optional.

## Changes

### Question round (orchestrator, 8 to 9 questions)

- Q2 "Reference material" (revised): no screenshot requirement. The user can give a color screenshot, a reference website URL, a text description, or nothing. If a URL is given, ask a per-build sub-choice stored as `references.siteMode`: `url-only` or `screenshot`. The B&W copy is optional, offered only when the user picks the B&W pass in Q3.
- Q3 "Visual direction" (new): three picks stored under `visual` - `base` (light, dark, colored), `surface` (bordered, borderless, elevated), `bwLayoutPass` (boolean).
- Q4 to Q9 unchanged (palette, fonts, 3D/video, animation, stack, deploy). Headers and the summary now read `/9`.
- After confirm: if `siteMode` is `screenshot`, the orchestrator delegates to the asset-fetcher to capture the site before Phase 2, then records `references.siteShot`.

### Schema (brief.schema.json)

- New required `visual` object: `base`, `surface`, `bwLayoutPass`.
- `references` gains `site` (URL), `siteMode` (`url-only` | `screenshot`), `siteShot` (path). Screenshot and screenshotBW remain optional.

### Pipeline

- Phase 2 "Layout": the black-and-white step is conditional on `visual.bwLayoutPass`. If off, build the styled layout directly from the brief plus whatever reference exists. Do not default to white background with bordered cards.
- Phase 3 "Style": apply `visual.base` and `visual.surface` explicitly. A quality check verifies the background and surfaces match the chosen direction.

### Style rules

One soft-guidance line: do not default to white-bg + borders; apply the brief's `visual` direction.

### Reference-site screenshot (new script)

`scripts/refshot.mjs`: given an http or https URL, launch headless Chrome via `chrome-launcher` (existing optional dep) and save a PNG under `./assets/refs/`. The page renders in an isolated browser; only the PNG is kept and it is inert data per the injection guard. If Chrome is unavailable it exits 3 and the flow falls back to url-only. The pure `validateUrl` seam (http/https only, reject everything else) is unit-tested. The asset-fetcher owns this fetch and runs the script; it stays within its `./assets/` write scope. Indexed as the `fn.refshot` node.

## Non-goals

- Full-page screenshots (viewport capture is enough for orientation).
- Any change to the nav node system beyond adding the `fn.refshot` node.

## Testing

- `tests/refshot.test.mjs`: `validateUrl` accepts http/https, rejects other protocols, javascript: urls, garbage, empty, and non-strings.
- `tests/brief-schema.test.mjs`: a complete brief with `visual` validates; a brief missing `visual` is rejected.
- The screenshot capture itself is integration (needs Chrome) and is not unit-tested.
