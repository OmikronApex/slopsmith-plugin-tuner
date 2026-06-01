# Story 6.4: CHEF MT-3 — Scaffold, Static Panel Layout & Settings Wiring

Status: ready-for-dev

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

- [ ] Create `visualization/chef-mt3.js` (AC: 1–8, 10)
  - [ ] IIFE wrapper `(function() { 'use strict'; ... })()`
  - [ ] Module-level constants (prefix `_TUNER_MT3_`):
    - `_TUNER_MT3_IN_TUNE_THR = 2` (cents)
    - `_TUNER_MT3_GAUGE_CENTS = 50` (±50 range)
    - `_TUNER_MT3_TICK_COUNT = 11` (gauge tick lines including centre)
    - `_TUNER_MT3_MARKER_COUNT = 3` (moving glow lights, Story 6.5)
    - `_TUNER_MT3_STROBE_GROUP_COUNT = 5` (strobe mode groups, Story 6.5)
  - [ ] Color constants:
    - `_MT3_COL_BG = '#0a0a0a'` (shiny black)
    - `_MT3_COL_BORDER = '#3a3a3a'` (chrome perimeter)
    - `_MT3_COL_GAUGE_ARC = 'rgba(255,255,255,0.18)'` (glass arc stroke)
    - `_MT3_COL_TICK = 'rgba(255,255,255,0.55)'` (tick lines)
    - `_MT3_COL_MARKER_LIT = '#ff8800'` (orange glow marker, used in 6.5)
    - `_MT3_COL_MARKER_DIM = 'rgba(80,30,0,0.4)'` (unlit marker)
    - `_MT3_COL_SEG_LIT = '#ff2200'` (bright red lit segment)
    - `_MT3_COL_SEG_LIT_GLOW = '0 0 6px 2px #ff2200, 0 0 12px 4px #aa1100'`
    - `_MT3_COL_SEG_UNLIT = '#2a0000'` (dark-red unlit segment)
    - `_MT3_COL_BUTTON = '#1a1a1a'` (rubber button face)
    - `_MT3_COL_LABEL = '#c8c8c8'` (white label text)
  - [ ] Register as `window['_tunerViz_chef-mt3'] = function(container) { ... }` (bracket notation)
  - [ ] Build outer chrome-border panel (AC: 2)
    - `panel` div: `position:relative`, `overflow:hidden`, `aspectRatio: '5 / 3'`, `minHeight: '120px'`, `backgroundColor: _MT3_COL_BG`, `border: '2px solid #505050'`, `borderRadius: '6px'` (chamfered via border-radius)
  - [ ] Build four corner screws (AC: 3)
    - For each corner: small `div` (12px × 12px), `borderRadius: '50%'`, `background: 'radial-gradient(...)'` to simulate screw head, `position:absolute`, positioned at `top:3%/bottom:3%` × `left:2%/right:2%`
    - Add a horizontal `div` (the slot line) centered inside each screw circle for cross-slot detail
  - [ ] Build curved gauge arc SVG (AC: 4)
    - `_MT3_VB_W = 200, _MT3_VB_H = 110`; arc center `cx=100, cy=110`; radius `_MT3_ARC_R = 90`
    - Arc path: `M (cx-R) cy A R R 0 0 1 (cx+R) cy` (upward ∩ semicircle, sweep=1)
    - Arc stroke: `_MT3_COL_GAUGE_ARC`, stroke-width `≈ 18` SVG units (wide for glass look)
    - Glass sheen: second arc path identical geometry, stroke `rgba(255,255,255,0.35)`, stroke-width `3`, `stroke-dasharray: "10 8"` (dashed highlight)
    - Tick lines: 11 points evenly spaced along the arc angle (−90° to +90° in 18° steps), each a short radial line (inner radius 84, outer radius 90), stroke `_MT3_COL_TICK`, stroke-width `1.5`
    - Tick labels `"−50"`, `"0"`, `"+50"` as `<text>` SVG elements below the arc ends/centre (y = `cy + 8` outside the arc base)
    - SVG: `position:absolute`, `top:5%`, `left:0`, `right:0`, width `100%`, height `55%`, `overflow:visible`
    - At this stage no marker light elements; reserve DOM refs array `_mt3MarkerEls = []` in factory scope for Story 6.5 to populate
  - [ ] Build 3 gauge marker placeholder elements (AC: 4, for Story 6.5 to activate)
    - 3 small circle elements (`<circle>` in the gauge SVG), initially `opacity:0`; store refs in `_mt3MarkerEls[0..2]`
  - [ ] Build 7-segment display (AC: 5)
    - Outer display container: `position:absolute`, `bottom:18%`, `left:50%`, `transform:translateX(-50%)`, `width:18%`, `height:22%`
    - Dark-red display background div behind segments
    - 7+1 segment elements (a, b, c, d, e, f, g-left, g-right split): styled as thin rectangles/trapezoids in `_MT3_COL_SEG_UNLIT`; store refs in `_mt3SegEls` object keyed `{a,b,c,d,e,f,g1,g2}`
    - "#" symbol element: `position:absolute` to lower-right of display container; color `_MT3_COL_SEG_UNLIT`; store ref as `_mt3SharpEl`
  - [ ] Build segment lookup table `_TUNER_MT3_SEGMENTS` (same letter → 8-bit array mapping as pp-tiny pattern; letters A–G plus space; g1 and g2 are the split centre bar)
  - [ ] Build MODE and BRGHT. buttons (AC: 6)
    - Left button: `position:absolute`, `bottom:5%`, `left:calc(50% - 22%)`, `width:10%`, `height:14%`; `backgroundColor:_MT3_COL_BUTTON`; `borderRadius:3px`; `border:1px solid #333`; `boxShadow:'inset 0 1px 2px rgba(255,255,255,0.08), 0 2px 3px rgba(0,0,0,0.7)'`; label `"MODE"` below or inside
    - Right button: mirror position to the right (`left:calc(50% + 12%)`); label `"BRGHT."`
    - Buttons are non-interactive DOM (no click handlers yet; MODE click wired in Story 6.5)
  - [ ] Brand label "CHEF MT-3" (AC: 7): small text element, `position:absolute`, `top:4%`, `right:3%`, color `_MT3_COL_LABEL`, `fontSize:'0.55em'`
  - [ ] Stub `update(note, cents, freq, mode)` — empty function body (AC: 10)
  - [ ] `destroy()` — `panel.remove()` (AC: 8)
- [ ] Wire viz select in `screen.js` (AC: 9)
  - [ ] Add `<option value="chef-mt3" ${visualizationMode === 'chef-mt3' ? 'selected' : ''}>CHEF MT-3</option>` after the "PP-Tiny" option (~line 367)

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

### Debug Log References

### Completion Notes List

### File List
