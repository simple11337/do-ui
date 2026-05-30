// Unit tests for the nav resolver engine (scripts/nav.mjs).
// Pure functions over a node array, plus catalog loading and schema validity.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import {
  loadCatalog,
  findNodes,
  getNodes,
  listNodes,
  relatedNodes,
  planNodes,
  checkCatalog,
} from '../scripts/nav.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/nodes.sample.json', import.meta.url));
const schemaPath = fileURLToPath(new URL('../do-ui/schemas/nodes.schema.json', import.meta.url));

const catalog = JSON.parse(await readFile(fixturePath, 'utf8'));
const NODES = catalog.nodes;
const ids = (arr) => arr.map((n) => n.id);

test('findNodes: a single term matches the id', () => {
  assert.deepEqual(ids(findNodes(NODES, 'hero')), ['rb.hero.1', 'rb.hero.2']);
});

test('findNodes: a term matches a tag', () => {
  assert.deepEqual(ids(findNodes(NODES, '3d')), ['rb.hero.2']);
});

test('findNodes: multiple terms are ANDed', () => {
  assert.deepEqual(ids(findNodes(NODES, 'hero 3d')), ['rb.hero.2']);
});

test('findNodes: kind filter with empty query returns sorted matches', () => {
  assert.deepEqual(ids(findNodes(NODES, '', { kind: 'component' })), [
    'mui.number-ticker',
    'rb.cmp.silk-waves',
  ]);
});

test('findNodes: dep filter selects nodes carrying that dependency', () => {
  assert.deepEqual(ids(findNodes(NODES, '', { dep: 'three' })), [
    'rb.cmp.silk-waves',
    'rb.hero.2',
  ]);
});

test('findNodes: empty query and no filters returns nothing', () => {
  assert.deepEqual(findNodes(NODES, ''), []);
});

test('findNodes: results are deterministic and sorted by id', () => {
  const a = ids(findNodes(NODES, 'rb'));
  const b = [...a].sort();
  assert.deepEqual(a, b);
});

test('getNodes: an existing id is found', () => {
  const r = getNodes(NODES, ['rb.hero.1']);
  assert.equal(r.found.length, 1);
  assert.equal(r.found[0].id, 'rb.hero.1');
  assert.deepEqual(r.missing, []);
});

test('getNodes: a missing id yields suggestions in the same namespace', () => {
  const r = getNodes(NODES, ['rb.hero.999']);
  assert.deepEqual(r.missing, ['rb.hero.999']);
  assert.deepEqual(r.suggestions['rb.hero.999'], ['rb.hero.1', 'rb.hero.2']);
});

test('getNodes: mixed found and missing', () => {
  const r = getNodes(NODES, ['rb.hero.1', 'nope.x']);
  assert.deepEqual(ids(r.found), ['rb.hero.1']);
  assert.deepEqual(r.missing, ['nope.x']);
});

test('listNodes: lists a sub-namespace', () => {
  assert.deepEqual(ids(listNodes(NODES, 'rb.hero')), ['rb.hero.1', 'rb.hero.2']);
});

test('listNodes: lists a top namespace', () => {
  assert.deepEqual(ids(listNodes(NODES, 'fm')), ['fm.scroll-linked']);
});

test('relatedNodes: resolves pairs and alt edges to nodes', () => {
  const r = relatedNodes(NODES, 'rb.hero.1');
  assert.deepEqual(ids(r.pairs), ['rb.nav.1']);
  assert.deepEqual(ids(r.alt), ['rb.hero.2']);
  assert.deepEqual(r.dangling, []);
});

test('relatedNodes: reports a dangling edge', () => {
  const broken = [
    ...NODES,
    {
      id: 'rb.hero.9',
      kind: 'block',
      reg: '@reactbits-pro',
      tier: 'pro',
      label: 'hero, variant 9',
      cmd: 'x',
      deps: [],
      tags: ['hero'],
      edges: { requires: [], pairs: ['rb.ghost.1'], alt: [] },
    },
  ];
  const r = relatedNodes(broken, 'rb.hero.9');
  assert.deepEqual(r.dangling, ['rb.ghost.1']);
  assert.deepEqual(r.pairs, []);
});

test('relatedNodes: cyclic pairs do not loop', () => {
  // rb.hero.1 pairs rb.nav.1 and rb.nav.1 pairs rb.hero.1
  const r = relatedNodes(NODES, 'rb.nav.1');
  assert.deepEqual(ids(r.pairs), ['rb.hero.1']);
});

test('planNodes: unions deps across chosen nodes and keeps step order', () => {
  const r = planNodes(NODES, ['rb.hero.1', 'rb.cmp.silk-waves']);
  assert.deepEqual(r.deps, ['lucide-react', 'motion', 'three']);
  assert.deepEqual(r.steps.map((s) => s.id), ['rb.hero.1', 'rb.cmp.silk-waves']);
  assert.deepEqual(r.missing, []);
});

test('planNodes: reports a missing id', () => {
  const r = planNodes(NODES, ['rb.hero.1', 'rb.ghost.1']);
  assert.deepEqual(r.missing, ['rb.ghost.1']);
  assert.equal(r.steps.length, 1);
});

test('checkCatalog: a clean catalog is ok', () => {
  const r = checkCatalog(NODES);
  assert.equal(r.ok, true);
  assert.deepEqual(r.duplicateIds, []);
  assert.deepEqual(r.danglingEdges, []);
  assert.deepEqual(r.selfEdges, []);
});

test('checkCatalog: detects duplicate ids', () => {
  const dup = [...NODES, NODES[0]];
  const r = checkCatalog(dup);
  assert.equal(r.ok, false);
  assert.deepEqual(r.duplicateIds, ['rb.hero.1']);
});

test('checkCatalog: detects a dangling edge', () => {
  const broken = NODES.map((n) =>
    n.id === 'rb.nav.1' ? { ...n, edges: { requires: [], pairs: ['rb.ghost.1'], alt: [] } } : n
  );
  const r = checkCatalog(broken);
  assert.equal(r.ok, false);
  assert.deepEqual(r.danglingEdges, [{ from: 'rb.nav.1', to: 'rb.ghost.1', rel: 'pairs' }]);
});

test('checkCatalog: detects a self edge', () => {
  const broken = NODES.map((n) =>
    n.id === 'rb.nav.1' ? { ...n, edges: { requires: [], pairs: ['rb.nav.1'], alt: [] } } : n
  );
  const r = checkCatalog(broken);
  assert.equal(r.ok, false);
  assert.deepEqual(r.selfEdges, [{ id: 'rb.nav.1', rel: 'pairs' }]);
});

test('loadCatalog: reads and parses the catalog file', async () => {
  const cat = await loadCatalog(fixturePath);
  assert.equal(cat.version, 1);
  assert.equal(cat.nodes.length, NODES.length);
});

test('schema: the fixture validates against nodes.schema.json', async () => {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  assert.equal(validate(catalog), true, JSON.stringify(validate.errors));
});

test('schema: a node missing a required field is rejected', async () => {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const bad = { version: 1, nodes: [{ id: 'rb.x.1', kind: 'block', reg: 'r', tier: 'pro', label: 'x', deps: [], tags: [] }] };
  assert.equal(validate(bad), false);
});
