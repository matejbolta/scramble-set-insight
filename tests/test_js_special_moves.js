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
  "S R U'",
  "M' F2 D",
  'E2 L B2',
  "Extra 1\tS' U2",
].join('\n');
assert.deepEqual(
  ssiCore.extractScrambleRecords(specialInput, true).map((record) => record.scramble),
  ["S R U'", "M' F2 D", 'E2 L B2', "S' U2"],
  'input extraction accepts a special move as the first token without treating headers as moves',
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

console.log('PASS S/M/E moves match their wide-plus-face definitions across normalization, cube state, input parsing, and counting');
