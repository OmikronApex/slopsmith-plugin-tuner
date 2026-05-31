# Deferred Work

## Deferred from: code review of stories 5.1 & 5.2 (2026-05-31)

- **SVG file read unbounded** (`routes.py` `_serve_svg_from`) — `read_text()` loads entire file synchronously; large/malformed SVG blocks server thread. Pre-existing pattern identical to `_serve_js_from`; low risk for static assets under dev control.
- **`destroy()` allows stale `update()` calls on detached DOM** (`toilet-tuner.js:134`) — After destroy, caller can still invoke `update()` on the closed closure; writes go to a detached DOM node (harmless). No practical bug in current Slopsmith teardown sequence.
- **`requestAnimationFrame` not feature-detected** (`toilet-tuner.js:97`) — No `window.requestAnimationFrame || window.webkitRequestAnimationFrame` polyfill. Project-wide pattern; all other visualizations follow the same convention.

## Deferred from: code review of stories 3.1, 3.2, 3.3 (2026-05-31)

- **Out-of-range freq shows strip endpoint label silently** (`analogue-gauge.js:_computeDrumY`) — Freq below ~18 Hz or above ~1047 Hz clamps to strip endpoints; needle still shows real cents, creating mismatch. Strip range covers full guitar/bass spec; out-of-range is an edge case.
- **No `white-space: nowrap` on freq drum labels** (`analogue-gauge.js`) — Very long Hz strings (e.g. "1047.5 Hz") could wrap and double the effective label row height at narrow container widths, desynchronising the two drums visually. Low probability in typical Slopsmith layouts.
- **RAF runs unconditionally from factory construction** (`analogue-gauge.js:317`) — No idle-detection or visibility pause. Pre-existing pattern matching `strobe.js`; Slopsmith always calls `destroy()` before navigation.
- **Already-queued RAF fires once after `destroy()`** (`analogue-gauge.js:362`) — Frame enqueued before `cancelAnimationFrame` fires once more; `activeViz` is nulled by `screen.js` before any `update()` can reach the detached DOM. Not observable in practice.

## Deferred from: code review of Epic 2 stories 2.3 & 2.4 (2026-05-30)

- **`errEl.innerHTML` XSS pattern** (`screen.js` `_showMicError`) — `errEl.innerHTML` interpolates `e?.message` which is browser-controlled; pre-existing before this epic. Recommend migrating to `textContent` + DOM-built structure when `_showMicError` is next touched.
- **Concurrent `_showMicError` duplicate banners** — Two rapid async mic errors can produce two `.tuner-mic-error` elements; only the first is found by subsequent cleanup paths. Pre-existing architectural limitation.

## Deferred from: code review of Epic 1 (2026-05-30)

- **Branch setup has no conflict-handling instruction** (`_bmad/custom/bmad-dev-story.toml`) — If the epic branch exists locally with diverged history (e.g. after a force-push), the `git checkout` step may silently fail or leave the agent on a stale ref. Low severity; acceptable for current solo-dev workflow.
- **PR body update is last-writer-wins** (`_bmad/custom/bmad-dev-story.toml`) — Concurrent edits to the PR body by a human or another agent will be clobbered. Low severity; acceptable for current workflow.
- **Network error leaves user on in-memory default, not saved preference** (`screen.js:42`) — When `loadConfig()` fails (FR-34 degraded mode), `visualizationMode` stays as `'default'` even for users with `'strobe'` saved. This is specified FR-34 behavior; the saved preference is loaded on the next successful open. Low impact.
- **IIFE hot-reload resets `visualizationMode` to `'default'`** (`screen.js:42`) — If the plugin IIFE is re-evaluated mid-session, line 42 resets to `'default'`. Slopsmith does not hot-reload plugins in normal operation; pre-existing limitation.
- **Non-string falsy coercion in config response** (`screen.js:124`) — A malformed server response with a non-string falsy `visualizationMode` silently falls back to `'default'`. Backend `_read()` always returns a string, making this unreachable in practice; pre-existing.
