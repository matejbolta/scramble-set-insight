(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? require('./edge-common')
    : global.SsiCoreModules;

  const {
    removeFromListEdg,
    scrToScrambledStateEdg,
    switchWithBufferEdg,
    traceStateEdgFloating,
  } = deps;

  function solvedEdgWeakswap(state) {
    const solvedList = [];
    for (const e of ['UB', 'UR', 'UL', 'FL', 'FR', 'BL', 'BR', 'DF', 'DR', 'DB', 'DL']) {
      if (state[e] === e) solvedList.push(e);
    }
    if (state.UR === 'UF') solvedList.push('UR');
    return solvedList;
  }

  function flippedEdgWeakswap(state) {
    const flippedList = [];
    for (const e of ['UB', 'UL', 'FL', 'FR', 'BL', 'BR', 'DF', 'DR', 'DB', 'DL']) {
      if (state[e] === e.split('').reverse().join('')) flippedList.push(e);
    }
    return flippedList;
  }

  function traceStateEdgWeakswap(state) {
    let needVisiting = [
      'UR', 'RU', 'UB', 'BU', 'UL', 'LU', 'FL', 'LF', 'FR', 'RF', 'BL',
      'LB', 'BR', 'RB', 'DF', 'FD', 'DR', 'RD', 'DB', 'BD', 'DL', 'LD',
    ];
    const solvedList = solvedEdgWeakswap(state);
    const flippedList = flippedEdgWeakswap(state);
    for (const sticker of solvedList) needVisiting = removeFromListEdg(needVisiting, sticker);
    for (const sticker of flippedList) needVisiting = removeFromListEdg(needVisiting, sticker);

    const tracedLetters = [];
    let weakswap = ['UF', 'UR'].includes(state.UR) ? 1 : 0;

    while (needVisiting.length) {
      if (needVisiting.length === 2 && needVisiting[0] === 'UR' && needVisiting[1] === 'RU' && !(tracedLetters.length % 2)) {
        flippedList.push('UR');
        break;
      } else if (['UF', 'FU', 'UR', 'RU'].includes(state.UF) && !weakswap) {
        let target;
        if (['UR', 'RU'].includes(state.UF)) target = state.UF;
        else if (state.UF === 'UF') target = 'UR';
        else target = 'RU';
        tracedLetters.push(target);
        needVisiting = removeFromListEdg(needVisiting, 'UR');
        state = switchWithBufferEdg('UF', target, state);
        weakswap = 1;
      } else if (['UF', 'FU', 'UR', 'RU'].includes(state.UF) && weakswap) {
        state = switchWithBufferEdg('UF', needVisiting[0], state);
        tracedLetters.push(needVisiting[0]);
      } else {
        needVisiting = removeFromListEdg(needVisiting, state.UF);
        tracedLetters.push(state.UF);
        state = switchWithBufferEdg('UF', state.UF, state);
      }
    }

    if (tracedLetters.length % 2 && !(flippedList.length % 2)) tracedLetters.push('UR');
    else if (tracedLetters.length % 2 && flippedList.length % 2) tracedLetters.push('RU');

    return [tracedLetters, flippedList];
  }

  function traceScrEdgWeakswap(scr, tracingOrientation) {
    return traceStateEdgWeakswap(scrToScrambledStateEdg(scr, tracingOrientation));
  }

  function traceStateEdgWeakswapSegments(state, edgeBuffers = ['UF']) {
    const solvedList = solvedEdgWeakswap(state);
    const flippedList = flippedEdgWeakswap(state);
    const segments = traceStateEdgFloating(state, solvedList, flippedList, edgeBuffers, 'weakswap');
    return [segments, flippedList];
  }

  function traceScrEdgWeakswapSegments(scr, tracingOrientation, edgeBuffers = ['UF']) {
    return traceStateEdgWeakswapSegments(scrToScrambledStateEdg(scr, tracingOrientation), edgeBuffers);
  }

  const api = {
    flippedEdgWeakswap,
    solvedEdgWeakswap,
    traceScrEdgWeakswap,
    traceScrEdgWeakswapSegments,
    traceStateEdgWeakswap,
    traceStateEdgWeakswapSegments,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
