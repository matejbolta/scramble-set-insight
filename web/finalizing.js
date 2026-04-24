(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? {
        cornerTracing: require('./corner-tracing'),
        edgeCommon: require('./edge-common'),
        pseudoswapTracing: require('./pseudoswap-tracing'),
        weakswapTracing: require('./weakswap-tracing'),
      }
    : {
        cornerTracing: global.SsiCoreModules,
        edgeCommon: global.SsiCoreModules,
        pseudoswapTracing: global.SsiCoreModules,
        weakswapTracing: global.SsiCoreModules,
      };

  const {
    analyzeCornerTraceSegments,
    flattenCornerTraceSegments,
    normalizeCornerBuffers,
    traceStateCorSegments,
    twistDirectionIndentifier,
    twistedCor,
  } = deps.cornerTracing;
  const { scrToScrambledStateCor } = typeof module !== 'undefined' && module.exports
    ? require('./scrambling')
    : global.SsiCoreModules;
  const {
    analyzeEdgeTraceSegments,
    flattenEdgeTraceSegments,
    normalizeEdgeBuffers,
    pairLetters,
    segmentsToLetterView,
    stickersToLetters,
  } = deps.edgeCommon;
  const { traceScrEdgPseudoswapSegments } = deps.pseudoswapTracing;
  const { traceScrEdgWeakswapSegments } = deps.weakswapTracing;

  const MOVE_START_RE = /[UDRLFB]/;

  function buildCornerBreakdown(scr, tracingOrientation, cornerBuffers, twistWeight, ltct) {
    const normalizedCornerBuffers = normalizeCornerBuffers(cornerBuffers);
    const cornerState = scrToScrambledStateCor(scr, tracingOrientation);
    const cornerSegments = traceStateCorSegments(cornerState, normalizedCornerBuffers);
    const cornerTargets = flattenCornerTraceSegments(cornerSegments);
    const cornerAnalysis = analyzeCornerTraceSegments(cornerSegments);
    const cornerStandaloneAlgs = cornerSegments.reduce((sum, segment) => sum + Math.floor((segment.targets.length + 1) / 2), 0);
    const twistList = twistedCor(cornerState);
    const [cw, ccw] = twistList.length ? twistDirectionIndentifier(scr, tracingOrientation) : [0, 0];
    const twoTwists = Math.min(cw, ccw);
    const singleTwists = Math.abs(cw - ccw);
    const twistAlgs = twoTwists * twistWeight + singleTwists;
    const ltctAdjustment = cornerAnalysis.corner_parity && ltct && singleTwists > 0 ? -1 : 0;
    return {
      buffers: normalizedCornerBuffers,
      segments: cornerSegments,
      targets: cornerTargets,
      analysis: {
        odd_segment_count: cornerAnalysis.odd_segments.length,
        even_segment_count: cornerAnalysis.even_segments.length,
        parity: cornerAnalysis.corner_parity,
        algs: cornerAnalysis.algs,
        standalone_algs: cornerStandaloneAlgs,
        saved_by_pairing: cornerStandaloneAlgs - cornerAnalysis.algs,
      },
      twists: {
        list: twistList,
        count: twistList.length,
        cw,
        ccw,
        two_twists: twoTwists,
        single_twists: singleTwists,
        algs: twistAlgs,
      },
      ltct_adjustment: ltctAdjustment,
    };
  }

  function buildEdgeBreakdown(scr, tracingOrientation, edgeMethod, edgeBuffers, flipWeight, cornerParity) {
    const normalizedEdgeBuffers = normalizeEdgeBuffers(edgeBuffers, edgeMethod);
    const [edgeSegments, flippedList] = edgeMethod === 'weakswap'
      ? traceScrEdgWeakswapSegments(scr, tracingOrientation, normalizedEdgeBuffers)
      : traceScrEdgPseudoswapSegments(scr, cornerParity, tracingOrientation, normalizedEdgeBuffers);
    const edgeTargets = flattenEdgeTraceSegments(edgeSegments);
    const edgeAnalysis = analyzeEdgeTraceSegments(edgeSegments);
    const edgeStandaloneAlgs = edgeSegments.reduce((sum, segment) => sum + Math.floor((segment.targets.length + 1) / 2), 0);
    const flipNumber = flippedList.length;
    const twoFlips = Math.floor(flipNumber / 2);
    const flipAlgs = twoFlips * flipWeight + (flipNumber % 2);
    return {
      method: edgeMethod,
      buffers: normalizedEdgeBuffers,
      segments: edgeSegments,
      targets: edgeTargets,
      analysis: {
        odd_segment_count: edgeAnalysis.odd_segments.length,
        even_segment_count: edgeAnalysis.even_segments.length,
        parity: edgeAnalysis.edge_parity,
        algs: edgeAnalysis.algs,
        standalone_algs: edgeStandaloneAlgs,
        saved_by_pairing: edgeStandaloneAlgs - edgeAnalysis.algs,
      },
      flips: {
        list: flippedList,
        count: flipNumber,
        two_flips: twoFlips,
        algs: flipAlgs,
      },
    };
  }

  function countScrambleAlgs(scr, tracingOrientation, edgeMethod, flipWeight, twistWeight, ltct, cornerBuffers = ['UFR'], edgeBuffers = ['UF']) {
    const corner = buildCornerBreakdown(scr, tracingOrientation, cornerBuffers, twistWeight, ltct);
    const edges = buildEdgeBreakdown(scr, tracingOrientation, edgeMethod, edgeBuffers, flipWeight, corner.analysis.parity);
    const algs = corner.analysis.algs + edges.analysis.algs + edges.flips.algs + corner.twists.algs + corner.ltct_adjustment;
    return [algs, edges.flips.two_flips, corner.twists.two_twists];
  }

  function analyzeScramble(scr, tracingOrientation = '', edgeMethod = 'weakswap', flipWeight = 1, twistWeight = 1, ltct = false, cornerBuffers = ['UFR'], edgeBuffers = ['UF']) {
    const corner = buildCornerBreakdown(scr, tracingOrientation, cornerBuffers, twistWeight, ltct);
    const edges = buildEdgeBreakdown(scr, tracingOrientation, edgeMethod, edgeBuffers, flipWeight, corner.analysis.parity);
    const totalAlgs = edges.analysis.algs + edges.flips.algs + corner.analysis.algs + corner.twists.algs + corner.ltct_adjustment;
    return {
      scramble: scr,
      tracing_orientation: tracingOrientation,
      edge_method: edgeMethod,
      corner_buffers: corner.buffers,
      edge_buffers: edges.buffers,
      corner: { segments: corner.segments, targets: corner.targets, analysis: corner.analysis },
      edges,
      twists: corner.twists,
      ltct_adjustment: corner.ltct_adjustment,
      total_algs: totalAlgs,
    };
  }

  function debugHumanReviewReport(scr, tracingOrientation = '', flipWeight = 1, twistWeight = 1, ltct = false, cornerBuffers = ['UFR'], edgeBuffersWeakswap = 'all', edgeBuffersPseudoswap = 'all') {
    const weak = analyzeScramble(scr, tracingOrientation, 'weakswap', flipWeight, twistWeight, ltct, cornerBuffers, edgeBuffersWeakswap);
    const pseudo = analyzeScramble(scr, tracingOrientation, 'pseudoswap', flipWeight, twistWeight, ltct, cornerBuffers, edgeBuffersPseudoswap);
    const cornerLetterSegments = segmentsToLetterView(weak.corner.segments);
    const weakEdgeSegments = segmentsToLetterView(weak.edges.segments);
    const pseudoEdgeSegments = segmentsToLetterView(pseudo.edges.segments);
    const lines = [`Scramble: ${scr}`, '', 'Corners:'];
    for (const segment of cornerLetterSegments) lines.push(`  buffer ${segment.buffer}: ${pairLetters(segment.targets)}`);
    if (weak.twists.count > 0) {
      const twistParts = [`twists: ${stickersToLetters(weak.twists.list)}`];
      if (weak.twists.two_twists > 0) twistParts.push(`two twists: ${weak.twists.two_twists}`);
      twistParts.push(`single twists: ${weak.twists.single_twists}`);
      twistParts.push(`twist algs: ${weak.twists.algs}`);
      lines.push(`  ${twistParts.join(', ')}`);
    }
    lines.push(`  ltct adjustment: ${weak.ltct_adjustment}`);
    lines.push(`  algs: ${weak.corner.analysis.algs} (standalone ${weak.corner.analysis.standalone_algs}, saved ${weak.corner.analysis.saved_by_pairing})`);
    lines.push('');
    lines.push('Edges weakswap:');
    for (const segment of weakEdgeSegments) lines.push(`  buffer ${segment.buffer}: ${pairLetters(segment.targets)}`);
    lines.push(`  flips: ${stickersToLetters(weak.edges.flips.list)} (count ${weak.edges.flips.count}, algs ${weak.edges.flips.algs})`);
    lines.push(`  algs: ${weak.edges.analysis.algs} (standalone ${weak.edges.analysis.standalone_algs}, saved ${weak.edges.analysis.saved_by_pairing})`);
    lines.push('');
    lines.push('Edges pseudoswap:');
    for (const segment of pseudoEdgeSegments) lines.push(`  buffer ${segment.buffer}: ${pairLetters(segment.targets)}`);
    lines.push(`  flips: ${stickersToLetters(pseudo.edges.flips.list)} (count ${pseudo.edges.flips.count}, algs ${pseudo.edges.flips.algs})`);
    lines.push(`  algs: ${pseudo.edges.analysis.algs} (standalone ${pseudo.edges.analysis.standalone_algs}, saved ${pseudo.edges.analysis.saved_by_pairing})`);
    return lines.join('\n');
  }

  function extractScrambleList(text, dnf) {
    const lines = text.trim().split(/\r?\n/);
    const scrambles = [];
    for (let line of lines) {
      line = line.trim();
      line = line.replace(/\[.*\]/g, '');
      const lower = line.toLowerCase();
      if (['generated by cstimer', 'solves/total', 'single', 'best', 'worst', 'avg of', 'current', 'average', 'mean', 'time list'].some((phrase) => lower.includes(phrase))) continue;
      if (!dnf && /DNF/.test(line)) continue;
      line = line.replace(/DNF/g, '');
      const matchMove = line.match(MOVE_START_RE);
      if (matchMove && matchMove.index !== undefined) line = line.slice(matchMove.index);
      else continue;
      const atIndex = line.indexOf('@');
      if (atIndex !== -1) line = line.slice(0, atIndex);
      line = line.trim();
      if (line) scrambles.push(line);
    }
    return scrambles;
  }

  function algCounterMain(text, tracingOrientation = '', edgeMethod = 'weakswap', flipWeight = 1, twistWeight = 1, ltct = false, dnf = false, cornerBuffers = ['UFR'], edgeBuffers = ['UF']) {
    const scrList = extractScrambleList(text, dnf);
    const algCountTriples = scrList.map((scr) => countScrambleAlgs(scr, tracingOrientation, edgeMethod, flipWeight, twistWeight, ltct, cornerBuffers, edgeBuffers));
    const finalCount = {};
    let totalTwoFlips = 0;
    let totalTwoTwists = 0;
    for (const algsPerScr of algCountTriples) {
      finalCount[algsPerScr[0]] = (finalCount[algsPerScr[0]] || 0) + 1;
      totalTwoFlips += algsPerScr[1];
      totalTwoTwists += algsPerScr[2];
    }
    const algCountList = algCountTriples.map((e) => (Number.isInteger(e[0]) ? e[0] : e[0]));
    const sortedEntries = Object.entries(finalCount).map(([k, v]) => [Number(k), v]).sort((a, b) => a[0] - b[0]);
    const numberOfCasesWithNAlgsDict = Object.fromEntries(sortedEntries);
    let totalAlgs = sortedEntries.reduce((sum, [k, v]) => sum + k * v, 0);
    const averageAlgsPer = Number((totalAlgs / scrList.length).toFixed(5));
    totalAlgs = Number(totalAlgs.toFixed(5));
    return [algCountList.length, numberOfCasesWithNAlgsDict, averageAlgsPer, totalAlgs, totalTwoFlips, totalTwoTwists, algCountList];
  }

  const api = {
    algCounterMain,
    analyzeScramble,
    buildCornerBreakdown,
    buildEdgeBreakdown,
    countScrambleAlgs,
    debugHumanReviewReport,
    extractScrambleList,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
