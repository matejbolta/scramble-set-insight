(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? require('./edge-common')
    : global.SsiCoreModules;

  const {
    removeFromListEdg,
    normalizeEdgeBuffers,
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

    const targets = [];
    // UF and UR temporarily share the UR destination. If either piece is
    // already settled there, the next encounter with the pair closes the
    // buffer and must cycle-break elsewhere.
    let urDestinationFilled = ['UF', 'UR'].includes(state.UR);

    while (needVisiting.length) {
      if (needVisiting.length === 2 && needVisiting[0] === 'UR' && needVisiting[1] === 'RU' && !(targets.length % 2)) {
        // The shared destination survived until the end. With an even target
        // count, its orientation can be paired with another flipped edge.
        flippedList.push('UR');
        break;
      } else if (['UF', 'FU', 'UR', 'RU'].includes(state.UF) && !urDestinationFilled) {
        let target;
        if (['UR', 'RU'].includes(state.UF)) target = state.UF;
        else if (state.UF === 'UF') target = 'UR';
        else target = 'RU';
        targets.push(target);
        needVisiting = removeFromListEdg(needVisiting, 'UR');
        state = switchWithBufferEdg('UF', target, state);
        urDestinationFilled = true;
      } else if (['UF', 'FU', 'UR', 'RU'].includes(state.UF) && urDestinationFilled) {
        state = switchWithBufferEdg('UF', needVisiting[0], state);
        targets.push(needVisiting[0]);
      } else {
        needVisiting = removeFromListEdg(needVisiting, state.UF);
        targets.push(state.UF);
        state = switchWithBufferEdg('UF', state.UF, state);
      }
    }

    // Odd target parity means the temporary UF/UR identification still has to
    // be undone. Orientation parity selects the final UR or RU sticker.
    if (targets.length % 2 && !(flippedList.length % 2)) targets.push('UR');
    else if (targets.length % 2 && flippedList.length % 2) targets.push('RU');

    return [targets, flippedList];
  }

  function traceScrEdgWeakswap(scr, tracingOrientation) {
    return traceStateEdgWeakswap(scrToScrambledStateEdg(scr, tracingOrientation));
  }

  function traceStateEdgWeakswapSegments(state, edgeBuffers = ['UF']) {
    const activeBuffers = normalizeEdgeBuffers(edgeBuffers, 'weakswap');
    if (activeBuffers.length === 1) {
      const [targets, flippedList] = traceStateEdgWeakswap(state);
      return [targets.length ? [{ buffer: 'UF', targets }] : [], flippedList];
    }
    const solvedList = solvedEdgWeakswap(state);
    const flippedList = flippedEdgWeakswap(state);
    const segments = traceStateEdgFloating(state, solvedList, flippedList, activeBuffers, 'weakswap');
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
