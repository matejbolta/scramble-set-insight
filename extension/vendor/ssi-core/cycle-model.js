(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? require('./corner-tracing')
    : global.SsiCoreModules;

  const { CORNER_PIECE_GROUPS } = deps;

  const EDGE_PIECE_GROUPS = [
    ['UF', 'FU'],
    ['UR', 'RU'],
    ['UB', 'BU'],
    ['UL', 'LU'],
    ['FR', 'RF'],
    ['FL', 'LF'],
    ['DF', 'FD'],
    ['DR', 'RD'],
    ['DB', 'BD'],
    ['BR', 'RB'],
    ['BL', 'LB'],
    ['DL', 'LD'],
  ];

  function buildPieceLookup(pieceGroups) {
    const bySticker = new Map();
    for (const group of pieceGroups) {
      for (const sticker of group) {
        if (bySticker.has(sticker)) throw new Error(`Duplicate sticker in piece model: ${sticker}`);
        bySticker.set(sticker, group);
      }
    }
    return bySticker;
  }

  function decomposeStickerOrbits(state, stickers) {
    const allowed = new Set(stickers);
    const visited = new Set();
    const orbits = [];
    for (const start of stickers) {
      if (visited.has(start)) continue;
      const orbit = [];
      let current = start;
      while (!visited.has(current)) {
        if (!allowed.has(current)) {
          throw new Error(`Sticker orbit escaped its piece cycle at ${current}`);
        }
        visited.add(current);
        orbit.push(current);
        current = state[current];
      }
      if (current !== start) throw new Error(`Sticker orbit merged before returning to ${start}`);
      orbits.push(orbit);
    }
    return orbits;
  }

  function decomposePieceState(state, pieceGroups, kind) {
    if (!pieceGroups.length) throw new Error('Piece model must not be empty.');
    const arity = pieceGroups[0].length;
    if (!pieceGroups.every((group) => group.length === arity)) {
      throw new Error('Every piece group must have the same number of stickers.');
    }

    const bySticker = buildPieceLookup(pieceGroups);
    const canonicalPieces = pieceGroups.map((group) => group[0]);
    const placementBySlot = new Map();

    for (const slotGroup of pieceGroups) {
      const slot = slotGroup[0];
      const pointerValue = state[slot];
      const pieceGroup = bySticker.get(pointerValue);
      if (!pieceGroup) throw new Error(`Unknown ${kind} sticker at ${slot}: ${pointerValue}`);
      const orientation = pieceGroup.indexOf(pointerValue);
      for (let offset = 0; offset < arity; offset += 1) {
        const location = slotGroup[offset];
        const expected = pieceGroup[(orientation + offset) % arity];
        if (state[location] !== expected) {
          throw new Error(`Inconsistent ${kind} piece orientation at ${location}: expected ${expected}, got ${state[location]}`);
        }
      }
      placementBySlot.set(slot, {
        slot,
        piece: pieceGroup[0],
        orientation,
        pointer_sticker: pointerValue,
      });
    }

    const visitedPieces = new Set();
    const cycles = [];
    for (const start of canonicalPieces) {
      if (visitedPieces.has(start)) continue;
      const placements = [];
      let current = start;
      while (!visitedPieces.has(current)) {
        visitedPieces.add(current);
        const placement = placementBySlot.get(current);
        if (!placement) throw new Error(`Piece cycle escaped the ${kind} model at ${current}`);
        placements.push({ ...placement });
        current = placement.piece;
      }
      if (current !== start) throw new Error(`Piece cycle merged before returning to ${start}`);

      const slots = placements.map((placement) => placement.slot);
      const stickers = slots.flatMap((slot) => [...bySticker.get(slot)]);
      const orientationSum = placements.reduce((sum, placement) => sum + placement.orientation, 0) % arity;
      const active = placements.some((placement) => (
        placement.slot !== placement.piece || placement.orientation !== 0
      ));
      cycles.push({
        id: start,
        kind,
        // `length` is the physical piece count. A k-cycle contributes
        // permutation parity (k - 1) mod 2, so these two parities are opposite.
        length: placements.length,
        slots,
        placements,
        permutation_parity: (placements.length - 1) % 2,
        orientation_modulus: arity,
        orientation_sum: orientationSum,
        active,
        sticker_orbits: decomposeStickerOrbits(state, stickers),
      });
    }

    const permutationParity = cycles.reduce((parity, cycle) => parity ^ cycle.permutation_parity, 0);
    const orientationSum = cycles.reduce((sum, cycle) => sum + cycle.orientation_sum, 0) % arity;
    return {
      kind,
      arity,
      piece_groups: pieceGroups.map((group) => [...group]),
      piece_lookup: Object.fromEntries(
        pieceGroups.flatMap((group) => group.map((sticker) => [sticker, [...group]])),
      ),
      cycles,
      active_cycles: cycles.filter((cycle) => cycle.active),
      permutation_parity: permutationParity,
      orientation_sum: orientationSum,
    };
  }

  function decomposeCornerState(state) {
    return decomposePieceState(state, CORNER_PIECE_GROUPS, 'corner');
  }

  function decomposeEdgeState(state) {
    return decomposePieceState(state, EDGE_PIECE_GROUPS, 'edge');
  }

  function reconstructStateFromCycleModel(model) {
    const byCanonical = new Map(model.piece_groups.map((group) => [group[0], group]));
    const state = {};
    for (const cycle of model.cycles) {
      for (const placement of cycle.placements) {
        const slotGroup = byCanonical.get(placement.slot);
        const pieceGroup = byCanonical.get(placement.piece);
        if (!slotGroup || !pieceGroup) throw new Error(`Unknown placement in ${model.kind} cycle model.`);
        for (let offset = 0; offset < model.arity; offset += 1) {
          state[slotGroup[offset]] = pieceGroup[(placement.orientation + offset) % model.arity];
        }
      }
    }
    return state;
  }

  function solvedStateFromPieceGroups(pieceGroups) {
    return Object.fromEntries(pieceGroups.flatMap((group) => group.map((sticker) => [sticker, sticker])));
  }

  function stateRelativeToGoal(state, goalState) {
    const inverseGoal = {};
    for (const [location, sticker] of Object.entries(goalState)) {
      if (inverseGoal[sticker] !== undefined) throw new Error(`Goal contains duplicate sticker: ${sticker}`);
      inverseGoal[sticker] = location;
    }
    const relativeState = {};
    for (const [location, sticker] of Object.entries(state)) {
      if (inverseGoal[sticker] === undefined) throw new Error(`Goal does not contain sticker: ${sticker}`);
      relativeState[location] = inverseGoal[sticker];
    }
    return relativeState;
  }

  function pieceGroupForSticker(model, sticker) {
    const group = model.piece_lookup?.[sticker]
      || model.piece_groups.find((candidate) => candidate.includes(sticker));
    if (!group) throw new Error(`Unknown ${model.kind} sticker: ${sticker}`);
    return group;
  }

  function pieceInPlaceInModel(state, model, sticker) {
    return pieceGroupForSticker(model, sticker).includes(state[sticker]);
  }

  function switchWithBufferInModel(state, model, buffer, target) {
    const bufferGroup = pieceGroupForSticker(model, buffer);
    const targetGroup = pieceGroupForSticker(model, target);
    const bufferIndex = bufferGroup.indexOf(buffer);
    const targetIndex = targetGroup.indexOf(target);
    const nextState = { ...state };
    for (let offset = 0; offset < model.arity; offset += 1) {
      const bufferSticker = bufferGroup[(bufferIndex + offset) % model.arity];
      const targetSticker = targetGroup[(targetIndex + offset) % model.arity];
      nextState[bufferSticker] = state[targetSticker];
      nextState[targetSticker] = state[bufferSticker];
    }
    return nextState;
  }

  function applyTraceLogToModel(state, model, traceLog) {
    let nextState = { ...state };
    for (const [buffer, target] of traceLog) {
      nextState = switchWithBufferInModel(nextState, model, buffer, target);
    }
    return nextState;
  }

  function findStickerOrbit(cycle, sticker) {
    return cycle.sticker_orbits.find((orbit) => orbit.includes(sticker)) || null;
  }

  function targetsFromCycleBuffer(cycle, bufferSticker) {
    const orbit = findStickerOrbit(cycle, bufferSticker);
    if (!orbit) throw new Error(`${bufferSticker} is not part of cycle ${cycle.id}.`);
    const bufferIndex = orbit.indexOf(bufferSticker);
    return orbit.slice(bufferIndex + 1).concat(orbit.slice(0, bufferIndex));
  }

  function targetsFromExternalBuffer(cycle, entrySticker) {
    const orbit = findStickerOrbit(cycle, entrySticker);
    if (!orbit) throw new Error(`${entrySticker} is not part of cycle ${cycle.id}.`);
    const entryIndex = orbit.indexOf(entrySticker);
    const rotated = orbit.slice(entryIndex).concat(orbit.slice(0, entryIndex));
    return [...rotated, entrySticker];
  }

  const api = {
    EDGE_PIECE_GROUPS,
    decomposeCornerState,
    decomposeEdgeState,
    decomposePieceState,
    findStickerOrbit,
    applyTraceLogToModel,
    pieceGroupForSticker,
    pieceInPlaceInModel,
    reconstructStateFromCycleModel,
    solvedStateFromPieceGroups,
    stateRelativeToGoal,
    switchWithBufferInModel,
    targetsFromCycleBuffer,
    targetsFromExternalBuffer,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
