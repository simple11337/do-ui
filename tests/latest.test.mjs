// Unit tests for the latest version gate (scripts/latest.mjs).
// findStale() is the pure seam: it turns parsed `npm outdated --json` into a
// list of dependencies that are not at their newest published version.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findStale } from '../scripts/latest.mjs';

test('findStale: no outdated data means nothing stale', () => {
  assert.deepEqual(findStale({}), []);
});

test('findStale: a dep behind latest is stale', () => {
  const out = { three: { current: '0.180.0', wanted: '0.182.0', latest: '0.182.0' } };
  assert.deepEqual(findStale(out), [{ name: 'three', current: '0.180.0', latest: '0.182.0' }]);
});

test('findStale: a dep already at latest is not stale', () => {
  const out = { motion: { current: '11.0.0', wanted: '11.0.0', latest: '11.0.0' } };
  assert.deepEqual(findStale(out), []);
});

test('findStale: a not-installed dep counts as stale', () => {
  const out = { gsap: { latest: '3.12.0' } };
  assert.deepEqual(findStale(out), [{ name: 'gsap', current: null, latest: '3.12.0' }]);
});

test('findStale: results are sorted by name and respect the allow list', () => {
  const out = {
    three: { current: '1.0.0', latest: '2.0.0' },
    axios: { current: '1.0.0', latest: '2.0.0' },
    motion: { current: '2.0.0', latest: '2.0.0' },
  };
  assert.deepEqual(findStale(out, ['axios']), [
    { name: 'three', current: '1.0.0', latest: '2.0.0' },
  ]);
});
