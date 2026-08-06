const cycleModel = require('../../web/cycle-model');
const {
  buildThreeCycleActions,
  pieceGroups,
} = require('./cycle-residue-oracle');

const exactCache = new Map();
let rootedCornerGraphCache = null;
const rootedCornerFrontierCache = new Map();

function stateKey(state) {
  return Object.keys(state).sort().map((key) => state[key]).join(',');
}

function decompose(kind, state) {
  return kind === 'corner'
    ? cycleModel.decomposeCornerState(state)
    : cycleModel.decomposeEdgeState(state);
}

function classKey(kind, state) {
  const model = decompose(kind, state);
  return model.active_cycles
    .map((cycle) => `${cycle.length}:${cycle.orientation_sum}`)
    .sort()
    .join('|') || 'solved';
}

function rootedCornerClassKey(state) {
  const model = cycleModel.decomposeCornerState(state);
  const primary = model.cycles.find((cycle) => cycle.slots.includes('UFR'));
  if (!primary) throw new Error('Corner state has no UFR cycle.');
  const others = model.active_cycles
    .filter((cycle) => cycle !== primary)
    .map((cycle) => `${cycle.length}:${cycle.orientation_sum}`)
    .sort();
  return [`*${primary.length}:${primary.orientation_sum}`, ...others].join('|');
}

function setPlacement(state, group, orientation) {
  for (let offset = 0; offset < group.length; offset += 1) {
    state[group[offset]] = group[(orientation + offset) % group.length];
  }
}

function orientationNeighbors(kind, state) {
  const groups = pieceGroups(kind);
  const fixed = groups.filter((group) => group.includes(state[group[0]]));
  const nextStates = [];
  for (let left = 0; left < fixed.length; left += 1) {
    for (let right = left + 1; right < fixed.length; right += 1) {
      const deltas = kind === 'edge' ? [[1, 1]] : [[1, 2], [2, 1]];
      for (const [leftDelta, rightDelta] of deltas) {
        const next = { ...state };
        const leftOrientation = fixed[left].indexOf(state[fixed[left][0]]);
        const rightOrientation = fixed[right].indexOf(state[fixed[right][0]]);
        setPlacement(next, fixed[left], leftOrientation + leftDelta);
        setPlacement(next, fixed[right], rightOrientation + rightDelta);
        nextStates.push(next);
      }
    }
  }
  return nextStates;
}

function uniqueCommActions(kind, solved, model) {
  const seen = new Set();
  const actions = [];
  for (const action of buildThreeCycleActions(kind, model)) {
    const key = stateKey(action.apply(solved));
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push(action);
  }
  return actions;
}

function buildClassGraph(kind) {
  const solved = cycleModel.solvedStateFromPieceGroups(pieceGroups(kind));
  const solvedKey = classKey(kind, solved);
  const commActions = uniqueCommActions(kind, solved, decompose(kind, solved));
  const representatives = new Map([[solvedKey, solved]]);
  const graph = new Map();
  const queue = [solvedKey];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const key = queue[cursor];
    const state = representatives.get(key);
    const neighbors = new Map();

    function addNeighbor(next, permutationAlgs, orientationAlgs) {
      const nextKey = classKey(kind, next);
      const costKey = `${nextKey}|${permutationAlgs},${orientationAlgs}`;
      if (!neighbors.has(costKey)) {
        neighbors.set(costKey, { key: nextKey, permutation_algs: permutationAlgs, orientation_algs: orientationAlgs });
      }
      if (!representatives.has(nextKey)) {
        representatives.set(nextKey, next);
        queue.push(nextKey);
      }
    }

    for (const action of commActions) addNeighbor(action.apply(state), 1, 0);
    for (const next of orientationNeighbors(kind, state)) addNeighbor(next, 0, 1);
    graph.set(key, [...neighbors.values()]);
  }

  return { solved_key: solvedKey, graph, representatives };
}

function buildRootedCornerGraph() {
  if (rootedCornerGraphCache) return rootedCornerGraphCache;
  const planner = require('../../web/cycle-residue-planner');
  const groups = pieceGroups('corner');
  const solved = cycleModel.solvedStateFromPieceGroups(groups);
  const solvedModel = cycleModel.decomposeCornerState(solved);
  const seed = planner.buildCornerFinishGoals(solvedModel, 'none')[0].state;
  const seedKey = rootedCornerClassKey(seed);
  const commActions = uniqueCommActions('corner', solved, solvedModel);
  const representatives = new Map([[seedKey, seed]]);
  const graph = new Map();
  const queue = [seedKey];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const key = queue[cursor];
    const state = representatives.get(key);
    const neighbors = new Map();

    function addNeighbor(next, permutationAlgs, orientationAlgs) {
      const nextKey = rootedCornerClassKey(next);
      const costKey = `${nextKey}|${permutationAlgs},${orientationAlgs}`;
      if (!neighbors.has(costKey)) {
        neighbors.set(costKey, { key: nextKey, permutation_algs: permutationAlgs, orientation_algs: orientationAlgs });
      }
      if (!representatives.has(nextKey)) {
        representatives.set(nextKey, next);
        queue.push(nextKey);
      }
    }

    for (const action of commActions) addNeighbor(action.apply(state), 1, 0);
    for (const next of orientationNeighbors('corner', state)) addNeighbor(next, 0, 1);
    graph.set(key, [...neighbors.values()]);
  }

  rootedCornerGraphCache = { graph, representatives, solved_model: solvedModel };
  return rootedCornerGraphCache;
}

function prune(vectors) {
  const unique = new Map(vectors.map((vector) => [
    `${vector.permutation_algs},${vector.orientation_algs}`,
    vector,
  ]));
  const candidates = [...unique.values()];
  return candidates.filter((candidate, index) => !candidates.some((other, otherIndex) => (
    otherIndex !== index
    && other.permutation_algs <= candidate.permutation_algs
    && other.orientation_algs <= candidate.orientation_algs
    && (
      other.permutation_algs < candidate.permutation_algs
      || other.orientation_algs < candidate.orientation_algs
    )
  ))).sort((left, right) => (
    left.permutation_algs - right.permutation_algs
    || left.orientation_algs - right.orientation_algs
  ));
}

function sameFrontier(left, right) {
  return left.length === right.length && left.every((vector, index) => (
    vector.permutation_algs === right[index].permutation_algs
    && vector.orientation_algs === right[index].orientation_algs
  ));
}

function finishRank(type) {
  if (type === 'parity') return 0;
  if (type === 'ltct') return 1;
  return 2;
}

function pruneFinishLabels(labels) {
  const unique = new Map();
  for (const label of labels) {
    const key = `${label.permutation_algs},${label.orientation_algs}`;
    const previous = unique.get(key);
    if (!previous || finishRank(label.finish.type) < finishRank(previous.finish.type)) {
      unique.set(key, label);
    }
  }
  const candidates = [...unique.values()];
  return candidates.filter((candidate, index) => !candidates.some((other, otherIndex) => (
    otherIndex !== index
    && other.permutation_algs <= candidate.permutation_algs
    && other.orientation_algs <= candidate.orientation_algs
    && (
      other.permutation_algs < candidate.permutation_algs
      || other.orientation_algs < candidate.orientation_algs
    )
  ))).sort((left, right) => (
    left.permutation_algs - right.permutation_algs
    || left.orientation_algs - right.orientation_algs
  ));
}

function sameFinishFrontier(left, right) {
  return left.length === right.length && left.every((label, index) => (
    label.permutation_algs === right[index].permutation_algs
    && label.orientation_algs === right[index].orientation_algs
    && label.finish.type === right[index].finish.type
    && label.finish.primary_role === right[index].finish.primary_role
  ));
}

function exactWeightedClassFrontiers(kind) {
  if (exactCache.has(kind)) return exactCache.get(kind);
  const built = buildClassGraph(kind);
  const frontiers = new Map([...built.graph.keys()].map((key) => [key, []]));
  frontiers.set(built.solved_key, [{ permutation_algs: 0, orientation_algs: 0 }]);
  const queue = [built.solved_key];
  const queued = new Set(queue);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const key = queue[cursor];
    queued.delete(key);
    const source = frontiers.get(key);
    for (const edge of built.graph.get(key)) {
      const translated = source.map((vector) => ({
        permutation_algs: vector.permutation_algs + edge.permutation_algs,
        orientation_algs: vector.orientation_algs + edge.orientation_algs,
      }));
      const previous = frontiers.get(edge.key);
      const next = prune([...previous, ...translated]);
      if (sameFrontier(previous, next)) continue;
      frontiers.set(edge.key, next);
      if (!queued.has(edge.key)) {
        queue.push(edge.key);
        queued.add(edge.key);
      }
    }
  }

  const result = { ...built, frontiers };
  exactCache.set(kind, result);
  return result;
}

function exactRootedCornerFinishFrontiers(capability) {
  if (rootedCornerFrontierCache.has(capability)) {
    return rootedCornerFrontierCache.get(capability);
  }
  const planner = require('../../web/cycle-residue-planner');
  const built = buildRootedCornerGraph();
  const frontiers = new Map([...built.graph.keys()].map((key) => [key, []]));
  for (const goal of planner.buildCornerFinishGoals(built.solved_model, capability)) {
    const key = rootedCornerClassKey(goal.state);
    const seeded = pruneFinishLabels([
      ...frontiers.get(key),
      {
        permutation_algs: 1,
        orientation_algs: 0,
        finish: { type: goal.type, primary_role: goal.primary_role },
      },
    ]);
    frontiers.set(key, seeded);
  }

  const queue = [...frontiers].filter(([, labels]) => labels.length).map(([key]) => key);
  const queued = new Set(queue);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const key = queue[cursor];
    queued.delete(key);
    const source = frontiers.get(key);
    for (const edge of built.graph.get(key)) {
      const translated = source.map((label) => ({
        permutation_algs: label.permutation_algs + edge.permutation_algs,
        orientation_algs: label.orientation_algs + edge.orientation_algs,
        finish: label.finish,
      }));
      const previous = frontiers.get(edge.key);
      const next = pruneFinishLabels([...previous, ...translated]);
      if (sameFinishFrontier(previous, next)) continue;
      frontiers.set(edge.key, next);
      if (!queued.has(edge.key)) {
        queue.push(edge.key);
        queued.add(edge.key);
      }
    }
  }

  const result = { ...built, frontiers };
  rootedCornerFrontierCache.set(capability, result);
  return result;
}

module.exports = {
  classKey,
  exactRootedCornerFinishFrontiers,
  exactWeightedClassFrontiers,
  rootedCornerClassKey,
};
