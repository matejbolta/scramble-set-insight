# Legacy Python implementation

This directory contains the archived modular Python core. It is retained for
historical inspection only and is not production code or an active correctness
oracle.

Its historical regression test can be run manually with:

```sh
python3 python/legacy/test_ssi_core.py
```

Production lives in `web/`. The handwritten reference oracle is the sibling
`python/ssi_handmade.py`, and its stored outputs live in `baseline/`.
