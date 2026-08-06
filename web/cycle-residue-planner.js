(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? {
        cycleModel: require('./cycle-model'),
        residue: require('./cycle-residue'),
      }
    : {
        cycleModel: global.SsiCoreModules,
        residue: global.SsiCoreModules,
      };

  const {
    decomposeCornerState,
    decomposeEdgeState,
    solvedStateFromPieceGroups,
    stateRelativeToGoal,
  } = deps.cycleModel;
  const {
    minimumExactRootedCornerFinishPlan,
    minimumExactWeightedClassPlan,
    normalizeFinishCapability,
    reduceCycleModelToResidues,
    validateOrientationWeight,
  } = deps.residue;

  const FULL_CORNER_BUFFERS = Object.freeze(['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL']);
  const FULL_EDGE_BUFFERS = Object.freeze(['UF', 'UB', 'UR', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL']);
  const coverageCache = new Map();
  const cornerFinishGoalCache = new Map();

  function canonicalPiece(model, sticker) {
    const group = model.piece_lookup?.[sticker]
      || model.piece_groups.find((candidate) => candidate.includes(sticker));
    if (!group) throw new Error(`Unknown ${model.kind} buffer: ${sticker}`);
    return group[0];
  }

  function bufferPieces(model, buffers) {
    return new Set(buffers.map((buffer) => canonicalPiece(model, buffer)));
  }

  function isFullFloatingBufferSet(model, buffers) {
    const expected = model.kind === 'corner' ? FULL_CORNER_BUFFERS : FULL_EDGE_BUFFERS;
    const actualPieces = bufferPieces(model, buffers);
    const expectedPieces = bufferPieces(model, expected);
    return actualPieces.size === expectedPieces.size
      && [...expectedPieces].every((piece) => actualPieces.has(piece));
  }

  function proveFullBufferCoverage(model, buffers) {
    const cacheKey = `${model.kind}|${[...bufferPieces(model, buffers)].sort().join(',')}`;
    if (coverageCache.has(cacheKey)) return coverageCache.get(cacheKey);
    const allowed = bufferPieces(model, buffers);
    const excluded = model.piece_groups
      .map((group) => group[0])
      .filter((piece) => !allowed.has(piece));
    const uncoveredTriples = [];
    const pieces = model.piece_groups.map((group) => group[0]);
    for (let left = 0; left < pieces.length; left += 1) {
      for (let middle = left + 1; middle < pieces.length; middle += 1) {
        for (let right = middle + 1; right < pieces.length; right += 1) {
          const triple = [pieces[left], pieces[middle], pieces[right]];
          if (!triple.some((piece) => allowed.has(piece))) uncoveredTriples.push(triple);
        }
      }
    }
    const coverage = {
      complete: uncoveredTriples.length === 0,
      allowed_pieces: [...allowed],
      excluded_pieces: excluded,
      uncovered_triples: uncoveredTriples,
    };
    coverageCache.set(cacheKey, coverage);
    return coverage;
  }

  function buildParityEdgeGoal(parity, edgePieceGroups) {
    const goal = solvedStateFromPieceGroups(edgePieceGroups);
    if (!parity) return goal;
    Object.assign(goal, { UF: 'UR', FU: 'RU', UR: 'UF', RU: 'FU' });
    return goal;
  }

  function prepareReducedModel(model, selectedBuffers) {
    if (!isFullFloatingBufferSet(model, selectedBuffers)) {
      throw new Error('Cycle-residue planning currently requires the complete floating buffer set.');
    }
    const coverage = proveFullBufferCoverage(model, selectedBuffers);
    if (!coverage.complete) {
      throw new Error(`The selected ${model.kind} buffers do not cover every three-piece algorithm.`);
    }
    const reduced = reduceCycleModelToResidues(model, selectedBuffers);
    return {
      complete: true,
      model,
      coverage,
      reduced,
      base_algs: reduced.base_algs,
    };
  }

  function planPreparedReducedModel(prepared, orientationWeight = 1) {
    const weight = validateOrientationWeight(orientationWeight);
    const { model, reduced } = prepared;
    const residuePlan = minimumExactWeightedClassPlan(model, weight);
    if (!residuePlan) {
      throw new Error(`No exact weighted ${model.kind} class for the current state.`);
    }
    return {
      ...prepared,
      residue_plan: residuePlan,
      orientation_weight: weight,
      permutation_algs: residuePlan.permutation_algs,
      orientation_algs: residuePlan.orientation_algs,
      total_algs: residuePlan.cost,
    };
  }

  function planReducedModel(model, selectedBuffers, orientationWeight = 1) {
    return planPreparedReducedModel(
      prepareReducedModel(model, selectedBuffers),
      orientationWeight,
    );
  }

  function setPlacement(state, slotGroup, placedPieceGroup, orientation) {
    for (let offset = 0; offset < slotGroup.length; offset += 1) {
      state[slotGroup[offset]] = placedPieceGroup[(orientation + offset) % slotGroup.length];
    }
  }

  function stateKey(state) {
    return Object.keys(state).sort().map((key) => state[key]).join(',');
  }

  function buildCornerFinishGoals(model, capability) {
    const normalizedCapability = normalizeFinishCapability(capability);
    if (cornerFinishGoalCache.has(normalizedCapability)) {
      return cornerFinishGoalCache.get(normalizedCapability);
    }

    const groups = model.piece_groups;
    const primary = groups.find((group) => group[0] === 'UFR');
    if (!primary) throw new Error('Corner model does not contain the UFR piece.');
    const others = groups.filter((group) => group !== primary);
    const goals = [];
    const seen = new Set();

    function addParityGoal(partner) {
      for (let leftCharge = 0; leftCharge < 3; leftCharge += 1) {
        const rightCharge = (3 - leftCharge) % 3;
        const state = solvedStateFromPieceGroups(groups);
        setPlacement(state, primary, partner, leftCharge);
        setPlacement(state, partner, primary, rightCharge);
        const key = stateKey(state);
        if (seen.has(key)) continue;
        seen.add(key);
        goals.push({
          state,
          type: 'parity',
          primary_role: 'in-P',
          residues: ['P0'],
          pieces: {
            permutation: [primary[0], partner[0]],
          },
        });
      }
    }

    function addTwistFinishGoal(permutationGroups, permutationCharge, twistGroup, twistCharge, role) {
      for (let leftCharge = 0; leftCharge < 3; leftCharge += 1) {
        const rightCharge = (permutationCharge - leftCharge + 3) % 3;
        const state = solvedStateFromPieceGroups(groups);
        setPlacement(state, permutationGroups[0], permutationGroups[1], leftCharge);
        setPlacement(state, permutationGroups[1], permutationGroups[0], rightCharge);
        setPlacement(state, twistGroup, twistGroup, twistCharge);
        const key = stateKey(state);
        if (seen.has(key)) continue;
        seen.add(key);
        goals.push({
          state,
          type: role === 'is-T' ? 't2c' : 'ltct',
          primary_role: role,
          residues: twistCharge === 1 ? ['T+', 'P-'] : ['T-', 'P+'],
          pieces: {
            permutation: permutationGroups.map((group) => group[0]),
            twist: twistGroup[0],
          },
        });
      }
    }

    // Every parity alg swaps UF/UR plus UFR and one arbitrary corner target.
    for (const partner of others) addParityGoal(partner);

    // LTCT: UFR is one of the two pieces in the parity-open residue.
    if (normalizedCapability !== 'none') {
      for (const partner of others) {
        for (const twist of others) {
          if (twist === partner) continue;
          addTwistFinishGoal([primary, partner], 2, twist, 1, 'in-P');
          addTwistFinishGoal([primary, partner], 1, twist, 2, 'in-P');
        }
      }
    }

    // T2C includes LTCT and additionally allows UFR itself to be the twist.
    if (normalizedCapability === 't2c') {
      for (let left = 0; left < others.length; left += 1) {
        for (let right = left + 1; right < others.length; right += 1) {
          addTwistFinishGoal([others[left], others[right]], 2, primary, 1, 'is-T');
          addTwistFinishGoal([others[left], others[right]], 1, primary, 2, 'is-T');
        }
      }
    }

    cornerFinishGoalCache.set(normalizedCapability, goals);
    return goals;
  }

  function ordinaryCornerPlanToGoal(state, goalState, selectedBuffers, orientationWeight) {
    const relativeState = stateRelativeToGoal(state, goalState);
    const relativeModel = decomposeCornerState(relativeState);
    if (relativeModel.permutation_parity) {
      throw new Error('Two corner parity states must have an even relative permutation.');
    }
    return {
      ...planReducedModel(relativeModel, selectedBuffers, orientationWeight),
      relative_state: relativeState,
    };
  }

  function evaluateCornerFinishGoals(
    state,
    model,
    selectedBuffers,
    capability,
    orientationWeight = 1,
  ) {
    const weight = validateOrientationWeight(orientationWeight);
    let best = null;
    for (const goal of buildCornerFinishGoals(model, capability)) {
      const prefix = ordinaryCornerPlanToGoal(state, goal.state, selectedBuffers, weight);
      const totalAlgs = prefix.total_algs + 1;
      const candidate = {
        ...prefix,
        finish: {
          type: goal.type,
          cost: 1,
          primary_role: goal.primary_role,
          residues: [...goal.residues],
          pieces: goal.pieces,
          goal_state: goal.state,
        },
        permutation_algs: prefix.permutation_algs + 1,
        total_algs: totalAlgs,
      };
      if (
        !best
        || candidate.total_algs < best.total_algs - 1e-12
        || (
          Math.abs(candidate.total_algs - best.total_algs) <= 1e-12
          && candidate.orientation_algs < best.orientation_algs
        )
      ) best = candidate;
    }
    if (!best) throw new Error(`No legal ${capability} corner parity finish.`);
    return best;
  }

  function planRootedCornerFinish(model, capability, orientationWeight = 1) {
    const weight = validateOrientationWeight(orientationWeight);
    const selected = minimumExactRootedCornerFinishPlan(model, capability, weight);
    if (!selected) {
      throw new Error(`No exact rooted ${capability} corner finish class for the current state.`);
    }
    return {
      orientation_weight: weight,
      permutation_algs: selected.permutation_algs,
      orientation_algs: selected.orientation_algs,
      total_algs: selected.cost,
      finish: selected.finish,
    };
  }

  function planCornerStateByResidues(
    state,
    selectedBuffers,
    capability = 'none',
    orientationWeight = 1,
  ) {
    const normalizedCapability = normalizeFinishCapability(capability);
    const weight = validateOrientationWeight(orientationWeight);
    const model = decomposeCornerState(state);
    const prepared = prepareReducedModel(model, selectedBuffers);
    const baseline = model.permutation_parity
      ? planRootedCornerFinish(model, 'none', weight)
      : planPreparedReducedModel(prepared, weight);
    const optimized = model.permutation_parity && normalizedCapability !== 'none'
      ? planRootedCornerFinish(model, normalizedCapability, weight)
      : baseline;
    return {
      ...optimized,
      model,
      coverage: prepared.coverage,
      reduced: prepared.reduced,
      base_algs: prepared.base_algs,
      baseline_total_algs: baseline.total_algs,
      baseline_permutation_algs: baseline.permutation_algs,
      baseline_orientation_algs: baseline.orientation_algs,
      finish_capability: normalizedCapability,
      finish_adjustment: optimized.total_algs - baseline.total_algs,
    };
  }

  function planCornerStateByTerminalEnumeration(
    state,
    selectedBuffers,
    capability,
    orientationWeight = 1,
  ) {
    const normalizedCapability = normalizeFinishCapability(capability);
    const weight = validateOrientationWeight(orientationWeight);
    const model = decomposeCornerState(state);
    const prepared = prepareReducedModel(model, selectedBuffers);
    const baseline = model.permutation_parity
      ? evaluateCornerFinishGoals(state, model, selectedBuffers, 'none', weight)
      : planPreparedReducedModel(prepared, weight);
    const optimized = model.permutation_parity && normalizedCapability !== 'none'
      ? evaluateCornerFinishGoals(
          state,
          model,
          selectedBuffers,
          normalizedCapability,
          weight,
        )
      : baseline;
    return {
      ...optimized,
      model,
      coverage: prepared.coverage,
      reduced: prepared.reduced,
      base_algs: prepared.base_algs,
      baseline_total_algs: baseline.total_algs,
      baseline_permutation_algs: baseline.permutation_algs,
      baseline_orientation_algs: baseline.orientation_algs,
      finish_capability: normalizedCapability,
      finish_adjustment: optimized.total_algs - baseline.total_algs,
    };
  }

  function planEdgeStateByResidues(state, parity, selectedBuffers, orientationWeight = 1) {
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
    return {
      ...planReducedModel(model, selectedBuffers, orientationWeight),
      physical_state: state,
      goal_state: goalState,
      relative_state: relativeState,
    };
  }

  const api = {
    FULL_CORNER_BUFFERS,
    FULL_EDGE_BUFFERS,
    buildCornerFinishGoals,
    buildParityEdgeGoal,
    isFullFloatingBufferSet,
    planCornerStateByResidues,
    planCornerStateByTerminalEnumeration,
    planEdgeStateByResidues,
    proveFullBufferCoverage,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
