# Story 1.2: Fix Default Visualization Initialisation

Status: ready-for-dev

## Story

As a new Slopsmith user installing the tuner plugin,
I want the tuner panel to open with the Default (needle/gauge) visualization on first use,
so that my initial experience matches the intended design and is consistent with the server-side config default.

## Acceptance Criteria

1. The hardcoded initialisation value for `visualizationMode` in `screen.js` is `"default"`, not `"strobe"`.
2. The config-fetch fallback in `loadConfig()` defaults to `"default"` when `config.visualizationMode` is absent, not `"strobe"`.
3. A user with an existing saved visualization preference (`tuner.json` contains `visualizationMode`) continues to have that preference respected — no regression.
4. The critical paths from project-context.md pass after the fix: mic access → YIN → pitch display; viz switch → destroy/init cycle.

## Tasks / Subtasks

- [ ] Task 1: Fix line 43 — module-level default (AC: 1)
  - [ ] Change `let visualizationMode = 'strobe';` → `let visualizationMode = 'default';`
- [ ] Task 2: Fix line 124 — config-fetch fallback (AC: 2)
  - [ ] Change `visualizationMode = config.visualizationMode || 'strobe';` → `visualizationMode = config.visualizationMode || 'default';`
- [ ] Task 3: Manual verification (AC: 3, 4)
  - [ ] Open tuner on a fresh install (no saved config) — confirm Default viz loads
  - [ ] Open tuner with saved `visualizationMode: "strobe"` in config — confirm Strobe loads
  - [ ] Switch viz in settings panel → confirm destroy/init cycle works cleanly

## Dev Notes

**This is a two-line fix in a single file: `screen.js`.** Do not touch any other file.

### Exact Changes

**Location 1** — `screen.js` line 43, in the module-level state declarations:

```js
// BEFORE (bug):
let visualizationMode = 'strobe';

// AFTER (fix):
let visualizationMode = 'default';
```

**Location 2** — `screen.js` line 124, inside `loadConfig()`:

```js
// BEFORE (bug):
visualizationMode = config.visualizationMode || 'strobe';

// AFTER (fix):
visualizationMode = config.visualizationMode || 'default';
```

### What to Preserve (Do Not Touch)

- The settings panel viz selector HTML (line 334–337) already correctly shows `"default"` as the first option — no change needed there.
- The `_setVisualization(name)` function — no changes needed.
- All other state variables and their defaults — no changes needed.
- `routes.py` — the backend config default is already `"default"`; this fix aligns the JS fallback with it.

### Why Two Locations

- **Line 43** is the in-memory default used if `loadConfig()` is never called or called after `_setVisualization`. On first `enable()`, `loadConfig()` is called and its result overwrites this value — but if the fetch fails (FR-34 degraded mode), line 43 is what the plugin falls back to. Both must be `"default"`.
- **Line 124** is the explicit fallback inside `loadConfig()` when the config file doesn't contain a `visualizationMode` key (e.g., brand-new install, or config was manually cleaned). This is the primary bug path for new users.

### Critical Project Rules (from project-context.md)

- **IIFE only** — do not introduce `import`/`export`; this is a plain edit inside the existing IIFE.
- **Never call `activeViz.update()` after `destroy()`** — the existing null-check guard on `activeViz` handles this; do not remove it.
- **Global prefix** — no new globals introduced by this fix.
- **No test suite** — verify manually via the critical paths listed in Task 3.

### References

- [Source: screen.js#43] — module-level `visualizationMode` declaration
- [Source: screen.js#124] — `loadConfig()` config-fetch fallback
- [Source: _bmad-output/planning-artifacts/prds/prd-slopsmith-plugin-tuner-2026-05-30/prd.md#FR-17] — canonical default is "Default"; "strobe" initialisation is a documented bug
- [Source: _bmad-output/planning-artifacts/prds/prd-slopsmith-plugin-tuner-2026-05-30/.decision-log.md] — OQ-02 resolution: Default is canonical default for new installs

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `screen.js` (UPDATE — lines 43 and 124 only)
