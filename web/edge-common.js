(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? require('./scrambling')
    : global.SsiCoreModules;

  const { scrToScrambledStateEdg } = deps;

  const EDGE_FLOAT_BUFFER_ORDER_PSEUDOSWAP = ['UF', 'UB', 'UR', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'];
  const EDGE_FLOAT_BUFFER_ORDER_WEAKSWAP = ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'];
  const STICKER_LETTER_MAP = {
    UBL: 'C', UB: 'C', UBR: 'B', UR: 'B', UFR: 'Q', UF: 'Q', UFL: 'D', UL: 'D',
    LUB: 'E', LU: 'E', LUF: 'F', LF: 'F', LDF: 'G', LD: 'G', LDB: 'H', LB: 'H',
    FUL: 'I', RU: 'I', FUR: 'Y', FU: 'Y', FDR: 'M', FD: 'M', FDL: 'L', FL: 'L', FR: 'J',
    RUF: 'W', RUB: 'N', RB: 'N', RDB: 'O', RD: 'O', RDF: 'A', RF: 'A',
    BUR: 'P', BU: 'P', BUL: 'R', BL: 'R', BDL: 'S', BD: 'S', BDR: 'T', BR: 'T',
    DFL: 'K', DF: 'K', DFR: 'U', DR: 'U', DBR: 'V', DB: 'V', DBL: 'Z', DL: 'Z',
  };

  function removeFromListEdg(visitingList, sticker) {
    const newList = [...visitingList];
    newList.splice(newList.indexOf(sticker), 1);
    newList.splice(newList.indexOf(sticker.split('').reverse().join('')), 1);
    return newList;
  }

  function getPieceGroupEdg(sticker) {
    return [sticker, sticker.split('').reverse().join('')];
  }

  function normalizeEdgeBuffers(edgeBuffers, edgeMethod) {
    const bufferOrder = edgeMethod === 'weakswap' ? EDGE_FLOAT_BUFFER_ORDER_WEAKSWAP : EDGE_FLOAT_BUFFER_ORDER_PSEUDOSWAP;
    if (edgeBuffers === 'all') return [...bufferOrder];
    if (edgeBuffers == null) return ['UF'];
    const allowedBuffers = new Set(edgeBuffers);
    const normalized = bufferOrder.filter((buffer) => allowedBuffers.has(buffer));
    if (!normalized.length) throw new Error('Assertion failed');
    return normalized;
  }

  function switchWithBufferEdg(buffer, target, state) {
    const newState = { ...state };
    const bufferGroup = getPieceGroupEdg(buffer);
    const targetGroup = getPieceGroupEdg(target);
    newState[bufferGroup[0]] = state[targetGroup[0]];
    newState[bufferGroup[1]] = state[targetGroup[1]];
    newState[targetGroup[0]] = state[bufferGroup[0]];
    newState[targetGroup[1]] = state[bufferGroup[1]];
    return newState;
  }

  function applyTraceLogEdg(state, traceLog) {
    let virtualState = { ...state };
    for (const [buffer, target] of traceLog) {
      virtualState = switchWithBufferEdg(buffer, target, virtualState);
    }
    return virtualState;
  }

  function pieceInItsPlaceEdg(state, sticker) {
    return getPieceGroupEdg(sticker).includes(state[sticker]);
  }

  function pieceSolvedEdg(state, sticker) {
    return state[sticker] === sticker;
  }

  function edgeBufferSolvedForFloat(state, buffer, edgeMethod, parity = false) {
    if (edgeMethod === 'weakswap') {
      if (buffer === 'UF') return ['UF', 'UR'].includes(state.UF);
      if (buffer === 'UR') return ['UR', 'UF'].includes(state.UR);
      return pieceSolvedEdg(state, buffer);
    }
    if (buffer === 'UF') return state.UF === (parity ? 'UR' : 'UF');
    if (buffer === 'UR') return state.UR === (parity ? 'UF' : 'UR');
    return pieceSolvedEdg(state, buffer);
  }

  function flattenEdgeTraceSegments(segments) {
    return segments.flatMap((segment) => segment.targets);
  }

  function stickerToLetter(sticker) {
    return STICKER_LETTER_MAP[sticker];
  }

  function stickersToLetters(stickers) {
    return stickers.map(stickerToLetter);
  }

  function segmentsToLetterView(segments) {
    return segments.map((segment) => ({ buffer: stickerToLetter(segment.buffer), targets: stickersToLetters(segment.targets) }));
  }

  function pairLetters(letters) {
    const pairs = [];
    for (let i = 0; i < letters.length; i += 2) pairs.push(letters.slice(i, i + 2).join(''));
    return pairs;
  }

  function analyzeEdgeTraceSegments(segments) {
    const oddSegments = segments.filter((segment) => segment.targets.length % 2);
    const evenSegments = segments.filter((segment) => !(segment.targets.length % 2));
    const standaloneAlgs = segments.reduce((sum, segment) => sum + Math.floor((segment.targets.length + 1) / 2), 0);
    const floatingAlgs = standaloneAlgs - Math.floor(oddSegments.length / 2);
    return {
      odd_segments: oddSegments,
      even_segments: evenSegments,
      edge_parity: Boolean(oddSegments.length % 2),
      algs: floatingAlgs,
    };
  }

  function traceStateEdgFloating(state, solvedList, flippedList, edgeBuffers, edgeMethod, parity = false) {
    const activeBuffers = normalizeEdgeBuffers(edgeBuffers, edgeMethod);
    let currentBufferI = 0;
    let currentBuffer = activeBuffers[currentBufferI];
    let needVisiting = [
      'UF', 'FU', 'UR', 'RU', 'UB', 'BU', 'UL', 'LU', 'FR', 'RF', 'FL', 'LF',
      'DF', 'FD', 'DR', 'RD', 'DB', 'BD', 'BR', 'RB', 'BL', 'LB', 'DL', 'LD',
    ].filter((sticker) => !getPieceGroupEdg(currentBuffer).includes(sticker));
    for (const sticker of solvedList) needVisiting = removeFromListEdg(needVisiting, sticker);
    for (const sticker of flippedList) needVisiting = removeFromListEdg(needVisiting, sticker);

    const traceLog = [];
    const segments = [];

    const ensureCurrentSegment = () => {
      if (!segments.length || segments[segments.length - 1].buffer !== currentBuffer) {
        segments.push({ buffer: currentBuffer, targets: [] });
      }
    };

    const removeIfNeeded = (stickers) => {
      for (const sticker of stickers) {
        const idx = needVisiting.indexOf(sticker);
        if (idx !== -1) needVisiting.splice(idx, 1);
      }
    };

    while (needVisiting.length) {
      const virtualState = applyTraceLogEdg(state, traceLog);

      if (
        edgeMethod === 'weakswap'
        && currentBuffer === 'UF'
        && new Set(needVisiting).size === 2
        && needVisiting.includes('UR')
        && needVisiting.includes('RU')
        && !(traceLog.length % 2)
      ) {
        flippedList.push('UR');
        break;
      }

      if (
        edgeMethod === 'weakswap'
        && currentBuffer === 'UF'
        && (needVisiting.includes('UR') || needVisiting.includes('RU'))
        && ['UF', 'FU', 'UR', 'RU'].includes(virtualState.UF)
      ) {
        let target;
        if (['UR', 'RU'].includes(virtualState.UF)) target = virtualState.UF;
        else if (virtualState.UF === 'UF') target = 'UR';
        else target = 'RU';
        needVisiting = removeFromListEdg(needVisiting, 'UR');
        ensureCurrentSegment();
        segments[segments.length - 1].targets.push(target);
        traceLog.push([currentBuffer, target]);
        continue;
      }

      if (
        edgeMethod === 'pseudoswap'
        && currentBuffer === 'UF'
        && (needVisiting.includes('UR') || needVisiting.includes('RU'))
        && ((!parity && ['UR', 'RU'].includes(virtualState.UF)) || (parity && ['UF', 'FU'].includes(virtualState.UF)))
      ) {
        const target = virtualState.UF.replace('F', 'R');
        needVisiting = removeFromListEdg(needVisiting, 'UR');
        ensureCurrentSegment();
        segments[segments.length - 1].targets.push(target);
        traceLog.push([currentBuffer, target]);
        continue;
      }

      let solvedForFloat = edgeBufferSolvedForFloat(virtualState, currentBuffer, edgeMethod, parity);
      if (edgeMethod === 'pseudoswap' && currentBuffer === 'UF' && (needVisiting.includes('UR') || needVisiting.includes('RU'))) {
        solvedForFloat = false;
      }

      let cycleBreakOnly = pieceInItsPlaceEdg(virtualState, currentBuffer) && !solvedForFloat;
      let target = null;
      if (!(solvedForFloat || cycleBreakOnly)) {
        const candidateTarget = virtualState[currentBuffer];
        if (!needVisiting.includes(candidateTarget)) cycleBreakOnly = true;
        else {
          target = candidateTarget;
          needVisiting = removeFromListEdg(needVisiting, target);
        }
      }

      if (solvedForFloat) {
        let floated = false;
        for (let nextBufferI = currentBufferI + 1; nextBufferI < activeBuffers.length; nextBufferI += 1) {
          const nextBuffer = activeBuffers[nextBufferI];
          if (edgeBufferSolvedForFloat(virtualState, nextBuffer, edgeMethod, parity)) continue;
          currentBufferI = nextBufferI;
          currentBuffer = nextBuffer;
          removeIfNeeded(getPieceGroupEdg(currentBuffer));
          floated = true;
          break;
        }
        if (floated) continue;
        target = needVisiting[0];
      } else if (cycleBreakOnly) {
        target = needVisiting[0];
      }

      ensureCurrentSegment();
      segments[segments.length - 1].targets.push(target);
      traceLog.push([currentBuffer, target]);
    }

    return segments;
  }

  const api = {
    EDGE_FLOAT_BUFFER_ORDER_PSEUDOSWAP,
    EDGE_FLOAT_BUFFER_ORDER_WEAKSWAP,
    STICKER_LETTER_MAP,
    analyzeEdgeTraceSegments,
    applyTraceLogEdg,
    edgeBufferSolvedForFloat,
    flattenEdgeTraceSegments,
    getPieceGroupEdg,
    normalizeEdgeBuffers,
    pairLetters,
    pieceInItsPlaceEdg,
    pieceSolvedEdg,
    removeFromListEdg,
    scrToScrambledStateEdg,
    segmentsToLetterView,
    stickerToLetter,
    stickersToLetters,
    switchWithBufferEdg,
    traceStateEdgFloating,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
