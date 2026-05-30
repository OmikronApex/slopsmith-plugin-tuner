# Codebase Reconciliation — slopsmith-plugin-tuner PRD

**PRD:** `prd-slopsmith-plugin-tuner-2026-05-30/prd.md`
**Codebase root:** `C:\Users\rkasp\PycharmProjects\slopsmith-plugin-tuner`
**Date:** 2026-05-30

---

## Summary

Overall the PRD is a faithful description of the codebase. Most features and behaviors are correctly represented. The gaps below are real discrepancies — either the PRD is silent on a behavior present in code, misstates a behavior, or vice versa.

---

## GAP-01 — `visualizationMode` default mismatch (PRD mentions it as open question, but the direction is inverted)

**Severity:** Medium

**What the code does:**
- `screen.js` line 43: `let visualizationMode = 'strobe';` — the in-memory default before any config is loaded is `'strobe'`.
- `routes.py` line 45: `"visualizationMode": "default"` — the server-side default written to new config files is `"default"`.

**What the PRD says:**
OQ-02 correctly notes the inconsistency but frames it as an open question. The PRD does not state either value as the canonical default anywhere in the requirements body.

**Impact:** A new install with no existing config file will load `routes.py`'s `"default"` from the GET `/api/plugins/tuner/config` response, overwriting the `'strobe'` JS initializer — so `routes.py` effectively wins. However, if the config fetch fails (network/FS error), `screen.js` falls back to `'strobe'`. The effective canonical default under normal operation is `"default"` (backend), but the PRD requirements body (`FR-17`, `FR-18`, `NFR-06`) never documents which visualization loads first for a brand-new user.

**Recommendation:** Resolve OQ-02 and encode the answer as a stated default in FR-18 or a new FR.

---

## GAP-02 — `localStorage` only persists `deviceId` and `channel`; other settings are server-persisted only

**Severity:** Medium

**What the code does:**
`screen.js` `saveSettings()` (lines 109-116) writes only `{ deviceId, channel }` to `localStorage`. All other persistent state (`lastTuning`, `visualizationMode`, `showFloatingButton`, `customTunings`, `disabledTunings`) is server-persisted via `POST /api/plugins/tuner/config`.

**What the PRD says:**
FR-21: "Audio device and channel preferences shall persist across sessions via `localStorage`." — correct.
FR-32: "Plugin settings (last tuning, visualization mode, custom tunings, disabled tunings, floating button visibility) shall be persisted server-side via the Slopsmith plugin config API." — correct.

But the PRD has no requirement covering what happens when the Slopsmith server is unreachable — the `loadConfig()` catch block (line 146) silently swallows the error and leaves all server-persisted settings at their in-memory defaults. This silent failure path is undocumented.

**Recommendation:** Add an NFR or FR clarifying the degraded-mode behavior when the config API is unavailable (e.g., "fall back silently to in-memory defaults; do not surface a fatal error to the user").

---

## GAP-03 — Error handling covers an undocumented fourth error branch (`OverconstrainedError` without a saved device)

**Severity:** Low-Medium

**What the code does:**
`_startAudio()` in `screen.js` (lines 396-404) handles four distinct error cases:
1. `OverconstrainedError` + saved device → clears device ID, retries without `deviceId` or `channelCount`.
2. `NotFoundError` + saved device → clears device ID, retries.
3. `OverconstrainedError` without saved device → retries without `channelCount` (device rejects stereo).
4. Any other error → re-throws, surfacing the mic error banner.

**What the PRD says:**
FR-22 covers cases 1 and 2 ("rejects `channelCount: 2`, or is otherwise unconstrained" / "no longer available"). But FR-22 does not explicitly mention case 3 — the device-present-but-mono-only fallback when no device ID was saved. FR-24 / the error table covers only `NotAllowedError`, `NotFoundError`, `NotReadableError`, and `AbortError`, omitting `OverconstrainedError` from the user-visible error surface (though in practice case 3 never reaches the banner because it is retried silently).

**Recommendation:** Extend FR-22 to explicitly mention the no-saved-device `OverconstrainedError` path, or add a note that this case is silently retried and never shown to the user.

---

## GAP-04 — `getTuningName` in `tuning-utils.js` recognizes more named tunings than the PRD's FR-12 implies

**Severity:** Low

**What the code does:**
`tuning-utils.js` `getTuningName()` (lines 18-49) resolves the following named patterns beyond standard and drop tunings:
- Double Drop D (`-2,-2,0,0,0,0`)
- Open D (`-2,-2,0,0,-2,-2`)
- DADGAD (`-2,0,0,0,-2,0`)
- Open E (`0,2,2,1,0,0`)
- Open D alt (`-2,0,0,2,3,2`)
- Drop C on guitar (`-4,-2,-2,-2,-2,-2`)
- All standard offsets from −7 to +2 semitones

**What the PRD says:**
FR-12 says: "A human-readable tuning label (e.g., 'Drop D', 'Eb Standard') shall be derived from the offset pattern." This is accurate but understates the breadth — the utility handles at least 10+ named patterns. More importantly, the 5-string and 4-string bass `getTuningName` logic only handles 4 or 6 string counts (line 21: `if (len !== 6 && len !== 4) return offsets.join(' ')`), meaning 5-string bass songs will always return raw offset numbers as the label rather than a name, even for standard or drop tunings. This behavioral edge case is not captured anywhere in the PRD.

**Recommendation:** Note in FR-12 that the label derivation currently only applies to 4-string and 6-string arrangements; 5-string bass returns a raw offset list.

---

## GAP-05 — `disable()` closes the tuner on ANY `screen:changed` event, not just non-player screens

**Severity:** Low

**What the code does:**
Inside `enable()` (lines 496-503), the `_onScreenChanged` listener is: `() => { disable(); }` — it fires unconditionally on every `screen:changed` event, including when navigating *to* the player (even though the player has its own tuner button).

The `addButton()` handler (lines 660-668) also calls `disable()` via `handlePlay()` whenever the screen changes to `'player'`.

**What the PRD says:**
FR-31: "The tuner panel shall close automatically when the user navigates to a different Slopsmith screen." — implies close on navigation *away from* the current screen, but in practice the tuner closes when navigating to *any* screen, including the player. If the user had the tuner open on, say, a library screen and then navigated to another non-player screen, the tuner closes — that matches FR-31. But if the user is on the player screen and opens the tuner then navigates to a second non-player screen, it also closes — which FR-31 describes.

The subtle gap: FR-28 says "The floating button shall be hidden during active song playback and when the player screen is active," but there is no requirement stating that opening the tuner from the player button and then navigating to another screen will also close the tuner. The code does this correctly, but the PRD is silent on whether the tuner should auto-close on player → other-screen navigation.

**Recommendation:** Clarify FR-31 to read "...when the user navigates away from the current screen" and confirm the behavior applies equally when the tuner is opened from the player button.

---

## GAP-06 — `saveConfig()` is NOT called when changing the tuning to `_current` (Current Song)

**Severity:** Low

**What the code does:**
`screen.js` line 288: `if (selectedTuningName !== '_current') saveConfig();` — if the user selects "Current Song," the `lastTuning` is NOT saved to server config. This means after a session where the user selected Current Song, the server still has the previous `lastTuning` value, and the plugin will restore the old preset on next open rather than attempting to restore Current Song.

**What the PRD says:**
FR-32 says last tuning shall be persisted, and FR-10 describes the "Current Song" option. Neither FR explicitly says what `lastTuning` should be when Current Song is selected, or that saving should be skipped. The code's behavior is defensible (Current Song is ephemeral), but the PRD is silent on this design decision.

**Recommendation:** Add a note to FR-32 or FR-10: "The 'Current Song' selection is ephemeral and is not written to `lastTuning` in persistent config."

---

## GAP-07 — `midiToNote()` strips octave number; note display shows note class only

**Severity:** Low

**What the code does:**
`tuning-utils.js` `midiToNote()` (line 6) returns only the note class (e.g., `"E"`, `"A#"`) with no octave number. The string button labels and the visualization note display therefore show only `"E"` not `"E2"`.

**What the PRD says:**
FR-02: "The plugin shall display the detected pitch as a musical note name and a cents-deviation value." — "musical note name" is ambiguous. FR-08 mentions users specifying strings "as note names (e.g., E2, A2)" with octave, implying the full note-with-octave format is the canonical representation. But the display does not show octave numbers.

**Recommendation:** Clarify FR-02 to explicitly state whether the displayed note name includes the octave number. If it should, this is also a bug in `midiToNote()`. If octave-less is intentional, align FR-08's example notation with the displayed format, or note that input notation (E2) differs from display notation (E).

---

## Minor / Cosmetic Observations (not gaps, for awareness)

- **FR-16 (viz registration):** Correctly described. The naming convention `window._tunerViz_<name>` is accurate.
- **FR-04 / NFR-04:** Worker isolation via `new Worker('/api/plugins/tuner/workers/yin.js')` is confirmed. The `ScriptProcessorNode` on the main thread (OQ-01) is also confirmed deprecated — the PRD correctly surfaces this as an open question.
- **FR-05 tuning names:** The PRD table uses abbreviated names ("Standard", "Drop D") while the backend uses fully-qualified names ("Guitar Standard", "Bass 4-string Drop D"). This is cosmetic — the PRD table is describing groups/labels, not raw keys — but could cause confusion during implementation of new features that reference preset names.
- **FR-03 (20 Hz minimum):** Confirmed in `screen.js` line 5 (`_TUNER_MIN_DETECTABLE_HZ = 20`) and `updateUI()` line 567.
- **FR-01 (4096 samples):** Confirmed in `screen.js` line 3 (`_TUNER_MIN_YIN_SAMPLES = 4096`).
- **NFR-02 (30 ms interval):** Confirmed in `screen.js` line 445 (`setInterval(..., 30)`).
