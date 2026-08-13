const fs = require('fs');
const path = require('path');
const { EDGE_BUFFER_ORDER } = require('../web/buffer-selection');
const residue = require('../web/cycle-residue');
const {
  exactWeakCapabilityFrontiersCompact,
} = require('../tests/helpers/weakswap-selected-buffer-oracle');

const START_MARKER = '  // BEGIN GENERATED EXACT WEAKSWAP FLOATING FRONTIERS';
const END_MARKER = '  // END GENERATED EXACT WEAKSWAP FLOATING FRONTIERS';

function minimumRotation(values) {
  if (values.length < 2) return values.join('');
  let best = null;
  for (let offset = 0; offset < values.length; offset += 1) {
    const candidate = values.slice(offset).concat(values.slice(0, offset)).join('');
    if (best === null || candidate < best) best = candidate;
  }
  return best;
}

function pseudoKey(weakKey, selectedCount) {
  if (weakKey === 'solved') return weakKey;
  if (selectedCount === EDGE_BUFFER_ORDER.length) {
    return weakKey.split('|').map((record) => {
      const [, length, charge] = record.split(':');
      return `${length}:${charge}`;
    }).sort().join('|');
  }
  return weakKey.split('|').map((record) => {
    const [colors, length, charge] = record.split(':');
    const anonymousAnchors = [...colors].map((color) => (
      color === 'U' || color === 'R' ? 'B' : color
    ));
    return `${minimumRotation(anonymousAnchors)}:${length}:${charge}`;
  }).sort().join('|');
}

function sameEncoded(left, right) {
  return left.length === right.length && left.every((plan, index) => (
    plan[0] === right[index][0] && plan[1] === right[index][1]
  ));
}

function compactAgainstPseudoswap(output) {
  const compact = {};
  for (const [countText, catalog] of Object.entries(output)) {
    const selectedCount = Number(countText);
    const overrides = {};
    for (const [key, capabilities] of Object.entries(catalog)) {
      const basic = capabilities[0];
      const maximal = capabilities[1] || basic;
      const pseudoFrontier = residue.exactEdgeSelectedBufferFrontierByClassKey(
        selectedCount,
        pseudoKey(key, selectedCount),
      );
      if (!pseudoFrontier) throw new Error(`Missing pseudo fallback for weak class ${key}.`);
      const pseudo = pseudoFrontier.map((plan) => [
        plan.permutation_algs,
        plan.orientation_algs,
      ]);
      const basicOverride = sameEncoded(basic, pseudo) ? null : basic;
      const maximalBase = basicOverride || pseudo;
      const maximalOverride = sameEncoded(maximal, maximalBase) ? null : maximal;
      if (basicOverride || maximalOverride) {
        overrides[key] = maximalOverride
          ? [basicOverride, maximalOverride]
          : [basicOverride];
      }
    }
    compact[selectedCount] = overrides;
    console.error(JSON.stringify({
      selected_count: selectedCount,
      override_classes: Object.keys(overrides).length,
      total_classes: Object.keys(catalog).length,
    }));
  }
  return compact;
}

function generate(counts) {
  const output = {};
  // UF+UR needs no disjoint weak correction: every overlap is already a UR
  // comm, so production reuses the ordinary exact two-buffer frontier.
  for (const selectedCount of counts) {
    const buffers = EDGE_BUFFER_ORDER.slice(0, selectedCount);
    const exact = exactWeakCapabilityFrontiersCompact(buffers, {
      on_progress(progress) {
        console.error(JSON.stringify({ selected_count: selectedCount, ...progress }));
      },
    });
    const rows = exact.keys.map((key, index) => {
      const basic = exact.basic[index];
      const maximal = exact.maximal[index];
      return [
        key,
        sameEncoded(basic, maximal) ? [basic] : [basic, maximal],
      ];
    });
    rows.sort(([left], [right]) => left.localeCompare(right));
    output[selectedCount] = Object.fromEntries(rows);
    console.error(JSON.stringify({
      selected_count: selectedCount,
      classes: exact.keys.length,
      graph_edges: exact.graph_edges,
    }));
  }
  return output;
}

function readEmbeddedCatalog(source) {
  const start = source.indexOf(START_MARKER);
  const end = source.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Could not find weakswap frontier generation markers.');
  }
  const declaration = source.indexOf('Object.freeze(', start);
  const jsonStart = declaration + 'Object.freeze('.length;
  const jsonEnd = source.lastIndexOf(');', end);
  if (declaration === -1 || jsonEnd < jsonStart) {
    throw new Error('Could not parse the embedded weakswap frontier catalog.');
  }
  return JSON.parse(source.slice(jsonStart, jsonEnd));
}

const countArgument = process.argv.find((argument) => argument.startsWith('--count='));
const assembleArgument = process.argv.find((argument) => argument.startsWith('--assemble-dir='));
const outputArgument = process.argv.find((argument) => argument.startsWith('--output='));
let output;
if (assembleArgument) {
  const directory = assembleArgument.slice('--assemble-dir='.length);
  output = {};
  const counts = countArgument
    ? [Number(countArgument.slice('--count='.length))]
    : Array.from({ length: EDGE_BUFFER_ORDER.length - 2 }, (_, index) => index + 3);
  for (const count of counts) {
    const checkpoint = JSON.parse(fs.readFileSync(path.join(directory, `${count}.json`), 'utf8'));
    output[count] = checkpoint[count];
  }
} else {
  const counts = countArgument
    ? [Number(countArgument.slice('--count='.length))]
    : Array.from({ length: EDGE_BUFFER_ORDER.length - 2 }, (_, index) => index + 3);
  if (counts.some((count) => !Number.isInteger(count) || count < 3 || count > EDGE_BUFFER_ORDER.length)) {
    throw new Error('Weak frontier count must be between 3 and 10.');
  }
  output = generate(counts);
}
if (outputArgument) {
  const json = JSON.stringify(output);
  const target = outputArgument.slice('--output='.length);
  fs.writeFileSync(target, json);
  console.log(`Wrote ${json.length} bytes of checkpoint data to ${target}`);
} else {
  output = compactAgainstPseudoswap(output);
  if (process.argv.includes('--write')) {
    const target = path.join(__dirname, '..', 'web', 'cycle-residue.js');
    const source = fs.readFileSync(target, 'utf8');
    // A single-count regeneration replaces only that prefix and preserves the
    // already embedded catalogs for all other selected-buffer counts.
    if (countArgument || assembleArgument) {
      output = { ...readEmbeddedCatalog(source), ...output };
    }
    const json = JSON.stringify(output);
    const start = source.indexOf(START_MARKER);
    const end = source.indexOf(END_MARKER);
    if (start === -1 || end === -1 || end < start) {
      throw new Error('Could not find weakswap frontier generation markers.');
    }
    const replacement = [
      START_MARKER,
      `  const EXACT_WEAKSWAP_FLOATING_FRONTIERS = Object.freeze(${json});`,
      END_MARKER,
    ].join('\n');
    const next = `${source.slice(0, start)}${replacement}${source.slice(end + END_MARKER.length)}`;
    fs.writeFileSync(target, next);
    console.log(`Wrote ${json.length} bytes of weakswap frontiers to ${target}`);
  } else {
    const json = JSON.stringify(output);
    process.stdout.write(`${json}\n`);
  }
}
