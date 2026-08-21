# Project handoff

## Current state

Scramble Set Insight is a live static browser application deployed from `web/`
on `main`. Version `1.0.0` establishes semantic versioning for the current
production generation; `VERSION` is canonical.

## Required orientation

- Read `AGENTS.md` for operating rules, truth-oracle boundaries, result
  contracts, floating routing, verification, and csTimer integration.
- Read `logic_book.md` before changing cube state, tracing, parity, orientation,
  floating, flips, twists, LTCT, T2C, or big-cube counting.
- Read the relevant document under `design/` for active design contracts.
- Production code is in `web/`; the handwritten Python oracle and stored truth
  fixtures change only after explicit truth-correction authorization.

## Verification

- `python3 tests/test_handwritten_truth.py`
- `node tests/test_js_core.js`
- After shared-engine changes, also run the csTimer extension sync and test
  checks documented in `AGENTS.md`.

## Current direction

The detailed deferred work is recorded in `AGENTS.md` and design documents.
Future maintenance should gradually move long-lived architecture and backlog
detail out of `AGENTS.md` while preserving every domain invariant.

## Known verification failure on 2026-08-21

`python3 tests/test_handwritten_truth.py` passes. The long JavaScript core suite
passes its preceding 3x3, 4x4, frontier, and terminal audits, then fails in
`tests/test_js_five_by_five.js:105`: expected `ff2e`, received `none`. The
governance migration did not modify production or test logic, so this is
recorded as a pre-existing product baseline failure for a dedicated follow-up.
