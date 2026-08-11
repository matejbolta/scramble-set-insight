const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const scrambling = require('../web/scrambling');
const cycleModel = require('../web/cycle-model');
const residue = require('../web/cycle-residue');
const residuePlanner = require('../web/cycle-residue-planner');
const {
  exactRootedCornerFinishFrontiers,
  exactWeightedClassFrontiers,
} = require('./helpers/weighted-class-oracle');
const {
  CORNER_BUFFER_ORDER,
  EDGE_BUFFER_ORDER,
  exactSelectedBufferFrontiers,
  solveSelectedBufferState,
  stateFromCompact,
} = require('./helpers/selected-buffer-class-oracle');

function ordinaryKey(selectedKey) {
  if (selectedKey === 'solved') return selectedKey;
  return selectedKey.split('|').map((record) => {
    const [, length, charge] = record.split(':');
    return `${length}:${charge}`;
  }).sort().join('|');
}

function rootedKey(selectedKey) {
  const records = selectedKey.split('|').map((record) => {
    const [colors, length, charge] = record.split(':');
    return { root: colors.includes('P'), value: `${length}:${charge}` };
  });
  const root = records.find((record) => record.root);
  const others = records.filter((record) => !record.root).map((record) => record.value).sort();
  return [`*${root.value}`, ...others].join('|');
}

function vectors(frontier) {
  return frontier.map((plan) => [
    plan.permutation_algs,
    plan.orientation_algs,
    plan.finish?.type || null,
    plan.finish?.primary_role || null,
  ]);
}

function catalogVectors(exact) {
  return Object.fromEntries(
    [...exact.frontiers]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, frontier]) => [key, vectors(frontier)]),
  );
}

for (const [kind, buffers] of [
  ['edge', EDGE_BUFFER_ORDER],
  ['corner', CORNER_BUFFER_ORDER],
]) {
  const selected = exactSelectedBufferFrontiers(kind, buffers, 'even-permutation');
  const existing = exactWeightedClassFrontiers(kind).frontiers;
  assert.equal(selected.frontiers.size, existing.size, `${kind} full selected class count`);
  for (const [key, frontier] of selected.frontiers) {
    assert.deepEqual(
      vectors(frontier),
      vectors(existing.get(ordinaryKey(key))),
      `${kind} full selected frontier ${key}`,
    );
    const state = stateFromCompact(kind, selected.representatives.get(key));
    const model = kind === 'corner'
      ? cycleModel.decomposeCornerState(state)
      : cycleModel.decomposeEdgeState(state);
    assert.deepEqual(
      vectors(residue.exactSelectedBufferFrontier(model, buffers, 'even-permutation')),
      vectors(frontier),
      `${kind} full selected production endpoint ${key}`,
    );
  }
}

for (const capability of ['none', 'ltct', 't2c']) {
  const selected = exactSelectedBufferFrontiers(
    'corner',
    CORNER_BUFFER_ORDER,
    capability,
  );
  const existing = exactRootedCornerFinishFrontiers(capability).frontiers;
  assert.equal(selected.frontiers.size, existing.size, `${capability} full rooted class count`);
  for (const [key, frontier] of selected.frontiers) {
    assert.deepEqual(
      vectors(frontier),
      vectors(existing.get(rootedKey(key))),
      `${capability} full rooted selected frontier ${key}`,
    );
    const state = stateFromCompact('corner', selected.representatives.get(key));
    const model = cycleModel.decomposeCornerState(state);
    assert.deepEqual(
      vectors(residue.exactSelectedBufferFrontier(model, CORNER_BUFFER_ORDER, capability)),
      vectors(frontier),
      `${capability} full rooted production endpoint ${key}`,
    );
  }
}

assert.deepEqual(
  catalogVectors(exactSelectedBufferFrontiers('edge', ['UF', 'DL'], 'even-permutation')),
  catalogVectors(exactSelectedBufferFrontiers('edge', ['UF', 'UB'], 'even-permutation')),
  'two selected edge pieces are equivalent up to physical relabeling',
);
assert.deepEqual(
  catalogVectors(exactSelectedBufferFrontiers('corner', ['UFR', 'FDL'], 'even-permutation')),
  catalogVectors(exactSelectedBufferFrontiers('corner', ['UFR', 'UFL'], 'even-permutation')),
  'two selected corner pieces are equivalent up to physical relabeling',
);
assert.deepEqual(
  catalogVectors(exactSelectedBufferFrontiers('corner', ['UFR', 'FDL'], 't2c')),
  catalogVectors(exactSelectedBufferFrontiers('corner', ['UFR', 'UFL'], 't2c')),
  'rooted selected corner pieces are equivalent up to relabeling that fixes UFR',
);

function assertEmbeddedCatalog(kind, buffers, finishMode) {
  const exact = exactSelectedBufferFrontiers(kind, buffers, finishMode);
  for (const [key, compact] of exact.representatives) {
    const state = stateFromCompact(kind, compact);
    const model = kind === 'corner'
      ? cycleModel.decomposeCornerState(state)
      : cycleModel.decomposeEdgeState(state);
    assert.deepEqual(
      vectors(residue.exactSelectedBufferFrontier(model, buffers, finishMode)),
      vectors(exact.frontiers.get(key)),
      `${kind} ${finishMode} embedded frontier ${key}`,
    );
  }
}

assertEmbeddedCatalog('edge', ['UF', 'UB'], 'even-permutation');
assertEmbeddedCatalog('corner', ['UFR', 'UFL'], 'even-permutation');
for (const capability of ['none', 'ltct', 't2c']) {
  assertEmbeddedCatalog('corner', ['UFR', 'UFL'], capability);
}

const threeTwistParityScramble = "F2 D L2 U2 L2 B2 L2 D R2 D2 R2 F2 L' B' D2 U' F U' L U' B2 Fw' Uw'";
const lifted = solveSelectedBufferState(
  'corner',
  scrambling.scrToScrambledStateCor(threeTwistParityScramble, ''),
  ['UFR'],
  'none',
  1,
);
assert.equal(lifted.plan.cost, 4);
assert.equal(
  residuePlanner.planCornerStateBySelectedBuffers(
    scrambling.scrToScrambledStateCor(threeTwistParityScramble, ''),
    ['UFR'],
    'none',
    1,
  ).total_algs,
  4,
);
assert.deepEqual(
  lifted.steps.map((step) => step.type),
  ['2-twist', '2-twist', 'comm', 'parity'],
);
assert.equal(lifted.steps.find((step) => step.type === 'comm').buffer, 'UFR');

const scrambles = fs.readFileSync(
  path.join(__dirname, '..', 'baseline', 'testing-10k-scrams.txt'),
  'utf8',
).trim().split(/\r?\n/);
for (const [index, scramble] of scrambles.entries()) {
  const cornerState = scrambling.scrToScrambledStateCor(scramble, '');
  const cornerModel = cycleModel.decomposeCornerState(cornerState);
  for (let count = 1; count < CORNER_BUFFER_ORDER.length; count += 1) {
    const buffers = CORNER_BUFFER_ORDER.slice(0, count);
    const finishModes = cornerModel.permutation_parity
      ? ['none', 'ltct', 't2c']
      : ['even-permutation'];
    for (const finishMode of finishModes) {
      assert.ok(
        residue.exactSelectedBufferFrontier(cornerModel, buffers, finishMode),
        `corner ${count}/${finishMode} catalog coverage at scramble ${index}`,
      );
    }
  }

  const edgeState = scrambling.scrToScrambledStateEdg(scramble, '');
  const edgeGoal = residuePlanner.buildParityEdgeGoal(
    cornerModel.permutation_parity,
    cycleModel.EDGE_PIECE_GROUPS,
  );
  const relativeEdgeModel = cycleModel.decomposeEdgeState(
    cycleModel.stateRelativeToGoal(edgeState, edgeGoal),
  );
  for (let count = 1; count < EDGE_BUFFER_ORDER.length; count += 1) {
    assert.ok(
      residue.exactSelectedBufferFrontier(
        relativeEdgeModel,
        EDGE_BUFFER_ORDER.slice(0, count),
        'even-permutation',
      ),
      `edge ${count} catalog coverage at scramble ${index}`,
    );
  }
}

console.log('PASS selected-buffer compact graph reproduces all exact full-floating frontiers');
console.log('PASS selected-buffer graph depends on buffer count, not checkbox identity');
console.log('PASS embedded two-buffer frontiers match the independent compact oracle');
console.log('PASS singleton UFR class path lifts to two twists, one comm, and parity');
console.log('PASS embedded selected-buffer catalogs cover all 10000 stored scrambles');
