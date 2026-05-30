---
name: no-ai-slop
description: >
  Strip AI slop from UI and Next.js code output. Use when generated or
  reviewed React, Next.js, or TypeScript code contains redundant comments
  that restate the code, leftover TODO and placeholder stubs, debug remnants
  like console.log and debugger, bloated JSDoc, decorative banner comments,
  or lazy type escapes like as any and ts-ignore. Trigger when the user asks
  to clean up generated code, remove AI comments, deslop, or tidy UI output,
  and run automatically as a review pass in the DO-UI pipeline.
metadata:
  type: do-ui
  enforcement: scripts/no-ai-slop.mjs (advisory flagger, never deletes)
---

# no-ai-slop

AI-generated UI code reads like AI. The tell is not the logic, it is the noise around it: comments that narrate every line, placeholder stubs that were never filled, leftover `console.log`, JSDoc that restates the function name, banner comments made of equals signs, and `as any` sprinkled to make the types stop complaining.

This skill removes that noise. The goal is code that reads like a developer wrote it on purpose, not code that reads like it was dictated by a model.

It pairs with a flagger script: `scripts/no-ai-slop.mjs`. The script reports, it never edits. You decide what goes. The reason is simple and honest: a regex cannot reliably tell a useful comment from a redundant one, so automatic deletion would remove good comments too.

## The one rule for comments

Comments explain why, not what. The code already says what it does. A comment earns its place only when it adds something the code cannot: a reason, a constraint, a gotcha, a link to context.

Bad, restates the code:
```tsx
// Set the title
setTitle(value);

// Map over the items and render a row for each
{items.map((i) => <Row key={i.id} item={i} />)}

// This component renders the header
export function Header() { ... }
```

Good, explains intent or a non-obvious fact:
```tsx
// Title must update before the animation starts or the measure is stale.
setTitle(value);

// Server sends items unsorted. Sort by rank, not id.
{sorted.map((i) => <Row key={i.id} item={i} />)}
```

If you cannot write a why, delete the comment. The code is the what.

## What counts as slop

The flagger groups it into these rules.

### redundant-comment
A comment that narrates the next line. Openers like `// Render the`, `// Return the`, `// Initialize`, `// Handle the`, `// State for`, `// This component`, `// Import`. Delete it or rewrite it as a why.

### commented-code
A comment whose text is actually code (ends in a semicolon or brace, contains `=>`, `const`, `return`, or a JSX tag). Dead code in a comment rots. Delete it. Git remembers it.

### banner
Decorative dividers made of punctuation: `// =========`, `/* ------- */`, `// ##### Section #####`. They add visual weight, not meaning. Use a blank line and a real section name in a real symbol instead.

### placeholder
`// your code here`, `// implement me`, `// rest of the logic`, `// add more here`, `// coming soon`, empty stubs. Either implement it or remove it. Shipping a placeholder is shipping a bug.

### todo-left
`TODO`, `FIXME`, `XXX`, `HACK`. Sometimes legitimate. In freshly generated code they are almost always the model promising work it did not do. Resolve it, or turn it into a tracked issue with a link, or remove it.

### jsdoc-filler
JSDoc that says nothing: `@returns {void}` on an obvious void function, `@param {string} name` with no description, a `/** This function ... */` block on a one-liner. Keep JSDoc only where the types and name do not already tell the story.

### debug-console, debugger
`console.log`, `console.debug`, `console.info`, `debugger`. Leftover from development. Remove before shipping. Use a real logger behind a flag if you need runtime logging in production.

### ts-suppress, as-any
`@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` without a reason, and `as any`. These silence the type checker, which is the opposite of safety. Fix the type. If a suppression is truly needed, write the reason on the same line and keep it narrow.

## How to use it

Run the flagger on the code you just wrote or are reviewing:

```bash
node scripts/no-ai-slop.mjs ./app ./components
node scripts/no-ai-slop.mjs --json ./components   # machine-readable
node scripts/no-ai-slop.mjs --staged              # only git-staged files
```

It prints file, line, rule, and a snippet. Walk the list. For each hit, either delete or rewrite the line, or, if the line is correct on purpose, add a trailing `// slop-ok` comment so it stops being flagged. Do not add `// slop-ok` just to make the report green. That is slop about slop.

When writing new UI code in the first place, do not produce the slop at all. Write the why-comment or no comment, no placeholders, no leftover logs, no `as any`. Then the flagger has nothing to find.

## Honest limits

- It is line-based regex, not a parser. It will miss some slop and occasionally flag a fine line. Treat it as a checklist, not a judge.
- It does not detect unused imports or unreachable code. Use ESLint and `tsc --noUnusedLocals` for those. This skill does not replace a linter, it catches the human-readable noise a linter ignores.
- It cannot know your project conventions. If your team keeps TODOs with ticket links, add `// slop-ok` or filter the `todo-left` rule out of your run.

## Security note

Stripping slop never weakens security. If removing a comment or a log would hide a security-relevant fact, keep the fact and move it into the security review, do not just delete it. The DO-UI security policy still wins over tidiness.
