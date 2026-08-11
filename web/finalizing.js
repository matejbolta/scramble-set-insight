(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? {
        cornerTracing: require('./corner-tracing'),
        dlinPlanner: require('./dlin-planner'),
        residuePlanner: require('./cycle-residue-planner'),
        edgeCommon: require('./edge-common'),
        pseudoswapTracing: require('./pseudoswap-tracing'),
        weakswapTracing: require('./weakswap-tracing'),
      }
    : {
        cornerTracing: global.SsiCoreModules,
        dlinPlanner: global.SsiCoreModules,
        residuePlanner: global.SsiCoreModules,
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
  const { scrToScrambledStateCor, scrToScrambledStateEdg } = typeof module !== 'undefined' && module.exports
    ? require('./scrambling')
    : global.SsiCoreModules;
  const { planCornerStateDlin, planEdgeStateDlin } = deps.dlinPlanner;
  const {
    FULL_CORNER_BUFFERS,
    FULL_EDGE_BUFFERS,
    planCornerStateByResidues,
    planCornerStateBySelectedBuffers,
    planEdgeStateByResidues,
    planEdgeStateBySelectedBuffers,
  } = deps.residuePlanner;
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
  const WCA_ROW_PREFIX_RE = /^(?:[A-Z]\s+)?(?:\d+|Extra\s+\d+)\s+/;

  function sameBufferSet(actual, expected) {
    return actual.length === expected.length && expected.every((buffer) => actual.includes(buffer));
  }

  function normalizeFinishCapability(value) {
    if (value === true) return 'ltct';
    if (value === false || value == null || value === '') return 'none';
    const normalized = String(value).toLowerCase();
    if (['none', 'ltct', 't2c'].includes(normalized)) return normalized;
    throw new Error(`Unknown Advanced capability: ${value}`);
  }

  function buildCornerBreakdown(
    scr,
    tracingOrientation,
    cornerBuffers,
    twistWeight,
    finishCapability,
    edgeMethod = 'weakswap',
  ) {
    const normalizedFinishCapability = normalizeFinishCapability(finishCapability);
    const normalizedCornerBuffers = normalizeCornerBuffers(cornerBuffers);
    const cornerState = scrToScrambledStateCor(scr, tracingOrientation);
    if (sameBufferSet(normalizedCornerBuffers, FULL_CORNER_BUFFERS)) {
      const plan = planCornerStateByResidues(
        cornerState,
        normalizedCornerBuffers,
        normalizedFinishCapability,
        twistWeight,
      );
      const twoTwists = plan.baseline_orientation_algs;
      const finishType = plan.finish_adjustment < -1e-12
        && ['ltct', 't2c'].includes(plan.finish?.type)
        ? plan.finish.type
        : null;
      return {
        buffers: normalizedCornerBuffers,
        tracing_model: 'cycle-residue',
        finish_capability: normalizedFinishCapability,
        finish_type: finishType,
        segments: [],
        targets: [],
        analysis: {
          // Exact counting has no traced segment path. Permutation parity is
          // reported separately below and must not be presented as a segment.
          odd_segment_count: 0,
          even_segment_count: 0,
          parity: Boolean(plan.model.permutation_parity),
          algs: plan.baseline_permutation_algs,
          standalone_algs: plan.baseline_permutation_algs,
          saved_by_pairing: 0,
        },
        twists: {
          list: [],
          count: twoTwists * 2,
          cw: twoTwists,
          ccw: twoTwists,
          two_twists: twoTwists,
          single_twists: 0,
          algs: plan.baseline_orientation_algs * twistWeight,
        },
        ltct_adjustment: plan.finish_adjustment,
        finish_adjustment: plan.finish_adjustment,
        cycle_residue: {
          base_algs: plan.base_algs,
          residue_algs: plan.total_algs - plan.base_algs,
          residue_types: [...plan.reduced.residue_types],
          orientation_weight: twistWeight,
          finish: plan.finish,
        },
      };
    }
    if (normalizedCornerBuffers.length === 1 && normalizedFinishCapability === 't2c') {
      throw new Error('T2C requires floating beyond the primary buffers.');
    }
    if (normalizedCornerBuffers.length === 1 || edgeMethod === 'pseudoswap') {
      const plan = planCornerStateBySelectedBuffers(
        cornerState,
        normalizedCornerBuffers,
        normalizedFinishCapability,
        twistWeight,
      );
      const twoTwists = plan.baseline_orientation_algs;
      const finishType = plan.finish_adjustment < -1e-12
        && ['ltct', 't2c'].includes(plan.finish?.type)
        ? plan.finish.type
        : null;
      return {
        buffers: normalizedCornerBuffers,
        tracing_model: 'selected-buffer',
        finish_capability: normalizedFinishCapability,
        finish_type: finishType,
        segments: [],
        targets: [],
        analysis: {
          // Exact counting has no traced segment path. Permutation parity is
          // reported separately below and must not be presented as a segment.
          odd_segment_count: 0,
          even_segment_count: 0,
          parity: Boolean(plan.model.permutation_parity),
          algs: plan.baseline_permutation_algs,
          standalone_algs: plan.baseline_permutation_algs,
          saved_by_pairing: 0,
        },
        twists: {
          list: [],
          count: twoTwists * 2,
          cw: twoTwists,
          ccw: twoTwists,
          two_twists: twoTwists,
          single_twists: 0,
          algs: plan.baseline_orientation_algs * twistWeight,
        },
        ltct_adjustment: plan.finish_adjustment,
        finish_adjustment: plan.finish_adjustment,
        selected_buffer: {
          count: normalizedCornerBuffers.length,
          orientation_weight: twistWeight,
          finish: plan.finish,
        },
      };
    }
    if (normalizedCornerBuffers.length > 1) {
      if (normalizedFinishCapability === 't2c') {
        throw new Error('T2C requires exact pseudoswap floating.');
      }
      const plan = planCornerStateDlin(
        cornerState,
        normalizedCornerBuffers,
        twistWeight,
        normalizedFinishCapability === 'ltct',
      );
      if (!plan.complete) throw new Error('DLin corner planning did not cover every permutation cycle.');
      return {
        buffers: normalizedCornerBuffers,
        tracing_model: 'dlin',
        finish_capability: normalizedFinishCapability,
        finish_type: plan.ltct_adjustment < -1e-12 ? 'ltct' : null,
        segments: plan.segments,
        targets: plan.segments.flatMap((segment) => segment.targets),
        analysis: {
          odd_segment_count: plan.segment_analysis.odd_segment_count,
          even_segment_count: plan.segment_analysis.even_segment_count,
          parity: plan.segment_analysis.parity,
          algs: plan.permutation_algs,
          standalone_algs: plan.segment_analysis.standalone_algs,
          saved_by_pairing: plan.segment_analysis.saved_by_linking,
        },
        twists: plan.orientations,
        ltct_adjustment: plan.ltct_adjustment,
        finish_adjustment: plan.ltct_adjustment,
        dlin: {
          states_explored: plan.states_explored,
          cycle_count: plan.model.active_cycles.length,
          permutation_cycle_count: plan.segments.length,
        },
      };
    }
    const cornerSegments = traceStateCorSegments(cornerState, normalizedCornerBuffers);
    const cornerTargets = flattenCornerTraceSegments(cornerSegments);
    const cornerAnalysis = analyzeCornerTraceSegments(cornerSegments);
    const cornerStandaloneAlgs = cornerSegments.reduce((sum, segment) => sum + Math.floor((segment.targets.length + 1) / 2), 0);
    const twistList = twistedCor(cornerState);
    const [cw, ccw] = twistList.length ? twistDirectionIndentifier(scr, tracingOrientation) : [0, 0];
    const twoTwists = Math.min(cw, ccw);
    const singleTwists = Math.abs(cw - ccw);
    const twistAlgs = twoTwists * twistWeight + singleTwists;
    const ltctAdjustment = cornerAnalysis.corner_parity
      && normalizedFinishCapability === 'ltct'
      && singleTwists > 0
      ? -1
      : 0;
    return {
      buffers: normalizedCornerBuffers,
      tracing_model: 'legacy',
      finish_capability: normalizedFinishCapability,
      finish_type: ltctAdjustment < 0 ? 'ltct' : null,
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
      finish_adjustment: ltctAdjustment,
    };
  }

  function buildEdgeBreakdown(scr, tracingOrientation, edgeMethod, edgeBuffers, flipWeight, cornerParity) {
    const normalizedEdgeBuffers = normalizeEdgeBuffers(edgeBuffers, edgeMethod);
    if (sameBufferSet(normalizedEdgeBuffers, FULL_EDGE_BUFFERS)) {
      const edgeState = scrToScrambledStateEdg(scr, tracingOrientation);
      const plan = planEdgeStateByResidues(
        edgeState,
        cornerParity,
        normalizedEdgeBuffers,
        flipWeight,
      );
      const twoFlips = plan.orientation_algs;
      return {
        method: edgeMethod,
        buffers: normalizedEdgeBuffers,
        tracing_model: 'cycle-residue',
        segments: [],
        targets: [],
        analysis: {
          odd_segment_count: 0,
          even_segment_count: 0,
          parity: false,
          algs: plan.permutation_algs,
          standalone_algs: plan.permutation_algs,
          saved_by_pairing: 0,
        },
        flips: {
          list: [],
          count: twoFlips * 2,
          two_flips: twoFlips,
          algs: plan.orientation_algs * flipWeight,
        },
        cycle_residue: {
          base_algs: plan.base_algs,
          residue_algs: plan.total_algs - plan.base_algs,
          residue_types: [...plan.reduced.residue_types],
          orientation_weight: flipWeight,
        },
      };
    }
    if (edgeMethod === 'pseudoswap') {
      const edgeState = scrToScrambledStateEdg(scr, tracingOrientation);
      const plan = planEdgeStateBySelectedBuffers(
        edgeState,
        cornerParity,
        normalizedEdgeBuffers,
        flipWeight,
      );
      const twoFlips = plan.orientation_algs;
      return {
        method: edgeMethod,
        buffers: normalizedEdgeBuffers,
        tracing_model: 'selected-buffer',
        segments: [],
        targets: [],
        analysis: {
          odd_segment_count: 0,
          even_segment_count: 0,
          parity: false,
          algs: plan.permutation_algs,
          standalone_algs: plan.permutation_algs,
          saved_by_pairing: 0,
        },
        flips: {
          list: [],
          count: twoFlips * 2,
          two_flips: twoFlips,
          algs: plan.orientation_algs * flipWeight,
        },
        selected_buffer: {
          count: normalizedEdgeBuffers.length,
          orientation_weight: flipWeight,
        },
      };
    }
    if (normalizedEdgeBuffers.length > 1) {
      const edgeState = scrToScrambledStateEdg(scr, tracingOrientation);
      const plan = planEdgeStateDlin(
        edgeState,
        cornerParity,
        normalizedEdgeBuffers,
        flipWeight,
      );
      if (!plan.complete) throw new Error('DLin edge planning did not cover every permutation cycle.');
      return {
        method: edgeMethod,
        buffers: normalizedEdgeBuffers,
        tracing_model: 'dlin',
        segments: plan.segments,
        targets: plan.segments.flatMap((segment) => segment.targets),
        analysis: {
          odd_segment_count: plan.segment_analysis.odd_segment_count,
          even_segment_count: plan.segment_analysis.even_segment_count,
          parity: plan.segment_analysis.parity,
          algs: plan.permutation_algs,
          standalone_algs: plan.segment_analysis.standalone_algs,
          saved_by_pairing: plan.segment_analysis.saved_by_linking,
        },
        flips: plan.orientations,
        dlin: {
          states_explored: plan.states_explored,
          cycle_count: plan.model.active_cycles.length,
          permutation_cycle_count: plan.segments.length,
        },
      };
    }
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
      tracing_model: 'legacy',
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

  function countScrambleAlgs(scr, tracingOrientation, edgeMethod, flipWeight, twistWeight, finishCapability, cornerBuffers = ['UFR'], edgeBuffers = ['UF']) {
    const corner = buildCornerBreakdown(
      scr,
      tracingOrientation,
      cornerBuffers,
      twistWeight,
      finishCapability,
      edgeMethod,
    );
    const edges = buildEdgeBreakdown(scr, tracingOrientation, edgeMethod, edgeBuffers, flipWeight, corner.analysis.parity);
    // The unpaired parity execution is already included in the corner comm count.
    const cornerAlgs = corner.analysis.algs + corner.twists.algs + corner.ltct_adjustment;
    const edgeAlgs = edges.analysis.algs + edges.flips.algs;
    const totalAlgs = cornerAlgs + edgeAlgs;
    return [
      totalAlgs,
      edges.flips.two_flips,
      corner.twists.two_twists,
      cornerAlgs,
      edgeAlgs,
      corner.ltct_adjustment < 0 ? -corner.ltct_adjustment : 0,
      corner.finish_type,
      corner.finish_capability,
    ];
  }

  function analyzeScramble(scr, tracingOrientation = '', edgeMethod = 'weakswap', flipWeight = 1, twistWeight = 1, finishCapability = false, cornerBuffers = ['UFR'], edgeBuffers = ['UF']) {
    const corner = buildCornerBreakdown(
      scr,
      tracingOrientation,
      cornerBuffers,
      twistWeight,
      finishCapability,
      edgeMethod,
    );
    const edges = buildEdgeBreakdown(scr, tracingOrientation, edgeMethod, edgeBuffers, flipWeight, corner.analysis.parity);
    const cornerAlgs = corner.analysis.algs + corner.twists.algs + corner.ltct_adjustment;
    const edgeAlgs = edges.analysis.algs + edges.flips.algs;
    const totalAlgs = cornerAlgs + edgeAlgs;
    return {
      scramble: scr,
      tracing_orientation: tracingOrientation,
      edge_method: edgeMethod,
      corner_buffers: corner.buffers,
      edge_buffers: edges.buffers,
      corner: {
        tracing_model: corner.tracing_model,
        segments: corner.segments,
        targets: corner.targets,
        analysis: corner.analysis,
        ...(corner.dlin ? { dlin: corner.dlin } : {}),
        ...(corner.cycle_residue ? { cycle_residue: corner.cycle_residue } : {}),
        ...(corner.selected_buffer ? { selected_buffer: corner.selected_buffer } : {}),
      },
      edges: {
        ...edges,
        ...(edges.cycle_residue ? { cycle_residue: edges.cycle_residue } : {}),
      },
      twists: corner.twists,
      ltct_adjustment: corner.ltct_adjustment,
      finish_adjustment: corner.finish_adjustment,
      finish_capability: corner.finish_capability,
      finish_type: corner.finish_type,
      corner_algs: cornerAlgs,
      edge_algs: edgeAlgs,
      total_algs: totalAlgs,
    };
  }

  function debugHumanReviewReport(scr, tracingOrientation = '', flipWeight = 1, twistWeight = 1, finishCapability = false, cornerBuffers = ['UFR'], edgeBuffersWeakswap = 'all', edgeBuffersPseudoswap = 'all') {
    const weak = analyzeScramble(scr, tracingOrientation, 'weakswap', flipWeight, twistWeight, finishCapability, cornerBuffers, edgeBuffersWeakswap);
    const pseudo = analyzeScramble(scr, tracingOrientation, 'pseudoswap', flipWeight, twistWeight, finishCapability, cornerBuffers, edgeBuffersPseudoswap);
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
    if (weak.corner.cycle_residue) {
      lines.push(`  residues: ${weak.corner.cycle_residue.residue_types.join(' ') || 'closed'} (base ${weak.corner.cycle_residue.base_algs}, residue ${weak.corner.cycle_residue.residue_algs})`);
      if (weak.corner.cycle_residue.finish) {
        lines.push(`  finish: ${weak.corner.cycle_residue.finish.type} (${weak.corner.cycle_residue.finish.primary_role})`);
      }
    }
    lines.push('');
    lines.push('Edges weakswap:');
    for (const segment of weakEdgeSegments) lines.push(`  buffer ${segment.buffer}: ${pairLetters(segment.targets)}`);
    lines.push(`  flips: ${stickersToLetters(weak.edges.flips.list)} (count ${weak.edges.flips.count}, algs ${weak.edges.flips.algs})`);
    lines.push(`  algs: ${weak.edges.analysis.algs} (standalone ${weak.edges.analysis.standalone_algs}, saved ${weak.edges.analysis.saved_by_pairing})`);
    if (weak.edges.cycle_residue) {
      lines.push(`  residues: ${weak.edges.cycle_residue.residue_types.join(' ') || 'closed'} (base ${weak.edges.cycle_residue.base_algs}, residue ${weak.edges.cycle_residue.residue_algs})`);
    }
    lines.push('');
    lines.push('Edges pseudoswap:');
    for (const segment of pseudoEdgeSegments) lines.push(`  buffer ${segment.buffer}: ${pairLetters(segment.targets)}`);
    lines.push(`  flips: ${stickersToLetters(pseudo.edges.flips.list)} (count ${pseudo.edges.flips.count}, algs ${pseudo.edges.flips.algs})`);
    lines.push(`  algs: ${pseudo.edges.analysis.algs} (standalone ${pseudo.edges.analysis.standalone_algs}, saved ${pseudo.edges.analysis.saved_by_pairing})`);
    if (pseudo.edges.cycle_residue) {
      lines.push(`  residues: ${pseudo.edges.cycle_residue.residue_types.join(' ') || 'closed'} (base ${pseudo.edges.cycle_residue.base_algs}, residue ${pseudo.edges.cycle_residue.residue_algs})`);
    }
    return lines.join('\n');
  }

  function extractScrambleRecords(text, includeDnfs) {
    const lines = text.trim().split(/\r?\n/);
    const records = [];
    for (let line of lines) {
      line = line.trim();
      line = line.replace(/\[.*\]/g, '');
      const lower = line.toLowerCase();
      if (['generated by cstimer', 'solves/total', 'single', 'best', 'worst', 'avg of', 'current', 'average', 'mean', 'time list'].some((phrase) => lower.includes(phrase))) continue;
      const isDnf = /DNF/.test(line);
      if (!includeDnfs && isDnf) continue;
      line = line.replace(/DNF/g, '');
      line = line.replace(WCA_ROW_PREFIX_RE, '');
      const matchMove = line.match(MOVE_START_RE);
      if (matchMove && matchMove.index !== undefined) line = line.slice(matchMove.index);
      else continue;
      const atIndex = line.indexOf('@');
      if (atIndex !== -1) line = line.slice(0, atIndex);
      line = line.trim();
      if (line) records.push({ scramble: line, dnf: isDnf });
    }
    return records;
  }

  function extractScrambleList(text, dnf) {
    return extractScrambleRecords(text, dnf).map((record) => record.scramble);
  }

  function algCounterMain(text, tracingOrientation = '', edgeMethod = 'weakswap', flipWeight = 1, twistWeight = 1, finishCapability = false, dnf = false, cornerBuffers = ['UFR'], edgeBuffers = ['UF']) {
    const normalizedFinishCapability = normalizeFinishCapability(finishCapability);
    const scrambleRecords = extractScrambleRecords(text, dnf);
    const scrList = scrambleRecords.map((record) => record.scramble);
    const algBreakdownList = scrList.map((scr) => countScrambleAlgs(scr, tracingOrientation, edgeMethod, flipWeight, twistWeight, normalizedFinishCapability, cornerBuffers, edgeBuffers));
    const finalCount = {};
    let totalTwoFlips = 0;
    let totalTwoTwists = 0;
    let totalCornerAlgs = 0;
    let totalEdgeAlgs = 0;
    for (const algsPerScr of algBreakdownList) {
      finalCount[algsPerScr[0]] = (finalCount[algsPerScr[0]] || 0) + 1;
      totalTwoFlips += algsPerScr[1];
      totalTwoTwists += algsPerScr[2];
      totalCornerAlgs += algsPerScr[3];
      totalEdgeAlgs += algsPerScr[4];
    }
    const algCountList = algBreakdownList.map((e) => e[0]);
    const sortedEntries = Object.entries(finalCount).map(([k, v]) => [Number(k), v]).sort((a, b) => a[0] - b[0]);
    const numberOfCasesWithNAlgsDict = Object.fromEntries(sortedEntries);
    let totalAlgs = sortedEntries.reduce((sum, [k, v]) => sum + k * v, 0);
    const averageAlgsPer = Number((totalAlgs / scrList.length).toFixed(5));
    totalAlgs = Number(totalAlgs.toFixed(5));
    totalCornerAlgs = Number(totalCornerAlgs.toFixed(5));
    totalEdgeAlgs = Number(totalEdgeAlgs.toFixed(5));
    const scrambleAlgBreakdownList = algBreakdownList.map((result, index) => ({
      scramble: scrList[index],
      dnf: scrambleRecords[index].dnf,
      total_algs: Number(result[0].toFixed(5)),
      corner_algs: Number(result[3].toFixed(5)),
      edge_algs: Number(result[4].toFixed(5)),
      two_flips: result[1],
      two_twists: result[2],
      finish_capability: result[7],
      finish_type: result[6],
      finish_used: Boolean(result[6]),
      finish_saved_algs: result[5],
      ltct_used: result[6] === 'ltct',
      ltct_saved_algs: result[6] === 'ltct' ? result[5] : 0,
    }));
    return [
      algCountList.length,
      numberOfCasesWithNAlgsDict,
      averageAlgsPer,
      totalAlgs,
      totalTwoFlips,
      totalTwoTwists,
      algCountList,
      totalCornerAlgs,
      totalEdgeAlgs,
      scrambleAlgBreakdownList,
    ];
  }

  const api = {
    algCounterMain,
    analyzeScramble,
    buildCornerBreakdown,
    buildEdgeBreakdown,
    countScrambleAlgs,
    debugHumanReviewReport,
    extractScrambleList,
    extractScrambleRecords,
    normalizeFinishCapability,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
