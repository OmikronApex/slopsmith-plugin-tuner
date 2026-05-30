---
stepsCompleted: ['step-01', 'step-02', 'step-03', 'step-04']
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-slopsmith-plugin-tuner-2026-05-30/prd.md
  - _bmad-output/project-context.md
---

# slopsmith-plugin-tuner - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for slopsmith-plugin-tuner, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

- **FR-01:** The plugin shall detect the fundamental frequency of live audio input in real time using the YIN pitch detection algorithm, operating on a minimum of 4,096 samples per frame at the device's native sample rate.
- **FR-02:** The plugin shall display the detected pitch as a musical note class (e.g., "E", "A#") and a cents-deviation value (positive = sharp, negative = flat). Octave information is not shown in the live display.
- **FR-03:** The plugin shall support a minimum detectable frequency of 20 Hz, covering the full range of 5-string bass guitar.
- **FR-04:** Pitch detection shall run in a dedicated Web Worker so the main UI thread is never blocked by audio processing.
- **FR-05:** The plugin shall ship with built-in tuning groups: General (Free Tune), Guitar (Standard, Drop D, Open G, DADGAD, Open E), Bass 4-string (Standard, Drop D, D-Standard, Drop C), Bass 5-string (Standard, Drop D, D-Standard, Drop C).
- **FR-06:** Each preset defines its strings as a list of target frequencies in Hz.
- **FR-07:** Individual built-in tunings shall be showable/hideable per-user via the Plugin Manager settings.
- **FR-08:** Users shall be able to define custom tuning presets by name, specifying strings as note names (e.g., E2, A2) or Hz values, via the Plugin Manager settings.
- **FR-09:** Custom tunings shall merge with built-in tunings and appear in the tuning selector.
- **FR-10:** When the Slopsmith player screen is active and the loaded song includes tuning metadata, the plugin shall offer a "Current Song" option at the top of the tuning selector. This option is omitted when no song is loaded, the song carries no tuning metadata, or the user is on a non-player screen.
- **FR-11:** The plugin shall resolve song tuning offsets to absolute frequencies via the Slopsmith highway API, correctly distinguishing guitar and bass arrangements by string count and arrangement type.
- **FR-12:** A human-readable tuning label (e.g., "Drop D", "Eb Standard") shall be derived from the offset pattern and shown alongside the "Current Song" option. Label resolution is defined for 4-string and 6-string patterns; 5-string falls back to raw offset values.
- **FR-13:** In auto mode, the plugin shall automatically highlight the string closest to the detected pitch within the active tuning.
- **FR-14:** Tapping a string button shall lock onto that string's frequency (manual mode).
- **FR-15:** Tapping the active manual target a second time shall deactivate manual mode and return to auto.
- **FR-16:** The plugin shall support a pluggable visualization system: each visualization is a self-contained JS module loaded on demand from the `visualization/` directory and registered as `window._tunerViz_<name>`. Adding a new visualization requires only dropping in the file and adding a settings option.
- **FR-17:** The plugin shall ship with two built-in visualizations — Default (needle/gauge, indicator turns green within ±2 cents) and Strobe (strobe-style phase, rotation stops when in tune). The default for new installs is "Default"; the `screen.js` initialisation to `"strobe"` is a known code bug to be corrected.
- **FR-18:** Users shall be able to switch visualizations from the settings panel; the selection shall persist across sessions.
- **FR-19:** Users shall be able to select any available system audio input device from the settings panel.
- **FR-20:** Users shall be able to select the input channel — Mono (both channels mixed), Left (channel 1), or Right (channel 2) — to accommodate stereo interfaces and mono-only devices such as the Real Tone Cable.
- **FR-21:** Audio device and channel preferences shall persist across sessions via `localStorage`.
- **FR-22:** If a saved device is no longer available, rejects `channelCount: 2`, or is otherwise unconstrained, the plugin shall fall back to the default device without surfacing an unhandled error and shall clear the stale saved device ID.
- **FR-23:** Microphone access failures shall surface as an inline error banner within the tuner panel — not as a browser `alert()`.
- **FR-24:** The error banner shall include a human-readable message and an actionable recovery hint tailored to the error type (`NotAllowedError`, `NotFoundError`, `NotReadableError`/`AbortError`).
- **FR-25:** The error banner shall clear automatically when the tuner opens successfully after a device switch.
- **FR-26:** The error banner shall not persist after the user navigates to a different Slopsmith screen.
- **FR-27:** The plugin shall inject a floating "Tuner" button at the bottom-right of the Slopsmith interface that toggles the tuner panel.
- **FR-28:** The floating button shall be hidden during active song playback and when the player screen is active. The floating button and player controls button are mutually exclusive.
- **FR-29:** The plugin shall inject a "Tuner" button into the Slopsmith player controls bar when the player screen is active.
- **FR-30:** The floating button shall be togglable via a Plugin Manager setting (show/hide globally).
- **FR-31:** The tuner panel shall close automatically when the user navigates to a different Slopsmith screen.
- **FR-32:** Plugin settings (last tuning, visualization mode, custom tunings, disabled tunings, floating button visibility) shall be persisted server-side via the Slopsmith plugin config API as a JSON file. The "Current Song" selection is ephemeral and shall not be written to `lastTuning`.
- **FR-33:** The plugin shall expose a config REST API (`GET /api/plugins/tuner/config`, `POST /api/plugins/tuner/config`) that supports partial updates.
- **FR-34:** If the config fetch at startup fails, the plugin shall continue operating with in-memory defaults (Guitar Standard tuning, Strobe visualization, floating button visible). The failure shall be logged to the console; no user-facing error is shown.

### Non-Functional Requirements

- **NFR-01:** Pitch accuracy — The YIN algorithm shall resolve pitch with sufficient precision to display cents deviation within ±2 cents under normal single-string input at standard sample rates (44,100 or 48,000 Hz).
- **NFR-02:** Latency — The detection loop shall fire every 30 ms. Stale pending buffers are discarded each cycle to prevent backlog under sustained load.
- **NFR-03:** Self-containment — The plugin shall introduce no external JavaScript library dependencies. All runtime dependencies must be either implemented within the plugin or already provided by Slopsmith.
- **NFR-04:** Thread isolation — No audio processing logic (sample accumulation, YIN computation, buffer management) may execute on the main browser thread.
- **NFR-05:** Stability — The plugin shall not throw unhandled exceptions during normal operation. All error paths (mic access, config fetch, script load) shall be caught and either surfaced via the error banner or logged to the console.
- **NFR-06:** Visualization module contract — Each visualization module must expose a factory function registered as `window._tunerViz_<name>(container)` returning an object with `update(note, cents, freq)` and `destroy()` methods.
- **NFR-07:** Themability — The plugin UI shall use Tailwind CSS utility classes consistent with the active Slopsmith theme. No hardcoded color values outside Tailwind/theme tokens.

### Additional Requirements

- **No Architecture document exists** for this project yet. The purpose of this epic is to create one following the BMad workflow (`bmad-create-architecture` skill), documenting the existing system's design decisions, component boundaries, data flow, and API contracts.
- **Known code bug (FR-17/OQ-02 resolved 2026-05-30):** `screen.js` incorrectly initialises the visualization to `"strobe"` instead of `"default"`. This is the canonical default for new installs and must be corrected.
- **Architecture review may surface additional code issues** beyond the known bug; any such findings should be addressed as stories within this epic.
- **No automated test suite exists** — the architecture document should include a testing strategy recommendation.
- Plugin uses `ScriptProcessorNode` (deprecated Web Audio API) — architecture document should note this and recommend a migration path (open question OQ-01).

### UX Design Requirements

N/A — No UX Design document exists for this project. The plugin has an established UI; UX documentation is out of scope for this epic.

### FR Coverage Map

- **FR-01:** Epic 1 (Story 1.1) — YIN pitch detection documented in architecture; already implemented
- **FR-02:** Epic 1 (Story 1.1) — Note class + cents display documented; already implemented
- **FR-03:** Epic 1 (Story 1.1) — 20 Hz minimum frequency documented; already implemented
- **FR-04:** Epic 1 (Story 1.1) — Web Worker isolation documented; already implemented
- **FR-05:** Epic 1 (Story 1.1) — Built-in tuning groups documented; already implemented
- **FR-06:** Epic 1 (Story 1.1) — Preset frequency-list format documented; already implemented
- **FR-07:** Epic 1 (Story 1.1) — Per-user tuning visibility documented; already implemented
- **FR-08:** Epic 1 (Story 1.1) — Custom tuning definition documented; already implemented
- **FR-09:** Epic 1 (Story 1.1) — Custom tuning merge documented; already implemented
- **FR-10:** Epic 1 (Story 1.1) — Current Song option documented; already implemented
- **FR-11:** Epic 1 (Story 1.1) — Slopsmith highway API integration documented; already implemented
- **FR-12:** Epic 1 (Story 1.1) — Human-readable tuning label resolution documented; already implemented
- **FR-13:** Epic 1 (Story 1.1) — Auto string highlighting documented; already implemented
- **FR-14:** Epic 1 (Story 1.1) — Manual string lock documented; already implemented
- **FR-15:** Epic 1 (Story 1.1) — Manual mode deactivation documented; already implemented
- **FR-16:** Epic 1 (Story 1.1) — Pluggable visualization factory contract documented; already implemented
- **FR-17:** Epic 1 (Story 1.1 + Story 1.2) — Viz system documented; `screen.js` `"strobe"` default bug fixed in Story 1.2
- **FR-18:** Epic 1 (Story 1.1) — Viz persistence documented; already implemented
- **FR-19:** Epic 1 (Story 1.1) — Audio device selection documented; already implemented
- **FR-20:** Epic 1 (Story 1.1) — Channel selection (Mono/Left/Right) documented; already implemented
- **FR-21:** Epic 1 (Story 1.1) — localStorage persistence documented; already implemented
- **FR-22:** Epic 1 (Story 1.1) — Stale device fallback documented; already implemented
- **FR-23:** Epic 1 (Story 1.1) — Inline error banner documented; already implemented
- **FR-24:** Epic 1 (Story 1.1) — Error message/hint table documented; already implemented
- **FR-25:** Epic 1 (Story 1.1) — Auto-clear error banner documented; already implemented
- **FR-26:** Epic 1 (Story 1.1) — Error banner navigation clear documented; already implemented
- **FR-27:** Epic 1 (Story 1.1) — Floating button injection documented; already implemented
- **FR-28:** Epic 1 (Story 1.1) — Floating button hide-during-playback documented; already implemented
- **FR-29:** Epic 1 (Story 1.1) — Player controls bar button documented; already implemented
- **FR-30:** Epic 1 (Story 1.1) — Floating button toggle setting documented; already implemented
- **FR-31:** Epic 1 (Story 1.1) — Panel auto-close on navigation documented; already implemented
- **FR-32:** Epic 1 (Story 1.1) — Server-side config persistence documented; already implemented
- **FR-33:** Epic 1 (Story 1.1) — Config REST API documented; already implemented
- **FR-34:** Epic 1 (Story 1.1) — Config-fetch failure fallback documented; already implemented

## Epic List

### Epic 1: Architecture Documentation & Code Alignment

Establish a formal architecture document for the slopsmith-plugin-tuner using the BMad workflow, providing AI agents and contributors with authoritative system design guidance; then implement code corrections surfaced during the architectural review.

**FRs covered:** FR-01 through FR-34 (all — documented by Story 1.1); FR-17 bug-fixed by Story 1.2

---

### Story 1.1: Create Architecture Document

As a contributor or AI agent,
I want a formal architecture document produced via the BMad `bmad-create-architecture` skill,
So that system design decisions, component boundaries, and API contracts are authoritative and discoverable — enabling safe future changes without violating existing invariants.

**Acceptance Criteria:**

- **Given** the `bmad-create-architecture` skill is invoked on this project with the PRD and project-context.md as inputs
- **When** the architecture document is complete and saved
- **Then** `_bmad-output/planning-artifacts/architecture.md` exists and covers all of: technology stack (Vanilla JS IIFE, Python/FastAPI, Web Audio API, Tailwind CSS), component boundaries (screen.js, routes.py, yin-worker.js, visualization/*.js, settings.html), audio pipeline data flow (getUserMedia → ScriptProcessorNode → accumBuffer → Web Worker → YIN → postMessage → main thread), visualization factory contract (`window._tunerViz_<name>(container)` returning `{ update, destroy }`), API contracts (GET/POST `/api/plugins/tuner/config`, Slopsmith plugin `context` dict interface), and config persistence model (server-side `tuner.json` + client-side `localStorage`)
  - **And** the document records the global namespace strategy (`_tuner` / `_TUNER_` prefix convention) and the rationale behind it
  - **And** open questions OQ-01 (ScriptProcessorNode migration path) and the absence of an automated test suite are addressed with recommended approaches documented
  - **And** all NFRs (NFR-01 through NFR-07) are referenced as architectural constraints with traceability to the relevant system component

### Story 1.2: Fix Default Visualization Initialisation

As a new Slopsmith user installing the tuner plugin,
I want the tuner panel to open with the Default (needle/gauge) visualization on first use,
So that my initial experience matches the intended design and is consistent with the server-side config default.

**Acceptance Criteria:**

- **Given** `screen.js` is the plugin entry point and no visualization preference has been saved server-side
- **When** the tuner panel is opened for the first time
- **Then** the active visualization is `"default"` (needle/gauge), not `"strobe"`
  - **And** the hardcoded initialisation string in `screen.js` reads `"default"` — correcting the bug identified in FR-17 and OQ-02

- **Given** a user already has a saved visualization preference in the server-side config (`tuner.json`)
- **When** the tuner panel initialises
- **Then** the saved preference is loaded and used, overriding the hardcoded fallback — no regression in existing behaviour

- **Given** the fix is applied
- **When** the critical paths from project-context.md are manually verified (mic access → YIN → pitch display; viz switch → destroy/init cycle)
- **Then** all critical paths pass without errors or regressions

### Story 1.3: Implement Architecture-Identified Code Improvements

As a contributor,
I want any code discrepancies surfaced during the architecture review (beyond the Story 1.2 bug) to be resolved or formally documented,
So that the codebase is fully aligned with the architecture document and no latent defects remain unacknowledged.

**Acceptance Criteria:**

- **Given** the architecture document from Story 1.1 is complete and identifies discrepancies between documented design and actual code
- **When** each discrepancy is assessed
- **Then** each item is either: (a) fixed with a targeted code change, or (b) documented in the architecture document as a known trade-off with explicit rationale — no discrepancy is silently ignored

- **Given** any code changes are made
- **When** changes are applied
- **Then** no new external JS or Python dependencies are introduced (NFR-03 maintained)
  - **And** all existing NFRs continue to be met — verified by manually running the critical paths from project-context.md (mic access → pitch display; config POST → persisted → survives restart; viz switch → clean destroy/init; settings → custom tuning saved → appears in dropdown)
  - **And** the architecture document is updated to reflect any code changes made, keeping doc and code in sync

- **Given** no discrepancies are found beyond Story 1.2
- **When** the architecture review is complete
- **Then** this story is marked done with a note confirming no additional changes were required
