const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const bufferSelection = require('../web/buffer-selection');
const cycleModel = require('../web/cycle-model');
const residue = require('../web/cycle-residue');
const planner = require('../web/cycle-residue-planner');
const scrambling = require('../web/scrambling');
const {
  exactWeakFrontiers,
  weakCorrectionActions,
} = require('./helpers/weakswap-selected-buffer-oracle');
const { stateFromCompact } = require('./helpers/selected-buffer-class-oracle');

const root = path.join(__dirname, '..');
const scrambles = fs.readFileSync(
  path.join(root, 'baseline', 'testing-10k-scrams.txt'),
  'utf8',
).trim().split(/\r?\n/);

function vectors(frontier) {
  return frontier.map((plan) => [
    plan.fixed_algs ?? plan.permutation_algs,
    plan.orientation_algs,
  ]);
}

const threeBuffers = bufferSelection.EDGE_BUFFER_ORDER.slice(0, 3);
const correctionActions = weakCorrectionActions(threeBuffers, true);
assert.equal(correctionActions.filter((action) => action.type === '2E2E').length, 18);
assert.equal(correctionActions.filter((action) => action.type === '2E2E-prime').length, 36);
const primeAnchorFrames = new Set(correctionActions
  .filter((action) => action.type === '2E2E-prime')
  .map((action) => {
    const state = stateFromCompact('edge', action.generator);
    return [state.UF, state.FU, state.UR, state.RU].join(',');
  }));
assert.deepEqual(
  [...primeAnchorFrames].sort(),
  ['RU,UR,UF,FU', 'UR,RU,FU,UF'],
  '2E2E prime must include both UF-RU-FU and UF-UR-FU rooted sticker swaps',
);

function physicalPairKey(left, right) {
  return [left, right].sort().join('-');
}

const throughFr = bufferSelection.EDGE_BUFFER_ORDER.slice(0, 5);
const throughFrActions = weakCorrectionActions(throughFr, true);
const throughFrPairs = new Set(throughFrActions.map((action) => (
  physicalPairKey(action.buffer, action.target)
)));
for (const [left, right] of [['UL', 'DF'], ['FR', 'DB'], ['UL', 'FR']]) {
  assert.ok(
    throughFrPairs.has(physicalPairKey(left, right)),
    `${left}-${right} must be learned through the FR prefix`,
  );
}
for (const [left, right] of [['DL', 'DR'], ['FL', 'DB'], ['BR', 'BL']]) {
  assert.ok(
    !throughFrPairs.has(physicalPairKey(left, right)),
    `${left}-${right} must remain unavailable through the FR prefix`,
  );
}
assert.equal(throughFrActions.filter((action) => action.type === '2E2E').length, 48);
assert.equal(throughFrActions.filter((action) => action.type === '2E2E-prime').length, 96);

const fullCorrectionActions = weakCorrectionActions(bufferSelection.EDGE_BUFFER_ORDER, true);
const fullBrBl = fullCorrectionActions.filter((action) => (
  physicalPairKey(action.buffer, action.target) === physicalPairKey('BR', 'BL')
));
assert.equal(fullBrBl.filter((action) => action.type === '2E2E').length, 2);
assert.equal(fullBrBl.filter((action) => action.type === '2E2E-prime').length, 4);
const nineBuffers = bufferSelection.EDGE_BUFFER_ORDER.slice(0, 9);
for (const [type, capability] of [
  ['2E2E', '2e2e'],
  ['2E2E-prime', '2e2e-prime'],
]) {
  const action = fullBrBl.find((candidate) => candidate.type === type);
  const model = cycleModel.decomposeEdgeState(stateFromCompact('edge', action.generator));
  assert.equal(
    residue.minimumExactWeakswapFloatingPlan(
      model,
      bufferSelection.EDGE_BUFFER_ORDER,
      capability,
      1,
    ).cost,
    1,
    `full ${type} must include the exceptional BR-BL terminal`,
  );
  assert.equal(
    residue.minimumExactWeakswapFloatingPlan(model, nineBuffers, capability, 1).cost,
    2,
    `partial ${type} must not inherit the BR-BL exception`,
  );
}

for (const action of correctionActions) {
  const state = stateFromCompact('edge', action.generator);
  const model = cycleModel.decomposeEdgeState(state);
  const expectedCharges = action.type === '2E2E' ? [0, 0] : [1, 1];
  assert.deepEqual(
    model.active_cycles.map((cycle) => cycle.orientation_sum).sort(),
    expectedCharges,
    `${action.type} must be P + P or PF + PF, never the open P + PF mixture`,
  );
  if (action.type === '2E2E') {
    assert.equal(state.UF, 'UR', 'normal 2E2E must use the literal UF-UR sticker swap');
    assert.equal(state.UR, 'UF', 'normal 2E2E must close on the literal UF sticker');
  }
}

const basicOracle = exactWeakFrontiers(threeBuffers, false);
const maximalOracle = exactWeakFrontiers(threeBuffers, true);
assert.equal(basicOracle.frontiers.size, 29840);
assert.equal(maximalOracle.frontiers.size, basicOracle.frontiers.size);
for (const [key, compact] of basicOracle.representatives) {
  const model = cycleModel.decomposeEdgeState(stateFromCompact('edge', compact));
  assert.deepEqual(
    vectors(residue.exactWeakswapFloatingFrontier(model, threeBuffers, false)),
    vectors(basicOracle.frontiers.get(key)),
    `embedded basic weak frontier ${key}`,
  );
  assert.deepEqual(
    vectors(residue.exactWeakswapFloatingFrontier(model, threeBuffers, 'none')),
    vectors(residue.exactSelectedBufferFrontier(model, threeBuffers, 'even-permutation')),
    `none weak capability must equal ordinary exact floating ${key}`,
  );
  assert.deepEqual(
    vectors(residue.exactWeakswapFloatingFrontier(model, threeBuffers, true)),
    vectors(maximalOracle.frontiers.get(key)),
    `embedded maximal weak frontier ${key}`,
  );
}

for (const [index, scramble] of scrambles.entries()) {
  const cornerModel = cycleModel.decomposeCornerState(
    scrambling.scrToScrambledStateCor(scramble, ''),
  );
  const edgeState = scrambling.scrToScrambledStateEdg(scramble, '');
  const goal = planner.buildParityEdgeGoal(
    cornerModel.permutation_parity,
    cycleModel.EDGE_PIECE_GROUPS,
  );
  const relativeModel = cycleModel.decomposeEdgeState(
    cycleModel.stateRelativeToGoal(edgeState, goal),
  );
  let previousBasicCost = Infinity;
  for (let count = 2; count <= bufferSelection.EDGE_BUFFER_ORDER.length; count += 1) {
    const buffers = bufferSelection.EDGE_BUFFER_ORDER.slice(0, count);
    const pseudo = residue.minimumExactSelectedBufferPlan(
      relativeModel,
      buffers,
      'even-permutation',
      1.25,
    );
    const none = residue.minimumExactWeakswapFloatingPlan(
      relativeModel,
      buffers,
      'none',
      1.25,
    );
    const basic = residue.minimumExactWeakswapFloatingPlan(
      relativeModel,
      buffers,
      false,
      1.25,
    );
    const maximal = residue.minimumExactWeakswapFloatingPlan(
      relativeModel,
      buffers,
      true,
      1.25,
    );
    assert.ok(basic, `basic weak coverage ${count} at scramble ${index}`);
    assert.ok(maximal, `maximal weak coverage ${count} at scramble ${index}`);
    assert.deepEqual(none, pseudo, `none weak equality ${count}/${index}`);
    assert.ok(basic.cost <= pseudo.cost + 1e-12, `basic weak dominance ${count}/${index}`);
    assert.ok(maximal.cost <= basic.cost + 1e-12, `maximal weak dominance ${count}/${index}`);
    assert.ok(basic.cost <= previousBasicCost + 1e-12, `weak prefix monotonicity ${count}/${index}`);
    previousBasicCost = basic.cost;
  }
}

console.log('PASS weak terminal sticker variants, prefix eligibility, and full BR-BL exception');
console.log('PASS all 29840 three-buffer basic/maximal frontiers match the independent oracle');
console.log('PASS exact weak prefix coverage and dominance on all 10000 stored scrambles');
