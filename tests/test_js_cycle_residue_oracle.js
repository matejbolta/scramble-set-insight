const assert = require('assert/strict');
const residue = require('../web/cycle-residue');
const cycleModel = require('../web/cycle-model');
const residuePlanner = require('../web/cycle-residue-planner');
const scrambling = require('../web/scrambling');
const {
  createOracle,
  synthesizeResidueState,
} = require('./helpers/cycle-residue-oracle');

const edgeOracle = createOracle('edge');
for (const atom of residue.EDGE_CLOSED_ATOMS) {
  const state = synthesizeResidueState('edge', atom.residues);
  const result = edgeOracle.solve(state, { minimum_cost: atom.cost, max_cost: atom.cost });
  assert.ok(result, `edge oracle must solve ${atom.residues.join(' ')}`);
  assert.equal(result.cost, atom.cost, `edge oracle cost for ${atom.residues.join(' ')}`);
}

const cornerOracle = createOracle('corner', 'none');
for (const atom of residue.CORNER_CLOSED_ATOMS) {
  const state = synthesizeResidueState('corner', atom.residues);
  const result = cornerOracle.solve(state, { minimum_cost: atom.cost, max_cost: atom.cost });
  assert.ok(result, `corner oracle must solve ${atom.residues.join(' ')}`);
  assert.equal(result.cost, atom.cost, `corner oracle cost for ${atom.residues.join(' ')}`);
}

for (const terminal of residue.CORNER_PARITY_TERMINALS) {
  const state = synthesizeResidueState('corner', terminal.residues, 'in-P');
  const result = cornerOracle.solve(state, { minimum_cost: terminal.cost, max_cost: terminal.cost });
  assert.ok(result, `corner oracle must finish ${terminal.residues.join(' ')}`);
  assert.equal(result.cost, terminal.cost, `corner oracle cost for ${terminal.residues.join(' ')}`);
}

for (const terminal of [['T+', 'P-'], ['T-', 'P+']]) {
  const ltctOracle = createOracle('corner', 'ltct');
  const t2cOracle = createOracle('corner', 't2c');
  const inP = synthesizeResidueState('corner', terminal, 'in-P');
  const isT = synthesizeResidueState('corner', terminal, 'is-T');
  const uninvolved = synthesizeResidueState('corner', terminal, 'uninvolved');
  assert.equal(ltctOracle.solve(inP, { minimum_cost: 1, max_cost: 1 }).cost, 1, `LTCT ${terminal.join(' ')} with UFR in P`);
  assert.equal(ltctOracle.solve(isT, { minimum_cost: 2, max_cost: 2 }).cost, 2, `LTCT ${terminal.join(' ')} with UFR as T`);
  assert.equal(t2cOracle.solve(inP, { minimum_cost: 1, max_cost: 1 }).cost, 1, `T2C includes LTCT for ${terminal.join(' ')}`);
  assert.equal(t2cOracle.solve(isT, { minimum_cost: 1, max_cost: 1 }).cost, 1, `T2C ${terminal.join(' ')} with UFR as T`);
  assert.equal(t2cOracle.solve(uninvolved, { minimum_cost: 2, max_cost: 2 }).cost, 2, `T2C ${terminal.join(' ')} without UFR`);
}

const shortRegression = "R F' U L' Uw'";
const shortCornerState = scrambling.scrToScrambledStateCor(shortRegression, '');
const shortCorner = residuePlanner.planCornerStateByTerminalEnumeration(
  shortCornerState,
  residuePlanner.FULL_CORNER_BUFFERS,
  'none',
);
assert.equal(shortCorner.total_algs, 5, 'short regression corner solution');
assert.equal(shortCorner.finish.type, 'parity');
assert.ok(shortCorner.finish.pieces.permutation.includes('UFR'));
const shortCornerPrefix = cycleModel.stateRelativeToGoal(
  shortCornerState,
  shortCorner.finish.goal_state,
);
assert.equal(
  createOracle('corner', 'none').solve(
    shortCornerPrefix,
    { minimum_cost: 4, max_cost: 4 },
  ).cost,
  4,
  'short regression must reach its UFR parity finish in four ordinary algs',
);
const edgeGoal = residuePlanner.buildParityEdgeGoal(true, cycleModel.EDGE_PIECE_GROUPS);
const shortRelativeEdges = cycleModel.stateRelativeToGoal(
  scrambling.scrToScrambledStateEdg(shortRegression, ''),
  edgeGoal,
);
const shortEdges = createOracle('edge').solve(
  shortRelativeEdges,
  { minimum_cost: 6, max_cost: 6 },
);
assert.equal(shortEdges.cost, 6, 'short regression concrete parity-relative edge solution');

console.log('PASS concrete edge oracle reproduces all four unit-cost atoms');
console.log('PASS concrete corner oracle reproduces all 15 closed atoms and seven parity terminals');
console.log('PASS concrete LTCT/T2C oracle respects every UFR role');
console.log('PASS concrete short regression realizes 11 = 5 + 6 with an explicit UFR parity finish');
