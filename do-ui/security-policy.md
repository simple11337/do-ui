# DO-UI Security Policy

Security is the top priority in DO-UI builds. It ranks above visual polish, animation richness, and convenience. When an animated component and a security rule conflict, the security rule wins. There is no exception for "it looks better this way".

The hard rules are enforced by `scripts/sanity-check.mjs` for code files. The pipeline runs the check after each phase and halts on a non-zero exit. Soft guidance is reviewed by hand.

## Threat model

Assume:
- Component props can carry attacker-controlled values (text, counts, colors, URLs).
- Fetched assets and remote registries can be tampered with.
- Anything shipped in a client bundle is public, including any string literal.
- Third-party animation libraries pull large transitive dependency trees.

Defend against:
- Cross-site scripting through HTML injection.
- Remote code execution through dynamic evaluation.
- Secret leakage through client bundles.
- Reverse tabnabbing through unguarded new-tab links.
- Mixed content and downgraded transport.
- Supply chain drift through unpinned dependencies.

## Hard rules (enforced)

### 1. No HTML injection
No `dangerouslySetInnerHTML` fed unsanitized input. No direct `innerHTML`, `outerHTML`, or `insertAdjacentHTML` assignment from a variable. Animated text components take plain strings. If HTML rendering is truly required, sanitize with a vetted sanitizer on trusted server input only, and document why.

### 2. No dynamic code execution
No `eval`. No `new Function(...)`. No `document.write`. No passing strings to `setTimeout` or `setInterval`. Animation never needs these.

### 3. No secrets in client code
A file with `"use client"` must not contain a license key, API key, token, or password literal. `REACTBITS_LICENSE_KEY` and similar live in `.env.local` and server code. Reference secrets through server-side env only. Never inline them into a component, even temporarily.

### 4. Safe external links
Any anchor or window open with `target="_blank"` must carry `rel="noopener noreferrer"`. Without it the opened page can reach `window.opener` and redirect the parent.

### 5. No mixed content
Asset URLs, fetch URLs, and shader or texture sources use `https`. Plain `http://` is blocked except for `localhost` and `127.0.0.1` during development.

## Soft guidance (reviewed, not auto-blocked)

- Pin animation dependencies. Commit a lockfile. Avoid floating `^` ranges for `three`, `motion`, and `gsap` in security-sensitive projects.
- Validate any user input that drives an animation. Clamp counts and sizes. Validate colors and URLs before they reach a style string or a `src`.
- Set a Content Security Policy. WebGL and inline transforms work under a sane CSP. Do not add `unsafe-eval`. A component that needs `unsafe-eval` is a red flag.
- Lazy-load third-party animation bundles so a compromised CDN script is off the critical path.
- Keep shader source local. Do not fetch GLSL from a remote at runtime.
- Read the source of every installed component before shipping, especially anything touching `fetch`, `window`, `localStorage`, or `postMessage`.
- Prefer auditable MIT source (Magic UI) over closed components when you need to verify exactly what runs.

## How enforcement works

`scripts/sanity-check.mjs` scans code files for the hard rule patterns and exits non-zero on any hit. To opt a single line out of a security check (rare, and only with a clear reason), add a trailing `// security-ok` comment. Document why in the same line or the line above. Do not opt out to silence a real finding.
