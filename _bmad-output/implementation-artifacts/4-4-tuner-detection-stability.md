# Story 4.4: Tuner Detection Stability

---
baseline_commit: f0af7570bf0493e69288cfd9d0c37c03b4a0b034
---

Status: done

## Story

As a guitarist using the tuner,
I want the detected note and deviation to remain stable as my note sustains and fades,
so that I can tune confidently without the display oscillating between octaves or flickering to no-signal.

## Acceptance Criteria

1. When playing a sustained E1 (~41 Hz) that fades naturally, the displayed note stays "E" (octave 1) throughout — it does not jump to E2 or oscillate between octaves as volume drops.
2. The cents deviation does not oscillate wildly during a sustained note; it may drift slowly but must not flip sign or jump by more than ~10¢ between consecutive display frames.
3. When a note genuinely ends (string fully muted or rms drops below 10% of the peak rms seen for that note), the display transitions to no-signal immediately — no fixed time delay.
4. After no-signal is declared, a new pluck that brings rms back above the adaptive threshold re-activates the display immediately (no hold-off delay on the recovery path).
5. The fix is transparent to all visualizations — `activeViz.update(note, cents, freq, vizMode)` call signature and behaviour is unchanged.
6. No audio latency increase is perceptible; the median filter window covers ≤ 300 ms of history.

## Tasks / Subtasks

- [x] Add `_median` helper and rolling frequency median filter (AC: 1, 2, 6)
  - [x] Add `function _median(arr)` in screen.js module scope: `var s = arr.slice().sort(function(a,b){return a-b;}); var mid = Math.floor(s.length/2); return s.length%2!==0 ? s[mid] : (s[mid-1]+s[mid])/2;`
    — sort comparator **must** be `(a,b)=>a-b` (numeric); omitting it causes lexicographic sort (JS footgun: `[110,82].sort()` → `[110,82]` not `[82,110]`)
  - [x] Declare `let _freqHistory = [];` and `const _FREQ_HISTORY_LEN = 7;` in module scope alongside other state variables (screen.js lines 1–18)
  - [x] In `updateUI` valid-signal path: push `result.freq` to `_freqHistory`; if `_freqHistory.length > _FREQ_HISTORY_LEN` call `_freqHistory.shift()` to cap it
  - [x] Compute `var smoothFreq = _median(_freqHistory);` — use `smoothFreq` everywhere below (target selection, cents calc, viz update). Use whatever length is available; do NOT gate on `_freqHistory.length === _FREQ_HISTORY_LEN` — the median of fewer than 7 samples is still valid and must be used during warm-up (frames 1–6)
  - [x] On no-signal / fade paths: do NOT push to `_freqHistory` — preserve existing context for when signal returns
  - [x] Reset `_freqHistory = [];` in `_stopAudio()` so stale history never bleeds into a new session

- [x] Replace fixed `hasSignal` check with adaptive peak-rms threshold (AC: 3, 4)
  - [x] Declare `let _peakRms = 0;` and `const _RMS_FADE_RATIO = 0.1;` in module scope
  - [x] In `updateUI`, replace the existing `const hasSignal = rms > 0.01;` line with the two-step check below:
    ```
    const hasAbsoluteSignal = rms > 0.01;
    if (!hasAbsoluteSignal) _peakRms = 0;   // true silence resets the peak
    const hasSignal = hasAbsoluteSignal && rms >= Math.max(0.01, _peakRms * _RMS_FADE_RATIO);
    ```
  - [x] In the valid-signal path (after confidence checks pass): `_peakRms = Math.max(_peakRms, rms);` — track running peak for the current note
  - [x] The rest of the no-signal / early-return logic uses `hasSignal` as before — no other changes to those branches
  - [x] Reset `_peakRms = 0;` in `_stopAudio()` alongside `_freqHistory`

## Dev Notes

### Root Cause

`updateUI` in `screen.js` (lines 571–606) passes raw `result.freq` directly to `freqToMidi` / target selection with zero smoothing. YIN is a frame-by-frame estimator — at low RMS it can misidentify the sub-harmonic or octave, yielding E2 (82.4 Hz) instead of E1 (41.2 Hz). A single such frame immediately changes the displayed note, cents, and octave. Additionally, the fixed `rms > 0.01` silence threshold is absolute — it does not account for the natural volume decay of a plucked string, so a loud string at 5% of its peak still reads as "has signal" and lets YIN octave-errors through.

### Median Filter — Why Median, Not Mean

A mean blends octave errors into the output. A median over an odd-length window is immune to outliers — one E2 reading among six E1 readings is discarded because the middle-sorted value is still E1. At 7 samples × 30 ms = 210 ms of history, latency is imperceptible.

**Critical: numeric sort comparator.** JavaScript's default `Array.prototype.sort` is lexicographic. `[82, 110].sort()` returns `[110, 82]`. The comparator `function(a,b){return a-b;}` is mandatory — its absence is a silent correctness bug.

**Warm-up (frames 1–6).** Use `_median(_freqHistory)` regardless of how many samples are in the buffer. A median of 1 element returns that element (frame 0), a median of 3 returns the middle value, etc. Do NOT wait for `_freqHistory.length === 7` before applying smoothing — that reintroduces raw freq on startup.

### Peak-RMS Adaptive Threshold — Design

The core insight: a guitar string's natural decay is a smooth exponential. Once the string has sounded at peak volume `V`, readings below `0.1 × V` are almost certainly the tail of the decay (or background noise) rather than a new meaningful pitch. The adaptive threshold therefore:

1. **Rises** as the string is plucked: `_peakRms = max(_peakRms, rms)` on every valid frame.
2. **Declares no-signal** when `rms < _peakRms * 0.1` (the string is in its late decay).
3. **Resets immediately** when `rms < 0.01` (absolute silence) — so the next pluck starts fresh.

This means no-signal is declared by physics (volume drop), not by a timer. A new pluck reactivates the display the instant its rms crosses `max(0.01, _peakRms * 0.1)`.

**Edge case — subsequent quiet pluck.** If the player plucks softly after a loud note (and `_peakRms` hasn't reset to 0 yet), the quiet pluck must clear the 10% threshold to register. For typical guitar playing this is virtually always true — a new pluck is loud relative to the decay tail. The fallback is that true silence (between the loud note's decay and the new pluck) resets `_peakRms` naturally.

### Full Implementation Pattern

```javascript
// ── Module scope additions (lines 1–18 area) ─────────────────────────
let _freqHistory = [];
let _peakRms     = 0;
const _FREQ_HISTORY_LEN = 7;
const _RMS_FADE_RATIO   = 0.1;

function _median(arr) {
    var s = arr.slice().sort(function(a, b) { return a - b; });
    var mid = Math.floor(s.length / 2);
    return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ── In updateUI (replace existing hasSignal line) ─────────────────────
const hasAbsoluteSignal = rms > 0.01;
if (!hasAbsoluteSignal) _peakRms = 0;
const hasSignal = hasAbsoluteSignal && rms >= Math.max(0.01, _peakRms * _RMS_FADE_RATIO);

// ── In updateUI, valid-signal path (after confidence checks) ──────────
_peakRms = Math.max(_peakRms, rms);
_freqHistory.push(result.freq);
if (_freqHistory.length > _FREQ_HISTORY_LEN) _freqHistory.shift();
const smoothFreq = _median(_freqHistory);
// use smoothFreq everywhere below (targetFreq selection, cents, viz update)

// ── In _stopAudio() ───────────────────────────────────────────────────
_freqHistory = [];
_peakRms     = 0;
```

### Existing `hasSignal` Usage

The current `screen.js` (line 573) declares `const hasSignal = rms > 0.01;`. This single line is replaced by the three-line adaptive block above. All other uses of `hasSignal` in `updateUI` are unchanged.

### Files Modified

- `screen.js` — `updateUI`, `_stopAudio`: add `_freqHistory`, `_peakRms`, `_median`, `_FREQ_HISTORY_LEN`, `_RMS_FADE_RATIO`

### No Changes To

- `workers/yin.js` — YIN itself is correct; the problem is in post-processing
- `utils/tuning-utils.js` — math is correct
- Any visualization file — contract unchanged

### References

- `screen.js` lines 1–18: module-scope constants and state declarations
- `screen.js` lines 426–454: `_startAudio` / `detectInterval` (30 ms interval confirmed)
- `screen.js` lines 457–468: `_stopAudio` (add resets here)
- `screen.js` lines 570–607: `updateUI` (primary change site — `hasSignal` on line 573)
- `workers/yin.js` lines 1–53: YIN returns `{ freq, confidence, rms }` — no change

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
None — all logic validated via Node.js simulation covering: numeric sort comparator correctness, warm-up (1/3 samples), history cap at 7, adaptive threshold at 8%/12% of peak, silence reset.

### Completion Notes List
- Added `_freqHistory`, `_peakRms`, `_FREQ_HISTORY_LEN=7`, `_RMS_FADE_RATIO=0.1` to module scope
- Added `_median()` with explicit numeric comparator `(a,b)=>a-b` (avoids JS lexicographic footgun)
- `updateUI`: replaced `hasSignal = rms > 0.01` with two-step adaptive check; valid-signal path updates peak and pushes raw YIN freq to history; `_median(_freqHistory)` used as `freq` everywhere downstream
- `_stopAudio()`: resets both `_freqHistory` and `_peakRms` to prevent cross-session bleed
- No-signal / confidence-fail paths unchanged; viz contract unchanged

### File List
- screen.js

### Change Log
- 2026-05-31: Story 4.4 implemented — 7-sample median filter + adaptive peak-RMS silence threshold
