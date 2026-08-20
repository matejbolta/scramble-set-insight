const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const bufferSelection = require('../web/buffer-selection');
const cycleModel = require('../web/cycle-model');
const residue = require('../web/cycle-residue');
const planner = require('../web/cycle-residue-planner');
const scrambling = require('../web/scrambling');
const ssiCore = require('../web/ssi-core');
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
assert.deepEqual(
  Object.fromEntries(['2e2e', 'f2e', 'ff2e'].map((terminalType) => [
    terminalType,
    correctionActions.filter((action) => action.terminal_type === terminalType).length,
  ])),
  { '2e2e': 18, f2e: 18, ff2e: 18 },
  'the former prime family must split exactly by the flipped UF/UR slot',
);
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

for (const terminalType of ['2e2e', 'f2e', 'ff2e']) {
  const action = correctionActions.find((candidate) => (
    candidate.terminal_type === terminalType
  ));
  const model = cycleModel.decomposeEdgeState(stateFromCompact('edge', action.generator));
  const plan = residue.minimumExactRootedEdgePlan(
    model,
    threeBuffers,
    terminalType,
    1,
    { [terminalType]: 1.25 },
  );
  assert.equal(plan.cost, 1.25, `${terminalType} must use its own runtime weight`);
  assert.equal(plan.finish.type, terminalType);
  const pseudoPlan = planner.planEdgeStateBySelectedBuffers(
    stateFromCompact('edge', action.generator),
    false,
    threeBuffers,
    1,
    terminalType,
    { [terminalType]: 1.25 },
  );
  assert.equal(
    pseudoPlan.total_algs,
    1.25,
    `${terminalType} must share the exact rooted terminal planner with pseudoswap`,
  );
  assert.equal(pseudoPlan.finish.type, terminalType);
}
const ff2eAction = correctionActions.find((action) => action.terminal_type === 'ff2e');
const ff2eModel = cycleModel.decomposeEdgeState(stateFromCompact('edge', ff2eAction.generator));
assert.equal(
  residue.minimumExactRootedEdgePlan(ff2eModel, threeBuffers, 'f2e', 1).cost,
  2,
  'F2E knowledge must not imply FF2E',
);
assert.equal(
  residue.minimumExactRootedEdgePlan(ff2eModel, threeBuffers, 'ff2e', 1).cost,
  1,
  'FF2E knowledge must include its UR-slot-flipped terminal',
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
  ['2E2E-prime', 'ff2e'],
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

const ltefScrambles = [
  "U' R E2 R' U R E2 R' S R' E R U' R' E' R U S'",
  "U' R E2 R' U R E2 R' S R' E R U' R' E' R U S' U' R' F R U' M' U2 M U' S R' F' R S' U",
];
for (const scramble of ltefScrambles) {
  for (const buffers of [
    ['UF'],
    threeBuffers,
    bufferSelection.EDGE_BUFFER_ORDER,
  ]) {
    const withoutLtef = ssiCore.analyzeScramble(
      scramble,
      '',
      'weakswap',
      1,
      1,
      'none',
      ['UFR'],
      buffers,
      'none',
      { edge_finish_capability: 'none', ltef: false },
    );
    const withLtef = ssiCore.analyzeScramble(
      scramble,
      '',
      'weakswap',
      1,
      1,
      'none',
      ['UFR'],
      buffers,
      'none',
      {
        edge_finish_capability: 'none',
        ltef: true,
        terminal_weights: { ltef: 1.25 },
      },
    );
    assert.equal(withoutLtef.edge_algs, 2);
    assert.equal(withLtef.edge_algs, 1.25);
    const finish = buffers.length === 1
      ? withLtef.edges.weakswap_cycle.finish
      : withLtef.edges.weakswap_floating.finish;
    assert.equal(finish.type, 'ltef');
  }
}

const prefixedLtefScramble = "B' D2 R D2 U2 F2 L D2 B2 L R2 D2 R F R B' F' L2 D R2 Rw Uw'";
const prefixedLtefWithout = ssiCore.analyzeScramble(
  prefixedLtefScramble,
  '',
  'weakswap',
  1,
  1,
  'none',
  ['UFR'],
  threeBuffers,
  'none',
  { edge_finish_capability: 'none', ltef: false },
);
const prefixedLtefWith = ssiCore.analyzeScramble(
  prefixedLtefScramble,
  '',
  'weakswap',
  1,
  1,
  'none',
  ['UFR'],
  threeBuffers,
  'none',
  {
    edge_finish_capability: 'none',
    ltef: true,
    terminal_weights: { ltef: 1.25 },
  },
);
assert.equal(prefixedLtefWithout.edge_algs, 6);
assert.equal(prefixedLtefWith.edge_algs, 5.25);
assert.equal(prefixedLtefWith.edges.weakswap_floating.entry_mode, 'ltef');
assert.equal(prefixedLtefWith.edges.weakswap_floating.entry_prefix_fixed_algs, 4);
assert.equal(prefixedLtefWith.edges.weakswap_floating.finish.type, 'ltef');

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
  assert.equal(
    planner.directWeakFloatingTerminal(state, threeBuffers, action.terminal_type),
    `direct-${action.terminal_type}`,
    `${action.terminal_type} must classify by its exact rooted sticker frame`,
  );
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
      `post-entry None suffix must equal ordinary exact floating ${key}`,
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
    assert.deepEqual(
      [none.cost, none.permutation_algs, none.orientation_algs],
      [pseudo.cost, pseudo.permutation_algs, pseudo.orientation_algs],
      `post-entry None suffix equality ${count}/${index}`,
    );
    assert.ok(basic.cost <= pseudo.cost + 1e-12, `post-entry basic suffix dominance ${count}/${index}`);
    assert.ok(maximal.cost <= basic.cost + 1e-12, `maximal weak dominance ${count}/${index}`);
    assert.ok(basic.cost <= previousBasicCost + 1e-12, `weak prefix monotonicity ${count}/${index}`);
    previousBasicCost = basic.cost;
  }
}

let productionNoneAbovePseudo = 0;
for (const [index, scramble] of scrambles.entries()) {
  const singleton = ssiCore.analyzeScramble(
    scramble, '', 'weakswap', 1, 1, false, ['UFR'], ['UF'], 'none',
  );
  const pseudo = ssiCore.analyzeScramble(
    scramble, '', 'pseudoswap', 1, 1, false, ['UFR'], bufferSelection.EDGE_BUFFER_ORDER,
  );
  const pseudo2e2e = ssiCore.analyzeScramble(
    scramble,
    '',
    'pseudoswap',
    1,
    1,
    false,
    ['UFR'],
    bufferSelection.EDGE_BUFFER_ORDER,
    'none',
    { edge_finish_capability: '2e2e' },
  );
  const pseudoF2e = ssiCore.analyzeScramble(
    scramble,
    '',
    'pseudoswap',
    1,
    1,
    false,
    ['UFR'],
    bufferSelection.EDGE_BUFFER_ORDER,
    'none',
    { edge_finish_capability: 'f2e' },
  );
  const pseudoFf2e = ssiCore.analyzeScramble(
    scramble,
    '',
    'pseudoswap',
    1,
    1,
    false,
    ['UFR'],
    bufferSelection.EDGE_BUFFER_ORDER,
    'none',
    { edge_finish_capability: 'ff2e' },
  );
  const none = ssiCore.analyzeScramble(
    scramble, '', 'weakswap', 1, 1, false, ['UFR'], bufferSelection.EDGE_BUFFER_ORDER, 'none',
  );
  const basic = ssiCore.analyzeScramble(
    scramble, '', 'weakswap', 1, 1, false, ['UFR'], bufferSelection.EDGE_BUFFER_ORDER, '2e2e',
  );
  const f2e = ssiCore.analyzeScramble(
    scramble, '', 'weakswap', 1, 1, false, ['UFR'], bufferSelection.EDGE_BUFFER_ORDER, 'f2e',
  );
  const maximal = ssiCore.analyzeScramble(
    scramble, '', 'weakswap', 1, 1, false, ['UFR'], bufferSelection.EDGE_BUFFER_ORDER, 'ff2e',
  );
  assert.ok(none.edge_algs <= singleton.edge_algs, `None versus singleton ${index}`);
  assert.ok(pseudo2e2e.edge_algs <= pseudo.edge_algs, `pseudo 2E2E capability ${index}`);
  assert.ok(pseudoF2e.edge_algs <= pseudo2e2e.edge_algs, `pseudo F2E capability ${index}`);
  assert.ok(pseudoFf2e.edge_algs <= pseudoF2e.edge_algs, `pseudo FF2E capability ${index}`);
  assert.ok(basic.edge_algs <= none.edge_algs, `2E2E capability monotonicity ${index}`);
  assert.ok(f2e.edge_algs <= basic.edge_algs, `F2E capability monotonicity ${index}`);
  assert.ok(maximal.edge_algs <= f2e.edge_algs, `FF2E capability monotonicity ${index}`);
  assert.ok(!none.edges.weakswap_floating.entry_mode.startsWith('open-'));
  assert.ok(!basic.edges.weakswap_floating.entry_mode.startsWith('open-'));
  if (maximal.edges.weakswap_floating.entry_mode.startsWith('open-')) {
    assert.ok(
      ['f2e', 'ff2e'].includes(
        maximal.edges.weakswap_floating.entry_required_capability,
      ),
    );
  }
  if (none.edge_algs > pseudo.edge_algs) productionNoneAbovePseudo += 1;
}
assert.ok(
  productionNoneAbovePseudo > 0,
  'production weak None must retain legal-entry cases above the pseudo lower bound',
);

console.log('PASS weak terminal sticker variants, prefix eligibility, and full BR-BL exception');
console.log('PASS all 29840 three-buffer basic/maximal frontiers match the independent oracle');
console.log('PASS exact post-entry weak suffix coverage and dominance on all 10000 stored scrambles');
console.log('PASS production pseudo/weak capability monotonicity on all 10000 stored scrambles');
