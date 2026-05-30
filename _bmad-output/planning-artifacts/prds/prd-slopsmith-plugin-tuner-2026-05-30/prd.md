---
title: 'slopsmith-plugin-tuner PRD'
status: final
created: '2026-05-30'
updated: '2026-05-30'
---

# Slopsmith Tuner Plugin — Product Requirements Document

## 1. Overview

The **Slopsmith Tuner Plugin** is a real-time chromatic tuner plugin for [Slopsmith](https://github.com/byrongamatos/slopsmith) — a self-hosted, open-source music app that began as a Rocksmith alternative and is growing beyond that scope. The plugin adds guitar and bass tuning directly into the Slopsmith interface so players never need to leave the app.

Current version: **1.2.5** (feature-complete baseline).

## 2. Problem

Slopsmith ships without a built-in tuner. Players must switch to an external app or device to tune, interrupting practice. This is most noticeable when loading a song with an unfamiliar tuning (e.g., Drop D, DADGAD). Players using professional audio interfaces such as the Real Tone Cable need a tuner that accommodates those devices natively.

## 3. Goals & Success Metrics

**Goals**
- Provide an accurate, low-latency chromatic tuner embedded in the Slopsmith UI.
- Support all common guitar and bass tunings, plus automatic detection of song-specific tunings from the Slopsmith player.
- Deliver a stable, crash-free experience with clear, actionable error feedback.
- Remain self-contained — no external JavaScript library dependencies beyond what Slopsmith itself provides.

**Success Metrics**
- Pitch detection accurate to within ±2 cents under normal single-string input conditions.
- Zero unhandled exceptions during normal operation; microphone errors surface as inline UI banners with recovery hints.
- Plugin installs and runs with no JS libraries outside Slopsmith's own (e.g., Tailwind CSS).

**Counter-metrics**
- Elevated CPU usage from the audio pipeline under sustained use.
- False-positive pitch readings from ambient noise or low-confidence frames.

## 4. Users

Guitar and bass players who run Slopsmith for self-hosted music practice. They range from casual hobbyists to dedicated players, all needing to tune quickly without leaving the app. A meaningful subset connects professional audio interfaces (e.g., Real Tone Cable, stereo USB interfaces) rather than a built-in laptop microphone.

## 5. Features

### 5.1 Tuner Core

**FR-01** The plugin shall detect the fundamental frequency of live audio input in real time using the YIN pitch detection algorithm, operating on a minimum of 4,096 samples per frame at the device's native sample rate.

**FR-02** The plugin shall display the detected pitch as a musical note class (e.g., "E", "A#") and a cents-deviation value (positive = sharp, negative = flat). Octave information is not shown in the live display; note names with octave (e.g., E2) appear only in tuning definition inputs.

**FR-03** The plugin shall support a minimum detectable frequency of 20 Hz, covering the full range of 5-string bass guitar.

**FR-04** Pitch detection shall run in a dedicated Web Worker so the main UI thread is never blocked by audio processing.

### 5.2 Tuning Presets

**FR-05** The plugin shall ship with the following built-in tuning groups:

| Group        | Presets                                    |
|--------------|--------------------------------------------|
| General      | Free Tune (chromatic — no target string)   |
| Guitar       | Standard, Drop D, Open G, DADGAD, Open E  |
| Bass 4-string | Standard, Drop D, D-Standard, Drop C     |
| Bass 5-string | Standard, Drop D, D-Standard, Drop C     |

**FR-06** Each preset defines its strings as a list of target frequencies in Hz.

**FR-07** Individual built-in tunings shall be showable/hideable per-user via the Plugin Manager settings.

### 5.3 Custom Tunings

**FR-08** Users shall be able to define custom tuning presets by name, specifying strings as note names (e.g., E2, A2) or Hz values, via the Plugin Manager settings.

**FR-09** Custom tunings shall merge with built-in tunings and appear in the tuning selector.

### 5.4 Automatic Song Tuning

**FR-10** When the Slopsmith player screen is active and the loaded song includes tuning metadata, the plugin shall offer a "Current Song" option at the top of the tuning selector. This option shall be omitted when no song is loaded, the song carries no tuning metadata, or the user is on a non-player screen.

**FR-11** The plugin shall resolve song tuning offsets to absolute frequencies via the Slopsmith `highway` API, correctly distinguishing guitar and bass arrangements by string count and arrangement type.

**FR-12** A human-readable tuning label (e.g., "Drop D", "Eb Standard") shall be derived from the offset pattern and shown alongside the "Current Song" option. Label resolution is defined for 4-string and 6-string patterns; 5-string arrangements fall back to displaying raw offset values.

### 5.5 String Targeting

**FR-13** In auto mode, the plugin shall automatically highlight the string closest to the detected pitch within the active tuning.

**FR-14** Tapping a string button shall lock onto that string's frequency (manual mode), useful for heavily out-of-tune strings where auto selection would misfire.

**FR-15** Tapping the active manual target a second time shall deactivate manual mode and return to auto.

### 5.6 Visualizations

**FR-16** The plugin shall support a pluggable visualization system: each visualization is a self-contained JS module loaded on demand from the `visualization/` directory and registered as `window._tunerViz_<name>`. Adding a new visualization requires only dropping in the file and adding a settings option — no changes to core plugin code.

**FR-17** The plugin shall ship with two built-in visualizations:
- **Default** — needle/gauge with cents readout. The indicator turns green when the detected pitch is within ±2 cents of the target; outside that range it reflects the direction and magnitude of deviation.
- **Strobe** — strobe-style phase visualization. Strobe rotation stops when the pitch is in tune.

The default visualization for new installs is **Default** (matching the backend config default). The `screen.js` initialisation to `"strobe"` is a code bug that should be corrected to `"default"`. The server persists the user's last selection on first settings save.

**FR-18** Users shall be able to switch visualizations from the settings panel; the selection shall persist across sessions.

### 5.7 Audio Input

**FR-19** Users shall be able to select any available system audio input device from the settings panel.

**FR-20** Users shall be able to select the input channel — Mono (both channels mixed), Left (channel 1), or Right (channel 2) — to accommodate stereo interfaces and mono-only devices such as the Real Tone Cable.

**FR-21** Audio device and channel preferences shall persist across sessions via `localStorage`.

**FR-22** If a saved device is no longer available, rejects `channelCount: 2`, or is otherwise unconstrained, the plugin shall fall back to the default device without surfacing an unhandled error and shall clear the stale saved device ID.

### 5.8 Error Handling

**FR-23** Microphone access failures shall surface as an inline error banner within the tuner panel — not as a browser `alert()`.

**FR-24** The error banner shall include a human-readable message and an actionable recovery hint tailored to the error type:

| Error                           | Message                            | Hint                                                                                         |
|---------------------------------|------------------------------------|----------------------------------------------------------------------------------------------|
| `NotAllowedError`               | Microphone access denied.          | System Settings → Microphone — enable the browser, then refresh.                            |
| `NotFoundError`                 | No audio input found.              | Confirm the device is connected and recognised by the OS.                                   |
| `NotReadableError` / `AbortError` | Could not open the audio device. | Check Audio MIDI Setup sample rate; verify browser mic permission; replug the cable.        |

**FR-25** The error banner shall clear automatically when the tuner opens successfully after a device switch.

**FR-26** The error banner shall not persist after the user navigates to a different Slopsmith screen.

### 5.9 UI Integration

**FR-27** The plugin shall inject a floating "Tuner" button at the bottom-right of the Slopsmith interface that toggles the tuner panel.

**FR-28** The floating button shall be hidden during active song playback and when the player screen is active. The floating button and player controls button are mutually exclusive: exactly one is visible at any time.

**FR-29** The plugin shall inject a "Tuner" button into the Slopsmith player controls bar when the player screen is active. This replaces the floating button's role on the player screen.

**FR-30** The floating button shall be togglable via a Plugin Manager setting (show/hide globally).

**FR-31** The tuner panel shall close automatically when the user navigates to a different Slopsmith screen.

### 5.10 Configuration Persistence

**FR-32** Plugin settings (last tuning, visualization mode, custom tunings, disabled tunings, floating button visibility) shall be persisted server-side via the Slopsmith plugin config API as a JSON file in the plugin config directory. The "Current Song" selection is ephemeral and shall not be written to `lastTuning`.

**FR-33** The plugin shall expose a config REST API (`GET /api/plugins/tuner/config`, `POST /api/plugins/tuner/config`) that supports partial updates.

**FR-34** If the config fetch at startup fails, the plugin shall continue operating with in-memory defaults (Guitar Standard tuning, Strobe visualization, floating button visible). The failure shall be logged to the console; no user-facing error is shown for this degraded mode.

## 6. Non-Functional Requirements

**NFR-01 Accuracy** — The YIN algorithm shall resolve pitch with sufficient precision to display cents deviation within ±2 cents under normal single-string input at standard sample rates (44,100 or 48,000 Hz).

**NFR-02 Latency** — The detection loop shall fire every 30 ms. Stale pending buffers are discarded each cycle to prevent backlog under sustained load.

**NFR-03 Self-containment** — The plugin shall introduce no external JavaScript library dependencies. All runtime dependencies must be either implemented within the plugin or already provided by Slopsmith (e.g., Tailwind CSS).

**NFR-04 Thread isolation** — No audio processing logic (sample accumulation, YIN computation, buffer management) may execute on the main browser thread. The main thread is reserved for DOM updates only; violating this constraint makes the UI unresponsive under sustained audio load.

**NFR-05 Stability** — The plugin shall not throw unhandled exceptions during normal operation. All error paths (mic access, config fetch, script load) shall be caught and either surfaced via the error banner or logged to the console.

**NFR-06 Visualization module contract** — Each visualization module must expose a factory function registered as `window._tunerViz_<name>(container)` returning an object with `update(note, cents, freq)` and `destroy()` methods. This contract is the only interface between the core plugin and visualization code; compliant modules require no changes to core.

**NFR-07 Themability** — The plugin UI shall use Tailwind CSS utility classes consistent with the active Slopsmith theme. No hardcoded color values outside Tailwind/theme tokens.

## 7. Constraints & Non-Goals

- **No external JS libraries.** The plugin is self-contained; it must not introduce npm/CDN dependencies.
- **Desktop browser only.** Mobile and touch-layout support are not goals.
- **No standalone mode.** The plugin requires Slopsmith's plugin infrastructure to function.
- **No pitch-to-MIDI output.** Real-time MIDI generation or recording is out of scope.
- **No polyphonic detection.** One instrument at a time; chord/multi-pitch detection is out of scope.

## 8. Open Questions

| ID    | Question                                                                                                                              | Owner        | Revisit condition                              |
|-------|---------------------------------------------------------------------------------------------------------------------------------------|--------------|------------------------------------------------|
| OQ-01 | `ScriptProcessorNode` is deprecated in the Web Audio API. Should migration to `AudioWorkletNode` be tracked as a future task?        | OmikronApex  | When browser vendors begin enforcing deprecation |
| OQ-03 | Is there appetite for additional tuning groups (e.g., 7-string guitar, ukulele, 6-string bass)?                                      | OmikronApex  | Community request threshold                    |

> **OQ-02 resolved (2026-05-30):** Default is the canonical default for new installs, matching the backend `config.json`. The `screen.js` initialisation to `"strobe"` is a code bug to be fixed. Logged in `.decision-log.md`.
