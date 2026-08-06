const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const ssiCore = require('../web/ssi-core');

const root = path.join(__dirname, '..');
const inputPath = path.join(root, 'baseline', 'testing-10k-scrams.txt');
const text = fs.readFileSync(inputPath, 'utf8');

function storedTruth(edgeMethod) {
  return JSON.parse(fs.readFileSync(
    path.join(root, 'baseline', `truth-${edgeMethod}.json`),
    'utf8',
  ));
}

function compare(edgeMethod) {
  const expected = storedTruth(edgeMethod);
  const js = ssiCore.algCounterMain(text, '', edgeMethod, 1, 1, false, false, ['UFR'], ['UF']);
  const jsList = js[6];
  if (expected.length !== jsList.length) {
    throw new Error(`${edgeMethod}: length mismatch ${expected.length} !== ${jsList.length}`);
  }
  for (let i = 0; i < expected.length; i += 1) {
    if (expected[i] !== jsList[i]) {
      throw new Error(`${edgeMethod}: first mismatch at index ${i}: truth=${expected[i]} js=${jsList[i]}`);
    }
  }
  assert.equal(js[0], expected.length, `${edgeMethod}: solve count`);
  assert.equal(js[3], expected.reduce((sum, value) => sum + value, 0), `${edgeMethod}: total algs`);
  assert.equal(js[3], js[7] + js[8], `${edgeMethod}: corner/edge aggregate`);
  assert.equal(js[9].length, expected.length, `${edgeMethod}: breakdown length`);
  assert.equal(
    js[9].reduce((sum, breakdown) => sum + breakdown.two_flips, 0),
    js[4],
    `${edgeMethod}: 2-flip aggregate`,
  );
  assert.equal(
    js[9].reduce((sum, breakdown) => sum + breakdown.two_twists, 0),
    js[5],
    `${edgeMethod}: 2-twist aggregate`,
  );
  for (const [index, breakdown] of js[9].entries()) {
    assert.equal(breakdown.total_algs, expected[index], `${edgeMethod}: breakdown ${index}`);
    assert.equal(
      breakdown.total_algs,
      breakdown.corner_algs + breakdown.edge_algs,
      `${edgeMethod}: breakdown components ${index}`,
    );
  }
  console.log(`PASS JS legacy core vs frozen truth (${edgeMethod}): ${jsList.length} entries match`);
}

compare('weakswap');
compare('pseudoswap');

const pseudoswapPrimaryClosure = ssiCore.analyzeScramble(
  'U',
  '',
  'pseudoswap',
  1,
  1,
  false,
  ['UFR'],
  ['UF'],
);
assert.equal(pseudoswapPrimaryClosure.corner.analysis.parity, true);
assert.deepEqual(pseudoswapPrimaryClosure.edges.targets, ['UR', 'UB', 'UL', 'UR']);
assert.equal(pseudoswapPrimaryClosure.edges.analysis.parity, false);
assert.equal(pseudoswapPrimaryClosure.edges.analysis.algs, 2);
assert.equal(pseudoswapPrimaryClosure.total_algs, 4);

const pseudoswapFlippedPrimaryClosure = ssiCore.analyzeScramble(
  "R F' U L' Uw'",
  '',
  'pseudoswap',
  1,
  1,
  false,
  ['UFR'],
  ['UF'],
);
assert.equal(pseudoswapFlippedPrimaryClosure.corner.analysis.parity, true);
assert.deepEqual(
  pseudoswapFlippedPrimaryClosure.edges.targets,
  ['FR', 'FD', 'RB', 'UR', 'UB', 'UL', 'RU', 'FL', 'DL', 'LF', 'DR', 'DB', 'BL', 'RD'],
);
assert.equal(pseudoswapFlippedPrimaryClosure.edges.analysis.parity, false);
assert.equal(pseudoswapFlippedPrimaryClosure.edges.analysis.algs, 7);

const pseudoswapFloatingClosure = ssiCore.analyzeScramble(
  'U Rw2',
  '',
  'pseudoswap',
  1,
  1,
  false,
  ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL'],
  ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'],
);
assert.equal(pseudoswapFloatingClosure.edges.tracing_model, 'cycle-residue');
assert.deepEqual(pseudoswapFloatingClosure.edges.cycle_residue.residue_types, ['P', 'P']);
assert.equal(pseudoswapFloatingClosure.edges.analysis.parity, false);
assert.equal(pseudoswapFloatingClosure.edges.analysis.saved_by_pairing, 0);
assert.equal(pseudoswapFloatingClosure.edges.analysis.algs, 3);
assert.equal(pseudoswapFloatingClosure.total_algs, 6);
console.log('PASS JS full-floating P + P regression costs two residue algs');

assert.throws(
  () => ssiCore.analyzeScramble('U', '', 'pseudoswap', 1, 1, false, ['UFL'], ['UF']),
  /Corner buffer selection must include UFR/,
);
assert.throws(
  () => ssiCore.analyzeScramble('U', '', 'pseudoswap', 1, 1, false, ['UFR'], ['UR']),
  /Edge buffer selection must include UF/,
);
console.log('PASS JS primary floating buffer validation');

const examplePoolPath = path.join(root, 'web', 'examples', 'testing-10k-scrams.txt');
const examplePoolText = fs.readFileSync(examplePoolPath, 'utf8');
const examplePoolLines = examplePoolText.split(/\r?\n/).filter(Boolean);
const examplePoolRecords = ssiCore.extractScrambleRecords(examplePoolText, true);
assert.equal(examplePoolLines.length, 10000, 'example pool size');
assert.equal(examplePoolLines.filter((line) => line.startsWith('DNF ')).length, 3333, 'example pool DNF count');
assert.ok(
  examplePoolLines.every((line, index) => line.startsWith('DNF ') === ((index + 1) % 3 === 0)),
  'every third example scramble should be a DNF',
);
assert.equal(examplePoolRecords.length, 10000, 'all example scrambles should parse with DNFs included');
assert.equal(examplePoolRecords.filter((record) => record.dnf).length, 3333, 'example DNF metadata count');
assert.equal(ssiCore.extractScrambleRecords(examplePoolText, false).length, 6667, 'example DNFs should remain excludable');
console.log('PASS JS example pool DNF distribution');

const appHtml = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8');
function inputTagById(id) {
  const match = appHtml.match(new RegExp(`<input\\b[^>]*\\bid="${id}"[^>]*>`));
  assert.ok(match, `missing #${id} input`);
  return match[0];
}
function isCheckedInput(tag) {
  return /\schecked(?:\s|\/?\>)/.test(tag);
}

assert.equal(isCheckedInput(inputTagById('dnf')), true, 'Include DNFs should default on');
assert.match(appHtml, /<input[^>]*name="finish-capability"[^>]*value="none"[^>]*checked[^>]*>/, 'Advanced should default to None');
assert.match(inputTagById('finish-t2c'), /\sdisabled/, 'T2C should start disabled outside full floating');
assert.match(appHtml, /id="advanced-label">Advanced</, 'Advanced group label');
assert.match(appHtml, /Partial floating \(advanced\)/, 'partial floating should be marked advanced');
for (const id of ['show-overview', 'show-breakdown', 'show-compact-breakdown', 'show-distribution']) {
  assert.equal(isCheckedInput(inputTagById(id)), true, `#${id} should default on`);
}
assert.match(appHtml, /<input[^>]*name="buffer-mode"[^>]*value="standard"[^>]*checked[^>]*>/, 'UF/UFR should be the default buffer mode');
assert.match(appHtml, /<input[^>]*name="edge-method"[^>]*value="pseudoswap"[^>]*checked[^>]*>/, 'Pseudo swap should be the default edge method');
assert.doesNotMatch(inputTagById('tracing-orientation'), /\svalue=/, 'orientation should default empty');
assert.match(inputTagById('flip-weight'), /\svalue="1"/, '2-flip weight should default to 1');
assert.match(inputTagById('twist-weight'), /\svalue="1"/, '2-twist weight should default to 1');
assert.match(inputTagById('flip-weight'), /\smin="1"/, '2-flip weight should reject sub-unit values');
assert.match(inputTagById('twist-weight'), /\smin="1"/, '2-twist weight should reject sub-unit values');
assert.match(inputTagById('flip-weight'), /\sstep="0\.01"/, '2-flip weight should accept 1.25');
assert.match(inputTagById('twist-weight'), /\sstep="0\.01"/, '2-twist weight should accept 1.25');
console.log('PASS JS first-visit analysis defaults');

const cstimerFixtureDirectory = path.join(root, 'tests', 'fixtures', 'cstimer-inputs');
const cstimerExtractionBaselines = {
  'generator-no-prefix-100.txt': {
    excluded: [100, '82d6df982e2350f690121932862376b5387d808db7c9a91708949479b7636e2d'],
    included: [100, '82d6df982e2350f690121932862376b5387d808db7c9a91708949479b7636e2d'],
  },
  'generator-prefix-a-100.txt': {
    excluded: [100, 'da718798f84bc261b74d150c8d5e64489d3fac2445903ee23e3d28c48206abd2'],
    included: [100, 'da718798f84bc261b74d150c8d5e64489d3fac2445903ee23e3d28c48206abd2'],
  },
  'generator-prefix-b-100.txt': {
    excluded: [100, 'f83ec065dd27c0c70d0f89c7ae00fb2afa952f203142cd3a61baa89afca0622b'],
    included: [100, 'f83ec065dd27c0c70d0f89c7ae00fb2afa952f203142cd3a61baa89afca0622b'],
  },
  'generator-prefix-c-100.txt': {
    excluded: [100, '6e9d747344de550b77271efa3cd0f3894c3221e47e26bb6aced0448565dcc0b4'],
    included: [100, '6e9d747344de550b77271efa3cd0f3894c3221e47e26bb6aced0448565dcc0b4'],
  },
  'round-statistics-1-single-a-comment': {
    excluded: [1, 'cfd2d48cae207253ffb357418c863945ed5831b3b2d2e6941f1db9e18b95d0a5'],
    included: [1, 'cfd2d48cae207253ffb357418c863945ed5831b3b2d2e6941f1db9e18b95d0a5'],
  },
  'round-statistics-1-single-b': {
    excluded: [1, '8ffd665e2b6eab6636114942adf6fa2dc57820c2a8c04741a2bdb2ee854bb7b3'],
    included: [1, '8ffd665e2b6eab6636114942adf6fa2dc57820c2a8c04741a2bdb2ee854bb7b3'],
  },
  'round-statistics-1-single-c': {
    excluded: [0, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    included: [1, '85a6f9c878d851c7998cb0ce38d095f7166e4656d6605e52159308d80d81df00'],
  },
  'round-statistics-1-single-d': {
    excluded: [0, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    included: [1, '479c3008fa57961a590f45274baae5b617997a81075692a8c52934f78a21d863'],
  },
  'round-statistics-3-mean': {
    excluded: [2, 'b2f03acafa5dfd00d04fa4e5f11d5716087b62970efc0af8b9967c5936f68952'],
    included: [3, 'ca6da5469975e20fc7836776ae70b1a9127aab0a761672d878287838818f2377'],
  },
  'round-statistics-5-avg': {
    excluded: [2, 'e282d7e024db023f2ec50ba0f2385f74f4893d45e13dbfdf018c78e725ddaa5b'],
    included: [5, '9dec391298e23514ceb42b9561af89f8fa908750519a2b53b454eed9be899e62'],
  },
  'session-statistics-synthetic.txt': {
    excluded: [7, 'e4c6d6ea97440b00b0168bd8c1bad9364885a5557b4104c54bb8a4cbf4c88ff9'],
    included: [12, 'ad7e4a779095e9eac80dbfa6cf7e88a178f8a015e90cac314542492bd79e40db'],
  },
};
const cstimerDnfCounts = {
  'generator-no-prefix-100.txt': 0,
  'generator-prefix-a-100.txt': 0,
  'generator-prefix-b-100.txt': 0,
  'generator-prefix-c-100.txt': 0,
  'round-statistics-1-single-a-comment': 0,
  'round-statistics-1-single-b': 0,
  'round-statistics-1-single-c': 1,
  'round-statistics-1-single-d': 1,
  'round-statistics-3-mean': 1,
  'round-statistics-5-avg': 3,
  'session-statistics-synthetic.txt': 5,
};

function hashScrambles(scrambles) {
  return crypto.createHash('sha256').update(scrambles.join('\n')).digest('hex');
}

for (const [fixtureName, baseline] of Object.entries(cstimerExtractionBaselines)) {
  const fixtureText = fs.readFileSync(path.join(cstimerFixtureDirectory, fixtureName), 'utf8');
  for (const [mode, includeDnfs] of [['excluded', false], ['included', true]]) {
    const scrambles = ssiCore.extractScrambleList(fixtureText, includeDnfs);
    assert.equal(scrambles.length, baseline[mode][0], `${fixtureName} (${mode}) scramble count`);
    assert.equal(hashScrambles(scrambles), baseline[mode][1], `${fixtureName} (${mode}) extraction changed`);
  }

  const includedRecords = ssiCore.extractScrambleRecords(fixtureText, true);
  assert.equal(
    hashScrambles(includedRecords.map((record) => record.scramble)),
    baseline.included[1],
    `${fixtureName} record extraction changed`,
  );
  assert.equal(
    includedRecords.filter((record) => record.dnf).length,
    cstimerDnfCounts[fixtureName],
    `${fixtureName} DNF metadata count`,
  );
  assert.ok(
    ssiCore.extractScrambleRecords(fixtureText, false).every((record) => !record.dnf),
    `${fixtureName} excluded mode must not retain a DNF`,
  );
}

console.log('PASS JS csTimer fixture extraction baselines');

const meanFixtureText = fs.readFileSync(path.join(cstimerFixtureDirectory, 'round-statistics-3-mean'), 'utf8');
const meanWithDnfs = ssiCore.algCounterMain(meanFixtureText, '', 'weakswap', 1, 1, false, true, ['UFR'], ['UF']);
const meanWithoutDnfs = ssiCore.algCounterMain(meanFixtureText, '', 'weakswap', 1, 1, false, false, ['UFR'], ['UF']);
assert.deepEqual(meanWithDnfs[9].map((breakdown) => breakdown.dnf), [false, false, true]);
assert.deepEqual(meanWithoutDnfs[9].map((breakdown) => breakdown.dnf), [false, false]);
console.log('PASS JS per-scramble DNF metadata');

const wcaArchiveFixtureDirectory = path.join(root, 'tests', 'fixtures', 'wca-archive-inputs');
const wcaMainScrambles = [
  "R' F R2 D F2 U' F2 U L2 U' R2 D2 U' B F U F2 R2 F L U' Rw'",
  "R B2 R B' D2 B' L2 D2 L2 U2 B' L2 B2 U L R2 F U' L Fw'",
  "U2 L D2 B2 L' U2 B2 R' U2 R2 B D' F2 R' B D B' L' F R2 Uw2",
  "F2 L' D2 R U2 R' B2 F2 L' F2 L' B' U2 R U' L D L' R' U B Rw2 Uw",
  "U L D L2 F2 R' U2 F2 R2 D2 B2 L2 R D2 B' L R F2 D' L2 B Rw Uw",
];
const wcaExtraScrambles = [
  "L2 F' U' F' U2 L' D R' D2 B' R2 U2 F2 L2 U2 F2 L2 F' R F",
  "L2 F' R' D2 B D2 F R2 B R2 D2 B L2 F' U' R D2 L2 U B' U' Rw Uw2",
];
const wcaGroupBScrambles = [
  "L2 R2 B2 R2 U2 L2 D R2 D L' R U R' B' D' U' F R2 D F' Uw2",
  "R U B D2 U2 B' L2 B' F' D2 B R' F' D' L' B2 F2 L' D2 Rw'",
  "U2 L' F' D' R2 F2 R2 B' F L2 B' U2 B L R F' U' R' F D Rw2 Uw2",
  "R' U F' D' B2 L2 B2 U' R2 B2 U B2 L' B' R U' L' F Rw2",
  "B D2 R L U' R2 L' F2 D' L2 D L2 U B2 D' F2 U B' D Rw' Uw'",
  "D' F' L' U' R2 U F2 U B2 D2 F2 R2 F2 R' F' L2 B2 U L' F2 Uw2",
  "L2 D B2 L2 D' L2 F2 D2 F2 L D F R B F R' D R' D2 R2 Fw'",
];
const wcaArchiveExpectations = {
  'first-number-omitted.txt': wcaMainScrambles,
  'numbered-with-empty-extra.txt': wcaMainScrambles,
  'leading-tab-with-extras.txt': [...wcaMainScrambles, ...wcaExtraScrambles],
  'partial-selection.txt': wcaMainScrambles.slice(0, 2),
  'group-letter-prefix.txt': wcaGroupBScrambles.slice(0, 2),
  'two-groups-first-label-omitted.txt': [...wcaMainScrambles, ...wcaExtraScrambles, ...wcaGroupBScrambles],
  'two-groups-with-labels.txt': [...wcaMainScrambles, ...wcaExtraScrambles, ...wcaGroupBScrambles],
};

for (const [fixtureName, expectedScrambles] of Object.entries(wcaArchiveExpectations)) {
  const fixtureText = fs.readFileSync(path.join(wcaArchiveFixtureDirectory, fixtureName), 'utf8');
  assert.deepEqual(
    ssiCore.extractScrambleList(fixtureText, false),
    expectedScrambles,
    `${fixtureName} WCA archive extraction`,
  );
  assert.deepEqual(
    ssiCore.extractScrambleRecords(fixtureText, true),
    expectedScrambles.map((scramble) => ({ scramble, dnf: false })),
    `${fixtureName} WCA archive record extraction`,
  );
}

console.log('PASS JS WCA archive copy formats');

const ltctScramble = "L2 U B D' F' L U F D R2 L2 D2 F L2 B R2 D2 B' D2 Fw Uw'";
const standardPayload = {
  scrambles: ltctScramble,
  tracingOrientation: '',
  edgeMethod: 'weakswap',
  flipWeight: 1,
  twistWeight: 1,
  finishCapability: 'ltct',
  dnf: false,
  cornerBuffers: ['UFR'],
  edgeBuffers: ['UF'],
  bufferMode: 'standard',
};

const workerMessages = [];
global.self = {
  importScripts() {},
  SsiCore: ssiCore,
  postMessage(message) {
    workerMessages.push(message);
  },
};
delete require.cache[require.resolve('../web/worker')];
require('../web/worker');

function runWorker(payload) {
  workerMessages.length = 0;
  global.self.onmessage({ data: { id: 1, type: 'analyze', payload } });
  assert.equal(workerMessages.length, 1);
  assert.equal(workerMessages[0].ok, true);
  return workerMessages[0].result;
}

const standardLtctResult = runWorker(standardPayload);
assert.equal(standardLtctResult[9][0].scramble, ltctScramble);
assert.equal(standardLtctResult[9][0].ltct_used, true);
assert.equal(standardLtctResult[9][0].ltct_saved_algs, 1);
assert.equal(standardLtctResult[9][0].finish_type, 'ltct');
assert.equal(standardLtctResult[9][0].finish_saved_algs, 1);
assert.equal(standardLtctResult[9][0].baseline_total_algs, 10);
assert.equal(standardLtctResult[9][0].total_algs, 9);
assert.equal(standardLtctResult[9][0].baseline_corner_algs, 5);
assert.equal(standardLtctResult[9][0].corner_algs, 4);
assert.equal(standardLtctResult[9][0].baseline_edge_algs, standardLtctResult[9][0].edge_algs);
assert.equal(standardLtctResult[10].has_ltct_comparison, true);
assert.equal(standardLtctResult[10].has_finish_comparison, true);
assert.equal(standardLtctResult[10].finish_capability, 'ltct');
assert.equal(standardLtctResult[10].finish_saved_algs, 1);
assert.equal(standardLtctResult[10].has_floating_comparison, false);
assert.equal(standardLtctResult[10].combined_saved_algs, 1);
assert.equal(standardLtctResult[10].ltct_saved_algs, 1);

const floatingLtctScramble = "B2 L D R B2 R F2 R' U2 L2 U2 R2 F2 D B' L R' F' U L' Uw";
const floatingLtctResult = runWorker({
  ...standardPayload,
  scrambles: floatingLtctScramble,
  bufferMode: 'full',
  cornerBuffers: ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL'],
  edgeBuffers: ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'],
});
assert.equal(floatingLtctResult[9][0].baseline_total_algs, 11);
assert.equal(floatingLtctResult[9][0].total_algs, 9);
assert.equal(floatingLtctResult[9][0].baseline_corner_algs, 5);
assert.equal(floatingLtctResult[9][0].corner_algs, 3);
assert.equal(floatingLtctResult[9][0].ltct_used, true);
assert.equal(floatingLtctResult[10].combined_saved_algs, 2);
assert.equal(floatingLtctResult[10].floating_saved_algs, 1);
assert.equal(floatingLtctResult[10].ltct_saved_algs, 1);

const unusedLtctResult = runWorker({
  ...standardPayload,
  scrambles: "D2 R2 U L2 R2 D' B2 L2 D' F2 D2 B2 L' B U' B L2 D2 B Rw2 Uw'",
});
assert.equal(unusedLtctResult[9][0].ltct_used, false);
assert.equal(unusedLtctResult[9][0].ltct_saved_algs, 0);
assert.equal(unusedLtctResult[9][0].baseline_corner_algs, unusedLtctResult[9][0].corner_algs);
assert.equal(unusedLtctResult[10].combined_saved_algs, 0);
assert.equal(unusedLtctResult[10].ltct_saved_algs, 0);

const t2cScramble = "D2 B U2 R' D F' D' B2 U' L2 D2 F2 R2 F L2 F2 R2 U2 F D2 Rw' Uw2";
const floatingT2cResult = runWorker({
  ...standardPayload,
  scrambles: t2cScramble,
  finishCapability: 't2c',
  bufferMode: 'full',
  cornerBuffers: ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL'],
  edgeBuffers: ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'],
});
assert.equal(floatingT2cResult[9][0].baseline_total_algs, 9);
assert.equal(floatingT2cResult[9][0].total_algs, 7);
assert.equal(floatingT2cResult[9][0].finish_type, 't2c');
assert.equal(floatingT2cResult[9][0].finish_saved_algs, 1);
assert.equal(floatingT2cResult[9][0].ltct_used, false);
assert.equal(floatingT2cResult[10].finish_capability, 't2c');
assert.equal(floatingT2cResult[10].finish_saved_algs, 1);
assert.equal(floatingT2cResult[10].floating_saved_algs, 1);
assert.equal(floatingT2cResult[10].combined_saved_algs, 2);

assert.throws(
  () => ssiCore.analyzeScramble(t2cScramble, '', 'pseudoswap', 1, 1, 't2c', ['UFR'], ['UF']),
  /T2C requires full floating/,
);
assert.equal(ssiCore.normalizeFinishCapability(true), 'ltct');
assert.equal(ssiCore.normalizeFinishCapability(false), 'none');

delete global.self;

const appSource = fs.readFileSync(path.join(root, 'web', 'app.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'web', 'worker.js'), 'utf8');
assert.match(appSource, /button\.disabled = requiredBuffers\.includes\(option\)/, 'partial floating must pin primary buffer pills');
const workerVersionMatch = appSource.match(/new Worker\('\.\/worker\.js\?v=([^']+)'\)/);
assert.ok(workerVersionMatch, 'app.js must version the analysis worker URL');
const workerVersion = workerVersionMatch[1];
const dependencyVersions = [...workerSource.matchAll(/\?v=([^']+)'/g)].map((match) => match[1]);
assert.ok(dependencyVersions.length >= 8, 'worker.js must version all imported dependencies');
assert.ok(
  dependencyVersions.every((version) => version === workerVersion),
  'analysis worker and dependency versions must stay synchronized',
);

console.log('PASS JS production Advanced LTCT/T2C comparison metadata');
console.log('PASS JS analysis worker cache versions stay synchronized');

require('./test_js_cycle_model');
require('./test_js_cycle_residue');
require('./test_js_cycle_residue_oracle');
require('./test_js_weighted_class_frontiers');
require('./test_js_residue_planner');
