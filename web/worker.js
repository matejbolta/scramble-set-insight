self.importScripts(
  './buffer-selection.js?v=weak-capability-v2',
  './wide-move-translator.js?v=weak-capability-v2',
  './scrambling.js?v=weak-capability-v2',
  './corner-tracing.js?v=weak-capability-v2',
  './edge-common.js?v=weak-capability-v2',
  './cycle-model.js?v=weak-capability-v2',
  './cycle-residue.js?v=weak-capability-v2',
  './cycle-residue-planner.js?v=weak-capability-v2',
  './finalizing.js?v=weak-capability-v2',
  './ssi-core.js?v=weak-capability-v2',
);

const backend = self.SsiCore;

function rounded(value) {
  return Number(value.toFixed(5));
}

function getFinishSavedAlgs(breakdown) {
  const saved = breakdown.finish_saved_algs ?? breakdown.ltct_saved_algs;
  if (!Number.isFinite(saved)) {
    throw new Error('Advanced comparison metadata is unavailable. Reload the page and try again.');
  }
  return saved;
}

self.onmessage = (event) => {
    const { id, type, payload } = event.data;
  try {
    if (type !== 'analyze') throw new Error(`Unknown worker message type: ${type}`);
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
    );

    const hasFloatingComparison = payload.bufferMode !== 'standard';
    const hasFinishComparison = finishCapability !== 'none';
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
        weak2e2eCapability,
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
        ? result[9].reduce((sum, breakdown) => sum + getFinishSavedAlgs(breakdown), 0)
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
