# Project handoff

## Current state

`csTimer Auto Algcount` is at version `1.8.3`. This standardized handoff was established on
2026-08-21; earlier project history is preserved only where existing source records
or Git commits prove it.

## Orientation

- `manifest.json` is the canonical version source.
- `AGENTS.md` contains the detailed behavior, architecture, versioning rules, and safety invariants.
- The extension is integrated at `extension/` inside the parent SSI repository
  and is governed by the parent's single Git worktree.
- It mirrors the handwritten engine from the parent `web/` directory through
  `scripts/sync-ssi-engine.mjs`.

## Verification

- `node scripts/sync-ssi-engine.mjs check`
- `node tests/test-extension.js`

## Known issues and next work

- Keep this handoff concise and update it only when current takeover facts change.
