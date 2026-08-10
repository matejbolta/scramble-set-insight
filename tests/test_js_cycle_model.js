const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const cycleModel = require('../web/cycle-model');
const dlin = require('../web/dlin-planner');
const scrambling = require('../web/scrambling');
const ssiCore = require('../web/ssi-core');

const root = path.join(__dirname, '..');
const scrambles = fs.readFileSync(path.join(root, 'baseline', 'testing-10k-scrams.txt'), 'utf8')
  .trim()
  .split(/\r?\n/);

function sortedState(state) {
  return Object.fromEntries(Object.entries(state).sort(([left], [right]) => left.localeCompare(right)));
}

function assertPermutationSolved(plan, label) {
  for (const group of plan.model.piece_groups) {
    assert.ok(group.includes(plan.final_state[group[0]]), `${label}: ${group[0]} permutation`);
  }
}

for (const [index, scramble] of scrambles.entries()) {
  const cornerState = scrambling.scrToScrambledStateCor(scramble, '');
  const edgeState = scrambling.scrToScrambledStateEdg(scramble, '');
  const corners = cycleModel.decomposeCornerState(cornerState);
  const edges = cycleModel.decomposeEdgeState(edgeState);

  assert.deepEqual(
    sortedState(cycleModel.reconstructStateFromCycleModel(corners)),
    sortedState(cornerState),
    `corner cycle reconstruction at scramble ${index}`,
  );
  assert.deepEqual(
    sortedState(cycleModel.reconstructStateFromCycleModel(edges)),
    sortedState(edgeState),
    `edge cycle reconstruction at scramble ${index}`,
  );
  assert.equal(corners.orientation_sum, 0, `corner orientation invariant at scramble ${index}`);
  assert.equal(edges.orientation_sum, 0, `edge orientation invariant at scramble ${index}`);
  assert.equal(
    corners.permutation_parity,
    edges.permutation_parity,
    `corner/edge permutation parity at scramble ${index}`,
  );
  assert.equal(
    corners.cycles.flatMap((cycle) => cycle.sticker_orbits).flat().length,
    24,
    `corner sticker coverage at scramble ${index}`,
  );
  assert.equal(
    edges.cycles.flatMap((cycle) => cycle.sticker_orbits).flat().length,
    24,
    `edge sticker coverage at scramble ${index}`,
  );
}

const solvedEdges = cycleModel.solvedStateFromPieceGroups(cycleModel.EDGE_PIECE_GROUPS);
const twoSwappedEdges = {
  ...solvedEdges,
  UF: 'UR', FU: 'RU',
  UR: 'UF', RU: 'FU',
};
const twoFlippedEdges = {
  ...solvedEdges,
  UF: 'FU', FU: 'UF',
  UR: 'RU', RU: 'UR',
};
const swappedEdgeModel = cycleModel.decomposeEdgeState(twoSwappedEdges);
const flippedEdgeModel = cycleModel.decomposeEdgeState(twoFlippedEdges);
assert.deepEqual(
  swappedEdgeModel.active_cycles.map((cycle) => [cycle.length, cycle.permutation_parity, cycle.orientation_sum]),
  [[2, 1, 0]],
  'two unresolved swapped edges must be one odd-permutation cycle',
);
assert.deepEqual(
  flippedEdgeModel.active_cycles.map((cycle) => [cycle.length, cycle.permutation_parity, cycle.orientation_sum]),
  [[1, 0, 1], [1, 0, 1]],
  'two unresolved flipped edges must be two oriented fixed pieces',
);

const sandwichScramble = "R2 F2 L2 R2 D' R2 U2 B2 F2 R2 U B R D L' R' U' F R' D F2 Rw Uw'";
const sandwichCorners = cycleModel.decomposeCornerState(
  scrambling.scrToScrambledStateCor(sandwichScramble, ''),
);
const sandwichCycle = sandwichCorners.cycles.find((cycle) => (
  cycle.slots.length === 3
  && cycle.slots.includes('UBR')
  && cycle.slots.includes('UFL')
  && cycle.slots.includes('DBL')
));
assert.ok(sandwichCycle, 'expected B-I-Z corner cycle');
assert.deepEqual(cycleModel.findStickerOrbit(sandwichCycle, 'UBR'), ['UBR', 'FUL', 'DBL']);
assert.deepEqual(
  cycleModel.targetsFromExternalBuffer(sandwichCycle, 'UBR'),
  ['UBR', 'FUL', 'DBL', 'UBR'],
);
assert.deepEqual(cycleModel.targetsFromCycleBuffer(sandwichCycle, 'UBR'), ['FUL', 'DBL']);

const cornerPlan = dlin.planCornerStateDlin(
  scrambling.scrToScrambledStateCor(sandwichScramble, ''),
  ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL'],
  1,
);
assert.equal(cornerPlan.complete, true);
assert.equal(cornerPlan.total_algs, 4);

const edgePlan = dlin.planEdgeStateDlin(
  scrambling.scrToScrambledStateEdg(sandwichScramble, ''),
  true,
  ['UF', 'UB', 'UR', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'],
  1,
);
assert.equal(edgePlan.complete, true);
assert.equal(edgePlan.total_algs, 5);
assert.equal(cornerPlan.total_algs + edgePlan.total_algs, 9);

const shortSandwichScramble = "R F' U L' Uw'";
const shortFull = ssiCore.analyzeScramble(
  shortSandwichScramble,
  '',
  'pseudoswap',
  1,
  1,
  false,
  'all',
  'all',
);
assert.equal(shortFull.corner.tracing_model, 'cycle-residue');
assert.equal(shortFull.edges.tracing_model, 'cycle-residue');
assert.deepEqual(shortFull.corner.cycle_residue.residue_types, ['T-', 'P+', 'T+', 'T+', 'T+']);
assert.equal(shortFull.corner.analysis.algs, 5);
assert.equal(shortFull.corner_algs, 5);
assert.equal(shortFull.edge_algs, 6);
assert.equal(shortFull.total_algs, 11);

for (const [index, scramble] of scrambles.slice(0, 1000).entries()) {
  const corners = dlin.planCornerStateDlin(
    scrambling.scrToScrambledStateCor(scramble, ''),
    ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL'],
    1,
  );
  const edges = dlin.planEdgeStateDlin(
    scrambling.scrToScrambledStateEdg(scramble, ''),
    Boolean(corners.model.permutation_parity),
    ['UF', 'UB', 'UR', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'],
    1,
  );
  assert.equal(corners.complete, true, `corner DLin completion at scramble ${index}`);
  assert.equal(edges.complete, true, `edge DLin completion at scramble ${index}`);
  assert.equal(
    corners.segment_analysis.parity,
    Boolean(corners.model.permutation_parity),
    `corner DLin parity at scramble ${index}`,
  );
  assert.equal(edges.segment_analysis.parity, false, `edge pseudo-goal parity at scramble ${index}`);
  assertPermutationSolved(corners, `corner DLin at scramble ${index}`);
  assertPermutationSolved(edges, `edge DLin at scramble ${index}`);
  assert.deepEqual(
    sortedState(cycleModel.applyTraceLogToModel(
      scrambling.scrToScrambledStateCor(scramble, ''),
      corners.model,
      corners.trace_log,
    )),
    sortedState(corners.final_state),
    `corner DLin replay at scramble ${index}`,
  );
  assert.deepEqual(
    sortedState(cycleModel.applyTraceLogToModel(edges.relative_state, edges.model, edges.trace_log)),
    sortedState(edges.final_state),
    `edge DLin replay at scramble ${index}`,
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
    corners.total_algs + edges.total_algs <= standard.total_algs,
    `full DLin must not exceed standard tracing at scramble ${index}`,
  );
}

for (const [index, scramble] of scrambles.slice(0, 100).entries()) {
  const partial = ssiCore.analyzeScramble(
    scramble,
    '',
    'pseudoswap',
    1.1,
    1.25,
    true,
    ['UFR', 'FDL'],
    ['UF', 'DL'],
  );
  const partialWeak = ssiCore.analyzeScramble(
    scramble,
    '',
    'weakswap',
    1.1,
    1.25,
    true,
    ['UFR', 'FDL'],
    ['UF', 'DL'],
  );
  const widerPartial = ssiCore.analyzeScramble(
    scramble,
    '',
    'pseudoswap',
    1.1,
    1.25,
    true,
    ['UFR', 'FDL', 'UFL', 'UBR'],
    ['UF', 'DL', 'UR', 'FR'],
  );
  const weightedStandard = ssiCore.analyzeScramble(
    scramble,
    '',
    'pseudoswap',
    1.1,
    1.25,
    true,
    ['UFR'],
    ['UF'],
  );
  const fullWeak = ssiCore.analyzeScramble(
    scramble,
    '',
    'weakswap',
    1.1,
    1.25,
    true,
    'all',
    'all',
  );
  const fullPseudo = ssiCore.analyzeScramble(
    scramble,
    '',
    'pseudoswap',
    1.1,
    1.25,
    true,
    'all',
    'all',
  );
  assert.equal(partial.corner.tracing_model, 'selected-buffer');
  assert.equal(partial.edges.tracing_model, 'selected-buffer');
  assert.ok(Number.isFinite(partial.total_algs), `weighted partial exact plan at scramble ${index}`);
  assert.equal(partialWeak.corner.tracing_model, 'dlin');
  assert.equal(partialWeak.edges.tracing_model, 'dlin');
  assert.ok(
    partial.total_algs <= weightedStandard.total_algs + 1e-12,
    `selected buffers must not increase exact pseudoswap cost at scramble ${index}`,
  );
  assert.ok(
    widerPartial.total_algs <= partial.total_algs + 1e-12,
    `adding partial pseudoswap buffers must not increase cost at scramble ${index}`,
  );
  assert.ok(
    fullPseudo.total_algs <= widerPartial.total_algs + 1e-12,
    `full pseudoswap must not exceed a partial exact plan at scramble ${index}`,
  );
  assert.equal(
    fullWeak.total_algs,
    fullPseudo.total_algs,
    `full weighted minimum must not depend on legacy edge memo order at scramble ${index}`,
  );
}

console.log(`PASS JS cycle model reconstruction and invariants (${scrambles.length} scrambles)`);
console.log('PASS JS cycle model distinguishes the final two-edge swap/flip states');
console.log('PASS JS cycle model exposes sandwich as external BI-ZB versus internal IZ');
console.log('PASS JS DLin planner finds 9 = 4 + 5 and full residue returns 11 = 5 + 6');
console.log('PASS JS DLin planning/replay invariants (1000 scrambles)');
console.log('PASS JS weighted partial exact pseudoswap and unchanged weakswap invariants (100 scrambles)');
