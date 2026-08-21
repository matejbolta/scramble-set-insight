# Logic Book

## Module Ownership

The production engine is the JavaScript code in `web/`. The handwritten
reference oracle is `python/ssi_handmade.py`, with its current outputs stored
in `baseline/`. It is frozen except for an explicitly requested deliberate
truth correction.
The former modular Python core is archived under `python/legacy/`; new floating
work must not be mirrored into it.

Production responsibilities:

- `buffer-selection.js`
  - define the canonical corner/edge buffer orders once for the UI, tracing,
    exact planner, generator, and tests
  - validate partial selections and the pseudoswap-only `UF + UB` exception
- `wide-move-translator.js` and `scrambling.js`
  - normalize moves and build exact sticker states
- `corner-tracing.js`, `edge-common.js`, `weakswap-tracing.js`, and
  `pseudoswap-tracing.js`
  - preserve canonical single-buffer tracing as an oracle and transitional
    partial-floating helper
- `cycle-model.js`
  - convert a sticker state into disjoint physical piece cycles
  - attach permutation parity, orientation sum, placements, and sticker orbits
  - reconstruct the exact sticker state from that decomposition
- `cycle-residue.js`
  - reduce physical cycles to unit-weight edge/corner residue types
  - hold the complete closed-atom and corner-parity-terminal catalogs
  - solve residue multisets by exact memoized partitioning
  - hold the generated exact Pareto frontiers for every full-cube oriented
    permutation class
  - hold separate generated UFR-rooted classic parity, LTCT, T2C, and
    corner-floating-parity prefix frontiers
  - hold generated exact selected-buffer Pareto frontiers, keyed by physical
    cycle color/charge class and selected-buffer count
  - hold separate generated exact post-entry edge-terminal prefix frontiers
    with `UF` and `UR` rooted for `2E2E`, `F2E`, and `FF2E`
- `cycle-residue-planner.js`
  - calculate the exact full-floating minimum for orientation weights `>= 1`
  - calculate exact pseudoswap and weakswap minima for supported ordered
    partial/full corner/edge buffer selections
  - calculate singleton weakswap directly from the parity-relative physical
    cycles and the special UF/UR closure residue
  - run the dedicated human UF/UR weak start phase for every partial/full weak
    plan before consulting a floating frontier
  - use the parity-relative edge goal
  - optimize all enabled terminal families with independent runtime weights
- `dlin-planner.js`
  - retain the older concrete selected-buffer search as a historical/debug
    reference; it is no longer a production counting route
- `finalizing.js`
  - route singleton `UFR` corners through exact selected-buffer counting
  - route singleton `UF` pseudoswap edges through exact selected-buffer
    counting while routing singleton weakswap through exact physical-cycle
    counting
  - route full and partial floating at every supported weight through the
    method-appropriate exact planner
  - route weak floating through its exact weak-entry/product-frontier planner
  - build aggregate and per-scramble results

## Production Counting Modes

The production counting routes are:

- singleton `UFR` corners use exact weighted selected-buffer class counting
- singleton `UF` pseudoswap edges use exact weighted selected-buffer class
  counting; singleton weakswap edges use exact parity-relative physical-cycle
  counting validated against the canonical deterministic UF/UR state machine
- the complete corner buffer set and full pseudoswap edges use exact weighted
  anonymous class counting for ordinary states and rooted terminal frontiers
  when an advanced terminal algset is enabled
- partial pseudoswap buffer sets use exact weighted selected-buffer class
  counting
- weak edge prefixes from `UF + UR` through full floating use the exact
  UF/UR entry automaton followed by weighted rooted class counting; the user
  independently selects `None`, `2E2E`, `F2E`, or `FF2E`, plus LTEF

## Partial Buffer-Selection Contract

Partial floating represents the order in which a solver learns buffers, not an
arbitrary checkbox subset. The supported configurations are:

- corners: every non-empty prefix of
  `UFR, UFL, UBR, UBL, RDF, FDL`;
- weakswap edges: every non-empty prefix of
  `UF, UR, UB, UL, FR, FL, DF, DB, DR, DL`;
- pseudoswap edges: those same prefixes, plus exactly `UF + UB` without `UR`.

The pseudoswap exception models a solver who learned `UB` before `UR`. It does
not extend to later buffers: knowing `UL` or anything after it implies both
`UR` and `UB`. In the UI, choosing a buffer selects every required predecessor
and removes every later buffer. With `UB` as the last pseudoswap buffer, `UR`
can be toggled to enter or leave the exception.

Production input validation enforces this contract outside the UI as well.
Older saved arbitrary subsets migrate to the prefix ending at their furthest
known buffer; a saved exact `UF + UB` pseudoswap selection keeps the exception.

## Cycle, Segment, And Permutation Parity Terminology

These three parity concepts must always stay explicitly separated:

- **odd/even physical cycle** refers to the number `k` of physical pieces in
  one permutation cycle;
- **odd/even segment** or **odd/even target count** refers to the number of
  traced targets in one buffer segment;
- **odd/even permutation state** refers to the parity of the complete piece
  permutation, or of an explicitly named relative state/class.

A trace segment has the opposite parity from its physical cycle because an
internal buffer produces `k - 1` targets and an external buffer produces
`k + 1` targets. Therefore:

- a 3-piece odd physical cycle produces an even segment with 2 or 4 targets;
- a 4-piece even physical cycle produces an odd segment with 3 or 5 targets.

The permutation parity contributed by a physical `k`-cycle is likewise
`(k - 1) mod 2`, so it is also opposite the physical-cycle length parity. For
example, a 3-piece odd physical cycle has even permutation parity, while a
4-piece even physical cycle has odd permutation parity.

Never use bare “odd cycle” or “even cycle” for target-count parity. When code
or prose says `odd_segment` / `even_segment`, it means target-count parity.
When it says odd/even permutation, it must name the state, class, or physical
cycle permutation parity being described.

DLin does not greedily choose a cycle break while walking one long memo. It:

1. decomposes the complete state into disjoint physical cycles;
2. records every cycle's permutation parity and orientation;
3. considers each allowed buffer inside that cycle;
4. also permits an in-place selected buffer, including a twisted/flipped one,
   to act as an external buffer for another cycle;
5. chooses the globally cheapest combination after all cycles are known.

The old DLin search is memoized by virtual sticker state, remaining physical
cycles, and open-segment parity. Its cycle discovery remains useful, but its
generic odd-segment pricing is not the correctness model for exact floating.
It is retained only as a historical/debug comparison.

### Sandwiching

Sandwiching is a direct consequence of the cycle model, not a special-case
string pattern. If a physical cycle is traced from an external buffer, its memo
contains entry and exit copies of the same cycle sticker. For example:

- external `Q`: `B I Z B` costs two algs;
- internal `B`: `I Z` represents the same physical cycle and costs one.

For a physical cycle of `k` pieces:

- an internal buffer produces `k - 1` targets;
- an external buffer produces `k + 1` targets.

The planner enumerates both when legal, so the sandwich saving falls out of the
normal optimization.

### Final Two Edges

The cycle model does not need a procedural guard for the final two unresolved
edges:

- swapped edges form one length-2 permutation cycle;
- flipped edges form two oriented length-1 cycles.

That classification is made from the decomposed state before a tracing choice
is made.

## Cube Basics

A Rubik's Cube has 6 faces:

- `U` = up
- `D` = down
- `L` = left
- `R` = right
- `F` = front
- `B` = back

Standard move notation:

- `U` means rotating the `U` face clockwise.
- `U2` means rotating the `U` face by 180 degrees.
- `U'` means rotating the `U` face counterclockwise.
- `U'` is equivalent to doing `U` three times.

Wide moves follow the same suffix logic:

- `Uw`
- `Uw2`
- `Uw'`

## Centers And Wide Moves

With normal face turns only, centers are stationary. They never change relative to the cube model.

Wide moves are different: they rotate a face together with the adjacent middle slice, so they also cycle 4 centers.

Examples:

- `Uw` / `Dw` cycle all centers except `U` and `D`
- `Fw` / `Bw` cycle all centers except `F` and `B`
- `Lw` / `Rw` cycle all centers except `L` and `R`

This matters because the app mostly assumes a fixed cube orientation, but wide moves temporarily break the "centers are stationary" simplification.

## Piece Counts

The cube has:

- 6 centers
- 12 edges
- 8 corners

Sticker counts:

- centers: `6 * 1 = 6`
- edges: `12 * 2 = 24`
- corners: `8 * 3 = 24`

Total stickers:

- `6 faces * 9 stickers = 54`

## Sticker Terminology

A "sticker" means one colored facelet on one piece.

- A center has 1 sticker.
- An edge has 2 stickers.
- A corner has 3 stickers.

This project models cube state at sticker-location level, not only at piece level.

## Edge Sticker Representation

Each edge sticker is represented by a 2-letter code.

The letters are the two faces that meet at that edge location, and the first letter tells us which sticker on that edge we are pointing to.

Examples:

- `UF` = the sticker on the `U` side of the `UF` edge
- `FU` = the sticker on the `F` side of the same physical edge

Important consequence:

- `UF` and `FU` are the same edge piece
- but they are two different stickers

There are 24 valid edge stickers total.

The impossible opposite-face combinations do not exist:

- `UD`, `DU`
- `LR`, `RL`
- `FB`, `BF`

## Corner Sticker Representation

Each corner sticker is represented by a 3-letter code.

The three letters name the corner location, and the first letter tells us which face sticker we mean.

Examples:

- `UFR` = the sticker on the `U` side of the `UFR` corner
- `FUR` = the sticker on the `F` side of the same physical corner
- `RUF` = the sticker on the `R` side of the same physical corner

Important consequence:

- `UFR`, `FUR`, and `RUF` are one physical corner piece
- but they are three different stickers

There are 24 corner stickers total, corresponding to 8 physical corners.

## Standard Solved Orientation Used In This Project

The solved color scheme used here is:

- `U` = yellow
- `D` = white
- `L` = orange
- `R` = red
- `F` = blue
- `B` = green

Example:

- `RU` means the red sticker on the red-yellow edge.

## State Representation

The cube state is represented with dictionaries:

- one dictionary for edges
- one dictionary for corners

Centers are not part of the main state dictionaries because the model usually assumes fixed orientation, except where wide-move handling is needed conceptually.

### Edge State Dictionary

Keys:

- all valid 2-letter edge sticker locations

Values:

- the actual sticker currently occupying that location

Interpretation examples:

- `'UF': 'UF'`
  - the yellow-blue edge is solved in place, and the `U` sticker is on `U`
- `'UF': 'FU'`
  - the blue-yellow edge is in the `UF` position but flipped
- `'UB': 'UR'`
  - the yellow-red edge is currently sitting in the `UB` location, with its `U` sticker on top

So:

- keys describe locations
- values describe which sticker is currently there

This is a sticker-location permutation model, not just a piece-position model.

### Corner State Dictionary

Keys:

- all valid 3-letter corner sticker locations

Values:

- the actual sticker currently occupying that location

Interpretation example:

- `'UFR': 'RUB'`

This means:

- at the `UFR` location, the sticker currently on the `U` face belongs to the corner whose sticker identity is `RUB`
- in piece terms, the red-yellow-green corner is occupying the `UFR` slot, with a specific orientation

The same general rule still holds:

- keys are sticker locations
- values are sticker identities currently occupying those locations

## Corner Tracing Model

Legacy corner tracing is built around one active buffer:

- corner buffer piece: `UFR / RUF / FUR`
- primary pointer used for tracing decisions: `UFR`

Production floating supports a selected set of corner buffers.

The standard floating order is:

- `UFR`
- `UFL`
- `UBR`
- `UBL`
- `RDF`
- `FDL`

This buffer order is part of the logic, not an arbitrary UI detail.

The legacy non-floating corner pipeline is:

1. Build scrambled corner state.
2. Identify non-buffer corners that are already solved.
3. Identify non-buffer corners that are twisted in place.
4. Exclude those solved and twisted pieces from tracing.
5. Trace the remaining pieces from the buffer until every non-buffer corner is either traced, solved, or twisted.

So legacy tracing is not trying to "solve everything".
It only traces the non-buffer, non-solved, non-twisted corner pieces.

## Solved And Twisted Corners

For corners, the code checks solved/twisted status using the canonical U/D-facing sticker pointers of non-buffer corners.

Solved corners:

- a corner is treated as solved if its canonical U/D sticker points to itself

Twisted corners:

- a corner is treated as twisted if the correct physical piece is in its own slot
- but the stickers are rotated within that slot

Twisted corners are handled separately later for alg counting, so they are removed from the active tracing problem before tracing begins.

## Corner Need-Visiting List

Before tracing starts, the code defines a list of all stickers on all non-buffer corners.

That list has length `7 * 3 = 21`, because:

- there are 8 total corners
- 1 of them is the buffer piece
- the remaining 7 corners each have 3 stickers

Then:

- every solved non-buffer corner removes its 3 stickers from this list
- every twisted-in-place non-buffer corner also removes its 3 stickers from this list

What remains is the active unresolved corner set for tracing.

## Corner Trace Log

The production implementation does not mutate the scrambled corner state directly while tracing.

Instead, it keeps:

- the original scrambled corner state fixed
- a trace log, which records tracing events in order

Each trace-log entry records:

- which buffer was active
- which target was traced from that buffer

So internally the trace log is not just a flat target list.
It is a sequence of `(buffer, target)` tracing decisions.

## Virtual Corner State

Even though the scrambled state remains fixed, tracing still needs to know what would currently be sitting in the buffer after the already-recorded targets have been solved.

To do that, the production core constructs a virtual corner state from:

- the original scrambled state
- the trace log accumulated so far

This virtual state is not stored as the real cube state of the scramble.
It is only a derived working view used to answer:

- what piece is currently in the buffer
- whether the buffer piece is currently back in its own slot

So the implementation has shifted from:

- mutating the main tracing state directly

to:

- keeping scrambled state fixed
- deriving virtual progress state from the log of previous tracing decisions

This is an important foundation for future floating-buffer work.

## Floating Corner Buffers

The production core supports floating-capable corner tracing.

That means:

- tracing does not have to remain on one fixed corner buffer forever
- if the current buffer becomes solved while unresolved corner work still remains
- tracing can continue from the next allowed buffer in the standard buffer order

The currently supported backend selection model is:

- single-buffer mode, which preserves old `UFR`-only behavior
- a selected canonical prefix of known buffers
- `all` buffers, meaning the full standard floating list above

Every selection must include `UFR`. Partial floating chooses how far through
the learning order buffers are available after the primary cycle closes; it
does not choose a different starting buffer.

## Floating Choice

The old greedy floating engine moved only when its current buffer was exactly
solved. That rule missed legal opportunities when the buffer was twisted or
flipped in place and was also the source of the special pseudoswap closure
guard.

The exact selected-buffer planners replace that procedural decision for both
edge methods. A legal comm generator is any oriented physical 3-cycle
whose three pieces include at least one selected buffer piece. A selected
piece may therefore be used internally or as an external buffer even when its
orientation is being handled elsewhere in the global plan. The planner prices
all legal comm and 2-flip/2-twist paths before choosing the minimum; it never
applies a greedy "twisted/flipped means cycle break" rule.

Here a floating 2-flip/2-twist acts on two orientation-only pieces that are
already in their physical slots. An orientation-open permutation cycle remains
`PF` or `P+ / P-`; it is not silently reclassified as two in-place flips or
twists. This is the same distinction used by the F2E/FF2E terminal definitions.

The older DLin planner makes a related global choice with a larger
virtual-state search, but remains only as a historical/debug comparison.

## Corner Trace Segments

For floating analysis, a flat target list is not rich enough.

Why not:

- floating changes which buffer is active during tracing
- the target-count parity of each individual segment matters
- two odd segments can later be paired together

Because of that, the legacy and historical DLin paths also build **corner
trace segments**. Exact full and partial counting return a class minimum
instead; they do not pretend that an arbitrary segment list is the optimized
memo.

Each segment has:

- one active buffer
- the ordered target list traced from that buffer before switching away

Conceptually:

- `[{buffer: 'UFR', targets: [...]}, {buffer: 'UFL', targets: [...]}]`

The legacy flat corner list still exists, but it is now derived by flattening these segments.

So:

- disjoint piece cycles are the primary floating-aware model
- segments are the chosen DLin execution plan
- the flat target list is compatibility/debug output
- exact selected-buffer results intentionally have no segment/target path

## Cycle Breaking In Corner Tracing

If the current virtual buffer contains a non-buffer piece:

- that piece becomes the next target
- its whole piece group is removed from the need-visiting list
- the target is appended to the trace log

If the current virtual buffer piece is back in its own slot while unresolved pieces still remain:

- tracing performs a cycle break
- the first unresolved sticker in the need-visiting list is used as the next target
- that target is appended to the trace log

In the current non-floating implementation, cycle breaking still happens from the same primary corner buffer logic.

In the global floating planners, every physical cycle is known before
cycle-break choices are finalized. An external cycle break is one candidate
action in the search; it is not an automatic fallback selected by a greedy
walk. Partial pseudoswap uses the exact selected-buffer class graph; partial
weakswap uses the exact UF/UR-rooted weak-floating class graph described below.

## Corner Comm Interpretation

Corner tracing output is interpreted in pairs from the active buffer.

Example:

- from buffer `UFR`, targets `BDL RDF`

This corresponds to one 3-cycle commutator:

- `UFR -> BDL -> RDF -> UFR`

That is why corner alg counting later uses the length of the target list in pairs.

If the corner target list has odd length:

- the scramble has corner parity
- and parity is handled separately later in the pipeline

That description is fully correct for a single fixed buffer, but floating requires one extra layer:

- parity is no longer determined from one global flat target list
- parity is determined from the parity of the traced segments

## Even And Odd Corner Segments

For one segment:

- if its target count is even, that segment is closed
- if its target count is odd, that segment is open

This matters because a comm solves targets in pairs from the active buffer.

So:

- even-length segment -> can be completed inside that buffer trace
- odd-length segment -> cannot close by itself

## Exact Selected-Buffer Optimization Logic

Partial pseudoswap keeps the selected and non-selected physical pieces
distinct. Every permutation cycle is represented by a cyclic `B/N` necklace:

- `B` means a selected buffer piece;
- `N` means a non-selected piece;
- the record also retains cycle length and total orientation charge.

Cycle order is irrelevant, but cyclic order inside each necklace is not.
Odd-permutation corner states add a third mark, `P`, for the primary `UFR`
piece. This rooted class is what makes ordinary parity, LTCT, and T2C
eligibility physical rather than guessed from an anonymous residue.

The class graph is generated exhaustively from every legal selected-buffer
3-cycle and every legal 2-flip/2-twist step. Each state stores the complete
nondominated `(comm algs, orientation algs)` frontier, so production minimizes
`comms + weight * orientations` exactly for every finite weight `>= 1`.
Relabeling pieces shows that only the number of selected pieces changes the
graph; the actual chosen buffer identities are encoded by the `B/N` necklace
at lookup time. Production therefore stores one generated table per selected
count, not one table for every physical selection. Forcing canonical prefixes
does not reduce these tables further: they were already count-indexed. The
pseudoswap `UF + UB` exception reuses the ordinary two-selected-buffer table;
it needs no additional frontier catalog.

The ordinary reachable class counts are:

- corners for 1 through 6 selected buffers: `428, 892, 1328, 1523, 1328, 140`;
- edges for 1 through 10 selected buffers:
  `988, 2574, 5000, 8029, 10498, 11553, 10498, 8029, 5000, 302`.

For odd-permutation corner states rooted at UFR, the counts for 1 through 6
selected buffers are `416, 1490, 3093, 4317, 4317, 416`. The same rooted graph
is seeded separately for classic parity, LTCT, T2C, and corner-floating-parity
finishes.

When at most two physical pieces are outside the selectable buffer set, every
physical triple necessarily contains a selected buffer. The `B/N` distinction
then disappears and the endpoint is exactly the existing full-floating class
model. Exhaustive tests verify all 302 edge, 140 ordinary corner, and 416
rooted corner endpoint frontiers against that older implementation.

Production embeds the generated tables in `cycle-residue.js`. Regenerate the
ordinary selected-buffer and corner-terminal catalogs with
`node scripts/generate-selected-buffer-frontiers.js --write`, the full rooted
corner-terminal catalog with
`node scripts/generate-weighted-class-frontiers.js --write`, and the rooted
edge-terminal catalog with
`node scripts/generate-weakswap-floating-frontiers.js --write`. The last
generator also supports per-prefix checkpoints for long runs. Do not edit any
generated block by hand.

With all named corner and edge terminal frontiers embedded, the resulting
engine file is about 22.06 MB raw and 1.94 MB gzip. The browser page does not
parse the engine on the main thread; only `worker.js` imports it. On the August
2026 development machine, a fresh Node process parsed the module in about
0.40 seconds. Warm 10k full-buffer runs took roughly 0.54-0.57 seconds for
pseudoswap, 1.30 seconds for weak `None`, 1.35 seconds for weak `2E2E`, 1.42
seconds for weak `F2E`, and 1.56 seconds for weak `FF2E`; enabling LTEF as well
raised the measured run to about 2.57 seconds. These figures are development
snapshots rather than browser performance guarantees.

### Deferred Partial-Table Loading

If partial floating remains a rarely used mode, split the generated ~5 MB
selected-buffer catalog out of `cycle-residue.js`, for example into
`selected-buffer-frontiers.js`. Keep the class-key, selection logic, and small
selected-count-1 frontiers in the always-loaded core. `worker.js` should then
load the selected-count-2-and-up table module with `importScripts(...)` only
immediately before the first partial analysis and remember that it is loaded
for later requests in the same worker. `UF/UFR` and full-floating requests
would avoid downloading/parsing the large partial catalog; the first partial
request would pay the one-time load, after which the browser cache and worker
RAM would retain it.

This is a packaging/loading refactor only. It must not change class keys,
frontiers, algcounts, or the generated-table oracle. The generator should write
the new data-only file, and the extension engine layout/sync list must be
updated because it currently mirrors exactly twelve engine files.

The transitional DLin result is not an oracle for this migration. On the
stored 10k set with `UFR+FDL / UF+DL`, weight 1 and no Advanced finish, exact
minus DLin totals were `-1: 27`, `0: 7744`, `+1: 2083`, `+2: 146`. The higher
exact cases expose the old generic odd-segment undercount; the 27 lower cases
are floating opportunities the old search missed.

### Singleton Truth Correction And Cutover

The August 2026 deliberate truth decision corrected the handwritten rule for
three equal-direction twists: each complete `t+t+t` or `t-t-t-` block costs
two algorithms. With only fixed `UFR`, each such block has a frontier of two
2-twist algorithms or three UFR commutators; at equal weighted cost the exact
planner prefers fewer twist algorithms. The known two-comm solution is a
floating-buffer option, not a legal fixed-`UFR` route. Any residual one or two
non-buffer twists continue through the ordinary singleton and LTCT rules.

Regenerating both stored 10k fixtures changed exactly 60 values by `-1` and
left 9940 unchanged for each edge method. Production now routes singleton
`UFR` corners through the exact selected-buffer planner for both edge methods,
and singleton `UF` edges through it for pseudoswap. Singleton weakswap edges
use the reviewed physical-cycle reduction of the deterministic UF/UR state
machine. Both production methods match all 10,000 corrected stored results.
The independent audit is `node scripts/compare-selected-buffer-singleton.js`.

## Full-Floating Optimization Logic

Full floating does not price anonymous odd trace segments. Each physical cycle
is reduced to a base comm count and one typed residue:

- edges: `F`, `P`, or `PF`
- corners: `T+`, `T-`, `P0`, `P+`, or `P-`

The residue multiset is then partitioned through the complete IRL-validated
atom catalog. This distinction is essential: two oriented corner 2-swaps are
`P0 + P0` and cost two algs. The old rule that every pair of odd segments saves
one would incorrectly price them at one.

Sandwiching remains valid, but now follows from selecting an internal buffer
for a physical cycle rather than from a blanket segment-parity discount.

### Weighted Full Floating

The unit residue catalog remains the domain explanation and the weight-1
oracle, but a unit-optimal scalar route cannot simply be repriced. A longer
physical cycle can have two tied unit routes such as `(1 comm, 1 orientation
alg)` and `(2 comms, 0 orientation algs)`; at weight `1.1`, the latter wins.
Reducing the cycle to `base + residue` too early loses that alternative.

For exact weighted counting, every even-permutation state conjugacy class is
therefore keyed by its sorted physical `(cycle length, orientation charge)`
records. An exhaustive graph over every legal full-buffer 3-cycle and every
2-flip/2-twist generator produces the complete nondominated frontier:

```text
(comm algs, orientation algs)
```

There are exactly 302 reachable even-permutation edge state classes and 140
even-permutation corner state classes. Production stores their generated
frontiers and minimizes
`comms + weight * orientations` for any finite weight `>= 1`.

Odd-permutation corner states also need to retain UFR's physical role. They use
a second class key: the physical cycle containing UFR is marked as the root,
while all other physical-cycle records remain unordered. Exactly 416 such
rooted classes are reachable.
For each rooted class, production stores separate exhaustive Pareto prefix
frontiers for classic parity, LTCT, T2C, and corner-floating parity. Each
search is seeded from every legal physical finish state with zero prefix cost;
the chosen terminal's runtime weight is added afterward. This preserves the
best comm/orientation tradeoff without generating a table for each numeric
weight, and guarantees that an eligible LTCT, T2C, or floating-parity route is
not lost.

## Corner Parity Under Floating

In full-floating residue mode corner parity is the exact physical piece
permutation parity from `cycle-model.js`. A parity-open corner residue partition
ends in one of the seven validated parity terminals. Parity execution remains
part of the corner count.

The executable parity algset is physical, not anonymous: every parity alg does
the `UF / UR` edge 2-swap together with a `UFR / XYZ` corner 2-swap. Therefore
a bare typed `P0` is only a one-alg finish when UFR is one of its two physical
corner pieces. If it is not, the planner must first link/reduce to a state whose
last corner swap contains UFR. The seven typed parity terminals are lower-bound
shapes; production evaluates the exact distance to all 21 legal UFR parity
finish states before adding the final parity alg.

Corner-floating parity replaces the UFR-specific corner swap with any oriented
corner 2-swap. For a partial prefix, at least one of those two physical corners
must be among the selected buffers. With the complete prefix, learning the
last `FDL` buffer additionally includes the exceptional `DBR-DBL` swap even
though neither of those corners is itself a buffer.

The corner permutation parity is also the parity used to construct the edge
goal. With parity, the edge goal is cross-solved at `UF / UR`; without parity,
it is the ordinary solved edge state. Therefore the edge residue planner sees
an even relative permutation and parity execution remains in the corner count.

## Edge Tracing Model

Edges use the same sticker-location dictionary idea as corners, but with 2 stickers per piece instead of 3.

In the current backend there are still two edge methods:

- `weakswap`
- `pseudoswap`

Both methods share the same primary physical buffer:

- `UF / FU`

But they treat the `UF` and `UR` subsystem differently.

## Pseudoswap Logic

`pseudoswap` assumes corners are traced first.

That means corner parity is already known before edge tracing begins.

So:

- if the corner permutation is even, the edge permutation is also even
- if the corner permutation is odd, the edge trace will also have a parity
  remainder

`pseudoswap` handles this by reinterpreting the solved frame around `UF` and `UR`.

Conceptually:

- the `UR` piece becomes the effective edge buffer piece
- the `UF` piece is treated as solved in `UR`

This parity-aware reinterpretation guarantees that the edge target list becomes even in the non-floating `pseudoswap` model.

More explicitly, the floating implementation now follows this solved frame:

- if `parity = False`
  - `UF:UF`
  - `UR:UR`
  - `FU:FU`
  - `RU:RU`
- if `parity = True`
  - `UF:UR`
  - `UR:UF`
  - `FU:RU`
  - `RU:FU`

So for `pseudoswap`, a `UF/UR` closure is only considered solved if it matches the correct parity-dependent solved frame.

When `pseudoswap` traces through the `UF/UR` subsystem, target orientation must also follow the pseudo-solved frame:

- `UF` targets `UR`
- `FU` targets `RU`

This is especially important when `parity = True`: if the `FU` sticker appears in `UF`, it must be sent to `RU`, not `UR`, otherwise the `UF` piece ends up flipped in the pseudo-solved `UR/RU` slot.

## Weakswap Logic

The following is the canonical `UF`-only weakswap behavior. `weakswap` traces
edges before corners.

So corner parity is not known yet when edge tracing starts.

Because of that, it cannot use the same parity-aware solved-frame reinterpretation as `pseudoswap`.

Instead, it temporarily treats the `UF / UR` subsystem as a flexible double-buffer situation.

High-level idea:

- tracing starts normally from `UF`
- whichever of the `UF` or `UR` physical pieces is encountered first is
  settled into `UR`
- encountering the second member of the pair is treated as returning to the
  buffer; if unresolved cycles remain, tracing cycle-breaks according to the
  common edge order

The first encounter is orientation-aware:

- `UR` traces to `UR`
- `RU` traces to `RU`
- `UF` pseudo-solves to `UR`
- `FU` pseudo-solves to `RU`

If the final traced target count later turns out odd:

- `UR` or `RU` is appended at the end
- which closes the trace and captures the parity interaction

If the final target count is even, nothing is appended. In short, `UF` and
`UR` temporarily count as the same destination; final target parity completes
the choice without requiring corner parity in advance.

This is why `weakswap` can save one alg in roughly half of odd-target-count
cases:

- if the parity piece `UF` is encountered before `UR`
- it can be absorbed into the `UR` position early
- and that avoids one otherwise wasted resolution later

There is a narrow exception where singleton `weakswap` costs more than
singleton `pseudoswap`. In the parity-relative solved frame, the physical piece
that belongs in `UR` is flipped in that slot and another flip is available.
Depending on where the shared destination closes in the deterministic trace,
`pseudoswap` can leave those orientations for one floating 2-flip while
`weakswap` is forced through `UR` and resolves the other flip separately. At
unit weight this costs two algorithms instead of one. The local flipped `UR`
condition alone is not sufficient: some such states leave `UR` pending until
the end, where `weakswap` correctly recognizes the same 2-flip. Tests therefore
lock both variants instead of applying a blanket penalty.

Across the stored 10k singleton `UF / UFR` corpus at unit weight, the methods
tie on 9,879 scrambles and `weakswap` is exactly one algorithm higher on 121;
there are no other deltas.

Production does not replay that sticker-by-sticker trace. It uses the
equivalent exact physical-cycle reduction after constructing the
parity-relative edge state:

1. Every nontrivial cycle containing `UF` contributes `k - 1` targets.
2. Every external nontrivial cycle contributes `k + 1` targets.
3. If `UR` contains the correctly placed flipped piece and at least one
   external permutation cycle exists, deterministic weak closure contributes
   two additional targets.
4. Otherwise that flipped `UR` survives to the end and counts as a flip.
5. Other flips are the oriented 1-cycles outside `UF / UR`.

The final count is therefore
`targets / 2 + floor(flips / 2) * flip_weight + flips mod 2`. The canonical
state machine remains an independent oracle: tests compare its target and flip
counts separately against the cycle reduction on all 10,000 stored scrambles.

An exhaustive compact-state audit additionally enumerated 243,852 distinct
cycle classes in both physical parity frames, for 487,704 states total. `UF`
and `UR` remained separately marked while the other ten edges were canonically
relabeled; every legal even permutation and even edge orientation was covered.
The cycle reduction and canonical tracer matched in target count, flip count,
forced-UR-break status, and UR-survives-as-flip status with zero mismatches.
Therefore the key invariant is exhaustive, not empirical:

    forced UR break
    iff correct UR is flipped and an external permutation cycle exists

### Exact Weak Floating Beyond UF

Weak floating still solves against the same parity-relative edge goal, but it
does not become pseudoswap counting. `UF` and `UR` remain distinguished roots
because every weak correction uses that physical pair.

The parity-relative state is only the mathematical representation of the edge
goal. It does not by itself authorize a comm from `UR` or any later buffer.
Every weak plan is the product of two exact phases:

1. A dedicated physical `UF / UR` weak start state machine starts the trace.
   It tracks target parity, root orientation, and whether the shared weak
   destination is filled. It preserves the proven singleton invariants where
   they apply, but also contains the explicitly legal multi-buffer F2E and
   FF2E entry transitions.
2. The selected-buffer DP becomes available only after that state machine
   reaches a legal weak entry. From there the rooted post-entry frontier may
   use the selected buffer comms, floating 2-flips, and the enabled terminal
   algsets.

An ordinary weak entry occurs after a complete target pair. A misoriented root
may instead remain open only when its exact terminal family is known. The start
phase explores every legal cycle-break sticker and every later legal closure,
so this is an exact optimization rather than the old fixed cycle-break order.
In particular, when neither root initially occupies the UF/UR destinations,
meeting the first root on an even oriented closure immediately authorizes a
float from UR. Meeting it even and misoriented authorizes the analogous open
route only with F2E; an odd encounter is first solved into UR/RU and tracing
continues in the corresponding occupied-destination state.

The singleton path always remains a candidate. Consequently adding floating
buffers can never make weak counting worse than singleton weak, but weak is
not bounded above by pseudoswap. In particular, the proven invariant remains
active for every prefix:

    correct UR flipped + external permutation cycle
    => forced UR break

`None` and normal `2E2E` cannot use a flipped or otherwise misoriented root as
a floating entry. They must keep tracing the weak phase until an ordinary
entry exists or finish by the singleton path. This is why `weak None` cannot
reuse the pseudo frontier on the original state.

`F2E` permits the corresponding UF-slot-flipped open root. `FF2E` includes
F2E and additionally permits the UR-slot-flipped open root; that route may
shoot to any legal selected buffer, not merely the next deterministic buffer.
The post-entry DP must eventually close the retained root with the matching
terminal family. `UF + UR` alone has no third buffer into which an open root
can float. Literal one-alg terminal states remain directly executable and need
no artificial preceding switch.

After a legal entry, `UR` remains special when a final odd residue overlaps the
weak correction:

```text
(UF UR) + (UR X) = one UF-UR-X comm
```

From the third selected buffer onward, floating may use the UF–UR subset of
`2E2E`. If a final floating buffer `B`
leaves target `X`, an oriented weak closure is

```text
(UF UR) + (B X)
```

and is one `2E2E`. Both component 2-swaps are orientation-closed `P`
residues, but the learned anchor subset is sticker-specific. Its anchor is
literally `UF-UR-UF`, with the automatically equivalent companion orbit
`FU-RU-FU`. The distinct charge-zero swap `UF-RU-UF` (equivalently
`FU-UR-FU`) is not in this subset. Consequently, matching physical pieces and
cycle charge is not sufficient: the exact planner also retains which sticker
frame connects the rooted `UF` and `UR` pieces.

For a partial prefix, `B` must be one of the selected non-primary buffers; the
other piece `X` may be anywhere. Equivalently, at least one physical piece of
the floating 2-swap must occur in the selected prefix after `UF, UR`. Full
floating has one explicit learned exception: the `BR-BL` floating swap is also
available even though neither physical piece is in the canonical buffer list.

`F2E` and `FF2E` are two different rooted `PF + PF` families. Production keeps
them separate. The four user-facing edge capability levels are consequently:

- none: dedicated weak entry followed by ordinary exact selected-buffer comms
  and floating 2-flips, without a weak terminal algset;
- `2E2E`: the same entry rules plus normal UF–UR `2E2E` terminals;
- `F2E`: the previous level plus the family whose rooted flipped swap has the
  edge in the `UF` slot flipped;
- `FF2E`: the previous level plus the family whose rooted flipped swap has the
  edge in the `UR` slot flipped.

The fourth root form, in which both swapped UF/UR edges are flipped, belongs to
none of these algsets. A mixed `P + PF` is orientation-open and is likewise not
a closed terminal.

Human limits such as one-pair backtracking and skipping long sandwiches remain
practical memo heuristics, not counting constraints. The entry automaton
permits unlimited legal cycle-break search. The post-entry exact DP permits
unlimited legal linking and backtracking. `2E2E`, `F2E`, and `FF2E` are still
final algorithms only: none is a graph transition that may split a cycle and
then continue. The exact suffix search stores a separate reverse frontier for
each legal terminal family, seeded at zero prefix cost. Runtime selection adds
that family's configured terminal weight only after the best prefix is known.

The suffix compact key marks physical `UF` as `U`, physical `UR` as `R`, other known
buffers as `B`, and unavailable buffers as `N`, then records each physical
cycle's length and net edge-orientation charge. When both roots occupy the same
physical cycle, it additionally records the orientation phase transported from
the literal `UF` sticker to the `UR` piece. That extra bit distinguishes
`UF-UR-UF` from `UF-RU-UF`; total cycle charge alone cannot. Full weak floating
is the final ten-buffer prefix of this same entry-plus-rooted model. `None`
uses the pseudo-shaped suffix frontier only after a legal weak entry; it never
uses that frontier as a replacement for the entry state machine.

Floating 2-flips retain their independent user weight `>= 1`. Each terminal
algset has its own runtime weight in `[1, 2]`; the generated Pareto tables store
only `(prefix comms, orientation algs)` and therefore do not multiply table
size by the number of numeric weights.

For full floating, learning the final `DL` buffer includes the `BR-BL`
terminal exception for `2E2E`, `F2E`, and `FF2E`. The pseudoswap-only
`UF + UB` selection disables all three algsets because that learning path does
not imply `UR`-rooted alg knowledge.

`LTEF` is a separate, independent weakswap-only capability. It has no learning
implication in either direction with `2E2E / F2E / FF2E`. In the no-parity
frame, its exact terminal state is a charge-one physical 3-cycle containing
`UF`, `UR`, and an
arbitrary third edge `X`, with the `UF` piece oriented in the `UR` slot, plus
one flipped 1-cycle `F`; the other eight edges are solved. After tracing the
single non-root target `X`, the charge-one condition forces the no-parity
closure sticker to be `RU`, not `UR`. Without LTEF the combined state costs two
ordinary commutators; LTEF solves it in one algorithm. LTEF is available for
singleton, partial, and full weakswap, and neither `X` nor `F` has to belong to
the selected-buffer prefix. On parity states the `UF/UR` roles reverse in the
usual way.

LTEF is not restricted to a state that is already terminal before execution.
It may be the last algorithm after any legal weak prefix. Singleton counting
therefore searches the same physical UF/UR weak-start automaton for an LTEF
endpoint before comparing `prefix comms + LTEF weight` with the ordinary
physical-cycle price. A direct initial LTEF check alone is insufficient: for
example, the relative state `UR<-UB, UB<-UL, UL<-RU` plus flipped `FR` reaches
LTEF after the one comm whose targets are `UR, UB`.

### Deferred Cross-Component Parity Terminals

Two future parity algsets terminate edges and corners together and are
deliberately out of scope for the current component-local planners:

- `UF-X + UFR-Y` **Full Parity** swaps `UF` with any edge and `UFR` with any
  corner in one algorithm;
- arbitrary `2E + 2C` **Full Floating Parity** performs any oriented edge
  2-swap together with any oriented corner 2-swap in one algorithm.

Treat these as whole-solve terminal matches, not as independent edge and
corner algorithms charged twice. Their eventual implementation should combine
the terminal endpoints of the otherwise separate edge and corner prefix
frontiers in a small joint finishing layer. Do not build a full Cartesian
edge-by-corner action graph unless later human rules show that either algset
changes legal pre-terminal tracing.

### Deferred Larger-Puzzle And Memo Output Work

The 4x4 and 5x5 count-only MVPs are documented below. Their deterministic
center targeting, lack of wing floating, and fixed center buffers are explicit
MVP constraints rather than general claims about optimal larger-puzzle
tracing.

The app will eventually output the actual optimal memorization/tracing
sequence for 3x3, 4x4, and 5x5 under every selected setting. This is a separate
requirement from the current exact minimum count. The count-only frontier/DP
architecture does not currently retain an execution witness. A healthy
implementation reconstructs one concrete path after the minimum endpoint is
known: enumerate legal concrete actions, apply them to the physical state, and
use the embedded frontier of the resulting exact class to prove that the
required remaining Pareto label is still reachable. This is preferable to
embedding class predecessors because class keys intentionally discard some
physical identities. It must not substitute a greedy trace that can disagree
with the exact count. Weakswap reconstruction must preserve the physical
UF/UR start phase before lifting through its rooted suffix frontier.

Once a physical sticker/piece witness exists, memo lettering is a rendering
layer. It must support exact piece-notation output, Speffz, and arbitrary
user-defined lettering schemes without changing the underlying optimized
physical path. The existing `STICKER_LETTER_MAP` is a legacy custom
corner/edge profile, not a generic or Speffz mapping. The full contract,
on-demand worker flow, larger-cube composition, UI behavior, and verification
plan are recorded in `design/optimal-memo-witness.md`.

## Edge Floating Buffers

Production JavaScript supports an opt-in floating architecture for edges.

Important:

- default edge selection uses truth-compatible `UF`-only counting
- this preserves baseline parity with the original implementation
- single-buffer counting stays on the method-specific engine
- the complete buffer set uses the exact pseudo planner or the weak-entry plus
  rooted-suffix weighted planner after the parity-aware edge goal is known
- partial pseudoswap selection uses the exact weighted selected-buffer planner
- partial weakswap prefixes use the same exact weak-entry/product planner
- every selection must include `UF`; partial floating follows the canonical
  prefix order and does not replace the method's primary physical buffer
- pseudoswap alone additionally permits exactly `UF + UB` without `UR`

The common edge buffer and cycle-break order is:

- `UF`
- `UR`
- `UB`
- `UL`
- `FR`
- `FL`
- `DF`
- `DB`
- `DR`
- `DL`

This order is shared by `weakswap`, `pseudoswap`, and the generated exact
selected-buffer frontiers. Moving `UR` before `UB` does not change the exact
`pseudoswap` minimum; it removes an unnecessary vocabulary difference between
the edge engines. The explicit two-buffer pseudoswap exception preserves the
real learning path where `UB` is learned before `UR`.

## Edge Trace Segments

Just like corners, legacy and DLin edge tracing use a segment model internally.
Exact full/partial results are counting-only and return no invented trace path.

Each segment records:

- one active edge buffer
- the target list traced from that buffer

So internally the model is again:

- `buffer -> targets`
- `buffer -> targets`

And the flat legacy target list is still derived by flattening the segments.

## Legacy Edge Virtual State

The legacy greedy floating implementation used the same virtual-log technique
as corners:

- keep the scrambled edge state fixed
- keep a trace log of `(buffer, target)` events
- derive a virtual current state from that log

This is what allows buffer switching without mutating the original scrambled state directly.

## Legacy Edge Floating Closure Rule

The following closure rules describe only the retained legacy tracer. DLin does
not use them to choose floating links.

For the legacy tracer, a generic buffer is float-closed only when the current
buffer piece is truly solved in its own slot.

If the current buffer piece is only flipped in place:

- that does not authorize floating
- the tracer performs a cycle break instead

## Special Primary UF Closure Rule

The first edge buffer is still special.

While tracing from `UF`, the backend treats the UF segment as closed if the
`UF` slot contains any of:

- `UF`
- `FU`
- `UR`
- `RU`

This reflects the special `UF / UR` subsystem behavior that both edge methods already rely on.

In floating mode that primary segment is therefore allowed to end early, and
tracing can continue from the next method-allowed buffer.

For `weakswap`, the first `UF / UR` encounter is not treated as a reason to float immediately.

It is first traced exactly like the legacy weakswap move:

- if `UF` contains `UR` or `RU`, trace to that sticker
- if `UF` contains `UF`, trace to `UR`
- if `UF` contains `FU`, trace to `RU`

That target removes the `UR / RU` piece from the pending visit list and, more importantly, virtually swaps with `UR / RU`.

The virtual swap is essential because the piece sitting in the `UR` slot becomes the next piece in the `UF` buffer. If the backend merely removed `UR / RU` and floated away, that displaced piece would become hidden from the active trace and could cause a repeating cycle-break loop later.

If only `UR / RU` remains pending while tracing from `UF`, and the current target count is even, `weakswap` treats `UR` as a flip rather than appending it as another target.

This rule belongs to the `UF` weakswap frame itself, not to legacy single-buffer mode. Therefore it still applies when additional floating buffers are selected, as long as the active buffer is still `UF`.

`pseudoswap` has the same safety requirement in a parity-dependent frame.

Even if `UF` looks solved under the current pseudo solved frame, the backend does not float away from `UF` while `UR / RU` is still pending.

It must first consume or cycle-break through that `UF / UR` subsystem so that no unresolved piece remains hidden in the paired slot.

That blocked pseudo-solved closure is a cycle-break state, not a normal trace target. In particular, when parity makes `UR` the correctly solved piece in `UF`, the tracer must not consume that `UR` as though it were an unresolved target. It cycle-breaks through the remaining pending piece and only floats once the paired subsystem is actually closed.

The same distinction applies to orientation. Under parity, both `UR` and `RU` are the in-place piece group for the pseudo `UF` frame; without parity, that group is `UF` and `FU`. A flipped-in-place pseudo buffer therefore authorizes a cycle break, but never floating and never a normal trace step.

For pseudoswap, these remain legacy tracing guards because its exact planner
may use the complete parity-relative state directly. For weakswap, the first
encounter, destination-filled state, target parity, and orientation checks are
also the mandatory entry automaton for every partial/full plan. Only the
post-entry suffix may use the rooted selected-buffer frontier.

## Edge Full-Floating Counting

After the parity-relative goal is built, every edge cycle reduces to base comms
plus `F`, `P`, or `PF`. The exact closed catalog is:

- `F F` for one 2-flip
- `P P` for two algs
- `PF PF` for two algs
- `F P PF` for three algs

There is no *mandatory* edge parity charge in this relative frame: the parity
execution is still counted with corners. The optional rooted `2E2E`, `F2E`,
and `FF2E` families described above are alternative final edge endpoints that
also realize the physical `UF-UR` correction; their final-alg costs are added
only when one of those advanced endpoints is actually selected.

## Development Debug Helpers

The production JavaScript exposes development-oriented helpers for inspecting
one scramble in detail.

`analyzeScramble(...)` returns a structured object containing:

- selected buffers
- corner segments and flat target list
- edge segments and flat target list
- odd/even segment counts
- floating savings
- flips
- twists
- LTCT adjustment
- final alg total
- whether each component used `legacy`, `dlin`, `selected-buffer`, or
  `cycle-residue` counting
- in residue mode: base cost, typed residue multiset, and selected finish
- in selected-buffer mode: selected count, orientation weight, and selected
  finish; no target path is claimed
- in DLin mode: segments with physical cycle IDs and buffer metadata

`debugHumanReviewReport(...)` renders one compact report for the same scramble with:

- corners once
- `edges weakswap`
- `edges pseudoswap`

For human verification, that report renders buffers, targets, flips, and twists in the project's custom sticker-letter scheme rather than raw sticker names.

This is the main helper for conceptual review of one scramble.

These helpers do not change the main app output.
They exist so that new floating logic can be checked on individual scrambles without manually reconstructing the entire counting pipeline.

## Counting Pipeline Structure

The final counting layer is now intentionally split into smaller helpers instead of keeping all logic inside one long function.

Current structure:

- `build_corner_breakdown(...)`
- `build_edge_breakdown(...)`
- `count_scramble_algs(...)`
- `analyze_scramble(...)`

`build_corner_breakdown(...)` is responsible for:

- corner segments
- corner parity
- corner comm count
- twist counting
- LTCT adjustment

`build_edge_breakdown(...)` is responsible for:

- edge segments
- edge parity
- edge comm count
- flip counting

`count_scramble_algs(...)` now only combines the prepared sub-results into the final tuple used by the main app.

`analyze_scramble(...)` reuses the same prepared sub-results for debug and inspection.

The displayed corner/edge split follows the execution order:

- corner algs = corner comms + twist algs + LTCT adjustment
- edge algs = edge comms + flip algs
- total algs = corner algs + edge algs

Corner comms include the unpaired parity execution. Edge tracing receives the
corner parity state and is therefore pseudo-solved for that parity before its
own alg count is calculated.

The production JavaScript result additionally exposes this split plus each
scramble's normalized move text, DNF status, 2-flip count, and 2-twist count.
DNF status is captured while parsing the original csTimer line, before its time,
comment, multiphase data, and timestamp are discarded. Disabling `Include DNFs`
still removes those records entirely; enabling it preserves the established
scramble extraction and attaches the DNF flag only to the production
per-scramble metadata.

The production parser also accepts rows copied from a WCA competition's public
scramble archive. These clipboard rows are tab-separated and may start with a
number, `Extra n`, or an optional one-letter group followed by either label. The
parser removes that table prefix only as a unit, preventing a group such as `B`
from being mistaken for the first cube move. Incomplete selected rows, such as
an empty `Extra 1` or a number without a scramble, are ignored.

For sets, the browser uses the component split in every breakdown cell, showing the total
alongside its corner and edge components. The move text lets Breakdown rows and
Compact breakdown cells reopen the exact analyzed scramble without reparsing
the input or changing the legacy result fields.

The browser exposes four independently selectable result sections, regardless
of scramble count. Overview uses the same set-level metric layout for every
scramble count. Breakdown is a semantic per-scramble table with total, corner,
edge, 2-flip, and 2-twist
columns. Compact breakdown is the dense per-scramble cell grid, and Distribution
is the alg-count chart. These display preferences are saved with the other
browser settings and can be changed without rerunning the analysis.
Breakdown and Compact breakdown show visible sequence numbers for every set
size, including sets of one through five. These stable numbers identify the
original scramble even when Breakdown is sorted by another column.

Each production per-scramble breakdown records the selected Advanced capability
(`none`, `ltct`, or `t2c`), whether an advanced finish actually applied, its
physical finish type, and how many algs it saved. The old boolean LTCT API is
still accepted and normalized to `ltct` for compatibility. T2C is exposed for
fixed UFR, partial, and full corner-buffer modes for either edge method. It is
a terminal capability and does not require knowledge of a secondary corner
buffer. Comparison baselines use
standard `UFR / UF` with Advanced set to `none`. This makes a combined corner improvement render as, for example,
`5 → 3 LTCT` or `4 → 3 T2C`, while the tag is omitted if no advanced finish
actually saved cost.

In a floating buffer mode, the production worker also counts the set with the
standard `UFR` corner and `UF` edge buffers. Each Breakdown row shows the
baseline-to-analyzed comparison for the total and for each component that was
individually reduced. Compact breakdown shows the same comparison on the main
number while its corner-plus-edge line stays on the analyzed result. Overview's
`Floating saved` metric remains floating-only: it compares standard and
floating buffers with Advanced disabled, so it does not accidentally count
LTCT/T2C savings. When an Advanced algset is selected, Overview separately
shows `LTCT saved` or `T2C saved`, which totals only the finish adjustments
across the analyzed set. The Overview
total-algs metric shows only the analyzed value because the savings metrics
already expose the aggregate comparisons. The Overview omits either savings
metric, as well as either 2-flip or 2-twist metric, when its total is zero.
These comparisons use the same parity-aware counting pipeline as the live
result and do not change the legacy result fields.

This matters because future parity work should now only need to change one breakdown layer at a time, instead of touching both the production count and the debug path separately.

## Current Understanding Check

What this model buys us:

- exact representation of permutation
- exact representation of orientation
- direct ability to detect solved pieces, flipped edges, and twisted corners by comparing key and value patterns

What matters most for future code changes:

- preserve the distinction between piece identity and sticker identity
- preserve the rule that the first letter indicates the face being pointed at
- preserve solved orientation exactly as defined above
- preserve wide-move semantics, because they are the main exception to the "centers stay fixed" simplification

## Redundancy In The Current State Dictionaries

The current implementation stores more sticker-location entries than are strictly necessary.

For edges:

- both stickers of each edge are stored as separate keys
- example: `UF` and `FU` are both present in the dictionary

In principle, only one of them would be enough, because the other is mechanically implied.

Example:

- if `UF: DL`, then `FU: LD` is forced automatically

So the edge dictionary currently stores 24 entries, even though only 12 edge locations would be enough for a more compressed representation.

For corners:

- all 3 stickers of each corner are stored as separate keys
- example: `UFR`, `RUF`, and `FUR` are all present

Again, only one representative per corner would be enough in a compressed model, because the other two stickers are implied by cube mechanics and corner orientation.

Example:

- `UFR: DFL` directly implies
- `RUF: LDF`
- `FUR: FDL`

So the corner dictionary currently stores 24 entries, even though only 8 corner locations would be enough in a more compressed representation.

This redundancy is intentional in the current implementation because it makes direct sticker-level reasoning simpler, even if it is less memory-efficient.

## Canonical Corner Sticker Ordering

Corner sticker notation has a potential ambiguity:

- `UFR` and `URF` would refer to the same sticker

To avoid that, this project uses a fixed canonical naming rule.

Rules:

- the first letter is always the face being pointed at
- the second and third letters follow a fixed order:
- `U/D` -> `F/B` -> `R/L`

Example:

- use `UFR`
- do not use `URF`

This removes naming ambiguity and guarantees one canonical name per sticker.

## Scramble Model For WMT

In the scramble world this project works with:

- most moves are normal face turns
- wide moves may also appear
- wide moves can be mixed with normal moves

Competition scrambles typically only use wide moves at the end, but the production logic is written more generally.

The translator now supports:

- any number of wide moves
- wide moves anywhere in the scramble
- arbitrary mixing of normal and wide moves

The downstream `apply_scramble(...)` logic still only knows how to execute normal face turns directly.

Because of that, the purpose of the `WIDE MOVE TRANSLATOR` section is:

- walk through the scramble left to right
- track current orientation as moves are interpreted
- remove wide moves from the scramble text
- replace them with an equivalent sequence expressed using only normal face turns

The same normalization layer accepts the center-slice notation `S`, `M`, and
`E`, including prime and double suffixes. Their definitions are deliberately
fixed in terms of already-supported wide and face moves:

```text
S  = Fw F'    S' = Fw' F    S2 = Fw2 F2
M  = Rw' R    M' = Rw R'    M2 = Rw2 R2
E  = Uw' U    E' = Uw U'    E2 = Uw2 U2
```

Whole-cube rotations are accepted at any position in scramble input. Lowercase
and uppercase spellings are equivalent. They are expanded through the same
wide-move pipeline:

```text
x  = Rw L'    x' = Rw' L    x2 = Rw2 L2
y  = Uw D'    y' = Uw' D    y2 = Uw2 D2
z  = Fw B'    z' = Fw' B    z2 = Fw2 B2
```

Thus `X`, `Y'`, and `Z2` mean the same things as `x`, `y'`, and `z2`.
Redundant half-turn primes such as `x2'` and `X2'` are normalized to the same
half turn as `x2`.

Each special token is expanded at its exact position in the scramble and both
component moves are then processed left to right. Therefore the orientation
update contributed by the wide move persists into all later moves. This is
what preserves the center/cube-rotation effect of `S`, `M`, and `E`; they must
not be reduced to a fixed pair of face turns without updating the running
orientation mapping.

A redundant prime after a half turn is accepted on face, wide, slice, and
rotation moves. For example, `R2'`, `Fw2'`, `S2'`, and `x2'` normalize to
`R2`, `Fw2`, `S2`, and `x2`; a 180-degree turn is its own inverse.

## Cube Rotations Used In WMT

Cube rotations:

- `x`, `x'`, `x2`
- `y`, `y'`, `y2`
- `z`, `z'`, `z2`

Interpretation:

- `y` keeps `U` and `D` centers fixed and cycles `F -> R -> B -> L`
- `z` keeps `F` and `B` centers fixed and cycles `U -> R -> D -> L`
- `x` keeps `L` and `R` centers fixed and cycles `U -> F -> D -> B`

These are whole-cube orientation changes.

## Wide Move = Normal Move + Rotation

For this project's logic, a wide move can be understood as:

- one normal move on the opposite face
- plus one whole-cube rotation

Canonical equivalences:

- `Uw = y + D`
- `Dw = y' + U`
- `Rw = x + L`
- `Lw = x' + R`
- `Fw = z + B`
- `Bw = z' + F`

And with suffixes:

- `Uw2 = y2 + D2`
- `Uw' = y' + D'`
- `Dw2 = y2 + U2`
- `Dw' = y + U'`
- `Rw2 = x2 + L2`
- `Rw' = x' + L'`
- `Lw2 = x2 + R2`
- `Lw' = x + R'`
- `Fw2 = z2 + B2`
- `Fw' = z' + B'`
- `Bw2 = z2 + F2`
- `Bw' = z + F'`

The production strategy is not "store explicit rotations in the scramble text".
Instead, it:

- translates the wide move into the normal opposite-face move
- updates an orientation mapping object
- uses that updated mapping to interpret all following moves

That is why the directly emitted move in code is:

- `Uw -> D`
- `Dw -> U`
- `Rw -> L`
- `Lw -> R`
- `Fw -> B`
- `Bw -> F`

The missing rotation is not ignored. It is handled by updating the running orientation mapping.

## Production WMT Architecture

The generalized production translator works like this:

1. Start with an orientation mapping from visible faces to standard/tracing-frame faces.
2. Read the scramble left to right.
3. For a normal move:
   - reinterpret its face letter through the current orientation mapping
   - emit the corresponding normal move
4. For a wide move:
   - emit the opposite-face normal move in the current orientation
   - update the orientation mapping by the corresponding whole-cube rotation

So WMT is now a true normalization layer, not a special-case suffix translator.

## Scrambling / Tracing Orientation

This section exists because the orientation from which a cube is scrambled may differ from the orientation from which the competitor later starts tracing.

Typical home use:

- scrambling orientation and tracing orientation are the same
- so `tracing_orientation` is empty

Competition use:

- cubes are scrambled from fixed orientation `white up, green front`
- compared to the project's standard solved orientation, that is `x2` away
- competitors then rotate the cube manually into their preferred tracing orientation before memo/tracing

So the app needs to account for the frame difference between:

- the orientation in which scramble notation was generated
- the orientation in which tracing is conceptually done

## Orientation Approach In The Production Core

The production core handles tracing orientation at the move-notation layer instead of by rotating the whole state dict before and after the scramble.

The current approach is:

- convert `tracing_orientation` into a move mapping
- normalize the scramble into tracing-frame normal moves
- apply that normalized scramble directly to solved edge/corner state

This is more natural architecturally because:

- orientation becomes a first-class mapping
- WMT and tracing-orientation live in the same normalization layer
- edge/corner state logic no longer needs orientation-specific state rotation helpers

## Correctness Standard

For this project, correctness is defined operationally:

- production JavaScript `UFR / UF` must match the stored handwritten truth
  exactly
- exact full-floating behavior is verified with residue catalogs, a concrete
  small-state oracle, terminal enumeration, and explicit regressions
- exact partial pseudoswap behavior is verified with an independent compact
  selected-buffer graph, embedded-frontier equality, concrete path lifting,
  weighted samples, and full-floating endpoint equality

That baseline lives in:

- `baseline/testing-10k-scrams.txt`
- `baseline/truth-weakswap.json`
- `baseline/truth-weakswap-params.json`
- `baseline/truth-pseudoswap.json`
- `baseline/truth-pseudoswap-params.json`

## Regression Scripts

The active regression scripts are:

- `tests/test_handwritten_truth.py`
- `tests/test_js_core.js`
- `tests/test_js_direct_state_expectations.js` (also loaded by the JavaScript
  core suite)

Their jobs are:

- verify the handwritten oracle still generates the stored truth
- compare production JavaScript `UFR / UF` directly with the same stored truth
- verify cycle reconstruction, legacy truth, exact residue catalogs, concrete
  atom realizations, all 302 edge and 140 corner Pareto class frontiers, all
  416 UFR-rooted classes for each named corner terminal family, weighted
  terminal distance, 10k full-floating invariants, exact weighted partial
  pseudo/weak floating, dedicated weak-start completion, capability
  monotonicity, selected-buffer suffix-oracle equality, direct physical-state
  terminal expectations, LTEF before and after legal weak prefixes, and
  targeted regressions

The archived modular Python core retains its historical test under
`python/legacy/test_ssi_core.py`, but that test is not part of production
verification.

# 4x4 MVP Model

The production 4x4 path is deliberately separate from the legacy 3x3 result
contract. It reuses the exact weighted corner planner, but owns a size-aware
physical state model for wings and xcenters.

## Pieces And Canonical Stickers

The MVP tracks three piece types:

- corners: the same 24 stickers and eight physical pieces as on 3x3
- wings: 24 physical pieces with one canonical sticker per piece
- xcenters: 24 single-color centers, four interchangeable centers per face

The canonical wing orbit is:

```text
UFr URb UBl ULf LUb LFu LDf LBd FUl FRu FDr FLd
RUf RBu RDb RFd BUr BLu BDl BRd DFl DRf DBr DLb
```

The canonical xcenters are:

```text
Ubl Ubr Ufr Ufl Lub Luf Ldf Ldb Ful Fur Fdr Fdl
Ruf Rub Rdb Rdf Bur Bul Bdl Bdr Dfl Dfr Dbr Dbl
```

An xcenter state is `location -> face color`; centers of the same face are
interchangeable. The fixed MVP buffers are `UFr` for wings and `Ubl` for
xcenters. `Ubr` is the xcenter helper used to close an odd target count.

## 4x4 Moves And Orientation

Unlike the 3x3 wide-move normalization described above, a 4x4 wide move is
executed physically as a turn of the outer two layers. Ordinary face moves,
`Uw/Dw/Lw/Rw/Fw/Bw`, and `x/y/z` (either case) are accepted. The manual inner
slice shorthands are:

```text
r = Rw R'   l = Lw L'   f = Fw F'
u = Uw U'   d = Dw D'   b = Bw B'

M = x' R L'   E = y' U D'   S = z F' B
```

Prime, double, and redundant `2'` suffixes are supported compositionally.
Whole-cube rotations update the running frame at their exact input position.

Because 4x4 has no fixed true centers, the user selects one exact corner
sticker to place at `UFR`. All 24 corner stickers are legal choices and each
uniquely determines the tracing orientation. The `Optimal` option evaluates
all 24 complete counts independently for each scramble, minimizes the total
corner + wing + xcenter count under the current settings, and uses canonical
sticker order as a deterministic tie-break.

The same size-aware model also executes the 5x5-only notation documented in
the next section.

## Corners And Wing Pseudoswap

Corners use the existing exact selected-buffer planner, including standard,
partial, and full corner floating, weighted 2-twists, classic parity, LTCT,
T2C, and corner-floating parity.

Corner permutation parity selects the wing goal. On an odd corner state the
wing goal swaps both pairs:

```text
UFr <-> URb
FUl <-> RUf
```

This is the 4x4 analogue of 3x3 pseudoswap. The wing buffer location remains
`UFr`; only the parity-relative solved goal changes.

## Deterministic Wing Counting

Wings have no orientation and no floating in the MVP. Trace from `UFr`; after
a closed cycle, break into the first unresolved wing in canonical list order.
For `n` targets:

- even: `n / 2` comms
- odd with the full `UFr-XYz` parity set: `(n - 1) / 2 + 1`
- odd basic with final target `BUr`: `(n - 1) / 2 + 1`
- odd basic with any other final target: `(n + 1) / 2 + 1`, because `BUr` is
  appended before the final `UFr-BUr` parity alg

Wing permutation parity is independent of corner parity; the corner parity
only changes the parity-relative goal above.

## Deterministic Xcenter Counting

The xcenter tracer carries the color currently at `Ubl`:

1. If the carried color is non-`U`, target an unresolved location on that
   color's face. Prefer a location currently carrying a non-`U` color, then a
   location carrying `U`; ties follow the canonical xcenter list.
2. If the carried color is `U`, fill the first unresolved U-face location.
3. Only when all U-face locations are solved may a new cycle be broken; use
   the first unresolved xcenter in canonical list order.

Solved same-color centers are skipped. If the resulting target count is odd,
append `Ubr`; the xcenter cost is therefore `ceil(targets / 2)`.

This deterministic target policy is the explicit MVP baseline. It is not yet
a global optimizer over interchangeable-center target choices, and xcenter
floating is deferred.

# 5x5 MVP Model

The 5x5 path extends the same size-aware physical model with five independently
counted components. Its result is an object with
`corner + midge + wing + xcenter + pluscenter` counts; it does not alter the
legacy 3x3 result array.

Unlike 4x4, the 5x5 has fixed true centers. Their colors uniquely determine
the tracing frame, so the user does not choose a corner sticker to place at
`UFR`; the normalized model always uses the center-determined `UFR` frame.

## Pieces, Buffers, And Goals

- corners use the complete 3x3 corner planner and `UFR`-prefix buffer policy;
- midges are the ordinary 3x3 edge sticker set and use the complete exact
  pseudoswap edge planner, with corner permutation parity selecting the
  pseudosolved `UF/UR` goal; weakswap is not a 5x5 midge option;
- wings use the same 24-piece canonical orbit, `UFr` buffer, deterministic
  cycle breaks, corner-parity goal, and basic/full parity finishes as 4x4;
- xcenters use the 4x4 `Ubl` buffer and `Ubr` odd helper;
- +centers use the exact mirrored color tracer with `Ub` buffer and `Ur` odd
  helper.

Midge standard, selected-prefix, and full floating inherit the 3x3 pseudoswap
planner's ordinary comm and 2-flip weighting, but there are no separate midge
parity terminal algsets: `2E2E`, `F2E`, `FF2E`, and LTEF are all unavailable.
Corner parity execution fixes the parity-relative `UF/UR` midge goal. The
pseudoswap-only `UF + UB` buffer-selection exception remains legal.

The +center canonical locations are:

```text
Ub Ur Uf Ul Lu Lf Ld Lb Fu Fr Fd Fl
Ru Rb Rd Rf Bu Bl Bd Br Df Dr Db Dl
```

Their deterministic target rule is identical to xcenters: prefer an unresolved
matching-face target currently carrying a non-U color; use a matching target
carrying U only afterward; fill open U slots when carrying U; then cycle-break
in canonical order. An odd target count appends `Ur`, so cost is
`ceil(targets / 2)`.

## 5x5-Only Notation

Two-layer wide moves behave as on 4x4. Triple-wide and lowercase inner-slice
moves expand compositionally as:

```text
3Rw = x Lw    3Lw = x' Rw
3Uw = y Dw    3Dw = y' Uw
3Fw = z Bw    3Bw = z' Fw

m = x' Rw Lw'   e = y' Uw Dw'   s = z Fw' Bw
```

Prime, double, and redundant `2'` suffixes apply to the entire expansion.
The fixed true centers determine the 5x5 tracing frame, so the normalized
model always places the center-determined corner sticker at UFR. There is no
user orientation selector or best-of-24 comparison for 5x5.
