# Logic Book

## Module Ownership

The current `ssi_core` Python package is organized by responsibility:

- `wide_move_translator.py`
  - wide-move normalization
  - orientation string helpers
  - move-mapping updates through rotations
- `scrambling.py`
  - solved-state dictionaries
  - move application for edges and corners
  - scramble application
  - building scrambled state from normalized move text
- `corner_tracing.py`
  - corner piece-group helpers
  - solved/twisted detection
  - floating corner trace segments
  - twist-direction identification
- `edge_common.py`
  - shared edge helpers used by both edge methods
  - buffer normalization
  - sticker-letter mapping
  - virtual edge-state updates
  - floating edge segment engine
- `weakswap_tracing.py`
  - weakswap-specific solved/flipped rules
  - legacy weakswap tracing
  - floating-compatible weakswap tracing wrappers
- `pseudoswap_tracing.py`
  - pseudoswap-specific solved/flipped rules
  - legacy pseudoswap tracing
  - floating-compatible pseudoswap tracing wrappers
- `finalizing.py`
  - corner and edge breakdown builders
  - alg counting
  - human review/debug output
  - scramble-list parsing
  - top-level `alg_counter_main(...)`

This matters because the rest of this document explains logic by concept, but these files are the practical ownership map for where that logic currently lives in code.

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

Corner tracing in `ssi_core` is currently built around one active buffer:

- corner buffer piece: `UFR / RUF / FUR`
- primary pointer used for tracing decisions: `UFR`

More generally, `ssi_core` now supports a selected set of floating corner buffers.

The standard floating order is:

- `UFR`
- `UFL`
- `UBR`
- `UBL`
- `RDF`
- `FDL`

This buffer order is part of the logic, not an arbitrary UI detail.

The current non-floating corner pipeline is:

1. Build scrambled corner state.
2. Identify non-buffer corners that are already solved.
3. Identify non-buffer corners that are twisted in place.
4. Exclude those solved and twisted pieces from tracing.
5. Trace the remaining pieces from the buffer until every non-buffer corner is either traced, solved, or twisted.

So current tracing is not trying to "solve everything".
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

The current `ssi_core` implementation no longer mutates the scrambled corner state directly while tracing.

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

To do that, `ssi_core` constructs a virtual corner state from:

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

`ssi_core` now supports floating-capable corner tracing.

That means:

- tracing does not have to remain on one fixed corner buffer forever
- if the current buffer becomes solved while unresolved corner work still remains
- tracing can continue from the next allowed buffer in the standard buffer order

The currently supported backend selection model is:

- single-buffer mode, which preserves old `UFR`-only behavior
- selected subset of known buffers
- `all` buffers, meaning the full standard floating list above

## Current Floating Rule

The current rule implemented in `ssi_core` is:

- float only when the current buffer is solved
- do not float merely because the current buffer piece is twisted in place

So:

- solved buffer -> try next allowed floating buffer
- twisted-in-place buffer -> cycle break from the current buffer

This is a deliberate current-rule choice for the implementation stage.

## Corner Trace Segments

For floating analysis, a flat target list is not rich enough.

Why not:

- floating changes which buffer is active during tracing
- the parity of each individual buffer cycle matters
- two odd cycles can later be paired together

Because of that, `ssi_core` now also builds **corner trace segments**.

Each segment has:

- one active buffer
- the ordered target list traced from that buffer before switching away

Conceptually:

- `[{buffer: 'UFR', targets: [...]}, {buffer: 'UFL', targets: [...]}]`

The legacy flat corner list still exists, but it is now derived by flattening these segments.

So:

- segments are the real floating-aware model
- flat target list is just compatibility output for older code paths

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

In the current floating-capable implementation:

- cycle breaking still happens from the current active buffer
- floating is attempted first only if that active buffer is solved
- if no later allowed buffer is suitable, tracing falls back to cycle breaking

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

## Floating Optimization Logic

Without floating, every cycle is effectively handled as if it were independent.

That means:

- each segment would cost `ceil(length / 2)` comms on its own

With floating:

- all even cycles stay independent
- odd cycles can be paired together
- each pair of odd cycles saves one comm compared to solving them separately

So in code the floating-aware corner comm count is:

- sum of standalone segment costs
- minus `floor(number_of_odd_segments / 2)`

Equivalently:

- every pair of odd segments saves exactly one comm

Example:

- one even cycle and two odd cycles
- non-floating thinking: three separate cycle closures
- floating thinking: solve even cycle normally, combine the two odd cycles, save one comm

This is the key advantage floating introduces into the backend model.

## Corner Parity Under Floating

Under the segment model:

- if the number of odd corner segments is even, corner tracing closes cleanly
- if the number of odd corner segments is odd, one odd segment remains unpaired

That remaining unpaired odd segment is what `ssi_core` now treats as **corner parity**.

So corner parity is now defined as:

- `number_of_odd_corner_segments % 2 == 1`

This is the correct floating-aware notion of parity for the current backend stage.

The later relationship between:

- one leftover odd corner cycle
- one leftover odd edge cycle
- and the combined parity handling

is intentionally left for later work.

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

`weakswap` traces edges before corners.

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

## Edge Floating Buffers

`ssi_core` now also supports an opt-in floating architecture for edges.

Important:

- default edge selection is still legacy-compatible `UF`-only tracing
- this preserves baseline parity with the original implementation
- the code path is now unified: both single-buffer and multi-buffer edge tracing go through the same segment-based engine
- selecting one edge buffer is therefore just the degenerate no-floating case of the unified implementation

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

## Edge Virtual State

Floating edge tracing uses the same architectural shift as corners:

- keep the scrambled edge state fixed
- keep a trace log of `(buffer, target)` events
- derive a virtual current state from that log

This is what allows buffer switching without mutating the original scrambled state directly.

## Edge Floating Closure Rule

For generic floating edge buffers, a cycle is considered float-closed only when the current buffer piece is truly solved in its own slot.

If the current buffer piece is only flipped in place:

- that does not authorize floating
- the tracer performs a cycle break instead

## Special Primary UF Closure Rule

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

## Edge Floating Counting

Edge comm counting now follows the same segment-parity principle as corners:

- even-length segments are self-contained
- odd-length segments can be paired
- each pair of odd segments saves one comm

So floating edge alg count is:

- sum of standalone segment costs
- minus `floor(number_of_odd_edge_segments / 2)`

This same counting rule also applies in single-buffer mode, where there is usually only one segment and therefore no floating savings to realize.

## Development Debug Helpers

At the bottom of `ssi_core` there are now two development-oriented helpers for inspecting one scramble in detail.

`analyze_scramble(...)` returns a structured dictionary containing:

- selected buffers
- corner segments and flat target list
- edge segments and flat target list
- odd/even segment counts
- floating savings
- flips
- twists
- LTCT adjustment
- final alg total

`debug_human_review_report(...)` renders one compact report for the same scramble with:

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

Competition scrambles typically only use wide moves at the end, but the logic in `ssi_core` is written more generally.

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

The implementation strategy in `ssi_core` is not "store explicit rotations in the scramble text".
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

## Current WMT Architecture In ssi_core

The current generalized translator in `ssi_core` works like this:

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

## Orientation Approach In ssi_core

`ssi_core` handles tracing orientation at the move-notation layer instead of by rotating the whole state dict before and after the scramble.

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

- if `ssi_core` produces a perfect match against the stored baseline output, it is treated as 100% working

That baseline lives in:

- `/Users/matejbolta/Documents/Dev/scramble-set-insight/baseline/testing-10k-scrams.txt`
- `/Users/matejbolta/Documents/Dev/scramble-set-insight/baseline/truth-weakswap.json`
- `/Users/matejbolta/Documents/Dev/scramble-set-insight/baseline/truth-weakswap-params.json`
- `/Users/matejbolta/Documents/Dev/scramble-set-insight/baseline/truth-pseudoswap.json`
- `/Users/matejbolta/Documents/Dev/scramble-set-insight/baseline/truth-pseudoswap-params.json`

## Regression Script

To make future verification easy, there is a dedicated regression script:

- `/Users/matejbolta/Documents/Dev/scramble-set-insight/tests/test_py_core.py`

Its job is:

- read the baseline params
- run `ssi_core.alg_counter_main(...)`
- compare the produced `alg_count_list` against baseline
- fail immediately on length mismatch or first value mismatch

This script is the standard quick regression check for `ssi_core`.
