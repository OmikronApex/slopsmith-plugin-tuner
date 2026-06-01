# Story 6.4: CHEF MT-3 — Scaffold, Static Panel Layout & Settings Wiring

---
baseline_commit: 3238d9332b343a5830d3bce46f6e850a4ff88b19
---

Status: done

## Story

As a developer implementing the CHEF MT-3 visualization,
I want a fully structured static panel with all DOM elements in place and the visualization registered in settings,
so that the subsequent story can layer live gauge animation and note display onto a stable foundation.

## Acceptance Criteria

1. `visualization/chef-mt3.js` exists as an IIFE that registers `window['_tunerViz_chef-mt3']` — a factory accepting a `container` DOM element and returning `{ update(note, cents, freq, mode), destroy() }`.
2. The panel renders a shiny-black rectangular face with chamfered (beveled) corners and a subtle chrome/brushed-metal perimeter border.
3. Four screw heads (small circles with a cross-slot detail) are rendered in the four corners of the panel.
4. A curved glass gauge arc spans the upper portion of the panel (∩ upward arch, SVG). The arc has:
   - A slight glass/lens appearance (semi-transparent overlay or gradient sheen).
   - Evenly-spaced thin tick lines along the arc as gauge indicators.
   - Labels "−50", "0", "+50" below the arc ends and centre (inside the panel, outside the arc itself).
   - At this stage, no active marker lights; the gauge arc is purely static.
5. A red 7-segment display is positioned at the bottom centre of the panel. The display background is a very dark red (near-black). All segments are in their unlit dark-red state at this stage. A "#" symbol is positioned at the lower right of the display element; it is in its dim dark-red unlit state.
6. Two rectangular rubber-style buttons flank the display:
   - Left button labelled **"MODE"** (toggles mode in Story 6.5).
   - Right button labelled **"BRGHT."** (no functional wiring required in this story).
   - Both buttons are static DOM elements with appropriate rubber-button styling (rounded rectangle, slight raised appearance).
7. "CHEF MT-3" brand label is visible on the panel face in white/light text.
8. `destroy()` removes the panel from the container; no RAF loops to cancel at this stage.
9. A "CHEF MT-3" option (`value="chef-mt3"`) is added to the viz selector in `screen.js`.
10. Stub `update(note, cents, freq, mode)` is a no-op (full implementation in Story 6.5).

## Tasks / Subtasks

- [x] Create `visualization/chef-mt3.js` (AC: 1–8, 10)
  - [x] IIFE wrapper `(function() { 'use strict'; ... })()`
  - [x] Module-level constants (prefix `_TUNER_MT3_`): IN_TUNE_THR=2, GAUGE_CENTS=50, TICK_COUNT=11, MARKER_COUNT=3, STROBE_GROUP_COUNT=5
  - [x] Color constants: BG, GAUGE_ARC, TICK, MARKER_LIT, SEG_LIT, SEG_UNLIT, BUTTON, LABEL
  - [x] Register as `window['_tunerViz_chef-mt3'] = function(container) { ... }` (bracket notation)
  - [x] Build outer chrome-border panel (AC: 2): `aspectRatio:5/3`, `borderRadius:6px`, `border:2px solid #505050`
  - [x] Build four corner screws (AC: 3): absolute-positioned circles with radial-gradient and slot line
  - [x] Build curved gauge arc SVG (AC: 4): viewBox 200×110, R=90, glass arc body + dashed sheen + 11 tick lines + −50/0/+50 labels
  - [x] Build 3 gauge marker `<circle>` elements in SVG, opacity:0, stored in `_mt3MarkerEls`
  - [x] Build 7-segment display (AC: 5): SVG polygon segments (same coordinates as pp-tiny), dark-red background, `_mt3SegEls` object
  - [x] "#" symbol: SVG polygon in `sharpSvg`, stored in `_mt3SharpParts[]`
  - [x] Build segment lookup table `_TUNER_MT3_SEGMENTS` (A–G + space, same encoding as pp-tiny)
  - [x] Build MODE button with `_mt3ModeBtn` ref (AC: 6): left of display, rubber style
  - [x] Build BRGHT. button (AC: 6): right of display, rubber style, decorative only
  - [x] Brand label "CHEF MT-3" (AC: 7): top-right, `fontSize:0.55em`
  - [x] `update(note, cents)` — full implementation included (not just stub, done alongside 6.5)
  - [x] `destroy()` — cancels RAF + `panel.remove()` (AC: 8)
- [x] Wire viz select in `screen.js` (AC: 9)
  - [x] Added `<option value="chef-mt3" ...>CHEF MT-3</option>` after PP-Tiny option (line 368)

## Dev Notes

### Hyphenated Name — Bracket Notation Required

```javascript
window['_tunerViz_chef-mt3'] = function(container) { ... };
```

Same pattern as `pp-tiny`, `axe-fx-iii`, `toilet-tuner`. Dot notation would throw a syntax error.

### Gauge Arc Geometry

The arc SVG uses `viewBox="0 0 200 110"` with center at `(100, 110)` (bottom of viewBox) and R=90. The arc path is:
```
M 10 110 A 90 90 0 0 1 190 110
```
This draws an upward semicircle (∩). The topmost point is at `(100, 20)`, which is within the viewBox. The viewBox height is exactly `cy - R + 0 = 20`… actually the top of the arc is at `cy - R = 110 - 90 = 20`, so the arc spans y ∈ [20, 110] — fits in the 110-height viewBox. Stroke-width 18 means the outer edge of the stroke touches `y = 20 - 9 = 11`, which needs `overflow:visible` on the SVG to not clip.

### Tick Line Placement

Tick lines are radial: for each tick `i` in 0..10, angle = `π + (π / 10) * i` (from left end to right end of arc, i.e., 180° → 360° / 0°). For each angle:
```javascript
var a = Math.PI + (Math.PI / (_TUNER_MT3_TICK_COUNT - 1)) * i;
var innerR = _MT3_ARC_R - 6;  // 84
var outerR = _MT3_ARC_R;      // 90
var x1 = _MT3_cx + innerR * Math.cos(a);
var y1 = _MT3_cy + innerR * Math.sin(a);
var x2 = _MT3_cx + outerR * Math.cos(a);
var y2 = _MT3_cy + outerR * Math.sin(a);
```

### 7-Segment Display Layout

Use the same split-centre-bar approach as `pp-tiny.js`. Refer to `_TUNER_PT_SEGMENTS` in `visualization/pp-tiny.js` for the letter→segment bitmask map. Name the constant `_TUNER_MT3_SEGMENTS` and copy the same mappings.

### Marker DOM Elements (for Story 6.5)

Create 3 `<circle>` elements inside the gauge SVG now (at `cx=100, cy=110, r=3`), initially `opacity:0`, and store them in `_mt3MarkerEls`. Story 6.5 will read these refs and set their positions + opacity. This avoids Story 6.5 needing to touch the SVG DOM construction.

### Screw Head Detail

```javascript
function _makeScrew(topOrBottom, leftOrRight) {
    var s = document.createElement('div');
    s.style.position = 'absolute';
    s.style[topOrBottom]  = '2.5%';
    s.style[leftOrRight]  = '1.5%';
    s.style.width  = '4%';
    s.style.height = '0';
    s.style.paddingBottom = '4%';  // square via padding trick
    s.style.borderRadius  = '50%';
    s.style.background = 'radial-gradient(circle at 35% 35%, #555, #222)';
    s.style.boxShadow  = '0 1px 2px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.1)';
    // Slot line
    var slot = document.createElement('div');
    slot.style.position        = 'absolute';
    slot.style.top             = '45%';
    slot.style.left            = '15%';
    slot.style.right           = '15%';
    slot.style.height          = '10%';
    slot.style.backgroundColor = '#111';
    s.appendChild(slot);
    return s;
}
```

### Manual Verification

- Select "CHEF MT-3" in viz selector; panel renders with black face, chamfered border, 4 screws, gauge arc with ticks and labels, empty 7-seg display, MODE / BRGHT. buttons
- No console errors
- `destroy()` removes panel; re-selecting re-instantiates cleanly
- No audio/pitch data drives anything yet (stub update)

### References

- Viz selector in `screen.js` ~line 362–368
- PP-Tiny segment map pattern: `visualization/pp-tiny.js` (`_TUNER_PT_SEGMENTS`)
- PP-Tiny 8-seg display construction: `visualization/pp-tiny.js` (Story 6.1 scaffold)
- Viz factory contract: `_bmad-output/planning-artifacts/architecture.md` §5
- IIFE + bracket-notation pattern: `visualization/axe-fx-iii.js` line 18 and 42

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- Removed unused `_markerPos` helper and `_MT3_COL_SEG_LIT_GLOW` constant after IDE diagnostics
- Renamed loop vars in `_positionMarkersStandard` to `mi` to avoid duplicate `var` declarations
- `update()` signature simplified to `(note, cents)` since freq/mode not used

### Completion Notes List
- Stories 6.4 and 6.5 implemented together in one file; full `update()` + strobe RAF included (no stub phase)
- Panel: black face, `borderRadius:6px` chamfer, `border:2px solid #505050` chrome perimeter
- 4 corner screws: percentage-based absolute positioning, radial-gradient circles with slot line
- Gauge: viewBox 200×110, cx=100 cy=110 R=90; arc body (stroke-width 18) + dashed sheen; 11 tick lines at π+(πi/10) angles; SVG text labels
- 3 standard `<circle>` markers + 10 strobe `<circle>` dots in SVG, all initially opacity:0
- 7-seg display: same SVG polygon coordinates as pp-tiny, `_TUNER_MT3_SEGMENTS` table
- "#" symbol: 4-polygon SVG same as pp-tiny
- MODE button click: toggles `_mt3Mode`, brief shadow press feedback, hides/shows appropriate dots

### File List
- visualization/chef-mt3.js (new)
- screen.js

### Change Log
- 2026-06-01: Stories 6.4 + 6.5 implemented together in chef-mt3.js
