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
