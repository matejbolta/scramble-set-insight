self.importScripts(
  './buffer-selection.js?v=fixed-5x5-orientation-v1',
  './wide-move-translator.js?v=fixed-5x5-orientation-v1',
  './scrambling.js?v=fixed-5x5-orientation-v1',
  './corner-tracing.js?v=fixed-5x5-orientation-v1',
  './edge-common.js?v=fixed-5x5-orientation-v1',
  './cycle-model.js?v=fixed-5x5-orientation-v1',
  './cycle-residue.js?v=fixed-5x5-orientation-v1',
  './cycle-residue-planner.js?v=fixed-5x5-orientation-v1',
  './finalizing.js?v=fixed-5x5-orientation-v1',
  './big-cube-model.js?v=fixed-5x5-orientation-v1',
  './big-cube-tracing.js?v=fixed-5x5-orientation-v1',
  './four-by-four.js?v=fixed-5x5-orientation-v1',
  './five-by-five.js?v=fixed-5x5-orientation-v1',
  './ssi-core.js?v=fixed-5x5-orientation-v1',
);

const backend = self.SsiCore;
const bigCubeBackend = self.SsiCoreModules;

function rounded(value) {
  return Number(value.toFixed(5));
}

function bigCubeOptions(payload, overrides = {}) {
  return {
    dnf: payload.dnf,
    orientedCornerSticker: payload.orientedCornerSticker,
    cornerBuffers: payload.cornerBuffers,
    cornerFinishCapability: payload.finishCapability,
    cornerFloatingParity: payload.advancedOptions?.corner_floating_parity,
    twistWeight: payload.twistWeight,
    terminalWeights: payload.advancedOptions?.terminal_weights,
    wingParityCapability: payload.wingParityCapability,
    midgeBuffers: payload.midgeBuffers ?? payload.edgeBuffers,
    midgeFinishCapability: 'none',
    flipWeight: payload.flipWeight,
    ...overrides,
  };
}

function analyzeBigCubeSet(payload, overrides = {}) {
  const options = bigCubeOptions(payload, overrides);
  return payload.puzzle === '4x4'
    ? bigCubeBackend.analyzeFourByFourSet(payload.scrambles, options)
    : bigCubeBackend.analyzeFiveByFiveSet(payload.scrambles, options);
}

function attachBigCubeComparisons(result, noFinishResult, optimalResult, finishCapability) {
  const componentKeys = result.puzzle === '4x4'
    ? ['corner_algs', 'wing_algs', 'xcenter_algs']
    : ['corner_algs', 'midge_algs', 'wing_algs', 'xcenter_algs', 'pluscenter_algs'];

  result.breakdowns.forEach((breakdown, index) => {
    const noFinish = noFinishResult?.breakdowns[index];
    const optimal = optimalResult?.breakdowns[index];
    if (noFinish) {
      breakdown.finish_baseline_total_algs = noFinish.total_algs;
      for (const key of componentKeys) breakdown[`finish_baseline_${key}`] = noFinish[key];
    }
    if (optimal) {
      breakdown.optimal_total_algs = optimal.total_algs;
      for (const key of componentKeys) breakdown[`optimal_${key}`] = optimal[key];
      breakdown.optimal_orientation = optimal.orientation;
    }
  });

  const hasFinishComparison = Boolean(noFinishResult);
  const hasOrientationComparison = Boolean(optimalResult);
  result.comparison = {
    has_finish_comparison: hasFinishComparison,
    finish_capability: finishCapability,
    finish_baseline_total_algs: noFinishResult?.total_algs,
    finish_baseline_average_algs: noFinishResult?.average_algs,
    finish_saved_algs: hasFinishComparison
      ? rounded(Math.max(0, noFinishResult.total_algs - result.total_algs))
      : 0,
    has_orientation_comparison: hasOrientationComparison,
    optimal_total_algs: optimalResult?.total_algs,
    optimal_average_algs: optimalResult?.average_algs,
    orientation_missed_algs: hasOrientationComparison
      ? rounded(Math.max(0, result.total_algs - optimalResult.total_algs))
      : 0,
  };
}

self.onmessage = (event) => {
  const { id, type, payload } = event.data;
  try {
    if (type !== 'analyze') throw new Error(`Unknown worker message type: ${type}`);
    if (payload.puzzle === '4x4' || payload.puzzle === '5x5') {
      const result = analyzeBigCubeSet(payload);
      const advancedOptions = payload.advancedOptions || {};
      const hasFinishComparison = (payload.finishCapability || 'none') !== 'none'
        || Boolean(advancedOptions.corner_floating_parity);
      const noFinishResult = hasFinishComparison
        ? analyzeBigCubeSet(payload, {
            cornerFinishCapability: 'none',
            cornerFloatingParity: false,
            midgeFinishCapability: 'none',
          })
        : null;
      const optimalResult = payload.puzzle === '4x4'
        && payload.compareOptimalOrientation
        && payload.orientedCornerSticker !== 'optimal'
        ? analyzeBigCubeSet(payload, { orientedCornerSticker: 'optimal' })
        : null;
      attachBigCubeComparisons(
        result,
        noFinishResult,
        optimalResult,
        payload.finishCapability || 'none',
      );
      self.postMessage({ id, ok: true, result });
      return;
    }
    const finishCapability = backend.normalizeFinishCapability(
      payload.finishCapability ?? payload.ltct,
    );
    const weak2e2eCapability = backend.normalizeWeak2e2eCapability(
      payload.weak2e2eCapability ?? Boolean(payload.weak2e2ePrime),
    );
    const result = backend.algCounterMain(
      payload.scrambles,
      payload.tracingOrientation,
      payload.edgeMethod,
      payload.flipWeight,
      payload.twistWeight,
      finishCapability,
      payload.dnf,
      payload.cornerBuffers,
      payload.edgeBuffers,
      weak2e2eCapability,
      payload.advancedOptions,
    );

    const hasFloatingComparison = payload.bufferMode !== 'standard';
    const advancedOptions = payload.advancedOptions || {};
    const hasFinishComparison = finishCapability !== 'none'
      || Boolean(advancedOptions.corner_floating_parity)
      || (advancedOptions.edge_finish_capability || 'none') !== 'none'
      || Boolean(advancedOptions.ltef);
    const noAdvancedOptions = {
      corner_floating_parity: false,
      edge_finish_capability: 'none',
      ltef: false,
      terminal_weights: advancedOptions.terminal_weights || {},
    };
    let standardResult = null;
    let noFinishResult = null;

    if (hasFloatingComparison) {
      standardResult = backend.algCounterMain(
        payload.scrambles,
        payload.tracingOrientation,
        payload.edgeMethod,
        payload.flipWeight,
        payload.twistWeight,
        'none',
        payload.dnf,
        ['UFR'],
        ['UF'],
        'none',
        noAdvancedOptions,
      );
    }

    if (hasFinishComparison) {
      noFinishResult = backend.algCounterMain(
        payload.scrambles,
        payload.tracingOrientation,
        payload.edgeMethod,
        payload.flipWeight,
        payload.twistWeight,
        'none',
        payload.dnf,
        payload.cornerBuffers,
        payload.edgeBuffers,
        'none',
        noAdvancedOptions,
      );
    }

    if (hasFloatingComparison || hasFinishComparison) {
      const baselineResult = standardResult || noFinishResult;

      if (baselineResult[9].length !== result[9].length) {
        throw new Error('Baseline and analyzed result lengths do not match.');
      }

      result[9].forEach((breakdown, index) => {
        const baselineBreakdown = baselineResult[9][index];
        Object.assign(breakdown, {
          baseline_total_algs: baselineBreakdown.total_algs,
          baseline_corner_algs: baselineBreakdown.corner_algs,
          baseline_edge_algs: baselineBreakdown.edge_algs,
        });
      });

      const baselineTotalAlgs = baselineResult[3];
      const floatingSavedAlgs = hasFloatingComparison
        ? rounded(Math.max(0, standardResult[3] - (noFinishResult || result)[3]))
        : 0;
      const finishSavedAlgs = hasFinishComparison
        ? rounded(Math.max(0, noFinishResult[3] - result[3]))
        : 0;
      result[10] = {
        baseline_total_algs: baselineTotalAlgs,
        combined_saved_algs: rounded(Math.max(0, baselineTotalAlgs - result[3])),
        has_floating_comparison: hasFloatingComparison,
        floating_saved_algs: floatingSavedAlgs,
        total_saved_algs: floatingSavedAlgs,
        has_finish_comparison: hasFinishComparison,
        finish_capability: finishCapability,
        finish_saved_algs: finishSavedAlgs,
        has_ltct_comparison: finishCapability === 'ltct',
        ltct_saved_algs: finishCapability === 'ltct' ? finishSavedAlgs : 0,
      };
    }

    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
