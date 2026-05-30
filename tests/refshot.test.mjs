// Unit tests for the reference-site screenshot helper (scripts/refshot.mjs).
// validateUrl() is the pure seam: it gates which URLs the headless browser
// will load, before any browser is launched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateUrl } from '../scripts/refshot.mjs';

test('validateUrl: https is accepted', () => {
  assert.deepEqual(validateUrl('https://example.com'), { ok: true, url: 'https://example.com/' });
});

test('validateUrl: http is accepted', () => {
  assert.equal(validateUrl('http://example.com/path').ok, true); // security-ok asserts the validator accepts a plain http url
});

test('validateUrl: a non-http protocol is rejected', () => {
  assert.equal(validateUrl('ftp://example.com').ok, false);
});

test('validateUrl: a javascript: url is rejected', () => {
  assert.equal(validateUrl('javascript:alert(1)').ok, false);
});

test('validateUrl: garbage is rejected', () => {
  assert.equal(validateUrl('not a url').ok, false);
});

test('validateUrl: empty and non-string inputs are rejected', () => {
  assert.equal(validateUrl('').ok, false);
  assert.equal(validateUrl(undefined).ok, false);
  assert.equal(validateUrl(42).ok, false);
});
