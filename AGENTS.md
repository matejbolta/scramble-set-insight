# Project Instructions

- Treat the Python implementation as an immutable handwritten legacy/reference
  oracle. Do not modify files under `python/`, `scramble-set-insight.py`,
  `tests/test_py_core.py`, or baseline truth files unless the user explicitly
  requests Python-side work.
- Production runs from `web/`. Implement product, UI, and production runtime
  changes in the JavaScript/browser side.
- Preserve JavaScript parity with the unchanged Python reference for the legacy
  output contract. Test JavaScript-only production additions with JavaScript
  invariants rather than extending the Python implementation.
