const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ssiCore = require('../web/ssi-core');

const root = path.join(__dirname, '..');
const inputPath = path.join(root, 'baseline', 'testing-10k-scrams.txt');
const text = fs.readFileSync(inputPath, 'utf8');

function pythonHandmadeResult(edgeMethod) {
  const script = [
    'import json',
    'from pathlib import Path',
    'from python import ssi_handmade',
    `text = Path(${JSON.stringify(inputPath)}).read_text()`,
    `result = ssi_handmade.alg_counter_main(text, edge_method=${JSON.stringify(edgeMethod)})`,
    'print(json.dumps(result))',
  ].join('\n');
  const proc = spawnSync('python3', ['-c', script], { cwd: root, encoding: 'utf8' });
  if (proc.status !== 0) {
    throw new Error(proc.stderr || `python failed with ${proc.status}`);
  }
  return JSON.parse(proc.stdout);
}

function compare(edgeMethod) {
  const py = pythonHandmadeResult(edgeMethod);
  const js = ssiCore.algCounterMain(text, '', edgeMethod, 1, 1, false, false, ['UFR'], ['UF']);
  const pyList = py[6];
  const jsList = js[6];
  if (pyList.length !== jsList.length) {
    throw new Error(`${edgeMethod}: length mismatch ${pyList.length} !== ${jsList.length}`);
  }
  for (let i = 0; i < pyList.length; i += 1) {
    if (pyList[i] !== jsList[i]) {
      throw new Error(`${edgeMethod}: first mismatch at index ${i}: py=${pyList[i]} js=${jsList[i]}`);
    }
  }
  console.log(`PASS JS core vs handmade (${edgeMethod}): ${jsList.length} entries match`);
}

compare('weakswap');
compare('pseudoswap');
