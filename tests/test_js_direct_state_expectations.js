const assert = require('assert/strict');
const bufferSelection = require('../web/buffer-selection');
const cornerTracing = require('../web/corner-tracing');
const cycleModel = require('../web/cycle-model');
const planner = require('../web/cycle-residue-planner');
const { synthesizeResidueState } = require('./helpers/cycle-residue-oracle');

// This audit deliberately starts from human-readable physical placements,
// rather than scrambles or generated frontier keys. Expected costs below are
// stated from the IRL rules. Production is only called after the expected
// value has been determined.

const GROUPS = {
  edge: cycleModel.EDGE_PIECE_GROUPS,
  corner: cornerTracing.CORNER_PIECE_GROUPS,
};

const BY_STICKER = Object.fromEntries(Object.entries(GROUPS).map(([kind, groups]) => [
  kind,
  new Map(groups.flatMap((group) => group.map((sticker) => [sticker, group]))),
]));
const auditMismatches = [];

function groupFor(kind, sticker) {
  const group = BY_STICKER[kind].get(sticker);
  if (!group) throw new Error(`Unknown ${kind} sticker or piece: ${sticker}`);
  return group;
}

function solvedState(kind) {
  return cycleModel.solvedStateFromPieceGroups(GROUPS[kind]);
}

function place(state, kind, slot, piece, orientation = 0) {
  const slotGroup = groupFor(kind, slot);
  const pieceGroup = groupFor(kind, piece);
  for (let offset = 0; offset < slotGroup.length; offset += 1) {
    state[slotGroup[offset]] = pieceGroup[(orientation + offset) % slotGroup.length];
  }
}

// `slot <- piece@orientation`: keys are physical slots and values are the
// pieces currently occupying them. This is the unambiguous form of UF=BR.
function stateFromPlacements(kind, placements) {
  const state = solvedState(kind);
  for (const [slot, piece, orientation = 0] of placements) {
    place(state, kind, slot, piece, orientation);
  }
  const model = kind === 'edge'
    ? cycleModel.decomposeEdgeState(state)
    : cycleModel.decomposeCornerState(state);
  assert.equal(model.orientation_sum, 0, `${kind} state must have closed orientation`);
  return state;
}

function cycleState(kind, pieces, orientations = pieces.map(() => 0)) {
  return stateFromPlacements(kind, pieces.map((slot, index) => [
    slot,
    pieces[(index + 1) % pieces.length],
    orientations[index],
  ]));
}

function swapPlacements(kind, left, right, totalCharge = 0, leftCharge = 0) {
  const modulus = GROUPS[kind][0].length;
  const rightCharge = (totalCharge - leftCharge + modulus) % modulus;
  return [
    [left, right, leftCharge],
    [right, left, rightCharge],
  ];
}

function activePlacements(kind, state) {
  return GROUPS[kind]
    .map((group) => group[0])
    .filter((slot) => state[slot] !== slot)
    .map((slot) => `${slot}←${state[slot]}`)
    .join(' ');
}

function closeTo(actual, expected, message) {
  if (Math.abs(actual - expected) < 1e-12) return true;
  auditMismatches.push({ message, expected, actual });
  return false;
}

function edgeStateInParityFrame(relativeState, parity) {
  if (!parity) return relativeState;
  const goal = planner.buildParityEdgeGoal(true, GROUPS.edge);
  const physical = Object.fromEntries(Object.keys(relativeState).map((location) => [
    location,
    goal[relativeState[location]],
  ]));
  const model = cycleModel.decomposeEdgeState(physical);
  assert.equal(model.permutation_parity, 1, 'odd physical edge frame must have parity');
  assert.equal(model.orientation_sum, 0, 'odd physical edge frame must keep closed orientation');
  return physical;
}

function pseudoEdgeAtParity(
  relativeState,
  parity,
  buffers,
  capability = 'none',
  terminalWeights = {},
  flipWeight = 1,
) {
  return planner.planEdgeStateBySelectedBuffers(
    edgeStateInParityFrame(relativeState, parity),
    parity,
    buffers,
    flipWeight,
    capability,
    terminalWeights,
  );
}

function pseudoEdge(state, buffers, capability = 'none', terminalWeights = {}, flipWeight = 1) {
  return pseudoEdgeAtParity(state, false, buffers, capability, terminalWeights, flipWeight);
}

function weakEdgeAtParity(
  relativeState,
  parity,
  buffers,
  capability = 'none',
  terminalWeights = {},
  flipWeight = 1,
  ltef = false,
) {
  return planner.planEdgeStateByWeakswapFloating(
    edgeStateInParityFrame(relativeState, parity),
    parity,
    buffers,
    capability,
    flipWeight,
    terminalWeights,
    ltef,
  );
}

function weakEdge(
  state,
  buffers,
  capability = 'none',
  terminalWeights = {},
  flipWeight = 1,
  ltef = false,
) {
  return weakEdgeAtParity(
    state,
    false,
    buffers,
    capability,
    terminalWeights,
    flipWeight,
    ltef,
  );
}

function cornerPlan(
  state,
  buffers,
  capability = 'none',
  cornerFloatingParity = false,
  terminalWeights = {},
  twistWeight = 1,
) {
  return planner.planCornerStateBySelectedBuffers(
    state,
    buffers,
    capability,
    twistWeight,
    cornerFloatingParity,
    terminalWeights,
  );
}

let ordinaryChecks = 0;
let residueChecks = 0;
let edgeTerminalChecks = 0;
let ltefChecks = 0;
let prefixedLtefChecks = 0;
let cornerTerminalChecks = 0;
let weakStartChecks = 0;
let weightChecks = 0;

// -------------------------------------------------------------------------
// Ordinary comm, sandwich, flip, and twist prices.
// -------------------------------------------------------------------------

for (const [label, state, buffers, expected] of [
  ['solved edges', solvedState('edge'), ['UF'], 0],
  ['one internal edge 3-cycle', cycleState('edge', ['UF', 'UB', 'UL']), ['UF'], 1],
  ['one external edge 3-cycle', cycleState('edge', ['UB', 'UL', 'FR']), ['UF'], 2],
  ['same cycle after learning UB', cycleState('edge', ['UB', 'UL', 'FR']), ['UF', 'UR', 'UB'], 1],
]) {
  closeTo(pseudoEdge(state, buffers).total_algs, expected, `${label}: ${activePlacements('edge', state)}`);
  ordinaryChecks += 1;
}

for (const weight of [1, 1.1, 1.25, 1.5, 2]) {
  const twoFlips = stateFromPlacements('edge', [
    ['UB', 'UB', 1],
    ['DL', 'DL', 1],
  ]);
  closeTo(
    pseudoEdge(twoFlips, ['UF'], 'none', {}, weight).total_algs,
    weight,
    `two floating flips at weight ${weight}`,
  );
  ordinaryChecks += 1;

  const oppositeTwists = stateFromPlacements('corner', [
    ['UBR', 'UBR', 1],
    ['DBL', 'DBL', 2],
  ]);
  closeTo(
    cornerPlan(oppositeTwists, ['UFR'], 'none', false, {}, weight).total_algs,
    weight,
    `two opposite floating twists at weight ${weight}`,
  );
  ordinaryChecks += 1;
}

for (const [label, state, buffers, expected] of [
  ['solved corners', solvedState('corner'), ['UFR'], 0],
  ['one internal corner 3-cycle', cycleState('corner', ['UFR', 'UBR', 'UBL']), ['UFR'], 1],
  ['one external corner 3-cycle', cycleState('corner', ['UBR', 'UBL', 'DFR']), ['UFR'], 2],
  ['same cycle after learning UBR', cycleState('corner', ['UBR', 'UBL', 'DFR']), ['UFR', 'UFL', 'UBR'], 1],
]) {
  closeTo(cornerPlan(state, buffers).total_algs, expected, `${label}: ${activePlacements('corner', state)}`);
  ordinaryChecks += 1;
}

const threePositiveTwists = stateFromPlacements('corner', [
  ['UFR', 'UFR', 1],
  ['UBR', 'UBR', 1],
  ['DBL', 'DBL', 1],
]);
closeTo(
  cornerPlan(threePositiveTwists, ['UFR']).total_algs,
  2,
  'three equal-direction twists cost two algorithms',
);
ordinaryChecks += 1;

// The complete human residue atom catalog, written explicitly here rather
// than read from production constants. `synthesizeResidueState` only turns
// these named physical residues into a legal sticker state; the prices below
// are the independent expectations.
const HUMAN_EDGE_CLOSED_ATOMS = [
  [['F', 'F'], 1],
  [['P', 'P'], 2],
  [['PF', 'PF'], 2],
  [['F', 'P', 'PF'], 3],
];
const HUMAN_CORNER_CLOSED_ATOMS = [
  [['T+', 'T-'], 1],
  [['P0', 'P0'], 2],
  [['P+', 'P-'], 2],
  [['T+', 'T+', 'T+'], 2],
  [['T-', 'T-', 'T-'], 2],
  [['T+', 'P+', 'P+'], 3],
  [['T-', 'P-', 'P-'], 3],
  [['T+', 'P0', 'P-'], 3],
  [['T-', 'P0', 'P+'], 3],
  [['P0', 'P+', 'P+', 'P+'], 5],
  [['P0', 'P-', 'P-', 'P-'], 5],
  [['T+', 'T+', 'P-', 'P-'], 4],
  [['T-', 'T-', 'P+', 'P+'], 4],
  [['T+', 'T+', 'P0', 'P+'], 4],
  [['T-', 'T-', 'P0', 'P-'], 4],
];
const HUMAN_CORNER_PARITY_TERMINALS = [
  [['P0'], 1],
  [['T+', 'P-'], 2],
  [['T-', 'P+'], 2],
  [['T+', 'T+', 'P+'], 3],
  [['T-', 'T-', 'P-'], 3],
  [['P+', 'P+', 'P+'], 4],
  [['P-', 'P-', 'P-'], 4],
];

for (const [residues, expected] of HUMAN_EDGE_CLOSED_ATOMS) {
  const state = synthesizeResidueState('edge', residues);
  closeTo(
    planner.planEdgeStateByResidues(
      state,
      false,
      planner.FULL_EDGE_BUFFERS,
      1,
    ).total_algs,
    expected,
    `closed edge residue ${residues.join(' ')}`,
  );
  residueChecks += 1;
}
for (const [residues, expected] of HUMAN_CORNER_CLOSED_ATOMS) {
  const state = synthesizeResidueState('corner', residues);
  closeTo(
    planner.planCornerStateByResidues(
      state,
      planner.FULL_CORNER_BUFFERS,
      'none',
      1,
    ).total_algs,
    expected,
    `closed corner residue ${residues.join(' ')}`,
  );
  residueChecks += 1;
}
for (const [residues, expected] of HUMAN_CORNER_PARITY_TERMINALS) {
  const state = synthesizeResidueState('corner', residues, 'in-P');
  closeTo(
    planner.planCornerStateByResidues(
      state,
      planner.FULL_CORNER_BUFFERS,
      'none',
      1,
    ).total_algs,
    expected,
    `corner parity residue ${residues.join(' ')}`,
  );
  residueChecks += 1;
}

// -------------------------------------------------------------------------
// Rooted edge terminals. Every physical external pair is checked against
// human learning-prefix eligibility for pseudo and weak counting.
// -------------------------------------------------------------------------

const EDGE_ROOTS = new Set(['UF', 'UR']);
const OTHER_EDGES = GROUPS.edge.map((group) => group[0]).filter((piece) => !EDGE_ROOTS.has(piece));
const EDGE_PREFIXES = [
  ['UF', 'UR', 'UB'],
  ['UF', 'UR', 'UB', 'UL', 'FR'],
  bufferSelection.EDGE_BUFFER_ORDER.slice(0, 9),
  [...bufferSelection.EDGE_BUFFER_ORDER],
  ['UF', 'UB'],
];
const CAPABILITY_RANK = { none: 0, '2e2e': 1, f2e: 2, ff2e: 3 };
const ROOT_FAMILIES = {
  '2e2e': {
    placements: swapPlacements('edge', 'UF', 'UR', 0, 0),
    externalCharge: 0,
  },
  f2e: {
    placements: swapPlacements('edge', 'UF', 'UR', 1, 1),
    externalCharge: 1,
  },
  ff2e: {
    placements: swapPlacements('edge', 'UF', 'UR', 1, 0),
    externalCharge: 1,
  },
};
const EDGE_TERMINAL_WEIGHT = 1.25;

function selectedPhysicalPieces(kind, buffers) {
  return new Set(buffers.map((buffer) => groupFor(kind, buffer)[0]));
}

function edgePairLearned(pair, buffers) {
  if (!buffers.includes('UR') || buffers.length < 3) return false;
  const selected = selectedPhysicalPieces('edge', buffers);
  selected.delete('UF');
  selected.delete('UR');
  if (pair.some((piece) => selected.has(piece))) return true;
  return buffers.length === bufferSelection.EDGE_BUFFER_ORDER.length
    && pair.includes('BR')
    && pair.includes('BL');
}

for (let left = 0; left < OTHER_EDGES.length; left += 1) {
  for (let right = left + 1; right < OTHER_EDGES.length; right += 1) {
    const pair = [OTHER_EDGES[left], OTHER_EDGES[right]];
    for (const [family, spec] of Object.entries(ROOT_FAMILIES)) {
      const state = stateFromPlacements('edge', [
        ...spec.placements,
        ...swapPlacements('edge', pair[0], pair[1], spec.externalCharge, 0),
      ]);
      for (const buffers of EDGE_PREFIXES) {
        for (const capability of ['none', '2e2e', 'f2e', 'ff2e']) {
          const learned = edgePairLearned(pair, buffers)
            && CAPABILITY_RANK[capability] >= CAPABILITY_RANK[family];
          const expected = learned ? EDGE_TERMINAL_WEIGHT : 2;
          const weights = { [family]: EDGE_TERMINAL_WEIGHT };
          const context = `${family} ${pair.join('-')} ${buffers.join('+')} cap=${capability}`;
          closeTo(
            pseudoEdge(state, buffers, capability, weights).total_algs,
            expected,
            `pseudo ${context}: ${activePlacements('edge', state)}`,
          );
          edgeTerminalChecks += 1;
          closeTo(
            pseudoEdgeAtParity(state, true, buffers, capability, weights).total_algs,
            expected,
            `pseudo odd-frame ${context}: ${activePlacements('edge', state)}`,
          );
          edgeTerminalChecks += 1;
          if (buffers.includes('UR')) {
            closeTo(
              weakEdge(state, buffers, capability, weights).total_algs,
              expected,
              `weak ${context}: ${activePlacements('edge', state)}`,
            );
            edgeTerminalChecks += 1;
            closeTo(
              weakEdgeAtParity(state, true, buffers, capability, weights).total_algs,
              expected,
              `weak odd-frame ${context}: ${activePlacements('edge', state)}`,
            );
            edgeTerminalChecks += 1;
          }
        }
      }
    }
  }
}

// A charge-zero but both-flipped UF/UR swap is not literal 2E2E and belongs
// to neither F2E nor FF2E. It remains two ordinary P algorithms.
const bothFlippedRoot = stateFromPlacements('edge', [
  ...swapPlacements('edge', 'UF', 'UR', 0, 1),
  ...swapPlacements('edge', 'UB', 'UL', 0, 0),
]);
for (const method of [pseudoEdge, weakEdge]) {
  closeTo(
    method(bothFlippedRoot, ['UF', 'UR', 'UB'], 'ff2e').total_algs,
    2,
    'both-flipped UF/UR root is not an advanced edge terminal',
  );
  edgeTerminalChecks += 1;
}

// Mixed P + PF is orientation-open. Adding one in-place flip closes the cube.
// It is not itself a rooted terminal and costs three ordinary algorithms;
// an advanced planner may still reach a legal terminal after a prefix comm.
const mixedOpenRoot = stateFromPlacements('edge', [
  ...swapPlacements('edge', 'UF', 'UR', 0, 0),
  ...swapPlacements('edge', 'UB', 'UL', 1, 0),
  ['DL', 'DL', 1],
]);
assert.equal(
  planner.directWeakFloatingTerminal(
    mixedOpenRoot,
    bufferSelection.EDGE_BUFFER_ORDER,
    'ff2e',
  ),
  null,
  'mixed P + PF plus one flip must not classify as a direct rooted terminal',
);
for (const method of [pseudoEdge, weakEdge]) {
  closeTo(
    method(mixedOpenRoot, bufferSelection.EDGE_BUFFER_ORDER, 'none').total_algs,
    3,
    'mixed P + PF plus one flip ordinary price',
  );
  edgeTerminalChecks += 1;
}

// -------------------------------------------------------------------------
// Dedicated weak UF/UR entry cases. These are deliberately small states with
// a visible human execution: the asserted savings are explained by the one
// prefix comm and the remaining terminal/suffix shape, not inferred from a
// generated frontier.
// -------------------------------------------------------------------------

const urAndDlFlipped = stateFromPlacements('edge', [
  ['UR', 'UR', 1],
  ['DL', 'DL', 1],
]);
closeTo(
  planner.planEdgeStateBySingletonWeakswap(urAndDlFlipped, false, 1).total_algs,
  1,
  'without an external permutation cycle, flipped UR survives for the 2-flip',
);
closeTo(
  weakEdge(urAndDlFlipped, ['UF', 'UR']).total_algs,
  1,
  'adding UR does not disturb the surviving two-flip',
);
weakStartChecks += 2;

// Singleton must force the flipped UR correction before the external 3-cycle:
// 3 permutation comms plus one remaining single flip. With UR floating, the
// root can survive for the ordinary 2-flip (2 sandwich comms + 1 two-flip).
// FF2E and a third learned buffer reduce it once more to prefix comm + terminal.
const forcedUrExternalCycle = stateFromPlacements('edge', [
  ['UR', 'UR', 1],
  ['DL', 'DL', 1],
  ...[
    ['UB', 'UL', 0],
    ['UL', 'FR', 0],
    ['FR', 'UB', 0],
  ],
]);
const forcedSingleton = planner.planEdgeStateBySingletonWeakswap(
  forcedUrExternalCycle,
  false,
  1,
);
closeTo(forcedSingleton.total_algs, 4, 'forced UR singleton total');
assert.equal(forcedSingleton.weakswap.forced_ur_break, true);
closeTo(
  weakEdge(forcedUrExternalCycle, ['UF', 'UR'], 'none').total_algs,
  3,
  'UR floating preserves the two-flip after the external cycle',
);
for (const capability of ['none', 'f2e']) {
  closeTo(
    weakEdge(forcedUrExternalCycle, ['UF', 'UR', 'UB'], capability).total_algs,
    3,
    `forced UR with ${capability} but without FF2E`,
  );
}
const forcedFf2e = weakEdge(
  forcedUrExternalCycle,
  ['UF', 'UR', 'UB'],
  'ff2e',
);
closeTo(forcedFf2e.total_algs, 2, 'FF2E open root saves the forced-UR case');
assert.equal(forcedFf2e.weak_entry_mode, 'open-ff2e-anchor');
weakStartChecks += 5;

// The first root appears oriented after two targets. One prefix comm leaves a
// rooted 3-cycle and an external 3-cycle. Before FL is learned the latter is a
// two-comm sandwich; from FL onward both suffix cycles cost one comm each.
const firstRootEvenOriented = stateFromPlacements('edge', [
  ['UF', 'UB', 0],
  ['UB', 'UL', 0],
  ['UL', 'UR', 0],
  ['UR', 'FR', 0],
  ['FR', 'UF', 0],
  ['FL', 'DF', 0],
  ['DF', 'DR', 0],
  ['DR', 'FL', 0],
]);
closeTo(
  planner.planEdgeStateBySingletonWeakswap(firstRootEvenOriented, false, 1).total_algs,
  4,
  'first-root-even singleton price',
);
for (let count = 2; count <= bufferSelection.EDGE_BUFFER_ORDER.length; count += 1) {
  const buffers = bufferSelection.EDGE_BUFFER_ORDER.slice(0, count);
  const plan = weakEdge(firstRootEvenOriented, buffers, 'none');
  closeTo(
    plan.total_algs,
    count >= 6 ? 3 : 4,
    `first-root-even-oriented through buffer count ${count}`,
  );
  assert.equal(plan.weak_entry_mode, 'first-root-even-oriented');
  assert.equal(plan.weak_entry_prefix_fixed_algs, 1);
  weakStartChecks += 1;
}
weakStartChecks += 1;

// UF is solved, while UR-UB and FL-DF are oriented swaps. One weak prefix
// comm reaches literal 2E2E. It only saves after FL makes the external pair a
// learned terminal pair.
const cleanEven2e2e = stateFromPlacements('edge', [
  ...swapPlacements('edge', 'UR', 'UB', 0, 0),
  ...swapPlacements('edge', 'FL', 'DF', 0, 0),
]);
for (const count of [5, 6]) {
  const buffers = bufferSelection.EDGE_BUFFER_ORDER.slice(0, count);
  closeTo(
    weakEdge(cleanEven2e2e, buffers, 'none').total_algs,
    3,
    `clean-even ordinary prefix ${count}`,
  );
  const plan = weakEdge(cleanEven2e2e, buffers, '2e2e');
  closeTo(plan.total_algs, count === 6 ? 2 : 3, `clean-even 2E2E prefix ${count}`);
  assert.equal(plan.weak_entry_mode, 'clean-even');
  if (count === 6) assert.equal(plan.finish?.type, '2e2e');
  weakStartChecks += 2;
}

// The analogous flipped UR-UB swap reaches F2E after one weak prefix comm.
// Knowledge below F2E cannot close the misoriented root.
const openF2e = stateFromPlacements('edge', [
  ...swapPlacements('edge', 'UR', 'UB', 1, 0),
  ...swapPlacements('edge', 'FL', 'DF', 1, 0),
]);
for (const capability of ['none', '2e2e', 'f2e', 'ff2e']) {
  const plan = weakEdge(
    openF2e,
    bufferSelection.EDGE_BUFFER_ORDER.slice(0, 6),
    capability,
  );
  const expected = CAPABILITY_RANK[capability] >= CAPABILITY_RANK.f2e ? 2 : 3;
  closeTo(plan.total_algs, expected, `open F2E anchor with ${capability}`);
  if (expected === 2) {
    assert.equal(plan.weak_entry_mode, 'open-f2e-anchor');
    assert.equal(plan.finish?.type, 'f2e');
  }
  weakStartChecks += 1;
}

// A flipped UF piece already occupies UR. Hitting oriented UR after two
// targets may shoot to any selected buffer only with FF2E. FL is deliberately
// the sixth buffer, so the same state is 3 before FL and 2 after learning it.
const openFf2e = stateFromPlacements('edge', [
  ['UF', 'UB', 0],
  ['UR', 'UF', 1],
  ['UB', 'UL', 0],
  ['UL', 'UR', 0],
  ...swapPlacements('edge', 'FL', 'DF', 1, 0),
]);
for (const count of [5, 6]) {
  const buffers = bufferSelection.EDGE_BUFFER_ORDER.slice(0, count);
  closeTo(
    weakEdge(openFf2e, buffers, 'f2e').total_algs,
    3,
    `F2E does not imply FF2E through prefix ${count}`,
  );
  const plan = weakEdge(openFf2e, buffers, 'ff2e');
  closeTo(plan.total_algs, count === 6 ? 2 : 3, `open FF2E anchor through prefix ${count}`);
  assert.equal(plan.weak_entry_mode, 'open-ff2e-anchor');
  if (count === 6) assert.equal(plan.finish?.type, 'ff2e');
  weakStartChecks += 2;
}

const ODD_FRAME_WEAK_START_CASES = [
  [urAndDlFlipped, ['UF', 'UR'], 'none', 1, 'surviving UR flip'],
  [forcedUrExternalCycle, ['UF', 'UR'], 'none', 3, 'forced UR ordinary float'],
  [forcedUrExternalCycle, ['UF', 'UR', 'UB'], 'ff2e', 2, 'forced UR FF2E'],
  [firstRootEvenOriented, bufferSelection.EDGE_BUFFER_ORDER.slice(0, 5), 'none', 4, 'first root before FL'],
  [firstRootEvenOriented, bufferSelection.EDGE_BUFFER_ORDER.slice(0, 6), 'none', 3, 'first root after FL'],
  [cleanEven2e2e, bufferSelection.EDGE_BUFFER_ORDER.slice(0, 6), '2e2e', 2, 'clean even 2E2E'],
  [openF2e, bufferSelection.EDGE_BUFFER_ORDER.slice(0, 6), 'f2e', 2, 'open F2E'],
  [openFf2e, bufferSelection.EDGE_BUFFER_ORDER.slice(0, 6), 'f2e', 3, 'FF2E unavailable'],
  [openFf2e, bufferSelection.EDGE_BUFFER_ORDER.slice(0, 6), 'ff2e', 2, 'open FF2E'],
];
for (const [state, buffers, capability, expected, label] of ODD_FRAME_WEAK_START_CASES) {
  closeTo(
    weakEdgeAtParity(state, true, buffers, capability).total_algs,
    expected,
    `odd physical parity frame: ${label}`,
  );
  weakStartChecks += 1;
}
closeTo(
  planner.planEdgeStateBySingletonWeakswap(
    edgeStateInParityFrame(forcedUrExternalCycle, true),
    true,
    1,
  ).total_algs,
  4,
  'odd physical parity frame: singleton forced UR',
);
weakStartChecks += 1;

// -------------------------------------------------------------------------
// LTEF: UR <- UF is fixed, the UF/UR/X 3-cycle has odd edge charge, and one
// separate edge is flipped. X and F are unrestricted by buffer knowledge.
// -------------------------------------------------------------------------

const LTEF_PREFIXES = [
  ['UF'],
  ['UF', 'UR'],
  ['UF', 'UR', 'UB', 'UL', 'FR'],
  [...bufferSelection.EDGE_BUFFER_ORDER],
];
const LTEF_WEIGHT = 1.25;

for (const target of OTHER_EDGES) {
  for (const flip of OTHER_EDGES) {
    if (flip === target) continue;
    for (const targetCharge of [0, 1]) {
      const state = stateFromPlacements('edge', [
        ['UF', target, 1 - targetCharge],
        [target, 'UR', targetCharge],
        ['UR', 'UF', 0],
        [flip, flip, 1],
      ]);
      assert.equal(planner.isLtefTerminalState(state), true, `LTEF shape ${target}/${flip}`);
      for (const buffers of LTEF_PREFIXES) {
        closeTo(
          weakEdge(state, buffers, 'none', { ltef: LTEF_WEIGHT }, 1, false).total_algs,
          2,
          `LTEF ordinary price ${target}/${flip} ${buffers.join('+')}`,
        );
        const withLtef = weakEdge(
          state,
          buffers,
          'none',
          { ltef: LTEF_WEIGHT },
          1,
          true,
        );
        closeTo(
          withLtef.total_algs,
          LTEF_WEIGHT,
          `LTEF learned price ${target}/${flip} ${buffers.join('+')}`,
        );
        assert.equal(withLtef.finish?.type, 'ltef');
        ltefChecks += 2;
        closeTo(
          weakEdgeAtParity(
            state,
            true,
            buffers,
            'none',
            { ltef: LTEF_WEIGHT },
            1,
            false,
          ).total_algs,
          2,
          `odd-frame LTEF ordinary price ${target}/${flip} ${buffers.join('+')}`,
        );
        const oddWithLtef = weakEdgeAtParity(
          state,
          true,
          buffers,
          'none',
          { ltef: LTEF_WEIGHT },
          1,
          true,
        );
        closeTo(
          oddWithLtef.total_algs,
          LTEF_WEIGHT,
          `odd-frame LTEF learned price ${target}/${flip} ${buffers.join('+')}`,
        );
        assert.equal(oddWithLtef.finish?.type, 'ltef');
        ltefChecks += 2;
      }
    }
  }
}

// LTEF is terminal, not necessarily direct: it may remain after earlier weak
// comms. Enumerate every labelled external charge-one 3-cycle through UR,
// plus a separate flip. Closing the already-solved UF root and floating from
// UR takes one comm, after which LTEF solves the residue. This family is also
// checked in both physical parity frames.
let prefixedLtefStateCount = 0;
let singletonPrefixedLtefMisses = 0;
let firstSingletonPrefixedLtefMiss = null;
for (const first of OTHER_EDGES) {
  for (const second of OTHER_EDGES) {
    if (second === first) continue;
    for (const firstCharge of [0, 1]) {
      for (const secondCharge of [0, 1]) {
        const urCharge = 1 ^ firstCharge ^ secondCharge;
        for (const flip of OTHER_EDGES) {
          if (flip === first || flip === second) continue;
          const relativeState = stateFromPlacements('edge', [
            ['UR', first, firstCharge],
            [first, second, secondCharge],
            [second, 'UR', urCharge],
            [flip, flip, 1],
          ]);
          assert.equal(
            planner.isLtefTerminalState(relativeState),
            false,
            'prefixed LTEF family must not already be a direct LTEF state',
          );

          // Direct human route, independent of either counting planner:
          // UF is solved and UR is empty, so weak tracing first shoots UR.
          // The resulting buffer sticker is the forced second target. Those
          // two targets are one comm and leave the literal LTEF state.
          const relativeModel = cycleModel.decomposeEdgeState(relativeState);
          const afterUrTarget = cycleModel.switchWithBufferInModel(
            relativeState,
            relativeModel,
            'UF',
            'UR',
          );
          const afterPrefixComm = cycleModel.switchWithBufferInModel(
            afterUrTarget,
            relativeModel,
            'UF',
            afterUrTarget.UF,
          );
          assert.equal(
            planner.isLtefTerminalState(afterPrefixComm),
            true,
            'one forced weak comm must leave the LTEF terminal',
          );

          for (const parity of [false, true]) {
            const physicalState = edgeStateInParityFrame(relativeState, parity);
            const ordinarySingleton = planner.planEdgeStateBySingletonWeakswap(
              physicalState,
              parity,
              1,
              { ltef: LTEF_WEIGHT },
              false,
            );
            closeTo(
              ordinarySingleton.total_algs,
              3,
              `prefixed LTEF ordinary singleton, parity=${parity}: ${activePlacements('edge', relativeState)}`,
            );

            // The shared weak-entry automaton is a second production-path
            // cross-check of the direct two-target derivation above.
            const exactEntryPlan = weakEdgeAtParity(
              relativeState,
              parity,
              ['UF'],
              'none',
              { ltef: LTEF_WEIGHT },
              1,
              true,
            );
            closeTo(
              exactEntryPlan.total_algs,
              1 + LTEF_WEIGHT,
              `prefixed LTEF weak-entry price, parity=${parity}: ${activePlacements('edge', relativeState)}`,
            );
            assert.equal(exactEntryPlan.weak_entry_mode, 'ltef');
            assert.equal(exactEntryPlan.weak_entry_prefix_fixed_algs, 1);
            assert.equal(exactEntryPlan.finish?.type, 'ltef');

            const singletonWithLtef = planner.planEdgeStateBySingletonWeakswap(
              physicalState,
              parity,
              1,
              { ltef: LTEF_WEIGHT },
              true,
            );
            prefixedLtefStateCount += 1;
            prefixedLtefChecks += 3;
            if (Math.abs(singletonWithLtef.total_algs - (1 + LTEF_WEIGHT)) >= 1e-12) {
              singletonPrefixedLtefMisses += 1;
              if (!firstSingletonPrefixedLtefMiss) {
                firstSingletonPrefixedLtefMiss = {
                  parity,
                  state: activePlacements('edge', relativeState),
                  actual: singletonWithLtef.total_algs,
                };
              }
            }
          }
        }
      }
    }
  }
}
if (singletonPrefixedLtefMisses) {
  auditMismatches.push({
    message: [
      `singleton weak misses prefix+LTEF in ${singletonPrefixedLtefMisses}/${prefixedLtefStateCount} labelled states`,
      `first: parity=${firstSingletonPrefixedLtefMiss.parity}`,
      firstSingletonPrefixedLtefMiss.state,
    ].join('; '),
    expected: 1 + LTEF_WEIGHT,
    actual: firstSingletonPrefixedLtefMiss.actual,
  });
}

// -------------------------------------------------------------------------
// Corner terminals: classic parity, corner-floating parity, LTCT, and T2C.
// -------------------------------------------------------------------------

const OTHER_CORNERS = GROUPS.corner
  .map((group) => group[0])
  .filter((piece) => piece !== 'UFR');
const CORNER_PREFIXES = [
  ['UFR'],
  ['UFR', 'UFL', 'UBR'],
  [...bufferSelection.CORNER_BUFFER_ORDER],
];

for (const partner of OTHER_CORNERS) {
  for (let leftCharge = 0; leftCharge < 3; leftCharge += 1) {
    const state = stateFromPlacements('corner', [
      ...swapPlacements('corner', 'UFR', partner, 0, leftCharge),
    ]);
    for (const buffers of CORNER_PREFIXES) {
      const plan = cornerPlan(
        state,
        buffers,
        'none',
        false,
        { parity: 1.25 },
      );
      closeTo(plan.total_algs, 1.25, `classic parity UFR-${partner} charge ${leftCharge}`);
      assert.equal(plan.finish?.type, 'parity');
      cornerTerminalChecks += 1;
    }
  }
}

function cornerPairLearned(pair, buffers) {
  const selected = selectedPhysicalPieces('corner', buffers);
  if (pair.some((piece) => selected.has(piece))) return true;
  return buffers.length === bufferSelection.CORNER_BUFFER_ORDER.length
    && pair.includes('DBR')
    && pair.includes('DBL');
}

for (let left = 0; left < OTHER_CORNERS.length; left += 1) {
  for (let right = left + 1; right < OTHER_CORNERS.length; right += 1) {
    const pair = [OTHER_CORNERS[left], OTHER_CORNERS[right]];
    for (let leftCharge = 0; leftCharge < 3; leftCharge += 1) {
      const state = stateFromPlacements('corner', [
        ...swapPlacements('corner', pair[0], pair[1], 0, leftCharge),
      ]);
      for (const buffers of CORNER_PREFIXES) {
        const learned = cornerPairLearned(pair, buffers);
        const expected = learned ? 1.25 : 2;
        const plan = cornerPlan(
          state,
          buffers,
          'none',
          true,
          { parity: 1, 'corner-floating-parity': 1.25 },
        );
        closeTo(
          plan.total_algs,
          expected,
          `corner-floating parity ${pair.join('-')} ${buffers.join('+')} charge ${leftCharge}`,
        );
        if (learned) assert.equal(plan.finish?.type, 'corner-floating-parity');
        cornerTerminalChecks += 1;
      }
    }
  }
}

for (const partner of OTHER_CORNERS) {
  for (const twist of OTHER_CORNERS) {
    if (twist === partner) continue;
    for (const twistCharge of [1, 2]) {
      const permutationCharge = 3 - twistCharge;
      for (let leftCharge = 0; leftCharge < 3; leftCharge += 1) {
        const state = stateFromPlacements('corner', [
          ...swapPlacements('corner', 'UFR', partner, permutationCharge, leftCharge),
          [twist, twist, twistCharge],
        ]);
        for (const buffers of CORNER_PREFIXES) {
          const ltct = cornerPlan(
            state,
            buffers,
            'ltct',
            false,
            { parity: 1, ltct: 1.25 },
          );
          closeTo(ltct.total_algs, 1.25, `LTCT UFR-${partner} + ${twist}`);
          assert.equal(ltct.finish?.type, 'ltct');
          cornerTerminalChecks += 1;
        }
      }
    }
  }
}

for (let left = 0; left < OTHER_CORNERS.length; left += 1) {
  for (let right = left + 1; right < OTHER_CORNERS.length; right += 1) {
    const pair = [OTHER_CORNERS[left], OTHER_CORNERS[right]];
    for (const twistCharge of [1, 2]) {
      const permutationCharge = 3 - twistCharge;
      for (let leftCharge = 0; leftCharge < 3; leftCharge += 1) {
        const state = stateFromPlacements('corner', [
          ...swapPlacements('corner', pair[0], pair[1], permutationCharge, leftCharge),
          ['UFR', 'UFR', twistCharge],
        ]);
        for (const buffers of CORNER_PREFIXES) {
          closeTo(
            cornerPlan(
              state,
              buffers,
              'ltct',
              false,
              { parity: 1, ltct: 1.25 },
            ).total_algs,
            2,
            `LTCT must not include T2C ${pair.join('-')}`,
          );
          const t2c = cornerPlan(
            state,
            buffers,
            't2c',
            false,
            { parity: 1, ltct: 1.25, t2c: 1.25 },
          );
          closeTo(t2c.total_algs, 1.25, `T2C ${pair.join('-')} + UFR twist`);
          assert.equal(t2c.finish?.type, 't2c');
          cornerTerminalChecks += 2;
        }
      }
    }
  }
}

// UFR-uninvolved P±/T∓ states are not direct LTCT or T2C. The ordinary
// physical route costs three because parity must still end on UFR-X. Knowing
// LTCT (and therefore also knowing T2C) permits one UFR link followed by the
// 1.25 terminal, for 2.25 total. Enumerate every physical role assignment.
for (let left = 0; left < OTHER_CORNERS.length; left += 1) {
  for (let right = left + 1; right < OTHER_CORNERS.length; right += 1) {
    const pair = [OTHER_CORNERS[left], OTHER_CORNERS[right]];
    for (const twist of OTHER_CORNERS) {
      if (pair.includes(twist)) continue;
      for (const twistCharge of [1, 2]) {
        const permutationCharge = 3 - twistCharge;
        for (let leftCharge = 0; leftCharge < 3; leftCharge += 1) {
          const state = stateFromPlacements('corner', [
            ...swapPlacements(
              'corner',
              pair[0],
              pair[1],
              permutationCharge,
              leftCharge,
            ),
            [twist, twist, twistCharge],
          ]);
          for (const buffers of CORNER_PREFIXES) {
            closeTo(
              cornerPlan(
                state,
                buffers,
                'none',
                false,
                { parity: 1 },
              ).total_algs,
              3,
              `uninvolved UFR ordinary ${pair.join('-')} + ${twist}`,
            );
            for (const capability of ['ltct', 't2c']) {
              closeTo(
                cornerPlan(
                  state,
                  buffers,
                  capability,
                  false,
                  { parity: 1, ltct: 1.25, t2c: 1.25 },
                ).total_algs,
                2.25,
                `uninvolved UFR linked ${capability} ${pair.join('-')} + ${twist}`,
              );
            }
            cornerTerminalChecks += 3;
          }
        }
      }
    }
  }
}

// -------------------------------------------------------------------------
// Runtime-weight audit. Each representative is a literal one-alg terminal,
// so its expected price is exactly its own configured weight throughout the
// supported [1, 2] interval. Other terminal weights must not leak across
// sticker families.
// -------------------------------------------------------------------------

const TERMINAL_WEIGHT_SAMPLES = [1, 1.1, 1.25, 1.5, 2];
const representativeEdgeTerminals = Object.fromEntries(
  Object.entries(ROOT_FAMILIES).map(([family, spec]) => [
    family,
    stateFromPlacements('edge', [
      ...spec.placements,
      ...swapPlacements('edge', 'UB', 'UL', spec.externalCharge, 0),
    ]),
  ]),
);
const representativeLtef = stateFromPlacements('edge', [
  ['UF', 'UB', 1],
  ['UB', 'UR', 0],
  ['UR', 'UF', 0],
  ['UL', 'UL', 1],
]);
const representativeClassicParity = stateFromPlacements('corner', [
  ...swapPlacements('corner', 'UFR', 'UBR', 0, 0),
]);
const representativeCornerFloatingParity = stateFromPlacements('corner', [
  ...swapPlacements('corner', 'UBR', 'UBL', 0, 0),
]);
const representativeLtct = stateFromPlacements('corner', [
  ...swapPlacements('corner', 'UFR', 'UBR', 2, 0),
  ['UBL', 'UBL', 1],
]);
const representativeT2c = stateFromPlacements('corner', [
  ...swapPlacements('corner', 'UBR', 'UBL', 2, 0),
  ['UFR', 'UFR', 1],
]);

for (const weight of TERMINAL_WEIGHT_SAMPLES) {
  for (const [family, state] of Object.entries(representativeEdgeTerminals)) {
    const buffers = ['UF', 'UR', 'UB'];
    const weights = { [family]: weight };
    for (const parity of [false, true]) {
      closeTo(
        pseudoEdgeAtParity(state, parity, buffers, family, weights).total_algs,
        weight,
        `${family} pseudo terminal weight ${weight}, parity=${parity}`,
      );
      closeTo(
        weakEdgeAtParity(state, parity, buffers, family, weights).total_algs,
        weight,
        `${family} weak terminal weight ${weight}, parity=${parity}`,
      );
      weightChecks += 2;
    }
  }

  for (const parity of [false, true]) {
    closeTo(
      weakEdgeAtParity(
        representativeLtef,
        parity,
        ['UF'],
        'none',
        { ltef: weight },
        1,
        true,
      ).total_algs,
      weight,
      `LTEF terminal weight ${weight}, parity=${parity}`,
    );
    weightChecks += 1;
  }

  closeTo(
    cornerPlan(
      representativeClassicParity,
      ['UFR'],
      'none',
      false,
      { parity: weight },
    ).total_algs,
    weight,
    `classic parity terminal weight ${weight}`,
  );
  closeTo(
    cornerPlan(
      representativeCornerFloatingParity,
      ['UFR', 'UFL', 'UBR'],
      'none',
      true,
      { parity: 2, 'corner-floating-parity': weight },
    ).total_algs,
    weight,
    `corner-floating parity terminal weight ${weight}`,
  );
  closeTo(
    cornerPlan(
      representativeLtct,
      ['UFR'],
      'ltct',
      false,
      { parity: 2, ltct: weight },
    ).total_algs,
    weight,
    `LTCT terminal weight ${weight}`,
  );
  closeTo(
    cornerPlan(
      representativeT2c,
      ['UFR'],
      't2c',
      false,
      { parity: 2, ltct: 2, t2c: weight },
    ).total_algs,
    weight,
    `T2C terminal weight ${weight}`,
  );
  weightChecks += 4;
}

closeTo(
  cornerPlan(
    representativeClassicParity,
    ['UFR'],
    'none',
    true,
    { parity: 1.75, 'corner-floating-parity': 1.1 },
  ).total_algs,
  1.1,
  'corner terminal families choose the cheaper independent weight',
);
closeTo(
  cornerPlan(
    representativeClassicParity,
    ['UFR'],
    'none',
    true,
    { parity: 1.1, 'corner-floating-parity': 1.75 },
  ).total_algs,
  1.1,
  'classic parity stays cheaper when its independent weight is lower',
);
weightChecks += 2;

const uninvolvedCornerTerminalShape = stateFromPlacements('corner', [
  ...swapPlacements('corner', 'UBR', 'UBL', 2, 0),
  ['DFR', 'DFR', 1],
]);
closeTo(
  cornerPlan(
    uninvolvedCornerTerminalShape,
    bufferSelection.CORNER_BUFFER_ORDER,
    'none',
    false,
    { parity: 1 },
  ).total_algs,
  3,
  'uninvolved P/T needs a link before the physical UFR parity finish',
);
closeTo(
  cornerPlan(
    uninvolvedCornerTerminalShape,
    bufferSelection.CORNER_BUFFER_ORDER,
    't2c',
    false,
    { parity: 1, ltct: 1.25, t2c: 1.25 },
  ).total_algs,
  2.25,
  'one link plus LTCT is cheaper than the ordinary uninvolved UFR finish',
);
closeTo(
  cornerPlan(
    representativeLtct,
    ['UFR'],
    't2c',
    false,
    { parity: 2, ltct: 1.25, t2c: 1 },
  ).total_algs,
  1.25,
  'T2C knowledge includes LTCT but must still use the matching LTCT weight',
);
cornerTerminalChecks += 3;

console.log(`PASS ${ordinaryChecks} direct ordinary/sandwich/orientation expectations`);
console.log(`PASS ${residueChecks} explicit human residue expectations`);
console.log(`PASS ${edgeTerminalChecks} direct rooted edge-terminal expectations`);
console.log(`PASS ${weakStartChecks} direct weak-entry expectations`);
console.log(`PASS ${ltefChecks} direct LTEF expectations`);
console.log(`AUDITED ${prefixedLtefChecks} prefixed-LTEF expectations`);
console.log(`PASS ${cornerTerminalChecks} direct corner-terminal expectations`);
console.log(`PASS ${weightChecks} independent terminal-weight expectations`);
if (auditMismatches.length) {
  console.error(`AUDIT FOUND ${auditMismatches.length} EXPECTATION MISMATCH(ES)`);
  for (const mismatch of auditMismatches) {
    console.error(`- ${mismatch.message}: expected ${mismatch.expected}, got ${mismatch.actual}`);
  }
  process.exitCode = 1;
}
