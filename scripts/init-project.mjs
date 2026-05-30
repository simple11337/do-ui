#!/usr/bin/env node
// Bootstrap an empty Next.js + Tailwind project skeleton in the current directory.
// Creates folders and minimal stub files only. Does not run npm install.
// Usage: node init-project.mjs [--force]

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIRS = [
  'app',
  'components',
  'components/motion',
  'styles',
  'assets',
  'assets/models',
  'assets/video',
  'assets/images',
  'assets/fonts',
  'do-ui',
  'public'
];

const FILES = {
  'app/layout.tsx': `import './globals.css';

export const metadata = { title: 'DO-UI scaffold', description: 'Replace me from brief.json' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
  'app/page.tsx': `export default function Page() {
  return <main><h1>DO-UI scaffold</h1></main>;
}
`,
  'app/globals.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-bg: #ffffff;
  --color-fg: #111111;
  --color-accent: #1a1a1a;
}

body { background: var(--color-bg); color: var(--color-fg); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`,
  'styles/tokens.css': `:root {
  --color-bg: #ffffff;
  --color-fg: #111111;
  --color-accent: #1a1a1a;
  --color-muted: #6b6b6b;
  --font-display: 'Inter', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
}
`,
  'tailwind.config.ts': `import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: []
};
export default config;
`,
  'postcss.config.mjs': `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
`,
  'next.config.mjs': `const nextConfig = { reactStrictMode: true };
export default nextConfig;
`,
  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "paths": { "@/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`,
  'do-ui/brief.json': `{}
`,
  'assets/manifest.json': `[]
`
};

function main() {
  const force = process.argv.includes('--force');
  const cwd = resolve(process.cwd());

  for (const d of DIRS) {
    const p = join(cwd, d);
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  }

  let written = 0, skipped = 0;
  for (const [path, body] of Object.entries(FILES)) {
    const p = join(cwd, path);
    if (existsSync(p) && !force) { skipped++; continue; }
    writeFileSync(p, body, 'utf8');
    written++;
  }
  console.log(`init-project: wrote=${written} skipped=${skipped}`);
  console.log(`next steps:`);
  console.log(`  npm install next react react-dom typescript tailwindcss autoprefixer postcss`);
  console.log(`  npm install -D @types/react @types/node`);
  console.log(`  run /makeui to fill the brief`);
}

main();
