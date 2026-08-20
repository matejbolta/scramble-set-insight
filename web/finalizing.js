(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? {
        cornerTracing: require('./corner-tracing'),
        residuePlanner: require('./cycle-residue-planner'),
        edgeCommon: require('./edge-common'),
      }
    : {
        cornerTracing: global.SsiCoreModules,
        residuePlanner: global.SsiCoreModules,
        edgeCommon: global.SsiCoreModules,
      };

  const {
    normalizeCornerBuffers,
  } = deps.cornerTracing;
  const { scrToScrambledStateCor, scrToScrambledStateEdg } = typeof module !== 'undefined' && module.exports
    ? require('./scrambling')
    : global.SsiCoreModules;
  const {
    FULL_CORNER_BUFFERS,
    planCornerStateByResidues,
    planCornerStateBySelectedBuffers,
    planEdgeStateBySelectedBuffers,
    planEdgeStateBySingletonWeakswap,
    planEdgeStateByWeakswapFloating,
    normalizeWeak2e2eCapability,
  } = deps.residuePlanner;
  const {
    normalizeEdgeBuffers,
    pairLetters,
    segmentsToLetterView,
    stickersToLetters,
  } = deps.edgeCommon;

  const MOVE_START_RE = /(^|\s)(?:[UDRLFB](?:w)?|[MES]|[xyzXYZ])(?:2'?|')?(?=\s|$)/;
  const MOVE_TOKEN_RE = /^(?:[UDRLFB](?:w)?|[MES]|[xyzXYZ])(?:2'?|')?$/;
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

  function normalizeAdvancedOptions(options = {}) {
    return {
      corner_floating_parity: Boolean(
        options.corner_floating_parity ?? options.cornerFloatingParity,
      ),
      edge_finish_capability: options.edge_finish_capability
        ?? options.edgeFinishCapability,
      ltef: Boolean(options.ltef),
      terminal_weights: options.terminal_weights ?? options.terminalWeights ?? {},
    };
  }

  function buildCornerBreakdown(
    scr,
    tracingOrientation,
    cornerBuffers,
    twistWeight,
    finishCapability,
    edgeMethod = 'weakswap',
    advancedOptions = {},
  ) {
    const advanced = normalizeAdvancedOptions(advancedOptions);
    const normalizedFinishCapability = normalizeFinishCapability(finishCapability);
    const normalizedCornerBuffers = normalizeCornerBuffers(cornerBuffers);
    const cornerState = scrToScrambledStateCor(scr, tracingOrientation);
    if (sameBufferSet(normalizedCornerBuffers, FULL_CORNER_BUFFERS)) {
      const plan = planCornerStateByResidues(
        cornerState,
        normalizedCornerBuffers,
        normalizedFinishCapability,
        twistWeight,
        advanced.corner_floating_parity,
        advanced.terminal_weights,
      );
      const twoTwists = plan.baseline_orientation_algs;
      const finishType = plan.finish_adjustment < -1e-12
        && ['ltct', 't2c', 'corner-floating-parity'].includes(plan.finish?.type)
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
    const plan = planCornerStateBySelectedBuffers(
      cornerState,
      normalizedCornerBuffers,
      normalizedFinishCapability,
      twistWeight,
      advanced.corner_floating_parity,
      advanced.terminal_weights,
    );
    const twoTwists = plan.baseline_orientation_algs;
    const finishType = plan.finish_adjustment < -1e-12
      && ['ltct', 't2c', 'corner-floating-parity'].includes(plan.finish?.type)
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

  function buildEdgeBreakdown(
    scr,
    tracingOrientation,
    edgeMethod,
    edgeBuffers,
    flipWeight,
    cornerParity,
    weak2e2eCapability = '2e2e',
    advancedOptions = {},
  ) {
    const advanced = normalizeAdvancedOptions(advancedOptions);
    const normalizedEdgeBuffers = normalizeEdgeBuffers(edgeBuffers, edgeMethod);
    const normalizedWeak2e2eCapability = normalizeWeak2e2eCapability(
      advanced.edge_finish_capability
        ?? (edgeMethod === 'weakswap' ? weak2e2eCapability : 'none'),
    );
    if (edgeMethod === 'pseudoswap') {
      const edgeState = scrToScrambledStateEdg(scr, tracingOrientation);
      const pseudoException = normalizedEdgeBuffers.length === 2
        && normalizedEdgeBuffers.includes('UF')
        && normalizedEdgeBuffers.includes('UB')
        && !normalizedEdgeBuffers.includes('UR');
      const activeCapability = pseudoException ? 'none' : normalizedWeak2e2eCapability;
      const plan = planEdgeStateBySelectedBuffers(
        edgeState,
        cornerParity,
        normalizedEdgeBuffers,
        flipWeight,
        activeCapability,
        advanced.terminal_weights,
      );
      const twoFlips = plan.orientation_algs;
      const usesCycleResidues = Boolean(plan.reduced);
      return {
        method: edgeMethod,
        edge_finish_type: plan.finish?.type || null,
        buffers: normalizedEdgeBuffers,
        tracing_model: usesCycleResidues ? 'cycle-residue' : 'selected-buffer',
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
        ...(usesCycleResidues
          ? {
              cycle_residue: {
                base_algs: plan.base_algs,
                residue_algs: plan.total_algs - plan.base_algs,
                residue_types: [...plan.reduced.residue_types],
                orientation_weight: flipWeight,
                finish: plan.finish,
              },
            }
          : {
              selected_buffer: {
                count: normalizedEdgeBuffers.length,
                orientation_weight: flipWeight,
                capability: activeCapability,
                finish: plan.finish,
              },
            }),
      };
    }
    if (normalizedEdgeBuffers.length === 1) {
      const edgeState = scrToScrambledStateEdg(scr, tracingOrientation);
      const plan = planEdgeStateBySingletonWeakswap(
        edgeState,
        cornerParity,
        flipWeight,
        advanced.terminal_weights,
        advanced.ltef,
      );
      return {
        method: edgeMethod,
        edge_finish_type: plan.finish?.type || null,
        buffers: normalizedEdgeBuffers,
        tracing_model: 'cycle-model',
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
          count: plan.flip_count,
          two_flips: plan.orientation_algs,
          algs: plan.orientation_algs * flipWeight + plan.single_flip_algs,
        },
        weakswap_cycle: {
          target_count: plan.target_count,
          single_flip_algs: plan.single_flip_algs,
          ...plan.weakswap,
          finish: plan.finish,
        },
      };
    }
    if (normalizedEdgeBuffers.length > 1) {
      const edgeState = scrToScrambledStateEdg(scr, tracingOrientation);
      const plan = planEdgeStateByWeakswapFloating(
        edgeState,
        cornerParity,
        normalizedEdgeBuffers,
        normalizedWeak2e2eCapability,
        flipWeight,
        advanced.terminal_weights,
        advanced.ltef,
      );
      return {
        method: edgeMethod,
        edge_finish_type: plan.finish?.type || null,
        buffers: normalizedEdgeBuffers,
        tracing_model: 'weakswap-selected-buffer',
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
          count: plan.orientation_algs * 2 + plan.single_flip_algs,
          two_flips: plan.orientation_algs,
          algs: plan.orientation_algs * flipWeight + plan.single_flip_algs,
        },
        weakswap_floating: {
          count: normalizedEdgeBuffers.length,
          orientation_weight: flipWeight,
          capability: normalizedEdgeBuffers.length >= 3
            ? normalizedWeak2e2eCapability
            : 'none',
          finish: plan.finish,
          ltef: advanced.ltef,
          entry_mode: plan.weak_entry_mode,
          entry_required_capability: plan.weak_entry_required_capability,
          entry_prefix_fixed_algs: plan.weak_entry_prefix_fixed_algs,
          legal_entry_count: plan.weak_entry_count,
          explored_entry_state_count: plan.weak_entry_explored_state_count,
        },
      };
    }
    throw new Error(`Unsupported edge counting route: ${edgeMethod}.`);
  }

  function countScrambleAlgs(
    scr,
    tracingOrientation,
    edgeMethod,
    flipWeight,
    twistWeight,
    finishCapability,
    cornerBuffers = ['UFR'],
    edgeBuffers = ['UF'],
    weak2e2eCapability = '2e2e',
    advancedOptions = {},
  ) {
    const corner = buildCornerBreakdown(
      scr,
      tracingOrientation,
      cornerBuffers,
      twistWeight,
      finishCapability,
      edgeMethod,
      advancedOptions,
    );
    const edges = buildEdgeBreakdown(
      scr,
      tracingOrientation,
      edgeMethod,
      edgeBuffers,
      flipWeight,
      corner.analysis.parity,
      weak2e2eCapability,
      advancedOptions,
    );
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
      edges.edge_finish_type,
    ];
  }

  function analyzeScramble(
    scr,
    tracingOrientation = '',
    edgeMethod = 'weakswap',
    flipWeight = 1,
    twistWeight = 1,
    finishCapability = false,
    cornerBuffers = ['UFR'],
    edgeBuffers = ['UF'],
    weak2e2eCapability = '2e2e',
    advancedOptions = {},
  ) {
    const advanced = normalizeAdvancedOptions(advancedOptions);
    const normalizedWeak2e2eCapability = normalizeWeak2e2eCapability(
      advanced.edge_finish_capability
        ?? (edgeMethod === 'weakswap' ? weak2e2eCapability : 'none'),
    );
    const corner = buildCornerBreakdown(
      scr,
      tracingOrientation,
      cornerBuffers,
      twistWeight,
      finishCapability,
      edgeMethod,
      advanced,
    );
    const edges = buildEdgeBreakdown(
      scr,
      tracingOrientation,
      edgeMethod,
      edgeBuffers,
      flipWeight,
      corner.analysis.parity,
      normalizedWeak2e2eCapability,
      advanced,
    );
    const cornerAlgs = corner.analysis.algs + corner.twists.algs + corner.ltct_adjustment;
    const edgeAlgs = edges.analysis.algs + edges.flips.algs;
    const totalAlgs = cornerAlgs + edgeAlgs;
    return {
      scramble: scr,
      tracing_orientation: tracingOrientation,
      edge_method: edgeMethod,
      weak_2e2e_capability: edgeMethod === 'weakswap'
        && edges.buffers.length >= 3
        ? normalizedWeak2e2eCapability
        : 'none',
      weak_2e2e_prime: edgeMethod === 'weakswap'
        && edges.buffers.length >= 3
        && ['f2e', 'ff2e'].includes(normalizedWeak2e2eCapability),
      edge_finish_capability: edges.buffers.length >= 3
        ? normalizedWeak2e2eCapability
        : 'none',
      ltef: edgeMethod === 'weakswap' && advanced.ltef,
      corner_buffers: corner.buffers,
      edge_buffers: edges.buffers,
      corner: {
        tracing_model: corner.tracing_model,
        segments: corner.segments,
        targets: corner.targets,
        analysis: corner.analysis,
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
      if (matchMove && matchMove.index !== undefined) {
        line = line.slice(matchMove.index + matchMove[1].length);
      }
      else continue;
      const atIndex = line.indexOf('@');
      if (atIndex !== -1) line = line.slice(0, atIndex);
      line = line.trim();
      if (line && line.split(/\s+/).every((move) => MOVE_TOKEN_RE.test(move))) {
        records.push({ scramble: line, dnf: isDnf });
      }
    }
    return records;
  }

  function extractScrambleList(text, dnf) {
    return extractScrambleRecords(text, dnf).map((record) => record.scramble);
  }

  function algCounterMain(
    text,
    tracingOrientation = '',
    edgeMethod = 'weakswap',
    flipWeight = 1,
    twistWeight = 1,
    finishCapability = false,
    dnf = false,
    cornerBuffers = ['UFR'],
    edgeBuffers = ['UF'],
    weak2e2eCapability = '2e2e',
    advancedOptions = {},
  ) {
    const advanced = normalizeAdvancedOptions(advancedOptions);
    const normalizedFinishCapability = normalizeFinishCapability(finishCapability);
    const normalizedWeak2e2eCapability = normalizeWeak2e2eCapability(
      advanced.edge_finish_capability
        ?? (edgeMethod === 'weakswap' ? weak2e2eCapability : 'none'),
    );
    const normalizedEdgeBuffers = normalizeEdgeBuffers(edgeBuffers, edgeMethod);
    const pseudoException = edgeMethod === 'pseudoswap'
      && normalizedEdgeBuffers.length === 2
      && normalizedEdgeBuffers.includes('UF')
      && normalizedEdgeBuffers.includes('UB')
      && !normalizedEdgeBuffers.includes('UR');
    const activeWeak2e2eCapability = normalizedEdgeBuffers.length >= 3
      && !pseudoException
      ? normalizedWeak2e2eCapability
      : 'none';
    const scrambleRecords = extractScrambleRecords(text, dnf);
    const scrList = scrambleRecords.map((record) => record.scramble);
    const algBreakdownList = scrList.map((scr) => countScrambleAlgs(
      scr,
      tracingOrientation,
      edgeMethod,
      flipWeight,
      twistWeight,
      normalizedFinishCapability,
      cornerBuffers,
      normalizedEdgeBuffers,
      normalizedWeak2e2eCapability,
      advanced,
    ));
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
      edge_finish_type: result[8],
      finish_types: [result[6], result[8]].filter(Boolean),
      finish_used: Boolean(result[6] || result[8]),
      finish_saved_algs: result[5],
      ltct_used: result[6] === 'ltct',
      ltct_saved_algs: result[6] === 'ltct' ? result[5] : 0,
      weak_2e2e_capability: edgeMethod === 'weakswap'
        ? activeWeak2e2eCapability
        : 'none',
      weak_2e2e_prime: edgeMethod === 'weakswap'
        && ['f2e', 'ff2e'].includes(activeWeak2e2eCapability),
      edge_finish_capability: activeWeak2e2eCapability,
      ltef: edgeMethod === 'weakswap' && advanced.ltef,
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
    normalizeAdvancedOptions,
    normalizeWeak2e2eCapability,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
