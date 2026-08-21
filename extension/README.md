# csTimer Auto Algcount (local prototype)

This unpacked Chrome/Brave extension runs Scramble Set Insight locally and
calculates algcounts for csTimer solves. Its native selectable **BLD Algcount**
tool shows the current session's latest solve, and it can optionally save new
results to empty comments. The default format is a
total-only count such as `9 algs`; users can choose total, corner/edge, spacing,
baseline, comparison, and final-value templates.

## Install locally

1. Open `chrome://extensions` (or `brave://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the `scramble-set-insight/extension` folder.
5. Open or reload csTimer.
6. Switch to the csTimer session you want, open the extension, and choose its
   tracing settings and optional comment output. Every change saves automatically.

Configure another session by switching to it in csTimer and reopening the
extension popup. Settings are stored per csTimer session in extension storage.

## Versioning

Treat `manifest.json` as the authoritative extension version. Bump the patch
version for fixes, copy, and asset updates; the minor version for new behavior;
and the major version for incompatible stored-setting or workflow changes.

## Behavior

- The popup's top-level **Extension** switch is enabled by default. Turning it
  off stops all tool analysis and comment writes while preserving settings;
  csTimer reloads once so the native tool is removed cleanly.
- Selecting the native tool immediately analyzes the latest existing solve;
  while selected, it updates after each newly completed solve.
- The extension accepts csTimer's WCA 3x3 entries and the options under its
  `3x3x3`, CFOP, Roux, Mehta, and 3x3 subsets groups. Other puzzle types or
  unsupported notation such as slice moves show `Switch to 3×3` / `scramble
  type` on two lines and are never written to comments.
- Popup settings save automatically for the current csTimer session; there is
  no manual Save step.
- **Save algcount to comment** is the only per-session output toggle and
  defaults to off. It applies to newly completed solves. While the extension
  is enabled, selecting the native tool in csTimer controls its visibility.
- The extension registers **BLD Algcount** in csTimer's Tools menu. Select it in
  any tool slot to immediately calculate and display the current session's
  latest solve without altering another tool.
- Comment templates use `N` for the fixed `UF/UFR`/no-LTCT baseline, `M` for
  the selected setup's final total, and `C`/`E` for component counts.
- Available templates include total-only, `algs`, compact component, and spaced
  component variants. Comparison templates put `N->M` only on the total;
  `C` and `E` remain final values.
- The comparison arrow is configurable per session: `->` is the default, with
  `→`, `➜`, `➝`, `▸`, and `➔` available as alternatives. Comparison-template
  labels update immediately to preview the selected arrow. The control is
  disabled when neither floating nor LTCT makes comparisons available.
- With plain `UF/UFR` and LTCT off, the five meaningful `N` templates are
  shown. Floating or LTCT replaces them with five final-value templates followed
  by four comparison templates; baseline-only comments are not offered in those
  modes.
- Partial floating always keeps the primary `UFR` corner buffer and `UF` edge
  buffer selected; choose only which additional buffers are available.
- **Advanced** offers `None`, `LTCT`, and `T2C`. T2C is available only with
  exact full floating; switching to another buffer mode falls back to LTCT.
- The popup defines `N` contextually as the count before LTCT, floating, or
  floating/LTCT together; this hint is hidden when neither comparison applies.
- `Add finish label` is available when Advanced is enabled and appends `LTCT`
  or `T2C` only when that finish actually applies.
- Floating 2-flip and 2-twist weights accept values `>= 1` with `0.01`
  precision.
- It never overwrites a non-empty comment; the on-page output can still appear.
- It runs locally and does not make network requests.
- Session settings are matched by csTimer's internal session index and name.
  If csTimer reuses an index after a session is deleted, the name guard keeps
  the old configuration from being applied accidentally.
- Reload the csTimer tab after installing or reloading the extension.

## Verify

```sh
node scripts/sync-ssi-engine.mjs check
node tests/test-extension.js
```

## Shared SSI engine source

The production files in the parent repository's `web/` directory are
the only handwritten engine source. The thirteen files in `vendor/ssi-core/` are
generated regular-file mirrors because Chrome/Brave may reject content scripts
that resolve through links outside the unpacked extension directory. Never edit
the generated mirror by hand.

Run the watcher while developing to copy every saved shared-engine change into
the extension immediately:

```sh
node scripts/watch-ssi-engine.mjs
```

For a one-time update or drift check, use `node scripts/sync-ssi-engine.mjs
sync` or `node scripts/sync-ssi-engine.mjs check`. The scripts resolve the
parent SSI repository automatically; `SSI_REPO_ROOT` remains available for an
intentional non-default checkout. Reload the unpacked
extension and then the csTimer tab to execute changed content scripts.

For a portable unpacked directory, run:

```sh
node scripts/build-unpacked.mjs
```

The output is written to `dist/cstimer-auto-algcount/` and always materializes
the current production engine source.

No csTimer source is copied into this extension. `src/page-adapter.js` talks to
the runtime interfaces exposed by csTimer, which are internal and may need a
small compatibility adjustment after a future csTimer update.
