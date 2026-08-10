# Legacy Python implementation

This directory contains the archived modular Python core and deprecated
Streamlit application. They are retained for historical inspection only and
are not production code or an active correctness oracle.

The old application can still be started from the repository root with:

```sh
streamlit run python/legacy/streamlit_app.py
```

Its historical regression test can be run manually with:

```sh
python3 python/legacy/test_ssi_core.py
```

Production lives in `web/`. The handwritten reference oracle is the sibling
`python/ssi_handmade.py`, and its stored outputs live in `baseline/`.
