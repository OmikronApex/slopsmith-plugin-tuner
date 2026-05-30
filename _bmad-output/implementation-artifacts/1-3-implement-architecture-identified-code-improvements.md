# Story 1.3: Implement Architecture-Identified Code Improvements

Status: ready-for-dev

## Story

As a contributor,
I want any code discrepancies surfaced during the architecture review (beyond the Story 1.2 bug) to be resolved or formally documented,
so that the codebase is fully aligned with the architecture document and no latent defects remain unacknowledged.

## Acceptance Criteria

1. Each discrepancy identified in the Story 1.1 architecture document is either: (a) fixed with a targeted code change, or (b) documented in the architecture document as a known trade-off with explicit rationale.
2. No new external JS or Python dependencies are introduced (NFR-03).
3. All NFRs continue to be met after any changes — verified via the critical paths in project-context.md.
4. The architecture document is updated to reflect any code changes made, keeping doc and code in sync.
5. If no discrepancies are found beyond Story 1.2, this story is marked done with an explicit note confirming no additional changes were required.

## Tasks / Subtasks

- [ ] Task 1: Load and review the Story 1.1 architecture document (AC: 1)
  - [ ] Read `_bmad-output/planning-artifacts/architecture.md`
  - [ ] Identify any discrepancies between documented design and current code
  - [ ] Exclude the screen.js default viz bug — that was fixed in Story 1.2
- [ ] Task 2: For each discrepancy found — fix or document (AC: 1, 4)
  - [ ] Apply targeted fix OR add a "Known trade-off" entry to the architecture doc
  - [ ] Do not batch unrelated changes; each fix is a separate, isolated change
- [ ] Task 3: Verify critical paths after any changes (AC: 3)
  - [ ] Mic access granted → YIN worker starts → pitch displays in active visualization
  - [ ] Config POST (partial update) → persisted to `tuner.json` → survives restart
  - [ ] Viz switch → `destroy()` called on old viz → new viz factory invoked cleanly
  - [ ] Settings page → custom tuning saved → appears in frontend dropdown
- [ ] Task 4: Update architecture document if code was changed (AC: 4)
  - [ ] Reflect any code changes made in the architecture doc
- [ ] Task 5: If no discrepancies found (AC: 5)
  - [ ] Add a completion note: "Architecture review complete — no additional code changes required beyond Story 1.2"

## Dev Notes

**This story is contingent on Story 1.1 findings.** The scope of code changes is unknown until the architecture document is complete. If no issues are found, this story closes immediately with AC-5.

### Scope Boundaries

**In scope:**
- Code discrepancies identified between the architecture doc and the actual codebase
- Documentation of known trade-offs that won't be fixed now

**Out of scope (do NOT implement):**
- ScriptProcessorNode → AudioWorklet migration (tracked as OQ-01; separate future work)
- Adding an automated test suite (architecture doc will recommend an approach; implementation is future work)
- New features or UI changes not identified by the architecture review
- Refactoring for style — only fix actual defects or contract violations

### Critical Project Rules (from project-context.md)

- **IIFE only** — no `import`/`export`; all JS files use `(function() { ... })()` pattern
- **Global prefix** — all new globals must use `_tuner` or `_TUNER_` prefix
- **No external deps** — do not introduce npm packages or CDN scripts
- **Path traversal guard** — always `.resolve()` + `.relative_to()` for Python file serving
- **Never write `defaultTunings` to config** — computed server-side, never persisted
- **Never call `activeViz.update()` after `destroy()`** — null-check `activeViz` before calling
- **Config POST accepts partial updates** — only send changed fields; backend merges

### Known Items from PRD/Project Context (Pre-Seeded for Review)

These are items flagged during PRD/epic creation that the architecture review should assess:

| Item | File | Notes |
|---|---|---|
| `ScriptProcessorNode` deprecation | screen.js:423 | OQ-01 — document migration path only, don't implement |
| No automated test suite | — | Recommend approach in architecture doc |
| `saveConfig()` only saves `lastTuning` + `visualizationMode` | screen.js:153-162 | Other settings (customTunings, disabledTunings, showFloatingButton) are saved only via settings.html — verify this is intentional and matches architecture |
| `enable()` calls `loadConfig()` on every open | screen.js:482 | Assess if this is desired or a performance concern |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md] — primary input for this story (produced by Story 1.1)
- [Source: _bmad-output/project-context.md] — implementation rules and critical invariants
- [Source: screen.js] — main implementation file
- [Source: routes.py] — Python backend

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

(populated after architecture review findings are known)
