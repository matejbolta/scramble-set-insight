(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? require('./cycle-model')
    : global.SsiCoreModules;

  const {
    applyTraceLogToModel,
    decomposeCornerState,
    decomposeEdgeState,
    pieceGroupForSticker,
    pieceInPlaceInModel,
    solvedStateFromPieceGroups,
    stateRelativeToGoal,
    switchWithBufferInModel,
  } = deps;

  const CORNER_CW_TWIST_STICKERS = new Set(['LUF', 'BUL', 'RUB', 'RDF', 'FDL', 'LDB', 'BDR']);

  function buildParityEdgeGoal(parity, edgePieceGroups) {
    const goal = solvedStateFromPieceGroups(edgePieceGroups);
    if (!parity) return goal;
    Object.assign(goal, { UF: 'UR', FU: 'RU', UR: 'UF', RU: 'FU' });
    return goal;
  }

  function traceCycleFromBuffer(state, model, cycle, buffer) {
    const bufferPiece = pieceGroupForSticker(model, buffer)[0];
    if (!cycle.slots.includes(bufferPiece)) {
      throw new Error(`${buffer} is not part of ${model.kind} cycle ${cycle.id}.`);
    }
    let virtualState = { ...state };
    const targets = [];
    while (!pieceInPlaceInModel(virtualState, model, buffer)) {
      if (targets.length >= cycle.length) {
        throw new Error(`${model.kind} cycle ${cycle.id} did not close from ${buffer}.`);
      }
      const target = virtualState[buffer];
      const targetPiece = pieceGroupForSticker(model, target)[0];
      if (!cycle.slots.includes(targetPiece)) {
        throw new Error(`${model.kind} cycle ${cycle.id} escaped to ${targetPiece}.`);
      }
      targets.push(target);
      virtualState = switchWithBufferInModel(virtualState, model, buffer, target);
    }
    if (targets.length !== cycle.length - 1) {
      throw new Error(`${model.kind} cycle ${cycle.id} closed in ${targets.length} targets; expected ${cycle.length - 1}.`);
    }
    return {
      cycle_id: cycle.id,
      buffer,
      targets,
      trace_log: targets.map((target) => [buffer, target]),
    };
  }

  function traceCycleFromExternalBuffer(state, model, cycle, buffer, entryTarget) {
    const bufferPiece = pieceGroupForSticker(model, buffer)[0];
    const entryPiece = pieceGroupForSticker(model, entryTarget)[0];
    if (cycle.slots.includes(bufferPiece)) {
      throw new Error(`${buffer} belongs to ${model.kind} cycle ${cycle.id}; it is not an external buffer.`);
    }
    if (!pieceInPlaceInModel(state, model, buffer)) {
      throw new Error(`External ${model.kind} buffer ${buffer} is not in place.`);
    }
    if (!cycle.slots.includes(entryPiece)) {
      throw new Error(`${entryTarget} is not part of ${model.kind} cycle ${cycle.id}.`);
    }

    let virtualState = switchWithBufferInModel(state, model, buffer, entryTarget);
    const targets = [entryTarget];
    while (!pieceInPlaceInModel(virtualState, model, buffer)) {
      if (targets.length > cycle.length) {
        throw new Error(`${model.kind} cycle ${cycle.id} did not close through external buffer ${buffer}.`);
      }
      const target = virtualState[buffer];
      const targetPiece = pieceGroupForSticker(model, target)[0];
      if (!cycle.slots.includes(targetPiece)) {
        throw new Error(`${model.kind} cycle ${cycle.id} escaped to ${targetPiece} through ${buffer}.`);
      }
      targets.push(target);
      virtualState = switchWithBufferInModel(virtualState, model, buffer, target);
    }
    if (targets.length !== cycle.length + 1) {
      throw new Error(`${model.kind} cycle ${cycle.id} linked in ${targets.length} targets; expected ${cycle.length + 1}.`);
    }
    return {
      cycle_id: cycle.id,
      buffer,
      entry_target: entryTarget,
      external: true,
      targets,
      trace_log: targets.map((target) => [buffer, target]),
      final_state: virtualState,
    };
  }

  function analyzeCycleSegments(segments) {
    const oddSegments = segments.filter((segment) => segment.targets.length % 2);
    const standaloneAlgs = segments.reduce(
      (sum, segment) => sum + Math.ceil(segment.targets.length / 2),
      0,
    );
    const savedByLinking = Math.floor(oddSegments.length / 2);
    return {
      odd_segment_count: oddSegments.length,
      even_segment_count: segments.length - oddSegments.length,
      parity: Boolean(oddSegments.length % 2),
      standalone_algs: standaloneAlgs,
      saved_by_linking: savedByLinking,
      algs: standaloneAlgs - savedByLinking,
    };
  }

  function classifyCornerOrientations(state, model, twistWeight, selectedBuffers, ltct = false) {
    const twists = [];
    for (const group of model.piece_groups) {
      if (state[group[0]] === group[0]) continue;
      if (!group.includes(state[group[0]])) {
        throw new Error(`Corner permutation remains at ${group[0]} after local cycle planning.`);
      }
      const twistSticker = group.find((location) => state[location] === group[0]);
      if (!twistSticker) throw new Error(`Could not locate the U/D sticker for ${group[0]}.`);
      twists.push({
        piece: group[0],
        sticker: twistSticker,
        direction: CORNER_CW_TWIST_STICKERS.has(twistSticker) ? 'cw' : 'ccw',
      });
    }

    const anchorOptions = [null];
    for (const buffer of selectedBuffers) {
      const bufferPiece = pieceGroupForSticker(model, buffer)[0];
      const twist = twists.find((candidate) => candidate.piece === bufferPiece);
      if (twist && !anchorOptions.some((candidate) => candidate?.piece === bufferPiece)) {
        anchorOptions.push({ ...twist, buffer });
      }
    }

    let best = null;
    for (const anchor of anchorOptions) {
      const explicitTwists = anchor
        ? twists.filter((twist) => twist.piece !== anchor.piece)
        : twists;
      const cw = explicitTwists.filter((twist) => twist.direction === 'cw').length;
      const ccw = explicitTwists.length - cw;
      const twoTwists = Math.min(cw, ccw);
      const singleTwists = Math.abs(cw - ccw);
      const candidate = {
        list: explicitTwists.map((twist) => twist.sticker),
        all_list: twists.map((twist) => twist.sticker),
        buffer: anchor?.buffer || null,
        buffer_twist: anchor?.sticker || null,
        count: explicitTwists.length,
        all_count: twists.length,
        cw,
        ccw,
        two_twists: twoTwists,
        single_twists: singleTwists,
        algs: twoTwists * twistWeight + singleTwists,
      };
      candidate.ltct_adjustment = (
        model.permutation_parity
        && ltct
        && candidate.single_twists > 0
      ) ? -1 : 0;
      if (
        !best
        || candidate.algs + candidate.ltct_adjustment < best.algs + best.ltct_adjustment
      ) best = candidate;
    }
    return best;
  }

  function classifyEdgeOrientations(state, model, flipWeight) {
    const flips = [];
    for (const group of model.piece_groups) {
      if (state[group[0]] === group[0]) continue;
      if (state[group[0]] !== group[1]) {
        throw new Error(`Edge permutation remains at ${group[0]} after local cycle planning.`);
      }
      flips.push(group[0]);
    }
    const twoFlips = Math.floor(flips.length / 2);
    return {
      list: flips,
      count: flips.length,
      two_flips: twoFlips,
      algs: twoFlips * flipWeight + (flips.length % 2),
    };
  }

  function cycleStickers(model, cycle) {
    return cycle.slots.flatMap((slot) => [...pieceGroupForSticker(model, slot)]);
  }

  function cyclePermutationSolved(state, model, cycle) {
    return cycle.slots.every((slot) => pieceInPlaceInModel(state, model, slot));
  }

  function serializeSearchState(state, stateKeys, remainingCycleIds, oddSegmentParity) {
    return `${oddSegmentParity}|${remainingCycleIds.join(',')}|${stateKeys.map((key) => state[key]).join(',')}`;
  }

  function planDlinCycles(state, model, selectedBuffers, orientationWeight, ltct = false) {
    if (!selectedBuffers.length) throw new Error('DLin planning requires at least one selected buffer.');
    if (!Number.isFinite(orientationWeight) || orientationWeight < 0) {
      throw new Error('DLin orientation weight must be a non-negative finite number.');
    }
    const permutationCycles = model.active_cycles.filter((cycle) => cycle.length > 1);
    const stateKeys = Object.keys(state).sort();
    const cycleById = new Map(permutationCycles.map((cycle) => [cycle.id, cycle]));
    const cycleStickersById = new Map(
      permutationCycles.map((cycle) => [cycle.id, cycleStickers(model, cycle)]),
    );
    const bufferPieceBySticker = new Map(
      selectedBuffers.map((buffer) => [buffer, pieceGroupForSticker(model, buffer)[0]]),
    );
    const minimumTargetLengthByCycleId = new Map(permutationCycles.map((cycle) => {
      const hasInternalBuffer = selectedBuffers.some((buffer) => (
        cycle.slots.includes(bufferPieceBySticker.get(buffer))
      ));
      return [cycle.id, cycle.length + (hasInternalBuffer ? -1 : 1)];
    }));
    const minimumCostAtState = new Map();
    let statesExplored = 0;
    let best = null;

    // The search chooses cycle breaks only after every physical cycle is known.
    // Equivalent virtual states are memoized together with the remaining cycles
    // and the one bit needed to price later odd-segment linking correctly.
    function visit(
      virtualState,
      remainingCycleIds,
      segments,
      traceLog,
      pairedPermutationCost,
      oddSegmentParity,
    ) {
      statesExplored += 1;
      const searchKey = serializeSearchState(
        virtualState,
        stateKeys,
        remainingCycleIds,
        oddSegmentParity,
      );
      const previousCost = minimumCostAtState.get(searchKey);
      if (previousCost !== undefined && previousCost <= pairedPermutationCost) return;
      minimumCostAtState.set(searchKey, pairedPermutationCost);

      if (best) {
        const remainingTargetLengths = remainingCycleIds.map(
          (cycleId) => minimumTargetLengthByCycleId.get(cycleId),
        );
        const remainingOddSegments = remainingTargetLengths.filter((length) => length % 2).length;
        const permutationLowerBound = pairedPermutationCost
          + remainingTargetLengths.reduce((sum, length) => sum + Math.floor(length / 2), 0)
          + Math.ceil((oddSegmentParity + remainingOddSegments) / 2);
        const possibleLtctSaving = model.kind === 'corner' && model.permutation_parity && ltct ? 1 : 0;
        if (permutationLowerBound - possibleLtctSaving > best.total_algs) return;
      }

      if (!remainingCycleIds.length) {
        const segmentAnalysis = analyzeCycleSegments(segments);
        const orientations = model.kind === 'corner'
          ? classifyCornerOrientations(
              virtualState,
              model,
              orientationWeight,
              selectedBuffers,
              ltct,
            )
          : classifyEdgeOrientations(virtualState, model, orientationWeight);
        const ltctAdjustment = orientations.ltct_adjustment || 0;
        const candidate = {
          complete: true,
          model,
          segments: segments.map((segment) => ({ ...segment, targets: [...segment.targets] })),
          trace_log: traceLog.map(([buffer, target]) => [buffer, target]),
          final_state: { ...virtualState },
          segment_analysis: segmentAnalysis,
          orientations,
          permutation_algs: segmentAnalysis.algs,
          orientation_algs: orientations.algs,
          ltct_adjustment: ltctAdjustment,
          total_algs: segmentAnalysis.algs + orientations.algs + ltctAdjustment,
          unplanned_cycles: [],
        };
        if (
          !best
          || candidate.total_algs < best.total_algs
          || (
            candidate.total_algs === best.total_algs
            && candidate.permutation_algs < best.permutation_algs
          )
        ) best = candidate;
        return;
      }

      for (const cycleId of remainingCycleIds) {
        const cycle = cycleById.get(cycleId);
        const nextRemaining = remainingCycleIds.filter((candidateId) => candidateId !== cycleId);
        const options = [];
        for (const buffer of selectedBuffers) {
          const bufferPiece = bufferPieceBySticker.get(buffer);
          if (cycle.slots.includes(bufferPiece)) {
            options.push(traceCycleFromBuffer(virtualState, model, cycle, buffer));
          } else if (pieceInPlaceInModel(virtualState, model, buffer)) {
            for (const entryTarget of cycleStickersById.get(cycle.id)) {
              options.push(traceCycleFromExternalBuffer(
                virtualState,
                model,
                cycle,
                buffer,
                entryTarget,
              ));
            }
          }
        }
        options.sort((left, right) => left.targets.length - right.targets.length);

        for (const option of options) {
          const nextState = option.final_state
            ? option.final_state
            : applyTraceLogToModel(virtualState, model, option.trace_log);
          if (!cyclePermutationSolved(nextState, model, cycle)) {
            throw new Error(`${model.kind} cycle ${cycle.id} remains displaced after DLin action.`);
          }
          const segment = {
            cycle_id: option.cycle_id,
            buffer: option.buffer,
            targets: [...option.targets],
            external: Boolean(option.external),
          };
          const segmentIsOdd = option.targets.length % 2;
          visit(
            nextState,
            nextRemaining,
            [...segments, segment],
            [...traceLog, ...option.trace_log],
            pairedPermutationCost
              + Math.floor(option.targets.length / 2)
              + (segmentIsOdd && oddSegmentParity ? 1 : 0),
            segmentIsOdd ? 1 - oddSegmentParity : oddSegmentParity,
          );
        }
      }
    }

    visit(
      state,
      permutationCycles.map((cycle) => cycle.id),
      [],
      [],
      0,
      0,
    );

    if (!best) {
      return {
        complete: false,
        model,
        unplanned_cycles: permutationCycles,
        states_explored: statesExplored,
      };
    }
    return { ...best, states_explored: statesExplored };
  }

  function planCornerStateDlin(state, selectedBuffers, twistWeight = 1, ltct = false) {
    const model = decomposeCornerState(state);
    return planDlinCycles(state, model, selectedBuffers, twistWeight, ltct);
  }

  function planEdgeStateDlin(state, parity, selectedBuffers, flipWeight = 1) {
    const physicalModel = decomposeEdgeState(state);
    if (Boolean(parity) !== Boolean(physicalModel.permutation_parity)) {
      throw new Error('Corner parity does not match the physical edge permutation parity.');
    }
    const goalState = buildParityEdgeGoal(parity, physicalModel.piece_groups);
    const relativeState = stateRelativeToGoal(state, goalState);
    const model = decomposeEdgeState(relativeState);
    if (model.permutation_parity) {
      throw new Error('Parity-relative edge goal must have an even permutation.');
    }
    const plan = planDlinCycles(relativeState, model, selectedBuffers, flipWeight);
    return {
      ...plan,
      physical_state: state,
      goal_state: goalState,
      relative_state: relativeState,
    };
  }

  const api = {
    analyzeCycleSegments,
    buildParityEdgeGoal,
    planCornerStateDlin,
    planDlinCycles,
    planEdgeStateDlin,
    traceCycleFromBuffer,
    traceCycleFromExternalBuffer,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
