# Story 6.2: LED Arc Animation, 8-Segment Display & No-Signal State

---
baseline_commit: a59782d
---

Status: review

## Story

As a guitar player using the PP-Tiny visualization,
I want the LED arc to show my deviation bar-graph style and the display to show my note name, with a clean idle state when no signal is detected,
so that I can tune by reading the PP-Tiny interface.

## Acceptance Criteria

1. When `note` is non-null and `cents` = 0: only the centre red LED (index 4) is lit; all 8 blue LEDs are unlit; the 8-segment display shows the note letter in bright red with glow.
2. When `cents` = −30: the centre red LED (index 4) plus blue LEDs at indices 3, 2, 1 are lit (bar extends left from centre to the LED nearest −30); LEDs at indices 0 and 5–8 are unlit.
3. When `cents` = +20: the centre red LED (index 4) plus blue LEDs at indices 5, 6 are lit; all other LEDs are unlit.
4. For any `cents` between −40 and +40, the lit LEDs form a contiguous bar from centre (index 4) to the LED closest to the deviation; mapping is linear (each LED step ≈ 10 cents).
5. When the note is sharp (e.g., "A#"): the "#" symbol is lit bright red with glow; only the letter before "#" is rendered on the 8-segment display.
6. When the note is natural (e.g., "E"): the "#" symbol is in its dim dark-red unlit state.
7. When `update(null, 0, 0)` is called: all arc LEDs are unlit (including the centre red LED); display shows nothing (all segments dark-red); "#" symbol unlit; BATT. LED remains lit.
8. `destroy()` cancels the RAF loop (if any) and removes the panel from the container.

## Tasks / Subtasks

- [x] Add live-update helper functions to `visualization/pp-tiny.js` (AC: 1–7)
  - [x] `_setLed(index, lit)` — sets LED at index to lit or unlit state (see LED States section)
  - [x] `_updateLeds(cents, hasSignal)` — computes which LEDs to light per bar-graph rules (see Bar-Graph Logic)
  - [x] `_setSegment(segEl, lit)` — sets a single segment element lit or unlit
  - [x] `_renderNote(letter)` — looks up `_TUNER_PT_SEGMENTS[letter]` and drives all 8 segment elements; if letter is `' '` or undefined, all segments unlit
  - [x] `_setSharp(lit)` — sets the "#" symbol element to lit/unlit style
- [x] Implement `update(note, cents, freq)` (AC: 1–7)
  - [x] If `note === null`: call `_updateLeds(0, false)`, `_renderNote(' ')`, `_setSharp(false)`; return
  - [x] Extract letter: `var letter = note[0];`
  - [x] Extract sharp: `var isSharp = note.length > 1 && note[1] === '#';`
  - [x] Call `_updateLeds(cents, true)`, `_renderNote(letter)`, `_setSharp(isSharp)`
- [x] `destroy()` update: cancel RAF + `panel.remove()` (AC: 8)
  - [x] No RAF loop used; `destroy()` is `panel.remove()`

## Dev Notes

### No RAF Required

Unlike the strobe or axe-fx-iii, the PP-Tiny LED arc and display update synchronously inside `update()`. There is no continuous animation when idle — LEDs either light or don't based on the current call. Do NOT add an always-running RAF loop; it is unnecessary and wastes CPU when idle. `destroy()` stays as `panel.remove()`.

### Bar-Graph Logic

9 LEDs at indices 0–8. Index 4 = centre (0 cents). Each step = 10 cents.

```javascript
// Segment DOM refs array built in Story 6.1: var leds = [...] (9 elements)

var _TUNER_PT_LED_COUNT  = 9;
var _TUNER_PT_CENTS_RANGE = 40;   // ±40 cents = full arc span

function _updateLeds(cents, hasSignal) {
    if (!hasSignal) {
        for (var i = 0; i < _TUNER_PT_LED_COUNT; i++) _setLed(i, false);
        return;
    }

    // Clamp to ±40
    var c = Math.max(-_TUNER_PT_CENTS_RANGE, Math.min(_TUNER_PT_CENTS_RANGE, cents));

    // Which LED index corresponds to this deviation?
    // index 0 = -40, index 4 = 0, index 8 = +40
    // targetIdx = 4 + round(c / 10)
    var targetIdx = 4 + Math.round(c / 10);
    targetIdx = Math.max(0, Math.min(8, targetIdx));

    for (var j = 0; j < _TUNER_PT_LED_COUNT; j++) {
        var lit;
        if (c >= 0) {
            // Bar extends right from centre: lit if j >= 4 && j <= targetIdx
            lit = (j >= 4 && j <= targetIdx);
        } else {
            // Bar extends left from centre: lit if j <= 4 && j >= targetIdx
            lit = (j <= 4 && j >= targetIdx);
        }
        _setLed(j, lit);
    }
}
```

**Edge case:** at `cents` = 0 exactly, `targetIdx` = 4 and the condition for both branches lights only index 4 (the red centre LED). This is correct.

### LED States

Unlit = dark dome (set in Story 6.1). Lit = glowing dome.

```javascript
function _setLed(index, lit) {
    var led = leds[index];
    var isCentre = (index === 4);
    if (lit) {
        if (isCentre) {
            led.style.background = 'radial-gradient(circle at 35% 35%, #ff6644, #cc1100)';
            led.style.boxShadow  = '0 0 5px 2px #ff3300, 0 0 10px 4px #aa1100';
            led.style.border     = '1px solid #ff4400';
        } else {
            led.style.background = 'radial-gradient(circle at 35% 35%, #4488ff, #0033cc)';
            led.style.boxShadow  = '0 0 5px 2px #2266ff, 0 0 10px 4px #0022aa';
            led.style.border     = '1px solid #3366ff';
        }
    } else {
        if (isCentre) {
            led.style.background = 'radial-gradient(circle at 35% 35%, #3a0000, #1a0000)';
            led.style.boxShadow  = 'none';
            led.style.border     = '1px solid #300';
        } else {
            led.style.background = 'radial-gradient(circle at 35% 35%, #00003a, #00001a)';
            led.style.boxShadow  = 'none';
            led.style.border     = '1px solid #003';
        }
    }
}
```

### 8-Segment Display Update

Segment elements are stored in an object/array keyed by `['a','b','c','d','e','f','g1','g2']` — built in Story 6.1. Segment names map to the `_TUNER_PT_SEGMENTS` boolean array by position index `[0..7]`.

```javascript
var _segKeys = ['a','b','c','d','e','f','g1','g2'];

function _setSegment(segEl, lit) {
    segEl.style.background  = lit ? _TUNER_PT_LIT   : _TUNER_PT_UNLIT;
    segEl.style.boxShadow   = lit ? _TUNER_PT_GLOW   : 'none';
}

function _renderNote(letter) {
    var map = _TUNER_PT_SEGMENTS[letter] || _TUNER_PT_SEGMENTS[' '];
    for (var k = 0; k < _segKeys.length; k++) {
        _setSegment(segmentEls[_segKeys[k]], map[k]);
    }
}
```

`segmentEls` is an object `{ a: el, b: el, ..., g1: el, g2: el }` built during the Story 6.1 scaffold. Declare it in factory scope and populate each key as segments are created.

### "#" Symbol Update

```javascript
function _setSharp(lit) {
    sharpEl.style.color      = lit ? _TUNER_PT_LIT  : _TUNER_PT_UNLIT;
    sharpEl.style.textShadow = lit ? _TUNER_PT_GLOW : 'none';
}
```

### Sharp Note Parsing

`note` from the viz contract is always a string like `"E"`, `"A#"`, `"Bb"` — but this plugin uses `#` notation only (not `b`). So:

```javascript
var letter  = note[0];                                  // always the letter
var isSharp = note.length > 1 && note[1] === '#';       // true for "A#", "C#", etc.
```

Only `note[0]` is rendered on the display; the `#` indicator is the adjacent symbol element.

### Story 6.1 Dependency — Expose DOM Refs

Story 6.2 needs access to `leds[]`, `segmentEls{}`, and `sharpEl` that are created in Story 6.1's scaffold. These must be declared as variables in the factory function scope (not nested in a sub-function) so Story 6.2's `update()` can close over them. If the Story 6.1 implementation scoped them inside an init sub-function, move them to factory scope before implementing Story 6.2.

### No screen.js / routes.py / settings.html Changes

Story 6.2 is entirely within `visualization/pp-tiny.js`.

### Manual Verification

- Open tuner with PP-Tiny selected; play a note at 0 cents: only centre red LED lit, correct note letter on display
- Play at −30 cents: centre LED + 3 left-side LEDs lit (bar of 4)
- Play at +20 cents: centre LED + 2 right-side LEDs lit (bar of 3)
- Play a sharp note (A#): display shows "A", "#" symbol glows red
- Mute mic (`update(null, 0, 0)`): all LEDs dark, display blank, "#" dim, BATT. LED still glowing
- Confirm BATT. LED never changes state (always on)
- Switch visualization → `destroy()` → container empty, no errors, no RAF firing

### References

- Bar-graph LED design: `_bmad-output/planning-artifacts/epics.md` FR-PT-03
- 8-segment display spec (split centre bar): `_bmad-output/planning-artifacts/epics.md` FR-PT-04
- No-signal idle: `_bmad-output/planning-artifacts/epics.md` FR-PT-06
- LED/display visual constants defined in Story 6.1: `visualization/pp-tiny.js`
- Strobe segment update pattern (reference): `visualization/strobe.js` lines 57–62 (`_updateSegmentDigit`)
- destroy() RAF pattern (reference): `visualization/strobe.js` lines 176–179
- Viz factory contract: `_bmad-output/planning-artifacts/architecture.md` §5

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
None — all live logic was implemented together with the Story 6.1 scaffold.

### Completion Notes List
- All update helpers implemented in `visualization/pp-tiny.js` during Story 6.1 (no separate file changes needed)
- `_updateLeds`: bar-graph from centre; clamps cents to ±40; `targetIdx = 4 + Math.round(c/10)`; c≥0 lights j∈[4,targetIdx], c<0 lights j∈[targetIdx,4]
- `_renderNote`: maps letter to `_TUNER_PT_SEGMENTS` array; drives all 8 segment divs (including split g1/g2)
- `_setSharp`: toggles `#` symbol colour and text-shadow glow
- `update(null,0,0)`: all LEDs off, display blank, `#` dim — BATT. LED unaffected (static DOM)
- No RAF loop; all updates synchronous inside `update()`; `destroy()` is `panel.remove()`

### File List
- visualization/pp-tiny.js

### Change Log
- 2026-05-31: Story 6.2 complete — live update logic implemented as part of Story 6.1 commit
