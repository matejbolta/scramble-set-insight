# Optimal Memo Witness And Lettering Plan

## Goal

When a user opens an analyzed scramble from either Breakdown or Compact
breakdown, the existing scramble dialog should also show the physical
memorization/tracing sequence that realizes the displayed minimum count.

The output is a memo/execution witness: buffer-target comms, 2-flips,
2-twists, parity/advanced terminal finishes, and the corresponding larger-cube
components. It is not a database of move sequences for executing individual
algorithms.

The same physical witness must render as:

- exact sticker/piece notation;
- Speffz;
- a user-defined lettering scheme.

Changing the lettering scheme must never change the chosen physical path or
the algcount.

## Why This Is Not A Small UI-Only Change

The current exact 3x3 planners and the exact corner/midge planners reused by
4x4 and 5x5 return a minimum cost and finish family, not the concrete actions
that attain it. A greedy legacy trace can disagree with that minimum, so it
must not be displayed as the solution.

The deterministic larger-cube tracers already retain enough information for:

- 4x4/5x5 wings: `targets` and parity finish;
- 4x4/5x5 xcenters: `execution_targets` and target decisions;
- 5x5 +centers: `execution_targets` and target decisions.

However, every supported cube size still contains at least one exact-planned
component without a witness. Consequently there is no cube size for which a
complete, count-matching solution can be exposed safely as a trivial change.

## Stable Physical Witness Contract

Introduce one versioned, notation-independent result shape. A representative
shape is:

```js
{
  version: 1,
  puzzle: '3x3' | '4x4' | '5x5',
  scramble: '...',
  orientation: { ... },
  total_cost: 12.25,
  components: [
    {
      kind: 'corners',
      cost: 5.25,
      actions: [
        { type: 'comm', buffer: 'UFR', targets: ['BDL', 'RDF'], cost: 1 },
        { type: '2-twist', pieces: ['UBL', 'RDF'], directions: [1, 2], cost: 1.25 },
        { type: 'terminal', family: 'ltct', pieces: { ... }, cost: 1 }
      ]
    }
  ]
}
```

Exact field names should be finalized with the first implementation, but the
following rules are mandatory:

- actions contain canonical physical stickers/pieces, never rendered letters;
- a comm records its active buffer and two ordered targets;
- orientation actions record the exact pieces and orientation directions;
- a terminal records its family, exact participating pieces/stickers, and
  configured cost;
- the sum of action costs equals the component count, including custom
  orientation and terminal weights;
- replaying the actions reaches the selected goal/terminal state;
- deterministic tie-breaking makes repeated requests return the same witness.

The witness may additionally expose derived trace segments and flat target
lists, but those are views over `actions`, not a second source of truth.

## Reconstruction Strategy

Do not enlarge the generated frontier tables with a predecessor for every
class. The class tables intentionally quotient away interchangeable physical
piece identities, so a stored class predecessor would still have to be lifted
back to the concrete scramble.

Instead, reconstruct one concrete optimal path on demand:

1. Run the existing planner and retain its selected Pareto label and terminal
   family.
2. At the current concrete state, enumerate legal concrete comm and
   2-flip/2-twist actions in canonical order.
3. Apply each candidate, derive the next exact class key, and consult the
   already embedded frontier.
4. Select the first candidate whose frontier contains the required remaining
   cost vector and terminal family.
5. Continue until the solved state or an exact legal terminal state is
   reached, then append the terminal action.

This is the production form of the concrete path-lifting technique already
used independently in `tests/helpers/selected-buffer-class-oracle.js`. It
keeps generated table size unchanged and guarantees that the witness realizes
the exact count selected for the user's runtime weights.

### Ordinary Corners And Pseudoswap Edges

Implement the generic concrete lifter first. It covers singleton, partial, and
full selected-buffer states because production already exposes the exact
frontier lookup and class-key functions for all selected counts.

For parity corners, lift against the chosen terminal family's zero-priced
prefix frontier. At zero prefix cost, match the concrete state against the
legal goals produced by `buildCornerTerminalGoals(...)`, then append classic
parity, LTCT, T2C, or corner-floating parity with its runtime weight.

For pseudoswap edges, first construct the same parity-relative goal used by
counting, lift that relative state, and preserve literal sticker orientation
in every action.

### Weakswap Edges

Weakswap needs a dedicated witness route matching its two-phase planner:

1. Extend the physical UF/UR weak-start search with optional predecessor and
   concrete target-action data.
2. Select the same optimal legal entry used by counting, including forced-UR,
   F2E/FF2E open-root, and LTEF-after-prefix cases.
3. From that concrete entry state, lift through the rooted suffix frontier.
4. Match the concrete final state to the exact `2E2E`, F2E, FF2E, LTEF, or
   ordinary closure and append that terminal.

The witness mode must use the same weak entry state machine, not reconstruct a
pseudoswap-looking path from the parity-relative endpoint.

### 4x4 And 5x5

Reuse the 3x3 lifters for:

- corners on both sizes;
- 5x5 midges in their pseudoswap frame.

Adapt the data already retained by deterministic tracers for:

- wings: pair ordered execution targets into UFr comms and append the exact
  direct or `BUr`-buffered wing parity finish;
- xcenters: pair `execution_targets` into Ubl comms and retain the documented
  deterministic target decisions;
- +centers: pair `execution_targets` into Ub comms in the same way.

For 4x4 `Optimal` orientation, reconstruct only the already selected winning
orientation. For a fixed orientation with `Compare with optimal`, the modal
normally shows the selected-orientation solution; the optimal comparison may
be a separate optional view later.

The witness will exactly match the current deterministic center count. Future
global center optimization must return its own witness through the same
contract rather than changing the renderer.

## On-Demand Worker Flow

Do not reconstruct witnesses for every scramble during a 10k analysis.

Add a second worker request, conceptually:

```text
click result
  -> open dialog immediately with scramble and loading state
  -> request witness for this scramble + the exact analyzed settings
  -> worker reconstructs or returns a cached witness
  -> render solution
```

Cache by puzzle, normalized scramble, orientation, buffer selections, method,
weights, and capabilities. A new analysis invalidates the app-side cache.
Use request IDs so closing the dialog or opening another scramble cannot
render a stale response.

## Lettering Layer

Add a pure renderer after physical witness reconstruction:

```text
physical witness -> notation profile -> displayed memo
```

Profiles:

1. **Piece notation**: canonical sticker IDs such as `UFR`, `FU`, `UFr`,
   `Ubl`, and `Ub`. This profile works for every current piece type without
   additional domain decisions.
2. **Speffz**: explicit immutable maps for every supported piece type.
3. **Custom**: saved user mappings keyed by canonical physical sticker/target
   ID, initially seeded from the selected built-in profile.

The existing `STICKER_LETTER_MAP` in `web/edge-common.js` is the project's
legacy custom corner/edge scheme, not a general lettering subsystem and not a
Speffz definition. Preserve it as a named legacy profile or migration source;
do not silently relabel it as Speffz.

Before implementing big-cube Speffz/custom editors, confirm the desired
convention for wings, xcenters, and +centers. Their canonical target IDs are
already suitable map keys, but the UI grouping and any standard letter
assignment are a human-facing convention rather than a counting fact.

Recommended settings UI:

- one `Solution notation` selector: Piece notation / Speffz / Custom;
- a separate custom-scheme editor, grouped by puzzle component and face;
- validate completeness and duplicate policy explicitly;
- persist only the maps and selected profile, never rendered memo text.

## Dialog UX

Reuse the existing dialog opened by both Breakdown rows and Compact breakdown
cells. It should contain:

- scramble number and DNF marker;
- scramble text;
- selected orientation where relevant;
- a Solution section split by puzzle component;
- ordered comm pairs and separate flip/twist/terminal annotations;
- the component cost beside each component and the total witness cost;
- notation selector or a direct link to notation settings;
- loading, unavailable, and reconstruction-error states.

On narrow screens, components stack vertically and memo tokens wrap. Keyboard
opening, focus return, Escape/close behavior, and current row/cell click
behavior must remain intact.

## Implementation Phases

1. **Contract and replay validator**
   - define the physical witness schema;
   - implement action replay and cost validation;
   - convert existing wing/center trace data to the schema in tests only.
2. **Generic exact lifter**
   - ordinary corners and pseudoswap edges;
   - odd corner terminal families;
   - test singleton, every partial prefix, full floating, runtime weights, and
     concrete terminal identity.
3. **Weakswap lifter**
   - weak-start predecessors;
   - rooted suffix lifting;
   - forced UR, open-root capability gates, and all edge terminals.
4. **Larger-cube composition**
   - reuse corner/midge witnesses;
   - add deterministic wing/xcenter/+center witnesses;
   - verify orientation-specific 4x4 results.
5. **Worker and dialog**
   - on-demand request and cache;
   - solution rendering in the existing modal.
6. **Lettering profiles**
   - piece notation first;
   - Speffz and legacy profile;
   - custom editor after big-cube mapping conventions are confirmed.

## Verification Gate

For every emitted witness:

- replay every physical action;
- verify the final solved/terminal state is legal;
- verify each comm uses a selected buffer allowed by the analyzed settings;
- verify weak-start transitions and terminal capability gates;
- verify summed weighted cost equals the displayed component and total counts;
- verify physical witnesses are identical across notation profiles;
- cover 3x3, 4x4, and 5x5 examples plus sampled corpus states;
- test modal click/keyboard behavior and stale asynchronous requests.

No solution should be shown when these invariants cannot be established. A
partial or greedy memo must be labeled as debug output and must never appear as
the production solution.
