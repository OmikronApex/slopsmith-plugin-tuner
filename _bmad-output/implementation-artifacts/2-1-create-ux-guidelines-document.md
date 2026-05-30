---
baseline_commit: eb5b8f0b7789ed62b4afcae8355802694f3ad0fa
---

# Story 2.1: Create UX Guidelines Document

Status: review

## Story

As a contributor or AI agent,
I want formal UX guidelines produced via the BMad `bmad-ux` skill,
So that UI/UX improvements are grounded in documented design decisions and future contributors have a consistent visual and interaction reference.

## Acceptance Criteria

1. `_bmad-output/planning-artifacts/ux-guidelines.md` exists and covers the tuner panel as its primary focus: note display, cents indicator (Default gauge and Strobe), string buttons, tuning selector, settings panel layout and affordances, and error banner presentation.
2. The settings page (Plugin Manager) and button injection (floating button, player controls bar button) are covered at a summary level — key UX concerns identified.
3. Each UI area includes specific, actionable improvement opportunities with enough detail to generate a story with testable acceptance criteria.
4. All recommendations respect the architectural constraints: Tailwind-only (NFR-07), IIFE pattern, no external JS libs (NFR-03), no inline `style=""` attributes.
5. The document is usable as the primary spec input for Stories 2.2+.

## Tasks / Subtasks

- [x] Task 1: Invoke the `bmad-ux` skill (AC: 1, 2, 3, 4, 5)
  - [x] Run `/bmad-ux` with PRD, architecture document, project-context.md, and the existing UI source files as primary inputs
  - [x] Ensure primary focus is on the tuner panel UI (note display, cents indicator, string buttons, tuning selector, settings panel, error banner)
  - [x] Ensure secondary coverage of settings page and button injection
  - [x] Verify each UI area has specific, actionable improvement opportunities
  - [x] Verify all recommendations respect Tailwind-only and IIFE constraints
  - [x] Save to `_bmad-output/planning-artifacts/ux-guidelines.md`

## Dev Notes

**This story produces a planning artifact, not application code.** The "implementation" is running the BMad UX skill and ensuring completeness of its output.

### Primary Inputs for the UX Skill

| Document | Path | Purpose |
|---|---|---|
| PRD | `_bmad-output/planning-artifacts/prds/prd-slopsmith-plugin-tuner-2026-05-30/prd.md` | FR-02, FR-07, FR-09–10, FR-12–20, FR-23–31 UX requirements |
| Architecture | `_bmad-output/planning-artifacts/architecture.md` | NFR-07 constraint, component boundaries, viz factory contract |
| Project Context | `_bmad-output/project-context.md` | Critical rules: Tailwind-only, IIFE, no inline styles |
| Plugin entry point | `screen.js` | All DOM construction, CSS classes, UI state management |
| Viz: Default | `visualization/default.js` | Needle/gauge DOM and CSS classes |
| Viz: Strobe | `visualization/strobe.js` | LCD segment display, strobe animation DOM |
| Settings page | `settings.html` | Plugin Manager settings UI |

### UI Areas to Cover (Primary — Tuner Panel)

1. **Note display** — `text-5xl font-black` note name, freq readout; colour change to `text-green-400` within ±2 cents (Default viz)
2. **Cents indicator — Default viz** — needle/gauge bar with center marker and needle; cents text below
3. **Cents indicator — Strobe viz** — LCD segment display, strobe stripe animation, sharp symbol
4. **String buttons** — flex row of string note buttons; active/manual/auto highlight states
5. **Tuning selector** — full-width `<select>`; Current Song option at top when on player screen
6. **Settings panel** — inline collapsible; mic selector, channel selector, viz selector
7. **Error banner** — `bg-red-900/40 border-red-700/60` inline banner; strong + hint text

### UI Areas to Cover (Secondary)

8. **Settings page** (`settings.html`) — Plugin Manager frame; custom tuning input, disabled tunings management
9. **Floating button** — `fixed bottom-5 right-5`; active/inactive states; hidden during playback
10. **Player controls bar button** — injected into `#player-controls`; active/inactive states

### Architectural Constraints to Carry Through

- **Tailwind-only** — all styling via `element.className`; no `style=""` except viz animation offsets (`strobeEl.style.backgroundPosition`, `gaugeNeedle.style.left`) which are functional/dynamic and exempt
- **IIFE-only** — no ES modules; no new globals without `_tuner`/`_TUNER_` prefix
- **No external JS deps** — no new npm/CDN references
- **Viz factory contract** — `window._tunerViz_<name>(container)` → `{ update, destroy }`; any new viz must comply

### References

- [Source: _bmad-output/planning-artifacts/prds/prd-slopsmith-plugin-tuner-2026-05-30/prd.md] — UX-relevant FRs
- [Source: _bmad-output/planning-artifacts/architecture.md] — NFR-07, architectural invariants
- [Source: _bmad-output/project-context.md] — implementation rules
- [Source: screen.js] — all panel DOM construction
- [Source: visualization/default.js] — Default viz DOM
- [Source: visualization/strobe.js] — Strobe viz DOM
- [Source: settings.html] — settings page

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Produced `_bmad-output/planning-artifacts/ux-guidelines.md` from full audit of screen.js, default.js, strobe.js, settings.html against PRD and architecture.
- Key findings: ±5 cents in-tune threshold in both vizualisations contradicts FR-17 (should be ±2) — High priority. NFR-07 violated in settings.html with inline style assignments — High priority. 5 Medium-priority UX improvements across settings panel, error banner, string buttons, gauge, and strobe. Low-priority polish items batched for a single story.
- §5 of the guidelines provides a 5-story breakdown (Stories 2.2–2.6) ready for `bmad-create-story`.

### Change Log

- 2026-05-30: Created `_bmad-output/planning-artifacts/ux-guidelines.md` (Story 2.1)

### File List

- `_bmad-output/planning-artifacts/ux-guidelines.md` (NEW)
