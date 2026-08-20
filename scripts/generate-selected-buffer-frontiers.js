const fs = require('fs');
const path = require('path');
const {
  CORNER_BUFFER_ORDER,
  EDGE_BUFFER_ORDER,
  clearSelectedBufferOracleCaches,
  exactSelectedBufferFrontiers,
  exactSelectedBufferTerminalFrontiers,
} = require('../tests/helpers/selected-buffer-class-oracle');

const START_MARKER = '  // BEGIN GENERATED EXACT SELECTED BUFFER FRONTIERS';
const END_MARKER = '  // END GENERATED EXACT SELECTED BUFFER FRONTIERS';
function encodedFrontiers(exact) {
  return Object.fromEntries(
    [...exact.frontiers]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, frontier]) => [
        key,
        frontier.map((plan) => [
          plan.permutation_algs,
          plan.orientation_algs,
        ]),
      ]),
  );
}

function generate() {
  const output = {
    edge: {},
    corner: {
      even_permutation: {},
      terminal: {
        parity: {},
        ltct: {},
        t2c: {},
        'corner-floating-parity': {},
      },
    },
  };

  for (let selectedCount = 1; selectedCount < EDGE_BUFFER_ORDER.length; selectedCount += 1) {
    const buffers = EDGE_BUFFER_ORDER.slice(0, selectedCount);
    output.edge[selectedCount] = encodedFrontiers(
      exactSelectedBufferFrontiers('edge', buffers, 'even-permutation'),
    );
    clearSelectedBufferOracleCaches();
  }

  for (let selectedCount = 1; selectedCount < CORNER_BUFFER_ORDER.length; selectedCount += 1) {
    const buffers = CORNER_BUFFER_ORDER.slice(0, selectedCount);
    output.corner.even_permutation[selectedCount] = encodedFrontiers(
      exactSelectedBufferFrontiers('corner', buffers, 'even-permutation'),
    );
    for (const terminalType of [
      'parity',
      'ltct',
      't2c',
      'corner-floating-parity',
    ]) {
      output.corner.terminal[terminalType][selectedCount] = encodedFrontiers(
        exactSelectedBufferTerminalFrontiers(buffers, terminalType),
      );
    }
    clearSelectedBufferOracleCaches();
  }
  return output;
}

const output = generate();
const json = JSON.stringify(output);
if (process.argv.includes('--write')) {
  const target = path.join(__dirname, '..', 'web', 'cycle-residue.js');
  const source = fs.readFileSync(target, 'utf8');
  const start = source.indexOf(START_MARKER);
  const end = source.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Could not find selected-buffer frontier generation markers.');
  }
  const replacement = [
    START_MARKER,
    `  const EXACT_SELECTED_BUFFER_FRONTIERS = Object.freeze(${json});`,
    END_MARKER,
  ].join('\n');
  const next = `${source.slice(0, start)}${replacement}${source.slice(end + END_MARKER.length)}`;
  fs.writeFileSync(target, next);
  console.log(`Wrote ${json.length} bytes of selected-buffer frontiers to ${target}`);
} else {
  process.stdout.write(`${json}\n`);
}
