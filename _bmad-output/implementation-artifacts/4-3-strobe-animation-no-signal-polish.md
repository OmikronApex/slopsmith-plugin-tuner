# Story 4.3: Strobe Animation & No-Signal Polish

Status: ready-for-dev

## Story

As a guitar player using the Axe-Fx III visualization,
I want the strobe arc to rotate when I'm out of tune and freeze when I hit the target, with a clean idle state when no signal is detected,
so that I can use the strobe as a precision in-tune confirmation alongside the chromatic gauge.

## Acceptance Criteria

1. When `|cents| > 2` with a non-null `note`: the pink/magenta diamond segments rotate continuously around the semicircular arc; rotation speed is proportional to `|cents|` — maximum speed at `|cents| = 50`, near-still at `|cents| = 3`.
2. Rotation direction: clockwise when `cents < 0` (flat), counter-clockwise when `cents > 0` (sharp).
3. When `|cents| ≤ 2` (in tune): segments stop rotating and remain stationary.
4. When `note === null` (no signal): the strobe arc pauses at its current rotational position; no RAF-driven rotation while signal is absent. All other idle-state behaviours from Story 4.2 remain active (marker hidden, arrows dim, "- -" note, "-" octave).
5. `destroy()` cancels all active RAF IDs (strobe RAF and any from prior stories, though Story 4.1–4.2 introduced none) and removes all DOM from the container.
6. After `destroy()`, no RAF callbacks fire and the `vizContainer` is empty.

## Tasks / Subtasks

- [ ] Implement strobe RAF animation loop (AC: 1–3)
  - [ ] Declare `var rafId = null; var strobeAngle = 0; var currentCents = 0; var strobeActive = false;` in factory scope
  - [ ] Write `_animateStrobe()` RAF callback:
    - Compute `dt` from `performance.now()` delta (cap at 100 ms to handle tab-background pauses)
    - Only advance `strobeAngle` when `strobeActive && Math.abs(currentCents) > 2`
    - Speed formula (matches strobe.js exponential feel): `speed = maxSpeed * (Math.pow(base, Math.abs(currentCents) / 50) - 1) / (base - 1)` where `maxSpeed = 180` (deg/s), `base = 10`
    - Direction: `if (currentCents < 0) speed = -speed;`
    - `strobeAngle = (strobeAngle + speed * dt + 360) % 360`
    - Apply: `strobeGroup.setAttribute('transform', 'rotate(' + strobeAngle + ',' + cx + ',' + cy + ')')` where `cx, cy` is the SVG arc centre
    - `rafId = requestAnimationFrame(_animateStrobe)`
  - [ ] Start loop immediately: `rafId = requestAnimationFrame(_animateStrobe)`
- [ ] Wire strobe state into `update()` (AC: 1–4)
  - [ ] If `note === null`: set `strobeActive = false; currentCents = 0;` (loop continues running but angle does not advance)
  - [ ] If `note !== null`: set `strobeActive = true; currentCents = cents;`
- [ ] Update `destroy()` (AC: 5–6)
  - [ ] `if (rafId) { cancelAnimationFrame(rafId); rafId = null; }`
  - [ ] Remove panel from container (single `panel.remove()` call removes all DOM)

## Dev Notes

### Strobe SVG Rotation Technique

The SVG contains a `<g>` element (`strobeGroup`) holding all N diamond shapes arranged on the arc. Rotation is applied to the group around the arc's centre point:

```javascript
strobeGroup.setAttribute('transform', 'rotate(' + strobeAngle + ',' + cx + ',' + cy + ')');
```

`cx` and `cy` are the SVG coordinates of the arc's centre (the pivot of the semicircle). This must match the values used in Story 4.1 when placing the diamonds with polar coordinates.

### Speed Formula Reference

Matches the exponential feel in `visualization/strobe.js` (lines 119–124) but adapted for angular rotation:
```javascript
var absCents = Math.min(50, Math.abs(currentCents));
var maxSpeed = 180; // degrees per second at |cents|=50
var base = 10;
var speed = maxSpeed * (Math.pow(base, absCents / 50) - 1) / (base - 1);
if (currentCents < 0) speed = -speed;
strobeAngle = (strobeAngle + speed * dt + 360) % 360;
```

### dt Capping

Always cap dt to prevent a single huge jump when the tab resumes from background:
```javascript
var now = performance.now();
var dt = Math.min((now - lastTime) / 1000, 0.1);
lastTime = now;
```

### No-Signal Behaviour

When `strobeActive = false`, the RAF loop still runs (it keeps requesting frames) but the angle does not advance — segments freeze in place. This is intentional: restarting the RAF on each signal transition is more complex and prone to leaks. The loop is cheap when idle.

### destroy() — Complete Cleanup

Story 4.1 established the pattern of a single `panel.remove()` call. Story 4.3 only adds `cancelAnimationFrame`:
```javascript
function destroy() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    panel.remove();
}
```

### Verification

- Play a flat note (−20 cents): strobe rotates clockwise, speed proportional to deviation
- Play a sharp note (+20 cents): strobe rotates counter-clockwise
- Tune in to ±2 cents: strobe stops
- Mute mic: strobe freezes; gauge marker hidden, arrows dim, "- -" note
- Switch visualization → `destroy()` → inspect `vizContainer` (must be empty, no RAF firing)
- Run for 30+ seconds then switch away — no memory leaks or orphaned frames in DevTools Performance tab

### Files Modified

- `visualization/axe-fx-iii.js` — add RAF loop, strobe animation logic, update `destroy()`

### No screen.js changes in this story.

### References

- Speed formula pattern: `visualization/strobe.js` lines 108–133
- RAF lifecycle pattern: `visualization/analogue-gauge.js` (Stories 3.2–3.3)
- Viz factory contract and `destroy()` requirements: `architecture.md` §5
- `performance.now()` for dt: same pattern as `strobe.js` line 103–111

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
