self.importScripts(
  './wide-move-translator.js?v=floating-closure-v6',
  './scrambling.js?v=floating-closure-v6',
  './corner-tracing.js?v=floating-closure-v6',
  './edge-common.js?v=floating-closure-v6',
  './weakswap-tracing.js?v=floating-closure-v6',
  './pseudoswap-tracing.js?v=floating-closure-v6',
  './finalizing.js?v=floating-closure-v6',
  './ssi-core.js?v=floating-closure-v6',
);

const backend = self.SsiCore;

function rounded(value) {
  return Number(value.toFixed(5));
}

function getLtctSavedAlgs(breakdown) {
  if (!Number.isFinite(breakdown.ltct_saved_algs)) {
    throw new Error('LTCT comparison metadata is unavailable. Reload the page and try again.');
  }
  return breakdown.ltct_saved_algs;
}

self.onmessage = (event) => {
  const { id, type, payload } = event.data;
  try {
    if (type !== 'analyze') throw new Error(`Unknown worker message type: ${type}`);
    const result = backend.algCounterMain(
      payload.scrambles,
      payload.tracingOrientation,
      payload.edgeMethod,
      payload.flipWeight,
      payload.twistWeight,
      payload.ltct,
      payload.dnf,
      payload.cornerBuffers,
      payload.edgeBuffers,
    );

    const hasFloatingComparison = payload.bufferMode !== 'standard';
    const hasLtctComparison = Boolean(payload.ltct);
    let standardResult = null;

    if (hasFloatingComparison) {
      standardResult = backend.algCounterMain(
        payload.scrambles,
        payload.tracingOrientation,
        payload.edgeMethod,
        payload.flipWeight,
        payload.twistWeight,
        payload.ltct,
        payload.dnf,
        ['UFR'],
        ['UF'],
      );
    }

    if (hasFloatingComparison || hasLtctComparison) {
      const baselineResult = standardResult || result;

      if (baselineResult[9].length !== result[9].length) {
        throw new Error('Baseline and analyzed result lengths do not match.');
      }

      let baselineLtctSavedAlgs = 0;
      result[9].forEach((breakdown, index) => {
        const baselineBreakdown = baselineResult[9][index];
        const baselineLtctSaved = hasLtctComparison ? getLtctSavedAlgs(baselineBreakdown) : 0;
        Object.assign(breakdown, {
          baseline_total_algs: rounded(baselineBreakdown.total_algs + baselineLtctSaved),
          baseline_corner_algs: rounded(baselineBreakdown.corner_algs + baselineLtctSaved),
          baseline_edge_algs: baselineBreakdown.edge_algs,
        });
      });

      if (hasLtctComparison) {
        baselineLtctSavedAlgs = baselineResult[9]
          .reduce((sum, breakdown) => sum + getLtctSavedAlgs(breakdown), 0);
      }

      const baselineTotalAlgs = rounded(baselineResult[3] + baselineLtctSavedAlgs);
      const floatingSavedAlgs = hasFloatingComparison
        ? rounded(Math.max(0, standardResult[3] - result[3]))
        : 0;
      const ltctSavedAlgs = result[9]
        .reduce((sum, breakdown) => sum + getLtctSavedAlgs(breakdown), 0);
      result[10] = {
        baseline_total_algs: baselineTotalAlgs,
        combined_saved_algs: rounded(Math.max(0, baselineTotalAlgs - result[3])),
        has_floating_comparison: hasFloatingComparison,
        floating_saved_algs: floatingSavedAlgs,
        total_saved_algs: floatingSavedAlgs,
        has_ltct_comparison: hasLtctComparison,
        ltct_saved_algs: ltctSavedAlgs,
      };
    }

    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
