const assert = require('node:assert/strict');
const bigCube = require('../web/big-cube-model');
const bigTracing = require('../web/big-cube-tracing');
const fiveByFive = require('../web/five-by-five');
const scrambling = require('../web/scrambling');

const SOLVED_COLOR_MULTISET = 'BBBBDDDDFFFFLLLLRRRRUUUU';

function assertFiveByFiveInvariant(state) {
  assert.equal(state.size, 5);
  assert.equal(new Set(Object.values(state.corners)).size, 24);
  assert.equal(new Set(Object.values(state.midges)).size, 24);
  assert.equal(new Set(Object.values(state.wings)).size, 24);
  assert.equal(Object.values(state.xcenters).sort().join(''), SOLVED_COLOR_MULTISET);
  assert.equal(Object.values(state.pluscenters).sort().join(''), SOLVED_COLOR_MULTISET);
}

function solvedColorState(locations) {
  return Object.fromEntries(locations.map((location) => [location, location[0]]));
}

const solved = bigCube.buildBigCubeState('', 5);
assertFiveByFiveInvariant(solved);
assert.equal(Object.keys(solved.midges).length, 24);
for (const [location, sticker] of Object.entries(solved.midges)) assert.equal(sticker, location);

for (const move of ['U', 'D', 'R', 'L', 'F', 'B']) {
  for (const token of [move, `${move}'`, `${move}2`, `${move}w`]) {
    const state = bigCube.buildBigCubeState(token, 5);
    assertFiveByFiveInvariant(state);
    assert.deepEqual(
      state.midges,
      scrambling.scrToScrambledStateEdg(token.endsWith('w') ? move : token, ''),
      `${token} must preserve the established 3x3 midge convention`,
    );
  }
}

const solvedPluscenters = solvedColorState(bigCube.PLUSCENTER_LOCATIONS);
assert.deepEqual(bigTracing.tracePluscenterState(solvedPluscenters), {
  buffer: 'Ub',
  helper: 'Ur',
  targets: [],
  target_count: 0,
  execution_targets: [],
  algs: 0,
  decisions: [],
});

const pluscenterExample = { ...solvedPluscenters };
Object.assign(pluscenterExample, {
  Ub: 'R',
  Rb: 'R',
  Rd: 'D',
  Rf: 'L',
  Df: 'U',
  Lu: 'R',
});
assert.deepEqual(
  bigTracing.choosePluscenterTarget(pluscenterExample),
  { target: 'Rd', reason: 'matching-non-U' },
);

const solvedAnalysis = fiveByFive.analyzeFiveByFive('');
assert.equal(solvedAnalysis.total_algs, 0);
assert.equal(solvedAnalysis.corner_algs, 0);
assert.equal(solvedAnalysis.midge_algs, 0);
assert.equal(solvedAnalysis.wing_algs, 0);
assert.equal(solvedAnalysis.xcenter_algs, 0);
assert.equal(solvedAnalysis.pluscenter_algs, 0);
assert.equal(solvedAnalysis.xcenters.buffer, 'Ubl');
assert.equal(solvedAnalysis.pluscenters.buffer, 'Ub');

const outerTurnAnalysis = fiveByFive.analyzeFiveByFive('R', {
  orientedCornerSticker: 'UFR',
  cornerBuffers: ['UFR'],
  midgeBuffers: ['UF'],
  wingParityCapability: 'basic',
});
assert.equal(outerTurnAnalysis.corner_parity, true);
assert.deepEqual(
  [
    outerTurnAnalysis.wings.goal.UFr,
    outerTurnAnalysis.wings.goal.URb,
    outerTurnAnalysis.wings.goal.FUl,
    outerTurnAnalysis.wings.goal.RUf,
  ],
  ['URb', 'UFr', 'RUf', 'FUl'],
);
assert.equal(
  outerTurnAnalysis.total_algs,
  outerTurnAnalysis.corner_algs
    + outerTurnAnalysis.midge_algs
    + outerTurnAnalysis.wing_algs
    + outerTurnAnalysis.xcenter_algs
    + outerTurnAnalysis.pluscenter_algs,
);

const fullOptions = fiveByFive.normalizeFiveByFiveOptions({
  cornerBuffers: ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL'],
  midgeBuffers: ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'],
  midgeFinishCapability: 'ff2e',
  wingParityCapability: 'full',
});
assert.equal(
  fullOptions.midge_finish_capability,
  'none',
  '5x5 midges must not expose edge parity terminal algsets',
);
assert.equal(fullOptions.wing_parity_capability, 'full');
assert.equal(
  fiveByFive.normalizeFiveByFiveOptions({
    midgeBuffers: ['UF', 'UB'],
    midgeFinishCapability: 'ff2e',
  }).midge_finish_capability,
  'none',
  '5x5 midge terminal algsets stay disabled for every buffer selection',
);

const setAnalysis = fiveByFive.analyzeFiveByFiveSet(
  "1. 3Rw U2 Fw' m\n2. DNF(42.00) Rw U' e2 @ 2026-08-20 12:00:00",
  { dnf: true, orientedCornerSticker: 'BDR' },
);
assert.equal(setAnalysis.number_of_solves, 2);
assert.equal(setAnalysis.breakdowns[0].scramble, "3Rw U2 Fw' m");
assert.equal(setAnalysis.breakdowns[1].scramble, "Rw U' e2");
assert.equal(setAnalysis.breakdowns[1].dnf, true);
assert.equal(
  setAnalysis.total_algs,
  setAnalysis.total_corner_algs
    + setAnalysis.total_midge_algs
    + setAnalysis.total_wing_algs
    + setAnalysis.total_xcenter_algs
    + setAnalysis.total_pluscenter_algs,
);

let randomSeed = 0x5b5b5b5b;
function random() {
  randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
  return randomSeed / 2 ** 32;
}
const randomBases = [
  'U', 'D', 'R', 'L', 'F', 'B',
  'Uw', 'Dw', 'Rw', 'Lw', 'Fw', 'Bw',
  '3Uw', '3Dw', '3Rw', '3Lw', '3Fw', '3Bw',
];
const randomSuffixes = ['', "'", '2'];
for (let sample = 0; sample < 250; sample += 1) {
  const scramble = Array.from({ length: 60 }, () => (
    randomBases[Math.floor(random() * randomBases.length)]
      + randomSuffixes[Math.floor(random() * randomSuffixes.length)]
  )).join(' ');
  const orientation = bigCube.CORNER_STICKERS[
    Math.floor(random() * bigCube.CORNER_STICKERS.length)
  ];
  const state = bigCube.buildBigCubeState(scramble, 5, orientation);
  assertFiveByFiveInvariant(state);
  const wings = bigTracing.traceWingState(state.wings, sample % 2);
  const xcenters = bigTracing.traceXcenterState(state.xcenters);
  const pluscenters = bigTracing.tracePluscenterState(state.pluscenters);
  assert.ok(wings.target_count <= 48);
  assert.ok(xcenters.target_count <= 48);
  assert.ok(pluscenters.target_count <= 48);
  assert.equal(xcenters.execution_targets.length % 2, 0);
  assert.equal(pluscenters.execution_targets.length % 2, 0);
}

for (const scramble of [
  "3Rw U2 Fw' Lw D B2 3Uw' R",
  "m U r' e2 Fw s' D2",
  "x 3Rw U y' Fw2 z 3Dw'",
]) {
  const result = fiveByFive.analyzeFiveByFive(scramble, {
    orientedCornerSticker: 'BDR',
    cornerBuffers: ['UFR', 'UFL'],
    midgeBuffers: ['UF', 'UR'],
    wingParityCapability: 'full',
  });
  assert.equal(
    result.total_algs,
    result.corner_algs
      + result.midge_algs
      + result.wing_algs
      + result.xcenter_algs
      + result.pluscenter_algs,
  );
}

assert.throws(
  () => fiveByFive.analyzeFiveByFiveSet('this is not a scramble'),
  /No valid 5x5 scrambles found/,
);

console.log('PASS JS 5x5 midge, wing, xcenter, +center, and aggregate MVP counting');
