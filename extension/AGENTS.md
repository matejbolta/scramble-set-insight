# csTimer Auto Algcount — Agent Handoff

## What This File Is

This is the canonical engineering handoff for coding agents working on the
extension. Keep it current when behavior, architecture, defaults, versioning,
or verification changes. Keep end-user installation and usage instructions in
`README.md`.

## Project Status And Scope

- This is a local unpacked Chrome/Brave extension inside the parent
  `scramble-set-insight` repository at `extension/`.
- The parent SSI repository is the only Git worktree and source manager for
  both the web app and extension.
- Its product name is **csTimer Auto Algcount**.
- The current extension version is `1.8.3` in `manifest.json`.
- It runs entirely in the browser and makes no network requests.
- Its purpose is to calculate an algcount such as `9=3+6` or `9 algs`. The
  enabled extension registers a native selectable `BLD Algcount` tool that
  immediately analyzes the current session's latest solve; users can
  independently enable saving new results to empty comments.

## Architecture

- `manifest.json` owns permissions, csTimer match patterns, extension identity,
  toolbar configuration, and the authoritative version.
- `popup/` owns the global master switch, per-session setup UI, and
  extension-local configuration.
- `src/content.js` bridges Chrome extension storage/messages into csTimer.
- `src/comment-format.js` owns template availability, legacy-format migration,
  number/spacing rules, and final comment rendering for both popup and adapter.
- `src/page-adapter.js` integrates with csTimer's page-world runtime, listens
  for completed solves, computes the algcount once, optionally asks csTimer to
  save it, and registers/updates the native `BLD Algcount` tool through csTimer's
  `tools.regTool(...)` interface.
- The parent `web/` production engine is the only
  handwritten source. The thirteen JavaScript files in `vendor/ssi-core/` are
  generated regular-file mirrors and must never be edited manually. External
  symlinks were removed after Chrome/Brave failed to inject their content
  scripts from the unpacked extension.
- `scripts/sync-ssi-engine.mjs` copies and verifies the generated mirror from
  the parent repository.
  `scripts/watch-ssi-engine.mjs` keeps it current immediately during active
  development. `SSI_REPO_ROOT` overrides the default sibling-repository path.
- `scripts/build-unpacked.mjs` creates `dist/cstimer-auto-algcount/` for a
  portable unpacked build or future packaging.
- `icons/icon.svg` is the extension's geometric cube source mark. The PNG files
  are its generated Chrome-size derivatives at 16, 32, 48, and 128 pixels.
- `tests/test-extension.js` is the main headless behavior and invariant test.
- `tests/browser-harness.html` exercises the page adapter in a browser-shaped
  mock csTimer environment.
- `tests/popup-tooltip-harness.html` isolates the popup's Orientation and LTCT
  tooltips so hover and keyboard focus can be checked without a live csTimer
  tab.
- `tests/popup-format-harness.html` exercises contextual template availability,
  hints, and live arrow previews without a live csTimer tab.

## Current Defaults

New, unsaved session configurations use:

- Extension: enabled
- Buffers: `UF/UFR`
- Edge tracing: `Pseudo swap`
- Orientation: empty
- Advanced: `None`
- Floating 2-flip weight: `1`
- Floating 2-twist weight: `1`
- Algcount template: `N algs`
- Add finish label: off
- Algcount arrow: ASCII `->`
- Save algcount to comment: off

Settings are stored per csTimer session. Existing saved session settings must
continue to override defaults.

## Required Behavior And Safety Invariants

- While the extension is enabled, the native tool uses default tracing settings
  even before a session has saved popup configuration. When selected, analyze
  the latest existing solve immediately and continue updating it after new
  solves.
- A page refresh or session switch may restore `BLD Algcount` as the selected
  native tool without csTimer invoking a newly registered callback. Detect the
  selected slot read-only, reconnect its content host, and analyze immediately
  plus once after the short csTimer reset window. Never require the user to
  switch away and back to populate the tool.
- When csTimer explicitly invokes the `BLD Algcount` callback with a host after
  a manual tool switch, trust that host immediately. The menu DOM can lag the
  callback briefly; do not let restoration detection cancel an explicit render.
- Analyze only csTimer types from WCA's four 3x3 entries (`333`, `333ni`,
  `333fm`, `333oh`) and every child of the `3x3x3`, `3x3x3 CFOP`, `3x3x3
  Roux`, `3x3x3 Mehta`, and `3x3x3 subsets` groups. Also require every move to
  use SSI-supported face or wide-turn notation. Other puzzle types, slice moves
  such as `M`, and any core-analysis failure all show the same native-tool
  message on two lines: `Switch to 3×3` / `scramble type`
  Never save a comment for such a solve.
- When the native tool is not selected and comment saving is off, new solves
  require no analysis work.
- Match saved settings by both csTimer's internal session index and session
  name. The name guard prevents accidental reuse if csTimer recycles an index.
- Never overwrite a non-empty solve comment. A non-empty comment suppresses
  only the comment output; the independent `BLD Algcount` tool still works.
- Calculate the algcount once and feed the same formatted string to the native
  tool and comment when both are active for a newly completed solve.
- The global master switch defaults to enabled. Disabling it must immediately
  stop analysis and comment writes, preserve every session setting, and reload
  the csTimer tab once so the already-registered native tool is removed.
  Re-enabling must reinstall the page adapter without requiring a manual tab
  reload.
- Badge messaging must catch both rejected promises and synchronous
  `Extension context invalidated` exceptions. Reloading an unpacked extension
  leaves stale scripts in already-open csTimer tabs until those tabs reload;
  this normal development transition must not create extension errors.
- Register `BLD Algcount` as its own native csTimer tool and leave it in
  csTimer's native appended position. Never reorder the rendered `<option>`
  nodes: `TwoLvMenu` resolves tools through a private data array by selected
  index, so DOM-only reordering makes adjacent labels execute each other's
  tools. Never inject into or alter `Confirm time`.
  The selected tool immediately shows the latest existing solve, or `No solves
  in this session yet.` only when the session is empty.
- Render only the algcount value, without a redundant `Latest solve` caption.
  Inherit csTimer's native tool font and size instead of forcing extension
  typography. Do not force a minimum content height; let the native tool wrap
  the value with only modest vertical padding.
- Support the 14 templates defined in `src/comment-format.js`. `N` is the fixed
  `UF/UFR`/no-LTCT baseline, `M` is the selected setup's final total, and
  comparison templates render `N->M` only on the total while `C` and `E` show
  final component values.
- Support the six comparison-arrow styles defined in `src/comment-format.js`;
  ASCII `->` is the default and saved per session. Comparison-template labels
  must preview the currently selected arrow without changing their stored IDs.
  Disable and dim the arrow control when neither floating nor LTCT is active.
- When floating and/or Advanced saves algs, mirror the main SSI comparison
  semantics: compare against fixed `UFR/UF` with Advanced disabled, render
  arrows on the reduced total, and optionally append `LTCT` or `T2C` only when
  that finish actually applies.
- A DNF does not suppress comment generation; the scramble still has an alg
  count.
- Calculate with the selected tracing setup and preserve the production SSI
  convention that parity belongs to the corner count.
- Partial floating always includes the primary `UFR` corner buffer and `UF`
  edge buffer. Their checked popup pills are disabled, and invalid settings that
  omit either primary buffer are rejected rather than migrated.
- If a supported-type calculation fails, treat the scramble as unsupported and
  leave the original comment unchanged. If persistence fails, leave the
  original comment unchanged and surface an error.
- Keep all computation local. Do not add a backend or remote analytics without
  explicit user approval.

## UI And Copy Decisions

- Display only the human session name prominently; do not expose csTimer's
  internal session index or raw scramble-type code such as `333ni`.
- Display the manifest version as a subdued badge at the right of the popup
  title row; do not maintain a separate hardcoded display version.
- Keep the orientation explanation consistent with the main SSI app: “Tracing
  orientation is ___ away from scrambling orientation.” The `?` control must
  reveal this text on hover and keyboard focus/click.
- Put the global enabled-by-default **Extension** switch directly below the
  popup title. It controls the entire integration; the current-session card
  still contains only the optional `Save algcount to comment` toggle.
- Constrain the popup root document to 390 pixels wide. Setting only the body
  width can leave Chromium's 800-pixel popup viewport exposed as blank space.
- Hide the popup's visual scrollbar and gutter without disabling document
  scrolling; Chromium otherwise adds an asymmetric strip beside the 390-pixel
  layout.
- The popup session chip says `Connected` whenever the page bridge is ready.
- When csTimer is unavailable, place the actionable reload/reopen guidance
  directly below `csTimer not connected` in the session card instead of as a
  detached status message at the bottom of the popup.
- Popup changes save automatically per session. Selects and checkboxes save
  immediately; orientation and weight inputs use a short debounce so typing
  does not write storage on every keystroke. Do not reintroduce a Save button.
- Use the labels `Floating 2-flip weight` and `Floating 2-twist weight`; both
  accept finite values `>= 1` with `0.01` precision.
- Use the extension's text-free geometric cube mark rather than an `SSI`
  letter tile.
- Repeat the cube mark at the left of the popup title block so the toolbar,
  popup, and SSI favicon share an immediately recognizable product identity.
- Do not repeat `Scramble Set Insight` as an eyebrow above the extension name;
  the shared cube mark already carries that parent-product identity.
- The result-display checkboxes from the main SSI web app do not apply here.
- The setup label is `Advanced`, with `None`, `LTCT`, and `T2C`. T2C is enabled
  only in full floating; switching away from full floating downgrades it to
  LTCT because T2C users also know LTCT.
- `Add finish label` stays disabled while Advanced is `None` and applies to the
  formatted algcount used by the tool and optional comment.
- In standard `UF/UFR` mode with LTCT off, offer only baseline `N` templates.
  Floating or LTCT replaces those with comparison and final `M` templates;
  never offer a baseline-only comment when either saving technique is active.
  Migrate a stored baseline template to its matching final template. List the
  five final `M` templates before the four comparison templates.
- Show the `N`/`M` hint only when a comparison applies, naming the active
  source precisely: `LTCT`, `T2C`, `floating`, or the matching combination.
- Migrate stored legacy `ltct`/`commentLtct` settings to
  `finishCapability: ltct`/`commentFinish`; normalize stored sub-unit weights
  to `1`.

## Versioning

`manifest.json` is authoritative:

- Patch: fixes, copy, styling, tests, and asset changes.
- Minor: new user-visible behavior or capabilities that preserve stored config.
- Major: incompatible stored-setting, integration, or workflow changes.

Every completed extension change should include an appropriate version bump.
Avoid bumping repeatedly for multiple edits that are still part of one
unfinished change set.

## Verification

Run from this directory with the bundled or system Node.js runtime:

```sh
node scripts/sync-ssi-engine.mjs check
node tests/test-extension.js
node --check popup/popup.js
node --check src/content.js
node --check src/page-adapter.js
```

The sync check and extension test must fail if the generated mirror drifts from
the production `web/` engine. Keep `node scripts/watch-ssi-engine.mjs` running
during shared-engine development, or run the one-time sync command after a
change. Reload the unpacked extension and then the csTimer tab so Chromium
reloads changed content scripts.

For UI work, also serve the folder locally and inspect `popup/popup.html` at its
narrow extension width. Before a real csTimer test, reload the unpacked
extension and then reload the csTimer tab so its content scripts are refreshed.

## Change Discipline

- Keep the extension inside `extension/`; never initialize another nested Git
  repository for it.
- Never patch `vendor/ssi-core/*.js`; patch the parent `web/`, then
  let the watcher mirror it or run `node scripts/sync-ssi-engine.mjs sync`.
- Run the main SSI parity suite and the extension suite after any shared engine
  change. Use `node scripts/build-unpacked.mjs` when a self-contained folder is
  needed; do not load or package dangling external links.
- Update this handoff whenever an agent would otherwise need conversation
  history to understand an important decision.
