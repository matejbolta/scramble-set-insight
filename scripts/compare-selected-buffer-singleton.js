const fs = require('fs');
const path = require('path');
const cycleModel = require('../web/cycle-model');
const cycleResidue = require('../web/cycle-residue');
const cycleResiduePlanner = require('../web/cycle-residue-planner');
const scrambling = require('../web/scrambling');
const ssiCore = require('../web/ssi-core');
const {
  exactSelectedBufferFrontiers,
  selectedBufferClassKey,
} = require('../tests/helpers/selected-buffer-class-oracle');

const root = path.join(__dirname, '..');
const scrambles = fs.readFileSync(
  path.join(root, 'baseline', 'testing-10k-scrams.txt'),
  'utf8',
).trim().split(/\r?\n/);

const evenCorners = exactSelectedBufferFrontiers('corner', ['UFR'], 'even');
const oddCorners = exactSelectedBufferFrontiers('corner', ['UFR'], 'none');
const evenEdges = exactSelectedBufferFrontiers('edge', ['UF'], 'even');
const differences = new Map();
const examples = [];

function selectedCost(frontiers, key) {
  const frontier = frontiers.frontiers.get(key);
  if (!frontier?.length) throw new Error(`No selected-buffer frontier for ${key}.`);
  return cycleResidue.selectWeightedPlan(frontier, 1).cost;
}

for (const [index, scramble] of scrambles.entries()) {
  const cornerState = scrambling.scrToScrambledStateCor(scramble, '');
  const cornerModel = cycleModel.decomposeCornerState(cornerState);
  const cornerKey = selectedBufferClassKey('corner', cornerState, ['UFR'], {
    root_primary: Boolean(cornerModel.permutation_parity),
  });
  const cornerAlgs = selectedCost(
    cornerModel.permutation_parity ? oddCorners : evenCorners,
    cornerKey,
  );

  const edgeState = scrambling.scrToScrambledStateEdg(scramble, '');
  const edgeGoal = cycleResiduePlanner.buildParityEdgeGoal(
    cornerModel.permutation_parity,
    cycleModel.EDGE_PIECE_GROUPS,
  );
  const relativeEdgeState = cycleModel.stateRelativeToGoal(edgeState, edgeGoal);
  const edgeKey = selectedBufferClassKey('edge', relativeEdgeState, ['UF']);
  const edgeAlgs = selectedCost(evenEdges, edgeKey);
  const exactTotal = cornerAlgs + edgeAlgs;

  const production = ssiCore.analyzeScramble(
    scramble,
    '',
    'pseudoswap',
    1,
    1,
    false,
    ['UFR'],
    ['UF'],
  );
  const delta = exactTotal - production.total_algs;
  differences.set(delta, (differences.get(delta) || 0) + 1);
  if (delta !== 0 && examples.length < 20) {
    examples.push({
      number: index + 1,
      scramble,
      production: [production.total_algs, production.corner_algs, production.edge_algs],
      exact: [exactTotal, cornerAlgs, edgeAlgs],
      delta,
    });
  }
}

console.log(JSON.stringify({
  classes: {
    even_corners: evenCorners.graph.size,
    odd_corners: oddCorners.graph.size,
    even_edges: evenEdges.graph.size,
  },
  exact_minus_production: Object.fromEntries([...differences].sort(([left], [right]) => left - right)),
  examples,
}, null, 2));
