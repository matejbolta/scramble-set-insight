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
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
