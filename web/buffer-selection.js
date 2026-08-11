(function (global) {
  const CORNER_BUFFER_ORDER = Object.freeze(['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL']);
  const EDGE_BUFFER_ORDER = Object.freeze(['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL']);

  function assertBufferCount(count, order, kind) {
    if (!Number.isInteger(count) || count < 1 || count > order.length) {
      throw new Error(`${kind} buffer count must be between 1 and ${order.length}.`);
    }
  }

  function buffersThroughCount(order, count, kind) {
    assertBufferCount(count, order, kind);
    return order.slice(0, count);
  }

  function cornerBuffersThroughCount(count) {
    return buffersThroughCount(CORNER_BUFFER_ORDER, count, 'Corner');
  }

  function isPseudoswapUbException(buffers) {
    if (!Array.isArray(buffers)) return false;
    const selected = new Set(buffers);
    return selected.size === 2 && selected.has('UF') && selected.has('UB');
  }

  function edgeBuffersThroughCount(count, edgeMethod, ubWithoutUr = false) {
    if (!['pseudoswap', 'weakswap'].includes(edgeMethod)) {
      throw new Error(`Unknown edge method: ${edgeMethod}.`);
    }
    assertBufferCount(count, EDGE_BUFFER_ORDER, 'Edge');
    if (edgeMethod === 'pseudoswap' && count === 3 && ubWithoutUr) {
      return ['UF', 'UB'];
    }
    return EDGE_BUFFER_ORDER.slice(0, count);
  }

  function selectEdgeBufferLevel(currentCount, ubWithoutUr, edgeMethod, buffer) {
    assertBufferCount(currentCount, EDGE_BUFFER_ORDER, 'Edge');
    if (!['pseudoswap', 'weakswap'].includes(edgeMethod)) {
      throw new Error(`Unknown edge method: ${edgeMethod}.`);
    }
    const selectedIndex = EDGE_BUFFER_ORDER.indexOf(buffer);
    if (selectedIndex === -1) throw new Error(`Unknown edge buffer: ${buffer}.`);

    if (buffer === 'UR' && edgeMethod === 'pseudoswap' && currentCount === 3) {
      return { count: 3, ubWithoutUr: !ubWithoutUr };
    }
    return { count: selectedIndex + 1, ubWithoutUr: false };
  }

  function bufferCountThroughFurthest(order, buffers) {
    if (!Array.isArray(buffers)) return 1;
    return buffers.reduce(
      (count, buffer) => Math.max(count, order.indexOf(buffer) + 1),
      1,
    );
  }

  function normalizePrefix(buffers, order, kind, primary) {
    if (buffers === 'all') return { isPrefix: true, normalized: [...order] };
    if (buffers == null) return { isPrefix: true, normalized: [primary] };
    if (!Array.isArray(buffers)) {
      throw new Error(`${kind} buffer selection must be an array or "all".`);
    }

    const selected = new Set(buffers);
    const unknownBuffer = buffers.find((buffer) => !order.includes(buffer));
    if (unknownBuffer) throw new Error(`Unknown ${kind.toLowerCase()} buffer: ${unknownBuffer}.`);
    if (!selected.has(primary)) {
      throw new Error(`${kind} buffer selection must include ${primary}.`);
    }

    const normalized = order.filter((buffer) => selected.has(buffer));
    const expectedPrefix = order.slice(0, normalized.length);
    const isPrefix = expectedPrefix.every((buffer) => selected.has(buffer));
    return { isPrefix, normalized };
  }

  function normalizeCornerBuffers(cornerBuffers) {
    const result = normalizePrefix(cornerBuffers, CORNER_BUFFER_ORDER, 'Corner', 'UFR');
    if (!result.isPrefix) {
      throw new Error('Corner buffer selection must be a prefix of the canonical order.');
    }
    return result.normalized;
  }

  function normalizeEdgeBuffers(edgeBuffers, edgeMethod) {
    if (!['pseudoswap', 'weakswap'].includes(edgeMethod)) {
      throw new Error(`Unknown edge method: ${edgeMethod}.`);
    }
    const result = normalizePrefix(edgeBuffers, EDGE_BUFFER_ORDER, 'Edge', 'UF');
    if (!(result.isPrefix || (edgeMethod === 'pseudoswap' && isPseudoswapUbException(edgeBuffers)))) {
      throw new Error(
        'Edge buffer selection must be a prefix of the canonical order'
        + (edgeMethod === 'pseudoswap' ? ' or the UF + UB exception.' : '.'),
      );
    }
    return result.normalized;
  }

  const api = {
    bufferCountThroughFurthest,
    CORNER_BUFFER_ORDER,
    cornerBuffersThroughCount,
    EDGE_BUFFER_ORDER,
    edgeBuffersThroughCount,
    isPseudoswapUbException,
    normalizeCornerBuffers,
    normalizeEdgeBuffers,
    selectEdgeBufferLevel,
  };

  global.SsiBufferSelection = api;
  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
