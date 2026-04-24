(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? require('./scrambling')
    : global.SsiCoreModules;

  const { scrToScrambledStateCor } = deps;

  const CORNER_PIECE_GROUPS = [
    ['UFR', 'RUF', 'FUR'],
    ['UBR', 'BUR', 'RUB'],
    ['UBL', 'LUB', 'BUL'],
    ['UFL', 'FUL', 'LUF'],
    ['DFR', 'FDR', 'RDF'],
    ['DFL', 'LDF', 'FDL'],
    ['DBR', 'RDB', 'BDR'],
    ['DBL', 'BDL', 'LDB'],
  ];
  const CORNER_FLOAT_BUFFER_ORDER = ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL'];

  function getPieceGroupCor(sticker) {
    for (const group of CORNER_PIECE_GROUPS) {
      if (group.includes(sticker)) return [...group];
    }
    return null;
  }

  function normalizeCornerBuffers(cornerBuffers) {
    if (cornerBuffers === 'all') return [...CORNER_FLOAT_BUFFER_ORDER];
    if (cornerBuffers == null) return ['UFR'];
    const allowedBuffers = new Set(cornerBuffers);
    const normalized = CORNER_FLOAT_BUFFER_ORDER.filter((buffer) => allowedBuffers.has(buffer));
    if (!normalized.length) throw new Error('Assertion failed');
    return normalized;
  }

  function solvedCor(state) {
    const solvedList = [];
    for (const e of ['UBL', 'UBR', 'UFL', 'DFL', 'DFR', 'DBR', 'DBL']) {
      if (state[e] === e) solvedList.push(e);
    }
    return solvedList;
  }

  function twistedCor(state) {
    const twistedList = [];
    const udStickers = ['UBL', 'UBR', 'UFL', 'DFL', 'DFR', 'DBR', 'DBL'];
    for (const e of udStickers) {
      const brothers = getPieceGroupCor(e);
      brothers.splice(brothers.indexOf(e), 1);
      if (brothers.includes(state[e])) {
        for (const brother of brothers) {
          if (udStickers.includes(state[brother])) twistedList.push(brother);
        }
      }
    }
    return twistedList;
  }

  function removeFromListCor(visitingList, sticker) {
    const newList = [...visitingList];
    for (const brother of getPieceGroupCor(sticker)) {
      newList.splice(newList.indexOf(brother), 1);
    }
    return newList;
  }

  function switchWithBufferCor(buffer, target, state) {
    const newState = { ...state };
    const bufferGroup = getPieceGroupCor(buffer);
    const targetGroup = getPieceGroupCor(target);
    const bufferI = bufferGroup.indexOf(buffer);
    const targetI = targetGroup.indexOf(target);
    for (let offset = 0; offset < 3; offset += 1) {
      newState[bufferGroup[(bufferI + offset) % 3]] = state[targetGroup[(targetI + offset) % 3]];
      newState[targetGroup[(targetI + offset) % 3]] = state[bufferGroup[(bufferI + offset) % 3]];
    }
    return newState;
  }

  function applyTraceLogCor(state, traceLog) {
    let virtualState = { ...state };
    for (const [buffer, target] of traceLog) {
      virtualState = switchWithBufferCor(buffer, target, virtualState);
    }
    return virtualState;
  }

  function pieceSolvedInVirtualStateCor(state, sticker) {
    return state[sticker] === sticker;
  }

  function pieceInItsPlaceCor(state, sticker) {
    return getPieceGroupCor(sticker).includes(state[sticker]);
  }

  function traceStateCorSegments(state, cornerBuffers = ['UFR']) {
    const activeBuffers = normalizeCornerBuffers(cornerBuffers);
    let currentBufferI = 0;
    let currentBuffer = activeBuffers[currentBufferI];
    let needVisiting = CORNER_PIECE_GROUPS.flatMap((group) => group).filter((sticker) => !getPieceGroupCor(currentBuffer).includes(sticker));
    for (const sticker of solvedCor(state)) needVisiting = removeFromListCor(needVisiting, sticker);
    for (const sticker of twistedCor(state)) needVisiting = removeFromListCor(needVisiting, sticker);

    const traceLog = [];
    const segments = [];

    const ensureCurrentSegment = () => {
      if (!segments.length || segments[segments.length - 1].buffer !== currentBuffer) {
        segments.push({ buffer: currentBuffer, targets: [] });
      }
    };

    while (needVisiting.length) {
      const virtualState = applyTraceLogCor(state, traceLog);
      if (pieceSolvedInVirtualStateCor(virtualState, currentBuffer)) {
        let floated = false;
        for (let nextBufferI = currentBufferI + 1; nextBufferI < activeBuffers.length; nextBufferI += 1) {
          const nextBuffer = activeBuffers[nextBufferI];
          if (pieceSolvedInVirtualStateCor(virtualState, nextBuffer)) continue;
          currentBufferI = nextBufferI;
          currentBuffer = nextBuffer;
          for (const sticker of getPieceGroupCor(currentBuffer)) {
            const idx = needVisiting.indexOf(sticker);
            if (idx !== -1) needVisiting.splice(idx, 1);
          }
          floated = true;
          break;
        }
        if (floated) continue;
      }

      let target;
      if (pieceInItsPlaceCor(virtualState, currentBuffer)) {
        target = needVisiting[0];
      } else {
        needVisiting = removeFromListCor(needVisiting, virtualState[currentBuffer]);
        target = virtualState[currentBuffer];
      }

      ensureCurrentSegment();
      segments[segments.length - 1].targets.push(target);
      traceLog.push([currentBuffer, target]);
    }

    return segments;
  }

  function flattenCornerTraceSegments(segments) {
    return segments.flatMap((segment) => segment.targets);
  }

  function analyzeCornerTraceSegments(segments) {
    const oddSegments = segments.filter((segment) => segment.targets.length % 2);
    const evenSegments = segments.filter((segment) => !(segment.targets.length % 2));
    const standaloneAlgs = segments.reduce((sum, segment) => sum + Math.floor((segment.targets.length + 1) / 2), 0);
    const floatingAlgs = standaloneAlgs - Math.floor(oddSegments.length / 2);
    return {
      odd_segments: oddSegments,
      even_segments: evenSegments,
      corner_parity: Boolean(oddSegments.length % 2),
      algs: floatingAlgs,
    };
  }

  function traceStateCor(state, cornerBuffers = ['UFR']) {
    return flattenCornerTraceSegments(traceStateCorSegments(state, cornerBuffers));
  }

  function traceScrCor(scr, tracingOrientation, cornerBuffers = ['UFR']) {
    return traceStateCor(scrToScrambledStateCor(scr, tracingOrientation), cornerBuffers);
  }

  function traceScrCorSegments(scr, tracingOrientation, cornerBuffers = ['UFR']) {
    return traceStateCorSegments(scrToScrambledStateCor(scr, tracingOrientation), cornerBuffers);
  }

  function twistDirectionIndentifier(scr, tracingOrientation) {
    const cwStickers = ['LUF', 'BUL', 'RUB', 'RDF', 'FDL', 'LDB', 'BDR'];
    let cw = 0;
    let ccw = 0;
    for (const twist of twistedCor(scrToScrambledStateCor(scr, tracingOrientation))) {
      if (cwStickers.includes(twist)) cw += 1;
      else ccw += 1;
    }
    return [cw, ccw];
  }

  const api = {
    analyzeCornerTraceSegments,
    applyTraceLogCor,
    CORNER_FLOAT_BUFFER_ORDER,
    CORNER_PIECE_GROUPS,
    flattenCornerTraceSegments,
    getPieceGroupCor,
    normalizeCornerBuffers,
    pieceInItsPlaceCor,
    pieceSolvedInVirtualStateCor,
    removeFromListCor,
    solvedCor,
    switchWithBufferCor,
    traceScrCor,
    traceScrCorSegments,
    traceStateCor,
    traceStateCorSegments,
    twistDirectionIndentifier,
    twistedCor,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
