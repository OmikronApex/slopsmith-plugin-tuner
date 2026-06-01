# Story 6.5: CHEF MT-3 — Gauge Animation, Note Display & Strobe Mode

---
baseline_commit: 3238d9332b343a5830d3bce46f6e850a4ff88b19
---

Status: done

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

- [x] Implement `update(note, cents)` — standard marker positioning (AC: 1–6)
  - [x] Factory-scope state: `_mt3Mode='standard'`, `_mt3CurrentCents=0`, `_mt3SmoothedCents=0`, `_mt3RafId=null`, `_mt3LastTime=null`
  - [x] `_renderNote(letter)` — drives `_mt3SegEls` from `_TUNER_MT3_SEGMENTS`
  - [x] `_setSharp(lit)` — sets all `_mt3SharpParts[]` fill colors
  - [x] `_positionMarkersStandard(cents, hasSignal)` — clamps ±50, computes angle = π + t×π, spreads 3 markers ±4° around target
  - [x] `update()`: calls `_positionMarkersStandard`, `_renderNote`, `_setSharp`; sets `_mt3CurrentCents`
- [x] Implement strobe RAF animation (AC: 7–10)
  - [x] `_mt3StrobeOffset` angle accumulator; `_animateStrobe(now)` lerps `_mt3SmoothedCents` with exp factor
  - [x] Speed = π × normalized^0.9; flat (cents<0) → speed negated → drift left; sharp → drift right
  - [x] 5 groups × 2 dots; base angle = π + (g/N)×π + offset; ±2° within each group
  - [x] RAF starts unconditionally at construction; strobe dots hidden in standard mode
- [x] 10 strobe dot `<circle>` elements added to SVG at construction, stored in `_mt3StrobeEls` (AC: 7)
- [x] Wire MODE button click handler (AC: 11, 12)
  - [x] Toggles `_mt3Mode` standard↔strobe; brief boxShadow press feedback (120ms timeout)
  - [x] Mode→strobe: hide `_mt3MarkerEls`, reset `_mt3StrobeOffset=0`
  - [x] Mode→standard: hide `_mt3StrobeEls`, reposition markers at `_mt3CurrentCents`
- [x] `destroy()` cancels RAF + `panel.remove()` (AC: 13)

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
claude-sonnet-4-6

### Debug Log References
- Story spec comment "drift right = angle increases" was self-contradictory with the negate-for-sharp code; implemented intuitive behavior: sharp=right, flat=left (negate for flat)
- CSS `filter: drop-shadow()` doesn't accept spread-radius; simplified glow to `drop-shadow(0 0 5px #ff2200)`

### Completion Notes List
- Implemented alongside 6.4 in a single `visualization/chef-mt3.js`
- Standard mode: `_positionMarkersStandard` places 3 orange circles at angle π+(t×π) ±4° where t=(cents+50)/100
- Strobe mode: RAF loop decays `_mt3SmoothedCents`; 5 groups of 2 dots at base angles π+(g/5)×π+offset; sharp→drift right (offset increases), flat→drift left
- MODE button: `addEventListener('click')` on `_mt3ModeBtn`; 120ms press feedback; hides/shows appropriate element sets
- `destroy()`: cancelAnimationFrame + panel.remove()
- No separate commit for 6.4 vs 6.5 since single file; both stories committed together

### File List
- visualization/chef-mt3.js (new)
- screen.js

### Change Log
- 2026-06-01: Stories 6.4 + 6.5 complete — CHEF MT-3 scaffold and full animation implemented in chef-mt3.js
