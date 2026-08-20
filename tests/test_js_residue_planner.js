const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const cycleModel = require('../web/cycle-model');
const planner = require('../web/cycle-residue-planner');
const scrambling = require('../web/scrambling');
const ssiCore = require('../web/ssi-core');
const { synthesizeResidueState } = require('./helpers/cycle-residue-oracle');

const root = path.join(__dirname, '..');
const scrambles = fs.readFileSync(path.join(root, 'baseline', 'testing-10k-scrams.txt'), 'utf8')
  .trim()
  .split(/\r?\n/);

const solvedCorners = cycleModel.decomposeCornerState(
  cycleModel.solvedStateFromPieceGroups(require('../web/corner-tracing').CORNER_PIECE_GROUPS),
);
const solvedEdges = cycleModel.decomposeEdgeState(
  cycleModel.solvedStateFromPieceGroups(cycleModel.EDGE_PIECE_GROUPS),
);
const cornerCoverage = planner.proveFullBufferCoverage(solvedCorners, planner.FULL_CORNER_BUFFERS);
const edgeCoverage = planner.proveFullBufferCoverage(solvedEdges, planner.FULL_EDGE_BUFFERS);
assert.deepEqual(cornerCoverage.excluded_pieces.sort(), ['DBL', 'DBR']);
assert.deepEqual(edgeCoverage.excluded_pieces.sort(), ['BL', 'BR']);
assert.equal(cornerCoverage.complete, true, 'every corner 3-cycle must contain a full-set buffer');
assert.equal(edgeCoverage.complete, true, 'every edge 3-cycle must contain a full-set buffer');

const externalCornerSwap = cycleModel.solvedStateFromPieceGroups(
  require('../web/corner-tracing').CORNER_PIECE_GROUPS,
);
Object.assign(externalCornerSwap, {
  DBR: 'DBL', RDB: 'BDL', BDR: 'LDB',
  DBL: 'DBR', BDL: 'RDB', LDB: 'BDR',
});
assert.equal(
  planner.planCornerStateByResidues(
    externalCornerSwap,
    planner.FULL_CORNER_BUFFERS,
  ).total_algs,
  2,
  'an excluded DBR/DBL P0 needs one link before the UFR-based parity alg',
);

const primaryCornerSwap = cycleModel.solvedStateFromPieceGroups(
  require('../web/corner-tracing').CORNER_PIECE_GROUPS,
);
Object.assign(primaryCornerSwap, {
  UFR: 'UBR', RUF: 'BUR', FUR: 'RUB',
  UBR: 'UFR', BUR: 'RUF', RUB: 'FUR',
});
assert.equal(
  planner.planCornerStateByResidues(
    primaryCornerSwap,
    planner.FULL_CORNER_BUFFERS,
  ).total_algs,
  1,
  'a UFR/UBR P0 is directly solvable by the parity algset',
);

assert.equal(planner.buildCornerFinishGoals(solvedCorners, 'none').length, 21);
assert.equal(planner.buildCornerFinishGoals(solvedCorners, 'ltct').length, 273);
assert.equal(planner.buildCornerFinishGoals(solvedCorners, 't2c').length, 399);

const externalEdgeSwaps = cycleModel.solvedStateFromPieceGroups(cycleModel.EDGE_PIECE_GROUPS);
Object.assign(externalEdgeSwaps, {
  BR: 'BL', RB: 'LB', BL: 'BR', LB: 'RB',
  UF: 'UR', FU: 'RU', UR: 'UF', RU: 'FU',
});
assert.equal(
  planner.planEdgeStateByResidues(
    externalEdgeSwaps,
    false,
    planner.FULL_EDGE_BUFFERS,
  ).total_algs,
  2,
  'the excluded BR/BL 2-cycle stays a normal P residue and closes with another P',
);

let unitAggregate = 0;
for (const [index, scramble] of scrambles.entries()) {
  const cornerState = scrambling.scrToScrambledStateCor(scramble, '');
  const cornerPlan = planner.planCornerStateByResidues(
    cornerState,
    planner.FULL_CORNER_BUFFERS,
  );
  const edgePlan = planner.planEdgeStateByResidues(
    scrambling.scrToScrambledStateEdg(scramble, ''),
    cornerPlan.model.permutation_parity,
    planner.FULL_EDGE_BUFFERS,
  );
  const standard = ssiCore.analyzeScramble(
    scramble,
    '',
    'pseudoswap',
    1,
    1,
    false,
    ['UFR'],
    ['UF'],
  );
  assert.ok(
    cornerPlan.total_algs + edgePlan.total_algs <= standard.total_algs,
    `full residue plan must not exceed standard tracing at scramble ${index}`,
  );
  const productionFull = ssiCore.analyzeScramble(
    scramble,
    '',
    'pseudoswap',
    1,
    1,
    false,
    'all',
    'all',
  );
  assert.equal(productionFull.corner.tracing_model, 'cycle-residue');
  assert.equal(productionFull.edges.tracing_model, 'cycle-residue');
  assert.equal(productionFull.corner_algs, cornerPlan.total_algs, `production corner ${index}`);
  assert.equal(productionFull.edge_algs, edgePlan.total_algs, `production edge ${index}`);
  assert.equal(
    productionFull.total_algs,
    cornerPlan.total_algs + edgePlan.total_algs,
    `production total ${index}`,
  );
  assert.equal(
    edgePlan.model.permutation_parity,
    0,
    `parity-relative edge model at scramble ${index}`,
  );
  unitAggregate += productionFull.total_algs;
}
assert.equal(unitAggregate, 96671, 'weight-1 full-floating aggregate must stay frozen');

// These were the complete set of false one-alg corner savings found when a
// bare P0 residue was incorrectly treated as a directly executable parity alg.
// A real parity alg requires UFR to be one side of the final corner 2-swap.
for (const [number, expectedCorners, expectedEdges] of [
  [257, 5, 6],
  [586, 5, 6],
  [1120, 5, 5],
  [1554, 5, 6],
  [2908, 5, 6],
  [3010, 5, 5],
  [3118, 5, 6],
  [3585, 5, 6],
  [3867, 5, 6],
  [4921, 5, 6],
  [4959, 5, 6],
  [6222, 3, 5],
  [6743, 5, 6],
  [7700, 4, 5],
  [7854, 5, 6],
  [8289, 5, 5],
  [9961, 5, 6],
]) {
  const result = ssiCore.analyzeScramble(
    scrambles[number - 1],
    '',
    'pseudoswap',
    1,
    1,
    false,
    'all',
    'all',
  );
  assert.equal(result.corner_algs, expectedCorners, `UFR parity eligibility corner #${number}`);
  assert.equal(result.edge_algs, expectedEdges, `UFR parity eligibility edge #${number}`);
}

for (const [index, scramble] of scrambles.slice(0, 500).entries()) {
  const weak = ssiCore.analyzeScramble(scramble, '', 'weakswap', 1, 1, false, 'all', 'all');
  const maximalWeak = ssiCore.analyzeScramble(
    scramble, '', 'weakswap', 1, 1, false, 'all', 'all', true,
  );
  assert.equal(weak.edges.tracing_model, 'weakswap-selected-buffer');
  assert.ok(maximalWeak.total_algs <= weak.total_algs, `full weak maximal dominance ${index}`);
  assert.ok(
    weak.edge_algs <= ssiCore.analyzeScramble(
      scramble, '', 'weakswap', 1, 1, false, ['UFR'], ['UF'], '2e2e',
    ).edge_algs,
    `full weak must not exceed singleton weak ${index}`,
  );
}

for (const [index, scramble] of scrambles.slice(0, 1000).entries()) {
  for (const [flipWeight, twistWeight] of [[1.1, 1.25], [1.25, 1.1]]) {
    const cornerState = scrambling.scrToScrambledStateCor(scramble, '');
    const cornerPlan = planner.planCornerStateByResidues(
      cornerState,
      planner.FULL_CORNER_BUFFERS,
      'none',
      twistWeight,
    );
    const edgePlan = planner.planEdgeStateByResidues(
      scrambling.scrToScrambledStateEdg(scramble, ''),
      cornerPlan.model.permutation_parity,
      planner.FULL_EDGE_BUFFERS,
      flipWeight,
    );
    const production = ssiCore.analyzeScramble(
      scramble,
      '',
      'pseudoswap',
      flipWeight,
      twistWeight,
      false,
      'all',
      'all',
    );
    assert.equal(production.corner.tracing_model, 'cycle-residue');
    assert.equal(production.edges.tracing_model, 'cycle-residue');
    assert.ok(
      Math.abs(production.corner_algs - cornerPlan.total_algs) < 1e-12,
      `weighted production corner ${index} at ${flipWeight}/${twistWeight}`,
    );
    assert.ok(
      Math.abs(production.edge_algs - edgePlan.total_algs) < 1e-12,
      `weighted production edge ${index} at ${flipWeight}/${twistWeight}`,
    );
    assert.ok(
      Math.abs(
        cornerPlan.total_algs
        - (cornerPlan.permutation_algs + twistWeight * cornerPlan.orientation_algs)
      ) < 1e-12,
      `weighted corner decomposition ${index}`,
    );
    assert.ok(
      Math.abs(
        edgePlan.total_algs
        - (edgePlan.permutation_algs + flipWeight * edgePlan.orientation_algs)
      ) < 1e-12,
      `weighted edge decomposition ${index}`,
    );
  }
}

for (const [index, scramble] of scrambles.slice(0, 100).entries()) {
  for (const [flipWeight, twistWeight] of [[1.1, 1.25], [1.25, 1.1]]) {
    const cornerPlan = planner.planCornerStateByResidues(
      scrambling.scrToScrambledStateCor(scramble, ''),
      planner.FULL_CORNER_BUFFERS,
      'ltct',
      twistWeight,
    );
    const edgePlan = planner.planEdgeStateByResidues(
      scrambling.scrToScrambledStateEdg(scramble, ''),
      cornerPlan.model.permutation_parity,
      planner.FULL_EDGE_BUFFERS,
      flipWeight,
    );
    const production = ssiCore.analyzeScramble(
      scramble,
      '',
      'pseudoswap',
      flipWeight,
      twistWeight,
      true,
      'all',
      'all',
    );
    assert.ok(
      Math.abs(production.corner_algs - cornerPlan.total_algs) < 1e-12,
      `weighted production LTCT corner ${index} at ${flipWeight}/${twistWeight}`,
    );
    assert.ok(
      Math.abs(production.edge_algs - edgePlan.total_algs) < 1e-12,
      `weighted production LTCT edge ${index} at ${flipWeight}/${twistWeight}`,
    );
  }
}

assert.throws(
  () => planner.planCornerStateByResidues(
    cycleModel.solvedStateFromPieceGroups(require('../web/corner-tracing').CORNER_PIECE_GROUPS),
    planner.FULL_CORNER_BUFFERS,
    'none',
    0.99,
  ),
  /greater than or equal to 1/,
);

const longRegression = "R2 F2 L2 R2 D' R2 U2 B2 F2 R2 U B R D L' R' U' F R' D F2 Rw Uw'";
const longCorners = planner.planCornerStateByResidues(
  scrambling.scrToScrambledStateCor(longRegression, ''),
  planner.FULL_CORNER_BUFFERS,
);
const longEdges = planner.planEdgeStateByResidues(
  scrambling.scrToScrambledStateEdg(longRegression, ''),
  longCorners.model.permutation_parity,
  planner.FULL_EDGE_BUFFERS,
);
assert.equal(longCorners.total_algs, 4);
assert.equal(longEdges.total_algs, 5);
assert.equal(longCorners.total_algs + longEdges.total_algs, 9);

assert.throws(
  () => planner.planCornerStateByResidues(
    scrambling.scrToScrambledStateCor('U', ''),
    ['UFR', 'UFL'],
  ),
  /complete floating buffer set/,
);
for (const terminal of [['T+', 'P-'], ['T-', 'P+']]) {
  for (const [role, expected] of [
    ['in-P', { none: 2, ltct: 1, t2c: 1 }],
    ['is-T', { none: 2, ltct: 2, t2c: 1 }],
    ['uninvolved', { none: 3, ltct: 2, t2c: 2 }],
  ]) {
    const state = synthesizeResidueState('corner', terminal, role);
    for (const capability of ['none', 'ltct', 't2c']) {
      assert.equal(
        planner.planCornerStateByResidues(
          state,
          planner.FULL_CORNER_BUFFERS,
          capability,
        ).total_algs,
        expected[capability],
        `${terminal.join(' ')} ${role} ${capability}`,
      );
    }
  }
}

for (const [index, scramble] of scrambles.slice(0, 100).entries()) {
  const state = scrambling.scrToScrambledStateCor(scramble, '');
  for (const capability of ['none', 'ltct', 't2c']) {
    for (const weight of [1, 1.1, 1.25, 2]) {
      const fast = planner.planCornerStateByResidues(
        state,
        planner.FULL_CORNER_BUFFERS,
        capability,
        weight,
      );
      const enumerated = planner.planCornerStateByTerminalEnumeration(
        state,
        planner.FULL_CORNER_BUFFERS,
        capability,
        weight,
      );
      assert.ok(
        Math.abs(fast.total_algs - enumerated.total_algs) < 1e-12,
        `rooted finish frontier vs concrete terminal enumeration ${capability} at ${weight}, scramble ${index}`,
      );
    }
  }
}

console.log('PASS full buffer sets cover every concrete three-piece algorithm');
console.log('PASS excluded DBR/DBL and BR/BL cycles reduce without a hidden base surcharge');
console.log(`PASS full cycle-residue edge/corner plans on ${scrambles.length} scrambles`);
console.log('PASS full-buffer weights 1.1/1.25 and LTCT stay on exact weighted class planning');
console.log('PASS all 17 UFR parity-eligibility regressions retain their required corner alg');
console.log('PASS cycle-residue planner retains the human-confirmed 9 = 4 + 5 regression');
console.log('PASS weighted rooted LTCT/T2C frontiers match concrete terminal enumeration');
