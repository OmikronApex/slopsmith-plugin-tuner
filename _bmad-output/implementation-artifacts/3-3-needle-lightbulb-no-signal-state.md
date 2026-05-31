# Story 3.3: Needle, Lightbulb & No-Signal State

---
baseline_commit: d3b783d5f75ed68aa6348dbfbc2a891d6ee13b4c
---

Status: done

## Story

As a guitar player using the analogue gauge visualization,
I want the needle to show my exact cent deviation, the lightbulb to confirm when I'm in tune, and a clear idle state when no signal is detected,
so that I can tune confidently and know at a glance whether I've hit the target.

## Acceptance Criteria

1. `update(note, cents, freq)` with a non-null `note` rotates the needle across the semicircular arc proportionally: `cents = 0` → needle points to arc midpoint; `cents = +50` → needle points to rightmost extent; `cents = -50` → needle points to leftmost extent. Animation is smooth (RAF-driven interpolation, not instant snap).
2. When `Math.abs(cents) <= 2`, the lightbulb element switches to its lit state: red/orange colour with a warm glow effect via CSS (e.g., `box-shadow` and background colour via Tailwind classes). Outside ±2 cents the lightbulb is dark/unlit.
3. When `update(null, 0, 0)` is called (no signal): drums freeze at their current position (animation paused, no new targetY applied); needle eases to the 0 centre position; lightbulb is unlit.
4. When the visualization first renders and no signal has been received yet, both drum windows show a neutral idle state (centred between two labels or showing a dash label), needle at 0, lightbulb unlit.
5. `destroy()` cancels all active RAF IDs (drum animation RAF from Story 3.2 **and** needle animation RAF) via `cancelAnimationFrame()`, then removes all DOM from container. No globals, timers, or RAF frames are leaked.

## Tasks / Subtasks

- [x] Implement needle sweep animation (AC: 1)
  - [x] `currentAngle = 0`, `targetAngle = 0` state variables
  - [x] `targetAngle = (cents / 50) * _TUNER_NEEDLE_HALF_SWEEP` where `_TUNER_NEEDLE_HALF_SWEEP = 70`
  - [x] Shared RAF loop lerps `currentAngle → targetAngle` using `1 - Math.exp(-10 * dt)`
  - [x] `needleEl.style.transform = 'rotate(' + currentAngle + 'deg)'` with `transformOrigin: 'bottom center'`
- [x] Implement lightbulb state toggle (AC: 2)
  - [x] `_TUNER_IN_TUNE_THRESHOLD = 2`
  - [x] Lit: `bg-orange-400 border-orange-300 shadow-[0_0_10px_4px_rgba(251,146,60,0.8)]`
  - [x] Unlit: `bg-gray-800 border-gray-700` (no shadow)
  - [x] Full `element.className` swap on each `update()` call
- [x] Implement no-signal state (AC: 3, 4)
  - [x] `frozen = true` initially; `update(null)` sets `frozen = true`, `targetAngle = 0`, lightbulb unlit
  - [x] Drums freeze: RAF loop only updates drum position when `!frozen`
  - [x] First render (no signal yet): drums at `currentDrumY = 0` (top of strip), needle at 0, bulb unlit
- [x] Consolidate RAF lifecycle (AC: 5)
  - [x] Single shared RAF loop for drum + needle
  - [x] `destroy()`: one `cancelAnimationFrame(rafId)` covers both; then `panel.remove()` removes all DOM

## Dev Notes

### Needle Rotation Math

The needle is a div with `transform-origin: bottom center` absolutely positioned inside the arc. Its rotation maps linearly:

```
angle = (cents / 50) * _TUNER_NEEDLE_HALF_SWEEP_DEG
```

Choose `_TUNER_NEEDLE_HALF_SWEEP_DEG` to match the arc's visual span. If the arc spans from ~−70° to +70° (a 140° total sweep), then:
- `cents = 0` → `angle = 0` (points straight up / to centre)
- `cents = +50` → `angle = +70` (rightmost graduation mark)
- `cents = -50` → `angle = -70` (leftmost graduation mark)

Adjust the constant to match the actual arc geometry established in Story 3.1.

Apply: `needleEl.style.transform = 'rotate(' + currentNeedleAngle + 'deg)'`

This is a functional animation value — `style.transform` is acceptable per the existing project pattern (see `default.js` line 64: `gaugeNeedle.style.left = percent + '%'`).

### Lightbulb Styling

The lightbulb is a physical dome element, not a flat icon. Achieve the "lit" appearance entirely through Tailwind classes:

**Unlit state** (dark, dormant):
```
bg-gray-800 rounded-full w-5 h-5 border border-gray-700
```

**Lit state** (glowing red/orange):
```
bg-orange-400 rounded-full w-5 h-5 border border-orange-300 shadow-[0_0_10px_4px_rgba(251,146,60,0.8)]
```

The `shadow-[...]` Tailwind arbitrary value creates the glow halo effect around the dome. Adjust the rgba values to match the desired warm red/orange tone.

**Do not use** `element.classList.toggle` for this — swap the complete `element.className` string for predictability, matching the pattern in `default.js` (lines 48–52, 67–69).

### Single RAF Loop Architecture

Merge drum and needle into one RAF loop — cleaner destroy and simpler timing:

```javascript
var rafId = null;
var lastTime = performance.now();

// State
var currentDrumY = 0, targetDrumY = 0;
var currentAngle = 0, targetAngle = 0;
var frozen = true; // true until first signal received

function _animate() {
    var now = performance.now();
    var dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    var lf = 1 - Math.exp(-10 * dt);

    if (!frozen) {
        currentDrumY += (targetDrumY - currentDrumY) * lf;
        noteDrumStrip.style.transform = 'translateY(' + currentDrumY + 'px)';
        freqDrumStrip.style.transform = 'translateY(' + currentDrumY + 'px)';
    }

    currentAngle += (targetAngle - currentAngle) * lf;
    needleEl.style.transform = 'rotate(' + currentAngle + 'deg)';

    rafId = requestAnimationFrame(_animate);
}

rafId = requestAnimationFrame(_animate);
```

On `destroy()`: `if (rafId) { cancelAnimationFrame(rafId); rafId = null; }`

### No-Signal Initial State

The simplest approach: initialise `targetDrumY = 0` (strip at top, showing first label). Since this is the idle state before any signal, users won't see it briefly with a random note — they only see it when mic access is pending or no signal is detected.

When signal returns after a null period, `frozen` transitions to `false` and normal animation resumes.

### Architecture Constraints Reminder

- `element.style.transform` is acceptable for functional animation values (same category as `gaugeNeedle.style.left` in default.js)
- No hardcoded colour hex values — use Tailwind classes exclusively (see the shadow arbitrary value syntax above)
- `destroy()` must leave `vizContainer` completely empty (architecture invariant #10 — `activeViz` is nulled after destroy, so update must never fire after; but the DOM cleanup is still required)

### Verification

After implementation, manually verify:
1. **In-tune**: detune a string to within ±2 cents of target → lightbulb glows orange/red with visible halo
2. **Sharp/flat**: take string sharp/flat → needle sweeps to the correct side of the arc smoothly
3. **Needle ends**: at ±50 cents the needle is at the arc's extreme (graduation mark, not beyond it)
4. **No signal**: mute the input → drums freeze, needle eases to centre, bulb goes dark
5. **Signal return**: play a note after silence → drums unfreeze, needle responds immediately
6. **Destroy**: switch to Default viz → inspect vizContainer (should be empty); check devtools Performance panel for zero ongoing RAF callbacks
7. **Viz switch cycle**: Default → Analogue Gauge → Strobe → Analogue Gauge — no console errors, each destroy/init cycle is clean

### References

- Story 3.1: panel DOM structure, `_TUNER_LABEL_H`, arc geometry (`3-1-scaffold-static-layout-settings-wiring.md`)
- Story 3.2: drum state variables, RAF loop skeleton (`3-2-rotating-drum-mechanics.md`)
- Needle `style.transform` precedent: `visualization/default.js` line 64 (`gaugeNeedle.style.left`)
- Lightbulb class-swap pattern: `visualization/default.js` lines 48–52, 67–69
- `destroy()` + RAF cancel pattern: `visualization/strobe.js` lines 161–163
- Viz factory contract: `architecture.md` §5

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Needle: `transformOrigin: 'bottom center'`, rotates ±70° for ±50 cents, smooth lerp in shared RAF.
- Lightbulb: `bg-orange-400 shadow-[0_0_10px_4px_rgba(251,146,60,0.8)]` when |cents| ≤ 2; `bg-gray-800` otherwise. Full className swap per update.
- No-signal: `frozen` flag blocks drum translateY updates; `targetAngle` set to 0 (needle eases back); bulb unlit. Initial state `frozen=true`, `currentDrumY=0`.
- Single RAF loop handles both drum interpolation (guarded by `!frozen`) and needle interpolation (always runs). One `cancelAnimationFrame` in `destroy()` covers both.

### File List

- `visualization/analogue-gauge.js` (implemented in 3.1)

### Review Findings

- [x] [Review][Patch] Missing `vizMode` in viz-switch onchange handler — FIXED: compute `vizMode` and pass as 4th arg to `activeViz.update(null, 0, 0, vizMode)` in the `.tuner-viz-select` onchange handler. [`screen.js`]
- [x] [Review][Defer] Already-queued RAF frame fires once after `destroy()` — single-threaded JS; `activeViz` is nulled by caller before any `update()` can be dispatched; not observable in practice — deferred, pre-existing
- [x] [Review][Defer] RAF runs unconditionally from construction — pre-existing pattern matching `strobe.js`; no idle-detection — deferred, pre-existing
