# DO-UI Style Rules

These rules apply to every file DO-UI writes. Code, comments, JSON, markdown, all of it. The sanity check enforces them after every phase.

## Hard bans

### 1. No emojis

Zero. None. Not in comments. Not in commit messages. Not in JSON string values. Not in markdown headings.

Blocked code point ranges:
- U+1F300 to U+1FAFF (most emoji)
- U+2600 to U+27BF (misc symbols, dingbats)
- U+2300 to U+23FF (misc technical, includes some emoji)
- U+2B00 to U+2BFF (arrows and shapes used as emoji)
- U+1F000 to U+1F02F (mahjong, dominoes)
- U+1F0A0 to U+1F0FF (playing cards)
- Variation selector U+FE0F when adjacent to any of the above

### 2. No em dash, no en dash

- U+2014 EM DASH. Banned.
- U+2013 EN DASH. Banned.

Use the hyphen-minus U+002D, a period, a comma, a colon, or rewrite the sentence. If you want emphasis, use a period and start a new sentence.

### 3. No CSS gradients

Banned tokens (case-insensitive):
- `linear-gradient(`
- `radial-gradient(`
- `conic-gradient(`
- `repeating-linear-gradient(`
- `repeating-radial-gradient(`
- `repeating-conic-gradient(`

Banned Tailwind utilities:
- `bg-gradient-to-*`
- `from-*`, `via-*`, `to-*` when used as gradient color stops

Use flat colors. If depth is needed, use a single solid color plus a separate element with opacity, or a noise texture loaded as an image.

## Soft style guidance (not enforced, but preferred)

- Do not default to a white background with bordered cards. Apply the brief's `visual` direction: `base` (light, dark, colored) sets the background, `surface` (bordered, borderless, elevated) decides card treatment.
- Variable colors live in CSS custom properties under `:root` and a `[data-theme="dark"]` selector if dark mode is requested.
- Prefer `clamp()` for fluid typography over named breakpoints.
- Use logical properties (`margin-inline`, `padding-block`) where supported.
- Keep className lists short. If a Tailwind list passes 8 utilities on one element, extract a component class.

## Output style for prose (README, comments)

- Short sentences. Vary length. One idea per sentence when the idea is complex.
- Contractions are fine.
- No "comprehensive", "robust", "seamlessly", "leverage" as a verb, "utilize", "delve", "groundbreaking".
- No "In today's world", "It is important to note", "In conclusion".
- Start sentences with And, But, or So when it reads better.
