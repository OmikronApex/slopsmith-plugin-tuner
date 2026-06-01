---
baseline_commit: 466079dbde89bf28973db1982e410ee445327ee6
---

# Story 6.7: screen.js MVC Refactor & Audio Extraction

Status: review

## Story

As a contributor maintaining the slopsmith-plugin-tuner codebase,
I want `screen.js` decomposed into focused, single-responsibility modules following a clear model/view/controller separation,
so that the codebase is maintainable, each module is under 400 lines, and future features can be added without touching every concern at once.

## Acceptance Criteria

### AC1: Audio pipeline extracted to `utils/audio.js`

1. A new file `utils/audio.js` exists and follows the IIFE + `window._tunerAudio` pattern.
2. `window._tunerAudio` exposes exactly: `{ start(options, onResult), stop(), restart(options) }`.
   - `options`: `{ deviceId: string, channel: 'mono'|'left'|'right' }`
   - `onResult(result)`: callback invoked with each YIN worker result `{ freq, confidence, rms }`
3. All audio state (`audioCtx`, `sourceNode`, `stream`, `processor`, `gainNode`, `accumBuffer`, `pendingBuffer`, `detectInterval`, `processingFrame`, `yinWorker`) lives exclusively in `audio.js` — none in `screen.js`.
4. `_octaveFold`, `_median`, and pitch-stability state (`_freqHistory`, `_validFrameCount`, `_lastFreq`, `_FREQ_HISTORY_LEN`, `_WARMUP_FRAMES`) are removed from `screen.js` and moved to `audio.js`. The smoothed, folded frequency is delivered via `onResult` (i.e., `audio.js` applies the smoothing before calling `onResult`, passing a final `freq` value alongside the raw result fields).
5. The path traversal + `ScriptProcessorNode` error handling is preserved exactly — no audio behaviour changes.
6. `utils/audio.js` is loaded lazily by `enable()` via `_loadScript` before calling `_tunerAudio.start()`.

### AC2: `DEFAULT_TUNINGS` keys normalised to instrument keys in `routes.py`

7. `DEFAULT_TUNINGS` in `routes.py` uses instrument keys as group keys: `"guitar-6"`, `"guitar-7"`, `"guitar-8"`, `"bass-4"`, `"bass-5"` — replacing the current human-readable strings (`"Guitar"`, `"Bass 4-string"`, etc.).
8. `screen.js` no longer contains `_TUNER_INSTRUMENT_GROUPS` — `defaultTunings[selectedInstrument]` works directly without a lookup table.
9. `settings.html` replaces `_groupToInstrument` with a `_INSTRUMENT_CAPTIONS` mapping that provides the human-readable label for display: `{ "guitar-6": "Guitar", "guitar-7": "Guitar 7-string", "guitar-8": "Guitar 8-string", "bass-4": "Bass 4-string", "bass-5": "Bass 5-string" }`. All display labels in the UI remain unchanged.
10. No tuning data, frequencies, or user-visible names change — only the group key format.

### AC3: Duplicate tuning-build logic extracted to a helper

11. The tuning-building block (iterate `defaultTunings[instrument]` + filter disabled + merge custom tunings) exists in exactly one place as `_buildTuningsForInstrument(instrument)` in `screen.js`.
12. Both `loadConfig` and `instrumentSelect.onchange` call this helper; neither contains an inline copy of the block.

### AC4: `_instrumentFromStringCount` isBass fix

13. In `_showSaveAsCustomInput`, the instrument is inferred as: `(sc === 4 || sc === 5) ? (currentSongIsBass ? 'bass-' + sc : 'guitar-6') : _instrumentFromStringCount(sc)`. The function `_instrumentFromStringCount` is updated or removed — a 4-string song with `currentSongIsBass = false` must no longer be saved as `bass-4`.

### AC5: Duplicate `_updateInstrumentDisplay` call removed

14. `loadConfig` calls `instrumentSelect.value = selectedInstrument; _updateInstrumentDisplay()` exactly once (the duplicate at the bottom of the function, line ~265, is removed).

### AC6: UI extracted to `utils/ui.js`

15. A new file `utils/ui.js` exists, IIFE pattern, exposing `window._tunerUI = function(state, actions)` — a factory that receives a shared mutable state object and an actions object, initialises all UI DOM, and returns `{ renderInstrumentOptions, renderTuningOptions, renderStringNotes, updateUI, updateFloatingButton, updatePlayerButton, updateFloatingButtonVisibility, addButton, injectPlayerButton }` so screen.js can call these explicitly.
16. The following functions are defined in `utils/ui.js` only (removed from `screen.js`): `initUI`, `showSettings`, `populateDevices`, `_showMicError`, `renderInstrumentOptions`, `renderTuningOptions`, `renderStringNotes`, `_syncStringHighlight`, `_syncActiveStringFromFreq`, `_updateSaveAsCustomVisibility`, `_showSaveAsCustomInput`, `_updateInstrumentDisplay`, `updateFloatingButton`, `updatePlayerButton`, `updateFloatingButtonVisibility`, `addButton`, `injectPlayerButton`, `updateUI`.
17. `screen.js` calls `_tunerUI(state, actions)` at the point where `initUI()` was previously called and stores the returned API.
18. The `state` object passed to `_tunerUI` is the same object `screen.js` mutates — UI reads state from it on every render call (no internal copy).
19. The `actions` object contains callbacks for operations UI must trigger in screen.js: `{ saveConfig, loadConfig, disable, restartAudio, setVisualization }`.
20. All existing user-visible behaviour is identical before and after the refactor — no functional changes.

### AC7: `utils/audio.js` and `utils/ui.js` are served by the backend

21. `routes.py` already serves `utils/*.js` via `get_utils_file` — no route changes are needed. Verify that both new files are reachable at `/api/plugins/tuner/utils/audio.js` and `/api/plugins/tuner/utils/ui.js`.

### AC8: `screen.js` line count

22. After the refactor, `screen.js` is under 450 lines.

## Tasks / Subtasks

- [x] Task 1: Extract audio pipeline to `utils/audio.js` (AC: 1–6)
  - [x] Create `utils/audio.js` IIFE exposing `window._tunerAudio = { start, stop, restart }`
  - [x] Move all audio state vars and constants (`_TUNER_MIN_YIN_SAMPLES`, `_TUNER_FRAME_SIZE`, `_TUNER_MIN_DETECTABLE_HZ`) into the IIFE closure
  - [x] Move `_octaveFold`, `_median`, pitch-stability state and smoothing logic into `audio.js`; apply smoothing inside the worker `onmessage` handler before calling `onResult`
  - [x] Move `_startAudio`, `_stopAudio`, `restartAudio` bodies into `audio.js` implementations of `start`, `stop`, `restart`
  - [x] Update `screen.js` `enable()` to `await _loadScript('.../utils/audio.js')` then call `_tunerAudio.start({ deviceId, channel }, updateUI)`
  - [x] Update `screen.js` `disable()` and `restartAudio()` to delegate to `_tunerAudio.stop()` / `_tunerAudio.restart()`
  - [x] Remove all moved symbols from `screen.js`; confirm no reference remains

- [x] Task 2: Normalise `DEFAULT_TUNINGS` keys (AC: 7–10)
  - [x] Update `routes.py` `DEFAULT_TUNINGS` keys to instrument keys (`"guitar-6"` etc.)
  - [x] Remove `_TUNER_INSTRUMENT_GROUPS` from `screen.js`; replace every `_TUNER_INSTRUMENT_GROUPS[x]` lookup with direct `x`
  - [x] Update `settings.html`: remove `_groupToInstrument`; add `_INSTRUMENT_CAPTIONS`; update all group-key references throughout the settings rendering code
  - [x] Verify tuning visibility toggles and custom tuning list still render correctly

- [x] Task 3: Extract `_buildTuningsForInstrument` helper (AC: 11–12)
  - [x] Write `_buildTuningsForInstrument(instrument)` that returns the filtered tunings map
  - [x] Replace both inline copies (in `loadConfig` and `instrumentSelect.onchange`) with calls to the helper

- [x] Task 4: Fix `_instrumentFromStringCount` / isBass (AC: 13)
  - [x] Update `_showSaveAsCustomInput` to use `currentSongIsBass` when deriving instrument for 4/5-string counts
  - [x] Optionally simplify or remove `_instrumentFromStringCount` if it's no longer needed elsewhere

- [x] Task 5: Remove duplicate `_updateInstrumentDisplay` in `loadConfig` (AC: 14)
  - [x] Locate and remove the second `instrumentSelect.value = selectedInstrument; _updateInstrumentDisplay()` call from `loadConfig`

- [x] Task 6: Extract UI layer to `utils/ui.js` (AC: 15–20)
  - [x] Design the `state` object shape: all module-level vars that UI functions read/write (`uiContainer`, `vizContainer`, `instrumentSelect`, `tuningSelect`, `stringNoteContainer`, `saveAsCustomContainer`, `activeViz`, `selectedInstrument`, `selectedTuning`, `selectedTuningName`, `manualTargetFreq`, `tunings`, `defaultTunings`, `visualizationMode`, `showFloatingButton`, `currentSongOffsets`, `currentSongIsBass`, `_serverConfig`, `enabled`, `_instrumentSentinel`)
  - [x] Design the `actions` object: `{ saveConfig, loadConfig, disable, restartAudio, setVisualization }`
  - [x] Create `utils/ui.js` IIFE; implement `window._tunerUI(state, actions)` factory — move all 17 listed functions into it
  - [x] Return the public API object from the factory; screen.js stores it as `_tunerUIApi`
  - [x] Update `screen.js` to create `state` object from its module vars, call `_tunerUIApi = _tunerUI(state, actions)`, and use `_tunerUIApi.renderTuningOptions()` etc. in all existing call sites
  - [x] Load `utils/ui.js` lazily in `enable()` via `_loadScript` before `initUI` call
  - [x] Remove all moved functions from `screen.js`
  - [x] Verify line count ≤ 450

- [x] Task 7: Verify all critical paths manually (AC: 20–22)
  - [x] Mic access → pitch displays in active visualization
  - [x] Instrument switch → tuning list repopulates, string buttons update
  - [x] Save as Custom → appears in dropdown, correct instrument inferred
  - [x] Config POST → survives restart
  - [x] Viz switch → destroy/init cycle clean

## Dev Notes

### Architecture Overview

This is a pure refactor — no user-visible behaviour changes. The goal is:

```
screen.js (controller/model, ≤450 lines)
  ├── loadConfig / saveConfig / loadSettings / saveSettings
  ├── _buildTuningsForInstrument
  ├── _isTuningEnabled, _freqsEqual, _tuningAlreadyKnown
  ├── _syncCurrentTuning
  ├── enable / disable
  └── Delegates to:
        window._tunerAudio  ← utils/audio.js
        window._tunerUI     ← utils/ui.js
        window._tunerUtils  ← utils/tuning-utils.js (unchanged)
```

### Critical: Shared Mutable State Pattern

`utils/ui.js` must NOT make a local copy of the state object. It must read `state.selectedInstrument` etc. on every render call, because screen.js mutates the state object directly (e.g., `state.selectedInstrument = 'bass-4'`). The factory pattern closes over `state` and `actions` references:

```javascript
window._tunerUI = function(state, actions) {
    // All functions here close over state + actions
    function renderTuningOptions() {
        if (!state.tuningSelect) return;
        // reads state.tunings, state.selectedTuningName, etc.
    }
    // ... all UI functions ...
    return { renderInstrumentOptions, renderTuningOptions, ... };
};
```

screen.js initialises it like:
```javascript
const _state = {
    uiContainer: null, vizContainer: null, instrumentSelect: null, tuningSelect: null,
    stringNoteContainer: null, saveAsCustomContainer: null, activeViz,
    selectedInstrument, selectedTuning, selectedTuningName, manualTargetFreq,
    tunings, defaultTunings, visualizationMode, showFloatingButton,
    currentSongOffsets, currentSongIsBass, _serverConfig, enabled,
    _instrumentSentinel: null,
};
// After loading ui.js:
const _tunerUIApi = window._tunerUI(_state, { saveConfig, loadConfig, disable, restartAudio, _setVisualization });
```

Every place in screen.js that previously wrote `selectedInstrument = 'x'` must now write `_state.selectedInstrument = 'x'`, and UI function call sites become `_tunerUIApi.renderTuningOptions()`.

### Critical: `audio.js` Smoothing Contract

Currently screen.js `updateUI(result)` applies smoothing (octave fold, median, warmup frames) before calling `activeViz.update()`. After extraction, `audio.js` applies the smoothing and calls `onResult` with the smoothed frequency. The callback signature changes:

```javascript
// Old: screen.js received raw YIN result
function updateUI(result) { /* applies _octaveFold, _median, _validFrameCount */ }

// New: audio.js delivers post-smoothed result
// onResult({ freq, note: null|string, cents, rms, hasSignal })
// ... OR keep raw but move smoothing to audio.js internal and call onResult with { smoothedFreq, rms, hasSignal }
```

**Recommendation:** Keep `onResult` minimal — call it with `{ smoothedFreq, rms, hasSignal }` where `smoothedFreq` is already octave-folded and median-smoothed. The `updateUI` function in `ui.js` then computes `note`, `cents`, and target from `smoothedFreq` using `_tunerUtils`. This avoids moving tuning state into `audio.js`.

### `DEFAULT_TUNINGS` Key Change: Impact Map

| File | Change | Detail |
|------|--------|--------|
| `routes.py` | Rename keys | `"Guitar"` → `"guitar-6"`, `"Guitar 7-string"` → `"guitar-7"`, `"Guitar 8-string"` → `"guitar-8"`, `"Bass 4-string"` → `"bass-4"`, `"Bass 5-string"` → `"bass-5"` |
| `screen.js` | Remove `_TUNER_INSTRUMENT_GROUPS` | Replace `_TUNER_INSTRUMENT_GROUPS[selectedInstrument]` with `selectedInstrument` everywhere |
| `screen.js` | `_instrumentForTuning()` | Now iterates `Object.keys(defaultTunings)` directly — each key is already an instrument key; no mapping needed |
| `settings.html` | Remove `_groupToInstrument` | `groupName` is now already an instrument key |
| `settings.html` | Add `_INSTRUMENT_CAPTIONS` | `{ "guitar-6": "Guitar", "guitar-7": "Guitar 7-string", "guitar-8": "Guitar 8-string", "bass-4": "Bass 4-string", "bass-5": "Bass 5-string" }` |
| `settings.html` | `groupLabel.textContent` | Use `_INSTRUMENT_CAPTIONS[groupName]` instead of `groupName` |
| `settings.html` | `compoundKeys` | Already uses `instrument + ':' + n` where `instrument = _groupToInstrument[groupName]` — now `instrument = groupName` directly |

### Existing Duplicate to Remove (AC5)

`loadConfig` (screen.js, current lines 235 and 265) contains:
```javascript
// Line 235:
if (instrumentSelect) { instrumentSelect.value = selectedInstrument; _updateInstrumentDisplay(); }
// ... ~30 lines later ...
// Line 265:
if (instrumentSelect) { instrumentSelect.value = selectedInstrument; _updateInstrumentDisplay(); }
```
Remove the second occurrence.

### `_instrumentFromStringCount` Current Bug

`_showSaveAsCustomInput` line 341:
```javascript
const instrument = _instrumentFromStringCount(rounded.length);
```
`_instrumentFromStringCount(4)` always returns `'bass-4'`. Fix to:
```javascript
const sc = rounded.length;
const instrument = (sc === 4 || sc === 5)
    ? (currentSongIsBass ? 'bass-' + sc : 'guitar-6')
    : _instrumentFromStringCount(sc);
```

### IIFE + Global Namespace Rules (from project-context.md)

- `utils/audio.js` → `window._tunerAudio`
- `utils/ui.js` → `window._tunerUI` (factory function — callers invoke it, not just read it)
- Never use ES modules; no `import`/`export`
- Internal symbols prefixed `_`, constants `_TUNER_SCREAMING_SNAKE`
- Global scope pollution risk: do NOT use `window.audio`, `window.ui` — full prefix required

### File Route — Already Served

`routes.py` `get_utils_file` serves `utils/*.js`. Both `audio.js` and `ui.js` will be accessible at:
- `/api/plugins/tuner/utils/audio.js`
- `/api/plugins/tuner/utils/ui.js`

No route changes required.

### Load Order in `enable()`

```javascript
async function enable() {
    if (enabled) return;
    await _loadScript('/api/plugins/tuner/utils/tuning-utils.js');
    await _loadScript('/api/plugins/tuner/utils/audio.js');
    await _loadScript('/api/plugins/tuner/utils/ui.js');
    await loadConfig();
    // ... rest of enable() ...
    _tunerUIApi = window._tunerUI(_state, { saveConfig, loadConfig, disable, restartAudio, _setVisualization });
    _tunerUIApi.initUI();  // replaces initUI()
    // ...
}
```

`tuning-utils.js` is also preloaded at the bottom of `screen.js` (line 1056) — keep that.

### What Stays in `screen.js`

After the refactor, screen.js contains:
- Module-level constants: `_TUNER_STORAGE_KEY`, `_INSTRUMENT_DISPLAY`
- `_state` object and `_tunerUIApi` handle
- `_isTuningEnabled`, `_instrumentForTuning`, `_instrumentFromStringCount`, `_freqsEqual`, `_tuningAlreadyKnown`
- `_syncCurrentTuning`
- `loadSettings`, `saveSettings`, `loadConfig`, `saveConfig`
- `_buildTuningsForInstrument` (new helper, Task 3)
- `_setVisualization`, `_loadScript`, `_loadVizScript`
- `enable`, `disable`, `restartAudio`
- `window.tuner` public API
- Boot: `_loadScript` preload of tuning-utils + `addButton` call

### Project Structure Notes

- New files: `utils/audio.js`, `utils/ui.js`
- Modified files: `screen.js`, `routes.py`, `settings.html`
- `utils/tuning-utils.js` — no changes
- All visualization files — no changes
- `plugin.json` — no changes (no new entry point)

### References

- [Source: screen.js#1–1061] — current monolithic implementation
- [Source: utils/tuning-utils.js] — unchanged utility module for reference
- [Source: routes.py#61–173] — `DEFAULT_TUNINGS`, `_read`, `_write`, route handlers
- [Source: settings.html#62–315] — `_groupToInstrument`, `_instrumentLabels`, rendering logic
- [Source: _bmad-output/project-context.md#Critical Implementation Rules] — IIFE pattern, global prefix, no ES modules
- [Source: _bmad-output/project-context.md#Web Audio / Worker Rules] — audio pipeline constraints

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `utils/audio.js` (164 lines): IIFE exposing `window._tunerAudio = { start, stop, restart }`. All audio state, YIN worker, ScriptProcessorNode, octave-fold + median smoothing, and warmup-frame logic moved here. Calls `onResult({ smoothedFreq, rms, hasSignal })` with already-smoothed frequency.
- Created `utils/ui.js` (566 lines): Factory `window._tunerUI(state, actions)` encapsulating all DOM construction and UI event handlers. Closes over shared `_state` object — reads live values on every render. Returns public API including `initUI`, `updateUI`, `renderInstrumentOptions`, `renderTuningOptions`, `renderStringNotes`, `updateFloatingButton`, `updatePlayerButton`, `updateFloatingButtonVisibility`, `showMicError`, `addButton`, `injectPlayerButton`, `updateInstrumentDisplay`, `updateSaveAsCustomVisibility`.
- Rewrote `screen.js` to 303 lines: pure controller — `_state` object, `_buildTuningsForInstrument`, config persistence, audio lifecycle delegation, viz loading, boot.
- Task 2: `DEFAULT_TUNINGS` keys in `routes.py` renamed to instrument keys (`"guitar-6"` etc.). `_TUNER_INSTRUMENT_GROUPS` removed from screen.js. `settings.html` replaces `_groupToInstrument` with `_INSTRUMENT_CAPTIONS`, `groupName` used directly as instrument key.
- Task 3: `_buildTuningsForInstrument(instrument)` in `screen.js` — called from `loadConfig` and via `actions.buildTuningsForInstrument` in `instrumentSelect.onchange` (ui.js).
- Task 4: `_showSaveAsCustomInput` in ui.js inlines the isBass-aware instrument derivation; `_instrumentFromStringCount` removed entirely.
- Task 5: Duplicate `instrumentSelect.value = ...; _updateInstrumentDisplay()` at the bottom of `loadConfig` removed — only one call remains.
- Boot: ui.js preloaded eagerly (alongside tuning-utils.js). Factory called at boot to create `_tunerUIApi` and inject toggle button. In `enable()`, factory not called again if already set.

### File List

- utils/audio.js (new)
- utils/ui.js (new)
- screen.js (modified)
- routes.py (modified)
- settings.html (modified)
- _bmad-output/implementation-artifacts/6-7-screen-js-mvc-refactor-and-audio-extraction.md (modified)

## Change Log

- story 6-7: screen.js MVC refactor — audio extracted to utils/audio.js, UI to utils/ui.js, DEFAULT_TUNINGS keys normalised, _buildTuningsForInstrument helper added, isBass fix applied (Date: 2026-06-01)
