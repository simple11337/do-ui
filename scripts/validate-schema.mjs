#!/usr/bin/env node
// Validate a JSON file against a JSON schema using AJV.
// Usage: node validate-schema.mjs --schema path --data path [--json]

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

function parseArgs(argv) {
  const opts = { schema: null, data: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--schema') opts.schema = argv[++i];
    else if (a === '--data') opts.data = argv[++i];
    else if (a === '--json') opts.json = true;
    else { console.error(`unknown flag: ${a}`); process.exit(2); }
  }
  if (!opts.schema || !opts.data) {
    console.error('usage: validate-schema.mjs --schema path --data path [--json]');
    process.exit(2);
  }
  return opts;
}

async function readJson(p) {
  const text = await readFile(resolve(p), 'utf8');
  return JSON.parse(text);
}

async function main() {
  const { schema: schemaPath, data: dataPath, json } = parseArgs(process.argv.slice(2));
  const schema = await readJson(schemaPath);
  const data = await readJson(dataPath);

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const ok = validate(data);

  if (json) {
    process.stdout.write(JSON.stringify({
      schema: schemaPath,
      data: dataPath,
      valid: ok,
      errors: validate.errors || []
    }, null, 2) + '\n');
  } else {
    if (ok) {
      console.log(`valid: ${dataPath} matches ${schemaPath}`);
    } else {
      console.error(`INVALID: ${dataPath} fails ${schemaPath}`);
      for (const e of validate.errors) {
        console.error(`  ${e.instancePath || '/'}: ${e.message} (${e.keyword})`);
      }
    }
  }
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error(e.message || e); process.exit(2); });
