const cornerTracing = require('../../web/corner-tracing');
const cycleModel = require('../../web/cycle-model');
const residue = require('../../web/cycle-residue');

const CORNER_BUFFERS = ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL'];
const EDGE_BUFFERS = ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'];

function pieceGroups(kind) {
  return kind === 'corner' ? cornerTracing.CORNER_PIECE_GROUPS : cycleModel.EDGE_PIECE_GROUPS;
}

function selectedBuffers(kind) {
  return kind === 'corner' ? CORNER_BUFFERS : EDGE_BUFFERS;
}

function solvedState(kind) {
  return cycleModel.solvedStateFromPieceGroups(pieceGroups(kind));
}

function setPlacement(state, slotGroup, placedPieceGroup, orientation) {
  for (let offset = 0; offset < slotGroup.length; offset += 1) {
    state[slotGroup[offset]] = placedPieceGroup[(orientation + offset) % slotGroup.length];
  }
}

function chargeForType(type) {
  if (type === 'F' || type === 'PF' || type === 'T+' || type === 'P+') return 1;
  if (type === 'T-' || type === 'P-') return 2;
  return 0;
}

function isPermutationResidue(type) {
  return type === 'P' || type === 'PF' || type === 'P0' || type === 'P+' || type === 'P-';
}

function synthesizeResidueState(kind, residueTypes, primaryRole = null, primaryType = null) {
  const groups = pieceGroups(kind).map((group) => [...group]);
  const state = solvedState(kind);
  const records = residueTypes.map((type, index) => ({ type, index, groups: [] }));
  const reserved = new Set();

  if (kind === 'corner' && primaryRole && primaryRole !== 'uninvolved') {
    const primary = groups.find((group) => group[0] === 'UFR');
    const record = records.find((candidate) => (
      (!primaryType || candidate.type === primaryType)
      && (primaryRole === 'in-P' ? isPermutationResidue(candidate.type) : candidate.type.startsWith('T'))
    ));
    if (!record) throw new Error(`Cannot assign UFR role ${primaryRole} in ${residueTypes.join(' ')}.`);
    record.groups.push(primary);
    reserved.add(primary[0]);
  } else if (kind === 'corner' && primaryRole === 'uninvolved') {
    reserved.add('UFR');
  }

  const available = groups.filter((group) => !reserved.has(group[0]));
  for (const record of records) {
    const needed = isPermutationResidue(record.type) ? 2 : 1;
    while (record.groups.length < needed) {
      const group = available.shift();
      if (!group) throw new Error(`Not enough ${kind} pieces for ${residueTypes.join(' ')}.`);
      record.groups.push(group);
    }
  }

  for (const record of records) {
    const charge = chargeForType(record.type);
    if (record.groups.length === 1) {
      setPlacement(state, record.groups[0], record.groups[0], charge);
    } else {
      const [left, right] = record.groups;
      setPlacement(state, left, right, charge);
      setPlacement(state, right, left, 0);
    }
  }
  return state;
}

function stateKey(state, keys) {
  return keys.map((key) => state[key]).join(',');
}

function unresolvedPieceCount(state, groups) {
  return groups.filter((group) => state[group[0]] !== group[0]).length;
}

function activeCycleCount(kind, state) {
  const model = kind === 'corner'
    ? cycleModel.decomposeCornerState(state)
    : cycleModel.decomposeEdgeState(state);
  return model.active_cycles.length;
}

function terminalDetails(kind, state, capability) {
  if (kind !== 'corner') return null;
  const model = cycleModel.decomposeCornerState(state);
  const reduced = residue.reduceCycleModelToResidues(model, CORNER_BUFFERS);
  if (reduced.base_algs !== 0) return null;
  const types = reduced.residue_types;
  if (residue.multisetKey('corner', types) === 'P0') {
    const permutation = reduced.residues[0];
    if (!permutation.slots?.includes('UFR')) return null;
    return { cost: 1, type: 'parity', primary_role: 'in-P' };
  }
  const key = residue.multisetKey('corner', types);
  if (key !== 'T+ P-' && key !== 'T- P+') return null;
  const permutation = reduced.residues.find((record) => record.type.startsWith('P'));
  const twist = reduced.residues.find((record) => record.type.startsWith('T'));
  let primaryRole = residue.PRIMARY_ROLE.UNINVOLVED;
  if (permutation.slots?.includes('UFR')) primaryRole = residue.PRIMARY_ROLE.IN_P;
  else if (twist.slots?.includes('UFR')) primaryRole = residue.PRIMARY_ROLE.IS_T;
  const cost = residue.cornerParityTerminalCost(types, capability, primaryRole);
  if (cost !== 1) return null;
  return { cost, type: primaryRole === 'is-T' ? 't2c' : 'ltct', primary_role: primaryRole };
}

function buildThreeCycleActions(kind, model) {
  const groups = pieceGroups(kind);
  const bySticker = new Map(groups.flatMap((group) => group.map((sticker) => [sticker, group[0]])));
  const stickers = groups.flat();
  const actions = [];
  for (const buffer of selectedBuffers(kind)) {
    const bufferPiece = bySticker.get(buffer);
    for (const first of stickers) {
      const firstPiece = bySticker.get(first);
      if (firstPiece === bufferPiece) continue;
      for (const second of stickers) {
        const secondPiece = bySticker.get(second);
        if (secondPiece === bufferPiece || secondPiece === firstPiece) continue;
        actions.push({
          type: 'comm',
          buffer,
          targets: [first, second],
          apply(state) {
            return cycleModel.applyTraceLogToModel(
              state,
              model,
              [[buffer, first], [buffer, second]],
            );
          },
        });
      }
    }
  }
  return actions;
}

function orientationActions(kind, state, groups) {
  const fixed = [];
  for (const group of groups) {
    if (state[group[0]] === group[0] || !group.includes(state[group[0]])) continue;
    fixed.push({ group, orientation: group.indexOf(state[group[0]]) });
  }
  const actions = [];
  for (let left = 0; left < fixed.length; left += 1) {
    for (let right = left + 1; right < fixed.length; right += 1) {
      const isLegal = kind === 'edge'
        ? fixed[left].orientation === 1 && fixed[right].orientation === 1
        : (fixed[left].orientation + fixed[right].orientation) % 3 === 0;
      if (!isLegal) continue;
      actions.push({
        type: kind === 'edge' ? '2-flip' : '2-twist',
        pieces: [fixed[left].group[0], fixed[right].group[0]],
        apply(current) {
          const next = { ...current };
          for (const entry of [fixed[left], fixed[right]]) {
            for (const sticker of entry.group) next[sticker] = sticker;
          }
          return next;
        },
      });
    }
  }
  return actions;
}

function createOracle(kind, capability = 'none', options = {}) {
  const allowOrientationActions = options.orientation_actions !== false;
  const groups = pieceGroups(kind);
  const solved = solvedState(kind);
  const model = kind === 'corner'
    ? cycleModel.decomposeCornerState(solved)
    : cycleModel.decomposeEdgeState(solved);
  const keys = Object.keys(solved).sort();
  const solvedKey = stateKey(solved, keys);
  const commActions = buildThreeCycleActions(kind, model);
  const memo = new Map();
  const reductionCache = new Map();
  const lowerBoundCache = new Map();
  let statesExplored = 0;

  function reducingActions(state) {
    const currentKey = stateKey(state, keys);
    if (reductionCache.has(currentKey)) return reductionCache.get(currentKey);
    const unresolved = unresolvedPieceCount(state, groups);
    const currentCycleCount = activeCycleCount(kind, state);
    const nextStates = new Set();
    const reductions = [];
    const actions = [
      ...(allowOrientationActions ? orientationActions(kind, state, groups) : []),
      ...commActions,
    ];
    for (const action of actions) {
      const next = action.apply(state);
      const nextUnresolved = unresolvedPieceCount(next, groups);
      const reachesFinish = Boolean(terminalDetails(kind, next, capability));
      if (nextUnresolved > unresolved && !reachesFinish) continue;
      if (
        nextUnresolved === unresolved
        && activeCycleCount(kind, next) >= currentCycleCount
        && !reachesFinish
      ) continue;
      const nextKey = stateKey(next, keys);
      if (nextStates.has(nextKey)) continue;
      nextStates.add(nextKey);
      reductions.push({ action, next });
    }
    reductionCache.set(currentKey, reductions);
    return reductions;
  }

  function visit(state) {
    const key = stateKey(state, keys);
    if (memo.has(key)) return memo.get(key);
    statesExplored += 1;
    if (key === solvedKey) {
      const result = { cost: 0, actions: [], terminal: null };
      memo.set(key, result);
      return result;
    }
    const terminal = terminalDetails(kind, state, capability);
    let best = terminal ? { cost: terminal.cost, actions: [], terminal } : null;
    for (const { action, next } of reducingActions(state)) {
      const suffix = visit(next);
      if (!suffix) continue;
      const candidate = {
        cost: 1 + suffix.cost,
        actions: [{
          type: action.type,
          ...(action.buffer ? { buffer: action.buffer, targets: action.targets } : {}),
          ...(action.pieces ? { pieces: action.pieces } : {}),
        }, ...suffix.actions],
        terminal: suffix.terminal,
      };
      if (!best || candidate.cost < best.cost) best = candidate;
    }
    memo.set(key, best);
    return best;
  }

  function solveWithin(state, maximumCost, minimumCost = 0) {
    const failed = new Set();
    let boundedStatesExplored = 0;

    function optimisticLowerBound(current) {
      const key = stateKey(current, keys);
      if (lowerBoundCache.has(key)) return lowerBoundCache.get(key);
      const currentModel = kind === 'corner'
        ? cycleModel.decomposeCornerState(current)
        : cycleModel.decomposeEdgeState(current);
      const reduced = residue.reduceCycleModelToResidues(currentModel, selectedBuffers(kind));
      const residuePlan = residue.minimumUnitResidueCost(
        kind,
        reduced.residue_types,
        kind === 'corner' && Boolean(currentModel.permutation_parity),
      );
      if (!residuePlan) {
        lowerBoundCache.set(key, Infinity);
        return Infinity;
      }
      const baseline = reduced.base_algs + residuePlan.cost;
      const bound = kind === 'corner' && capability !== 'none'
        ? Math.max(0, baseline - 1)
        : baseline;
      lowerBoundCache.set(key, bound);
      return bound;
    }

    function boundedVisit(current, remainingCost) {
      const key = stateKey(current, keys);
      const failureKey = `${remainingCost}|${key}`;
      if (failed.has(failureKey)) return null;
      boundedStatesExplored += 1;
      if (key === solvedKey) return { cost: 0, actions: [], terminal: null };
      const terminal = terminalDetails(kind, current, capability);
      if (terminal && terminal.cost <= remainingCost) {
        return { cost: terminal.cost, actions: [], terminal };
      }
      if (optimisticLowerBound(current) > remainingCost) {
        failed.add(failureKey);
        return null;
      }
      if (remainingCost === 0) {
        failed.add(failureKey);
        return null;
      }
      for (const { action, next } of reducingActions(current)) {
        const suffix = boundedVisit(next, remainingCost - 1);
        if (!suffix) continue;
        return {
          cost: 1 + suffix.cost,
          actions: [{
            type: action.type,
            ...(action.buffer ? { buffer: action.buffer, targets: action.targets } : {}),
            ...(action.pieces ? { pieces: action.pieces } : {}),
          }, ...suffix.actions],
          terminal: suffix.terminal,
        };
      }
      failed.add(failureKey);
      return null;
    }

    for (let cost = minimumCost; cost <= maximumCost; cost += 1) {
      const result = boundedVisit(state, cost);
      if (result) return { ...result, states_explored: boundedStatesExplored };
    }
    return null;
  }

  return {
    solve(state, options = {}) {
      if (Number.isInteger(options.max_cost)) {
        return solveWithin(state, options.max_cost, options.minimum_cost || 0);
      }
      const before = statesExplored;
      const result = visit(state);
      return result ? { ...result, states_explored: statesExplored - before } : null;
    },
    get memo_size() {
      return memo.size;
    },
  };
}

module.exports = {
  CORNER_BUFFERS,
  EDGE_BUFFERS,
  buildThreeCycleActions,
  createOracle,
  activeCycleCount,
  pieceGroups,
  synthesizeResidueState,
  unresolvedPieceCount,
};
