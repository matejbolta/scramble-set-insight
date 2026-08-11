# Scramble Set Insight

This app helps determine the luckiness of a scramble set using your own tracing setup.

### Use the app here: [Scramble Set Insight](https://matejbolta.github.io/scramble-set-insight/)

### How it works

Input a set of scrambles (for MBLD I suggest using csTimer's ScrambleGenerator, for 3BLD you can just copy your entire csTimer session), choose your tracing parameters, and enjoy.

It supports:

- weak swap and pseudo swap
- corrected exact weighted UF/UFR pseudoswap counting, exact UFR corner
  counting with exact cycle-model singleton weakswap counting, exact weighted
  full floating, and exact weighted partial pseudoswap floating
- custom tracing/scrambling orientation
- custom 2-flip and 2-twist weights
- optional DNF inclusion and Advanced `None / LTCT / T2C` counting

T2C is available with exact full floating and exact partial pseudoswap
floating. Existing LTCT behavior remains available in every counting mode.
Partial weakswap floating retains its earlier DLin implementation pending a
separate method review.

### Archived Python Core

The archived modular Python core lives in `python/legacy/`, beside the
handwritten reference oracle. It is retained for historical inspection only;
production lives in `web/`, and `python/ssi_handmade.py` plus
`baseline/truth-*.json` define stored reference truth.
