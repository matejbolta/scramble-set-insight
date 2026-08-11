const cornerTracing = require('../../web/corner-tracing');
const cycleModel = require('../../web/cycle-model');

const CORNER_BUFFER_ORDER = Object.freeze(['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL']);
const EDGE_BUFFER_ORDER = Object.freeze(['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL']);
const graphCache = new Map();
const frontierCache = new Map();
const commActionCache = new Map();

function pieceGroups(kind) {
  return kind === 'corner' ? cornerTracing.CORNER_PIECE_GROUPS : cycleModel.EDGE_PIECE_GROUPS;
}

function decompose(kind, state) {
  return kind === 'corner'
    ? cycleModel.decomposeCornerState(state)
    : cycleModel.decomposeEdgeState(state);
}

function canonicalPiece(model, sticker) {
  return cycleModel.pieceGroupForSticker(model, sticker)[0];
}

function minimumRotation(values) {
  if (values.length < 2) return values.join('');
  let best = null;
  for (let offset = 0; offset < values.length; offset += 1) {
    const candidate = values.slice(offset).concat(values.slice(0, offset)).join('');
    if (best === null || candidate < best) best = candidate;
  }
  return best;
}

function selectedBufferClassKey(kind, state, selectedBuffers, options = {}) {
  const model = decompose(kind, state);
  const selectedPieces = new Set(selectedBuffers.map((buffer) => canonicalPiece(model, buffer)));
  const excludedCount = model.piece_groups.length - selectedPieces.size;
  const rootPrimary = Boolean(options.root_primary);
  const primaryPiece = rootPrimary ? canonicalPiece(model, options.primary || 'UFR') : null;
  const bufferColorMatters = excludedCount >= 3;

  const records = model.cycles.filter((cycle) => (
    cycle.active || cycle.slots.includes(primaryPiece)
  )).map((cycle) => {
    const colors = cycle.slots.map((slot) => {
      if (slot === primaryPiece) return 'P';
      if (!bufferColorMatters) return 'X';
      return selectedPieces.has(slot) ? 'B' : 'N';
    });
    return `${minimumRotation(colors)}:${cycle.length}:${cycle.orientation_sum}`;
  });
  records.sort();
  return records.join('|') || 'solved';
}

function stateKey(state) {
  return Object.keys(state).sort().map((key) => state[key]).join(',');
}

function selectedCommActions(kind, selectedBuffers) {
  const groups = pieceGroups(kind);
  const solved = cycleModel.solvedStateFromPieceGroups(groups);
  return uniqueSelectedCommActions(kind, selectedBuffers, solved, decompose(kind, solved));
}

function compactMetadata(kind) {
  const groups = pieceGroups(kind);
  return {
    groups,
    modulus: groups[0].length,
    pieceIndex: new Map(groups.flatMap((group, index) => (
      group.map((sticker) => [sticker, index])
    ))),
  };
}

function compactFromState(kind, state, metadata = compactMetadata(kind)) {
  const pieces = [];
  const orientations = [];
  for (const group of metadata.groups) {
    const sticker = state[group[0]];
    const piece = metadata.pieceIndex.get(sticker);
    if (piece === undefined) throw new Error(`Unknown ${kind} sticker: ${sticker}`);
    pieces.push(piece);
    orientations.push(metadata.groups[piece].indexOf(sticker));
  }
  return { pieces, orientations };
}

function stateFromCompact(kind, compact, metadata = compactMetadata(kind)) {
  const state = {};
  for (let slot = 0; slot < metadata.groups.length; slot += 1) {
    const slotGroup = metadata.groups[slot];
    const placedGroup = metadata.groups[compact.pieces[slot]];
    const orientation = compact.orientations[slot];
    for (let offset = 0; offset < slotGroup.length; offset += 1) {
      state[slotGroup[offset]] = placedGroup[(orientation + offset) % metadata.modulus];
    }
  }
  return state;
}

function compactClassKey(compact, selectedIndices, metadata, options = {}) {
  const selected = new Set(selectedIndices);
  const bufferColorMatters = metadata.groups.length - selected.size >= 3;
  const rootPrimary = Boolean(options.root_primary);
  const primaryIndex = rootPrimary ? 0 : -1;
  const visited = new Set();
  const records = [];

  for (let start = 0; start < compact.pieces.length; start += 1) {
    if (visited.has(start)) continue;
    const slots = [];
    let current = start;
    while (!visited.has(current)) {
      visited.add(current);
      slots.push(current);
      current = compact.pieces[current];
    }
    if (current !== start) throw new Error(`Compact ${options.kind || 'piece'} cycle did not close.`);
    const orientationSum = slots.reduce(
      (sum, slot) => sum + compact.orientations[slot],
      0,
    ) % metadata.modulus;
    const active = slots.length > 1 || orientationSum !== 0 || slots.includes(primaryIndex);
    if (!active) continue;
    const colors = slots.map((slot) => {
      if (slot === primaryIndex) return 'P';
      if (!bufferColorMatters) return 'X';
      return selected.has(slot) ? 'B' : 'N';
    });
    records.push(`${minimumRotation(colors)}:${slots.length}:${orientationSum}`);
  }
  records.sort();
  return records.join('|') || 'solved';
}

function applyCompactGenerator(state, generator, modulus) {
  const pieces = new Array(state.pieces.length);
  const orientations = new Array(state.orientations.length);
  for (let slot = 0; slot < pieces.length; slot += 1) {
    const source = generator.pieces[slot];
    pieces[slot] = state.pieces[source];
    orientations[slot] = (
      state.orientations[source] + generator.orientations[slot]
    ) % modulus;
  }
  return { pieces, orientations };
}

function uniqueSelectedCommActions(kind, selectedBuffers, solved, model) {
  const cacheKey = `${kind}|${selectedBuffers.join(',')}`;
  if (commActionCache.has(cacheKey)) return commActionCache.get(cacheKey);
  const groups = pieceGroups(kind);
  const stickers = groups.flat();
  const seen = new Set();
  const actions = [];
  for (const buffer of selectedBuffers) {
    const bufferPiece = canonicalPiece(model, buffer);
    for (const first of stickers) {
      const firstPiece = canonicalPiece(model, first);
      if (firstPiece === bufferPiece) continue;
      for (const second of stickers) {
        const secondPiece = canonicalPiece(model, second);
        if (secondPiece === bufferPiece || secondPiece === firstPiece) continue;
        const traceLog = [[buffer, first], [buffer, second]];
        const generatorKey = stateKey(cycleModel.applyTraceLogToModel(solved, model, traceLog));
        if (seen.has(generatorKey)) continue;
        seen.add(generatorKey);
        actions.push({
          type: 'comm',
          buffer,
          targets: [first, second],
          apply(state) {
            return cycleModel.applyTraceLogToModel(state, model, traceLog);
          },
        });
      }
    }
  }
  commActionCache.set(cacheKey, actions);
  return actions;
}

function setPlacement(state, group, orientation) {
  for (let offset = 0; offset < group.length; offset += 1) {
    state[group[offset]] = group[(orientation + offset) % group.length];
  }
}

function selectedOrientationActions(kind, state, groups = pieceGroups(kind)) {
  const fixed = groups.filter((group) => group.includes(state[group[0]]));
  const neighbors = [];
  for (let left = 0; left < fixed.length; left += 1) {
    for (let right = left + 1; right < fixed.length; right += 1) {
      const deltas = kind === 'edge' ? [[1, 1]] : [[1, 2], [2, 1]];
      for (const [leftDelta, rightDelta] of deltas) {
        const next = { ...state };
        const leftOrientation = fixed[left].indexOf(state[fixed[left][0]]);
        const rightOrientation = fixed[right].indexOf(state[fixed[right][0]]);
        setPlacement(next, fixed[left], leftOrientation + leftDelta);
        setPlacement(next, fixed[right], rightOrientation + rightDelta);
        neighbors.push({
          type: kind === 'edge' ? '2-flip' : '2-twist',
          pieces: [fixed[left][0], fixed[right][0]],
          apply() {
            return next;
          },
        });
      }
    }
  }
  return neighbors;
}

function buildSelectedBufferClassGraph(kind, selectedBuffers, options = {}) {
  const cacheKey = [
    kind,
    selectedBuffers.join(','),
    options.root_primary ? 'rooted' : 'ordinary',
  ].join('|');
  if (graphCache.has(cacheKey)) return graphCache.get(cacheKey);
  const metadata = compactMetadata(kind);
  const groups = metadata.groups;
  const solved = cycleModel.solvedStateFromPieceGroups(groups);
  const model = decompose(kind, solved);
  const commActions = uniqueSelectedCommActions(kind, selectedBuffers, solved, model);
  const selectedIndices = selectedBuffers.map((buffer) => metadata.pieceIndex.get(buffer));
  const commGenerators = commActions.map((action) => compactFromState(
    kind,
    action.apply(solved),
    metadata,
  ));
  const keyFor = (state) => compactClassKey(
    state,
    selectedIndices,
    metadata,
    { ...options, kind },
  );
  const seed = compactFromState(kind, options.seed || solved, metadata);
  const seedKey = keyFor(seed);
  const representatives = new Map([[seedKey, seed]]);
  const graph = new Map();
  const queue = [seedKey];
  const maximumClasses = options.maximum_classes ?? Infinity;

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const key = queue[cursor];
    const state = representatives.get(key);
    const neighbors = new Map();

    function addNeighbor(next, permutationAlgs, orientationAlgs) {
      const nextKey = keyFor(next);
      const costKey = `${nextKey}|${permutationAlgs},${orientationAlgs}`;
      if (!neighbors.has(costKey)) {
        neighbors.set(costKey, {
          key: nextKey,
          permutation_algs: permutationAlgs,
          orientation_algs: orientationAlgs,
        });
      }
      if (!representatives.has(nextKey)) {
        if (representatives.size >= maximumClasses) {
          throw new Error(`Selected-buffer class graph exceeded ${maximumClasses} classes.`);
        }
        representatives.set(nextKey, next);
        queue.push(nextKey);
      }
    }

    for (const generator of commGenerators) {
      addNeighbor(applyCompactGenerator(state, generator, metadata.modulus), 1, 0);
    }
    const fixed = [];
    for (let piece = 0; piece < state.pieces.length; piece += 1) {
      if (state.pieces[piece] === piece) fixed.push(piece);
    }
    for (let left = 0; left < fixed.length; left += 1) {
      for (let right = left + 1; right < fixed.length; right += 1) {
        const deltas = kind === 'edge' ? [[1, 1]] : [[1, 2], [2, 1]];
        for (const [leftDelta, rightDelta] of deltas) {
          const next = {
            pieces: [...state.pieces],
            orientations: [...state.orientations],
          };
          next.orientations[fixed[left]] = (
            next.orientations[fixed[left]] + leftDelta
          ) % metadata.modulus;
          next.orientations[fixed[right]] = (
            next.orientations[fixed[right]] + rightDelta
          ) % metadata.modulus;
          addNeighbor(next, 0, 1);
        }
      }
    }
    graph.set(key, [...neighbors.values()]);
  }

  const result = {
    comm_action_count: commActions.length,
    graph,
    representatives,
    seed_key: seedKey,
  };
  graphCache.set(cacheKey, result);
  return result;
}

function prunePareto(labels) {
  const unique = new Map();
  for (const label of labels) {
    const key = `${label.permutation_algs},${label.orientation_algs}`;
    const previous = unique.get(key);
    const rank = { parity: 0, ltct: 1, t2c: 2 };
    if (
      !previous
      || (label.finish && rank[label.finish.type] < rank[previous.finish?.type])
    ) unique.set(key, label);
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

function sameFrontier(left, right) {
  return left.length === right.length && left.every((label, index) => (
    label.permutation_algs === right[index].permutation_algs
    && label.orientation_algs === right[index].orientation_algs
    && label.finish?.type === right[index].finish?.type
  ));
}

function propagateFrontiers(graph, seeds) {
  const frontiers = new Map([...graph.keys()].map((key) => [key, []]));
  for (const [key, labels] of seeds) {
    frontiers.set(key, prunePareto([...(frontiers.get(key) || []), ...labels]));
  }
  const queue = [...seeds.keys()];
  const queued = new Set(queue);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const key = queue[cursor];
    queued.delete(key);
    const source = frontiers.get(key);
    for (const edge of graph.get(key)) {
      const translated = source.map((label) => ({
        ...label,
        permutation_algs: label.permutation_algs + edge.permutation_algs,
        orientation_algs: label.orientation_algs + edge.orientation_algs,
      }));
      const previous = frontiers.get(edge.key);
      const next = prunePareto([...previous, ...translated]);
      if (sameFrontier(previous, next)) continue;
      frontiers.set(edge.key, next);
      if (!queued.has(edge.key)) {
        queue.push(edge.key);
        queued.add(edge.key);
      }
    }
  }
  return frontiers;
}

function exactSelectedBufferFrontiers(kind, selectedBuffers, finishMode = 'none') {
  const rooted = kind === 'corner' && finishMode !== 'even-permutation';
  const normalizedFinishMode = rooted ? finishMode : 'even-permutation';
  const cacheKey = `${kind}|${selectedBuffers.join(',')}|${normalizedFinishMode}`;
  if (frontierCache.has(cacheKey)) return frontierCache.get(cacheKey);

  let graphResult;
  let seeds;
  if (!rooted) {
    graphResult = buildSelectedBufferClassGraph(kind, selectedBuffers);
    seeds = new Map([[graphResult.seed_key, [{
      permutation_algs: 0,
      orientation_algs: 0,
    }]]]);
  } else {
    const cycleResiduePlanner = require('../../web/cycle-residue-planner');
    const groups = pieceGroups('corner');
    const solved = cycleModel.solvedStateFromPieceGroups(groups);
    const solvedModel = decompose('corner', solved);
    const goals = cycleResiduePlanner.buildCornerFinishGoals(solvedModel, finishMode);
    graphResult = buildSelectedBufferClassGraph('corner', selectedBuffers, {
      root_primary: true,
      seed: goals[0].state,
    });
    seeds = new Map();
    for (const goal of goals) {
      const key = selectedBufferClassKey('corner', goal.state, selectedBuffers, {
        root_primary: true,
      });
      if (!seeds.has(key)) seeds.set(key, []);
      seeds.get(key).push({
        permutation_algs: 1,
        orientation_algs: 0,
        finish: { type: goal.type, primary_role: goal.primary_role },
      });
    }
  }

  const result = {
    ...graphResult,
    finish_mode: normalizedFinishMode,
    frontiers: propagateFrontiers(graphResult.graph, seeds),
  };
  frontierCache.set(cacheKey, result);
  return result;
}

function solveSelectedBufferState(
  kind,
  initialState,
  selectedBuffers,
  capability = 'none',
  orientationWeight = 1,
) {
  const initialModel = decompose(kind, initialState);
  const rooted = kind === 'corner' && Boolean(initialModel.permutation_parity);
  if (kind === 'edge' && initialModel.permutation_parity) {
    throw new Error('Selected-buffer edge solving requires an even parity-relative state.');
  }
  const exact = exactSelectedBufferFrontiers(
    kind,
    selectedBuffers,
    rooted ? capability : 'even-permutation',
  );
  const keyOptions = rooted ? { root_primary: true } : {};
  const goals = rooted
    ? require('../../web/cycle-residue-planner').buildCornerFinishGoals(
        decompose(
          'corner',
          cycleModel.solvedStateFromPieceGroups(pieceGroups('corner')),
        ),
        capability,
      )
    : [];
  const goalByState = new Map(goals.map((goal) => [stateKey(goal.state), goal]));
  const commActions = selectedCommActions(kind, selectedBuffers);
  let state = { ...initialState };
  const steps = [];
  let overallPlan = null;

  for (let depth = 0; depth < 32; depth += 1) {
    const key = selectedBufferClassKey(kind, state, selectedBuffers, keyOptions);
    const frontier = exact.frontiers.get(key);
    if (!frontier?.length) throw new Error(`Missing selected-buffer frontier for ${key}.`);
    const plan = require('../../web/cycle-residue').selectWeightedPlan(
      frontier,
      orientationWeight,
    );
    if (!overallPlan) overallPlan = plan;

    if (plan.permutation_algs === 0 && plan.orientation_algs === 0) {
      return { complete: true, final_state: state, plan: overallPlan, steps };
    }
    if (rooted && plan.permutation_algs === 1 && plan.orientation_algs === 0) {
      const goal = goalByState.get(stateKey(state));
      if (!goal) {
        throw new Error(`Rooted class ${key} reached cost one without a concrete finish state.`);
      }
      steps.push({
        type: goal.type,
        primary_role: goal.primary_role,
        cost: 1,
      });
      return { complete: true, final_state: state, plan: overallPlan, steps, finish: goal };
    }

    const candidates = [];
    if (plan.orientation_algs > 0) {
      candidates.push(...selectedOrientationActions(kind, state).map((action) => ({
        action,
        next: action.apply(state),
        target_permutation_algs: plan.permutation_algs,
        target_orientation_algs: plan.orientation_algs - 1,
      })));
    }
    if (plan.permutation_algs > (rooted ? 1 : 0)) {
      candidates.push(...commActions.map((action) => ({
        action,
        next: action.apply(state),
        target_permutation_algs: plan.permutation_algs - 1,
        target_orientation_algs: plan.orientation_algs,
      })));
    }

    let selected = null;
    for (const candidate of candidates) {
      const nextKey = selectedBufferClassKey(kind, candidate.next, selectedBuffers, keyOptions);
      const nextFrontier = exact.frontiers.get(nextKey) || [];
      if (nextFrontier.some((label) => (
        label.permutation_algs === candidate.target_permutation_algs
        && label.orientation_algs === candidate.target_orientation_algs
      ))) {
        selected = candidate;
        break;
      }
    }
    if (!selected) throw new Error(`Could not lift selected-buffer class path from ${key}.`);
    steps.push({
      type: selected.action.type,
      ...(selected.action.buffer ? {
        buffer: selected.action.buffer,
        targets: [...selected.action.targets],
      } : {}),
      ...(selected.action.pieces ? { pieces: [...selected.action.pieces] } : {}),
    });
    state = selected.next;
  }
  throw new Error('Selected-buffer concrete path exceeded 32 steps.');
}

function clearSelectedBufferOracleCaches() {
  graphCache.clear();
  frontierCache.clear();
  commActionCache.clear();
}

module.exports = {
  CORNER_BUFFER_ORDER,
  EDGE_BUFFER_ORDER,
  buildSelectedBufferClassGraph,
  clearSelectedBufferOracleCaches,
  exactSelectedBufferFrontiers,
  selectedCommActions,
  selectedOrientationActions,
  selectedBufferClassKey,
  solveSelectedBufferState,
  stateFromCompact,
  uniqueSelectedCommActions,
};
