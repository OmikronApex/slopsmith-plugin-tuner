# Story 4.2: Chromatic Gauge, Arrows, Note/Octave Display & Mode Tabs

---
baseline_commit: f34a4c2ddd6638a85faa6ef9932947e240ce5d60
---

Status: review

## Story

As a guitar player using the Axe-Fx III visualization,
I want the chromatic gauge, directional arrows, and note/octave readout to respond live to my detected pitch,
so that I can immediately see what note I'm playing, which octave, and which direction I need to adjust.

## Acceptance Criteria

1. When `update(note, cents, freq, mode)` is called with a non-null `note` and `cents = 0`, the white position marker in the chromatic gauge is centred; both direction arrows (`▶ ◀`) are equally bright.
2. When `cents = -25` (flat): the marker is displaced left of centre proportionally; the right-facing `▶` arrow is bright (player must raise pitch), the left-facing `◀` arrow is dim.
3. When `cents = +25` (sharp): the marker is displaced right of centre proportionally; the left-facing `◀` arrow is bright (player must lower pitch), the `▶` arrow is dim.
4. The marker's horizontal offset is linearly proportional to cents (−50 = far left, 0 = centre, +50 = far right); the update is synchronous within `update()` — no RAF required for the gauge.
5. The note name display shows the `note` string (e.g., "Bb", "E") in the lower-left; the octave number is derived from `freq` using A4 = 440 Hz and displayed in the lower-right.
6. `setMode("free")`/`"auto"`/`"manual"` — replaced: the `mode` 4th argument of `update()` drives tab highlighting. When `mode = 'free'`, the "Free" tab is highlighted; `'auto'` → "Auto"; `'manual'` → "Manual". Tab state updates on every `update()` call.
7. When `note === null`: gauge marker is hidden, both arrows are dim, note shows "- -", octave shows "-". Tab state still updates from `mode`.

## Tasks / Subtasks

- [x] Wire chromatic gauge position marker (AC: 1–4)
  - [x] Show/hide the marker element based on `note !== null`
  - [x] Compute marker left offset: `offsetPct = (cents + 50) / 100` → set `markerEl.style.left = (offsetPct * 100) + '%'`
  - [x] The gauge strip is full-width; the marker is an absolutely-positioned white `div` (thin vertical bar) overlaid on the tick strip
- [x] Wire direction arrows (AC: 1–3, 7)
  - [x] When `note === null`: both arrows dim (e.g., `opacity-20`)
  - [x] When `cents ≤ −3` (flat): right `▶` arrow bright (`opacity-100` teal/green), left `◀` dim
  - [x] When `cents ≥ +3` (sharp): left `◀` arrow bright (`opacity-100` white), right `▶` dim
  - [x] When `|cents| < 3` (in tune): both arrows bright and equal
- [x] Wire note name display (AC: 5, 7)
  - [x] `noteEl.textContent = note !== null ? note : '- -'`
- [x] Wire octave display (AC: 5, 7)
  - [x] Derive octave from freq using `_freqToOctave(freq)` helper (see formula below)
  - [x] `octaveEl.textContent = note !== null ? _freqToOctave(freq) : '-'`
- [x] Wire mode tabs (AC: 6, 7)
  - [x] On each `update()` call, apply highlight class to the matching tab, dim the others
  - [x] Map: `'free'` → tab[0], `'auto'` → tab[1], `'manual'` → tab[2]

## Dev Notes

### Key Implementation Details

**Gauge marker positioning** — the tick strip div is `position: relative; width: 100%`. The marker is a child with `position: absolute; top: 0; height: 100%; width: 2px; background: white`. In `update()`:
```javascript
markerEl.style.left = ((cents + 50) / 100 * 100) + '%';
markerEl.style.display = note ? 'block' : 'none';
```

**Octave formula**:
```javascript
function _freqToOctave(freq) {
    if (!freq || freq <= 0) return '-';
    var midi = Math.round(69 + 12 * Math.log2(freq / 440));
    return String(Math.floor(midi / 12) - 1);
}
```
`Math.log2` is ES6 — safe in all modern browsers that support Web Audio API. A4 (440 Hz) → midi 69 → octave 4. ✓

**4th `mode` parameter** — `screen.js` (lines 573, 604) computes `vizMode` as:
```javascript
var vizMode = manualTargetFreq ? 'manual' : (selectedTuning && selectedTuning.length > 0 ? 'auto' : 'free');
```
Values are exactly `'free'`, `'auto'`, `'manual'` — always a string, never null/undefined. The viz receives this on every `update()` call, so tab state is always current.

**Arrow direction logic** — threshold of ±3 cents avoids flickering near zero:
- `cents <= -3`: player is flat → must raise pitch → right `▶` lit (pointing toward target = inward from below)
- `cents >= +3`: player is sharp → must lower pitch → left `◀` lit
- `|cents| < 3`: in tune → both lit equally

**No setMode() method needed** — do NOT add a `setMode()` method; the `mode` parameter in `update()` fully covers this. The epics.md initially proposed `setMode()` but the codebase already passes `vizMode` via `update()` — using the 4th arg is cleaner and requires zero screen.js changes.

### Files Modified

- `visualization/axe-fx-iii.js` — add gauge/arrow/note/octave/tab logic to `update()` stub from Story 4.1

### No screen.js changes in this story.

### Verification

- Play a flat note (e.g., tune a guitar string below pitch): `▶` arrow lights up, marker left of centre
- Play a sharp note: `◀` arrow lights up, marker right of centre
- Free tune (no tuning selected): "Free" tab highlighted
- Auto mode (tuning selected, no string locked): "Auto" tab highlighted
- Manual mode (string button tapped): "Manual" tab highlighted
- Mute mic → `note === null` → marker hidden, arrows dim, "- -" shown

### References

- `screen.js` lines 572–604: `vizMode` computation and `update()` call site
- `architecture.md` §5: viz factory contract (4-param `update` is additive — existing vizzes ignore extra args)
- `architecture.md` §4: global naming, IIFE constraints
- Story 4.1 file list: DOM elements created (gauge strip, marker, arrows, tabs, note/octave divs)

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
None — implementation straightforward, all logic self-contained in `update()`.

### Completion Notes List
- Added `_freqToOctave(freq)` helper (MIDI formula, A4=440 Hz)
- Replaced `update()` stub with full implementation: gauge marker positioning, arrow fill colours, note/accidental split, octave derivation, tab highlighting
- Marker left offset = `((cents+50)/100*100)%`, linear per AC4
- Arrow colours driven by `_TUNER_ARROW_THR` (3¢) constant; SVG `fill` attribute used (not CSS opacity) as arrows are polygons
- Note split: `charAt(0)` → noteLetter (1ch wide, stable position), `slice(1)` → noteAccidental
- Validated all 7 ACs via Node.js simulation

### File List
- visualization/axe-fx-iii.js

### Change Log
- 2026-05-31: Story 4.2 implemented — gauge marker, arrows, note/octave, mode tabs wired in `update()`
