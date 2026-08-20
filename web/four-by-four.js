(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? {
        ...require('./big-cube-model'),
        ...require('./buffer-selection'),
        ...require('./cycle-model'),
        ...require('./cycle-residue-planner'),
      }
    : global.SsiCoreModules;

  const {
    buildBigCubeState,
    decomposeCornerState,
    normalizeBigCubeMoves,
    normalizeCornerBuffers,
    planCornerStateBySelectedBuffers,
    stateRelativeToGoal,
    WING_LOCATIONS,
    XCENTER_LOCATIONS,
  } = deps;

  const WING_BUFFER = 'UFr';
  const WING_PARITY_TARGET = 'BUr';
  const XCENTER_BUFFER = 'Ubl';
  const XCENTER_HELPER = 'Ubr';
  const BIG_MOVE_START_RE = /(^|\s)(?:(?:3)?[UDRLFB]w|[UDRLFBxyzXYZMESmesudlrfb])(?:2'?|')?(?=\s|$)/;
  const BIG_MOVE_TOKEN_RE = /^(?:(?:3)?[UDRLFB]w|[UDRLFBxyzXYZMESmesudlrfb])(?:2'?|')?$/;
  const WCA_ROW_PREFIX_RE = /^(?:[A-Z]\s+)?(?:\d+|Extra\s+\d+)\s+/;
  const U_XCENTERS = Object.freeze(XCENTER_LOCATIONS.filter((location) => (
    location[0] === 'U'
  )));

  function normalizeWingParityCapability(value) {
    if (value == null || value === '' || value === false) return 'basic';
    if (value === true) return 'full';
    const normalized = String(value).toLowerCase();
    if (['basic', 'full'].includes(normalized)) return normalized;
    throw new Error(`Unknown wing parity capability: ${value}`);
  }

  function solvedWingState() {
    return Object.fromEntries(WING_LOCATIONS.map((location) => [location, location]));
  }

  function wingGoalState(cornerParity = false) {
    const goal = solvedWingState();
    if (cornerParity) {
      [goal.UFr, goal.URb] = [goal.URb, goal.UFr];
      [goal.FUl, goal.RUf] = [goal.RUf, goal.FUl];
    }
    return goal;
  }

  function firstUnsolvedUniqueLocation(state, order, except = null) {
    return order.find((location) => (
      location !== except && state[location] !== location
    )) || null;
  }

  function traceWingState(state, cornerParity = false) {
    let virtual = stateRelativeToGoal(state, wingGoalState(cornerParity));
    const targets = [];
    const maximumTargets = WING_LOCATIONS.length * 2;

    while (true) {
      const unsolved = firstUnsolvedUniqueLocation(
        virtual,
        WING_LOCATIONS,
        WING_BUFFER,
      );
      if (virtual[WING_BUFFER] === WING_BUFFER && !unsolved) break;

      const target = virtual[WING_BUFFER] === WING_BUFFER
        ? unsolved
        : virtual[WING_BUFFER];
      if (!target || target === WING_BUFFER || !WING_LOCATIONS.includes(target)) {
        throw new Error(`Invalid wing trace target: ${target}`);
      }
      [virtual[WING_BUFFER], virtual[target]] = [
        virtual[target],
        virtual[WING_BUFFER],
      ];
      targets.push(target);
      if (targets.length > maximumTargets) {
        throw new Error('Wing trace exceeded its deterministic safety bound.');
      }
    }

    return {
      corner_parity: Boolean(cornerParity),
      goal: wingGoalState(cornerParity),
      targets,
      target_count: targets.length,
      last_target: targets.at(-1) || null,
    };
  }

  function countWingTrace(trace, parityCapability = 'basic') {
    const capability = normalizeWingParityCapability(parityCapability);
    const targetCount = trace.target_count;
    if (!(targetCount % 2)) {
      return {
        capability,
        algs: targetCount / 2,
        parity: false,
        parity_finish: null,
        execution_targets: [...trace.targets],
      };
    }

    const directParity = capability === 'full'
      || trace.last_target === WING_PARITY_TARGET;
    return {
      capability,
      algs: directParity
        ? (targetCount - 1) / 2 + 1
        : (targetCount + 1) / 2 + 1,
      parity: true,
      parity_finish: directParity ? 'direct' : 'buffered-through-BUr',
      execution_targets: directParity
        ? [...trace.targets]
        : [...trace.targets, WING_PARITY_TARGET],
    };
  }

  function xcenterSolved(state, location) {
    return state[location] === location[0];
  }

  function firstUnsolvedXcenter(state) {
    return XCENTER_LOCATIONS.find((location) => !xcenterSolved(state, location)) || null;
  }

  function chooseXcenterTarget(state) {
    const carriedColor = state[XCENTER_BUFFER];
    if (!/^[UDRLFB]$/.test(carriedColor)) {
      throw new Error(`Invalid xcenter color in ${XCENTER_BUFFER}: ${carriedColor}`);
    }

    if (carriedColor === 'U') {
      const openUSlot = U_XCENTERS.find((location) => (
        location !== XCENTER_BUFFER && !xcenterSolved(state, location)
      ));
      if (openUSlot) return { target: openUSlot, reason: 'open-U-slot' };
      return { target: firstUnsolvedXcenter(state), reason: 'cycle-break' };
    }

    const matchingSlots = XCENTER_LOCATIONS.filter((location) => (
      location[0] === carriedColor && !xcenterSolved(state, location)
    ));
    const nonUTarget = matchingSlots.find((location) => state[location] !== 'U');
    return {
      target: nonUTarget || matchingSlots[0] || null,
      reason: nonUTarget ? 'matching-non-U' : 'matching-U',
    };
  }

  function traceXcenterState(state) {
    let virtual = { ...state };
    const targets = [];
    const decisions = [];
    const maximumTargets = XCENTER_LOCATIONS.length * 2;

    while (firstUnsolvedXcenter(virtual)) {
      const { target, reason } = chooseXcenterTarget(virtual);
      if (!target || target === XCENTER_BUFFER) {
        throw new Error(`Invalid xcenter trace target: ${target}`);
      }
      const carried_color = virtual[XCENTER_BUFFER];
      const target_color = virtual[target];
      [virtual[XCENTER_BUFFER], virtual[target]] = [
        virtual[target],
        virtual[XCENTER_BUFFER],
      ];
      targets.push(target);
      decisions.push({ target, reason, carried_color, target_color });
      if (targets.length > maximumTargets) {
        throw new Error('Xcenter trace exceeded its deterministic safety bound.');
      }
    }

    return {
      buffer: XCENTER_BUFFER,
      helper: XCENTER_HELPER,
      targets,
      target_count: targets.length,
      execution_targets: targets.length % 2
        ? [...targets, XCENTER_HELPER]
        : [...targets],
      algs: Math.ceil(targets.length / 2),
      decisions,
    };
  }

  function normalizeFourByFourOptions(options = {}) {
    return {
      oriented_corner_sticker: options.oriented_corner_sticker
        ?? options.orientedCornerSticker
        ?? 'UFR',
      corner_buffers: normalizeCornerBuffers(
        options.corner_buffers ?? options.cornerBuffers ?? ['UFR'],
      ),
      corner_finish_capability: options.corner_finish_capability
        ?? options.cornerFinishCapability
        ?? 'none',
      corner_floating_parity: Boolean(
        options.corner_floating_parity ?? options.cornerFloatingParity,
      ),
      twist_weight: options.twist_weight ?? options.twistWeight ?? 1,
      terminal_weights: options.terminal_weights ?? options.terminalWeights ?? {},
      wing_parity_capability: normalizeWingParityCapability(
        options.wing_parity_capability ?? options.wingParityCapability,
      ),
    };
  }

  function extractBigCubeScrambleRecords(text, includeDnfs = false, size = 4) {
    if (typeof text !== 'string') throw new Error('Scrambles must be text.');
    const records = [];
    for (let line of text.trim().split(/\r?\n/)) {
      line = line.trim().replace(/\[.*\]/g, '');
      const lower = line.toLowerCase();
      if (['generated by cstimer', 'solves/total', 'single', 'best', 'worst', 'avg of', 'current', 'average', 'mean', 'time list'].some((phrase) => lower.includes(phrase))) continue;
      const isDnf = /DNF/.test(line);
      if (!includeDnfs && isDnf) continue;
      line = line.replace(/DNF/g, '').replace(WCA_ROW_PREFIX_RE, '');
      const matchMove = line.match(BIG_MOVE_START_RE);
      if (!matchMove || matchMove.index === undefined) continue;
      line = line.slice(matchMove.index + matchMove[1].length);
      const atIndex = line.indexOf('@');
      if (atIndex !== -1) line = line.slice(0, atIndex);
      line = line.trim();
      if (!line) continue;
      const moves = line.split(/\s+/);
      if (!moves.every((move) => BIG_MOVE_TOKEN_RE.test(move))) continue;
      // Size-specific validation (notably 3-wide and lowercase m/e/s) lives in
      // the shared parser, so extraction cannot silently accept a 5x5 token.
      normalizeBigCubeMoves(line, size);
      records.push({ scramble: line, dnf: isDnf });
    }
    return records;
  }

  function analyzeFourByFour(scramble, options = {}) {
    const normalized = normalizeFourByFourOptions(options);
    const state = buildBigCubeState(
      scramble,
      4,
      normalized.oriented_corner_sticker,
    );
    const cornerPlan = planCornerStateBySelectedBuffers(
      state.corners,
      normalized.corner_buffers,
      normalized.corner_finish_capability,
      normalized.twist_weight,
      normalized.corner_floating_parity,
      normalized.terminal_weights,
    );
    const cornerParity = Boolean(decomposeCornerState(state.corners).permutation_parity);
    const wingTrace = traceWingState(state.wings, cornerParity);
    const wingCount = countWingTrace(wingTrace, normalized.wing_parity_capability);
    const xcenterTrace = traceXcenterState(state.xcenters);
    const cornerAlgs = rounded(cornerPlan.total_algs);
    const totalAlgs = rounded(cornerAlgs + wingCount.algs + xcenterTrace.algs);

    return {
      puzzle: '4x4',
      scramble,
      orientation: {
        corner_sticker_at_UFR: normalized.oriented_corner_sticker,
        tracing_orientation: state.tracing_orientation,
      },
      normalized_moves: [...state.normalized_moves],
      executed_moves: [...state.executed_moves],
      total_algs: totalAlgs,
      corner_algs: cornerAlgs,
      wing_algs: wingCount.algs,
      xcenter_algs: xcenterTrace.algs,
      corner_parity: cornerParity,
      corners: {
        buffers: normalized.corner_buffers,
        finish_capability: normalized.corner_finish_capability,
        floating_parity: normalized.corner_floating_parity,
        plan: cornerPlan,
      },
      wings: {
        ...wingTrace,
        ...wingCount,
      },
      xcenters: xcenterTrace,
    };
  }

  function rounded(value) {
    return Number(value.toFixed(5));
  }

  function analyzeFourByFourSet(text, options = {}) {
    const includeDnfs = Boolean(options.dnf ?? options.includeDnfs);
    const records = extractBigCubeScrambleRecords(text, includeDnfs, 4);
    if (!records.length) throw new Error('No valid 4x4 scrambles found.');
    const breakdowns = records.map((record) => ({
      ...analyzeFourByFour(record.scramble, options),
      dnf: record.dnf,
    }));
    const distribution = {};
    for (const result of breakdowns) {
      distribution[result.total_algs] = (distribution[result.total_algs] || 0) + 1;
    }
    const sortedDistribution = Object.fromEntries(
      Object.entries(distribution)
        .map(([algs, count]) => [Number(algs), count])
        .sort(([left], [right]) => left - right),
    );
    const totalAlgs = rounded(breakdowns.reduce((sum, result) => sum + result.total_algs, 0));
    return {
      puzzle: '4x4',
      number_of_solves: breakdowns.length,
      distribution: sortedDistribution,
      average_algs: breakdowns.length ? rounded(totalAlgs / breakdowns.length) : 0,
      total_algs: totalAlgs,
      total_corner_algs: rounded(breakdowns.reduce((sum, result) => sum + result.corner_algs, 0)),
      total_wing_algs: rounded(breakdowns.reduce((sum, result) => sum + result.wing_algs, 0)),
      total_xcenter_algs: rounded(breakdowns.reduce((sum, result) => sum + result.xcenter_algs, 0)),
      breakdowns,
    };
  }

  const api = {
    analyzeFourByFour,
    analyzeFourByFourSet,
    chooseXcenterTarget,
    countWingTrace,
    extractBigCubeScrambleRecords,
    normalizeFourByFourOptions,
    normalizeWingParityCapability,
    solvedWingState,
    traceWingState,
    traceXcenterState,
    wingGoalState,
    WING_BUFFER,
    WING_PARITY_TARGET,
    XCENTER_BUFFER,
    XCENTER_HELPER,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
