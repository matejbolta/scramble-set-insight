const {
  exactRootedCornerFinishFrontiers,
  exactWeightedClassFrontiers,
} = require('../tests/helpers/weighted-class-oracle');

const output = { classes: {}, rooted_corner_finishes: {} };
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

const finishCode = { parity: 0, ltct: 1, t2c: 2 };
for (const capability of ['none', 'ltct', 't2c']) {
  const exact = exactRootedCornerFinishFrontiers(capability);
  output.rooted_corner_finishes[capability] = Object.fromEntries(
    [...exact.frontiers]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, frontier]) => [
        key,
        frontier.map((plan) => [
          plan.permutation_algs,
          plan.orientation_algs,
          finishCode[plan.finish.type],
        ]),
      ]),
  );
}

process.stdout.write(`${JSON.stringify(output)}\n`);
