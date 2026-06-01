# Story 6.5: CHEF MT-3 — Gauge Animation, Note Display & Strobe Mode

Status: ready-for-dev

## Story

As a guitar player using the CHEF MT-3 visualization,
I want the gauge to show my tuning deviation and the display to show my note name, with a MODE button that switches between standard pointer mode and strobe mode,
so that I can tune accurately using a familiar pedal-style interface.

## Acceptance Criteria

**Standard mode (default):**

1. When `note` is non-null and `cents` = 0: all 3 marker lights are clustered at the centre of the gauge arc; they glow orange; the 7-segment display shows the note letter in bright red with glow.
2. When `cents` = −30: the 3 markers are positioned at the left side of the arc proportional to −30/50; spaced evenly in a small cluster (± a few degrees apart).
3. When `cents` = +25: the 3 markers are at the right side of the arc proportional to +25/50.
4. When `note === null`: all 3 markers are hidden (`opacity:0`); the 7-segment display shows nothing (all segments in dark-red unlit state); the "#" symbol is in its dim state.
5. When the detected note is sharp (contains "#", e.g., "A#"): the "#" symbol is lit bright red; only the note letter before "#" is shown on the 7-segment display.
6. When the detected note is natural (e.g., "E"): the note letter is shown; the "#" symbol is in its dim dark-red state.

**Strobe mode (activated by MODE button press):**

7. In strobe mode, 5 evenly-spaced groups of 2 marker lights are distributed along the gauge arc.
8. When `cents` = 0: the marker groups are stationary.
9. When `cents` ≠ 0: the marker groups drift continuously left (when flat) or right (when sharp) at a speed proportional to the magnitude of the deviation. The animation decelerates smoothly when the signal stops (smoothed cents decay to 0).
10. The 7-segment display and "#" symbol behavior is identical to standard mode (ACs 1, 4, 5, 6 apply).

**MODE button:**

11. Pressing the MODE button toggles between standard and strobe modes. The current mode is stored in the factory instance (not persisted to config). The initial mode on construction is standard.
12. The "MODE" button has a visible pressed-state feedback (brief `boxShadow` change) on click.

**General:**

13. `destroy()` cancels all active RAF IDs and removes the panel from the container.
14. The factory contract is satisfied: `window['_tunerViz_chef-mt3'](container)` returns `{ update(note, cents, freq, mode), destroy() }`.

## Tasks / Subtasks

- [ ] Implement `update(note, cents, freq, mode)` — standard marker positioning (AC: 1–6)
  - [ ] Declare factory-scope state vars: `_mt3Mode = 'standard'`, `_mt3CurrentCents = 0`, `_mt3SmoothedCents = 0`, `_mt3RafId = null`, `_mt3LastTime = null`
  - [ ] `_renderNote(letter)` — drive `_mt3SegEls` from `_TUNER_MT3_SEGMENTS`; same pattern as `pp-tiny.js` `_renderNote`
  - [ ] `_setSharp(lit)` — set `_mt3SharpEl` color/glow; same pattern as `pp-tiny.js` `_setSharp`
  - [ ] `_positionMarkersStandard(cents, hasSignal)`:
    - If `!hasSignal`: set all 3 marker `opacity` to `0`; return
    - Clamp cents to ±50; compute arc angle for deviation: `centreAngle = Math.PI` (leftmost), `spanAngle = Math.PI`; `t = (cents + 50) / 100`; `targetAngle = Math.PI + t * Math.PI`
    - Spread 3 markers ±4 degrees around `targetAngle`:
      ```javascript
      var offsets = [-4, 0, +4];  // degrees
      offsets.forEach(function(deg, i) {
          var a = targetAngle + deg * Math.PI / 180;
          var r = _MT3_ARC_R - 9;  // place markers inside the arc
          var cx = _MT3_cx + r * Math.cos(a);
          var cy = _MT3_cy + r * Math.sin(a);
          _mt3MarkerEls[i].setAttribute('cx', String(cx));
          _mt3MarkerEls[i].setAttribute('cy', String(cy));
          _mt3MarkerEls[i].setAttribute('r', '4');
          _mt3MarkerEls[i].setAttribute('fill', _MT3_COL_MARKER_LIT);
          _mt3MarkerEls[i].style.filter = 'drop-shadow(0 0 4px #ff8800)';
          _mt3MarkerEls[i].style.opacity = '1';
      });
      ```
  - [ ] In `update()`: if `_mt3Mode === 'standard'`: call `_positionMarkersStandard`; call `_renderNote`; call `_setSharp`; update `_mt3CurrentCents` for RAF decay
- [ ] Implement strobe RAF animation (AC: 7–10)
  - [ ] Declare `_mt3StrobeOffset = 0` (angle accumulator in radians)
  - [ ] `_animateStrobe(now)`:
    - Compute `dt`; clamp to 0.1s
    - Lerp `_mt3SmoothedCents` → `_mt3CurrentCents` (factor `1 - exp(-10 * dt)`)
    - If `|_mt3SmoothedCents| > 0.1`:
      - `normalized = max(0, |_mt3SmoothedCents| - _TUNER_MT3_IN_TUNE_THR) / (50 - _TUNER_MT3_IN_TUNE_THR)`
      - `speed = Math.PI * pow(normalized, 0.9)` (radians/sec, full arc per second at max)
      - If `_mt3SmoothedCents > 0` (sharp): `speed = -speed` (drift right = angle increases)
      - `_mt3StrobeOffset = ((_mt3StrobeOffset + speed * dt) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)`
    - Position `_TUNER_MT3_STROBE_GROUP_COUNT × 2 = 10` markers (reuse `_mt3MarkerEls` won't work — need separate refs):
      - Declare `_mt3StrobeEls[]` (10 `<circle>` elements) in factory scope, populated at construction time alongside `_mt3MarkerEls`
      - Each group `g` (0..4): base angle = `Math.PI + (g / _TUNER_MT3_STROBE_GROUP_COUNT) * Math.PI + _mt3StrobeOffset`; two dots per group at base ± 2° offset
      - Set cx/cy like `_positionMarkersStandard`; all dots use `_MT3_COL_MARKER_LIT` and `opacity:1`
    - `_mt3RafId = requestAnimationFrame(_animateStrobe)`
  - [ ] Start RAF loop at factory construction (same as `axe-fx-iii.js`); it runs always but strobe elements are hidden in standard mode
  - [ ] In standard mode: set all `_mt3StrobeEls[i].style.opacity = '0'`
  - [ ] In strobe mode: set all `_mt3MarkerEls[i].style.opacity = '0'`; strobe elements shown by RAF
- [ ] Add 10 strobe dot elements to SVG at construction time (Story 6.4 builds 3 marker elements; this story adds 10 more) (AC: 7)
  - [ ] In factory scope, after building the gauge SVG, append 10 `<circle>` elements with `opacity:0`, store in `_mt3StrobeEls`
- [ ] Wire MODE button (AC: 11, 12)
  - [ ] Add `addEventListener('click', ...)` on the MODE button element built in Story 6.4
  - [ ] Toggle `_mt3Mode` between `'standard'` and `'strobe'`
  - [ ] On click: brief box-shadow pulse (set → setTimeout clear, 120ms)
  - [ ] On mode change to strobe: hide `_mt3MarkerEls`, show strobe elements; reset `_mt3StrobeOffset = 0`
  - [ ] On mode change to standard: hide `_mt3StrobeEls`, show markers based on last known cents
- [ ] Update `destroy()` (AC: 13)
  - [ ] `if (_mt3RafId) { cancelAnimationFrame(_mt3RafId); _mt3RafId = null; }`
  - [ ] `panel.remove()`

## Dev Notes

### Dependency on Story 6.4

This story requires Story 6.4 to be complete. The following factory-scope refs must be accessible (declared in outer factory scope, not inside a nested init function):
- `_mt3MarkerEls` — array of 3 `<circle>` SVG elements
- `_mt3SegEls` — object `{a,b,c,d,e,f,g1,g2}` of segment div elements
- `_mt3SharpEl` — the "#" symbol element
- The MODE button DOM element (store as `_mt3ModeBtn` in Story 6.4's factory scope)

If Story 6.4 scoped any of these inside a sub-function, move them to factory scope before implementing this story.

### Arc Angle Convention

The gauge arc goes from angle `π` (left end, −50 cents) to angle `2π / 0` (right end, +50 cents), with `π + π/2 = 3π/2` = top of the arc (0 cents). For a given cents value:
```javascript
var t = (cents + 50) / 100;   // 0 = leftmost, 0.5 = centre, 1 = rightmost
var angle = Math.PI + t * Math.PI;  // π to 2π
var r = _MT3_ARC_R - 9;
var cx = _MT3_cx + r * Math.cos(angle);
var cy = _MT3_cy + r * Math.sin(angle);
```

At `cents = 0`: `t = 0.5`, `angle = 3π/2`, `cos = 0`, `sin = -1` → marker at top of arc. ✓

### Strobe Mode: Marker Recycling

10 strobe dots need separate DOM elements from the 3 standard markers. Simplest approach: append 10 more `<circle>` elements to the gauge SVG at construction time (inside the `window['_tunerViz_chef-mt3']` factory, before returning the public API). Store in `_mt3StrobeEls[0..9]`. Initial `opacity:0`.

### RAF Always Running

Start `requestAnimationFrame(_animateStrobe)` unconditionally at factory construction (line after `container.appendChild(panel)`), as `axe-fx-iii.js` does. The RAF costs near-zero when `_mt3SmoothedCents ≈ 0` since the branch short-circuits. In standard mode the strobe elements are invisible; the RAF just decays `_mt3SmoothedCents` toward 0.

### Segment Table

Copy `_TUNER_PT_SEGMENTS` from `visualization/pp-tiny.js` and rename it `_TUNER_MT3_SEGMENTS`. The segment encoding (8-bit boolean array per letter, indices 0–7 = a,b,c,d,e,f,g1,g2) is identical.

### Manual Verification

- Select "CHEF MT-3"; play a note at 0 cents: 3 orange markers cluster at arc top, correct note on display
- Play at −30 cents: markers shift to left side of arc
- Play at +25 cents: markers shift to right side
- Mute mic: markers disappear, display goes dark
- Sharp note (A#): display shows "A", "#" glows red
- Press MODE button: brief press feedback; markers disappear, 5×2 strobe dots appear on arc
- Strobe mode + 0 cents: dots stationary
- Strobe mode + deviation: dots drift left (flat) or right (sharp), decelerate when muted
- Press MODE again: back to standard mode
- Switch to a different viz → `destroy()` → no console errors, no orphaned RAF

### References

- Story 6.4 scaffold: `_bmad-output/implementation-artifacts/6-4-chef-mt3-scaffold-static-panel-layout-settings-wiring.md`
- Smoothed-cents lerp + RAF pattern: `visualization/axe-fx-iii.js` lines 343–362
- Segment rendering pattern: `visualization/pp-tiny.js` (`_renderNote`, `_setSharp`, `_TUNER_PT_SEGMENTS`)
- Strobe drift pattern: `visualization/strobe.js` RAF loop
- Viz factory contract: `_bmad-output/planning-artifacts/architecture.md` §5

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
