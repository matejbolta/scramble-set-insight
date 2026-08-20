const assert = require('assert/strict');
const ssiCore = require('../web/ssi-core');
const scrambling = require('../web/scrambling');
const wideMoveTranslator = require('../web/wide-move-translator');

const SPECIAL_EXPANSIONS = {
  S: "Fw F'",
  "S'": "Fw' F",
  S2: 'Fw2 F2',
  M: "Rw' R",
  "M'": "Rw R'",
  M2: 'Rw2 R2',
  E: "Uw' U",
  "E'": "Uw U'",
  E2: 'Uw2 U2',
};

const NORMALIZED_SPECIALS = {
  S: "B F'",
  "S'": "B' F",
  S2: 'B2 F2',
  M: "L' R",
  "M'": "L R'",
  M2: 'L2 R2',
  E: "D' U",
  "E'": "D U'",
  E2: 'D2 U2',
};

const ROTATION_EXPANSIONS = {
  x: "Rw L'",
  "x'": "Rw' L",
  x2: 'Rw2 L2',
  y: "Uw D'",
  "y'": "Uw' D",
  y2: 'Uw2 D2',
  z: "Fw B'",
  "z'": "Fw' B",
  z2: 'Fw2 B2',
};

for (const [move, expansion] of Object.entries(SPECIAL_EXPANSIONS)) {
  assert.deepEqual(
    wideMoveTranslator.expandSpecialMove(move),
    expansion.split(' '),
    `${move} expansion`,
  );
  assert.equal(
    ssiCore.scrambleTransform(move),
    NORMALIZED_SPECIALS[move],
    `${move} fixed-frame normalization`,
  );

  for (const tracingOrientation of ['', 'x', "y' z", 'x2 y']) {
    const specialScramble = `R U ${move} F2 L' U`;
    const expandedScramble = `R U ${expansion} F2 L' U`;
    assert.equal(
      ssiCore.scrambleTransform(specialScramble, tracingOrientation),
      ssiCore.scrambleTransform(expandedScramble, tracingOrientation),
      `${move} normalized under ${tracingOrientation || 'identity'}`,
    );
    assert.deepEqual(
      scrambling.scrToScrambledStateEdg(specialScramble, tracingOrientation),
      scrambling.scrToScrambledStateEdg(expandedScramble, tracingOrientation),
      `${move} edge state under ${tracingOrientation || 'identity'}`,
    );
    assert.deepEqual(
      scrambling.scrToScrambledStateCor(specialScramble, tracingOrientation),
      scrambling.scrToScrambledStateCor(expandedScramble, tracingOrientation),
      `${move} corner state under ${tracingOrientation || 'identity'}`,
    );
  }
}

for (const [move, expansion] of Object.entries(ROTATION_EXPANSIONS)) {
  const upperMove = move[0].toUpperCase() + move.slice(1);
  for (const notation of [move, upperMove]) {
    assert.deepEqual(
      wideMoveTranslator.rotationMoveExpansion(notation),
      expansion.split(' '),
      `${notation} rotation expansion`,
    );
    assert.deepEqual(
      wideMoveTranslator.expandSpecialMove(notation),
      expansion.split(' '),
      `${notation} special-move expansion`,
    );

    for (const tracingOrientation of ['', 'x', "y' z", 'x2 y']) {
      const rotationScramble = `R U ${notation} F2 L' U`;
      const expandedScramble = `R U ${expansion} F2 L' U`;
      assert.equal(
        ssiCore.scrambleTransform(rotationScramble, tracingOrientation),
        ssiCore.scrambleTransform(expandedScramble, tracingOrientation),
        `${notation} normalized under ${tracingOrientation || 'identity'}`,
      );
      assert.deepEqual(
        scrambling.scrToScrambledStateEdg(rotationScramble, tracingOrientation),
        scrambling.scrToScrambledStateEdg(expandedScramble, tracingOrientation),
        `${notation} edge state under ${tracingOrientation || 'identity'}`,
      );
      assert.deepEqual(
        scrambling.scrToScrambledStateCor(rotationScramble, tracingOrientation),
        scrambling.scrToScrambledStateCor(expandedScramble, tracingOrientation),
        `${notation} corner state under ${tracingOrientation || 'identity'}`,
      );
    }
  }
}

for (const [rotationScramble, equivalentMove] of [
  ["x U x'", 'F'],
  ["y F y'", 'R'],
  ["z U z'", 'L'],
]) {
  assert.deepEqual(
    scrambling.scrToScrambledStateEdg(rotationScramble),
    scrambling.scrToScrambledStateEdg(equivalentMove),
    `${rotationScramble} edge conjugation`,
  );
  assert.deepEqual(
    scrambling.scrToScrambledStateCor(rotationScramble),
    scrambling.scrToScrambledStateCor(equivalentMove),
    `${rotationScramble} corner conjugation`,
  );
}

for (const [redundant, canonical] of [
  ["R2'", 'R2'],
  ["Fw2'", 'Fw2'],
  ["S2'", 'S2'],
  ["M2'", 'M2'],
  ["E2'", 'E2'],
  ["x2'", 'x2'],
  ["y2'", 'y2'],
  ["z2'", 'z2'],
  ["X2'", 'X2'],
  ["Y2'", 'Y2'],
  ["Z2'", 'Z2'],
]) {
  assert.equal(
    ssiCore.scrambleTransform(redundant),
    ssiCore.scrambleTransform(canonical),
    `${redundant} must normalize to ${canonical}`,
  );
}

const mixedSpecialScramble = "S R M' U2 E2 F S' L M2 E'";
const mixedExpandedScramble = mixedSpecialScramble.split(' ').flatMap((move) => (
  (SPECIAL_EXPANSIONS[move] || move).split(' ')
)).join(' ');
assert.equal(
  ssiCore.scrambleTransform(mixedSpecialScramble, "x' y2"),
  ssiCore.scrambleTransform(mixedExpandedScramble, "x' y2"),
  'mixed special moves preserve every running orientation update',
);

const specialInput = [
  'Session Statistics',
  "R2' S U",
  "S R U'",
  "M' F2 D",
  'E2 L B2',
  "x R U x'",
  'Y2 F z2\'',
  "Z' L X2' U",
  'X axis heading',
  "Extra 1\tS' U2",
].join('\n');
assert.deepEqual(
  ssiCore.extractScrambleRecords(specialInput, true).map((record) => record.scramble),
  ["R2' S U", "S R U'", "M' F2 D", 'E2 L B2', "x R U x'", "Y2 F z2'", "Z' L X2' U", "S' U2"],
  'input extraction accepts special moves and rotations without treating headers as moves',
);

const specialSet = "S R U'\nM' F2 D\nE2 L B2";
const expandedSet = "Fw F' R U'\nRw R' F2 D\nUw2 U2 L B2";
for (const edgeMethod of ['weakswap', 'pseudoswap']) {
  const specialCounts = ssiCore.algCounterMain(
    specialSet, '', edgeMethod, 1, 1, 'none', true, ['UFR'], ['UF'], 'none',
  );
  const expandedCounts = ssiCore.algCounterMain(
    expandedSet, '', edgeMethod, 1, 1, 'none', true, ['UFR'], ['UF'], 'none',
  );
  assert.deepEqual(specialCounts.slice(0, 9), expandedCounts.slice(0, 9));
}

const rotationSet = "x R U x'\ny2 F z D'\nZ2' L X U2";
const expandedRotationSet = "Rw L' R U Rw' L\nUw2 D2 F Fw B' D'\nFw2 B2 L Rw L' U2";
for (const edgeMethod of ['weakswap', 'pseudoswap']) {
  const rotationCounts = ssiCore.algCounterMain(
    rotationSet, '', edgeMethod, 1, 1, 'none', true, ['UFR'], ['UF'], 'none',
  );
  const expandedCounts = ssiCore.algCounterMain(
    expandedRotationSet, '', edgeMethod, 1, 1, 'none', true, ['UFR'], ['UF'], 'none',
  );
  assert.deepEqual(rotationCounts.slice(0, 9), expandedCounts.slice(0, 9));
}

console.log('PASS S/M/E, x/y/z rotations, and redundant half-turn primes normalize across cube state, input parsing, and counting');
