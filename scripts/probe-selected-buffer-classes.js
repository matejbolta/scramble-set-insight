const { performance } = require('perf_hooks');
const {
  CORNER_BUFFER_ORDER,
  EDGE_BUFFER_ORDER,
  buildSelectedBufferClassGraph,
} = require('../tests/helpers/selected-buffer-class-oracle');
const cycleModel = require('../web/cycle-model');
const cycleResiduePlanner = require('../web/cycle-residue-planner');
const cornerTracing = require('../web/corner-tracing');

const kind = process.argv[2];
const selectedCount = Number(process.argv[3]);
const rooted = process.argv[4] === 'rooted';
if (!['edge', 'corner'].includes(kind) || !Number.isInteger(selectedCount)) {
  throw new Error('Usage: node scripts/probe-selected-buffer-classes.js edge|corner selected-count [rooted]');
}
if (rooted && kind !== 'corner') throw new Error('Only corner graphs can be UFR-rooted.');
const order = kind === 'edge' ? EDGE_BUFFER_ORDER : CORNER_BUFFER_ORDER;
if (selectedCount < 1 || selectedCount > order.length) {
  throw new Error(`Selected count must be between 1 and ${order.length}.`);
}
const selectedBuffers = order.slice(0, selectedCount);
const solvedCornerModel = rooted
  ? cycleModel.decomposeCornerState(
      cycleModel.solvedStateFromPieceGroups(cornerTracing.CORNER_PIECE_GROUPS),
    )
  : null;
const seed = rooted
  ? cycleResiduePlanner.buildCornerFinishGoals(solvedCornerModel, 'none')[0].state
  : undefined;
const started = performance.now();
const result = buildSelectedBufferClassGraph(kind, selectedBuffers, {
  maximum_classes: 250000,
  root_primary: rooted,
  seed,
});
console.log(JSON.stringify({
  kind,
  rooted,
  selected_count: selectedCount,
  selected_buffers: selectedBuffers,
  comm_actions: result.comm_action_count,
  classes: result.graph.size,
  edges: [...result.graph.values()].reduce((sum, neighbors) => sum + neighbors.length, 0),
  milliseconds: Number((performance.now() - started).toFixed(1)),
}));
