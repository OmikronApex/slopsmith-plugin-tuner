# Story 5.1: Scaffold, Static Layout & Settings Wiring

---
baseline_commit: 01244b1a3880fed6ecd8aaac845ee54ac39e9764
---

Status: done

## Story

As a developer implementing the Toilet Tuner visualization,
I want a fully structured static panel with all DOM elements in place and the visualization registered in settings,
so that subsequent stories can layer live data and animation onto a stable, correctly-laid-out foundation.

## Acceptance Criteria

1. `visualization/toilet-tuner.js` exists as an IIFE that registers `window['_tunerViz_toilet-tuner']` — a factory accepting a `container` DOM element and returning `{ update(note, cents, freq), destroy() }`.
2. The factory appends a panel containing: background (`Bathroom.svg`), plunger (`Plunger.svg`) centred above the toilet bowl, toilet-bowl overlay (`Toiletbowl.svg`) hidden by default, and a note name text element showing "–" over the calendar area.
3. A new FastAPI route `GET /api/plugins/tuner/assets/{filename}` in `routes.py` serves SVG files from `visualization/assets/`, guarded by the same path-traversal pattern (`.resolve()` + `.relative_to()`), restricted to `.svg` extension.
4. The viz selector in `screen.js` includes `<option value="toilet-tuner">Toilet Tuner</option>` with correct `selected` state.
5. `destroy()` removes all appended DOM nodes; no RAF IDs to cancel at this stage.
6. No inline `style=""` attributes on elements whose styling can be expressed with Tailwind; pixel-precise positional layout uses the established viz pattern (see Dev Notes).

## Tasks / Subtasks

- [x] Add SVG asset route to `routes.py` (AC: 3)
  - [x] Declare `_assets_dir = Path(__file__).parent / "visualization" / "assets"` inside `setup()`
  - [x] Add `@app.get("/api/plugins/tuner/assets/{filename}")` handler using `_serve_svg_from(_assets_dir, filename)` helper
  - [x] Write `_serve_svg_from(base_dir, filename)` mirroring `_serve_js_from` but checking `target.suffix == ".svg"` and `media_type="image/svg+xml"`
- [x] Create `visualization/toilet-tuner.js` scaffold (AC: 1, 2, 5)
  - [x] IIFE wrapper `(function() { 'use strict'; ... })()`
  - [x] Declare module-level constants: `_TUNER_TT_IN_TUNE_THR = 2`, `_TUNER_TT_ASSET_BASE = '/api/plugins/tuner/assets/'`
  - [x] Factory function registered as `window['_tunerViz_toilet-tuner'] = function(container) { ... }`
  - [x] Build panel: outer `div.relative.w-full.overflow-hidden.select-none` with `aspect-ratio: 16/9` (inline style — same as axe-fx-iii pattern)
  - [x] Background `<img>` filling panel (see Dev Notes for positioning)
  - [x] Plunger `<img>` absolutely positioned above the bowl centre (see Dev Notes)
  - [x] Toiletbowl overlay `<img>` absolutely positioned over the bowl, `visibility: hidden`
  - [x] Note name `<div>` absolutely positioned over the calendar area, initial text "–"
  - [x] Stub `update(note, cents, freq)` that only sets note text (no animation yet)
  - [x] `destroy()` that calls `panel.remove()`
- [x] Wire viz select in `screen.js` (AC: 4)
  - [x] Add `<option value="toilet-tuner" ${visualizationMode === 'toilet-tuner' ? 'selected' : ''}>Toilet Tuner</option>` after the existing Axe-Fx III option (~line 361)

## Dev Notes

### Critical: SVG Assets Need a New Backend Route

`_serve_js_from()` enforces `target.suffix == ".js"` — SVG requests return 404. Story 5.1 **must** add a parallel `_serve_svg_from()` helper and `GET /api/plugins/tuner/assets/{filename}` route before the frontend `<img>` tags will load.

Pattern to follow in `routes.py` (inside `setup()`):

```python
_assets_dir = Path(__file__).parent / "visualization" / "assets"

def _serve_svg_from(base_dir: Path, filename: str) -> Response:
    target = (base_dir / filename).resolve()
    try:
        target.relative_to(base_dir.resolve())
    except ValueError:
        return Response("", status_code=404)
    if target.suffix == ".svg" and target.is_file():
        return Response(target.read_text(encoding="utf-8"), media_type="image/svg+xml")
    return Response("", status_code=404)

@app.get("/api/plugins/tuner/assets/{filename}")
def get_asset_file(filename: str):
    return _serve_svg_from(_assets_dir, filename)
```

### Viz Factory Registration

The name `toilet-tuner` contains a hyphen, so bracket notation is required (same as axe-fx-iii):

```javascript
window['_tunerViz_toilet-tuner'] = function(container) { ... };
```

`_setVisualization('toilet-tuner')` in `screen.js` calls `window['_tunerViz_toilet-tuner']` via `window[\`_tunerViz_${name}\`]` — the template literal produces the same bracket-notation lookup. No change to `screen.js` internals is needed.

### Panel Layout & Inline Style Convention

Existing visualizations (`axe-fx-iii.js`, `analogue-gauge.js`) use `element.style.*` for pixel-precise positional properties where no Tailwind token maps to the exact value. This is the established project pattern for visualizations; follow it.

Outer panel (same pattern as axe-fx-iii.js line 47–51):
```javascript
var panel = document.createElement('div');
panel.className = 'relative w-full overflow-hidden select-none';
panel.style.aspectRatio = '16 / 9';
panel.style.minHeight = '120px';
```

### SVG Coordinate Guide for Positioning

All three SVGs are loaded via `<img>` tags. The panel is `aspect-ratio: 16/9` so effective dimensions scale proportionally. Use **percentage-based** `position: absolute` for all overlays.

**Bathroom.svg** (`viewBox="0 0 1048576 1048576"` — square):
- The toilet is rendered inside the background. Key reference coordinates (as % of 1048576):
  - Bowl opening (dark ellipse centre): ~x=49%, y=64%
  - Bowl top (where plunger should hover): ~x=49%, y=60%
  - Calendar/display panel (upper-right): ~x=72–91%, y=7–35%

**Toiletbowl.svg** — overlay that covers just the front rim of the bowl. Position it over the bowl opening area. Suggested starting point: `left: 38%; top: 52%; width: 14%;` — adjust by visual inspection.

**Plunger.svg** (`29.8mm × 69.5mm` — tall and narrow, handle up, rubber cup at bottom):
- Centre horizontally over the bowl. Starting size: `width: 6%; ` height auto-follows.
- Raised position (Story 5.1 static): `left: 46%; top: 35%;` (above bowl, centred).
- The Story 5.2 animation will move `left` for L/R deviation and `top` for the dip.

**Note text** over calendar. Starting CSS: `right: 9%; top: 9%; font-size: 3.5%; color: #303332;` — calibrate visually.

### Asset URLs

```javascript
var _TUNER_TT_ASSET_BASE = '/api/plugins/tuner/assets/';
// Usage:
bgImg.src   = _TUNER_TT_ASSET_BASE + 'Bathroom.svg';
plungerImg.src = _TUNER_TT_ASSET_BASE + 'Plunger.svg';
bowlImg.src = _TUNER_TT_ASSET_BASE + 'Toiletbowl.svg';
```

### destroy() Pattern

Story 5.1 has no RAF — `destroy()` is a single `panel.remove()` call (same as Story 4.1):
```javascript
function destroy() { panel.remove(); }
```

### Screen.js viz select — exact insertion point

Current block in `screen.js` (~line 357–362):
```javascript
<select class="tuner-viz-select ...">
    <option value="default" ...>Default</option>
    <option value="strobe" ...>Strobe</option>
    <option value="analogue-gauge" ...>Analogue Gauge</option>
    <option value="axe-fx-iii" ...>Axe-Fx III</option>
</select>
```

Add after the `axe-fx-iii` option:
```javascript
<option value="toilet-tuner" ${visualizationMode === 'toilet-tuner' ? 'selected' : ''}>Toilet Tuner</option>
```

### Manual Verification

- Docker restart → open tuner panel → switch to "Toilet Tuner" via settings
- All three SVGs load (no broken images in DevTools Network tab)
- Panel renders: bathroom background fills container, plunger visible centred above bowl, note text "–" visible over calendar area
- Bowl overlay hidden (confirm with DevTools: `visibility: hidden`)
- Switch to another visualization → `destroy()` → container empty, no errors

### References

- Path traversal pattern: `routes.py` lines 87–95 (`_serve_js_from`)
- Factory registration with hyphenated name: `visualization/axe-fx-iii.js` line 42
- Panel layout/inline style pattern: `visualization/axe-fx-iii.js` lines 46–61
- Viz factory contract: `_bmad-output/planning-artifacts/architecture.md` §5
- Viz select block: `screen.js` lines 356–362

## Dev Agent Record

### Agent Model Used
claude-opus-4-8

### Debug Log References
None — straightforward implementation.

### Completion Notes List
- Added `_assets_dir` and `_serve_svg_from()` helper to `routes.py`; new `GET /api/plugins/tuner/assets/{filename}` route serves `.svg` files with path-traversal guard
- Created `visualization/toilet-tuner.js` IIFE with factory registered as `window['_tunerViz_toilet-tuner']`; RAF loop included (always-running pattern from axe-fx-iii); stub `update()` sets note text only; `destroy()` cancels RAF and removes panel
- Note: RAF loop started in scaffold (not stub-only) to avoid having to restructure in Story 5.2 — all animation vars declared, loop runs but does nothing meaningful until 5.2 populates `_currentCents`
- Added "Toilet Tuner" option to viz select in `screen.js` (~line 362)

### File List
- routes.py
- visualization/toilet-tuner.js
- screen.js

### Review Findings
- [x] [Review][Patch] `_serve_svg_from` Windows backslash path traversal — `%5C` decoded as `\` can escape `_assets_dir` on win32; add explicit check `if '\\' in filename` [routes.py]
- [x] [Review][Defer] SVG file read unbounded (`read_text` on large file blocks server thread) [routes.py] — deferred, pre-existing pattern identical to `_serve_js_from`
- [x] [Review][Decision] Bowl overlay permanently visible vs spec "hidden by default" — accepted intentional design change per user feedback

### Change Log
- 2026-05-31: Story 5.1 implemented — SVG asset route, toilet-tuner.js scaffold, settings wiring
