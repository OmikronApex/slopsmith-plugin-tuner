---
stepsCompleted: ['step-01', 'step-02', 'step-03', 'step-04', 'epic2-step-01', 'epic2-step-02', 'epic2-step-03', 'epic3-step-01', 'epic3-step-02', 'epic3-step-03', 'epic4-step-01', 'epic4-step-02', 'epic4-step-03', 'epic5-step-01', 'epic5-step-02', 'epic6-step-01', 'epic6-step-02', 'epic7-step-01', 'epic7-step-02', 'epic8-step-01']
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

No UX Design document exists yet. Story 2.1 will produce `_bmad-output/planning-artifacts/ux-guidelines.md` via the `bmad-ux` skill. The following UI/UX-relevant functional requirements are in scope for Epic 2:

- **UX-DR1:** Tuner panel layout and visual hierarchy — note display, cents gauge/strobe, string buttons, tuning selector, settings panel (FR-02, FR-13–15, FR-17, FR-18)
- **UX-DR2:** Error banner presentation — inline, non-blocking, human-readable messages with recovery hints; auto-clear and navigation-clear behaviour (FR-23–26)
- **UX-DR3:** Settings panel UX — audio device selector, channel selector, viz selector; discoverability and affordance (FR-19, FR-20, FR-18)
- **UX-DR4:** Tuning selector — show/hide built-in tunings, custom tunings, Current Song option; selector ergonomics (FR-07, FR-09, FR-10, FR-12)
- **UX-DR5:** Button injection — floating Tuner button (bottom-right), player controls bar button; mutual exclusivity, visibility rules, toggle behaviour (FR-27–31)
- **UX-DR6:** Settings page (Plugin Manager) — layout, custom tuning input, disabled tunings management (FR-07, FR-08)
- **UX-DR7:** Tailwind-only constraint — all styling via utility classes; no hardcoded colours, no inline `style=""` (NFR-07)

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

**Epic 2 UX coverage (UX-DR1–7; implementation stories created post Story 2.1):**

- **FR-02:** Epic 2 — Note/cents display visual design and hierarchy (tuner panel)
- **FR-07:** Epic 2 — Show/hide tunings settings UX
- **FR-09:** Epic 2 — Custom tunings UX in settings page
- **FR-10:** Epic 2 — Current Song option presentation in tuning selector
- **FR-12:** Epic 2 — Tuning label display alongside Current Song option
- **FR-13:** Epic 2 — Auto-highlight string button visual feedback
- **FR-14:** Epic 2 — Manual string lock affordance and visual state
- **FR-15:** Epic 2 — Manual mode deactivation UX
- **FR-16:** Epic 2 — Viz selector affordance in settings panel
- **FR-17:** Epic 2 — Default/Strobe viz visual polish (post-fix baseline)
- **FR-18:** Epic 2 — Viz switch UX in settings panel
- **FR-19:** Epic 2 — Audio device selector UX
- **FR-20:** Epic 2 — Input channel selector UX
- **FR-23:** Epic 2 — Error banner placement and visual design
- **FR-24:** Epic 2 — Error message and recovery hint UX
- **FR-25:** Epic 2 — Auto-clear banner UX behaviour
- **FR-26:** Epic 2 — Navigation-triggered banner clear UX
- **FR-27:** Epic 2 — Floating Tuner button visual design and placement
- **FR-28:** Epic 2 — Floating button visibility/hide UX during playback
- **FR-29:** Epic 2 — Player controls bar button UX
- **FR-30:** Epic 2 — Button toggle setting UX in Plugin Manager
- **FR-31:** Epic 2 — Panel auto-close on navigation UX
- **FR-AG-01:** Epic 3 — Panel layout: frequency drum behind needle (upper area), note name drum below needle, lightbulb adjacent to note name drum
- **FR-AG-02:** Epic 3 — Each cutout window shows exactly 2 labels height; in-between states clearly legible
- **FR-AG-03:** Epic 3 — Dynamic label sets; drums rotate proportionally to cents deviation (0 = centred, ±50 = halfway between labels)
- **FR-AG-04:** Epic 3 — Semicircular needle gauge on panel face; needle indicates current cents deviation (−50 to +50) with graduation marks and range labels
- **FR-AG-05:** Epic 3 — Physical-looking lightbulb element on panel face glows red/orange when within ±2 cents; appears dark/unlit outside that range
- **FR-AG-06:** Epic 3 — When `note === null`, drums show neutral idle state and needle rests at centre
- **FR-AG-07:** Epic 3 — Visualization registered as `window._tunerViz_analogueGauge(container)` returning `{ update(note, cents, freq), destroy() }`
- **FR-AG-08:** Epic 3 — "Analogue Gauge" option added to viz selector in `settings.html`
- **FR-AG-09:** Epic 3 — In targeted mode, drums locked to target note (±50 cent range only); never scroll to adjacent note

### New Functional Requirements (Epic 3 — Analogue Gauge Visualization)

- **FR-AG-01:** Panel layout: frequency drum is positioned behind the needle (upper panel area, from half the needle length up from its pivot to the top); note name drum is positioned below the needle; lightbulb is adjacent to the note name drum.
- **FR-AG-02:** Each cutout window shows the height of exactly 2 labels, so in-between states (drum between two notes) are clearly legible.
- **FR-AG-03:** Label sets are generated dynamically (not a fixed count). Drums rotate proportionally to cents deviation — 0 cents = target label centred in window; ±50 cents = display is exactly halfway between two adjacent labels.
- **FR-AG-04:** A semicircular needle gauge shall be rendered on the panel face with a needle indicating the current cents deviation (−50 to +50). The face shall show graduation marks and range labels.
- **FR-AG-05:** When cents deviation is within ±2 cents, a small lightbulb element rendered on the panel face shall glow red/orange — styled to appear as a physical bulb (rounded dome with warm glow effect via CSS box-shadow/border-radius) viewed from the front. Outside ±2 cents, the bulb appears dark/unlit.
- **FR-AG-06:** When `note === null` (no signal), drums display a neutral idle state and needle rests at centre (0).
- **FR-AG-07:** The visualization conforms to the factory contract: `window._tunerViz_analogueGauge(container)` returning `{ update(note, cents, freq), destroy() }`.
- **FR-AG-08:** A "Analogue Gauge" option shall be added to the viz selector in `settings.html` (covers FR-18).
- **FR-AG-09:** When a specific string/note is targeted, the drums are locked to the target note — rotating only within the ±50 cent range around it, never scrolling to an adjacent note. The target note and its frequency remain visible in the cutout windows at all times, communicating deviation from the target rather than proximity to the nearest note.

### Applicable NFRs (Epic 3)

- **NFR-03** — no external JS libs
- **NFR-06** — viz factory contract
- **NFR-07** — Tailwind-only styling; no inline `style=""`, no hardcoded colours

### Additional Requirements (Epic 3)

- IIFE pattern; exposed as `window._tunerViz_analogueGauge`
- Constants prefixed `_TUNER_`
- DOM via `document.createElement` / `classList` / `textContent` only
- `destroy()` must clean up all DOM nodes and animation timers

## Epic List

### Epic 1: Architecture Documentation & Code Alignment
### Epic 2: UI/UX Audit & Improvements
### Epic 3: Analogue Gauge Visualization
### Epic 4: Axe-Fx III Visualization
### Epic 5: Toilet Tuner Visualization
### Epic 6: PP-Tiny Visualization
### Epic 7: Infrastructure — Asset Endpoint Isolation & JUCE Audio Bridge
### Epic 8: Real-Instrument Audio Test Suite

Establish a formal architecture document for the slopsmith-plugin-tuner using the BMad workflow, providing AI agents and contributors with authoritative system design guidance; then implement code corrections surfaced during the architectural review.

**FRs covered:** FR-01 through FR-34 (all — documented by Story 1.1); FR-17 bug-fixed by Story 1.2

---

### Story 1.1: Create Architecture Document

As a contributor or AI agent,
I want a formal architecture document produced via the BMad `bmad-create-architecture` skill,
So that system design decisions, component boundaries, and API contracts are authoritative and discoverable — enabling safe future changes without violating existing invariants.

**Acceptance Criteria:**

**Given** the bmad-create-architecture skill is invoked on this project with the PRD and project-context.md as inputs
**When** the architecture document is complete and saved
**Then** `_bmad-output/planning-artifacts/architecture.md` exists and covers all of: technology stack (Vanilla JS IIFE, Python/FastAPI, Web Audio API, Tailwind CSS), component boundaries (screen.js, routes.py, yin-worker.js, visualization/*.js, settings.html), audio pipeline data flow (getUserMedia → ScriptProcessorNode → accumBuffer → Web Worker → YIN → postMessage → main thread), visualization factory contract (`window._tunerViz_<name>(container)` returning `{ update, destroy }`), API contracts (GET/POST `/api/plugins/tuner/config`, Slopsmith plugin `context` dict interface), and config persistence model (server-side `tuner.json` + client-side `localStorage`)
**And** the document records the global namespace strategy (`_tuner` / `_TUNER_` prefix convention) and the rationale behind it
**And** open questions OQ-01 (ScriptProcessorNode migration path) and the absence of an automated test suite are addressed with recommended approaches documented
**And** all NFRs (NFR-01 through NFR-07) are referenced as architectural constraints with traceability to the relevant system component

### Story 1.2: Fix Default Visualization Initialisation

As a new Slopsmith user installing the tuner plugin,
I want the tuner panel to open with the Default (needle/gauge) visualization on first use,
So that my initial experience matches the intended design and is consistent with the server-side config default.

**Acceptance Criteria:**

**Given** `screen.js` is the plugin entry point and no visualization preference has been saved server-side
**When** the tuner panel is opened for the first time
**Then** the active visualization is `"default"` (needle/gauge), not `"strobe"`
**And** the hardcoded initialisation string in `screen.js` reads `"default"` — correcting the bug identified in FR-17 and OQ-02

**Given** a user already has a saved visualization preference in the server-side config (`tuner.json`)
**When** the tuner panel initialises
**Then** the saved preference is loaded and used, overriding the hardcoded fallback — no regression in existing behaviour

**Given** the fix is applied
**When** the critical paths from project-context.md are manually verified (mic access → YIN → pitch display; viz switch → destroy/init cycle)
**Then** all critical paths pass without errors or regressions

### Story 1.3: Implement Architecture-Identified Code Improvements

As a contributor,
I want any code discrepancies surfaced during the architecture review (beyond the Story 1.2 bug) to be resolved or formally documented,
So that the codebase is fully aligned with the architecture document and no latent defects remain unacknowledged.

**Acceptance Criteria:**

**Given** the architecture document from Story 1.1 is complete and identifies discrepancies between documented design and actual code
**When** each discrepancy is assessed
**Then** each item is either: (a) fixed with a targeted code change, or (b) documented in the architecture document as a known trade-off with explicit rationale — no discrepancy is silently ignored

**Given** any code changes are made
**When** changes are applied
**Then** no new external JS or Python dependencies are introduced (NFR-03 maintained)
**And** all existing NFRs continue to be met — verified by manually running the critical paths from project-context.md (mic access → pitch display; config POST → persisted → survives restart; viz switch → clean destroy/init; settings → custom tuning saved → appears in dropdown)
**And** the architecture document is updated to reflect any code changes made, keeping doc and code in sync

**Given** no discrepancies are found beyond Story 1.2
**When** the architecture review is complete
**Then** this story is marked done with a note confirming no additional changes were required

---

## Epic 2: UI/UX Audit & Improvements

Produce formal UX guidelines for the slopsmith-plugin-tuner plugin UI via the BMad `bmad-ux` skill, then implement the improvements identified — focusing primarily on the tuner panel, with secondary coverage of the settings page and button injection into the Slopsmith host page.

**UX-DRs covered:** UX-DR1 through UX-DR7
**FRs in scope:** FR-02, FR-07, FR-09, FR-10, FR-12–20, FR-23–31
**NFR in scope:** NFR-07

---

### Story 2.1: Create UX Guidelines Document

As a contributor or AI agent,
I want formal UX guidelines produced via the BMad `bmad-ux` skill,
So that UI/UX improvements are grounded in documented design decisions and future contributors have a consistent visual and interaction reference.

**Acceptance Criteria:**

**Given** the `bmad-ux` skill is invoked with the PRD, architecture document, and project-context.md as primary inputs
**When** the UX guidelines document is complete and saved to `_bmad-output/planning-artifacts/ux-guidelines.md`
**Then** the document covers the tuner panel as its primary focus: note display, cents indicator (Default gauge and Strobe), string buttons, tuning selector, settings panel layout and affordances, and error banner presentation
**And** the settings page (Plugin Manager) and button injection (floating button, player controls bar button) are covered at a summary level — key UX concerns identified but not fully spec'd
**And** each UI area includes specific, actionable improvement opportunities with enough detail to generate a story with testable acceptance criteria
**And** all recommendations respect the architectural constraints: Tailwind-only (NFR-07), IIFE pattern, no external JS libs (NFR-03), no inline `style=""` attributes

**Given** the UX guidelines are complete
**When** implementation stories (2.2+) are created via `bmad-create-story`
**Then** each story references the relevant section of `ux-guidelines.md` as its primary spec input

> **Note:** Stories 2.2+ are intentionally not pre-defined here. They will be created via `bmad-create-story` after Story 2.1 delivers the guidelines.

---

## Epic 3: Analogue Gauge Visualization

Deliver a new built-in visualization styled as a vintage mechanical instrument panel. Rotating drums show the target note name and frequency through slot windows; a needle gauge shows cents deviation; a physical-style lightbulb glows red/orange when in tune. Selectable via the settings panel.

**FRs covered:** FR-AG-01 through FR-AG-09, FR-18
**NFRs:** NFR-03, NFR-06, NFR-07

---

### Story 3.1: Scaffold, Static Layout & Settings Wiring

As a developer implementing the analogue gauge visualization,
I want a fully structured static panel with all DOM elements in place and the visualization registered in settings,
So that subsequent stories can layer animation onto a stable, correctly-laid-out foundation.

**Acceptance Criteria:**

**Given** the file `visualization/analogue-gauge.js` is created
**When** the IIFE executes
**Then** `window._tunerViz_analogueGauge` is a factory function that accepts a `container` DOM element and returns `{ update(note, cents, freq), destroy() }`

**Given** the factory is called with a container
**When** the static DOM is rendered
**Then** the panel face contains:
- A frequency drum slot in the upper panel area (positioned to overlap the upper half of the needle, from the needle's pivot midpoint to the top of the panel)
- A note name drum slot below the needle area
- A lightbulb element adjacent to the note name drum slot (dark/unlit state)
- A semicircular gauge arc with a static needle centred at 0 (pointing to the arc midpoint)
- Graduation marks on the arc face at −50, −25, 0, +25, +50 cents
- Two cutout window overlays, each sized to reveal exactly 2 label heights of their respective drum

**Given** the DOM is rendered
**When** inspected
**Then** all styling uses Tailwind utility classes only — no inline `style=""` attributes and no hardcoded colour values

**Given** the `destroy()` method is called
**When** executed
**Then** all DOM nodes appended to the container are removed; no timers or RAF loops exist to cancel at this stage

**Given** `settings.html` is updated
**When** the viz selector is rendered
**Then** an "Analogue Gauge" option with value `"analogue-gauge"` is present in the visualization select element

---

### Story 3.2: Rotating Drum Mechanics

As a guitar player using the analogue gauge visualization,
I want the frequency and note name drums to rotate in response to my detected pitch,
So that I can read which note I'm closest to and how far off I am by seeing the drum position through the cutout window.

**Acceptance Criteria:**

**Given** the visualization receives `update(note, cents, freq)` with a non-null `note`
**When** rendered at `cents` = 0
**Then** the note name drum is positioned so the current `note` label is centred in the cutout window; the frequency drum is positioned so the current `freq` label (nearest Hz value for that note) is centred in its window

**Given** `cents` is +50
**When** the drums are positioned
**Then** both cutout windows show the display exactly halfway between the current note/freq label and the next label above — neither label is centred

**Given** `cents` is −50
**When** the drums are positioned
**Then** both cutout windows show the display exactly halfway between the current note/freq label and the next label below

**Given** `cents` is any value between −50 and +50
**When** the drums are positioned
**Then** the drum offset is proportional to the cent value — linear mapping from −50 (half-label below centre) to +50 (half-label above centre); animation is smooth via `requestAnimationFrame`

**Given** `note` changes between `update()` calls
**When** the drums update
**Then** the drums snap to the new note/freq labels and apply the current `cents` offset; targeted-note locking behaviour is handled by `screen.js` — the visualization tracks whatever `note` and `freq` values are passed in

**Given** the label strip is generated dynamically
**When** rendered
**Then** the note drum contains note names spanning a sufficient chromatic range (minimum 3 octaves, e.g., C2–C5); the frequency drum contains the corresponding Hz values for each semitone; both strips are long enough that the cutout window never shows an empty region during normal use

**Given** the animation RAF loop is running
**When** `destroy()` is called
**Then** `cancelAnimationFrame()` is called with the active RAF ID before any DOM cleanup; no orphaned animation frames remain after destroy

---

### Story 3.3: Needle, Lightbulb & No-Signal State

As a guitar player using the analogue gauge visualization,
I want the needle to show my exact cent deviation, the lightbulb to confirm when I'm in tune, and a clear idle state when no signal is detected,
So that I can tune confidently and know at a glance whether I've hit the target.

**Acceptance Criteria:**

**Given** `update(note, cents, freq)` is called with a non-null `note`
**When** `cents` is 0
**Then** the needle points to the centre of the semicircular arc (the 0 graduation mark)

**Given** `cents` is +50
**When** rendered
**Then** the needle points to the rightmost extent of the arc

**Given** `cents` is −50
**When** rendered
**Then** the needle points to the leftmost extent of the arc

**Given** `cents` is any value between −50 and +50
**When** rendered
**Then** the needle angle is linearly proportional to the cent value across the full arc sweep; animation is smooth via RAF-driven interpolation, not an instant snap

**Given** `cents` is within ±2
**When** rendered
**Then** the lightbulb element is in its lit state: red/orange colour with warm glow effect applied via Tailwind/CSS classes (box-shadow simulating a dome radiating light)

**Given** `cents` is outside ±2
**When** rendered
**Then** the lightbulb element is in its unlit state: dark/dim appearance, no glow classes applied

**Given** `update(null, 0, 0)` is called (no pitch signal)
**When** rendered
**Then** the drums freeze in their current position (animation paused); the needle eases to the 0 centre position; the lightbulb is unlit

**Given** the viz has never received a non-null `note` and `note === null`
**When** rendered
**Then** both drum windows show a neutral idle state (centred between two labels or showing a dash); needle at 0; lightbulb unlit

**Given** needle RAF animation is running
**When** `destroy()` is called
**Then** all active RAF IDs (drum RAF from Story 3.2, needle RAF) are cancelled via `cancelAnimationFrame()`; all DOM nodes removed from container; no globals or timers leaked

---

### New Functional Requirements (Epic 4 — Axe-Fx III Visualization)

- **FR-AFX-01:** The display shall use a dark navy-blue background with a pixelated/bitmap-font aesthetic throughout, emulating a physical LCD/LED screen (no rounded UI chrome).
- **FR-AFX-02:** A horizontal chromatic gauge shall span the full width of the upper display area — a series of short vertical green/teal tick marks with a bright white position marker that moves left/right to indicate cents deviation from the target note (−50 = far left, 0 = centre, +50 = far right).
- **FR-AFX-03:** Two inward-pointing triangular arrows (`▶ ◀`) shall be rendered beneath the chromatic gauge in the centre of the display. Both point toward the middle. When the pitch is flat, the right-facing teal `▶` is dimmed and the left-facing white `◀` is bright, indicating the pitch must come up; when sharp, the reverse. When in tune (±2 cents), both arrows are equally bright and meet at the centre.
- **FR-AFX-04:** The detected note name (e.g., "Bb", "E") shall be displayed in large pixelated text in the lower-left of the display.
- **FR-AFX-05:** The octave number (e.g., "6", "4") shall be derived from the `freq` parameter using A4 = 440 Hz as the reference and displayed in large pixelated text in the lower-right of the display.
- **FR-AFX-06:** A strobe semicircle shall be rendered at the bottom centre — an arc of pink/magenta diamond-shaped segments. Segments rotate continuously when `|cents| > 2` (rotation speed proportional to `|cents|`) and stop when `|cents| ≤ 2` (in tune).
- **FR-AFX-07:** Three mode tabs ("Free", "Auto", "Manual") shall be displayed in the top-right corner; the active mode tab is highlighted (blue/bright). The visualization shall expose `setMode(mode)` on its returned object; `screen.js` shall call `activeViz.setMode?.(mode)` whenever the tuning mode changes (optional chaining ensures backward compatibility with existing visualizations).
- **FR-AFX-08:** When `note === null` (no signal): the chromatic gauge shows no position marker, both direction arrows are dim/hidden, note name shows "- -", octave shows "-", strobe arc pauses.
- **FR-AFX-09:** The visualization conforms to the factory contract: `window._tunerViz_axeFxIII(container)` returning `{ update(note, cents, freq), setMode(mode), destroy() }`.
- **FR-AFX-10:** An "Axe-Fx III" option with value `"axe-fx-iii"` shall be added to the viz selector in `settings.html`.

### Applicable NFRs (Epic 4)

- **NFR-03** — no external JS libs
- **NFR-06** — viz factory contract
- **NFR-07** — Tailwind-only styling; no inline `style=""`, no hardcoded colours

### Additional Requirements (Epic 4)

- IIFE pattern; exposed as `window._tunerViz_axeFxIII`
- Constants prefixed `_TUNER_`
- DOM via `document.createElement` / `classList` / `textContent` only
- `destroy()` must cancel all active RAF IDs and remove all DOM nodes from container
- `screen.js` requires a one-line patch to call `activeViz.setMode?.(mode)` on mode changes — included in Story 4.2

---

## Epic 4: Axe-Fx III Visualization

Deliver a new built-in visualization styled after the Fractal Audio Axe-Fx III hardware tuner display. A dark pixelated LCD panel shows a horizontal chromatic gauge at the top, inward-pointing directional arrows beneath it indicating which way to adjust pitch, large pixelated note name and octave number in the lower corners, and a rotating pink/magenta strobe semicircle at the bottom centre. Three mode tabs (Free / Auto / Manual) in the top-right reflect the active tuning mode. Selectable via the settings panel.

**FRs covered:** FR-AFX-01 through FR-AFX-10, FR-18
**NFRs:** NFR-03, NFR-06, NFR-07

---

### Story 4.1: Scaffold, Static Layout & Settings Wiring

As a developer implementing the Axe-Fx III visualization,
I want a fully structured static panel with all DOM elements in place and the visualization registered in settings,
So that subsequent stories can layer live data and animation onto a stable, correctly-laid-out foundation.

**Acceptance Criteria:**

**Given** the file `visualization/axe-fx-iii.js` is created
**When** the IIFE executes
**Then** `window._tunerViz_axeFxIII` is a factory function that accepts a `container` DOM element and returns `{ update(note, cents, freq), setMode(mode), destroy() }`

**Given** the factory is called with a container
**When** the static DOM is rendered
**Then** the panel contains (top to bottom, left to right):
- A full-width chromatic gauge strip in the upper area (tick marks rendered statically, no position marker yet)
- Three mode tabs ("Free", "Auto", "Manual") in the top-right corner with "Free" highlighted by default
- Two inward-pointing triangle arrows (`▶ ◀`) centred below the gauge, both in a dim/neutral state
- A large note name display in the lower-left showing "- -"
- A large octave number display in the lower-right showing "-"
- A strobe semicircle arc at the bottom centre with diamond-shaped segments in a static, unrotated state

**Given** the DOM is rendered
**When** inspected
**Then** the panel background is dark navy-blue; all text uses a pixelated/monospace Tailwind font class; all styling uses Tailwind utility classes only — no inline `style=""` attributes and no hardcoded colour values

**Given** the `destroy()` method is called
**When** executed
**Then** all DOM nodes appended to the container are removed; no timers or RAF loops exist to cancel at this stage

**Given** `settings.html` is updated
**When** the viz selector is rendered
**Then** an "Axe-Fx III" option with value `"axe-fx-iii"` is present in the visualization select element

---

### Story 4.2: Chromatic Gauge, Direction Arrows, Note/Octave Display & Mode Tabs

As a guitar player using the Axe-Fx III visualization,
I want the chromatic gauge, directional arrows, and note/octave readout to respond live to my detected pitch,
So that I can immediately see what note I'm playing, which octave, and which direction I need to adjust.

**Acceptance Criteria:**

**Given** `update(note, cents, freq)` is called with a non-null `note` and `cents` = 0
**When** rendered
**Then** the chromatic gauge's white position marker is centred in the gauge strip; both direction arrows (`▶ ◀`) are equally bright

**Given** `cents` is −25 (flat)
**When** rendered
**Then** the white position marker is displaced to the left of centre proportionally; the right-facing teal `▶` arrow is brighter/highlighted and the left-facing white `◀` arrow is dim, indicating the player must bring the pitch up

**Given** `cents` is +25 (sharp)
**When** rendered
**Then** the white position marker is displaced to the right of centre proportionally; the left-facing white `◀` arrow is brighter/highlighted and the right-facing teal `▶` arrow is dim, indicating the player must bring the pitch down

**Given** `cents` is any value between −50 and +50
**When** rendered
**Then** the position marker's horizontal offset is linearly proportional to the cent value; the gauge updates synchronously within `update()` (no RAF required for the gauge itself)

**Given** `update(note, cents, freq)` is called with a non-null `note`
**When** rendered
**Then** the note name display shows the `note` string (e.g., "Bb", "E") in large pixelated text in the lower-left; the octave number is computed from `freq` using A4 = 440 Hz as reference (`octave = Math.round(12 * Math.log2(freq / 440) + 69) / 12 |0` — standard MIDI octave formula) and displayed in the lower-right

**Given** `setMode("free")` is called
**When** the tabs are rendered
**Then** the "Free" tab is highlighted and "Auto" and "Manual" are dim

**Given** `setMode("auto")` is called
**When** the tabs are rendered
**Then** the "Auto" tab is highlighted and the others are dim

**Given** `setMode("manual")` is called
**When** the tabs are rendered
**Then** the "Manual" tab is highlighted and the others are dim

**Given** `screen.js` is patched
**When** the active tuning mode changes (free/auto/manual)
**Then** `activeViz.setMode?.(mode)` is called with the appropriate mode string — the optional chaining ensures no error is thrown for existing visualizations that do not implement `setMode`

**Given** `note === null`
**When** `update(null, 0, 0)` is called
**Then** the chromatic gauge position marker is hidden; both direction arrows are dim; note display shows "- -"; octave display shows "-"

---

### Story 4.3: Strobe Animation & No-Signal Polish

As a guitar player using the Axe-Fx III visualization,
I want the strobe arc to rotate when I'm out of tune and freeze when I hit the target, with a clean idle state when no signal is detected,
So that I can use the strobe as a precision in-tune confirmation alongside the chromatic gauge.

**Acceptance Criteria:**

**Given** `update(note, cents, freq)` is called with `|cents| > 2`
**When** the strobe is running
**Then** the pink/magenta diamond segments rotate continuously around the semicircular arc; rotation speed is proportional to `|cents|` — at `|cents|` = 50 the rotation is at maximum speed, at `|cents|` = 3 it is near-still; rotation direction: clockwise when flat (cents < 0), counter-clockwise when sharp (cents > 0)

**Given** `|cents| ≤ 2` (in tune)
**When** the strobe is rendered
**Then** the diamond segments stop rotating and remain stationary, indicating the pitch is locked on target

**Given** `note === null` (no signal)
**When** rendered
**Then** the strobe arc pauses in its current rotational position; no RAF-driven rotation occurs while signal is absent

**Given** the strobe RAF loop is running
**When** `destroy()` is called
**Then** `cancelAnimationFrame()` is called with all active RAF IDs (strobe RAF and any others from prior stories); all DOM nodes are removed from the container; no globals or timers are leaked after destroy

---

### New Functional Requirements (Epic 5 — Toilet Tuner Visualization)

- **FR-TT-01:** The visualization background is the bathroom scene from `visualization/assets/Bathroom.svg`, rendered to fill the container. The scene includes a wall-mounted calendar.
- **FR-TT-02:** A toilet plunger (`visualization/assets/Plunger.svg`) serves as the chromatic indicator. It moves horizontally above the toilet bowl: −50 cents = far left, 0 cents = centre, +50 cents = far right.
- **FR-TT-03:** The detected note name is displayed as a DOM text element positioned over the calendar area of the background SVG.
- **FR-TT-04:** Plunger horizontal position is linearly proportional to cents deviation (−50…+50 range), animated smoothly via `requestAnimationFrame`.
- **FR-TT-05:** When `|cents| ≤ 2` (in tune), the plunger animates downward into the toilet bowl.
- **FR-TT-06:** When the plunger is lowered, `visualization/assets/Toiletbowl.svg` is overlaid on the bowl area to occlude the plunger's rubber cup.
- **FR-TT-07:** When `note === null` (no signal), the plunger rests at the centre position (0 cents), and the calendar text shows "–".
- **FR-TT-08:** The visualization conforms to the factory contract: `window._tunerViz_toiletTuner(container)` returning `{ update(note, cents, freq), destroy() }`.
- **FR-TT-09:** A "Toilet Tuner" option with value `"toilet-tuner"` is added to the viz selector in `settings.html`. SVG assets are already present in `visualization/assets/`.

### Applicable NFRs (Epic 5)

- **NFR-03** — no external JS libs
- **NFR-06** — viz factory contract
- **NFR-07** — Tailwind-only styling; no inline `style=""`, no hardcoded colours

### Additional Requirements (Epic 5)

- IIFE pattern; exposed as `window._tunerViz_toiletTuner`
- Constants prefixed `_TUNER_`
- DOM via `document.createElement` / `classList` / `textContent` only; SVGs loaded via `<img>` tags referencing `/api/plugins/tuner/static/assets/<filename>`
- `destroy()` must cancel all active RAF IDs and remove all DOM nodes from container

### FR Coverage Map (Epic 5)

- **FR-TT-01:** Epic 5 (Story 5.1) — Background bathroom SVG rendered
- **FR-TT-02:** Epic 5 (Story 5.1) — Plunger SVG element positioned in DOM
- **FR-TT-03:** Epic 5 (Story 5.1) — Note name text overlay on calendar area
- **FR-TT-04:** Epic 5 (Story 5.2) — Plunger L/R animation driven by cents
- **FR-TT-05:** Epic 5 (Story 5.2) — Plunger dip-into-bowl animation at ±2 cents
- **FR-TT-06:** Epic 5 (Story 5.2) — Toilet bowl overlay shown/hidden with plunger state
- **FR-TT-07:** Epic 5 (Story 5.2) — No-signal idle state
- **FR-TT-08:** Epic 5 (Story 5.1) — Factory function and destroy scaffold
- **FR-TT-09:** Epic 5 (Story 5.1) — settings.html option wired

---

## Epic 5: Toilet Tuner Visualization

Deliver a new built-in visualization featuring a bathroom scene as the background. A toilet plunger slides left (flat) or right (sharp) above the bowl based on cents deviation from the target pitch; when in tune (±2 cents) the plunger dips into the bowl and a toilet-front overlay hides its rubber cup. The wall calendar displays the current detected note name. Selectable via the settings panel.

**FRs covered:** FR-TT-01 through FR-TT-09, FR-18
**NFRs:** NFR-03, NFR-06, NFR-07

---

### Story 5.1: Scaffold, Static Layout & Settings Wiring

As a developer implementing the Toilet Tuner visualization,
I want a fully structured static panel with all DOM elements in place and the visualization registered in settings,
So that subsequent stories can layer live data and animation onto a stable, correctly-laid-out foundation.

**Acceptance Criteria:**

**Given** the file `visualization/toilet-tuner.js` is created
**When** the IIFE executes
**Then** `window._tunerViz_toiletTuner` is a factory function that accepts a `container` DOM element and returns `{ update(note, cents, freq), destroy() }`

**Given** the factory is called with a container
**When** the static DOM is rendered
**Then** the panel contains:
- A background layer with `Bathroom.svg` loaded via `<img src="/api/plugins/tuner/static/assets/Bathroom.svg">` filling the container
- A plunger element with `Plunger.svg` loaded via `<img>`, positioned absolutely above the toilet bowl area at the horizontal centre
- A toilet-bowl overlay element with `Toiletbowl.svg` loaded via `<img>`, positioned absolutely over the bowl area and set to `visibility: hidden` (hidden by default)
- A note name text element positioned absolutely over the calendar area of the background, showing "–" as its initial value

**Given** the DOM is rendered
**When** inspected
**Then** all layout uses Tailwind utility classes for positioning and sizing; no inline `style=""` attributes and no hardcoded colour values; the container uses `relative` positioning so child elements can be placed absolutely within it

**Given** `settings.html` is updated
**When** the viz selector is rendered
**Then** a "Toilet Tuner" option with value `"toilet-tuner"` is present in the visualization select element

**Given** the `destroy()` method is called at this stage (no RAF loops yet)
**When** executed
**Then** all DOM nodes appended to the container are removed; no timers or RAF loops exist to cancel at this stage

---

### Story 5.2: Plunger Animation, Bowl Dip & Note Display

As a musician using the Toilet Tuner visualization,
I want the plunger to move left and right with my pitch deviation and dip into the bowl when I'm in tune, with the note name shown on the calendar,
So that I can tune by watching the plunger's position and get a satisfying visual confirmation when I hit the target pitch.

**Acceptance Criteria:**

**Given** `update(note, cents, freq)` is called with a non-null `note` and `cents` = 0
**When** rendered
**Then** the plunger is horizontally centred above the toilet bowl; the toilet-bowl overlay is hidden; note name text shows the current `note` value

**Given** `cents` is −50 (maximally flat)
**When** rendered
**Then** the plunger is at its leftmost position above the bowl; the bowl overlay remains hidden

**Given** `cents` is +50 (maximally sharp)
**When** rendered
**Then** the plunger is at its rightmost position above the bowl; the bowl overlay remains hidden

**Given** `cents` is any value between −50 and +50 (outside ±2)
**When** rendered
**Then** the plunger's horizontal offset is linearly proportional to the cent value; animation is smooth via `requestAnimationFrame`; the plunger remains at its "raised" vertical position (above the bowl)

**Given** `|cents| ≤ 2` (in tune)
**When** rendered
**Then** the plunger animates to the centre horizontal position and then moves downward to its "lowered" vertical position (into the bowl); the toilet-bowl overlay (`Toiletbowl.svg`) becomes visible, occluding the plunger's rubber cup

**Given** `|cents|` transitions from ≤ 2 back to > 2
**When** rendered
**Then** the plunger animates back up to its raised position; the toilet-bowl overlay is hidden again; horizontal movement resumes tracking cents

**Given** `update(null, 0, 0)` is called (no pitch signal)
**When** rendered
**Then** the plunger is at the horizontal centre in its raised position; the bowl overlay is hidden; the note name text shows "–"

**Given** the RAF animation loop is running
**When** `destroy()` is called
**Then** `cancelAnimationFrame()` is called with all active RAF IDs; all DOM nodes appended to the container are removed; no globals, timers, or orphaned animation frames remain

---

### New Functional Requirements (Epic 6 — PP-Tiny Visualization)

- **FR-PT-01:** The panel shall use an oval/trapezoid chrome-bordered face rendered in black, with white text labels.
- **FR-PT-02:** Nine small LED lightbulbs shall be arranged in a curved arc across the upper panel area, spanning the deviation range. The centremost bulb glows red (in-tune), the remaining 8 glow yellow/amber.
- **FR-PT-03:** The LED arc shall span −40 to +40 cents, with the centremost bulb at 0. The lit LED pattern is bar-graph style: all LEDs from the centre (0, red) up to and including the LED closest to the current deviation are lit. E.g., at −30 cents, the red centre LED plus all yellow LEDs between 0 and −30 are lit; at +20 cents, the red centre plus all yellow LEDs between 0 and +20 are lit. LEDs beyond the current deviation position are unlit.
- **FR-PT-04:** An 8-segment display shall be positioned at the centre of the panel, showing the detected note name. The display background shall be a very dark red (near-black) to simulate an unlit LCD panel. Lit segments glow bright red with a light-glow effect; unlit segments are rendered in a very dark red, making them faintly visible as inactive segments — consistent with the appearance of a real 7/8-segment LED display. The centre horizontal bar is split into two independent half-segments (left and right), enabling accurate rendering of note name letters. A "#" symbol is rendered adjacent to the display; it is lit bright red when the note is sharp and shown in dim dark red otherwise.
- **FR-PT-05:** A red LED-bulb element to the right of the display, labelled "AUTO.", shall be lit/glowing when the tuning mode is "free" or "auto", and unlit when the mode is "manual".
- **FR-PT-06:** When `note === null` (no signal), the 8-segment display shows nothing (all segments unlit — rendered in dark red against the dark red background); no arc LED is lit; the "#" symbol is in its dim/unlit state.
- **FR-PT-07:** The visualization conforms to the factory contract: `window['_tunerViz_pp-tiny'](container)` returning `{ update(note, cents, freq, mode), destroy() }`.
- **FR-PT-08:** A "PP-Tiny" option with value `"pp-tiny"` shall be added to the viz selector in `settings.html`.

### Applicable NFRs (Epic 6)

- **NFR-03** — no external JS libs
- **NFR-06** — viz factory contract
- **NFR-07** — exempt; inline styles required for hardware-accurate rendering of the panel

### Additional Requirements (Epic 6)

- IIFE pattern; exposed as `window['_tunerViz_pp-tiny']`
- Constants prefixed `_TUNER_`
- DOM via `document.createElement` / `classList` / `textContent` only
- `destroy()` must cancel all active RAF IDs and remove all DOM nodes from container

### FR Coverage Map (Epic 6)

- **FR-PT-01:** Epic 6 (Story 6.1) — Panel shape and chrome border
- **FR-PT-02:** Epic 6 (Story 6.1) — 9-LED curved arc layout
- **FR-PT-03:** Epic 6 (Story 6.2) — Bar-graph LED illumination from centre to deviation
- **FR-PT-04:** Epic 6 (Story 6.1 + 6.2) — 8-segment display with dark-red background, split centre bar, glow effect
- **FR-PT-05:** Epic 6 (Story 6.1) — AUTO LED right of display, mode-driven
- **FR-PT-06:** Epic 6 (Story 6.2) — No-signal idle state
- **FR-PT-07:** Epic 6 (Story 6.1) — Factory contract: window['_tunerViz_pp-tiny']
- **FR-PT-08:** Epic 6 (Story 6.1) — settings.html "PP-Tiny" option

---

## Epic 6: PP-Tiny Visualization

Deliver a new built-in visualization: the PP-Tiny chromatic tuner panel. A curved arc of 9 LEDs (red at centre, yellow/amber on each side) lights bar-graph style from centre out to show cents deviation; an 8-segment display with split centre bar shows the note name in glowing red against a near-black dark-red background; an AUTO LED to the right of the display reflects the current tuning mode. Selectable via the settings panel.

**FRs covered:** FR-PT-01 through FR-PT-08, FR-18
**NFRs:** NFR-03, NFR-06 *(NFR-07 exempt — inline styles required for hardware-accurate rendering)*

---

### Story 6.1: Scaffold, Static Panel Layout & Settings Wiring

As a developer implementing the PP-Tiny visualization,
I want a fully structured static panel with all DOM elements in place and the visualization registered in settings,
So that the subsequent story can layer live data and animation onto a stable, correctly-laid-out foundation.

**Acceptance Criteria:**

**Given** the file `visualization/pp-tiny.js` is created
**When** the IIFE executes
**Then** `window['_tunerViz_pp-tiny']` is a factory function that accepts a `container` DOM element and returns `{ update(note, cents, freq, mode), destroy() }`

**Given** the factory is called with a container
**When** the static DOM is rendered
**Then** the panel contains:
- An outer chrome-bordered oval/trapezoid panel face with a black background and white text labels
- A curved arc of 9 LED elements across the upper panel area; the centremost LED is styled red, the 4 on each side are styled yellow/amber; all LEDs are in their unlit/dark state at this stage
- Range labels "−40" on the far left and "+40" on the far right of the arc, with "0" above the centre LED — all in white
- An 8-segment display element at the centre of the panel; the display background is very dark red (near-black); all 8 segments (including the split centre bar rendered as two half-segments) are visible in their unlit dark-red state; a "#" symbol element is positioned to the right of the display in its dim/unlit state
- A red LED-bulb element to the right of the display with an "AUTO" label — unlit by default, driven by tuning mode
- The "PP-Tiny" brand label on the panel face in white

**Given** `settings.html` is updated
**When** the viz selector is rendered
**Then** a "PP-Tiny" option with value `"pp-tiny"` is present in the visualization select element

**Given** the `destroy()` method is called at this stage (no RAF loops yet)
**When** executed
**Then** all DOM nodes appended to the container are removed; no timers or RAF loops exist to cancel at this stage

---

### Story 6.2: LED Arc Animation, 8-Segment Display & No-Signal State

As a guitar player using the PP-Tiny visualization,
I want the LED arc to show my deviation bar-graph style and the display to show my note name, with a clean idle state when no signal is detected,
So that I can tune by reading the PP-Tiny interface.

**Acceptance Criteria:**

**Given** `update(note, cents, freq)` is called with a non-null `note` and `cents` = 0
**When** rendered
**Then** only the centre red LED is lit; all yellow LEDs are unlit; the 8-segment display shows the note name in bright red with a glow effect

**Given** `cents` is −30
**When** rendered
**Then** the centre red LED and all yellow LEDs from the centre toward the −40 position up to and including the LED nearest to −30 are lit; yellow LEDs beyond −30 (toward −40) are unlit; yellow LEDs on the +40 side are all unlit

**Given** `cents` is +20
**When** rendered
**Then** the centre red LED and all yellow LEDs from the centre toward +40 up to and including the LED nearest to +20 are lit; yellow LEDs beyond +20 and all LEDs on the −40 side are unlit

**Given** `cents` is any value between −40 and +40
**When** rendered
**Then** the lit LEDs form a contiguous bar from the centre to the closest LED to the current deviation; LED position mapping is linear across the 9-bulb arc (centre = 0, outermost = ±40)

**Given** the detected note is sharp (contains "#", e.g., "A#")
**When** rendered
**Then** the "#" symbol adjacent to the display is lit bright red; only the note letter(s) before the "#" are shown on the 8-segment display (e.g., "A" on the display, "#" symbol lit)

**Given** the detected note is natural (no "#", e.g., "E", "A")
**When** rendered
**Then** the note letter is shown on the 8-segment display; the "#" symbol is in its dim dark-red unlit state

**Given** `update(null, 0, 0)` is called (no pitch signal)
**When** rendered
**Then** all arc LEDs are unlit (centre red LED and all yellow LEDs dark); the 8-segment display shows nothing (all segments in their unlit dark-red state against the dark-red background); the "#" symbol is unlit

**Given** the RAF animation loop is running
**When** `destroy()` is called
**Then** `cancelAnimationFrame()` is called with all active RAF IDs; all DOM nodes appended to the container are removed; no globals, timers, or orphaned animation frames remain

---

### Story 6.3: Mace Fx III — Legal Differentiation

As a plugin distributor shipping the Mace Fx III visualization,
I want the Axe-Fx III visualization renamed, recolored, and its strobe circle made fully visible,
so that the visualization is legally distinct from Fractal Audio's Axe-Fx III product and looks polished.

**Acceptance Criteria:**

**Given** the file `visualization/axe-fx-iii.js` is renamed
**When** the plugin loads
**Then** `visualization/mace-fx-iii.js` exists; `visualization/axe-fx-iii.js` does not; the window global is `window['_tunerViz_mace-fx-iii']`; the viz selector in `screen.js` shows "Mace Fx III" with `value="mace-fx-iii"`

**Given** the color constants are updated
**When** the visualization renders
**Then** mode tabs use slate-gray (`#505868`) not blue; the strobe arc uses orange (`#e87020`) not pink/magenta

**Given** the strobe SVG is updated
**When** rendered
**Then** the strobe is a full dashed circle fully contained within the panel bounds (no clipping); animation behavior (speed, direction, deceleration) is unchanged

---

### Story 6.4: CHEF MT-3 — Scaffold, Static Panel Layout & Settings Wiring

As a developer implementing the CHEF MT-3 visualization,
I want a fully structured static panel with all DOM elements in place and the visualization registered in settings,
so that the subsequent story can layer live gauge animation and note display onto a stable foundation.

**Acceptance Criteria:**

**Given** the file `visualization/chef-mt3.js` is created
**When** the IIFE executes
**Then** `window['_tunerViz_chef-mt3']` is a factory function that accepts a `container` DOM element and returns `{ update(note, cents, freq, mode), destroy() }`

**Given** the factory is called with a container
**When** the static DOM is rendered
**Then** the panel contains: shiny-black chamfered rectangular face with chrome border; four corner screw heads; a curved glass gauge arc (∩ upward arch) with tick lines and −50/0/+50 labels; a 7-segment display (dark-red background, all segments unlit) with a "#" symbol; two rubber-style buttons labelled "MODE" (left) and "BRGHT." (right); "CHEF MT-3" brand label

**Given** `screen.js` is updated
**When** the viz selector is rendered
**Then** a "CHEF MT-3" option with `value="chef-mt3"` is present

---

### Story 6.5: CHEF MT-3 — Gauge Animation, Note Display & Strobe Mode

As a guitar player using the CHEF MT-3 visualization,
I want the gauge to show my tuning deviation and the display to show my note name, with a MODE button that switches between standard pointer mode and strobe mode,
so that I can tune accurately using a familiar pedal-style interface.

**Acceptance Criteria:**

**Given** standard mode is active and `note` is non-null
**When** `update(note, cents, freq)` is called
**Then** 3 orange glowing marker lights are positioned on the gauge arc proportional to the cents deviation (−50 = far left, 0 = top centre, +50 = far right); the 7-segment display shows the note letter; the "#" symbol glows when note is sharp

**Given** `update(null, 0, 0)` is called (no signal)
**When** rendered
**Then** all markers are hidden; the 7-segment display shows nothing; the "#" symbol is dim

**Given** the MODE button is pressed
**When** in standard mode
**Then** the visualization switches to strobe mode: 5 groups of 2 marker dots are distributed along the arc and drift continuously left (flat) or right (sharp) proportional to deviation; dots decelerate smoothly when signal stops

**Given** the MODE button is pressed again
**When** in strobe mode
**Then** the visualization returns to standard mode

**Given** the RAF animation loop is running
**When** `destroy()` is called
**Then** all RAF IDs are cancelled; all DOM nodes removed from container

---

### New Functional Requirements (Epic 7 — Infrastructure: Asset Endpoint Isolation & JUCE Audio Bridge)

#### Part A — Visualization Asset Relocation

- **FR-VA-01:** SVG assets (`Bathroom.svg`, `Plunger.svg`, `Toiletbowl.svg`) shall be relocated from the root-level `assets/` folder to `visualization/assets/` subfolder.
- **FR-VA-02:** A new route `GET /api/plugins/tuner/viz-assets/{filename}` shall serve static asset files (`.svg`, `.png`) from `visualization/assets/`, guarded by the same `.resolve()` + `.relative_to()` path-traversal check used by all other file-serving routes in `routes.py`.
- **FR-VA-03:** `toilet-tuner.js` shall reference all SVG assets via `/api/plugins/tuner/viz-assets/<filename>` — not via any path under `/api/plugins/tuner/visualization/` or any path that overlaps Slopsmith's host `/api/assets/` namespace.
- **FR-VA-04:** The existing `/api/plugins/tuner/visualization/{filename}` route shall continue to serve only `.js` files; requests for `.svg` or other non-JS extensions return 404 (existing behaviour, formally enforced).

#### Part B — JUCE Audio Bridge

- **FR-JB-01:** At startup, `screen.js` shall probe for the Slopsmith Desktop Electron IPC bridge by checking `window.slopsmithDesktop?.isDesktop`, `typeof window.slopsmithDesktop.audio?.getPitchDetection === 'function'`, `await window.slopsmithDesktop.audio.isAvailable()`, and `(await window.slopsmithDesktop.audio.isMlNoteDetection()) === false`. All four conditions must be true to activate bridge mode. The ML check is mandatory: the BasicPitch ML detector always returns `cents = 0.0` (discrete pitch class only), which would render the tuner useless.
- **FR-JB-02:** In bridge mode, the plugin polls `window.slopsmithDesktop.audio.getPitchDetection()` on a 30 ms interval. The returned `{ frequency, cents, midiNote, confidence }` struct (from `PitchDetector::Detection`) is consumed directly: `frequency` and `cents` are already computed by the native YIN detector running on a background thread inside the JUCE engine. `midiNote` is used to derive the note-class string (stripping the octave suffix from `noteName`, or computing from `midiNote % 12`). The YIN Web Worker and `ScriptProcessorNode` pipeline are not started.
- **FR-JB-03:** If any probe condition fails (bridge absent, engine unavailable, ML active), the plugin silently starts the existing `getUserMedia` + YIN Worker pipeline instead. No user-facing indication of the fallback is required; a `console.log` noting the active path is sufficient.
- **FR-JB-04:** A `audioInputMode` config field (`"auto"` | `"browser"`) shall be persisted server-side in `tuner.json`. Default: `"auto"`. When `"auto"`, bridge mode is used when available and all probe conditions pass; when `"browser"`, the Web Audio pipeline is always used regardless of bridge availability. The settings panel exposes this toggle only when `window.slopsmithDesktop?.isDesktop` is true (irrelevant in browser context).
- **FR-JB-05:** When bridge mode is active, the audio device selector and channel selector in the settings panel are hidden or disabled — they have no effect when the JUCE engine owns the audio device.
- **FR-JB-06:** Each IPC poll is wrapped in try/catch. A thrown error or `midiNote < 0` / `frequency <= 0` from the result is treated as no-signal for that tick (same semantics as `rms < 0.01` in the YIN worker path). Failures are logged at `console.warn` level. No reconnect or retry logic is required — the next scheduled poll fires normally. If the engine stops mid-session the tuner displays no pitch detected until the engine resumes or the user switches to browser mode.

### Applicable NFRs (Epic 7)

- **NFR-03** — no external JS or Python libs introduced
- **NFR-05** — all error paths (missing bridge, engine stop, IPC throw, path traversal) caught and handled; no unhandled exceptions

### Additional Requirements (Epic 7)

- `routes.py` changes in Story 7.1 follow existing patterns: `pathlib.Path`, `.resolve()` + `.relative_to()` guard, `Response` with appropriate `media_type`
- Story 7.2 is a pure `screen.js` change — `routes.py` is untouched
- `audioInputMode` config key follows existing partial-update pattern: only the changed field is POST'd; `_write()` merges with existing config

### FR Coverage Map (Epic 7)

- **FR-VA-01:** Epic 7 (Story 7.1) — SVG assets moved from `assets/` to `visualization/assets/`
- **FR-VA-02:** Epic 7 (Story 7.1) — New `/viz-assets/` route in `routes.py`
- **FR-VA-03:** Epic 7 (Story 7.1) — `toilet-tuner.js` references updated
- **FR-VA-04:** Epic 7 (Story 7.1) — `.js`-only enforcement on `/visualization/` route (documented)
- **FR-JB-01:** Epic 7 (Story 7.2) — Bridge probe logic in `startAudio()`
- **FR-JB-02:** Epic 7 (Story 7.2) — Poll loop consuming `{ frequency, cents, midiNote }`
- **FR-JB-03:** Epic 7 (Story 7.2) — Silent fallback to Web Audio pipeline
- **FR-JB-04:** Epic 7 (Story 7.2) — `audioInputMode` config field + settings toggle
- **FR-JB-05:** Epic 7 (Story 7.2) — Device/channel selector hide in bridge mode
- **FR-JB-06:** Epic 7 (Story 7.2) — Per-tick catch, no-signal handling, console.warn

---

## Epic 7: Infrastructure — Asset Endpoint Isolation & JUCE Audio Bridge

Cleanly separate visualization static assets onto a dedicated `/viz-assets/` API route, eliminating collision risk with Slopsmith's host `/api/assets/` namespace and making SVGs actually reachable. Separately, implement a JUCE Bridge audio input path so the tuner taps into Slopsmith Desktop's native YIN detector (already running inside the JUCE engine) as a first-class input source — bypassing the browser Web Audio pipeline entirely when running in the desktop app. The bridge is gated on YIN mode only: if the engine has switched to the BasicPitch ML detector (which produces no cents data), the tuner falls back to its own browser pipeline automatically. The existing Web Audio pipeline remains the default everywhere and a hard fallback in all other cases.

**FRs covered:** FR-VA-01 through FR-VA-04, FR-JB-01 through FR-JB-06
**NFRs:** NFR-03, NFR-05

---

### Story 7.1: Relocate Visualization Assets to Dedicated Endpoint

As a developer maintaining the slopsmith-plugin-tuner,
I want SVG visualization assets served from a dedicated `/viz-assets/` route backed by a `visualization/assets/` subfolder,
So that asset URLs are unambiguous, non-colliding with Slopsmith's host asset namespace, and reliably reachable by visualization code.

**Acceptance Criteria:**

**Given** the files `Bathroom.svg`, `Plunger.svg`, and `Toiletbowl.svg` currently reside in `assets/`
**When** Story 7.1 is complete
**Then** those three files exist at `visualization/assets/Bathroom.svg`, `visualization/assets/Plunger.svg`, and `visualization/assets/Toiletbowl.svg`; the root `assets/` folder no longer contains them

**Given** `routes.py` is updated
**When** `GET /api/plugins/tuner/viz-assets/Bathroom.svg` is requested
**Then** the response is the SVG file contents with `Content-Type: image/svg+xml`; path-traversal is guarded by `.resolve()` + `.relative_to(base_dir.resolve())` identical to the existing JS-serving pattern

**Given** a path-traversal attempt such as `GET /api/plugins/tuner/viz-assets/../routes.py`
**When** the route handler evaluates the path
**Then** the response is 404 — the traversal guard rejects it

**Given** `toilet-tuner.js` references assets
**When** the visualization renders
**Then** all three `<img>` src attributes use `/api/plugins/tuner/viz-assets/<filename>` — no reference to `/api/plugins/tuner/visualization/` or `/api/assets/` remains

**Given** the existing `/api/plugins/tuner/visualization/{filename}` route
**When** a `.svg` filename is requested via that route
**Then** the response is 404 — the `.js`-only suffix check rejects non-JS requests (existing behaviour confirmed and documented)

**Given** the Toilet Tuner visualization is loaded and the new routes are in place
**When** the panel renders in a running Slopsmith instance
**Then** all three SVG images display correctly — the bathroom background, plunger, and toilet bowl overlay are visible as expected

---

### Story 7.2: Implement JUCE Bridge Audio Input

As a musician using the Slopsmith Desktop app,
I want the tuner plugin to receive pitch data from the desktop's native JUCE audio engine instead of opening its own browser microphone stream,
So that I get lower-latency, higher-quality tuning that works reliably on all desktop platforms (including Linux where Chromium denies `getUserMedia` to localhost renderers), without needing to configure a separate audio device in the browser.

**Acceptance Criteria:**

> **⚠️ Revised 2026-06-04 — design changed during implementation.** The original ACs below described polling the engine's pre-computed pitch (`getPitchDetection` / `getRawPitch`) and gating on the ML detector. That produced a jittery readout, so the shipped design instead taps the engine's **raw audio stream** (`getRawAudioFrame`) and runs the tuner's **own YIN worker** over it; `getRawPitch`/`getPitchDetection` and all ML-gating were removed. The authoritative, current acceptance criteria live in `_bmad-output/implementation-artifacts/7-2-implement-juce-bridge-audio-input.md` (ACs 1–11). The summary below is kept in sync with that file.

**Given** the plugin loads inside Slopsmith Desktop with the JUCE audio engine running
**When** `startAudio()` is called and the probe passes (`isDesktop`, `isAvailable()` true, `getRawAudioFrame` present)
**Then** bridge mode is activated: `usingDesktopBridge` is set; `audio.startAudio()` is called if the engine is not yet running; a 30 ms poll loop pulls `getRawAudioFrame(_TUNER_MIN_YIN_SAMPLES)` and feeds the frames to the tuner's own YIN Web Worker; `ScriptProcessorNode` and `getUserMedia` are not called

**Given** the bridge poll loop is running
**When** a raw audio frame is returned
**Then** the frame is copied (not transferred) and posted to the YIN worker; the worker result flows through `_handleYinResult` → `_onResult` exactly as on the browser path; the sample rate is read once via `getSampleRate()` (fallback 48000); only one frame is in flight at a time (back-pressure guard with a watchdog)

**Given** a poll throws, or returns a short/empty/non-`Float32Array` frame
**When** the tick runs
**Then** a throw is logged at `console.warn` with a `[tuner]` prefix and reported as no-signal (`{ smoothedFreq: null, rms: 0, hasSignal: false }`); a short/empty frame is skipped; the interval continues

**Given** the addon does not expose `getRawAudioFrame` (downlevel build)
**When** the bridge probe runs
**Then** the probe returns false and the `getUserMedia` + YIN pipeline starts; no console warning is shown; `getRawPitch` is NOT used as a fallback

**Given** the plugin loads in a regular browser (no `window.slopsmithDesktop`)
**When** `startAudio()` runs
**Then** the bridge probe is skipped entirely; `getUserMedia` + YIN pipeline starts as before — no regression

**Given** `audioInputMode` is `"browser"` in `tuner.json`
**When** `startAudio()` runs inside Slopsmith Desktop
**Then** the bridge probe is bypassed regardless of bridge availability; the Web Audio pipeline starts

**Given** bridge mode is active and the settings panel is open
**When** the audio device selector and channel selector are rendered
**Then** both controls are hidden (audio is provided by the desktop engine)

**Given** the `audioInputMode` toggle in the Plugin Manager settings page is changed
**When** the change is saved
**Then** a `POST /api/plugins/tuner/config` partial update persists `{ audioInputMode }` and it survives a reload; the running tuner is NOT restarted from this page — the change takes effect the next time the tuner panel is opened

**Given** the bridge poll loop is running
**When** `stopAudio()` is called (panel close, navigation, or destroy)
**Then** `clearInterval` fires on the poll interval AND the YIN worker is terminated; `usingDesktopBridge` resets to false; no orphaned interval or worker continues

**Given** the YIN worker receives a frame
**When** it selects the fundamental
**Then** it uses the canonical absolute-threshold step (first local minimum below threshold), not the global minimum, so sub-octave / sub-harmonic errors are rejected at the source; the global minimum is only a no-crossing fallback

**Given** auto mode with a selected tuning
**When** a detected pitch is matched to a string
**Then** matching is octave-aware (octave-folded distance, smallest-shift tie-break); displayed cents/frequency are folded into the matched octave; a 40-cent hysteresis prevents flicker; committed-target state resets on tuning change and signal loss

---

### New Functional Requirements (Epic 8 — Real-Instrument Audio Test Suite)

- **FR-RI-01:** A dedicated directory `tests/fixtures/audio/real/` shall exist to hold WAV recordings captured from real instruments (e.g. guitar, bass, microphone). The directory shall include a `README.md` explaining the naming convention and how to add recordings.
- **FR-RI-02:** WAV files dropped into `tests/fixtures/audio/real/` shall be auto-discovered by the test runner using the same naming convention as the existing synthetic fixtures: `<NoteClass><Octave>_<FreqHz>Hz.wav` (e.g. `E2_82.41Hz.wav`, `A#3_233.08Hz.wav`). The expected frequency is parsed from the filename.
- **FR-RI-03:** For each discovered WAV, the test shall extract a `MIN_FRAME` (4096-sample) window from the middle of the file (skipping attack/release transients) and feed it to `_yinDetect`. The test shall assert that a frequency is detected (freq > 0) and that the cents error is within ±20 cents: `cents_error = 1200 * |log2(detected / expected)| ≤ 20`.
- **FR-RI-04:** If `tests/fixtures/audio/real/` contains no `.wav` files, the test suite shall skip gracefully with a human-readable message explaining how to add recordings — identical skip pattern to the existing `yin.wav.test.js`.
- **FR-RI-05:** The new test file shall be wired into the GitHub Actions CI workflow (`.github/workflows/test.yml`) so it runs automatically on every push and PR alongside the existing JS tests.
- **FR-RI-06:** The new test file shall support multi-channel WAV files (stereo recordings from audio interfaces) by mixing all channels down to mono before running YIN detection, since `_yinDetect` expects a mono `Float32Array`.

### Applicable NFRs (Epic 8)

- **NFR-04** — YIN must run in a Worker in production; for test purposes, calling `_yinDetect` directly from Node.js (as the existing test suite already does) is acceptable.
- **NFR-05** — No unhandled exceptions from malformed WAV files; invalid WAV format should fail the test with a descriptive assertion error, not throw.

### Additional Requirements (Epic 8)

- Real WAV files **are committed to the repository** alongside the synthetic fixtures — they are first-class regression assets. The `README.md` in `tests/fixtures/audio/real/` explains the naming convention and recording guidelines (short clips, sustain portion only, 16-bit PCM or 32-bit float, mono or stereo).
- The test file uses `node:test` and `node:assert/strict` (same as existing JS tests) — no new test framework dependencies.
- The cents-tolerance assertion message must include the note name, expected Hz, detected Hz, and computed cents error to aid debugging of marginal detections.
- Keep WAV clips short (≤ 2 seconds) to control repository size. If the recording corpus grows large, consider Git LFS — document this in `README.md` as a future option but do not set it up in this epic.

---

## Epic 8: Real-Instrument Audio Test Suite

Add a test fixture workflow that lets developers record notes from real instruments, drop the WAV files into a dedicated folder, and have the automated test suite verify that YIN pitch detection stays within ±20 cents of the expected pitch encoded in the filename. The tolerance is expressed in cents (not percentage) to match how musicians reason about pitch accuracy, and is intentionally tighter than the existing synthetic-fixture tolerance (~34 cents at 2%) to surface any regression in real-world detection quality.

**FRs covered:** FR-RI-01 through FR-RI-06
**NFRs:** NFR-04, NFR-05

---

### Story 8.1: Real-Instrument Test Infrastructure

As a developer working on the YIN pitch detector,
I want to drop WAV recordings from real instruments into `tests/fixtures/audio/real/` and have the test suite automatically validate detection accuracy to ±20 cents,
So that algorithm regressions on real-world audio are caught in CI before they reach main.

**Acceptance Criteria:**

**Given** the repository is freshly cloned
**When** `tests/fixtures/audio/real/` is inspected
**Then** the directory exists and contains `README.md` explaining the naming convention, recording guidelines (short clips ≤ 2 s, sustain portion, 16-bit PCM or 32-bit float, mono or stereo), and the Git LFS note for future growth; WAV files in this directory **are committed** and travel with the repo as regression fixtures

**Given** `tests/fixtures/audio/real/` contains no `.wav` files (empty directory on a first-time setup before any recordings are added)
**When** the test runner executes `tests/js/yin.realinstrument.test.js`
**Then** all tests are skipped with the message: `No real-instrument WAV fixtures found in tests/fixtures/audio/real/ — record a note and name it e.g. E2_82.41Hz.wav`

**Given** a mono WAV file named `E2_82.41Hz.wav` is placed in `tests/fixtures/audio/real/`
**When** the test runner executes
**Then** a test named `Real WAV E2_82.41Hz.wav: detects 82.41 Hz (E2)` is generated and run automatically

**Given** the test runs with a valid WAV and `_yinDetect` returns `freq > 0`
**When** the cents error is computed as `1200 * Math.abs(Math.log2(detectedFreq / expectedHz))`
**Then** the test passes if `cents_error <= 20` and fails with a message of the form: `E2_82.41Hz.wav: expected 82.41 Hz, got <X> Hz (<Y> cents off — limit 20 cents)`

**Given** a stereo (2-channel) WAV file is placed in `tests/fixtures/audio/real/`
**When** the WAV is parsed
**Then** both channels are averaged sample-by-sample into a single mono `Float32Array` before being passed to `_yinDetect` — no assertion error is thrown for stereo files

**Given** a WAV file that is shorter than `MIN_FRAME` (4096 samples)
**When** the test runs
**Then** the test fails with the message: `WAV too short: need ≥4096 samples, got <N>` (same pattern as `yin.wav.test.js`)

**Given** the new test file exists
**When** `.github/workflows/test.yml` runs
**Then** `tests/js/yin.realinstrument.test.js` is included in the `node --test` invocation alongside `yin.unit.test.js` and `yin.wav.test.js`; CI passes on a clean clone (no WAV files = all tests skipped, skips are not failures)
