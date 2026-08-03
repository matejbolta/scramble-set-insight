self.importScripts(
  './wide-move-translator.js',
  './scrambling.js',
  './corner-tracing.js',
  './edge-common.js',
  './weakswap-tracing.js',
  './pseudoswap-tracing.js',
  './finalizing.js',
  './ssi-core.js',
);

const backend = self.SsiCore;

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

    if (payload.bufferMode !== 'standard') {
      const standardResult = backend.algCounterMain(
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

      if (standardResult[9].length !== result[9].length) {
        throw new Error('Standard and floating result lengths do not match.');
      }

      result[9].forEach((breakdown, index) => Object.assign(breakdown, {
        standard_total_algs: standardResult[9][index].total_algs,
        standard_corner_algs: standardResult[9][index].corner_algs,
        standard_edge_algs: standardResult[9][index].edge_algs,
      }));
      result[10] = {
        standard_total_algs: standardResult[3],
        total_saved_algs: Number(Math.max(0, standardResult[3] - result[3]).toFixed(5)),
      };
    }

    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
