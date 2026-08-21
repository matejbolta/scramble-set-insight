# Scramble Set Insight — Agent Handoff

## What This File Is

This is the concise operating handoff for coding agents. Keep stable project
rules and repository orientation here. Put cube-domain explanations and tracing
theory in `logic_book.md` instead of duplicating them here.

## Product And Production

- The live product is a fully client-side static browser app in `web/`.
- GitHub Pages deploys `web/` from `main` through
  `.github/workflows/deploy-pages.yml`.
- There is no production backend or required build step.
- `web/app.js` owns browser UI behavior and presentation of results.
- `web/worker.js` runs analysis off the main browser thread.
- The remaining modules in `web/` own the production JavaScript cube and
  tracing logic.
- A fixed 4x4 orientation can optionally be compared with the exact best of
  all 24 orientations. Big-cube result comparisons also recompute a no-advanced-
  algset baseline so weighted LTCT/T2C/etc. savings are reported instead of
  being hidden by the MVP renderer.
- 5x5 has fixed true centers and therefore always uses the center-determined
  `UFR` tracing frame; never expose or accept the 4x4 orientation selector as
  a meaningful 5x5 setting.

## Truth And Legacy Python

- `python/ssi_handmade.py` is the handwritten reference oracle, frozen except
  for an explicitly requested deliberate truth correction.
- `baseline/truth-*.json` stores its current 10k reference outputs.
- Do not modify the handwritten oracle or baseline truth unless the user
  explicitly requests a deliberate truth change.
- `python/legacy/` contains the archived modular Python core. It is a
  historical reference, not production or an active oracle.
- Never extend archived Python to mirror a production JavaScript feature.
- Preserve JavaScript parity with stored truth for `UFR / UF`; test
  JavaScript-only floating additions with JavaScript invariants.
- The deliberate August 2026 truth correction prices three equal-direction
  corner twists as two algorithms. Regenerate the fixtures only with
  `python3 scripts/regenerate-handwritten-truth.py` after equally explicit
  user authorization.

## Result Contract

- The legacy aggregate result occupies indexes `0` through `6` of
  `algCounterMain(...)` and `UFR / UF` must remain parity-compatible with the
  stored truth fixtures.
- Production-only corner/edge aggregates and per-scramble component details are
  appended by JavaScript after the legacy fields.
- Parity execution belongs to the corner count. Edge tracing is pseudo-solved
  for that parity before its count is calculated.
- Terminology is strict: odd/even physical cycle refers to piece count;
  odd/even segment refers to target count; odd/even permutation must name the
  state or class. Physical-cycle and segment parity are opposite because a
  segment has `k - 1` or `k + 1` targets.

## Floating Routing

- The common edge buffer order is `UF, UR, UB, UL, FR, FL, DF, DB, DR, DL`
  for weakswap, pseudoswap, and generated exact selected-buffer frontiers.
- Partial corner and edge selections are canonical prefixes. The sole
  non-prefix configuration is pseudoswap `UF + UB` without `UR`; weakswap does
  not permit it. `web/buffer-selection.js` owns this shared policy.

- `UFR` corner counting uses exact weighted selected-buffer classes for both
  edge methods.
- `UF` edge counting uses exact weighted selected-buffer classes for
  pseudoswap; singleton weakswap edges use parity-relative physical-cycle
  counting validated against the canonical deterministic UF/UR state machine.
  Its forced-UR invariant was exhaustively checked across 487,704 compact
  states with zero mismatches.
- Full pseudoswap uses exact weighted anonymous cycle classes. Full weakswap
  is the last prefix of the exact weak-entry plus UF/UR-rooted suffix model.
- Partial pseudoswap uses exact weighted selected-buffer classes; partial
  weakswap first runs the dedicated human UF/UR weak start phase and may
  consult the weighted rooted suffix frontier only after a legal closure or
  specifically authorized open-root entry. The start distinguishes an empty,
  oriented, or flipped UR destination; an even oriented first-root encounter
  is a legal float, while F2E/FF2E gate their exact open-root cases. Normal
  `2E2E` uses the literal `UF-UR-UF` sticker swap (equivalently
  `FU-RU-FU`), not every
  charge-zero swap of the UF/UR physical pieces. Edge capability is
  `None / 2E2E / F2E / FF2E`; each level includes the preceding ones.
  `F2E` and `FF2E` distinguish whether the `UF`-slot or `UR`-slot root edge is
  flipped; the both-flipped root is in none of these sets. They are terminal
  finishes only, never intermediate graph transitions. In partial floating
  the other 2-swap must touch a selected non-primary buffer; full floating
  additionally knows `BR-BL`.
- `LTEF` is an independent weakswap-only terminal available
  for singleton/partial/full with no selected-buffer restriction on its
  arbitrary target or flip; its no-parity odd-target closure is forced to
  `RU`. It may follow a legal weak prefix, so singleton counting must search
  weak-start LTEF endpoints rather than test only the initial state.
  Pseudoswap `UF + UB` disables `2E2E / F2E / FF2E`; full `DL` knowledge
  includes `BR-BL` for all three enabled levels.
- Corner-floating parity (`UF-UR + 2E2C`) is an independent corner terminal.
  In partial floating one corner of its 2-swap must be selected; full `FDL`
  knowledge additionally includes the exceptional `DBR-DBL` swap.
- LTCT and T2C are terminal corner algsets available even with fixed `UFR`.
  T2C does not require a secondary floating buffer: fixed-UFR comms may prepare
  the state with UFR twisted in place and an external twisted 2-swap.
- Terminal tables store Pareto prefix costs without pricing the final alg.
  Runtime weights in `[1, 2]` are independent for classic parity, LTCT, T2C,
  corner-floating parity, 2E2E, F2E, FF2E, and LTEF.
- Deferred TODO: add the joint `UF-X + UFR-Y` Full Parity and arbitrary
  `2E + 2C` Full Floating Parity terminal algsets. They solve edge and corner
  endpoints together and therefore belong in a future cross-component final
  matching layer, not either component-local action graph.
- Deferred TODO: the user has identified potentially fundamental anomalies in
  LTCT counts/numbers and will provide the concrete human analysis later. Do
  not "fix" or reinterpret LTCT before that explanation; audit the examples
  against the exact corner terminal model once supplied.
- The 4x4/5x5 MVPs use `web/big-cube-model.js` and
  `web/big-cube-tracing.js`, with their aggregate entry points in
  `web/four-by-four.js` and `web/five-by-five.js`. Corners reuse the exact 3x3
  corner planner; 5x5 midges reuse the exact 3x3 pseudoswap edge planner;
  wings use deterministic UFr tracing; xcenters use deterministic Ubl/Ubr
  color tracing; and +centers use the mirrored Ub/Ur trace. Keep their object
  result contracts separate from the legacy 3x3 result array.
- Deferred 4x4/5x5 polish: optimize interchangeable center target choice, add
  center floating and customizable cycle-break order. The 4x4 UI already has
  an exact per-scramble best-of-24 orientation search. On 5x5 the fixed true
  centers uniquely determine the tracing frame, so no orientation selector or
  best-of-24 comparison belongs there.
- Deferred 4x4 orientation presentation: when several of the 24 orientations
  tie for the minimum total algcount, expose all tied optimal orientations
  rather than only the canonical representative. Order the tied results first
  by lowest xcenter algcount, then by the canonical corner-sticker order for a
  stable final tie-break. Apply this both to `Optimal` selection output and to
  the optional comparison shown for a fixed orientation.
- Deferred center expansion: support `U` floating independently for xcenters
  and +centers. For each center type the user chooses either one exact U-face
  buffer or all four U-face buffers; do not expose two- or three-buffer subsets.
  Also expose which exact single xcenter/+center buffer is used.
- Deferred center audit: explore globally more optimal interchangeable-center
  tracing instead of assuming the deterministic non-U-first target order is
  optimal.
- Deferred correctness audit: independently validate the fundamental 4x4 and
  5x5 counting models against direct physical-state/human expectations. Their
  MVP implementation received regression coverage but skipped this deeper
  post-implementation audit.
- Deferred UX redesign: make the whole interface substantially more polished,
  calm, and native-feeling in an iPhone/Apple-software visual taste, including
  appropriate slider controls. Preserve clarity and exact setting semantics;
  do not start this redesign incidentally during core-logic work.
- Deferred settings-persistence audit: verify that every user-facing setting
  is automatically restored in a deliberate way. Keep puzzle-specific choices
  independent where appropriate, preserve meaningful selections while related
  controls are temporarily hidden/disabled, validate and migrate older saved
  shapes, fall back safely when capabilities or buffer policies change, and do
  not let stale 3x3/4x4/5x5 values leak into another puzzle's configuration.
  Include future solution-notation and custom-lettering profiles in the same
  versioned persistence model.
- Deferred TODO: emit an actual optimal memo/tracing sequence for 3x3, 4x4,
  and 5x5 under every selected setting. Current exact planners return only a
  minimum cost; preserve or reconstruct a witness path through the chosen
  frontier instead of inventing a greedy trace. Letter rendering must support
  exact piece notation, Speffz, and user-defined schemes as a layer over the
  physical sticker/piece sequence. The concrete implementation plan and
  witness contract are in `design/optimal-memo-witness.md`; reconstruction is
  on demand from the existing dialog so large set analysis remains count-only.
- The generated selected-buffer frontier block in `web/cycle-residue.js` is
  produced by `node scripts/generate-selected-buffer-frontiers.js --write`.
- The generated weak-floating frontier block in the same file is produced by
  `node scripts/generate-weakswap-floating-frontiers.js --write` (or its
  checkpoint options for long runs). Never edit either generated block by
  hand.

## Where To Read More

- Read `README.md` for the user-facing product summary.
- Read `logic_book.md` before changing cube state, tracing, floating, parity,
  orientation, wide-move, flip, twist, LTCT, or T2C behavior.
- Keep `logic_book.md` focused on domain logic and algorithm behavior, not agent
  workflow instructions.

## Verification

Run these before shipping production logic changes:

```sh
python3 tests/test_handwritten_truth.py
node tests/test_js_core.js
```

The Python test verifies the handwritten oracle against stored truth. The
JavaScript test verifies `UFR / UF` parity directly against the same truth,
checks exact singleton/full/partial floating plus retained DLin invariants, and
loads the 4x4/5x5 geometry, notation, component counting, and aggregate MVP
tests.

## Local csTimer Extension Integration

- The unpacked csTimer extension lives at `extension/` in this repository.
  The parent SSI repository is its only Git worktree; never initialize or
  restore a nested `extension/.git` directory.
- The August 2026 fusion is currently an uncommitted parent-repository change.
  The extension's former one-commit Git metadata is retained only as a
  recovery archive at
  `../browser-extensions/.cstimer-alg-comment.git-archive`; it is not an active
  worktree or a second source manager.
- `web/` is the only handwritten engine source. The extension's
  `vendor/ssi-core/*.js` entries are generated regular-file mirrors because
  Chrome/Brave may reject unpacked content scripts reached through external
  symlinks. Never patch the extension-side mirror as a second implementation.
- Keep `node scripts/watch-ssi-engine.mjs` running in the extension directory
  during shared-engine work, or run the one-time sync command after changes.
  Reload the unpacked extension and then the csTimer tab to execute changed
  content scripts.
- After changing shared engine behavior, also run from the extension directory:

```sh
node scripts/sync-ssi-engine.mjs check
node tests/test-extension.js
```

- Use the extension's `scripts/build-unpacked.mjs` to materialize a portable
  directory. The resulting `extension/dist/` remains ignored build output.

## Input Compatibility Fixtures

- `tests/fixtures/cstimer-inputs/` and
  `tests/fixtures/wca-archive-inputs/` cover the production paste formats.
- Keep committed fixtures synthetic or otherwise public. Never commit raw user
  session exports, timestamps, comments, solve statistics, or other personal
  behavioral data.
- Before changing input parsing, lock existing extraction counts and hashes in
  `tests/test_js_core.js`, then add narrowly scoped fixtures for the new shape.
- DNF status is production-only per-scramble metadata; preserve the normalized
  scramble list and the first seven legacy result fields.

For local browser checks:

```sh
python3 -m http.server 4180 --directory web
```

Then open `http://localhost:4180`.

## Change Discipline

- Implement production product and UI changes in `web/`.
- Preserve the first seven legacy output fields unless a deliberate breaking
  change is explicitly requested.
- For result-layout changes, verify single-scramble and multi-scramble states,
  responsive density, scroll behavior, and browser console errors.
- A push to `main` that changes `web/**` triggers the GitHub Pages deployment.
