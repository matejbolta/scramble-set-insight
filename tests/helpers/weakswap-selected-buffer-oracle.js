const cycleModel = require('../../web/cycle-model');
const selectedOracle = require('./selected-buffer-class-oracle');

const graphCache = new Map();
const frontierCache = new Map();

// This oracle covers the exact rooted suffix after a legal UF/UR weak entry.
// The production entry automaton is tested separately; these action graphs
// must never be interpreted as permission to start from an arbitrary weak
// state with a pseudo-style UR comm.

class Uint32ChunkList {
  constructor(chunkSize = 1 << 20) {
    this.chunkSize = chunkSize;
    this.chunks = [];
    this.length = 0;
  }

  push(value) {
    const chunkIndex = Math.floor(this.length / this.chunkSize);
    const offset = this.length % this.chunkSize;
    if (!this.chunks[chunkIndex]) {
      this.chunks.push(new Uint32Array(this.chunkSize));
    }
    this.chunks[chunkIndex][offset] = value;
    this.length += 1;
  }

  get(index) {
    return this.chunks[Math.floor(index / this.chunkSize)][index % this.chunkSize];
  }
}

function metadata() {
  const groups = cycleModel.EDGE_PIECE_GROUPS;
  return {
    groups,
    modulus: 2,
    pieceIndex: new Map(groups.flatMap((group, index) => (
      group.map((sticker) => [sticker, index])
    ))),
  };
}

function compactFromState(state, meta = metadata()) {
  const pieces = [];
  const orientations = [];
  for (const group of meta.groups) {
    const sticker = state[group[0]];
    const piece = meta.pieceIndex.get(sticker);
    if (piece === undefined) throw new Error(`Unknown edge sticker: ${sticker}`);
    pieces.push(piece);
    orientations.push(meta.groups[piece].indexOf(sticker));
  }
  return { pieces, orientations };
}

function minimumRotation(values) {
  if (values.length < 2) return values.join('');
  let best = null;
  for (let offset = 0; offset < values.length; offset += 1) {
    const candidate = values.slice(offset).concat(values.slice(0, offset)).join('');
    if (best === null || candidate < best) best = candidate;
  }
  return best;
}

function weakClassKeyFromCompact(compact, selectedIndices, meta = metadata()) {
  const selected = new Set(selectedIndices);
  const ufIndex = meta.pieceIndex.get('UF');
  const urIndex = meta.pieceIndex.get('UR');
  const visited = new Set();
  const records = [];

  for (let start = 0; start < compact.pieces.length; start += 1) {
    if (visited.has(start)) continue;
    const slots = [];
    let current = start;
    while (!visited.has(current)) {
      visited.add(current);
      slots.push(current);
      current = compact.pieces[current];
    }
    if (current !== start) throw new Error('Compact edge cycle did not close.');
    const orientationSum = slots.reduce(
      (sum, slot) => sum + compact.orientations[slot],
      0,
    ) % 2;
    if (slots.length === 1 && orientationSum === 0) continue;
    const colors = slots.map((slot) => {
      if (slot === ufIndex) return 'U';
      if (slot === urIndex) return 'R';
      return selected.has(slot) ? 'B' : 'N';
    });
    let rootPhase = '';
    if (slots.includes(ufIndex) && slots.includes(urIndex)) {
      let current = ufIndex;
      let phase = 0;
      while (current !== urIndex) {
        phase ^= compact.orientations[current];
        current = compact.pieces[current];
      }
      rootPhase = `:${phase}`;
    }
    // A 2E cycle closes on its starting sticker and has charge zero; a 2E'
    // cycle closes on the opposite sticker and has charge one. F2E and FF2E
    // pair two such orientation-open residues, with different rooted frames.
    records.push(`${minimumRotation(colors)}:${slots.length}:${orientationSum}${rootPhase}`);
  }
  records.sort();
  return records.join('|') || 'solved';
}

function weakClassKey(state, selectedBuffers) {
  const meta = metadata();
  const selectedIndices = selectedBuffers.map((buffer) => meta.pieceIndex.get(buffer));
  return weakClassKeyFromCompact(compactFromState(state, meta), selectedIndices, meta);
}

function applyCompactGenerator(state, generator, modulus = 2) {
  const pieces = new Array(state.pieces.length);
  const orientations = new Array(state.orientations.length);
  for (let slot = 0; slot < pieces.length; slot += 1) {
    const source = generator.pieces[slot];
    pieces[slot] = state.pieces[source];
    orientations[slot] = (
      state.orientations[source] + generator.orientations[slot]
    ) % modulus;
  }
  return { pieces, orientations };
}

function weakCorrectionActions(selectedBuffers, allowPrime = false) {
  const meta = metadata();
  const groups = meta.groups;
  const eligibleBuffers = selectedBuffers.filter((buffer) => !['UF', 'UR'].includes(buffer));
  const floatingPairs = [];
  const seen = new Set();
  const actions = [];
  const ufPiece = meta.pieceIndex.get('UF');
  const urPiece = meta.pieceIndex.get('UR');

  for (const buffer of eligibleBuffers) {
    for (const targetGroup of groups) {
      const target = targetGroup[0];
      if (
        target === buffer
        || ['UF', 'UR'].includes(target)
      ) continue;
      floatingPairs.push([buffer, target]);
    }
  }

  // Full weak floating includes the learned BR-BL terminal subset even
  // though neither physical piece is present in the canonical buffer list.
  // Partial prefixes do not inherit this exceptional pair.
  if (
    selectedBuffers.length === selectedOracle.EDGE_BUFFER_ORDER.length
    && selectedOracle.EDGE_BUFFER_ORDER.every((buffer) => selectedBuffers.includes(buffer))
  ) {
    floatingPairs.push(['BR', 'BL']);
  }

  for (const [buffer, target] of floatingPairs) {
    const bufferPiece = meta.pieceIndex.get(buffer);
    const targetPiece = meta.pieceIndex.get(target);
    for (const prime of allowPrime ? [false, true] : [false]) {
      const floatingPatterns = prime
        ? [[0, 1], [1, 0]]
        : [[0, 0], [1, 1]];
      // The learned anchor subset is sticker-specific: UF-UR-UF (whose
      // companion orbit is FU-RU-FU). The distinct charge-zero
      // UF-RU-UF swap is not part of the subset. The two charge-one anchor
      // patterns are retained separately as F2E and FF2E.
      const anchorPatterns = prime ? [[0, 1], [1, 0]] : [[0, 0]];
      for (const anchorPattern of anchorPatterns) {
        for (const floatingPattern of floatingPatterns) {
          const pieces = groups.map((group, index) => index);
          const orientations = Array(groups.length).fill(0);
          pieces[ufPiece] = urPiece;
          pieces[urPiece] = ufPiece;
          pieces[bufferPiece] = targetPiece;
          pieces[targetPiece] = bufferPiece;
          [orientations[ufPiece], orientations[urPiece]] = anchorPattern;
          [orientations[bufferPiece], orientations[targetPiece]] = floatingPattern;
          const generator = { pieces, orientations };
          const key = `${pieces.join(',')}|${orientations.join(',')}`;
          if (seen.has(key)) continue;
          seen.add(key);
          actions.push({
            type: prime ? '2E2E-prime' : '2E2E',
            terminal_type: prime
              ? anchorPattern[0] === 1 ? 'f2e' : 'ff2e'
              : '2e2e',
            buffer,
            target,
            generator,
          });
        }
      }
    }
  }
  return actions;
}

function prunePareto(labels) {
  const unique = new Map();
  for (const label of labels) {
    const key = `${label.fixed_algs},${label.orientation_algs}`;
    if (!unique.has(key)) unique.set(key, label);
  }
  const candidates = [...unique.values()];
  return candidates.filter((candidate, index) => !candidates.some((other, otherIndex) => (
    otherIndex !== index
    && other.fixed_algs <= candidate.fixed_algs
    && other.orientation_algs <= candidate.orientation_algs
    && (
      other.fixed_algs < candidate.fixed_algs
      || other.orientation_algs < candidate.orientation_algs
    )
  ))).sort((left, right) => (
    left.fixed_algs - right.fixed_algs
    || left.orientation_algs - right.orientation_algs
  ));
}

function sameFrontier(left, right) {
  return left.length === right.length && left.every((label, index) => (
    label.fixed_algs === right[index].fixed_algs
    && label.orientation_algs === right[index].orientation_algs
  ));
}

function buildWeakClassGraph(selectedBuffers, _allowPrime = false, options = {}) {
  if (selectedBuffers.length < 2 || selectedBuffers[0] !== 'UF' || selectedBuffers[1] !== 'UR') {
    throw new Error('Weak floating class graphs require the UF, UR prefix.');
  }
  const cacheKey = selectedBuffers.join(',');
  if (graphCache.has(cacheKey)) return graphCache.get(cacheKey);
  const meta = metadata();
  const solved = cycleModel.solvedStateFromPieceGroups(meta.groups);
  const selectedIndices = selectedBuffers.map((buffer) => meta.pieceIndex.get(buffer));
  const keyFor = (state) => weakClassKeyFromCompact(state, selectedIndices, meta);
  const commGenerators = selectedOracle.selectedCommActions('edge', selectedBuffers)
    .map((action) => compactFromState(action.apply(solved), meta));
  const correctionActions = weakCorrectionActions(selectedBuffers, true);
  const fixedGenerators = commGenerators;
  const seed = compactFromState(solved, meta);
  const seedKey = keyFor(seed);
  const representatives = new Map([[seedKey, seed]]);
  const graph = new Map();
  const queue = [seedKey];
  const maximumClasses = options.maximum_classes ?? Infinity;

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const key = queue[cursor];
    const state = representatives.get(key);
    const neighbors = new Map();

    function addNeighbor(next, fixedAlgs, orientationAlgs) {
      const nextKey = keyFor(next);
      const costKey = `${nextKey}|${fixedAlgs},${orientationAlgs}`;
      if (!neighbors.has(costKey)) {
        neighbors.set(costKey, {
          key: nextKey,
          fixed_algs: fixedAlgs,
          orientation_algs: orientationAlgs,
        });
      }
      if (!representatives.has(nextKey)) {
        if (representatives.size >= maximumClasses) {
          throw new Error(`Weak class graph exceeded ${maximumClasses} classes.`);
        }
        representatives.set(nextKey, next);
        queue.push(nextKey);
      }
    }

    for (const generator of fixedGenerators) {
      addNeighbor(applyCompactGenerator(state, generator), 1, 0);
    }
    const fixed = [];
    for (let piece = 0; piece < state.pieces.length; piece += 1) {
      if (state.pieces[piece] === piece) fixed.push(piece);
    }
    for (let left = 0; left < fixed.length; left += 1) {
      for (let right = left + 1; right < fixed.length; right += 1) {
        const next = {
          pieces: [...state.pieces],
          orientations: [...state.orientations],
        };
        next.orientations[fixed[left]] ^= 1;
        next.orientations[fixed[right]] ^= 1;
        addNeighbor(next, 0, 1);
      }
    }
    graph.set(key, [...neighbors.values()]);
  }

  const result = {
    graph,
    representatives,
    seed_key: seedKey,
    normal_terminal_keys: [...new Set(correctionActions
      .filter((action) => action.type === '2E2E')
      .map((action) => keyFor(action.generator)))],
    prime_terminal_keys: [...new Set(correctionActions
      .filter((action) => action.type === '2E2E-prime')
      .map((action) => keyFor(action.generator)))],
    terminal_keys: Object.fromEntries(['2e2e', 'f2e', 'ff2e'].map((terminalType) => [
      terminalType,
      [...new Set(correctionActions
        .filter((action) => action.terminal_type === terminalType)
        .map((action) => keyFor(action.generator)))],
    ])),
    fixed_generator_count: fixedGenerators.length,
    comm_generator_count: commGenerators.length,
    correction_generator_count: correctionActions.length,
  };
  graphCache.set(cacheKey, result);
  return result;
}

function exactWeakFrontiers(selectedBuffers, allowPrime = false, options = {}) {
  const cacheKey = `${selectedBuffers.join(',')}|${allowPrime ? 'prime' : 'basic'}`;
  if (frontierCache.has(cacheKey)) return frontierCache.get(cacheKey);
  const result = buildWeakClassGraph(selectedBuffers, allowPrime, options);
  const frontiers = new Map([...result.graph.keys()].map((key) => [key, []]));
  frontiers.set(result.seed_key, [{ fixed_algs: 0, orientation_algs: 0 }]);
  const terminalKeys = [
    ...result.normal_terminal_keys,
    ...(allowPrime ? result.prime_terminal_keys : []),
  ];
  for (const key of terminalKeys) {
    if (!frontiers.has(key)) throw new Error(`Weak terminal class is unreachable: ${key}`);
    frontiers.set(key, prunePareto([
      ...frontiers.get(key),
      { fixed_algs: 1, orientation_algs: 0 },
    ]));
  }
  const queue = [...new Set([result.seed_key, ...terminalKeys])];
  const queued = new Set(queue);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const key = queue[cursor];
    queued.delete(key);
    const source = frontiers.get(key);
    for (const edge of result.graph.get(key)) {
      const translated = source.map((label) => ({
        fixed_algs: label.fixed_algs + edge.fixed_algs,
        orientation_algs: label.orientation_algs + edge.orientation_algs,
      }));
      const previous = frontiers.get(edge.key);
      const next = prunePareto([...previous, ...translated]);
      if (sameFrontier(previous, next)) continue;
      frontiers.set(edge.key, next);
      if (!queued.has(edge.key)) {
        queue.push(edge.key);
        queued.add(edge.key);
      }
    }
  }

  const exact = { ...result, frontiers };
  frontierCache.set(cacheKey, exact);
  return exact;
}

function pruneEncodedFrontier(labels) {
  const unique = new Map();
  for (const label of labels) unique.set(`${label[0]},${label[1]}`, label);
  const candidates = [...unique.values()];
  return candidates.filter((candidate, index) => !candidates.some((other, otherIndex) => (
    otherIndex !== index
    && other[0] <= candidate[0]
    && other[1] <= candidate[1]
    && (other[0] < candidate[0] || other[1] < candidate[1])
  ))).sort((left, right) => left[0] - right[0] || left[1] - right[1]);
}

function sameEncodedFrontier(left, right) {
  return left.length === right.length && left.every((label, index) => (
    label[0] === right[index][0] && label[1] === right[index][1]
  ));
}

// The generated high-buffer catalogs contain hundreds of millions of class
// transitions. This is the same quotient graph as buildWeakClassGraph, stored
// as packed target/flag integers instead of one JavaScript object per edge.
// Bit 0 encodes orientation cost; the remaining bits encode the target class
// id. 2E2E, F2E, and FF2E are terminal seeds, never graph transitions.
function buildCompactWeakClassGraph(selectedBuffers, options = {}) {
  if (selectedBuffers.length < 2 || selectedBuffers[0] !== 'UF' || selectedBuffers[1] !== 'UR') {
    throw new Error('Weak floating class graphs require the UF, UR prefix.');
  }
  const meta = metadata();
  const solved = cycleModel.solvedStateFromPieceGroups(meta.groups);
  const selectedIndices = selectedBuffers.map((buffer) => meta.pieceIndex.get(buffer));
  const keyFor = (state) => weakClassKeyFromCompact(state, selectedIndices, meta);
  const commGenerators = selectedOracle.selectedCommActions('edge', selectedBuffers)
    .map((action) => compactFromState(action.apply(solved), meta));
  const correctionActions = weakCorrectionActions(selectedBuffers, true);
  const fixedGenerators = commGenerators;
  const seed = compactFromState(solved, meta);
  const seedKey = keyFor(seed);
  const keys = [seedKey];
  const representatives = [seed];
  const keyToId = new Map([[seedKey, 0]]);
  const offsets = [0];
  const edges = new Uint32ChunkList();
  const maximumClasses = options.maximum_classes ?? Infinity;
  const onProgress = options.on_progress;

  function classId(next) {
    const key = keyFor(next);
    const known = keyToId.get(key);
    if (known !== undefined) return known;
    if (keys.length >= maximumClasses) {
      throw new Error(`Weak class graph exceeded ${maximumClasses} classes.`);
    }
    const id = keys.length;
    keyToId.set(key, id);
    keys.push(key);
    representatives.push(next);
    return id;
  }

  for (let cursor = 0; cursor < representatives.length; cursor += 1) {
    const state = representatives[cursor];
    const neighbors = new Map();

    function addNeighbor(next, orientationCost) {
      const target = classId(next);
      const signature = `${target}|${orientationCost}`;
      if (!neighbors.has(signature)) {
        neighbors.set(signature, {
          target,
          orientation_cost: orientationCost,
        });
      }
    }

    for (const generator of fixedGenerators) {
      addNeighbor(applyCompactGenerator(state, generator), 0);
    }
    const fixed = [];
    for (let piece = 0; piece < state.pieces.length; piece += 1) {
      if (state.pieces[piece] === piece) fixed.push(piece);
    }
    for (let left = 0; left < fixed.length; left += 1) {
      for (let right = left + 1; right < fixed.length; right += 1) {
        const next = {
          pieces: [...state.pieces],
          orientations: [...state.orientations],
        };
        next.orientations[fixed[left]] ^= 1;
        next.orientations[fixed[right]] ^= 1;
        addNeighbor(next, 1);
      }
    }

    for (const edge of neighbors.values()) {
      edges.push(
        (edge.target * 4)
        + edge.orientation_cost,
      );
    }
    offsets.push(edges.length);
    if (onProgress && cursor > 0 && cursor % 10000 === 0) {
      onProgress({
        phase: 'graph',
        processed_classes: cursor,
        discovered_classes: representatives.length,
        graph_edges: edges.length,
      });
    }
  }

  const terminalIds = (type) => [...new Set(correctionActions
    .filter((action) => action.type === type)
    .map((action) => {
      const id = keyToId.get(keyFor(action.generator));
      if (id === undefined) throw new Error(`Weak terminal is unreachable: ${type}`);
      return id;
    }))];

  return {
    edges,
    graph_edges: edges.length,
    keys,
    offsets,
    representatives,
    seed_id: 0,
    normal_terminal_ids: terminalIds('2E2E'),
    prime_terminal_ids: terminalIds('2E2E-prime'),
    terminal_ids: Object.fromEntries(['2e2e', 'f2e', 'ff2e'].map((terminalType) => [
      terminalType,
      [...new Set(correctionActions
        .filter((action) => action.terminal_type === terminalType)
        .map((action) => {
          const id = keyToId.get(keyFor(action.generator));
          if (id === undefined) {
            throw new Error(`Weak terminal is unreachable: ${terminalType}`);
          }
          return id;
        }))],
    ])),
  };
}

function propagateCompactWeakFrontiers(graph, allowPrime, options = {}) {
  const frontiers = Array.from({ length: graph.keys.length }, () => []);
  frontiers[graph.seed_id] = [[0, 0]];
  const terminalIds = [
    ...graph.normal_terminal_ids,
    ...(allowPrime ? graph.prime_terminal_ids : []),
  ];
  for (const id of terminalIds) {
    frontiers[id] = pruneEncodedFrontier([...frontiers[id], [1, 0]]);
  }
  const queue = [...new Set([graph.seed_id, ...terminalIds])];
  const queued = new Uint8Array(graph.keys.length);
  queued[graph.seed_id] = 1;
  const onProgress = options.on_progress;

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    queued[id] = 0;
    const source = frontiers[id];
    for (let edgeIndex = graph.offsets[id]; edgeIndex < graph.offsets[id + 1]; edgeIndex += 1) {
      const encoded = graph.edges.get(edgeIndex);
      const orientationCost = encoded & 1;
      const target = Math.floor(encoded / 4);
      const fixedCost = orientationCost ? 0 : 1;
      const translated = source.map((label) => [
        label[0] + fixedCost,
        label[1] + orientationCost,
      ]);
      const previous = frontiers[target];
      const next = pruneEncodedFrontier([...previous, ...translated]);
      if (sameEncodedFrontier(previous, next)) continue;
      frontiers[target] = next;
      if (!queued[target]) {
        queue.push(target);
        queued[target] = 1;
      }
    }
    if (onProgress && cursor > 0 && cursor % 250000 === 0) {
      onProgress({
        phase: allowPrime ? 'maximal' : 'basic',
        processed_queue_entries: cursor,
        queued_entries: queue.length,
      });
    }
  }
  return frontiers;
}

function exactWeakCapabilityFrontiersCompact(selectedBuffers, options = {}) {
  const graph = buildCompactWeakClassGraph(selectedBuffers, options);
  graph.representatives = null;
  if (typeof global.gc === 'function') global.gc();
  if (options.on_progress) options.on_progress({ phase: 'basic-start' });
  const basic = propagateCompactWeakFrontiers(graph, false, options);
  if (options.on_progress) options.on_progress({ phase: 'maximal-start' });
  const maximal = propagateCompactWeakFrontiers(graph, true, options);
  return {
    basic,
    graph_edges: graph.graph_edges,
    keys: graph.keys,
    maximal,
  };
}

function exactWeakTerminalFrontiersCompact(selectedBuffers, options = {}) {
  const graph = buildCompactWeakClassGraph(selectedBuffers, options);
  graph.representatives = null;
  if (typeof global.gc === 'function') global.gc();
  const terminal = {};
  for (const terminalType of ['2e2e', 'f2e', 'ff2e']) {
    if (options.on_progress) {
      options.on_progress({ phase: `${terminalType}-start` });
    }
    terminal[terminalType] = propagateCompactWeakFrontiersFromSeeds(
      graph,
      graph.terminal_ids[terminalType],
      terminalType,
      options,
    );
  }
  return {
    graph_edges: graph.graph_edges,
    keys: graph.keys,
    terminal,
  };
}

function propagateCompactWeakFrontiersFromSeeds(
  graph,
  terminalIds,
  terminalType,
  options = {},
) {
  const frontiers = Array.from({ length: graph.keys.length }, () => []);
  for (const id of terminalIds) frontiers[id] = [[0, 0]];
  const queue = [...new Set(terminalIds)];
  const queued = new Uint8Array(graph.keys.length);
  for (const id of queue) queued[id] = 1;
  const onProgress = options.on_progress;

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    queued[id] = 0;
    const source = frontiers[id];
    for (let edgeIndex = graph.offsets[id]; edgeIndex < graph.offsets[id + 1]; edgeIndex += 1) {
      const encoded = graph.edges.get(edgeIndex);
      const orientationCost = encoded & 1;
      const target = Math.floor(encoded / 4);
      const fixedCost = orientationCost ? 0 : 1;
      const translated = source.map((label) => [
        label[0] + fixedCost,
        label[1] + orientationCost,
      ]);
      const previous = frontiers[target];
      const next = pruneEncodedFrontier([...previous, ...translated]);
      if (sameEncodedFrontier(previous, next)) continue;
      frontiers[target] = next;
      if (!queued[target]) {
        queue.push(target);
        queued[target] = 1;
      }
    }
    if (onProgress && cursor > 0 && cursor % 250000 === 0) {
      onProgress({
        phase: terminalType,
        processed_queue_entries: cursor,
        queued_entries: queue.length,
      });
    }
  }
  return frontiers;
}

function clearWeakOracleCaches() {
  graphCache.clear();
  frontierCache.clear();
}

module.exports = {
  buildWeakClassGraph,
  clearWeakOracleCaches,
  exactWeakCapabilityFrontiersCompact,
  exactWeakTerminalFrontiersCompact,
  exactWeakFrontiers,
  weakClassKey,
  weakClassKeyFromCompact,
  weakCorrectionActions,
};
