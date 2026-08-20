(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? {
        ...require('./big-cube-model'),
        ...require('./big-cube-tracing'),
        ...require('./buffer-selection'),
        ...require('./cycle-model'),
        ...require('./cycle-residue-planner'),
      }
    : global.SsiCoreModules;

  const {
    buildBigCubeState,
    countWingTrace,
    decomposeCornerState,
    extractBigCubeScrambleRecords,
    normalizeCornerBuffers,
    normalizeEdgeBuffers,
    normalizeWingParityCapability,
    planCornerStateBySelectedBuffers,
    planEdgeStateBySelectedBuffers,
    tracePluscenterState,
    traceWingState,
    traceXcenterState,
  } = deps;

  function normalizeFiveByFiveOptions(options = {}) {
    const midgeBuffers = normalizeEdgeBuffers(
      options.midge_buffers
        ?? options.midgeBuffers
        ?? options.edge_buffers
        ?? options.edgeBuffers
        ?? ['UF'],
      'pseudoswap',
    );
    return {
      // Fixed true centers determine the 5x5 tracing frame uniquely.
      oriented_corner_sticker: 'UFR',
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
      midge_buffers: midgeBuffers,
      // Midge parity terminal algsets do not exist. Corner parity execution
      // fixes the parity-relative UF/UR midge goal.
      midge_finish_capability: 'none',
      flip_weight: options.flip_weight ?? options.flipWeight ?? 1,
      terminal_weights: options.terminal_weights ?? options.terminalWeights ?? {},
      wing_parity_capability: normalizeWingParityCapability(
        options.wing_parity_capability ?? options.wingParityCapability,
      ),
    };
  }

  function rounded(value) {
    return Number(value.toFixed(5));
  }

  function analyzeFiveByFive(scramble, options = {}) {
    const normalized = normalizeFiveByFiveOptions(options);
    const state = buildBigCubeState(
      scramble,
      5,
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
    const midgePlan = planEdgeStateBySelectedBuffers(
      state.midges,
      cornerParity,
      normalized.midge_buffers,
      normalized.flip_weight,
      normalized.midge_finish_capability,
      normalized.terminal_weights,
    );
    const wingTrace = traceWingState(state.wings, cornerParity);
    const wingCount = countWingTrace(wingTrace, normalized.wing_parity_capability);
    const xcenterTrace = traceXcenterState(state.xcenters);
    const pluscenterTrace = tracePluscenterState(state.pluscenters);
    const cornerAlgs = rounded(cornerPlan.total_algs);
    const midgeAlgs = rounded(midgePlan.total_algs);
    const totalAlgs = rounded(
      cornerAlgs
      + midgeAlgs
      + wingCount.algs
      + xcenterTrace.algs
      + pluscenterTrace.algs,
    );

    return {
      puzzle: '5x5',
      scramble,
      orientation: {
        corner_sticker_at_UFR: normalized.oriented_corner_sticker,
        tracing_orientation: state.tracing_orientation,
      },
      normalized_moves: [...state.normalized_moves],
      executed_moves: [...state.executed_moves],
      total_algs: totalAlgs,
      corner_algs: cornerAlgs,
      midge_algs: midgeAlgs,
      wing_algs: wingCount.algs,
      xcenter_algs: xcenterTrace.algs,
      pluscenter_algs: pluscenterTrace.algs,
      corner_parity: cornerParity,
      corners: {
        buffers: normalized.corner_buffers,
        finish_capability: normalized.corner_finish_capability,
        floating_parity: normalized.corner_floating_parity,
        plan: cornerPlan,
      },
      midges: {
        buffers: normalized.midge_buffers,
        finish_capability: normalized.midge_finish_capability,
        plan: midgePlan,
      },
      wings: {
        ...wingTrace,
        ...wingCount,
      },
      xcenters: xcenterTrace,
      pluscenters: pluscenterTrace,
    };
  }

  function analyzeFiveByFiveSet(text, options = {}) {
    const includeDnfs = Boolean(options.dnf ?? options.includeDnfs);
    const records = extractBigCubeScrambleRecords(text, includeDnfs, 5);
    if (!records.length) throw new Error('No valid 5x5 scrambles found.');
    const breakdowns = records.map((record) => ({
      ...analyzeFiveByFive(record.scramble, options),
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
      puzzle: '5x5',
      number_of_solves: breakdowns.length,
      distribution: sortedDistribution,
      average_algs: breakdowns.length ? rounded(totalAlgs / breakdowns.length) : 0,
      total_algs: totalAlgs,
      total_corner_algs: rounded(breakdowns.reduce((sum, result) => sum + result.corner_algs, 0)),
      total_midge_algs: rounded(breakdowns.reduce((sum, result) => sum + result.midge_algs, 0)),
      total_wing_algs: rounded(breakdowns.reduce((sum, result) => sum + result.wing_algs, 0)),
      total_xcenter_algs: rounded(breakdowns.reduce((sum, result) => sum + result.xcenter_algs, 0)),
      total_pluscenter_algs: rounded(
        breakdowns.reduce((sum, result) => sum + result.pluscenter_algs, 0),
      ),
      breakdowns,
    };
  }

  const api = {
    analyzeFiveByFive,
    analyzeFiveByFiveSet,
    normalizeFiveByFiveOptions,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
