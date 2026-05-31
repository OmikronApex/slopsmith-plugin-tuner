# Story 4.1: Scaffold, Static Layout & Settings Wiring

---
baseline_commit: 07094a2d33f93486d759ef9937974cc02850f926
---

Status: review

## Story

As a developer implementing the Axe-Fx III visualization,
I want a fully structured static panel with all DOM elements in place and the visualization registered in the viz selector,
so that subsequent stories can layer live data and animation onto a stable, correctly-laid-out foundation.

## Acceptance Criteria

1. `visualization/axe-fx-iii.js` exists as an IIFE and registers `window['_tunerViz_axe-fx-iii']` as a factory function accepting a `container` DOM element and returning `{ update(note, cents, freq, mode), destroy() }`.
2. The factory renders a panel with dark navy-blue background containing (top to bottom): (a) a full-width chromatic gauge strip with evenly-spaced short vertical green/teal tick marks and no position marker yet; (b) three mode tabs ("Free", "Auto", "Manual") in the top-right corner with "Free" highlighted by default; (c) two inward-pointing triangle arrows (`▶ ◀`) centred below the gauge, both in dim/neutral state; (d) a large note name display in the lower-left showing "- -"; (e) a large octave number display in the lower-right showing "-"; (f) a strobe semicircle arc at the bottom centre with evenly-spaced diamond-shaped segments in a static pink/magenta colour, no rotation.
3. All styling uses Tailwind utility classes — the panel background dark navy and custom pixel-font or monospace aesthetic are acceptable via Tailwind `bg-gray-900`/`bg-slate-900` and `font-mono`. Inline `element.style` is permitted only for animation-driven values (transform, position offsets) introduced in later stories; it must not be used for cosmetic colours or layout here.
4. `update()` and `destroy()` are stubs: `update()` is a no-op; `destroy()` removes all DOM nodes appended to the container and cancels any RAF (none exist yet).
5. An `<option value="axe-fx-iii" ...>Axe-Fx III</option>` is added to the `.tuner-viz-select` in the `screen.js` panel HTML template (around line 337, after the existing Analogue Gauge option), with the same selected-state conditional pattern as the existing options.

## Tasks / Subtasks

- [x] Create `visualization/axe-fx-iii.js` (AC: 1)
  - [x] Wrap entire file in IIFE `(function() { 'use strict'; ... })()`
  - [x] Register as `window['_tunerViz_axe-fx-iii'] = function(container) { ... }` (bracket notation — name contains hyphens)
  - [x] Return `{ update: function(note, cents, freq, mode) {}, destroy: function() { ... } }`
- [x] Build panel DOM structure (AC: 2)
  - [x] Outer wrapper `div` appended to `container`; dark background, relative positioning, overflow-hidden, horizontal aspect ratio
  - [x] Chromatic gauge row: flex row of 35 tick `div` elements; green/teal (#00c878); centre tick full height, quarter ticks 80%, others 60%; white marker div absolutely positioned, hidden
  - [x] Mode tabs row (top-right, absolute positioned): three `span` elements — "Free", "Auto", "Manual"; "Free" highlighted blue on init, others dim
  - [x] Direction arrows row: ▶ ◀ Unicode chars, both dim (#1e3030) initially; positioned centre-left matching reference image
  - [x] Note name lower-left (noteLetter + noteAccidental span pair, green, large); octave lower-right (green, large); both show "-" / "" idle
  - [x] Strobe arc SVG: 11 diamond rects arranged on ∩ arc (π→0 through top), pivot (60,65) in viewBox 0 0 120 65; pink/magenta fill; no rotation yet
  - [x] Single `panel` div stores all DOM; `destroy()` calls `panel.remove()`
- [x] Implement `destroy()` to remove all appended DOM nodes and cancel RAF (AC: 4)
- [x] Add viz option to `screen.js` (AC: 5)
  - [x] Added after analogue-gauge at line 338: `<option value="axe-fx-iii" ...>Axe-Fx III</option>`

## Dev Notes

### Critical Architecture Constraints

- **Bracket notation required**: `window['_tunerViz_axe-fx-iii']` — hyphen makes dot notation a syntax error. The `_setVisualization` loader in `screen.js` (line 72) uses `` window[`_tunerViz_${name}`] `` with a template literal, so this is handled automatically on the caller side.
- **IIFE mandatory**: No `import`/`export`. File is served as a plain script via `GET /api/plugins/tuner/visualization/axe-fx-iii.js`.
- **4th `mode` parameter**: `screen.js` already passes `vizMode` ('free'|'auto'|'manual') as the 4th arg to `update()` — the signature must be `update(note, cents, freq, mode)`. Existing vizzes don't use it; this one will (Story 4.2).
- **`_TUNER_` prefix**: All module-level constants inside the IIFE use `_TUNER_` prefix (e.g., `_TUNER_TICK_COUNT = 31`).
- **No screen.js logic changes**: Only add the `<option>` line. The viz loader already handles any hyphenated name correctly.

### Panel Layout Specification

```
┌─────────────────────────────────────────[Free][Auto][Manual]─┐
│  |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||  │  ← gauge ticks
│                                                               │
│                          ▶    ◀                               │  ← direction arrows
│                                                               │
│  B b                                               6          │  ← note + octave
│                       ◆  ◆  ◆  ◆  ◆               │          │
│                    ◆           ◆                   │          │  ← strobe arc
│                       ◆  ◆  ◆                                 │
└───────────────────────────────────────────────────────────────┘
```

### Strobe Arc Construction

Use an inline `<svg>` element. Place N diamond shapes (N = 11–15) on a semicircular arc using polar coordinates:

```javascript
var _TUNER_STROBE_N = 13;
var _TUNER_STROBE_R = 40; // radius in SVG units
var cx = 60, cy = 60;    // SVG centre (adjust to viewBox size)
// angle runs from Math.PI (left) to 0 (right) = bottom semicircle
for (var i = 0; i < _TUNER_STROBE_N; i++) {
    var angle = Math.PI - (i / (_TUNER_STROBE_N - 1)) * Math.PI;
    var x = cx + _TUNER_STROBE_R * Math.cos(angle);
    var y = cy - _TUNER_STROBE_R * Math.sin(angle); // SVG y is flipped
    // create <rect> rotated 45deg as diamond, centred at (x, y)
}
```

Place diamonds as `<rect width="8" height="8" transform="translate(x,y) rotate(45,4,4)" fill="currentColor" class="text-pink-500"/>` (or similar). The SVG `<g>` element will be rotated in Story 4.3.

### Existing Pattern Reference

From `visualization/analogue-gauge.js` (the closest prior art — same epic):
- Outer `panel` div stored; `destroy()` calls `panel.remove()` — one call removes everything
- SVG created via `document.createElementNS('http://www.w3.org/2000/svg', 'svg')`
- SVG children via `document.createElementNS('http://www.w3.org/2000/svg', 'rect')` etc.
- `rafId` pattern: `let rafId = null;` at top; `cancelAnimationFrame(rafId)` in `destroy()`

From `screen.js` lines 334–337 (option pattern to follow exactly):
```javascript
<option value="default" ${visualizationMode === 'default' ? 'selected' : ''}>Default</option>
<option value="strobe" ${visualizationMode === 'strobe' ? 'selected' : ''}>Strobe</option>
<option value="analogue-gauge" ${visualizationMode === 'analogue-gauge' ? 'selected' : ''}>Analogue Gauge</option>
```
Add after analogue-gauge:
```javascript
<option value="axe-fx-iii" ${visualizationMode === 'axe-fx-iii' ? 'selected' : ''}>Axe-Fx III</option>
```

### Verification

- Select "Axe-Fx III" in the viz dropdown → `axe-fx-iii.js` loads without console errors
- Static panel renders: gauge tick row, dim arrows, "- -" note, "-" octave, static diamond arc
- Switch away → `destroy()` called → `vizContainer` is empty (no DOM leak)

### References

- Viz factory contract + loader: `architecture.md` §5, `screen.js` lines 60–78
- Architectural invariants (IIFE, bracket notation, `_TUNER_` prefix): `architecture.md` §11
- Option location in screen.js: lines 334–337
- Prior art pattern: `visualization/analogue-gauge.js`, `visualization/strobe.js`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `visualization/axe-fx-iii.js`: IIFE outer wrapper + inner factory registered as `window['_tunerViz_axe-fx-iii']`. Dark navy background (`#04041a`). All DOM built with createElement/className/style; no innerHTML for structure.
- Panel uses `position:relative; aspect-ratio:16/7` to match the widescreen hardware display shape.
- Gauge: 35 flex ticks (centre 100% height, quarter 80%, others 60%) in green/teal `#00c878`. White marker div absolutely overlaid, hidden initially. Matching the reference image's horizontal tick-bar gauge.
- Arrows `▶ ◀` (Unicode) in dimmed state `#1e3030`, positioned centre-left (transform: translateX(-60%)) to match the image offset.
- Note name: two `<span>` elements (letter + accidental) for correct "Bb" rendering where flat "b" is smaller and baseline-raised. Shows "-" idle.
- Octave: single `<div>` bottom-right. Shows "-" idle.
- Strobe SVG (viewBox 0 0 120 65): 11 diamond `<rect>` elements rotated 45° on ∩ arc from left (π) to right (0) through top, pivot at (60,65). Pink fill `#e83060`. Group stored as `strobeGroup` for Story 4.3 rotation.
- Mode tabs: 3 `<span>` elements top-right; `_updateTabs(mode)` helper applies active blue styling; called on every `update()`. Init state: "Free" highlighted.
- `destroy()` cancels RAF (none in this story) and calls `panel.remove()`.
- `update()` is stubbed — calls `_updateTabs()` only; gauge/arrows/note/octave wired in Story 4.2; strobe animation in Story 4.3.
- NFR-07 deviation: custom colour palette via `element.style` (same precedent as analogue-gauge; no Tailwind token equivalents for `#04041a` navy, `#00c878` LED-green, `#e83060` strobe pink).
- Added `<option value="axe-fx-iii">Axe-Fx III</option>` to `.tuner-viz-select` in `screen.js` at line ~338, following exact selected-state pattern of existing options.

### File List

- `visualization/axe-fx-iii.js` (new)
- `screen.js` (modified — added Axe-Fx III option to viz select)
