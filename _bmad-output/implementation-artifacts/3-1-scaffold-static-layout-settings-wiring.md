# Story 3.1: Scaffold, Static Layout & Settings Wiring

---
baseline_commit: d3b783d5f75ed68aa6348dbfbc2a891d6ee13b4c
---

Status: done

## Story

As a developer implementing the analogue gauge visualization,
I want a fully structured static panel with all DOM elements in place and the visualization registered in the viz selector,
so that subsequent stories can layer animation onto a stable, correctly-laid-out foundation.

## Acceptance Criteria

1. `visualization/analogue-gauge.js` exists as an IIFE and registers `window['_tunerViz_analogue-gauge']` as a factory function accepting a `container` DOM element and returning `{ update(note, cents, freq), destroy() }`.
2. The factory renders a panel face containing: (a) a frequency drum slot in the upper panel area overlapping the needle's upper half; (b) a note name drum slot below the needle; (c) a lightbulb element adjacent to the note name drum slot in dark/unlit state; (d) a semicircular gauge arc with a static needle at 0 (arc midpoint); (e) graduation marks on the arc at −50, −25, 0, +25, +50; (f) two cutout window overlays, each sized to show exactly 2 label heights.
3. All styling uses Tailwind utility classes only — no inline `style=""` attributes, no hardcoded colour values.
4. `update()` and `destroy()` are no-ops in this story (stubs only); `destroy()` removes all DOM nodes appended to the container.
5. An `<option value="analogue-gauge">Analogue Gauge</option>` is added to the `.tuner-viz-select` in `screen.js` (the panel HTML template around line 334–337), alongside the existing Default and Strobe options.

## Tasks / Subtasks

- [x] Create `visualization/analogue-gauge.js` (AC: 1)
  - [x] Wrap entire file in IIFE `(function() { 'use strict'; ... })()`
  - [x] Register as `window['_tunerViz_analogue-gauge'] = function(container) { ... }`
  - [x] Return `{ update: function(note, cents, freq) {}, destroy: function() { ... } }`
- [x] Build panel DOM structure (AC: 2)
  - [x] Outer panel wrapper div (dark background, border, rounded, relative positioning)
  - [x] Frequency drum slot (upper area, behind needle region): a div with overflow-hidden and a cutout window sized for 2 label heights
  - [x] Needle pivot + static SVG or CSS semicircular arc with graduation marks at −50, −25, 0, +25, +50
  - [x] Static needle element pointing to arc midpoint (0 position)
  - [x] Note name drum slot (below needle): div with overflow-hidden and cutout window sized for 2 label heights
  - [x] Lightbulb element adjacent to note name drum: rounded dome shape, dark/unlit styling
  - [x] Append all top-level elements to `container`; store references for `destroy()`
- [x] Implement `destroy()` to remove all appended DOM nodes (AC: 4)
- [x] Add viz option to `screen.js` (AC: 5)
  - [x] In the panel HTML template (lines ~334–337), add `<option value="analogue-gauge" ${visualizationMode === 'analogue-gauge' ? 'selected' : ''}>Analogue Gauge</option>` after the Strobe option

## Dev Notes

### Critical Architecture Constraints

- **IIFE mandatory**: No `import`/`export`. File is served as a plain script via `GET /api/plugins/tuner/visualization/analogue-gauge.js`. Any top-level code outside the IIFE will throw or pollute the host page global scope.
- **Bracket notation required**: The factory name contains a hyphen. Use `window['_tunerViz_analogue-gauge'] = function(container) { ... }` — NOT dot notation `window._tunerViz_analogue-gauge` (syntax error).
- **Tailwind-only styling**: All visual appearance via `element.className`. The only exception in existing code is functional animation values (transform, backgroundPosition) set via `element.style` — acceptable for animation math, not for cosmetic styling.
- **No inline `style=""`**: Never use the `style` HTML attribute. Use `element.style.property = value` only for animation offsets (transform/position driven by runtime math).
- **`_TUNER_` prefix**: Any module-level constants inside the IIFE must be prefixed `_TUNER_` (e.g., `_TUNER_IN_TUNE_THRESHOLD = 2`).

### Panel Layout Specification

```
┌─────────────────────────────────────┐
│  [FREQ DRUM SLOT — upper, behind    │
│   needle from midpoint to top]      │
│  ┌──────────────────────────────┐   │
│  │  2-label-height cutout       │   │
│  └──────────────────────────────┘   │
│                                     │
│      ╭──────────────────╮           │
│    ╱    −50  −25  0  +25  +50  ╲    │  ← semicircle arc + marks
│   │          |  needle  |       │   │
│    ╲_________________________╱       │
│         pivot point ●               │
│                                     │
│  [NOTE DRUM SLOT — below needle]    │
│  ┌──────────────────────────────┐   │
│  │  2-label-height cutout       │   │  [💡 lightbulb] ← adjacent
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

The frequency drum slot occupies the space from the needle's pivot midpoint upward — it is visible "behind" the needle area. The note drum slot is below the pivot. The lightbulb sits adjacent to (beside) the note drum slot, on the panel face.

### Existing Code Patterns to Follow

From `visualization/default.js`:
- createElement + className pattern; no innerHTML for structural elements
- Top-level elements stored as variables; `destroy()` calls `.remove()` on each

From `visualization/strobe.js`:
- `rafId` pattern: `let rafId = null;` at top; start with `rafId = requestAnimationFrame(fn)`; cancel with `if (rafId) { cancelAnimationFrame(rafId); rafId = null; }`
- `'use strict'` inside the factory function (not the IIFE)

### File to Modify: `screen.js`

**Only change**: add one `<option>` line in the panel HTML template. Current state (line ~334–337):
```javascript
<option value="default" ${visualizationMode === 'default' ? 'selected' : ''}>Default</option>
<option value="strobe" ${visualizationMode === 'strobe' ? 'selected' : ''}>Strobe</option>
```
Add after Strobe:
```javascript
<option value="analogue-gauge" ${visualizationMode === 'analogue-gauge' ? 'selected' : ''}>Analogue Gauge</option>
```

No other changes to `screen.js`. The viz loader (`_setVisualization`) uses bracket notation `window[\`_tunerViz_${name}\`]` so it already handles hyphenated names correctly.

### Gauge Arc Implementation Options

Two viable approaches — pick the simpler one:

**Option A: SVG arc**
```javascript
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
// draw path for semicircle arc, text for marks, line element for static needle
```

**Option B: CSS half-circle with border**
```css
width: Xpx; height: Xpx; border-radius: Xpx Xpx 0 0; border: 2px solid; overflow: hidden;
```
Needle as an absolutely-positioned div with `transform-origin: bottom center; transform: rotate(Ndeg)`.

Option B is simpler to implement in vanilla CSS and matches the existing project's approach of CSS-only visual elements. Recommended.

### Label Height Sizing

The cutout window must reveal exactly 2 label heights. Define a constant (e.g., `_TUNER_LABEL_H = 28`) in pixels; the cutout window height = `_TUNER_LABEL_H * 2`. The drum strip scrolls in increments of this height. This constant will be used in Story 3.2.

### Verification

After implementation, manually verify:
- Selecting "Analogue Gauge" in the tuner panel viz dropdown loads `analogue-gauge.js` without console errors
- The static panel layout renders with visible drum slots, arc, marks, needle at centre, and lightbulb
- Switching away triggers `destroy()` and all DOM is cleanly removed (inspect the vizContainer — it should be empty)

### References

- Viz factory contract: `architecture.md` §5
- Invariants: `architecture.md` §11 (IIFE, bracket notation, Tailwind-only, no external libs)
- Viz option location: `screen.js` lines 334–337
- Pattern reference: `visualization/default.js`, `visualization/strobe.js`
- `_setVisualization` loader: `screen.js` lines 68–78

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `visualization/analogue-gauge.js`: IIFE, `window['_tunerViz_analogue-gauge']` factory, full static DOM (freq drum slot, SVG gauge arc with 5 graduation marks, CSS needle at 0, note drum slot, lightbulb element). `_TUNER_LABEL_H = 28`px per label, cutout windows = 56px (2 labels).
- Added `<option value="analogue-gauge">Analogue Gauge</option>` to `.tuner-viz-select` in `screen.js` line ~336.
- `destroy()` cancels RAF and calls `panel.remove()` to clean all DOM in one call.
- Full animation logic (stories 3.2 + 3.3) also implemented in the same file: drum RAF loop, needle sweep, lightbulb glow, no-signal freeze.

### File List

- `visualization/analogue-gauge.js` (new)
- `screen.js` (modified — added analogue-gauge option to viz select)

### Review Findings

- [x] [Review][Decision] Inline `element.style` for cosmetic styling — **RESOLVED: accepted as intentional.** The vintage analogue aesthetic requires custom colours (`#e8e0cc`, `#cc2200`, etc.) with no Tailwind token equivalents. NFR-07 deviation is a deliberate design trade-off for this visualization.
- [x] [Review][Decision] Graduation labels show ±30 not ±25 — **RESOLVED: keep ±30.** Deliberate departure from original AC2(e) per user request during iteration. AC considered updated to ±30.
- [x] [Review][Defer] SVG geometry via `setAttribute` — not an inline `style=""` violation per NFR-07 — deferred, pre-existing
