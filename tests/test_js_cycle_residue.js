const assert = require('assert/strict');
const residue = require('../web/cycle-residue');

function enumerateCountVectors(limits, visit, index = 0, counts = []) {
  if (index === limits.length) {
    visit([...counts]);
    return;
  }
  for (let count = 0; count <= limits[index]; count += 1) {
    counts[index] = count;
    enumerateCountVectors(limits, visit, index + 1, counts);
  }
}

function expandCounts(order, counts) {
  return order.flatMap((type, index) => Array(counts[index]).fill(type));
}

function physicalPieceCount(kind, residues) {
  return residues.reduce((sum, type) => sum + residue.RESIDUE_MIN_PIECES[kind][type], 0);
}

function containsClosedProperSubset(kind, residues) {
  const order = kind === 'edge' ? residue.EDGE_RESIDUE_ORDER : residue.CORNER_RESIDUE_ORDER;
  const counts = order.map((type) => residues.filter((candidate) => candidate === type).length);
  let found = false;
  enumerateCountVectors(counts, (subsetCounts) => {
    if (found) return;
    const subsetSize = subsetCounts.reduce((sum, count) => sum + count, 0);
    if (!subsetSize || subsetSize === residues.length) return;
    const signature = residue.signatureOfResidues(kind, expandCounts(order, subsetCounts));
    if (!signature.parity && !signature.orientation) found = true;
  });
  return found;
}

function catalogKeys(kind, entries) {
  return entries.map((entry) => residue.multisetKey(kind, entry.residues)).sort();
}

assert.equal(residue.EDGE_CLOSED_ATOMS.length, 4);
assert.equal(residue.CORNER_CLOSED_ATOMS.length, 15);
assert.equal(residue.CORNER_PARITY_TERMINALS.length, 7);

for (const atom of residue.EDGE_CLOSED_ATOMS) {
  assert.deepEqual(residue.signatureOfResidues('edge', atom.residues), { parity: 0, orientation: 0 });
  assert.equal(containsClosedProperSubset('edge', atom.residues), false);
  assert.equal(residue.minimumClosedPartition('edge', atom.residues).cost, atom.cost);
}

for (const atom of residue.CORNER_CLOSED_ATOMS) {
  assert.deepEqual(residue.signatureOfResidues('corner', atom.residues), { parity: 0, orientation: 0 });
  assert.equal(containsClosedProperSubset('corner', atom.residues), false);
  assert.ok(physicalPieceCount('corner', atom.residues) <= 8);
  assert.equal(residue.minimumClosedPartition('corner', atom.residues).cost, atom.cost);
}

for (const terminal of residue.CORNER_PARITY_TERMINALS) {
  assert.deepEqual(residue.signatureOfResidues('corner', terminal.residues), { parity: 1, orientation: 0 });
  assert.equal(containsClosedProperSubset('corner', terminal.residues), false);
  assert.ok(physicalPieceCount('corner', terminal.residues) <= 8);
  assert.equal(
    residue.minimumUnitResidueCost('corner', terminal.residues, true).cost,
    terminal.cost,
  );
}

const enumeratedEdgeAtoms = [];
enumerateCountVectors([12, 6, 6], (counts) => {
  const residues = expandCounts(residue.EDGE_RESIDUE_ORDER, counts);
  if (!residues.length || physicalPieceCount('edge', residues) > 12) return;
  const signature = residue.signatureOfResidues('edge', residues);
  if (signature.parity || signature.orientation || containsClosedProperSubset('edge', residues)) return;
  enumeratedEdgeAtoms.push(residue.multisetKey('edge', residues));
});
assert.deepEqual(
  [...new Set(enumeratedEdgeAtoms)].sort(),
  catalogKeys('edge', residue.EDGE_CLOSED_ATOMS),
  'edge closed atom catalog must be exhaustive',
);

const enumeratedCornerAtoms = [];
const enumeratedCornerTerminals = [];
enumerateCountVectors([8, 8, 4, 4, 4], (counts) => {
  const residues = expandCounts(residue.CORNER_RESIDUE_ORDER, counts);
  if (!residues.length || physicalPieceCount('corner', residues) > 8) return;
  const signature = residue.signatureOfResidues('corner', residues);
  if (containsClosedProperSubset('corner', residues)) return;
  if (!signature.parity && !signature.orientation) {
    enumeratedCornerAtoms.push(residue.multisetKey('corner', residues));
  } else if (signature.parity === 1 && signature.orientation === 0) {
    enumeratedCornerTerminals.push(residue.multisetKey('corner', residues));
  }
});
assert.deepEqual(
  [...new Set(enumeratedCornerAtoms)].sort(),
  catalogKeys('corner', residue.CORNER_CLOSED_ATOMS),
  'corner closed atom catalog must be exhaustive',
);
assert.deepEqual(
  [...new Set(enumeratedCornerTerminals)].sort(),
  catalogKeys('corner', residue.CORNER_PARITY_TERMINALS),
  'corner parity terminal catalog must be exhaustive',
);

for (const terminal of [['T+', 'P-'], ['T-', 'P+']]) {
  assert.equal(residue.cornerParityTerminalCost(terminal, 'none', 'in-P'), 2);
  assert.equal(residue.cornerParityTerminalCost(terminal, 'ltct', 'in-P'), 1);
  assert.equal(residue.cornerParityTerminalCost(terminal, 'ltct', 'is-T'), 2);
  assert.equal(residue.cornerParityTerminalCost(terminal, 't2c', 'in-P'), 1);
  assert.equal(residue.cornerParityTerminalCost(terminal, 't2c', 'is-T'), 1);
  assert.equal(residue.cornerParityTerminalCost(terminal, 't2c', 'uninvolved'), 2);
}
assert.equal(residue.normalizeFinishCapability(false), 'none');
assert.equal(residue.normalizeFinishCapability(true), 'ltct');
assert.equal(residue.normalizeFinishCapability('T2C'), 't2c');

assert.deepEqual(
  residue.reducePhysicalCycle({ id: 'edge-f', kind: 'edge', length: 1, orientation_sum: 1 }),
  {
    cycle_id: 'edge-f', kind: 'edge', length: 1, slots: [], base_algs: 0,
    parity: 0, orientation: 1, type: 'F',
  },
);
assert.equal(
  residue.reducePhysicalCycle({ id: 'edge-pf', kind: 'edge', length: 4, orientation_sum: 1 }).type,
  'PF',
);
assert.equal(
  residue.reducePhysicalCycle({ id: 'corner-t-', kind: 'corner', length: 3, orientation_sum: 2 }).type,
  'T-',
);
assert.equal(
  residue.reducePhysicalCycle({ id: 'corner-p+', kind: 'corner', length: 4, orientation_sum: 1 }).type,
  'P+',
);

const doubleCornerSwap = residue.minimumClosedPartition('corner', ['P0', 'P0']);
assert.equal(doubleCornerSwap.cost, 2, 'two oriented corner 2-swaps cost two algs');
assert.deepEqual(doubleCornerSwap.groups, [['P0', 'P0']]);

console.log('PASS residue signatures and unit-cost catalogs');
console.log('PASS exhaustive 3x3 edge/corner atom and parity-terminal enumeration');
console.log('PASS LTCT/T2C capability hierarchy and UFR role matrix');
console.log('PASS P0 + P0 regression costs two algs');
