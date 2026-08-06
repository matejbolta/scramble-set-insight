const assert = require('assert/strict');
const cycleModel = require('../web/cycle-model');
const residue = require('../web/cycle-residue');
const {
  exactRootedCornerFinishFrontiers,
  exactWeightedClassFrontiers,
} = require('./helpers/weighted-class-oracle');

function decompose(kind, state) {
  return kind === 'corner'
    ? cycleModel.decomposeCornerState(state)
    : cycleModel.decomposeEdgeState(state);
}

for (const [kind, expectedClassCount] of [['edge', 302], ['corner', 140]]) {
  const exact = exactWeightedClassFrontiers(kind);
  assert.equal(exact.graph.size, expectedClassCount, `${kind} weighted class count`);
  for (const [key, state] of exact.representatives) {
    const model = decompose(kind, state);
    const generated = exact.frontiers.get(key).map((plan) => [
      plan.permutation_algs,
      plan.orientation_algs,
    ]);
    const production = residue.exactWeightedClassFrontier(model).map((plan) => [
      plan.permutation_algs,
      plan.orientation_algs,
    ]);
    assert.deepEqual(production, generated, `${kind} weighted frontier ${key}`);
    for (const weight of [1, 1.1, 1.25, 2, 10]) {
      const selected = residue.minimumExactWeightedClassPlan(model, weight);
      const expected = Math.min(...generated.map(
        ([permutationAlgs, orientationAlgs]) => permutationAlgs + weight * orientationAlgs,
      ));
      assert.ok(
        Math.abs(selected.cost - expected) < 1e-12,
        `${kind} weighted minimum ${key} at ${weight}`,
      );
    }
  }
}

const edgeTradeoffModel = cycleModel.decomposeEdgeState(
  exactWeightedClassFrontiers('edge').representatives.get('1:1|3:1'),
);
assert.deepEqual(
  residue.exactWeightedClassFrontier(edgeTradeoffModel).map(
    (plan) => [plan.permutation_algs, plan.orientation_algs],
  ),
  [[1, 1], [2, 0]],
  'a charged 3-cycle plus flip must preserve the two-comm weighted alternative',
);
assert.equal(residue.minimumExactWeightedClassPlan(edgeTradeoffModel, 1.1).cost, 2);

for (const capability of ['none', 'ltct', 't2c']) {
  const exact = exactRootedCornerFinishFrontiers(capability);
  assert.equal(exact.graph.size, 416, `${capability} rooted corner class count`);
  for (const [key, state] of exact.representatives) {
    const model = cycleModel.decomposeCornerState(state);
    const generated = exact.frontiers.get(key).map((plan) => [
      plan.permutation_algs,
      plan.orientation_algs,
      plan.finish.type,
      plan.finish.primary_role,
    ]);
    const production = residue.exactRootedCornerFinishFrontier(model, capability).map(
      (plan) => [
        plan.permutation_algs,
        plan.orientation_algs,
        plan.finish.type,
        plan.finish.primary_role,
      ],
    );
    assert.deepEqual(production, generated, `${capability} rooted corner frontier ${key}`);
    for (const weight of [1, 1.1, 1.25, 2, 10]) {
      const selected = residue.minimumExactRootedCornerFinishPlan(model, capability, weight);
      const expected = Math.min(...generated.map(
        ([permutationAlgs, orientationAlgs]) => permutationAlgs + weight * orientationAlgs,
      ));
      assert.ok(
        Math.abs(selected.cost - expected) < 1e-12,
        `${capability} rooted corner minimum ${key} at ${weight}`,
      );
    }
  }
}

console.log('PASS all 302 edge and 140 corner weighted class frontiers match exhaustive search');
console.log('PASS weighted selection preserves whole-cycle comm/orientation tradeoffs');
console.log('PASS all 416 rooted corner parity/LTCT/T2C frontiers match exhaustive search');
