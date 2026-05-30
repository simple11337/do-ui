#!/usr/bin/env node
// Headless Lighthouse run against a URL. Fails if Performance score < threshold.
// Usage: node lighthouse.mjs --url https://localhost:3000 [--threshold 90] [--json]

function parseArgs(argv) {
  const opts = { url: null, threshold: 90, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') opts.url = argv[++i];
    else if (a === '--threshold') opts.threshold = parseInt(argv[++i], 10);
    else if (a === '--json') opts.json = true;
    else { console.error(`unknown flag: ${a}`); process.exit(2); }
  }
  if (!opts.url) { console.error('usage: lighthouse.mjs --url URL [--threshold 90] [--json]'); process.exit(2); }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  let lighthouse, chromeLauncher;
  try {
    lighthouse = (await import('lighthouse')).default;
    chromeLauncher = await import('chrome-launcher');
  } catch {
    console.error('lighthouse not installed. run: npm install lighthouse chrome-launcher');
    process.exit(2);
  }

  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
  try {
    const result = await lighthouse(opts.url, {
      port: chrome.port,
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']
    });
    const scores = Object.fromEntries(
      Object.entries(result.lhr.categories).map(([k, v]) => [k, Math.round((v.score || 0) * 100)])
    );
    const perf = scores.performance;
    const passed = perf >= opts.threshold;

    if (opts.json) {
      process.stdout.write(JSON.stringify({ url: opts.url, scores, threshold: opts.threshold, passed }, null, 2) + '\n');
    } else {
      for (const [k, v] of Object.entries(scores)) console.log(`  ${k.padEnd(20)} ${v}`);
      console.log('');
      console.log(passed
        ? `lighthouse: performance ${perf} >= ${opts.threshold}. pass.`
        : `lighthouse: performance ${perf} < ${opts.threshold}. FAIL.`);
    }
    process.exit(passed ? 0 : 1);
  } finally {
    await chrome.kill();
  }
}

main().catch(e => { console.error(e.message || e); process.exit(2); });
