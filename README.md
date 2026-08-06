# Scramble Set Insight

This app helps determine the luckiness of a scramble set using your own tracing setup.

### Use the app here: [Scramble Set Insight](https://matejbolta.github.io/scramble-set-insight/)

### How it works

Input a set of scrambles (for MBLD I suggest using csTimer's ScrambleGenerator, for 3BLD you can just copy your entire csTimer session), choose your tracing parameters, and enjoy.

It supports:

- weak swap and pseudo swap
- legacy UF/UFR tracing, exact weighted full floating, and advanced partial DLin floating
- custom tracing/scrambling orientation
- custom 2-flip and 2-twist weights
- optional DNF inclusion and Advanced `None / LTCT / T2C` counting

T2C is available with exact full floating; existing LTCT behavior remains
available in every counting mode.

### Legacy Version

The deprecated version, hosted on Streamlit, is still available here: [Legacy app](https://scramble-set-insight.streamlit.app/)

Its archived modular Python core and Streamlit source live in `legacy/`. They
are retained for historical inspection only; production lives in `web/`, and
`python/ssi_handmade.py` plus `baseline/truth-*.json` define legacy truth.
