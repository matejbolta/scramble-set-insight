const assert = require('node:assert/strict');
const bigCube = require('../web/big-cube-model');
const fourByFour = require('../web/four-by-four');
const scrambling = require('../web/scrambling');

const SOLVED_COLOR_MULTISET = 'BBBBDDDDFFFFLLLLRRRRUUUU';

function assertStateInvariant(state) {
  assert.equal(new Set(Object.values(state.corners)).size, 24);
  assert.equal(new Set(Object.values(state.wings)).size, 24);
  assert.equal(Object.values(state.xcenters).sort().join(''), SOLVED_COLOR_MULTISET);
  if (state.size === 5) {
    assert.equal(Object.values(state.pluscenters).sort().join(''), SOLVED_COLOR_MULTISET);
  }
}

function assertSolved(state) {
  for (const [location, value] of Object.entries(state.corners)) assert.equal(value, location);
  for (const [location, value] of Object.entries(state.wings)) assert.equal(value, location);
  for (const [location, value] of Object.entries(state.xcenters)) assert.equal(value, location[0]);
  if (state.pluscenters) {
    for (const [location, value] of Object.entries(state.pluscenters)) assert.equal(value, location[0]);
  }
}

assert.equal(bigCube.WING_LOCATIONS.length, 24);
assert.equal(bigCube.XCENTER_LOCATIONS.length, 24);
assert.equal(bigCube.PLUSCENTER_LOCATIONS.length, 24);
assert.equal(new Set(bigCube.CORNER_STICKERS).size, 24);
assert.equal(new Set(bigCube.CORNER_STICKERS.map((sticker) => (
  bigCube.orientationForCornerSticker(sticker).join(' ')
))).size, 24);

assertSolved(bigCube.buildBigCubeState('', 4));
assertSolved(bigCube.buildBigCubeState('', 5));

const outerMoves = ['U', 'D', 'R', 'L', 'F', 'B'];
for (const move of outerMoves) {
  for (const suffix of ['', "'", '2', "2'"]) {
    const token = `${move}${suffix}`;
    const state = bigCube.buildBigCubeState(token, 4);
    assertStateInvariant(state);
    assert.deepEqual(
      state.corners,
      scrambling.scrToScrambledStateCor(token.replace("2'", '2'), ''),
      `4x4 outer ${token} must preserve the established corner convention`,
    );
  }
  assertSolved(bigCube.buildBigCubeState(`${move} ${move} ${move} ${move}`, 4));
  assertSolved(bigCube.buildBigCubeState(`${move}w ${move}w ${move}w ${move}w`, 4));
  assert.deepEqual(
    bigCube.buildBigCubeState(`${move}w`, 4).corners,
    scrambling.scrToScrambledStateCor(move, ''),
    `4x4 ${move}w must move the same corners as ${move}`,
  );
}

const requestedFourByFourTokens = [
  'Uw', "Dw'", 'Rw2', "Lw2'", 'Fw', 'Bw',
  'x', "Y'", 'Z2', "X2'",
  'r', "l'", 'f2', 'u', 'd', 'b',
  'M', "E'", 'S2', "M2'",
];
for (const token of requestedFourByFourTokens) {
  assertStateInvariant(bigCube.buildBigCubeState(token, 4));
}
for (const [move, inverse] of [
  ['r', "r'"], ['l', "l'"], ['f', "f'"],
  ['u', "u'"], ['d', "d'"], ['b', "b'"],
  ['M', "M'"], ['E', "E'"], ['S', "S'"],
]) {
  assertSolved(bigCube.buildBigCubeState(`${move} ${inverse}`, 4));
}
for (const token of ['m', 'e', 's', '3Rw']) {
  assert.throws(() => bigCube.buildBigCubeState(token, 4), /only supported/);
}

assert.deepEqual(bigCube.expandBigMove('r', 4), ['Rw', "R'"]);
assert.deepEqual(bigCube.expandBigMove("r'", 4), ['R', "Rw'"]);
assert.deepEqual(bigCube.expandBigMove('M', 4), ["x'", 'R', "L'"]);
assert.deepEqual(bigCube.expandBigMove('E', 4), ["y'", 'U', "D'"]);
assert.deepEqual(bigCube.expandBigMove('S', 4), ['z', "F'", 'B']);
assert.deepEqual(bigCube.expandBigMove('3Rw', 5), ['x', 'Lw']);
assert.deepEqual(bigCube.expandBigMove("3Rw'", 5), ["Lw'", "x'"]);
assert.deepEqual(bigCube.expandBigMove('m', 5), ["x'", 'Rw', "Lw'"]);
assert.deepEqual(bigCube.expandBigMove('e', 5), ["y'", 'Uw', "Dw'"]);
assert.deepEqual(bigCube.expandBigMove('s', 5), ['z', "Fw'", 'Bw']);

for (const token of ['3Rw', "3Lw'", '3Uw2', '3Dw', '3Fw', '3Bw', 'm', 'e', 's']) {
  assertStateInvariant(bigCube.buildBigCubeState(token, 5));
}
for (const [move, inverse] of [
  ['3Rw', "3Rw'"], ['3Uw', "3Uw'"], ['3Fw', "3Fw'"],
  ['m', "m'"], ['e', "e'"], ['s', "s'"],
]) {
  assertSolved(bigCube.buildBigCubeState(`${move} ${inverse}`, 5));
}

const wingSolved = fourByFour.solvedWingState();
assert.deepEqual(fourByFour.traceWingState(wingSolved, false).targets, []);
const parityGoal = fourByFour.wingGoalState(true);
assert.deepEqual(fourByFour.traceWingState(parityGoal, true).targets, []);
assert.deepEqual(
  [parityGoal.UFr, parityGoal.URb, parityGoal.FUl, parityGoal.RUf],
  ['URb', 'UFr', 'RUf', 'FUl'],
);

function wingStateWithCycle(cycle) {
  const state = fourByFour.solvedWingState();
  cycle.forEach((location, index) => {
    state[location] = cycle[(index + 1) % cycle.length];
  });
  return state;
}

assert.deepEqual(
  fourByFour.traceWingState(wingStateWithCycle(['UFr', 'URb', 'UBl'])).targets,
  ['URb', 'UBl'],
);
assert.deepEqual(
  fourByFour.traceWingState(wingStateWithCycle(['URb', 'UBl'])).targets,
  ['URb', 'UBl', 'URb'],
);
const directBUr = {
  targets: ['URb', 'BUr', 'BUr'],
  target_count: 3,
  last_target: 'BUr',
};
assert.equal(fourByFour.countWingTrace(directBUr, 'basic').algs, 2);
const indirectOdd = {
  targets: ['URb', 'UBl', 'URb'],
  target_count: 3,
  last_target: 'URb',
};
assert.equal(fourByFour.countWingTrace(indirectOdd, 'basic').algs, 3);
assert.equal(fourByFour.countWingTrace(indirectOdd, 'full').algs, 2);
assert.deepEqual(
  fourByFour.countWingTrace(indirectOdd, 'basic').execution_targets,
  ['URb', 'UBl', 'URb', 'BUr'],
);

const solvedXcenters = Object.fromEntries(
  bigCube.XCENTER_LOCATIONS.map((location) => [location, location[0]]),
);
assert.equal(fourByFour.traceXcenterState(solvedXcenters).algs, 0);

const exampleXcenters = { ...solvedXcenters };
Object.assign(exampleXcenters, {
  Ubl: 'R',
  Rub: 'R',
  Rdb: 'D',
  Rdf: 'L',
  Dfl: 'U',
  Luf: 'R',
});
assert.deepEqual(
  fourByFour.chooseXcenterTarget(exampleXcenters),
  { target: 'Rdb', reason: 'matching-non-U' },
  'solved R target is skipped and a non-U R target is preferred over an R target carrying U',
);

for (const scramble of [
  "Rw U2 F' Lw D B2 Uw' R",
  "M U r' E2 Fw S' D2",
  "x Rw U y' Fw2 z D'",
]) {
  const state = bigCube.buildBigCubeState(scramble, 4, 'BDR');
  assertStateInvariant(state);
  const centers = fourByFour.traceXcenterState(state.xcenters);
  assert.equal(centers.algs, Math.ceil(centers.target_count / 2));
  assert.equal(centers.execution_targets.length % 2, 0);
  const wings = fourByFour.traceWingState(state.wings, false);
  assert.ok(wings.target_count <= 46);
}

let randomSeed = 0x4b4b4b4b;
function random() {
  randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
  return randomSeed / 2 ** 32;
}
const randomBases = ['U', 'D', 'R', 'L', 'F', 'B', 'Uw', 'Dw', 'Rw', 'Lw', 'Fw', 'Bw'];
const randomSuffixes = ['', "'", '2'];
for (let sample = 0; sample < 250; sample += 1) {
  const scramble = Array.from({ length: 40 }, () => (
    randomBases[Math.floor(random() * randomBases.length)]
      + randomSuffixes[Math.floor(random() * randomSuffixes.length)]
  )).join(' ');
  const orientation = bigCube.CORNER_STICKERS[
    Math.floor(random() * bigCube.CORNER_STICKERS.length)
  ];
  const state = bigCube.buildBigCubeState(scramble, 4, orientation);
  assertStateInvariant(state);
  const centers = fourByFour.traceXcenterState(state.xcenters);
  const wings = fourByFour.traceWingState(state.wings, sample % 2);
  assert.ok(centers.target_count <= 48);
  assert.ok(wings.target_count <= 48);
  assert.equal(centers.execution_targets.length % 2, 0);
}

const solvedAnalysis = fourByFour.analyzeFourByFour('', {
  orientedCornerSticker: 'UFR',
  cornerBuffers: ['UFR'],
  wingParityCapability: 'basic',
});
assert.equal(solvedAnalysis.total_algs, 0);
assert.equal(solvedAnalysis.corner_algs, 0);
assert.equal(solvedAnalysis.wing_algs, 0);
assert.equal(solvedAnalysis.xcenter_algs, 0);

const setAnalysis = fourByFour.analyzeFourByFourSet(
  "1. Rw U2 F'\n2. DNF(12.34) Uw R2 @ 2026-08-20 12:00:00",
  { dnf: true },
);
assert.equal(setAnalysis.number_of_solves, 2);
assert.equal(setAnalysis.breakdowns[0].scramble, "Rw U2 F'");
assert.equal(setAnalysis.breakdowns[1].scramble, 'Uw R2');
assert.equal(setAnalysis.breakdowns[1].dnf, true);
assert.equal(
  setAnalysis.total_algs,
  setAnalysis.total_corner_algs + setAnalysis.total_wing_algs + setAnalysis.total_xcenter_algs,
);
assert.throws(
  () => fourByFour.analyzeFourByFourSet('this is not a scramble'),
  /No valid 4x4 scrambles found/,
);

console.log('PASS JS 4x4/5x5 state geometry, notation, and deterministic 4x4 MVP traces');
