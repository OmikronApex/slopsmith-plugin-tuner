# Story 5.2: Plunger Animation, Bowl Dip & Note Display

---
baseline_commit: 01244b1a3880fed6ecd8aaac845ee54ac39e9764
---

Status: done

## Story

As a musician using the Toilet Tuner visualization,
I want the plunger to move left and right with my pitch deviation and dip into the bowl when I'm in tune, with the note name shown on the calendar,
so that I can tune by watching the plunger's position and get a satisfying visual confirmation when I hit the target pitch.

## Acceptance Criteria

1. When `note` is non-null and `cents` = 0: plunger is horizontally centred above the bowl; bowl overlay hidden; note name text shows current `note`.
2. When `cents` is −50: plunger is at its leftmost position, raised (above bowl), overlay hidden.
3. When `cents` is +50: plunger is at its rightmost position, raised (above bowl), overlay hidden.
4. For any `cents` in (−50, +50) outside ±2: plunger horizontal offset is linearly proportional to `cents`; animation is smooth via `requestAnimationFrame`; plunger stays in raised vertical position.
5. When `|cents| ≤ 2` (in tune): plunger animates to centre horizontally, then dips downward into the bowl; the `Toiletbowl.svg` overlay becomes visible, occluding the plunger's cup.
6. When `|cents|` transitions back above 2: plunger rises to raised position; overlay hides; horizontal tracking resumes.
7. When `update(null, 0, 0)` is called: plunger is at centre in raised position; overlay hidden; note text shows "–".
8. `destroy()` calls `cancelAnimationFrame()` on the active RAF ID and removes the panel from the container.

## Tasks / Subtasks

- [x] Add factory-scope state variables (AC: 1–8)
  - [x] `var _rafId = null;`
  - [x] `var _currentNote = null; var _currentCents = 0;`
  - [x] `var _inTune = false; var _plungerDipped = false;`
  - [x] `var _lastTime = null;`
  - [x] Layout constants: `_TUNER_TT_LEFT_PCT`, `_TUNER_TT_RIGHT_PCT`, `_TUNER_TT_CENTRE_PCT` (horizontal %); `_TUNER_TT_RAISED_TOP`, `_TUNER_TT_DIPPED_TOP` (vertical % for raised/lowered position)
- [x] Implement `_animate(now)` RAF callback (AC: 1–6)
  - [x] Compute `dt = Math.min((now - (_lastTime || now)) / 1000, 0.1); _lastTime = now;`
  - [x] Compute target horizontal `%` from `_currentCents`: linear map −50→left%, 0→centre%, +50→right%
  - [x] Determine `_inTune = _currentNote !== null && Math.abs(_currentCents) <= _TUNER_TT_IN_TUNE_THR`
  - [x] If `_inTune && !_plungerDipped`: ease plunger to centre, then dip (set `plungerEl.style.top` to dipped value, set `bowlEl.style.visibility = 'visible'`, `_plungerDipped = true`)
  - [x] If `!_inTune && _plungerDipped`: rise plunger to raised position, hide overlay (`bowlEl.style.visibility = 'hidden'`), `_plungerDipped = false`
  - [x] If `!_inTune`: lerp plunger horizontal position toward target (smooth glide)
  - [x] `_rafId = requestAnimationFrame(_animate);`
- [x] Implement `update(note, cents, freq)` (AC: 1–7)
  - [x] `_currentNote = note; _currentCents = (note === null) ? 0 : cents;`
  - [x] Update note text: `noteLabelEl.textContent = note || '–';`
- [x] Update `destroy()` (AC: 8)
  - [x] `if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }`
  - [x] `panel.remove();`
- [x] Start RAF loop at factory init (AC: 4 — smooth from first frame)
  - [x] `_rafId = requestAnimationFrame(_animate);`

## Dev Notes

### Animation Design

Two independent axes of movement:

**Horizontal (cents tracking):**
- Map `cents` linearly: `targetLeft = centre + (cents / 50) * halfRange`
- `halfRange` = half the pixel distance between leftmost and rightmost plunger positions (as % of panel width)
- Smooth with lerp: `currentLeft += (targetLeft - currentLeft) * lerpFactor * dt * 60`
- `lerpFactor ≈ 8` gives a responsive but not instant snap

**Vertical (dip/rise):**
- Two states: `raisedTop` (above bowl) and `dippedTop` (plunger cup inside bowl)
- When transitioning to dipped: first finish centering horizontally (within 0.5%), then lower `top`
- When rising: immediately raise `top`, then re-enable horizontal tracking
- Ease vertical with lerp: `lerpFactor ≈ 6`

### State Variables

```javascript
var _rafId = null;
var _currentNote = null;
var _currentCents = 0;
var _inTune = false;
var _plungerDipped = false;
var _lastTime = null;
var _leftPct  = _TUNER_TT_CENTRE_PCT;  // current rendered horizontal %
var _topPct   = _TUNER_TT_RAISED_TOP;  // current rendered vertical %
```

### Layout Constants (tune these during visual verification)

```javascript
var _TUNER_TT_IN_TUNE_THR  = 2;        // cents
var _TUNER_TT_LEFT_PCT     = 30;       // leftmost plunger centre-x as % of panel width
var _TUNER_TT_RIGHT_PCT    = 68;       // rightmost
var _TUNER_TT_CENTRE_PCT   = 49;       // centre (0 cents)
var _TUNER_TT_RAISED_TOP   = 35;       // plunger top as % when raised (above bowl)
var _TUNER_TT_DIPPED_TOP   = 52;       // plunger top as % when lowered into bowl
```

### Setting Position on Plunger Element

The plunger is `position: absolute` with `left` defined as the element's centre-x. Use `transform: translateX(-50%)` (set once in Story 5.1 scaffold) so the plunger is centred on the `left` coordinate:

```javascript
// In Story 5.1 scaffold:
plungerEl.style.transform = 'translateX(-50%)';
plungerEl.style.position  = 'absolute';

// In animation loop (Story 5.2):
plungerEl.style.left = _leftPct.toFixed(1) + '%';
plungerEl.style.top  = _topPct.toFixed(1) + '%';
```

### Bowl Overlay Visibility

The overlay shows/hides with `visibility` (not `display`) to preserve layout space:

```javascript
bowlEl.style.visibility = _plungerDipped ? 'visible' : 'hidden';
```

### RAF Loop — Always Running Pattern

Same pattern as `axe-fx-iii.js` strobe: start RAF immediately on factory init; when `_currentNote === null`, freeze position at centre/raised but keep requesting frames. This avoids start/stop complexity and is cheap when idle.

```javascript
function _animate(now) {
    var dt = Math.min(((now - (_lastTime || now)) / 1000), 0.1);
    _lastTime = now;

    // compute targets...
    // apply lerp...

    _rafId = requestAnimationFrame(_animate);
}
_rafId = requestAnimationFrame(_animate);
```

### destroy() — Complete Cleanup

```javascript
function destroy() {
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    panel.remove();
}
```

### No screen.js Changes

Story 5.2 is entirely within `visualization/toilet-tuner.js`. No changes to `screen.js`, `routes.py`, or `settings.html`.

### Manual Verification

- Open tuner with Toilet Tuner selected; play a flat note: plunger moves left, proportional to cents
- Play a sharp note: plunger moves right
- Tune to ±2 cents: plunger drifts to centre, dips down, bowl overlay appears
- Detune again: plunger rises, overlay hides, L/R tracking resumes
- Mute mic: plunger returns to centre raised position, note text shows "–", overlay hidden
- Switch visualization → `destroy()` → container empty, no RAF firing (check DevTools Performance)

### References

- RAF dt-cap pattern: `visualization/axe-fx-iii.js` Story 4.3 dev notes; `visualization/strobe.js` lines 103–111
- Always-running RAF idle pattern: `visualization/axe-fx-iii.js` (strobe loop)
- `destroy()` pattern: `visualization/axe-fx-iii.js` destroy function (Story 4.3)
- Viz factory contract: `_bmad-output/planning-artifacts/architecture.md` §5

## Dev Agent Record

### Agent Model Used
claude-opus-4-8

### Debug Log References
None — animation logic implemented as part of Story 5.1 scaffold (included full RAF loop rather than a stub to avoid refactoring in this story).

### Completion Notes List
- Full `_animate(now)` RAF loop implemented in `toilet-tuner.js`: dt-capped (100ms), lerp factor 8 for horizontal, immediate snap for vertical dip/rise
- `targetLeft` formula: `CENTRE + (cents/50) * (RIGHT - CENTRE)` — symmetric, LEFT_PCT = CENTRE − (RIGHT − CENTRE) = 30% naturally
- Dip sequence: glide to centre (within 0.5% threshold), then instant `_topPct = DIPPED_TOP`, `_plungerDipped = true`, overlay visible
- Rise sequence: immediate `_topPct = RAISED_TOP`, `_plungerDipped = false`, overlay hidden — horizontal tracking resumes same frame
- Always-running RAF loop (idle-safe): when `_currentNote === null`, targetLeft = CENTRE, inTune = false, plunger glides to centre raised
- `destroy()`: `cancelAnimationFrame` + `panel.remove()`

### File List
- visualization/toilet-tuner.js

### Review Findings
- [x] [Review][Patch] `update()` signature missing `freq` parameter — breaks factory contract `update(note, cents, freq)` [toilet-tuner.js:128]
- [x] [Review][Patch] `targetLeft` unclamped — cents outside ±50 moves plunger off-canvas; clamp to `[_TUNER_TT_LEFT_PCT, _TUNER_TT_RIGHT_PCT]` [toilet-tuner.js:102]
- [x] [Review][Defer] `destroy()` allows stale `update()` calls on detached DOM after teardown [toilet-tuner.js:134] — deferred, no actual bug; detached DOM writes are harmless
- [x] [Review][Defer] `requestAnimationFrame` not feature-detected [toilet-tuner.js:97] — deferred, project-wide pattern
- [x] [Review][Decision] Teleport dip instead of smooth animation — accepted per user feedback
- [x] [Review][Decision] 💩 emoji replaces note name when in tune — accepted per user feedback

### Change Log
- 2026-05-31: Story 5.2 implemented — plunger animation, bowl dip, note display (logic in toilet-tuner.js from Story 5.1 commit)
