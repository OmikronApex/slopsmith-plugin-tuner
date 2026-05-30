---
baseline_commit: 164a7347014629f2aac711392ff2e868640093a8
---

# Story 1.1: Create Architecture Document

Status: review

## Story

As a contributor or AI agent,
I want a formal architecture document produced via the BMad `bmad-create-architecture` skill,
so that system design decisions, component boundaries, and API contracts are authoritative and discoverable — enabling safe future changes without violating existing invariants.

## Acceptance Criteria

1. `_bmad-output/planning-artifacts/architecture.md` exists and covers: technology stack, component boundaries, audio pipeline data flow, visualization factory contract, API contracts, and config persistence model.
2. The document records the global namespace strategy (`_tuner` / `_TUNER_` prefix) and its rationale.
3. Open questions OQ-01 (ScriptProcessorNode migration) and the absence of an automated test suite are addressed with recommended approaches.
4. All NFRs (NFR-01 through NFR-07) are referenced as architectural constraints with traceability to the relevant system component.

## Tasks / Subtasks

- [x] Task 1: Invoke the `bmad-create-architecture` skill (AC: 1, 2, 3, 4)
  - [x] Run `/bmad-create-architecture` with the PRD (`_bmad-output/planning-artifacts/prds/prd-slopsmith-plugin-tuner-2026-05-30/prd.md`) and project-context.md as primary inputs
  - [x] Ensure the produced document covers all AC items
  - [x] Save to `_bmad-output/planning-artifacts/architecture.md`

## Dev Notes

**This story produces a planning artifact, not application code.** The "implementation" is running the BMad architecture skill and ensuring completeness of its output.

### System Components to Document

The architecture document MUST cover all of the following. Use the existing codebase as the source of truth:

| Component | File | Purpose |
|---|---|---|
| Plugin entry point | `screen.js` | IIFE, all state, audio pipeline, UI injection, viz management |
| Backend routes | `routes.py` | FastAPI setup(app, context), config CRUD, static file serving |
| YIN worker | `workers/yin.js` | Pitch detection, postMessage interface |
| Tuning utilities | `utils/tuning-utils.js` | Frequency math, note names, offsetsToFreqs, getTuningName |
| Visualization: Default | `visualization/default.js` | Needle/gauge factory |
| Visualization: Strobe | `visualization/strobe.js` | Strobe phase factory |
| Settings UI | `settings.html` | Plugin Manager settings page |
| Plugin manifest | `plugin.json` | id, name, version, script, settings.html, routes |

### Critical Architectural Invariants to Capture

- **IIFE only** — no ES modules (`import`/`export`); files are served as plain scripts
- **Global prefix** — all globals must use `_tuner` or `_TUNER_` prefix (host page runs other plugins too)
- **No main-thread audio processing** — accumulation + YIN runs in Web Worker only
- **ScriptProcessorNode** is used (not AudioWorklet) — deprecated but intentional; OQ-01 tracks migration
- **Config partial-update pattern** — POST sends only changed fields; backend merges with existing JSON
- **No `defaultTunings` in config file** — computed server-side at read time, never written
- **Path traversal guard** — `.resolve()` + `.relative_to(base_dir)` for all user-supplied filenames
- **Visualization factory contract**: `window._tunerViz_<name>(container)` → `{ update(note, cents, freq), destroy() }`
- **Audio user-gesture requirement** — AudioContext created/resumed only inside user interaction handler

### Open Questions to Address

- **OQ-01**: `ScriptProcessorNode` is deprecated. Recommended migration path to `AudioWorkletNode` should be documented (scope, risk, approach) — migration itself is out of scope for this epic.
- **Testing strategy**: No automated test suite exists. Architecture doc should recommend a path (e.g., pytest for Python routes; jsdom + script loader for JS IIFEs).

### NFR Traceability Required

| NFR | Constraint | Component |
|---|---|---|
| NFR-01 | ±2 cents accuracy | YIN worker, 4096-sample minimum |
| NFR-02 | 30ms detection loop, stale buffer discard | `detectInterval` in screen.js |
| NFR-03 | No external JS deps | Plugin manifest, no CDN/npm |
| NFR-04 | No audio on main thread | ScriptProcessorNode + Web Worker architecture |
| NFR-05 | No unhandled exceptions | Error paths in screen.js: mic, config, script load |
| NFR-06 | Viz factory contract | `window._tunerViz_<name>` pattern |
| NFR-07 | Tailwind only, no inline styles | DOM manipulation in screen.js, visualization files |

### Project Structure Notes

- Output: `_bmad-output/planning-artifacts/architecture.md` (whole file, not sharded)
- PRD location: `_bmad-output/planning-artifacts/prds/prd-slopsmith-plugin-tuner-2026-05-30/prd.md`
- project-context.md: `_bmad-output/project-context.md`

### References

- [Source: _bmad-output/planning-artifacts/prds/prd-slopsmith-plugin-tuner-2026-05-30/prd.md] — full requirements
- [Source: _bmad-output/project-context.md] — implementation rules, critical invariants
- [Source: screen.js] — primary implementation reference
- [Source: routes.py] — backend API reference

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Produced `_bmad-output/planning-artifacts/architecture.md` from full codebase audit (screen.js, routes.py, yin.js, tuning-utils.js, visualization/default.js, visualization/strobe.js, plugin.json) plus PRD and project-context.md.
- Document covers all 11 sections: technology stack, component boundaries, audio pipeline data flow (with ASCII diagram), global namespace strategy and rationale, visualization factory contract, API contracts (GET/POST config + static file serving), config persistence model (dual-layer server+localStorage), Slopsmith integration points, NFR traceability table (NFR-01 through NFR-07), OQ-01 AudioWorklet migration path, and recommended test strategy.
- All 10 architectural invariants documented in summary table.

### Change Log

- 2026-05-30: Created `_bmad-output/planning-artifacts/architecture.md` (Story 1.1)

### File List

- `_bmad-output/planning-artifacts/architecture.md` (NEW)
