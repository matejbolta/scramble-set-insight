# Scramble Set Insight

This app helps determine the luckiness of a scramble set using your own tracing setup.

### Use the app here: [Scramble Set Insight](https://matejbolta.github.io/scramble-set-insight/)

### How it works

Input a set of scrambles (for MBLD I suggest using csTimer's ScrambleGenerator, for 3BLD you can just copy your entire csTimer session), choose your tracing parameters, and enjoy.

It supports:

- a 4x4 MVP with exact existing corner counting, UFr wing counting, Ubl/Ubr
  xcenter counting, 24 selectable starting orientations (or an exact best-of-24
  search per scramble), and basic or full wing-parity finishes
- a 5x5 MVP with the same exact corner and wing models, exact pseudoswapped
  midge counting, deterministic Ubl/Ubr xcenter and Ub/Ur +center counting,
  and the same 24 starting orientations
- weak swap and pseudo swap
- corrected exact weighted UF/UFR pseudoswap counting, exact UFR corner
  counting with exact cycle-model singleton weakswap counting, and exact
  weighted partial/full floating for both edge methods
- custom tracing/scrambling orientation
- `S / M / E` slice moves, including prime and double suffixes
- `x / y / z` cube rotations anywhere in a scramble, in either upper or lower
  case and with prime or double suffixes
- redundant half-turn primes such as `R2'`, normalized as `R2`
- custom 2-flip and 2-twist weights
- optional DNF inclusion and Advanced `None / LTCT / T2C` counting
- optional corner-floating parity (`UF-UR + 2E2C`)
- hierarchical edge parity algsets `None / 2E2E / F2E / FF2E`, plus an
  independent weakswap-only LTEF option
- independent runtime weights from 1 to 2 for every terminal algset

The 4x4 and 5x5 MVPs accept ordinary and two-layer wide moves, cube rotations,
lowercase inner-slice shorthands, and `M / E / S`. The 5x5 parser additionally
accepts triple-wide moves (`3Rw`, etc.) and lowercase `m / e / s`. Wing and
center tracing are currently deterministic: there is no wing floating, and
interchangeable center targets follow the documented non-U-first canonical
order. Global center-target optimization and center floating are later steps.

T2C and LTCT are available in every corner-buffer mode, including fixed UFR;
neither algset requires a secondary floating buffer. `F2E` adds the terminal
family whose root swap has the edge in the UF slot flipped; `FF2E` additionally
adds the UR-slot-flipped family. The fourth, both-flipped UF/UR root swap is not
part of these sets.
Every weak floating plan first follows the physical UF/UR weak state machine;
the selected-buffer optimizer begins only after a legal closure or explicitly
authorized open-root transition.
`F2E` and `FF2E` authorize their specific open flipped-root transitions;
`None` and normal `2E2E` do not.
For partial floating, the second 2-swap must contain at least one selected
non-primary buffer. Full floating additionally includes the learned `BR-BL`
edge exception and `DBR-DBL` corner exception even though those pieces are not
buffers.

Partial floating follows the displayed learning order: choosing a buffer also
includes every earlier buffer. Pseudo swap additionally supports the common
`UF + UB` setup without `UR`; weak swap keeps `UR` before `UB`.

### Archived Python Core

The archived modular Python core lives in `python/legacy/`, beside the
handwritten reference oracle. It is retained for historical inspection only;
production lives in `web/`, and `python/ssi_handmade.py` plus
`baseline/truth-*.json` define stored reference truth.
