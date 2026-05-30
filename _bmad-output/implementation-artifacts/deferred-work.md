# Deferred Work

## Deferred from: code review of Epic 2 stories 2.3 & 2.4 (2026-05-30)

- **`errEl.innerHTML` XSS pattern** (`screen.js` `_showMicError`) — `errEl.innerHTML` interpolates `e?.message` which is browser-controlled; pre-existing before this epic. Recommend migrating to `textContent` + DOM-built structure when `_showMicError` is next touched.
- **Concurrent `_showMicError` duplicate banners** — Two rapid async mic errors can produce two `.tuner-mic-error` elements; only the first is found by subsequent cleanup paths. Pre-existing architectural limitation.

## Deferred from: code review of Epic 1 (2026-05-30)

- **Branch setup has no conflict-handling instruction** (`_bmad/custom/bmad-dev-story.toml`) — If the epic branch exists locally with diverged history (e.g. after a force-push), the `git checkout` step may silently fail or leave the agent on a stale ref. Low severity; acceptable for current solo-dev workflow.
- **PR body update is last-writer-wins** (`_bmad/custom/bmad-dev-story.toml`) — Concurrent edits to the PR body by a human or another agent will be clobbered. Low severity; acceptable for current workflow.
- **Network error leaves user on in-memory default, not saved preference** (`screen.js:42`) — When `loadConfig()` fails (FR-34 degraded mode), `visualizationMode` stays as `'default'` even for users with `'strobe'` saved. This is specified FR-34 behavior; the saved preference is loaded on the next successful open. Low impact.
- **IIFE hot-reload resets `visualizationMode` to `'default'`** (`screen.js:42`) — If the plugin IIFE is re-evaluated mid-session, line 42 resets to `'default'`. Slopsmith does not hot-reload plugins in normal operation; pre-existing limitation.
- **Non-string falsy coercion in config response** (`screen.js:124`) — A malformed server response with a non-string falsy `visualizationMode` silently falls back to `'default'`. Backend `_read()` always returns a string, making this unreachable in practice; pre-existing.
