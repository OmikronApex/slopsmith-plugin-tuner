# Story 7.1: Relocate Visualization Assets to Dedicated Endpoint

---
baseline_commit: 7b91083d04a57521fb19af0980176d6405f06748
---

Status: review

## Story

As a developer maintaining the slopsmith-plugin-tuner,
I want SVG visualization assets served from a dedicated `/viz-assets/` route backed by a `visualization/assets/` subfolder,
so that asset URLs are unambiguous, non-colliding with Slopsmith's host asset namespace, and reliably reachable by visualization code.

## Acceptance Criteria

1. `assets/Bathroom.svg`, `assets/Plunger.svg`, and `assets/Toiletbowl.svg` are moved to `visualization/assets/`; the root `assets/` folder no longer contains them (it retains `plugin.css`).
2. `routes.py` exposes `GET /api/plugins/tuner/viz-assets/{filename}` serving `.svg` and `.png` files from `visualization/assets/`, guarded by the same `.resolve()` + `.relative_to()` path-traversal check used by all other serving routes.
3. A path-traversal attempt (e.g., `../routes.py`) via the new route returns 404.
4. `visualization/toilet-tuner.js` references assets via `/api/plugins/tuner/viz-assets/<filename>` — no reference to `/api/plugins/tuner/assets/` or `/api/plugins/tuner/visualization/` remains for SVG assets.
5. When the Toilet Tuner visualization is active in a running Slopsmith instance, all three SVG elements (bathroom background, plunger, toilet bowl overlay) render correctly.

## Tasks / Subtasks

- [x] Move SVG files (AC: 1)
  - [x] Move `assets/Bathroom.svg` → `visualization/assets/Bathroom.svg`
  - [x] Move `assets/Plunger.svg` → `visualization/assets/Plunger.svg`
  - [x] Move `assets/Toiletbowl.svg` → `visualization/assets/Toiletbowl.svg`
  - [x] Confirm `assets/plugin.css` is NOT moved (stays in `assets/`)
- [x] Add viz-assets route to `routes.py` (AC: 2, 3)
  - [x] Declare `_viz_assets_dir = Path(__file__).parent / "visualization" / "assets"` alongside the existing dir vars
  - [x] Add `_serve_asset_from(base_dir, filename)` helper that allows `.svg` and `.png` extensions
  - [x] Register `@app.get("/api/plugins/tuner/viz-assets/{filename}")` using that helper
- [x] Update `visualization/toilet-tuner.js` (AC: 4, 5)
  - [x] Change `_TUNER_TT_ASSET_BASE` from `'/api/plugins/tuner/assets/'` to `'/api/plugins/tuner/viz-assets/'`
  - [x] Confirm the three usages (CSS background-image, plunger `<img>` src, bowl `<img>` src) all resolve through the constant — no hardcoded URLs remain

## Dev Notes

### Why This Matters

`toilet-tuner.js` currently references `/api/plugins/tuner/assets/` which has no matching route in `routes.py` — the SVGs are silently unreachable and the Toilet Tuner visualization shows no background or plunger. This story fixes the root cause and establishes a clean namespace.

The new route name `viz-assets` avoids any collision with Slopsmith's host `/api/assets/` endpoint (if it exists) and is clearly scoped to this plugin.

### routes.py — Exact Pattern to Follow

All existing file-serving routes follow this pattern (from `routes.py`):

```python
_viz_dir     = Path(__file__).parent / "visualization"
_workers_dir = Path(__file__).parent / "workers"
_utils_dir   = Path(__file__).parent / "utils"

def _serve_js_from(base_dir: Path, filename: str) -> Response:
    target = (base_dir / filename).resolve()
    try:
        target.relative_to(base_dir.resolve())
    except ValueError:
        return Response("", status_code=404)
    if target.suffix == ".js" and target.is_file():
        return Response(target.read_text(encoding="utf-8"), media_type="application/javascript")
    return Response("", status_code=404)
```

Add a parallel helper for static assets (SVG/PNG are binary-safe but readable as text; serve as bytes for correctness):

```python
_viz_assets_dir = Path(__file__).parent / "visualization" / "assets"

_ASSET_TYPES = {".svg": "image/svg+xml", ".png": "image/png"}

def _serve_asset_from(base_dir: Path, filename: str) -> Response:
    target = (base_dir / filename).resolve()
    try:
        target.relative_to(base_dir.resolve())
    except ValueError:
        return Response("", status_code=404)
    media_type = _ASSET_TYPES.get(target.suffix)
    if media_type and target.is_file():
        return Response(target.read_bytes(), media_type=media_type)
    return Response("", status_code=404)
```

Register the route inside `setup()` alongside the other routes:

```python
@app.get("/api/plugins/tuner/viz-assets/{filename}")
def get_viz_asset(filename: str):
    return _serve_asset_from(_viz_assets_dir, filename)
```

Note: `_viz_assets_dir` and `_ASSET_TYPES` and `_serve_asset_from` are module-level (outside `setup()`), same as the existing dir vars and `_serve_js_from`.

### toilet-tuner.js — Single Constant Change

The entire asset base URL is controlled by one constant at the top of the IIFE:

```javascript
// Before:
var _TUNER_TT_ASSET_BASE = '/api/plugins/tuner/assets/';

// After:
var _TUNER_TT_ASSET_BASE = '/api/plugins/tuner/viz-assets/';
```

Three usages flow through this constant:
- `panel.style.backgroundImage = "url('" + _TUNER_TT_ASSET_BASE + "Bathroom.svg')"` (line ~45)
- `plungerEl.src = _TUNER_TT_ASSET_BASE + 'Plunger.svg'` (line ~63)
- `bowlEl.src = _TUNER_TT_ASSET_BASE + 'Toiletbowl.svg'` (line ~72)

No other changes needed in `toilet-tuner.js`.

### What Must NOT Change

- `assets/plugin.css` stays in `assets/` — it is served by a different mechanism (likely the Slopsmith host's static serving of the plugin directory). Do not move it.
- The existing `/api/plugins/tuner/visualization/{filename}` route is `.js`-only by the `target.suffix == ".js"` check — no change needed there.
- No other visualization files reference SVG assets; only `toilet-tuner.js` needs updating.

### Manual Verification

1. Open Slopsmith, select "Toilet Tuner" visualization in the tuner settings panel
2. Confirm bathroom background SVG renders (no blank panel)
3. Plunger SVG visible above the toilet bowl
4. Play a note sharp of target → plunger slides right; in tune → plunger dips into bowl with overlay visible
5. In browser devtools Network tab: requests to `/api/plugins/tuner/viz-assets/Bathroom.svg` return 200 with `Content-Type: image/svg+xml`
6. Verify `GET /api/plugins/tuner/viz-assets/../routes.py` returns 404

### References

- `routes.py` — full file read before editing; follow existing `_serve_js_from` pattern exactly
- `visualization/toilet-tuner.js` lines 17–18 — `_TUNER_TT_ASSET_BASE` constant
- `assets/` folder — move only the three SVGs, leave `plugin.css`
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7, Story 7.1]
- [Source: `_bmad-output/planning-artifacts/architecture.md` §2 — route patterns and path traversal guard]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Moved three SVGs from root `assets/` to `visualization/assets/`; `assets/plugin.css` left in place
- Added `_viz_assets_dir`, `_ASSET_MEDIA_TYPES` dict, and `_serve_asset_from()` helper to `routes.py` following the exact `_serve_js_from` pattern with path-traversal guard
- Registered `GET /api/plugins/tuner/viz-assets/{filename}` route
- Changed `_TUNER_TT_ASSET_BASE` constant in `toilet-tuner.js` from `/api/plugins/tuner/assets/` to `/api/plugins/tuner/viz-assets/`; all three asset references (background-image, plunger img src, bowl img src) flow through this constant

### File List

- `visualization/assets/Bathroom.svg` (moved from `assets/`)
- `visualization/assets/Plunger.svg` (moved from `assets/`)
- `visualization/assets/Toiletbowl.svg` (moved from `assets/`)
- `assets/` — SVGs removed; `plugin.css` unchanged
- `routes.py`
- `visualization/toilet-tuner.js`

### Change Log

- 2026-06-03: Story 7.1 complete — moved SVGs to `visualization/assets/`, added `/viz-assets/` route, updated `toilet-tuner.js` asset base URL
