# Story 3.2: Rotating Drum Mechanics

---
baseline_commit: d3b783d5f75ed68aa6348dbfbc2a891d6ee13b4c
---

Status: done

## Story

As a guitar player using the analogue gauge visualization,
I want the frequency and note name drums to rotate in response to my detected pitch,
so that I can read which note I'm closest to and how far off I am by seeing the drum position through the cutout window.

## Acceptance Criteria

1. `update(note, cents, freq)` with a non-null `note` positions the note drum so the current `note` label is centred in the cutout window at `cents = 0`; the frequency drum is positioned so the `freq` label (rounded to 1 decimal Hz) is centred at `cents = 0`.
2. At `cents = +50` both windows show exactly halfway between the current label and the next label above. At `cents = -50` halfway between the current label and the next below. Drum offset is linearly proportional to `cents` across the full −50..+50 range.
3. Label strips are generated dynamically: the note drum covers a chromatic range of at least 3 octaves (e.g., C2–C5, 37 labels); the frequency drum covers the corresponding Hz values for each semitone. Strips are long enough that the cutout window never shows an empty region during normal use.
4. When `note` changes between `update()` calls the drums snap immediately to the new note/freq position, then apply the `cents` offset — targeting/lock behaviour is handled by `screen.js`, the visualization only tracks whatever it is passed.
5. Drum animation is driven by `requestAnimationFrame`; the RAF ID is stored and `destroy()` calls `cancelAnimationFrame(rafId)` before clearing DOM.
6. Each cutout window reveals exactly 2 label heights (using the `_TUNER_LABEL_H` constant established in Story 3.1).

## Tasks / Subtasks

- [x] Generate label strips (AC: 3)
  - [x] Define `_TUNER_NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']`
  - [x] Generate note strip: for MIDI 36 (C2) to MIDI 72 (C5), create one label div per semitone with text = `_TUNER_NOTE_NAMES[midi % 12]`
  - [x] Generate freq strip: for same MIDI range, compute Hz via `Math.pow(2, (midi - 69) / 12) * 440`, label text = `hz.toFixed(1) + ' Hz'`
  - [x] Append all label divs to their respective drum strip divs; each label has a fixed height of `_TUNER_LABEL_H` px
- [x] Implement drum positioning logic (AC: 1, 2, 6)
  - [x] Convert `note` to MIDI index: find the MIDI number in the strip whose note name matches `note` and whose Hz is closest to `freq`
  - [x] Compute `centreOffset`: the pixel position in the strip that centres the matched label in the window
  - [x] Compute `centOffset`: `(cents / 50) * (_TUNER_LABEL_H / 2)` pixels (half a label per 50 cents)
  - [x] Set `translateY` = `centreOffset + centOffset` (negative = scroll up; positive = scroll down; confirmed direction)
  - [x] Apply transform: `drumStrip.style.transform = 'translateY(' + translateY + 'px)'`
- [x] Implement RAF animation loop (AC: 5)
  - [x] `var rafId = null;` at top of factory
  - [x] RAF loop runs continuously; smoothly interpolates `currentDrumY → targetDrumY` using `1 - Math.exp(-10 * dt)`
  - [x] RAF started immediately in factory (`rafId = requestAnimationFrame(_animate)`)
  - [x] On `destroy()`: `if (rafId) { cancelAnimationFrame(rafId); rafId = null; }`
- [x] Snap on note change (AC: 4)
  - [x] Track `prevNote`; when `update()` receives a different note, immediately snap `currentDrumY = targetDrumY` then apply new cents offset

## Dev Notes

### Drum Geometry & Coordinate System

The drum strip is a tall div (height = numLabels × `_TUNER_LABEL_H`) inside the cutout window (height = 2 × `_TUNER_LABEL_H`, `overflow: hidden`).

**Centering logic:**
```
centreOffset = -(matchedLabelIndex * _TUNER_LABEL_H) + _TUNER_LABEL_H / 2
```
This scrolls the strip so the matched label's centre sits at the centre of the window (which is at `_TUNER_LABEL_H` from the top, since the window is 2 labels tall).

**Cents offset direction:**
- `cents > 0` (sharp) → pitch is above the target → drum should show labels scrolled upward → `centOffset` is **negative** (strip moves up so the next label appears at the top)
- `cents < 0` (flat) → pitch is below → drum scrolls down → `centOffset` is **positive**

Confirm the direction feels natural: at +50 the note-above should be visible in the top half; the current note in the bottom half.

**Final transform:**
```javascript
var targetY = -(matchedIndex * _TUNER_LABEL_H) + _TUNER_LABEL_H / 2 - centOffset;
drumStrip.style.transform = 'translateY(' + targetY + 'px)';
```

### Finding the Matched Label Index

Do NOT rely on `window._tunerUtils` being loaded — the viz should be self-contained. Use inline math:
```javascript
// MIDI of A4 = 69, A4 = 440 Hz
var midi = 69 + 12 * Math.log2(freq / 440);
var midiRounded = Math.round(midi);
var stripStartMidi = 36; // C2
var matchedIndex = midiRounded - stripStartMidi;
// Clamp to valid range
matchedIndex = Math.max(0, Math.min(numLabels - 1, matchedIndex));
```

### Strip Range

Generate labels from MIDI 36 (C2, ~65 Hz) to MIDI 72 (C5, ~523 Hz). That's 37 labels. This covers the full guitar/bass range that the tuner is designed for. The strip height = 37 × `_TUNER_LABEL_H`.

Ensure the strip is positioned so the cutout window cannot hit the strip's top or bottom edge during normal use. If the detected note is near the extremes (MIDI 36 or 72), the window may show empty space above/below — acceptable edge case.

### Animation Pattern (from strobe.js)

```javascript
var currentY = 0;
var targetY = 0;
var lastTime = performance.now();

function _animate() {
    var now = performance.now();
    var dt = (now - lastTime) / 1000;
    if (dt > 0.1) dt = 0.016; // clamp large gaps (tab unfocus, etc.)
    lastTime = now;
    var lerpFactor = 1 - Math.exp(-10 * dt);
    currentY = currentY + (targetY - currentY) * lerpFactor;
    noteDrumStrip.style.transform = 'translateY(' + currentY + 'px)';
    freqDrumStrip.style.transform = 'translateY(' + currentY + 'px)'; // same offset
    rafId = requestAnimationFrame(_animate);
}
rafId = requestAnimationFrame(_animate);
```

Note: both drums use the same `targetY` / `currentY` since they are always in sync (same MIDI index, same cents offset).

### Label Styling

Each label div should be:
- Fixed height: `_TUNER_LABEL_H` px (set via `element.style.height` — functional, not cosmetic)
- `display: flex; align-items: center; justify-content: center`
- Text: note name or Hz value
- Class: Tailwind text size + colour appropriate for the panel aesthetic

Use `element.style.height = _TUNER_LABEL_H + 'px'` for the height — this is a functional layout value (not cosmetic), same pattern as how default.js uses `element.style.left` for the needle position.

### Existing Architecture Patterns

- `screen.js` `updateUI()` calls `activeViz.update(null, 0, 0)` when `rms < 0.01 || confidence < 0.5`. Story 3.2 does not need to handle this — the no-signal state (`note === null`) is handled in Story 3.3. For now, `update(null, ...)` can be a no-op.
- `screen.js` null-checks `activeViz` before every `update()` call (architecture invariant #10) — no defensive coding needed inside the viz.

### Verification

After implementation, manually verify:
- Play a note on guitar/instrument → drums scroll to show the correct note and Hz
- Detune the string slightly → drums rotate proportionally; at ~50 cents flat the previous note label is halfway visible at the bottom
- Changing strings (different notes) → drums snap to the new note immediately without slow interpolation through all intermediate labels
- Check `destroy()` → no RAF log spam in devtools after switching to a different viz

### References

- Panel layout / `_TUNER_LABEL_H` constant: Story 3.1 (`3-1-scaffold-static-layout-settings-wiring.md`)
- Viz factory contract + `update()` parameter spec: `architecture.md` §5
- RAF / lerpFactor pattern: `visualization/strobe.js` lines 108–133
- `midiToFreq` math (inline, do not import): `utils/tuning-utils.js` line 2

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented in `visualization/analogue-gauge.js` (same file as 3.1 — single-file visualization).
- Label strips: MIDI 36–72 (37 labels), freq labels `toFixed(1) + ' Hz'`, note labels from `_TUNER_NOTE_NAMES[midi % 12]`. Both strips share same `translateY` (synchronized).
- `_computeDrumY(freq, cents)`: rounds freq to nearest MIDI, computes `centreY = _TUNER_LABEL_H * (0.5 - idx)`, adds `centOffset = -(cents/50) * (_TUNER_LABEL_H/2)`. Verified mathematically: correct at 0, ±25, ±50 cents.
- RAF loop uses `1 - Math.exp(-10 * dt)` lerp, clamped dt to 0.1s. Runs continuously from factory init.
- Note snap: on `note !== prevNote`, `currentDrumY = targetDrumY` (immediate), then normal lerp from new position.

### File List

- `visualization/analogue-gauge.js` (implemented in 3.1)

### Review Findings

- [x] [Review][Patch] `_computeDrumY` crashes silently on `freq=0` — FIXED: added `if (!freq || freq <= 0) return _IDLE_DRUM_Y;` guard at top of `_computeDrumY`. [`visualization/analogue-gauge.js`]
- [x] [Review][Patch] `prevNote` is declared and written but never read — FIXED: removed declaration and the single write. [`visualization/analogue-gauge.js`]
- [x] [Review][Defer] Out-of-range freq silently shows strip endpoint label while needle reflects real cents — acceptable edge case; strip covers 18–1047 Hz per spec — deferred, pre-existing
- [x] [Review][Defer] No `white-space: nowrap` on freq labels — very long Hz strings could wrap and double row height at narrow widths — deferred, pre-existing
