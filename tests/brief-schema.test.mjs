// Guard tests for the brief schema change: the new required `visual` object
// and the reference-website fields.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schemaPath = fileURLToPath(new URL('../do-ui/schemas/brief.schema.json', import.meta.url));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const validBrief = {
  brand: 'Acme',
  tone: 'minimal',
  audience: 'developers',
  headline: 'Build faster',
  subheadline: 'Ship animated sites',
  features: [
    { title: 'a', body: 'one' },
    { title: 'b', body: 'two' },
    { title: 'c', body: 'three' },
  ],
  cta: { label: 'Start', href: '/start' },
  footer: 'copyright',
  palette: ['#111111', '#eeeeee'],
  fonts: [{ family: 'Inter', role: 'body' }],
  visual: { base: 'dark', surface: 'borderless', bwLayoutPass: false },
  stack: { framework: 'next', language: 'ts', styling: 'tailwind' },
  deployTarget: 'vercel',
};

test('brief schema: a complete brief with visual validates', () => {
  assert.equal(validate(validBrief), true, JSON.stringify(validate.errors));
});

test('brief schema: a brief missing visual is rejected', () => {
  const { visual, ...withoutVisual } = validBrief;
  assert.equal(validate(withoutVisual), false);
});

test('brief schema: references accepts site, siteMode, and siteShot', () => {
  const withSite = {
    ...validBrief,
    references: { site: 'https://example.com', siteMode: 'screenshot', siteShot: './assets/refs/reference.png' },
  };
  assert.equal(validate(withSite), true, JSON.stringify(validate.errors));
});

test('brief schema: an out-of-enum visual.surface is rejected', () => {
  const bad = { ...validBrief, visual: { base: 'dark', surface: 'glassy', bwLayoutPass: false } };
  assert.equal(validate(bad), false);
});
