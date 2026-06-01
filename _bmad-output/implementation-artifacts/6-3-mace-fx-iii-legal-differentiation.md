# Story 6.3: Mace Fx III — Legal Differentiation

---
baseline_commit: 5df16e4f512bec9dedd52bae87c208dd695aec9d
---

Status: review

## Story

As a plugin distributor shipping the Mace Fx III visualization,
I want the Axe-Fx III visualization renamed, recolored, and its strobe circle made fully visible,
so that the visualization is legally distinct from Fractal Audio's Axe-Fx III product and looks polished.

## Acceptance Criteria

1. `visualization/axe-fx-iii.js` is renamed to `visualization/mace-fx-iii.js`; the old file no longer exists.
2. The window global is `window['_tunerViz_mace-fx-iii']`; `window['_tunerViz_axe-fx-iii']` is removed.
3. All references in `screen.js` to `"axe-fx-iii"` are replaced with `"mace-fx-iii"` (the `<option>` value, the option label text reads "Mace Fx III").
4. The mode tab active-background color (`_COL_TAB_ACT_BG`) changes from blue (`#2060d8`) to slate-gray (`#505868`); the tab underline border uses the same updated color.
5. The strobe arc color (`_COL_STROBE`) changes from pink/magenta (`#e83060`) to orange (`#e87020`); all SVG glow filters that reference this color are updated.
6. The strobe is rendered as a **full dashed circle** (not a semicircle protruding from the bottom). The circle center is fully inside the panel bounds; no part of the strobe is clipped by the panel's `overflow-hidden`.
7. The strobe animation behavior (speed proportional to cents deviation, smooth deceleration when signal stops, direction reversal) is unchanged.
8. No other visual element is altered (tick colors, note/octave text, gauge marker, arrows).

## Tasks / Subtasks

- [x] Rename file (AC: 1)
  - [x] Copy `visualization/axe-fx-iii.js` to `visualization/mace-fx-iii.js`
  - [x] Delete `visualization/axe-fx-iii.js`
- [x] Update window registration in `visualization/mace-fx-iii.js` (AC: 2)
  - [x] Change `window['_tunerViz_axe-fx-iii']` → `window['_tunerViz_mace-fx-iii']`
  - [x] Update file-header comment (description + contract line) to say "Mace Fx III"
- [x] Update `screen.js` (AC: 3)
  - [x] Change `value="axe-fx-iii"` → `value="mace-fx-iii"` in the option element (~line 365)
  - [x] Change option text `Axe-Fx III` → `Mace Fx III`
  - [x] Change `visualizationMode === 'axe-fx-iii'` → `visualizationMode === 'mace-fx-iii'`
- [x] Recolor tabs (AC: 4)
  - [x] In `visualization/mace-fx-iii.js`, change `_COL_TAB_ACT_BG = '#2060d8'` → `'#505868'`
- [x] Recolor strobe (AC: 5)
  - [x] Change `_COL_STROBE = '#e83060'` → `'#e87020'`
  - [x] Confirm the SVG `feFlood flood-color` in the strobe glow filter also derives from `_COL_STROBE` (it does — it's passed as the `flood-color` attribute); no extra changes needed there.
- [x] Fix strobe to full circle (AC: 6, 7)
  - [x] Change `_sVB_W = 120`, `_sVB_H = 120` (square viewBox)
  - [x] Change `_scx = 60`, `_scy = 60` (center of viewBox, not bottom edge)
  - [x] Reduce `_TUNER_STROBE_R` to 38 (R + dashLen/2 = 38 + 17.9 = 55.9 < 60 ✓)
  - [x] Change `strobeSvg` viewBox to `'0 0 120 120'`
  - [x] Change `strobeSvg.style.width` from `'30.94%'` to `'22%'`
  - [x] Changed `strobeSvg.style.bottom` from `'0'` to `'4%'`
  - [x] Replaced `arcPath` `<path>` with `<circle cx=60 cy=60 r=38>`; stroke-dasharray/dashoffset work identically
  - [x] Update `_halfCirc` to full circumference: `2 * Math.PI * _TUNER_STROBE_R`
  - [x] Recalculate `_dashLen = 3 * _halfCirc / 20`
  - [x] `_totalDash = _dashLen + _gapLen` unchanged

## Dev Notes

### File Rename — PowerShell (Windows)

```
Copy-Item visualization/axe-fx-iii.js visualization/mace-fx-iii.js
Remove-Item visualization/axe-fx-iii.js
```

### strobe.js: Using `<circle>` for Full-Circle Dash

Replace the `arcPath` (`<path>`) declaration with:

```javascript
var arcPath = document.createElementNS(_SVG_NS, 'circle');
arcPath.setAttribute('cx', String(_scx));
arcPath.setAttribute('cy', String(_scy));
arcPath.setAttribute('r',  String(_TUNER_STROBE_R));
arcPath.setAttribute('fill', 'none');
arcPath.setAttribute('stroke', _COL_STROBE);
arcPath.setAttribute('stroke-width', String(_dashLen));
arcPath.setAttribute('stroke-dasharray', _dashLen + ' ' + _gapLen);
arcPath.setAttribute('stroke-linecap', 'butt');
arcPath.setAttribute('filter', 'url(#' + _strobeGlowId + ')');
```

The RAF loop sets `arcPath.setAttribute('stroke-dashoffset', ...)` — this works identically on `<circle>`.

### Strobe Constants Summary (after change)

```javascript
var _TUNER_STROBE_R   = 38;                        // radius in SVG units
var _sVB_W = 120, _sVB_H = 120;
var _scx = 60, _scy = 60;
var _halfCirc  = 2 * Math.PI * _TUNER_STROBE_R;   // full circumference
var _dashLen   = 3 * _halfCirc / 20;               // ≈ 35.8 SVG units
var _gapLen    = (2 / 3) * _dashLen;               // ≈ 23.9 SVG units
```

Check: `_TUNER_STROBE_R + _dashLen/2 = 38 + 17.9 = 55.9 < 60` ✓ — circle plus outer glow edge fits in 120-wide viewBox with margin.

### No Change to Animation Logic

The `_animateStrobe` function, `_smoothedCents` lerp, and `_strobeOffset` accumulator stay identical. Only `arcPath` becomes a `<circle>` and the offset attribute target is the same variable.

### Manual Verification

- Select "Mace Fx III" in viz selector; panel renders with gray tabs and orange strobe circle
- Full dashed circle visible near panel bottom; no clipping at bottom or sides
- Play note sharp of target: circle rotates; stops when in tune; no pink/blue tints remain
- Select "Axe-Fx III" in selector: should show "Mace Fx III" (option renamed); old value no longer present
- Confirm `visualization/axe-fx-iii.js` is deleted

### References

- Source file: `visualization/axe-fx-iii.js` (read before editing)
- Viz selector in `screen.js` ~line 362–367
- Viz factory contract: `_bmad-output/planning-artifacts/architecture.md` §5
- Previous strobe animation pattern: `visualization/strobe.js`

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
None — all changes straightforward; no runtime errors encountered.

### Completion Notes List
- Renamed `visualization/axe-fx-iii.js` → `visualization/mace-fx-iii.js`; deleted original
- Changed window global to `window['_tunerViz_mace-fx-iii']`; updated header comment to "Mace Fx III"
- Updated `screen.js` option: value `mace-fx-iii`, label "Mace Fx III"
- `_COL_TAB_ACT_BG` changed `#2060d8` → `#505868` (slate-gray tabs + border)
- `_COL_STROBE` changed `#e83060` → `#e87020` (orange); glow filter picks it up via `_COL_STROBE` variable — no separate change needed
- Strobe: `_TUNER_STROBE_R = 38`, viewBox `120×120`, `_scx=60 _scy=60`, `_halfCirc = 2π×38`, `bottom:4%`, `width:22%`
- Arc `<path>` replaced with `<circle cx=60 cy=60 r=38>`; RAF loop uses same `arcPath.setAttribute('stroke-dashoffset',...)` — works on circle elements identically

### File List
- visualization/mace-fx-iii.js (new — renamed from axe-fx-iii.js)
- visualization/axe-fx-iii.js (deleted)
- screen.js

### Change Log
- 2026-06-01: Story 6.3 complete — Mace Fx III legal differentiation: rename, recolor tabs/strobe, full-circle strobe
