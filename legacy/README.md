# Legacy Python implementation

This directory contains the archived modular Python core and deprecated
Streamlit application. They are retained for historical inspection only and
are not production code or an active correctness oracle.

The old application can still be started from the repository root with:

```sh
streamlit run legacy/streamlit_app.py
```

Its historical regression test can be run manually with:

```sh
python3 legacy/test_ssi_core.py
```

Production lives in `web/`. The immutable handwritten oracle remains
`python/ssi_handmade.py`, and the frozen outputs live in `baseline/`.
