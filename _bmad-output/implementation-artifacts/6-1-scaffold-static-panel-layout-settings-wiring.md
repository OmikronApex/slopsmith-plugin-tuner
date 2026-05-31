# Story 6.1: Scaffold, Static Panel Layout & Settings Wiring

---
baseline_commit: a59782d
---

Status: review

## Story

As a developer implementing the PP-Tiny visualization,
I want a fully structured static panel with all DOM elements in place and the visualization registered in settings,
so that the subsequent story can layer live data and animation onto a stable, correctly-laid-out foundation.

## Acceptance Criteria

1. `visualization/pp-tiny.js` exists as an IIFE that registers `window['_tunerViz_pp-tiny']` — a factory accepting a `container` DOM element and returning `{ update(note, cents, freq), destroy() }`.
2. The static panel renders: chrome-bordered oval/trapezoid panel face (black background, white labels), 9 LED elements in a curved arc (centre LED red-styled, 4 each side blue-styled, all in unlit/dark state), range labels "−40" / "0" / "+40" in white, an 8-segment display element with very-dark-red background and all 8 segments in unlit dark-red state, a "#" symbol element to the right of the display in dim/unlit state, and a red BATT. LED in lower-left with "BATT." label always glowing.
3. The "PP-Tiny" brand label is visible on the panel face in white.
4. `destroy()` removes the panel from the container; no RAF IDs to cancel at this stage.
5. A "PP-Tiny" option (`value="pp-tiny"`) is added to the viz selector in `screen.js`.

## Tasks / Subtasks

- [x] Create `visualization/pp-tiny.js` scaffold (AC: 1, 2, 3, 4)
  - [x] IIFE wrapper `(function() { 'use strict'; ... })()`
  - [x] Module-level constants: `_TUNER_PT_IN_TUNE_THR = 2`, `_TUNER_PT_LED_COUNT = 9`, `_TUNER_PT_CENTS_RANGE = 40`
  - [x] Register as `window['_tunerViz_pp-tiny'] = function(container) { ... }` (bracket notation — hyphenated name)
  - [x] Build outer chrome-bezel container (see Panel Layout section)
  - [x] Build inner black panel face
  - [x] Render 9 LED elements in arc curve (see LED Arc section)
  - [x] Render range labels and "0" marker
  - [x] Render 8-segment display element (see 8-Segment Display section)
  - [x] Render "#" symbol element (dim/unlit state)
  - [x] Render BATT. LED element in lit/glowing state with label (see BATT. LED section)
  - [x] Render "PP-Tiny" brand label
  - [x] Stub `update(note, cents, freq)` — no-op for now (full impl in Story 6.2)
  - [x] `destroy()` that calls `panel.remove()`
- [x] Wire viz select in `screen.js` (AC: 5)
  - [x] Add `<option value="pp-tiny" ${visualizationMode === 'pp-tiny' ? 'selected' : ''}>PP-Tiny</option>` after the "Toilet Tuner" option (~line 362)

## Dev Notes

### Critical: Hyphenated Name Requires Bracket Notation

Same pattern as `toilet-tuner` and `axe-fx-iii`:

```javascript
window['_tunerViz_pp-tiny'] = function(container) { ... };
```

`screen.js` uses `` window[`_tunerViz_${name}`] `` — the template literal resolves correctly for `"PP-Tiny"`. No change to `screen.js` internals beyond adding the `<option>`.

### NFR-07 Exempt — Inline Styles Required

This visualization faithfully reproduces the physical PP-Tiny panel. Pixel-precise colors, gradients, shadows, and shapes require inline styles throughout. **Do not use Tailwind classes for visual styling of the PP-Tiny panel itself.** The container/wrapper integration with the tuner panel may still use Tailwind for outer dimensions.

### Panel Layout

The PP-Tiny has a wide, low-profile oval/trapezoid shape with a chrome/silver bezel. Suggested approach:

```javascript
// Outer chrome bezel
var panel = document.createElement('div');
panel.className = 'relative w-full select-none overflow-hidden';
panel.style.aspectRatio = '2.8 / 1';
panel.style.background = 'linear-gradient(145deg, #d0d0d0 0%, #a0a0a0 40%, #c8c8c8 60%, #909090 100%)';
panel.style.borderRadius = '50% / 35%';  // oval shape
panel.style.padding = '6% 4%';
panel.style.boxSizing = 'border-box';

// Inner black face
var face = document.createElement('div');
face.style.position = 'relative';
face.style.width = '100%';
face.style.height = '100%';
face.style.background = '#0a0a0a';
face.style.borderRadius = '45% / 30%';  // slightly less oval than bezel
face.style.overflow = 'hidden';
panel.appendChild(face);
container.appendChild(panel);
```

All child elements are appended to `face`, not `panel`.

### LED Arc

9 LEDs arranged in a shallow upward arc. Use `position: absolute` with percentage-based coordinates calculated to trace an arc across the upper panel area. Suggested CSS approach — position each LED manually along a circular arc:

```javascript
var _TUNER_PT_LED_COUNT = 9;
// Arc centre: x=50%, y=80% (below the display area, arc curves upward)
// Arc radius: ~55% of panel width
// Sweep: from about 210° to 330° (upward arc)
var arcCentreX = 50;    // % of face width
var arcCentreY = 80;    // % of face height
var arcRadius  = 42;    // % of face width
var startAngle = 210;   // degrees (leftmost LED)
var endAngle   = 330;   // degrees (rightmost LED)

var leds = [];
for (var i = 0; i < _TUNER_PT_LED_COUNT; i++) {
    var angle = startAngle + (endAngle - startAngle) * (i / (_TUNER_PT_LED_COUNT - 1));
    var rad   = angle * Math.PI / 180;
    var x     = arcCentreX + arcRadius * Math.cos(rad);
    var y     = arcCentreY + arcRadius * Math.sin(rad);

    var led = document.createElement('div');
    led.style.position  = 'absolute';
    led.style.left      = x.toFixed(1) + '%';
    led.style.top       = y.toFixed(1) + '%';
    led.style.transform = 'translate(-50%, -50%)';
    led.style.width     = '5%';
    led.style.height    = 'auto';
    led.style.aspectRatio = '1 / 1';
    led.style.borderRadius = '50%';

    var isCentre = (i === 4);
    // Unlit state: dark dome
    led.style.background = isCentre
        ? 'radial-gradient(circle at 35% 35%, #3a0000, #1a0000)'   // dark red dome
        : 'radial-gradient(circle at 35% 35%, #00003a, #00001a)';   // dark blue dome
    led.style.border = '1px solid ' + (isCentre ? '#300' : '#003');

    face.appendChild(led);
    leds.push(led);
}
```

**LED index mapping:** index 0 = −40 cents, index 4 = 0 cents (centre/red), index 8 = +40 cents.

### 8-Segment Display

The PP-Tiny centre display uses 8 segments: standard 7-segment layout EXCEPT the middle horizontal bar is split into left-half (g1) and right-half (g2). This enables cleaner letter rendering.

Segment layout (positions within a rectangle):
- `a` — top horizontal bar
- `b` — top-right vertical bar
- `c` — bottom-right vertical bar
- `d` — bottom horizontal bar
- `e` — bottom-left vertical bar
- `f` — top-left vertical bar
- `g1` — middle horizontal bar, left half
- `g2` — middle horizontal bar, right half

```javascript
// Segment map for note names (true = lit)
var _TUNER_PT_SEGMENTS = {
    //         a      b      c      d      e      f      g1     g2
    'A': [ true,  true,  true,  false, true,  true,  true,  true  ],
    'B': [ false, false, true,  true,  true,  true,  true,  true  ],
    'C': [ true,  false, false, true,  true,  true,  false, false ],
    'D': [ false, true,  true,  true,  true,  false, true,  true  ],
    'E': [ true,  false, false, true,  true,  true,  true,  false ],
    'F': [ true,  false, false, false, true,  true,  true,  false ],
    'G': [ true,  false, true,  true,  true,  true,  false, true  ],
    ' ': [ false, false, false, false, false, false, false, false ],
};

var _TUNER_PT_LIT    = '#ff2200';          // bright red
var _TUNER_PT_UNLIT  = '#1a0000';          // very dark red
var _TUNER_PT_GLOW   = '0 0 6px 1px #ff2200, 0 0 12px 2px #cc1100';
var _TUNER_PT_BG     = '#0d0000';          // near-black dark red

// Display container
var displayWrap = document.createElement('div');
displayWrap.style.cssText = [
    'position:absolute',
    'left:32%', 'top:20%',
    'width:22%', 'height:55%',
    'background:' + _TUNER_PT_BG,
    'border-radius:4px',
    'border:1px solid #2a0000',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-shadow:inset 0 0 8px #000'
].join(';');
face.appendChild(displayWrap);
```

Build segments as absolutely-positioned divs inside `displayWrap`. Each segment is a thin rectangle; `g1`/`g2` are each half-width at vertical centre. Set `background` to `_TUNER_PT_UNLIT` initially. Store segment DOM refs in an array indexed by `['a','b','c','d','e','f','g1','g2']`.

### "#" Symbol Element

Positioned to the right of `displayWrap`:

```javascript
var sharpEl = document.createElement('div');
sharpEl.style.cssText = [
    'position:absolute',
    'left:55%', 'top:28%',
    'color:' + _TUNER_PT_UNLIT,
    'font-size:120%',
    'font-weight:bold',
    'line-height:1'
].join(';');
sharpEl.textContent = '#';
face.appendChild(sharpEl);
```

### BATT. LED (Always Lit)

Lower-left of the face. Red LED dome with glow, adjacent "BATT." label in white:

```javascript
var battWrap = document.createElement('div');
battWrap.style.cssText = 'position:absolute;left:6%;bottom:8%;display:flex;align-items:center;gap:4px';

var battLed = document.createElement('div');
battLed.style.cssText = [
    'width:5%',
    'aspect-ratio:1/1',
    'border-radius:50%',
    'background:radial-gradient(circle at 35% 35%, #ff6644, #cc1100)',
    'box-shadow:0 0 5px 1px #ff3300, 0 0 10px 2px #aa1100',
    'border:1px solid #ff2200',
    'flex-shrink:0'
].join(';');

var battLabel = document.createElement('span');
battLabel.style.cssText = 'color:#ffffff;font-size:55%;font-weight:bold;letter-spacing:0.05em;';
battLabel.textContent = 'BATT.';

battWrap.appendChild(battLed);
battWrap.appendChild(battLabel);
face.appendChild(battWrap);
```

Note: `battLed.style.width = '5%'` uses percentage of `face` width. Since `face` uses `position:relative` at 100% of the chrome bezel interior, this scales proportionally.

### "PP-Tiny" Brand Label

Centred at the bottom of the face:

```javascript
var brandLabel = document.createElement('div');
brandLabel.style.cssText = [
    'position:absolute',
    'bottom:8%',
    'left:50%',
    'transform:translateX(-50%)',
    'color:#ffffff',
    'font-size:60%',
    'font-weight:bold',
    'letter-spacing:0.08em',
    'pointer-events:none'
].join(';');
brandLabel.textContent = 'PP-Tiny';
face.appendChild(brandLabel);
```

### destroy() Pattern

No RAF loop in Story 6.1:

```javascript
function destroy() { panel.remove(); }
```

### screen.js Viz Select — Exact Insertion Point

Current block ends (~line 362 after Epic 5):
```javascript
<option value="toilet-tuner" ${visualizationMode === 'toilet-tuner' ? 'selected' : ''}>Toilet Tuner</option>
```

Add immediately after:
```javascript
<option value="pp-tiny" ${visualizationMode === 'pp-tiny' ? 'selected' : ''}>PP-Tiny</option>
```

### Manual Verification

- Docker restart → open tuner panel → switch to "PP-Tiny" via settings
- Panel renders with chrome oval bezel, black inner face
- 9 LED domes visible in arc — all dark (unlit)
- Range labels −40, 0, +40 visible in white
- 8-segment display: dark-red background, all segments in dark-red unlit state
- "#" symbol visible but dim
- BATT. LED glowing red in lower-left with "BATT." label
- "PP-Tiny" brand label visible
- Switch to another visualization → `destroy()` → container empty, no errors

### References

- Hyphenated factory registration: `visualization/toilet-tuner.js` line 1 and `visualization/axe-fx-iii.js` line 42
- Inline style convention for visualizations: `_bmad-output/planning-artifacts/project-context.md` — NFR-07 exempt for this epic
- Panel aspect-ratio/inline style pattern: `visualization/axe-fx-iii.js` lines 46–61
- Strobe 8-segment display (16-seg, for reference): `visualization/strobe.js` lines 12–55
- Viz select insertion: `screen.js` lines 357–363
- Viz factory contract: `_bmad-output/planning-artifacts/architecture.md` §5
- Epic 6 requirements: `_bmad-output/planning-artifacts/epics.md` (FR-PT-01 through FR-PT-08)

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
None — straightforward scaffold implementation.

### Completion Notes List
- Created `visualization/pp-tiny.js` as IIFE; registered as `window['_tunerViz_pp-tiny']` (bracket notation for hyphenated name)
- Chrome oval bezel uses `border-radius: 50% / 38%` with linear-gradient silver; inner black face uses `border-radius: 44% / 28%`
- 9 LEDs positioned along computed arc (centre x=50%, y=108%, radius=58%); arc sweep 212°–328° gives a shallow upward curve
- 8-segment display built as absolute-positioned divs; g1/g2 are left/right halves of the split centre bar
- All live update helpers (_setLed, _updateLeds, _renderNote, _setSharp) included — Story 6.2 is entirely within this file with no structural changes needed
- BATT. LED always glowing red; "PP-Tiny" brand label and range labels in white
- Added `<option value="pp-tiny">PP-Tiny</option>` to viz selector in `screen.js` after the Toilet Tuner option

### File List
- visualization/pp-tiny.js
- screen.js

### Change Log
- 2026-05-31: Story 6.1 implemented — PP-Tiny scaffold, static layout, settings wiring
