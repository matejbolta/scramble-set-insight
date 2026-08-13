# Scramble Set Insight

This app helps determine the luckiness of a scramble set using your own tracing setup.

### Use the app here: [Scramble Set Insight](https://matejbolta.github.io/scramble-set-insight/)

### How it works

Input a set of scrambles (for MBLD I suggest using csTimer's ScrambleGenerator, for 3BLD you can just copy your entire csTimer session), choose your tracing parameters, and enjoy.

It supports:

- weak swap and pseudo swap
- corrected exact weighted UF/UFR pseudoswap counting, exact UFR corner
  counting with exact cycle-model singleton weakswap counting, and exact
  weighted partial/full floating for both edge methods
- custom tracing/scrambling orientation
- `S / M / E` slice moves, including prime and double suffixes
- custom 2-flip and 2-twist weights
- optional DNF inclusion and Advanced `None / LTCT / T2C` counting
- hierarchical weak-floating capability `None / 2E2E / 2E2E′`; normal
  `2E2E` uses the literal `UF-UR-UF` subset, while `2E2E′` adds both rooted
  misoriented sticker swaps

T2C is available with exact partial and full floating. Existing LTCT behavior
remains available in every counting mode. In weak floating, `2E2E` and
`2E2E′` each have fixed cost 1; custom 2-flip weighting remains independent.
For partial floating, the second 2-swap must contain at least one selected
non-primary buffer. Full floating additionally includes the learned `BR-BL`
exception even though neither piece is a buffer.

Partial floating follows the displayed learning order: choosing a buffer also
includes every earlier buffer. Pseudo swap additionally supports the common
`UF + UB` setup without `UR`; weak swap keeps `UR` before `UB`.

### Archived Python Core

The archived modular Python core lives in `python/legacy/`, beside the
handwritten reference oracle. It is retained for historical inspection only;
production lives in `web/`, and `python/ssi_handmade.py` plus
`baseline/truth-*.json` define stored reference truth.
