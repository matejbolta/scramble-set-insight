# Logic Book

## Module Ownership

The production engine is the JavaScript code in `web/`. The frozen handwritten
oracle is `python/ssi_handmade.py`, with its outputs stored in `baseline/`.
The former modular Python core and Streamlit app are archived under `legacy/`;
new floating work must not be mirrored into them.

Production responsibilities:

- `wide-move-translator.js` and `scrambling.js`
  - normalize moves and build exact sticker states
- `corner-tracing.js`, `edge-common.js`, `weakswap-tracing.js`, and
  `pseudoswap-tracing.js`
  - preserve legacy single-buffer tracing and its result contract
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
  - hold the generated UFR-rooted parity/LTCT/T2C finish frontiers
- `cycle-residue-planner.js`
  - calculate the exact full-floating minimum for orientation weights `>= 1`
  - use the parity-relative edge goal
  - optimize LTCT/T2C through the exact UFR-rooted finish class
- `dlin-planner.js`
  - retain the general selected-buffer search for partial floating while that
    path is migrated
- `finalizing.js`
  - keep `UFR / UF` on the legacy path
  - route full floating at every supported weight through the exact planner
  - route partial floating through the older DLin planner
  - build aggregate and per-scramble results

## Production Counting Modes

There are currently three production counting modes:

- exactly one selected buffer uses the frozen legacy tracing behavior
- the complete corner/edge buffer sets with orientation weights `>= 1` use
  exact weighted class counting
- partial buffer sets still use the transitional DLin search

DLin does not greedily choose a cycle break while walking one long memo. It:

1. decomposes the complete state into disjoint physical cycles;
2. records every cycle's permutation parity and orientation;
3. considers each allowed buffer inside that cycle;
4. also permits an in-place selected buffer, including a twisted/flipped one,
   to act as an external buffer for another cycle;
5. chooses the globally cheapest combination after all cycles are known.

The old DLin search is memoized by virtual sticker state, remaining physical
cycles, and open-segment parity. Its cycle discovery remains useful, but its
generic odd-segment pricing is not the correctness model for full floating.
Partial-buffer results must not be used as proof for full-floating behavior.

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
- selected subset of known buffers
- `all` buffers, meaning the full standard floating list above

Every selected subset must include `UFR`. Partial floating chooses which later buffers are available after the primary cycle closes; it does not choose a different starting buffer.

## Floating Choice

The old greedy floating engine moved only when its current buffer was exactly
solved. That rule missed legal opportunities when the buffer was twisted or
flipped in place and was also the source of the special pseudoswap closure
guard.

DLin replaces that procedural decision. A piece that is in its physical slot
is a legal external-buffer candidate even when oriented in place. The planner
then compares the cost of using it for a cycle with the cost of leaving its
orientation available for a later 2-twist or 2-flip. No unconditional
"twisted/flipped means cycle break" rule exists in the DLin path.

## Corner Trace Segments

For floating analysis, a flat target list is not rich enough.

Why not:

- floating changes which buffer is active during tracing
- the parity of each individual buffer cycle matters
- two odd cycles can later be paired together

Because of that, the legacy and transitional DLin paths also build **corner
trace segments**. Exact unit-weight full floating returns typed cycle residues
instead; it does not pretend that an arbitrary segment list is the optimized
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

In the DLin implementation, every physical cycle is memoed before cycle-break
choices are finalized. An external cycle break is one candidate action in the
global search; it is not an automatic fallback selected by a greedy walk.

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

## Even And Odd Corner Cycles

For one segment:

- if its target count is even, that cycle is closed
- if its target count is odd, that cycle is open

This matters because a comm solves targets in pairs from the active buffer.

So:

- even-length segment -> can be completed inside that buffer cycle
- odd-length segment -> cannot close by itself

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

For exact weighted counting, every even oriented-permutation conjugacy class is
therefore keyed by its sorted physical `(cycle length, orientation charge)`
records. An exhaustive graph over every legal full-buffer 3-cycle and every
2-flip/2-twist generator produces the complete nondominated frontier:

```text
(comm algs, orientation algs)
```

There are exactly 302 reachable even edge classes and 140 even corner classes.
Production stores their generated frontiers and minimizes
`comms + weight * orientations` for any finite weight `>= 1`.

Odd corner states also need to retain UFR's physical role. They use a second
class key: the cycle containing UFR is marked as the root, while all other
cycle records remain unordered. Exactly 416 such rooted classes are reachable.
For each class, production stores separate exhaustive Pareto frontiers for
ordinary parity, LTCT, and T2C capability. Each search is seeded from every
legal one-alg physical finish state, with the final parity/LTCT/T2C alg already
priced at one. This preserves the best comm/orientation tradeoff and guarantees
that an available UFR-eligible LTCT or T2C route is not lost. Weight `1` is
regression-locked to the unit residue results.

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

- if corners are even, edges are also even
- if corners are odd, the edge trace will also have a parity remainder

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

The following is the legacy `UF`-only weakswap behavior. `weakswap` traces
edges before corners.

So corner parity is not known yet when edge tracing starts.

Because of that, it cannot use the same parity-aware solved-frame reinterpretation as `pseudoswap`.

Instead, it temporarily treats the `UF / UR` subsystem as a flexible double-buffer situation.

High-level idea:

- whichever of `UF` or `UR` is encountered first is settled into `UR`
- the other piece is then effectively treated as the continuing buffer piece

If the final traced target count later turns out odd:

- `UR` or `RU` is appended at the end
- which closes the trace and captures the parity interaction

This is why `weakswap` can save one alg in roughly half of odd cases:

- if the parity piece `UF` is encountered before `UR`
- it can be absorbed into the `UR` position early
- and that avoids one otherwise wasted resolution later

In exact full-floating mode, the complete edge permutation already exposes its
parity without first tracing corners. Consequently both UI edge methods can be
planned against the same parity-relative solved goal. Their legacy procedures
remain distinct in `UF`-only mode; their exact full-floating minimum is method
independent.

## Edge Floating Buffers

Production JavaScript supports an opt-in floating architecture for edges.

Important:

- default edge selection is still legacy-compatible `UF`-only tracing
- this preserves baseline parity with the original implementation
- single-buffer tracing stays on the legacy method-specific engine
- the complete buffer set uses the method-independent exact weighted planner
  after the parity-aware edge goal is known
- partial-buffer selection currently uses the older DLin planner
- every selected subset must include `UF`; partial floating adds later buffers but does not replace the method's primary physical buffer

The method-specific floating orders are:

For `pseudoswap`:

- `UF`
- `UB`
- `UR`
- `UL`
- `FR`
- `FL`
- `DF`
- `DB`
- `DR`
- `DL`

For `weakswap`:

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

## Edge Trace Segments

Just like corners, edge tracing now uses a segment model internally.

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

## Legacy Special Primary UF Closure Rule

The first edge buffer is still special.

While tracing from `UF`, the backend treats the cycle as closed if the `UF` slot contains any of:

- `UF`
- `FU`
- `UR`
- `RU`

This reflects the special `UF / UR` subsystem behavior that both edge methods already rely on.

In floating mode that primary cycle is therefore allowed to end early, and tracing can continue from the next method-allowed buffer.

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

These rules remain documented because they define frozen `UF`-only behavior.
They are not guards in DLin. DLin instead builds the complete parity-relative
edge state, where a pseudo-solved `UF / UR` subsystem is genuinely solved and
there is no hidden pending slot from which the search could loop.

## Edge Full-Floating Counting

After the parity-relative goal is built, every edge cycle reduces to base comms
plus `F`, `P`, or `PF`. The exact closed catalog is:

- `F F` for one 2-flip
- `P P` for two algs
- `PF PF` for two algs
- `F P PF` for three algs

There is no edge parity terminal in this relative frame.

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
- whether each component used `legacy`, `dlin`, or `cycle-residue` counting
- in residue mode: base cost, typed residue multiset, and selected finish
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
still accepted and normalized to `ltct` for compatibility. T2C is exposed only
for exact full floating; standard and partial floating must not silently
approximate it. Comparison baselines use standard `UFR / UF` with Advanced set
to `none`. This makes a combined corner improvement render as, for example,
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

- legacy JavaScript `UFR / UF` must match the frozen handwritten truth exactly
- exact full-floating behavior is verified with residue catalogs, a concrete
  small-state oracle, terminal enumeration, and explicit regressions

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

Their jobs are:

- verify the handwritten oracle still generates the frozen truth
- compare legacy JavaScript directly with the same stored truth
- verify cycle reconstruction, legacy truth, exact residue catalogs, concrete
  atom realizations, all 302 edge and 140 corner Pareto class frontiers, all
  416 UFR-rooted parity/LTCT/T2C frontiers, weighted terminal distance, 10k
  full-floating invariants, weighted partial floating, and targeted regressions

The archived modular Python core retains its historical test under
`legacy/test_ssi_core.py`, but that test is not part of production verification.
