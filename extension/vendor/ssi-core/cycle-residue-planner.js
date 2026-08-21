(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? {
        bufferSelection: require('./buffer-selection'),
        cycleModel: require('./cycle-model'),
        residue: require('./cycle-residue'),
      }
    : {
        bufferSelection: global.SsiCoreModules,
        cycleModel: global.SsiCoreModules,
        residue: global.SsiCoreModules,
      };

  const {
    EDGE_PIECE_GROUPS,
    decomposeCornerState,
    decomposeEdgeState,
    solvedStateFromPieceGroups,
    stateRelativeToGoal,
    switchWithBufferInModel,
  } = deps.cycleModel;
  const {
    minimumExactRootedCornerFinishPlan,
    minimumExactCornerTerminalPlan,
    minimumExactSelectedBufferPlan,
    minimumExactRootedEdgePlan,
    minimumExactWeakswapFloatingPlan,
    minimumExactWeightedClassPlan,
    normalizeFinishCapability,
    normalizeEdgeFinishCapability,
    normalizeWeak2e2eCapability,
    normalizeTerminalWeights,
    reduceCycleModelToResidues,
    validateOrientationWeight,
  } = deps.residue;

  const {
    CORNER_BUFFER_ORDER: FULL_CORNER_BUFFERS,
    EDGE_BUFFER_ORDER: FULL_EDGE_BUFFERS,
  } = deps.bufferSelection;
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

  function planExactSelectedModel(
    model,
    selectedBuffers,
    finishMode = 'even-permutation',
    orientationWeight = 1,
  ) {
    const weight = validateOrientationWeight(orientationWeight);
    const selected = minimumExactSelectedBufferPlan(
      model,
      selectedBuffers,
      finishMode,
      weight,
    );
    if (!selected) {
      throw new Error(
        `No exact selected-buffer ${model.kind} class for ${selectedBuffers.length} buffers.`,
      );
    }
    return {
      model,
      selected_buffers: [...selectedBuffers],
      orientation_weight: weight,
      permutation_algs: selected.permutation_algs,
      orientation_algs: selected.orientation_algs,
      total_algs: selected.cost,
      ...(selected.finish ? { finish: selected.finish } : {}),
    };
  }

  function setPlacement(state, slotGroup, placedPieceGroup, orientation) {
    for (let offset = 0; offset < slotGroup.length; offset += 1) {
      state[slotGroup[offset]] = placedPieceGroup[(orientation + offset) % slotGroup.length];
    }
  }

  function stateKey(state) {
    return Object.keys(state).sort().map((key) => state[key]).join(',');
  }

  function buildCornerTerminalGoals(
    model,
    terminalType,
    selectedBuffers = [],
  ) {
    const supported = new Set([
      'parity',
      'ltct',
      't2c',
      'corner-floating-parity',
    ]);
    if (!supported.has(terminalType)) {
      throw new Error(`Unknown corner terminal type: ${terminalType}`);
    }

    const groups = model.piece_groups;
    const primary = groups.find((group) => group[0] === 'UFR');
    if (!primary) throw new Error('Corner model does not contain the UFR piece.');
    const others = groups.filter((group) => group !== primary);
    const selected = bufferPieces(model, selectedBuffers);
    const cacheKey = [
      terminalType,
      [...selected].sort().join(','),
    ].join('|');
    if (cornerFinishGoalCache.has(cacheKey)) {
      return cornerFinishGoalCache.get(cacheKey);
    }
    const goals = [];
    const seen = new Set();

    function addParityGoal(left, right, type = 'parity') {
      for (let leftCharge = 0; leftCharge < 3; leftCharge += 1) {
        const rightCharge = (3 - leftCharge) % 3;
        const state = solvedStateFromPieceGroups(groups);
        setPlacement(state, left, right, leftCharge);
        setPlacement(state, right, left, rightCharge);
        const key = stateKey(state);
        if (seen.has(key)) continue;
        seen.add(key);
        goals.push({
          state,
          type,
          primary_role: left === primary || right === primary ? 'in-P' : 'uninvolved',
          residues: ['P0'],
          pieces: {
            permutation: [left[0], right[0]],
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

    if (terminalType === 'parity') {
      // Classic parity swaps UF/UR plus UFR and one arbitrary corner target.
      for (const partner of others) addParityGoal(primary, partner);
    }

    if (terminalType === 'ltct') {
      // LTCT: UFR is one of the two pieces in the parity-open residue.
      for (const partner of others) {
        for (const twist of others) {
          if (twist === partner) continue;
          addTwistFinishGoal([primary, partner], 2, twist, 1, 'in-P');
          addTwistFinishGoal([primary, partner], 1, twist, 2, 'in-P');
        }
      }
    }

    if (terminalType === 't2c') {
      // T2C: UFR is the in-place twist and the twisted 2-swap is external.
      for (let left = 0; left < others.length; left += 1) {
        for (let right = left + 1; right < others.length; right += 1) {
          addTwistFinishGoal([others[left], others[right]], 2, primary, 1, 'is-T');
          addTwistFinishGoal([others[left], others[right]], 1, primary, 2, 'is-T');
        }
      }
    }

    if (terminalType === 'corner-floating-parity') {
      if (!selected.size) {
        throw new Error('Corner-floating parity goals require selected buffers.');
      }
      const full = isFullFloatingBufferSet(model, selectedBuffers);
      for (let left = 0; left < groups.length; left += 1) {
        for (let right = left + 1; right < groups.length; right += 1) {
          const leftPiece = groups[left][0];
          const rightPiece = groups[right][0];
          const learned = selected.has(leftPiece)
            || selected.has(rightPiece)
            || (
              full
              && [leftPiece, rightPiece].includes('DBR')
              && [leftPiece, rightPiece].includes('DBL')
            );
          if (learned) {
            addParityGoal(groups[left], groups[right], 'corner-floating-parity');
          }
        }
      }
    }

    cornerFinishGoalCache.set(cacheKey, goals);
    return goals;
  }

  function buildCornerFinishGoals(model, capability) {
    const normalizedCapability = normalizeFinishCapability(capability);
    const terminalTypes = ['parity'];
    if (normalizedCapability !== 'none') terminalTypes.push('ltct');
    if (normalizedCapability === 't2c') terminalTypes.push('t2c');
    return terminalTypes.flatMap((terminalType) => (
      buildCornerTerminalGoals(model, terminalType)
    ));
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
    allowCornerFloatingParity = false,
    terminalWeights = {},
  ) {
    const normalizedCapability = normalizeFinishCapability(capability);
    const weight = validateOrientationWeight(orientationWeight);
    const model = decomposeCornerState(state);
    const prepared = prepareReducedModel(model, selectedBuffers);
    const normalizedTerminalWeights = normalizeTerminalWeights(terminalWeights);
    const baseline = model.permutation_parity
      ? minimumExactCornerTerminalPlan(
          model,
          selectedBuffers,
          'none',
          false,
          weight,
          normalizedTerminalWeights,
        )
      : planPreparedReducedModel(prepared, weight);
    const optimized = model.permutation_parity
      && (normalizedCapability !== 'none' || allowCornerFloatingParity)
      ? minimumExactCornerTerminalPlan(
          model,
          selectedBuffers,
          normalizedCapability,
          allowCornerFloatingParity,
          weight,
          normalizedTerminalWeights,
        )
      : baseline;
    if (!baseline || !optimized) {
      throw new Error('No exact full-floating corner terminal plan for the current state.');
    }
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
      corner_floating_parity: Boolean(allowCornerFloatingParity),
      terminal_weights: normalizedTerminalWeights,
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

  function planCornerStateBySelectedBuffers(
    state,
    selectedBuffers,
    capability = 'none',
    orientationWeight = 1,
    allowCornerFloatingParity = false,
    terminalWeights = {},
  ) {
    if (isFullFloatingBufferSet(decomposeCornerState(state), selectedBuffers)) {
      return planCornerStateByResidues(
        state,
        selectedBuffers,
        capability,
        orientationWeight,
        allowCornerFloatingParity,
        terminalWeights,
      );
    }
    const normalizedCapability = normalizeFinishCapability(capability);
    const weight = validateOrientationWeight(orientationWeight);
    const normalizedTerminalWeights = normalizeTerminalWeights(terminalWeights);
    const model = decomposeCornerState(state);
    const baseline = model.permutation_parity
      ? minimumExactCornerTerminalPlan(
          model,
          selectedBuffers,
          'none',
          false,
          weight,
          normalizedTerminalWeights,
        )
      : planExactSelectedModel(
          model,
          selectedBuffers,
          'even-permutation',
          weight,
        );
    const optimized = model.permutation_parity
      && (normalizedCapability !== 'none' || allowCornerFloatingParity)
      ? minimumExactCornerTerminalPlan(
          model,
          selectedBuffers,
          normalizedCapability,
          allowCornerFloatingParity,
          weight,
          normalizedTerminalWeights,
        )
      : baseline;
    if (!baseline || !optimized) {
      throw new Error('No exact selected-buffer corner terminal plan for the current state.');
    }
    return {
      ...optimized,
      model,
      baseline_total_algs: baseline.total_algs,
      baseline_permutation_algs: baseline.permutation_algs,
      baseline_orientation_algs: baseline.orientation_algs,
      finish_capability: normalizedCapability,
      corner_floating_parity: Boolean(allowCornerFloatingParity),
      terminal_weights: normalizedTerminalWeights,
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

  function planEdgeStateBySelectedBuffers(
    state,
    parity,
    selectedBuffers,
    orientationWeight = 1,
    capability = 'none',
    terminalWeights = {},
  ) {
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
    const normalizedCapability = normalizeEdgeFinishCapability(capability);
    const canUseRootedTerminals = normalizedCapability !== 'none'
      && selectedBuffers.includes('UF')
      && selectedBuffers.includes('UR')
      && selectedBuffers.length >= 3;
    const selected = canUseRootedTerminals
      ? minimumExactRootedEdgePlan(
          model,
          selectedBuffers,
          normalizedCapability,
          orientationWeight,
          terminalWeights,
        )
      : isFullFloatingBufferSet(physicalModel, selectedBuffers)
      ? planReducedModel(model, selectedBuffers, orientationWeight)
      : planExactSelectedModel(
          model,
          selectedBuffers,
          'even-permutation',
          orientationWeight,
        );
    if (!selected) {
      throw new Error(`No exact pseudoswap edge plan for ${selectedBuffers.length} buffers.`);
    }
    return {
      ...selected,
      physical_state: state,
      goal_state: goalState,
      relative_state: relativeState,
      edge_finish_capability: canUseRootedTerminals ? normalizedCapability : 'none',
    };
  }

  function planEdgeStateByWeakswapFloating(
    state,
    parity,
    selectedBuffers,
    capability = '2e2e',
    orientationWeight = 1,
    terminalWeights = {},
    allowLtef = false,
  ) {
    const weight = validateOrientationWeight(orientationWeight);
    const normalizedCapability = normalizeEdgeFinishCapability(capability);
    const normalizedTerminalWeights = normalizeTerminalWeights(terminalWeights);
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

    // Weak floating is a product of a dedicated human start phase and a
    // rooted exact suffix. The suffix never acts on the original state until
    // the start phase authorizes a closure or an open F2E/FF2E anchor.
    const singleton = planEdgeStateBySingletonWeakswap(
      state,
      parity,
      weight,
    );
    const candidates = [{
      entry_mode: 'singleton',
      prefix_fixed_algs: singleton.permutation_algs,
      fixed_algs: singleton.permutation_algs + singleton.single_flip_algs,
      permutation_algs: singleton.permutation_algs,
      orientation_algs: singleton.orientation_algs,
      single_flip_algs: singleton.single_flip_algs,
      cost: singleton.total_algs,
    }];
    // The learned weak algsets are literal final algorithms and need no
    // artificial earlier switch. Do not generalize this exception to every
    // one-alg pseudo suffix: only sticker-valid 2E2E, F2E, and FF2E
    // terminals bypass the entry automaton.
    const directTerminal = directWeakFloatingTerminal(
      relativeState,
      selectedBuffers,
      normalizedCapability,
    );
    if (directTerminal) {
      const terminalType = directTerminal.replace('direct-', '');
      const terminalCost = normalizedTerminalWeights[terminalType];
      candidates.push({
        entry_mode: directTerminal,
        prefix_fixed_algs: 0,
        fixed_algs: terminalCost,
        permutation_algs: terminalCost,
        orientation_algs: 0,
        single_flip_algs: 0,
        finish: { type: terminalType, cost: terminalCost },
        cost: terminalCost,
      });
    }
    if (allowLtef && isLtefTerminalState(relativeState)) {
      const terminalCost = normalizedTerminalWeights.ltef;
      candidates.push({
        entry_mode: 'direct-ltef',
        prefix_fixed_algs: 0,
        fixed_algs: terminalCost,
        permutation_algs: terminalCost,
        orientation_algs: 0,
        single_flip_algs: 0,
        finish: { type: 'ltef', cost: terminalCost },
        cost: terminalCost,
      });
    }
    const weakEntryFrontier = enumerateWeakFloatingStarts(relativeState, {
      allow_ltef: allowLtef,
      selected_buffers: selectedBuffers,
    });
    const entries = weakEntryFrontier.entries;
    let eligibleEntryCount = 0;
    const capabilityRank = { none: 0, '2e2e': 1, f2e: 2, ff2e: 3 };
    for (const entry of entries) {
      if (
        capabilityRank[entry.required_capability] > capabilityRank[normalizedCapability]
      ) continue;
      if (entry.required_capability !== 'none' && selectedBuffers.length < 3) {
        continue;
      }
      eligibleEntryCount += 1;
      if (entry.terminal_type === 'ltef') {
        const terminalCost = normalizedTerminalWeights.ltef;
        candidates.push({
          entry_mode: 'ltef',
          required_capability: 'none',
          prefix_fixed_algs: entry.prefix_fixed_algs,
          fixed_algs: entry.prefix_fixed_algs + terminalCost,
          permutation_algs: entry.prefix_fixed_algs + terminalCost,
          orientation_algs: 0,
          single_flip_algs: 0,
          finish: { type: 'ltef', cost: terminalCost },
          cost: entry.prefix_fixed_algs + terminalCost,
        });
        continue;
      }
      const residualModel = decomposeEdgeState(entry.state);
      const suffix = minimumExactWeakswapFloatingPlan(
        residualModel,
        selectedBuffers,
        normalizedCapability,
        weight,
        normalizedTerminalWeights,
      );
      if (!suffix) continue;
      const suffixPermutationAlgs = suffix.permutation_algs;
      candidates.push({
        entry_mode: entry.mode,
        required_capability: entry.required_capability,
        prefix_fixed_algs: entry.prefix_fixed_algs,
        fixed_algs: entry.prefix_fixed_algs + suffixPermutationAlgs,
        permutation_algs: entry.prefix_fixed_algs + suffixPermutationAlgs,
        orientation_algs: suffix.orientation_algs,
        single_flip_algs: 0,
        finish: suffix.finish,
        cost: entry.prefix_fixed_algs + suffix.cost,
      });
    }
    candidates.sort((left, right) => (
      left.cost - right.cost
      || left.fixed_algs - right.fixed_algs
      || left.orientation_algs - right.orientation_algs
      || Number(Boolean(left.finish)) - Number(Boolean(right.finish))
      || left.entry_mode.localeCompare(right.entry_mode)
    ));
    const selected = candidates[0];
    if (!selected) {
      throw new Error(
        `No exact weakswap floating plan for ${selectedBuffers.length} buffers.`,
      );
    }
    return {
      complete: true,
      model,
      physical_state: state,
      goal_state: goalState,
      relative_state: relativeState,
      selected_buffers: [...selectedBuffers],
      orientation_weight: weight,
      weak_2e2e_capability: normalizedCapability,
      edge_finish_capability: normalizedCapability,
      allow_ltef: Boolean(allowLtef),
      weak_entry_mode: selected.entry_mode,
      weak_entry_required_capability: selected.required_capability || 'none',
      weak_entry_prefix_fixed_algs: selected.prefix_fixed_algs,
      weak_entry_count: eligibleEntryCount,
      weak_entry_explored_state_count: weakEntryFrontier.explored_state_count,
      fixed_algs: selected.fixed_algs,
      permutation_algs: selected.permutation_algs,
      orientation_algs: selected.orientation_algs,
      single_flip_algs: selected.single_flip_algs,
      total_algs: selected.cost,
      finish: selected.finish,
    };
  }

  function directWeakFloatingTerminal(relativeState, selectedBuffers, capability) {
    const normalizedCapability = normalizeEdgeFinishCapability(capability);
    if (normalizedCapability === 'none' || selectedBuffers.length < 3) return null;
    const capabilityRank = { none: 0, '2e2e': 1, f2e: 2, ff2e: 3 };
    const model = decomposeEdgeState(relativeState);
    const activeCycles = model.active_cycles;
    if (
      activeCycles.length !== 2
      || activeCycles.some((cycle) => cycle.length !== 2)
    ) return null;
    const root = activeCycles.find((cycle) => (
      cycle.slots.includes('UF') && cycle.slots.includes('UR')
    ));
    const floating = activeCycles.find((cycle) => cycle !== root);
    if (!root || !floating) return null;

    const selectedPieces = bufferPieces(model, selectedBuffers);
    selectedPieces.delete('UF');
    selectedPieces.delete('UR');
    const eligibleFloatingPair = floating.slots.some((piece) => selectedPieces.has(piece))
      || (
        isFullFloatingBufferSet(model, selectedBuffers)
        && floating.slots.includes('BR')
        && floating.slots.includes('BL')
      );
    if (!eligibleFloatingPair) return null;

    if (
      root.orientation_sum === 0
      && floating.orientation_sum === 0
      && relativeState.UF === 'UR'
      && relativeState.UR === 'UF'
    ) return 'direct-2e2e';
    if (
      capabilityRank[normalizedCapability] >= capabilityRank.f2e
      && root.orientation_sum === 1
      && floating.orientation_sum === 1
      && relativeState.UF === 'RU'
      && relativeState.UR === 'UF'
    ) return 'direct-f2e';
    if (
      capabilityRank[normalizedCapability] >= capabilityRank.ff2e
      && root.orientation_sum === 1
      && floating.orientation_sum === 1
      && relativeState.UF === 'UR'
      && relativeState.UR === 'FU'
    ) return 'direct-ff2e';
    return null;
  }

  function isLtefTerminalState(relativeState) {
    const model = decomposeEdgeState(relativeState);
    const active = model.active_cycles;
    if (active.length !== 2) return false;
    const root = active.find((cycle) => (
      cycle.length === 3
      && cycle.orientation_sum === 1
      && cycle.slots.includes('UF')
      && cycle.slots.includes('UR')
    ));
    const flip = active.find((cycle) => (
      cycle !== root
      && cycle.length === 1
      && cycle.orientation_sum === 1
    ));
    return Boolean(root && flip && relativeState.UR === 'UF');
  }

  function enumerateWeakFloatingStarts(relativeState, options = {}) {
    const model = decomposeEdgeState(relativeState);
    if (model.permutation_parity) {
      throw new Error('Weak floating entries require an even parity-relative state.');
    }
    const pieceGroupBySticker = new Map(model.piece_groups.flatMap((group) => (
      group.map((sticker) => [sticker, group])
    )));
    const canonicalPiece = (sticker) => pieceGroupBySticker.get(sticker)?.[0];
    const stateKey = (state) => EDGE_PIECE_GROUPS
      .map((group) => state[group[0]])
      .join(',');
    const rootStickers = new Set(['UF', 'FU', 'UR', 'RU']);
    const orientedRootStickers = new Set(['UF', 'UR']);
    const destinationStatus = (state) => {
      if (!rootStickers.has(state.UR)) return 'empty';
      return orientedRootStickers.has(state.UR) ? 'oriented' : 'flipped';
    };
    const pending = new Set();
    for (const group of EDGE_PIECE_GROUPS) {
      const piece = group[0];
      if (piece === 'UF') continue;
      if (piece === 'UR') {
        if (!['UR', 'UF'].includes(relativeState.UR)) pending.add(piece);
      } else if (canonicalPiece(relativeState[piece]) !== piece) {
        // Fixed flips stay available to the weighted suffix planner. The root
        // automaton only has to consume unresolved permutation pieces.
        pending.add(piece);
      }
    }

    const queue = [{
      state: relativeState,
      pending,
      target_count: 0,
    }];
    const seen = new Map();
    const entries = new Map();
    const completionTargetCounts = new Set();

    function addEntry(node, mode, requiredCapability = 'none', extra = {}) {
      const prefixFixedAlgs = node.target_count / 2;
      const key = `${requiredCapability}|${extra.terminal_type || 'suffix'}|${stateKey(node.state)}`;
      const previous = entries.get(key);
      if (previous && previous.prefix_fixed_algs <= prefixFixedAlgs) return;
      entries.set(key, {
        mode,
        required_capability: requiredCapability,
        prefix_fixed_algs: prefixFixedAlgs,
        state: node.state,
        ...extra,
      });
    }

    function addFf2eShotEntries(node) {
      for (const buffer of options.selected_buffers || []) {
        if (['UF', 'UR'].includes(buffer)) continue;
        const group = pieceGroupBySticker.get(buffer);
        if (!group) continue;
        for (const target of group) {
          const nextState = switchWithBufferInModel(node.state, model, 'UF', target);
          addEntry({
            ...node,
            state: nextState,
            target_count: node.target_count + 1,
          }, 'open-ff2e-anchor', 'ff2e');
        }
      }
    }

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const node = queue[cursor];
      const rootDestination = destinationStatus(node.state);
      const bufferValue = node.state.UF;
      const bufferIsRoot = rootStickers.has(bufferValue);
      const bufferIsOriented = orientedRootStickers.has(bufferValue);
      const visitKey = [
        stateKey(node.state),
        [...node.pending].sort().join('.'),
        node.target_count % 2,
      ].join('|');
      const previousTargets = seen.get(visitKey);
      if (previousTargets !== undefined && previousTargets <= node.target_count) continue;
      seen.set(visitKey, node.target_count);

      if (
        options.allow_ltef
        && !(node.target_count % 2)
        && isLtefTerminalState(node.state)
      ) {
        addEntry(node, 'ltef', 'none', { terminal_type: 'ltef' });
      }

      if (
        !(node.target_count % 2)
        && node.pending.size === 1
        && node.pending.has('UR')
      ) {
        // The correctly placed flipped UR survived until every permutation
        // cycle was closed. Canonical weak tracing leaves it as an ordinary
        // flip instead of forcing one last UR break. The post-entry suffix may
        // pair it with another fixed flip without needing F2E or FF2E.
        addEntry(node, 'surviving-ur-flip');
        completionTargetCounts.add(node.target_count);
        continue;
      }
      if (!(node.target_count % 2) && bufferIsRoot) {
        if (rootDestination === 'empty') {
          if (node.target_count > 0 && bufferIsOriented) {
            // The first UF/UR piece was hit on an even target and is oriented:
            // the human weak cycle is closed and execution may float from UR.
            addEntry(node, 'first-root-even-oriented');
            completionTargetCounts.add(node.target_count);
            continue;
          }
          if (node.target_count > 0) {
            // An even misoriented first root may remain open only with F2E.
            // Lower capabilities keep tracing and solve it into RU below.
            addEntry(node, 'open-f2e-anchor', 'f2e');
          }
        } else if (rootDestination === 'oriented') {
          if (bufferIsOriented) {
            addEntry(node, 'clean-even');
            completionTargetCounts.add(node.target_count);
            continue;
          }
          addEntry(node, 'open-f2e-anchor', 'f2e');
        } else if (bufferIsOriented) {
          // A flipped edge already occupies UR. FF2E alone may preserve this
          // root and shoot to any selected floating buffer.
          addEntry(node, 'open-ff2e-anchor', 'ff2e');
        }
      } else if (
        node.target_count % 2
        && rootDestination === 'flipped'
        && bufferIsRoot
        && bufferIsOriented
      ) {
        // The previous odd target and this shot form one complete comm. Try
        // every selected floating buffer; a deterministic next-buffer choice
        // would discard legal FF2E savings.
        addFf2eShotEntries(node);
      }
      if (!node.pending.size) {
        completionTargetCounts.add(node.target_count + (node.target_count % 2));
        continue;
      }
      let choices = [];
      let consumedPiece = null;
      if (bufferIsRoot && rootDestination === 'empty') {
        choices = [[
          ['UR', 'RU'].includes(bufferValue)
            ? bufferValue
            : bufferValue === 'UF' ? 'UR' : 'RU',
          'UR',
        ]];
      } else if (
        bufferIsRoot
        && rootDestination === 'flipped'
        && node.target_count % 2
      ) {
        // With a flipped root in UR, the non-FF2E odd-target continuation is
        // forced through the matching UR/RU sticker before any later float.
        choices = [[bufferIsOriented ? 'UR' : 'RU', 'UR']];
      } else if (
        !rootStickers.has(bufferValue)
        && node.pending.has(canonicalPiece(bufferValue))
      ) {
        consumedPiece = canonicalPiece(bufferValue);
        choices = [[bufferValue, consumedPiece]];
      } else {
        for (const piece of node.pending) {
          const group = pieceGroupBySticker.get(piece);
          for (const sticker of group) choices.push([sticker, null]);
        }
      }

      const nextKeys = new Set();
      for (const [target, explicitlyConsumed] of choices) {
        const nextState = switchWithBufferInModel(node.state, model, 'UF', target);
        const nextPending = new Set(node.pending);
        const removed = explicitlyConsumed || consumedPiece;
        if (removed) nextPending.delete(removed);
        const nextKey = `${stateKey(nextState)}|${[...nextPending].sort().join('.')}`;
        if (nextKeys.has(nextKey)) continue;
        nextKeys.add(nextKey);
        queue.push({
          state: nextState,
          pending: nextPending,
          target_count: node.target_count + 1,
        });
      }
    }
    return {
      entries: [...entries.values()],
      explored_state_count: seen.size,
      completion_target_counts: [...completionTargetCounts].sort((left, right) => left - right),
    };
  }

  function enumerateWeakFloatingEntries(relativeState) {
    return enumerateWeakFloatingStarts(relativeState);
  }

  function planEdgeStateBySingletonWeakswap(
    state,
    parity,
    orientationWeight = 1,
    terminalWeights = {},
    allowLtef = false,
  ) {
    const weight = validateOrientationWeight(orientationWeight);
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

    const permutationCycles = model.cycles.filter((cycle) => cycle.length > 1);
    const externalPermutationCycles = permutationCycles.filter(
      (cycle) => !cycle.slots.includes('UF'),
    );
    let targetCount = permutationCycles.reduce((sum, cycle) => (
      sum + cycle.length + (cycle.slots.includes('UF') ? -1 : 1)
    ), 0);

    // In the parity-relative frame, RU in the UR slot is precisely the
    // correctly placed but flipped weak destination. It survives as a flip
    // only when no external permutation cycle forces an earlier UR closure.
    const correctUrPieceFlipped = relativeState.UR === 'RU';
    const forcedUrBreak = correctUrPieceFlipped && externalPermutationCycles.length > 0;
    if (forcedUrBreak) targetCount += 2;
    if (targetCount % 2) {
      throw new Error('Singleton weakswap must finish with an even target count.');
    }

    const ordinaryFlips = model.cycles.filter((cycle) => (
      cycle.length === 1
      && cycle.orientation_sum === 1
      && !cycle.slots.includes('UF')
      && !cycle.slots.includes('UR')
    )).length;
    const urSurvivesAsFlip = correctUrPieceFlipped && !forcedUrBreak;
    const flipCount = ordinaryFlips + Number(urSurvivesAsFlip);
    const orientationAlgs = Math.floor(flipCount / 2);
    const singleFlipAlgs = flipCount % 2;
    const permutationAlgs = targetCount / 2;
    const ordinaryTotal = permutationAlgs + orientationAlgs * weight + singleFlipAlgs;
    const normalizedTerminalWeights = normalizeTerminalWeights(terminalWeights);
    // LTEF is a terminal, not only a direct-state shortcut. A legal weak
    // prefix may consume one or more complete comms before leaving the exact
    // UF/UR/X + flip shape. Reuse the physical weak-entry automaton for that
    // prefix instead of checking only the initial relative state.
    const ltefEntry = Boolean(allowLtef)
      ? enumerateWeakFloatingStarts(relativeState, {
          allow_ltef: true,
          selected_buffers: ['UF'],
        }).entries
        .filter((entry) => entry.terminal_type === 'ltef')
        .sort((left, right) => left.prefix_fixed_algs - right.prefix_fixed_algs)[0]
      : null;
    const ltefTotal = ltefEntry
      ? ltefEntry.prefix_fixed_algs + normalizedTerminalWeights.ltef
      : Infinity;
    const useLtef = ltefTotal < ordinaryTotal - 1e-12;

    return {
      complete: true,
      model,
      physical_state: state,
      goal_state: goalState,
      relative_state: relativeState,
      orientation_weight: weight,
      target_count: targetCount,
      flip_count: useLtef ? 0 : flipCount,
      permutation_algs: useLtef ? ltefTotal : permutationAlgs,
      orientation_algs: useLtef ? 0 : orientationAlgs,
      single_flip_algs: useLtef ? 0 : singleFlipAlgs,
      total_algs: useLtef ? ltefTotal : ordinaryTotal,
      ...(useLtef ? {
        finish: {
          type: 'ltef',
          cost: normalizedTerminalWeights.ltef,
          prefix_fixed_algs: ltefEntry.prefix_fixed_algs,
        },
      } : {}),
      weakswap: {
        correct_ur_piece_flipped: correctUrPieceFlipped,
        external_permutation_cycle_count: externalPermutationCycles.length,
        forced_ur_break: forcedUrBreak,
        ur_survives_as_flip: urSurvivesAsFlip,
        ordinary_flip_count: ordinaryFlips,
      },
    };
  }

  const api = {
    FULL_CORNER_BUFFERS,
    FULL_EDGE_BUFFERS,
    buildCornerFinishGoals,
    buildCornerTerminalGoals,
    buildParityEdgeGoal,
    isFullFloatingBufferSet,
    planCornerStateByResidues,
    planCornerStateBySelectedBuffers,
    planCornerStateByTerminalEnumeration,
    planEdgeStateByResidues,
    planEdgeStateBySelectedBuffers,
    planEdgeStateBySingletonWeakswap,
    planEdgeStateByWeakswapFloating,
    directWeakFloatingTerminal,
    enumerateWeakFloatingEntries,
    enumerateWeakFloatingStarts,
    isLtefTerminalState,
    proveFullBufferCoverage,
    normalizeWeak2e2eCapability,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
