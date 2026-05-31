---
stepsCompleted: ['step-01', 'step-02', 'step-03', 'step-04', 'epic2-step-01', 'epic2-step-02', 'epic2-step-03', 'epic3-step-01', 'epic3-step-02', 'epic3-step-03', 'epic4-step-01', 'epic4-step-02', 'epic4-step-03', 'epic5-step-01', 'epic5-step-02', 'epic6-step-01', 'epic6-step-02']
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
