const {
  exactRootedCornerTerminalFrontiers,
  exactWeightedClassFrontiers,
} = require('../tests/helpers/weighted-class-oracle');
const fs = require('fs');
const path = require('path');

const output = { classes: {}, rooted_corner_terminals: {} };
for (const kind of ['edge', 'corner']) {
  const exact = exactWeightedClassFrontiers(kind);
  output.classes[kind] = Object.fromEntries(
    [...exact.frontiers]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, frontier]) => [
        key,
        frontier.map((plan) => [plan.permutation_algs, plan.orientation_algs]),
      ]),
  );
}

for (const terminalType of [
  'parity',
  'ltct',
  't2c',
  'corner-floating-parity',
]) {
  const exact = exactRootedCornerTerminalFrontiers(terminalType);
  output.rooted_corner_terminals[terminalType] = Object.fromEntries(
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

if (process.argv.includes('--write')) {
  const target = path.join(__dirname, '..', 'web', 'cycle-residue.js');
  const source = fs.readFileSync(target, 'utf8');
  const json = JSON.stringify(output.rooted_corner_terminals);
  const pattern = /^  const EXACT_ROOTED_CORNER_FINISH_FRONTIERS = Object\.freeze\(.*\);$/m;
  if (!pattern.test(source)) {
    throw new Error('Could not find rooted corner frontier declaration.');
  }
  const next = source.replace(
    pattern,
    `  const EXACT_ROOTED_CORNER_FINISH_FRONTIERS = Object.freeze(${json});`,
  );
  fs.writeFileSync(target, next);
  console.log(`Wrote ${json.length} bytes of rooted corner terminal frontiers to ${target}`);
} else {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}
