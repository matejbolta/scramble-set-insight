const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ssiCore = require('../web/ssi-core');

const root = path.join(__dirname, '..');
const inputPath = path.join(root, 'baseline', 'testing-10k-scrams.txt');
const text = fs.readFileSync(inputPath, 'utf8');

function pythonCoreCall(edgeMethod, cornerBuffers, edgeBuffers) {
  const script = [
    'import json',
    'from pathlib import Path',
    'from python import ssi_core',
    `text = Path(${JSON.stringify(inputPath)}).read_text()`,
    `result = ssi_core.alg_counter_main(text, edge_method=${JSON.stringify(edgeMethod)}, corner_buffers=${JSON.stringify(cornerBuffers)}, edge_buffers=${JSON.stringify(edgeBuffers)})`,
    'print(json.dumps(result))',
  ].join('\n');
  const proc = spawnSync('python3', ['-c', script], { cwd: root, encoding: 'utf8' });
  if (proc.status !== 0) throw new Error(proc.stderr || `python failed with ${proc.status}`);
  return JSON.parse(proc.stdout);
}

function compareLists(label, expected, actual) {
  const expectedList = expected[6];
  const actualList = actual[6];
  if (expectedList.length !== actualList.length) {
    throw new Error(`${label}: length mismatch ${expectedList.length} !== ${actualList.length}`);
  }
  for (let i = 0; i < expectedList.length; i += 1) {
    if (expectedList[i] !== actualList[i]) {
      throw new Error(`${label}: first mismatch at index ${i}: expected=${expectedList[i]} actual=${actualList[i]}`);
    }
  }
  for (const resultIndex of [3, 7, 8]) {
    if (expected[resultIndex] !== actual[resultIndex]) {
      throw new Error(`${label}: aggregate mismatch at result index ${resultIndex}: expected=${expected[resultIndex]} actual=${actual[resultIndex]}`);
    }
  }
  if (actual[3] !== actual[7] + actual[8]) {
    throw new Error(`${label}: component total mismatch ${actual[3]} !== ${actual[7]} + ${actual[8]}`);
  }
  if (JSON.stringify(expected[9]) !== JSON.stringify(actual[9])) {
    throw new Error(`${label}: per-scramble component breakdowns do not match`);
  }
  for (let i = 0; i < actual[9].length; i += 1) {
    const breakdown = actual[9][i];
    if (breakdown.total_algs !== breakdown.corner_algs + breakdown.edge_algs) {
      throw new Error(`${label}: per-scramble component mismatch at index ${i}`);
    }
  }
  console.log(`PASS ${label}: ${actualList.length} entries match`);
}

for (const edgeMethod of ['weakswap', 'pseudoswap']) {
  const pyCoreLegacy = pythonCoreCall(edgeMethod, ['UFR'], ['UF']);
  const jsCoreLegacy = ssiCore.algCounterMain(text, '', edgeMethod, 1, 1, false, false, ['UFR'], ['UF']);
  compareLists(`JS against Python core (${edgeMethod}, UFR/UF)`, pyCoreLegacy, jsCoreLegacy);

  const pyCoreFloating = pythonCoreCall(edgeMethod, 'all', 'all');
  const jsCoreFloating = ssiCore.algCounterMain(text, '', edgeMethod, 1, 1, false, false, 'all', 'all');
  compareLists(`JS against Python core (${edgeMethod}, all/all)`, pyCoreFloating, jsCoreFloating);
}
