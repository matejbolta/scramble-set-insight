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

  function solvedEdgPseudoswap(state, parity) {
    const solvedList = [];
    for (const e of ['UB', 'UL', 'FL', 'FR', 'BL', 'BR', 'DF', 'DR', 'DB', 'DL']) {
      if (state[e] === e) solvedList.push(e);
    }
    if (!parity && state.UR === 'UR') solvedList.push('UR');
    else if (parity && state.UR === 'UF') solvedList.push('UR');
    return solvedList;
  }

  function flippedEdgPseudoswap(state, parity) {
    const flippedList = [];
    for (const e of ['UB', 'UL', 'FL', 'FR', 'BL', 'BR', 'DF', 'DR', 'DB', 'DL']) {
      if (state[e] === e.split('').reverse().join('')) flippedList.push(e);
    }
    if (!parity && state.UR === 'RU') flippedList.push('UR');
    else if (parity && state.UR === 'FU') flippedList.push('UR');
    return flippedList;
  }

  function traceStateEdgPseudoswap(state, parity) {
    let needVisiting = [
      'UR', 'RU', 'UB', 'BU', 'UL', 'LU', 'FL', 'LF', 'FR', 'RF', 'BL',
      'LB', 'BR', 'RB', 'DF', 'FD', 'DR', 'RD', 'DB', 'BD', 'DL', 'LD',
    ];
    const solvedList = solvedEdgPseudoswap(state, parity);
    const flippedList = flippedEdgPseudoswap(state, parity);
    for (const sticker of solvedList) needVisiting = removeFromListEdg(needVisiting, sticker);
    for (const sticker of flippedList) needVisiting = removeFromListEdg(needVisiting, sticker);

    const tracedLetters = [];
    while (needVisiting.length) {
      if ((!parity && ['UF', 'FU'].includes(state.UF)) || (parity && ['UR', 'RU'].includes(state.UF))) {
        state = switchWithBufferEdg('UF', needVisiting[0], state);
        tracedLetters.push(needVisiting[0]);
      } else {
        tracedLetters.push(state.UF.replace('F', 'R'));
        needVisiting = removeFromListEdg(needVisiting, state.UF.replace('F', 'R'));
        state = switchWithBufferEdg('UF', state.UF.replace('F', 'R'), state);
      }
    }
    return [tracedLetters, flippedList];
  }

  function traceScrEdgPseudoswap(scr, parity, tracingOrientation) {
    return traceStateEdgPseudoswap(scrToScrambledStateEdg(scr, tracingOrientation), parity);
  }

  function traceStateEdgPseudoswapSegments(state, parity, edgeBuffers = ['UF']) {
    const solvedList = solvedEdgPseudoswap(state, parity);
    const flippedList = flippedEdgPseudoswap(state, parity);
    const segments = traceStateEdgFloating(state, solvedList, flippedList, edgeBuffers, 'pseudoswap', parity);
    return [segments, flippedList];
  }

  function traceScrEdgPseudoswapSegments(scr, parity, tracingOrientation, edgeBuffers = ['UF']) {
    return traceStateEdgPseudoswapSegments(scrToScrambledStateEdg(scr, tracingOrientation), parity, edgeBuffers);
  }

  const api = {
    flippedEdgPseudoswap,
    solvedEdgPseudoswap,
    traceScrEdgPseudoswap,
    traceScrEdgPseudoswapSegments,
    traceStateEdgPseudoswap,
    traceStateEdgPseudoswapSegments,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
