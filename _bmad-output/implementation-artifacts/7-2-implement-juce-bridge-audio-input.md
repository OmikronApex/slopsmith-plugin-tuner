# Story 7.2: Implement JUCE Bridge Audio Input

---
baseline_commit: 7b91083d04a57521fb19af0980176d6405f06748
---

Status: review

## Story

As a musician using the Slopsmith Desktop app,
I want the tuner plugin to receive pitch data from the desktop's native JUCE audio engine instead of opening its own browser microphone stream,
so that I get lower-latency, higher-quality tuning that works reliably on all desktop platforms without needing to configure a separate audio device in the browser.

## Acceptance Criteria

> **2026-06-04 — Architecture revised.** The bridge now taps the engine's **raw audio stream** (`getRawAudioFrame(n)`) and runs the tuner's *own* YIN worker over those samples, rather than polling the engine's pre-computed pitch (`getRawPitch`). `getRawPitch` was found to produce a jittery readout and has been removed as a code path entirely. ACs 1, 2, 5 and 9 below reflect the raw-audio architecture; ACs 10–11 cover the pitch-accuracy work that motivated the switch.

1. On startup inside Slopsmith Desktop with the JUCE engine running, the bridge probe passes and the tuner pulls raw audio frames via `getRawAudioFrame(n)` and runs its own YIN Web Worker over them: `getUserMedia` and `ScriptProcessorNode` are **not** called; the YIN Web Worker **is** started (fed from bridge frames instead of a `ScriptProcessorNode`); the tuner displays pitch normally.
2. When `window.slopsmithDesktop.audio.getRawAudioFrame` is absent (downlevel addon without the endpoint), the bridge probe returns `false` and the browser `getUserMedia` + YIN pipeline starts instead; no console warning or error is shown. The engine's `getRawPitch` endpoint is **not** used as a fallback (it produced a jittery readout).
3. When `window.slopsmithDesktop` is absent (plain browser), the bridge probe is skipped entirely; the browser pipeline starts with no errors or console warnings.
4. When `audioInputMode` is `"browser"` in config, the bridge probe is bypassed and the browser pipeline starts regardless of bridge availability.
5. Each bridge poll fetches `getRawAudioFrame(_TUNER_MIN_YIN_SAMPLES)` inside try/catch: a throw is logged at `console.warn` and reported as no-signal for that tick (`{ smoothedFreq: null, rms: 0, hasSignal: false }`); a short/empty frame is skipped; otherwise the frame's `ArrayBuffer` is transferred to the YIN worker, whose result flows through `_handleYinResult` → `_onResult` exactly as on the browser path. The poll honours `_processingFrame` back-pressure so only one frame is in flight at a time. The sample rate is read once via `getSampleRate()` (fallback `48000`) and passed to the worker.
6. When bridge mode is active and the settings panel is open, the Microphone and Input Channel selectors are hidden or disabled (they are irrelevant when the desktop engine owns the device).
7. `settings.html` (Plugin Manager) renders an "Audio Input" toggle row only when `window.slopsmithDesktop?.isDesktop` is true. It reads `config.audioInputMode` on load and writes it back via `save()` when changed. No restart of the running tuner is triggered from this page — the change takes effect next time the tuner panel is opened.
8. `audioInputMode` persists server-side: a `POST /api/plugins/tuner/config` update with `{ audioInputMode: "browser" }` (or `"auto"`) is accepted and survives restart.
9. When `stopAudio()` is called while bridge mode is active, `clearInterval` fires on the bridge poll interval **and** the YIN worker is terminated; `_usingDesktopBridge` resets to `false`; no orphaned interval or worker continues.
10. The YIN worker selects the fundamental via the canonical **absolute-threshold step** — the first local minimum of the cumulative-mean-normalized difference function that drops below the threshold — **not** the global minimum of that function. Sub-octave / sub-harmonic errors (e.g. reporting D1 for a plucked D2, or the common sub-harmonic of a two-note pluck) are rejected at the source. The global minimum is used only as a fallback when no dip crosses the threshold.
11. Auto-mode target selection matches the detected pitch to the nearest tuning string using **octave-aware** (log-2, octave-folded) distance with a smallest-octave-shift tie-break, so a residual octave error still resolves to the correct string and tunings that repeat a pitch class across octaves (e.g. guitar E2/E4) still disambiguate. Displayed cents and frequency are folded into the matched string's octave. A 40-cent hysteresis prevents flicker between adjacent strings; the committed-target state resets on tuning change and on signal loss.

## Tasks / Subtasks

- [x] `routes.py`: add `audioInputMode` to config (AC: 8)
  - [x] Add `"audioInputMode": "auto"` to `defaults` dict in `_read()`
  - [x] Add `res["audioInputMode"] = str(data.get("audioInputMode", "auto"))` in `_read()` parse block
  - [x] Validate: only `"auto"` and `"browser"` are accepted; default to `"auto"` for unknown values
- [x] `screen.js`: add `audioInputMode` to state and pass to audio (AC: 1, 4)
  - [x] Add `audioInputMode: 'auto'` to `_state` initialiser
  - [x] In `loadConfig()`: read `config.audioInputMode` and set `_state.audioInputMode`
  - [x] In `enable()`: pass `audioInputMode: _state.audioInputMode` in the options object to `window._tunerAudio.start()`
  - [x] In `restartAudio()`: pass `audioInputMode: _state.audioInputMode` in the options object to `window._tunerAudio.restart()`
- [x] `utils/audio.js`: implement bridge probe and poll loop (AC: 1, 2, 3, 5, 9)
  - [x] Add `let _usingDesktopBridge = false` and `let _bridgeInterval = null` module-level state
  - [x] Add `_tryBridgeStart(audioInputMode, onResult)` async function
  - [x] In `_doStart(deviceId, channel, audioInputMode)`: call `_tryBridgeStart` first; return early if it succeeds
  - [x] In `_doStop()`: clear `_bridgeInterval`, reset `_usingDesktopBridge`
  - [x] Update `window._tunerAudio.start` and `window._tunerAudio.restart` signatures to pass through `options.audioInputMode`
  - [x] Expose `window._tunerAudio.usingBridge` as a getter returning `_usingDesktopBridge`
- [x] `utils/ui.js`: in-panel settings — hide device/channel when bridge active (AC: 6)
  - [x] Wrap Microphone label+select in `<div class="tuner-mic-section">` and Input Channel label+select in `<div class="tuner-channel-section">`
  - [x] After panel inserted, check `window._tunerAudio?.usingBridge`; if true add `hidden` class to both wrapper divs
- [x] `settings.html`: add audioInputMode toggle (AC: 7, 8)
  - [x] Added `audioInputMode: 'auto'` to config initialiser
  - [x] Toggle row HTML inserted via `insertAdjacentHTML` in inline `<script>`, visible only when `window.slopsmithDesktop?.isDesktop`
  - [x] `window._tunerToggleBrowserAudio()` global handler wired; updates `config.audioInputMode` and calls `save()`
  - [x] After `load()`: `browserAudioToggle.checked` set from `config.audioInputMode === 'browser'`

### Revision — Raw-audio bridge + pitch-accuracy fixes (2026-06-04)

- [x] `utils/audio.js`: migrate the bridge from `getRawPitch` to `getRawAudioFrame` + own YIN (AC: 1, 2, 5, 9)
  - [x] Probe `desktop.audio.getRawAudioFrame`; return `false` (→ browser pipeline) when absent
  - [x] Remove the `getRawPitch` poll path entirely (jittery readout)
  - [x] Read the bridge sample rate once via `getSampleRate()` (fallback `48000`) for the worker
  - [x] Start the YIN worker in bridge mode; poll `getRawAudioFrame(_TUNER_MIN_YIN_SAMPLES)` at 30 ms with `_processingFrame` back-pressure; transfer the buffer; skip short/empty frames
  - [x] `_doStop()` terminates the YIN worker on bridge teardown (interval already cleared)
- [x] `workers/yin.js`: fix sub-harmonic / octave errors at the root (AC: 10)
  - [x] Replace global-minimum candidate selection with the canonical absolute-threshold step (first local minimum below threshold, descended to its bottom)
  - [x] Retain the global minimum only as a fallback when nothing crosses the threshold
  - [x] Remove the fragile single-step undertone-guard heuristic (now structurally unnecessary)
- [x] `utils/ui.js`: octave-aware auto-target matching (AC: 11)
  - [x] Add `_matchString()` — octave-folded nearest-string match with smallest-octave-shift tie-break
  - [x] Add `_foldToOctaveOf()`; compute cents and the displayed frequency from the octave-corrected reading
  - [x] Apply a 40-cent hysteresis to the committed target; reset on tuning change (`_lastTuningRef`) and on signal loss

## Dev Notes

### Architecture: Where Each Concern Lives

| Concern | File | Why |
|---|---|---|
| Bridge probe + poll loop | `utils/audio.js` | Owns all audio lifecycle; `screen.js` should not touch Web Audio or IPC directly |
| `audioInputMode` state + config load | `screen.js` | Owns server config; passes mode as option to audio |
| In-panel selector hide (bridge active) | `utils/ui.js` | Owns the in-panel settings DOM |
| Persistent override toggle | `settings.html` | Plugin Manager settings page — the right place for durable user preferences |
| Config persistence field | `routes.py` | Owns `tuner.json` read/write |

### ⚠️ Implementation Update (2026-06-04) — Raw audio stream + own YIN

The sections below from the original design describe a `getRawPitch` poll loop. That approach shipped first but produced a **jittery readout**, so the bridge was reworked. The narrative below is retained for history; **this subsection is authoritative** where they conflict.

**What changed**

- **Tap the raw audio, not the pitch.** The bridge now calls `desktop.audio.getRawAudioFrame(n)` (IPC channel `audio:getRawAudioFrame`, added in slopsmith-desktop PR #282). It returns the most-recent `n` post-noise-gate mono samples as a `Float32Array` (default 4096, clamped to the engine's ring capacity; empty `Float32Array(0)` on a downlevel addon). We pull `_TUNER_MIN_YIN_SAMPLES` (4096) per poll.
- **Run our own YIN.** In bridge mode the tuner now starts the same `workers/yin.js` worker as the browser path and transfers each frame to it, so detection is identical regardless of source and benefits from the tuning-optimised YIN. The result flows through `_handleYinResult` → `_onResult` (the bridge no longer short-circuits `_handleYinResult` with an `rms: 1.0` sentinel).
- **`getRawPitch` removed.** It is no longer probed or polled. If `getRawAudioFrame` is missing, `_tryBridgeStart` returns `false` and we fall back to `getUserMedia` + YIN.
- **Sample rate** is read once via `getSampleRate()` (fallback `48000`, the engine's native rate) and passed to the worker per frame.
- **Back-pressure & teardown.** The 30 ms poll skips a tick while `_processingFrame` is true and skips short/empty frames; `_doStop()` terminates the worker as well as clearing the interval.

**Probe (current):**

```js
if (typeof desktop.audio.getRawAudioFrame !== 'function') return false; // → getUserMedia fallback
```

**Poll loop (current):**

```js
_yinWorker = new Worker('/api/plugins/tuner/workers/yin.js');
_yinWorker.onmessage = (e) => { _handleYinResult(e.data); _processingFrame = false; };
_bridgeInterval = setInterval(async function() {
    if (_processingFrame || !_yinWorker) return;
    try {
        var samples = await desktop.audio.getRawAudioFrame(_TUNER_MIN_YIN_SAMPLES);
        if (!samples || samples.length < _TUNER_MIN_YIN_SAMPLES) return;
        _processingFrame = true;
        _yinWorker.postMessage({ samples: samples, sampleRate: bridgeSampleRate }, [samples.buffer]);
    } catch (e) {
        console.warn('[tuner] bridge raw audio poll failed:', e && e.message ? e.message : e);
        if (_onResult) _onResult({ smoothedFreq: null, rms: 0, hasSignal: false });
    }
}, 30);
```

**Window-size note for the engine team:** our YIN consumes a 4096-sample window. At 48 kHz that is ~85 ms (~3 periods of low B ≈ 31 Hz), so the engine-side ring should be ≥ 16384 to give overlap headroom for 5-string bass / drop tunings. `getRawAudioFrame(n)` taking a caller-supplied `n` (default 4096) covers this.

### Pitch accuracy — sub-harmonic + octave fixes (2026-06-04)

Switching to our own YIN surfaced (and then let us fix) two long-standing octave bugs that made auto-mode target the wrong string — e.g. plucking D2 targeted the E string because the detector reported **D1**, and a simultaneous D+G pluck reported **G0**.

1. **Root cause in `workers/yin.js`:** the worker started from the **global minimum** of the difference function and tried to correct downward. For any periodic signal the function dips at the true period `T` *and* equally/​more deeply at `2T`, `3T`…, so the global minimum frequently landed an octave (or more) low. The single-step undertone guard couldn't recover reliably. **Fix:** canonical YIN absolute-threshold selection — walk `tau` upward and take the **first** local minimum below the threshold (the fundamental is the *smallest* satisfying period; sub-octaves live at larger `tau`). Global minimum kept only as a no-threshold-crossing fallback. This also fixes free-tune mode, which has no target strings for a UI-layer correction to lean on.

2. **Defense-in-depth in `utils/ui.js`:** auto-mode nearest-string selection is now **octave-aware**. `_matchString()` folds the detected frequency into each candidate string's octave before measuring cents distance, with a smallest-octave-shift tie-break (so E2 vs E4 still disambiguates by the octave actually played). `_foldToOctaveOf()` then expresses cents and the displayed frequency in the matched string's octave. A 40-cent hysteresis on the committed target prevents flicker between adjacent strings; the committed state resets on tuning change and signal loss. This is standard practice for a known-strings tuner and is harmless even with the YIN fix in place.

### The Bridge Detection Data Flow

> **Superseded (see Implementation Update above).** The `getRawPitch` flow described here was the first implementation and has been removed. Kept for historical context.

`window.slopsmithDesktop` is injected by the Electron preload script (`src/main/preload.ts` in slopsmith-desktop). It is undefined in a plain browser. The Electron IPC bridge (`src/main/audio-bridge.ts`) handles the `audio:getRawPitch` IPC channel and always returns the raw YIN result — bypassing the ML detector — serialized as:

```js
{
  frequency: float,   // Hz, -1.0 if no pitch or noise gate closed
  confidence: float,  // 0-1
  midiNote: int,      // nearest MIDI note, -1 if none
  cents: float,       // real deviation from nearest semitone in cents (sub-Hz, never ML-quantized)
  noteName: string,   // e.g. "A4", "E2" (includes octave — NOT used by the tuner)
}
```

`getRawPitch` is always available when the desktop engine is running, regardless of whether a Basic Pitch ML model is loaded. It reads the post-noise-gate signal at ~100 Hz detection rate (decimated to 8 kHz internally); `frequency = -1` when the gate is closed. If the addon pre-dates this endpoint (`getRawPitch` absent), the probe returns `false` and the browser YIN pipeline starts as fallback.

### Bridge Result → `updateUI` Integration

`updateUI` in `ui.js` receives `{ smoothedFreq, rms, hasSignal }` and derives `note` and `cents` from `smoothedFreq` using `_tunerUtils.freqToMidi` and `_tunerUtils.midiToNote`. This is the correct path even for the bridge: the UI computes cents relative to `targetFreq` (the currently selected string), not relative to the nearest semitone. The native `cents` field in the Detection struct is relative to nearest semitone and is intentionally NOT passed through — let the existing UI logic handle it.

Bridge result → `_onResult` mapping:
```js
// Signal detected:
_onResult({ smoothedFreq: p.frequency, rms: 1.0, hasSignal: true });

// No signal (midiNote < 0 or frequency <= 0 or confidence < 0.15):
_onResult({ smoothedFreq: null, rms: 0, hasSignal: false });
```

`rms: 1.0` is a sentinel — the bridge path bypasses the `rms > 0.01` gate in `_handleYinResult` (which is only called on the YIN worker path). We call `_onResult` directly.

### `utils/audio.js` — Bridge Implementation

Add these module-level vars alongside the existing ones:

```js
let _usingDesktopBridge = false;
let _bridgeInterval = null;
```

Add the bridge probe + poll function:

```js
async function _tryBridgeStart(audioInputMode, onResult) {
    if (audioInputMode === 'browser') return false;
    var desktop = (typeof window !== 'undefined') ? window.slopsmithDesktop : null;
    if (!desktop || !desktop.isDesktop || !desktop.audio
        || typeof desktop.audio.getRawPitch !== 'function'
        || typeof desktop.audio.isAvailable !== 'function') return false;

    var available = false;
    try { available = await desktop.audio.isAvailable(); } catch (_) {}
    if (!available) return false;

    // Start engine if not running
    try {
        var running = typeof desktop.audio.isAudioRunning === 'function'
            ? await desktop.audio.isAudioRunning() : false;
        if (!running && typeof desktop.audio.startAudio === 'function') {
            await desktop.audio.startAudio();
        }
    } catch (_) {}

    _usingDesktopBridge = true;
    console.log('[tuner] using desktop JUCE bridge for audio input');

    _bridgeInterval = setInterval(async function() {
        try {
            var p = await desktop.audio.getRawPitch();
            if (p && p.midiNote >= 0 && p.frequency > 0 && p.confidence >= 0.15) {
                if (onResult) onResult({ smoothedFreq: p.frequency, rms: 1.0, hasSignal: true });
            } else {
                if (onResult) onResult({ smoothedFreq: null, rms: 0, hasSignal: false });
            }
        } catch (e) {
            console.warn('[tuner] bridge poll failed:', e && e.message ? e.message : e);
            if (onResult) onResult({ smoothedFreq: null, rms: 0, hasSignal: false });
        }
    }, 30);

    return true;
}
```

Update `_doStart` signature and add bridge branch at the top:

```js
async function _doStart(deviceId, channel, audioInputMode) {
    // Try desktop bridge first
    var bridgeStarted = await _tryBridgeStart(audioInputMode, _onResult);
    if (bridgeStarted) return;

    // ... existing getUserMedia / ScriptProcessor / YIN Worker code unchanged ...
}
```

Update `_doStop` to clean up bridge state:

```js
function _doStop() {
    if (_bridgeInterval) { clearInterval(_bridgeInterval); _bridgeInterval = null; }
    _usingDesktopBridge = false;
    // ... existing teardown unchanged ...
}
```

Update the public API to pass `audioInputMode` through:

```js
window._tunerAudio = {
    start: async function(options, onResult) {
        _onResult = onResult;
        await _doStart(options.deviceId, options.channel, options.audioInputMode || 'auto');
    },
    stop: function() {
        _onResult = null;
        _doStop();
    },
    restart: async function(options) {
        _doStop();
        await _doStart(options.deviceId, options.channel, options.audioInputMode || 'auto');
    },
    get usingBridge() { return _usingDesktopBridge; },
};
```

### `utils/ui.js` — Hide Device/Channel Selectors When Bridge Active

The in-panel settings panel HTML template (built in `innerHTML` around line 297) currently lays out labels and selects flat. To allow reliable hiding, wrap the two sections in named divs:

```js
// Inside the innerHTML template string — wrap Microphone section:
`<div class="tuner-mic-section">
    <label class="block text-gray-500 mb-1">Microphone</label>
    <select class="tuner-device-select ...">...</select>
</div>
<div class="tuner-channel-section">
    <label class="block text-gray-500 mb-1">Input Channel</label>
    <select class="tuner-channel-select ...">...</select>
</div>`
```

After the panel is inserted and wired (after `populateDevices(panel)`), add:

```js
if (window._tunerAudio && window._tunerAudio.usingBridge) {
    var micSec = panel.querySelector('.tuner-mic-section');
    var chanSec = panel.querySelector('.tuner-channel-section');
    if (micSec) micSec.classList.add('hidden');
    if (chanSec) chanSec.classList.add('hidden');
}
```

No `audioInputMode` toggle in `ui.js` — that lives in `settings.html` only.

### `settings.html` — Audio Input Toggle

`settings.html` is a self-contained HTML fragment loaded by Slopsmith's Plugin Manager. It has its own IIFE with a `config` local and `load()` / `save()` / `render()` functions. The Floating Button toggle at line 8 is the exact pattern to follow.

**Step 1 — Extend `config` initialiser** (line 64):

```js
let config = { customTunings: {}, disabledTunings: [], defaultTunings: {}, showFloatingButton: true, audioInputMode: 'auto' };
```

**Step 2 — Populate toggle state after `load()`** (after the `floatingToggle.checked` line ~89):

```js
const inputModeToggle = document.getElementById('tuner-force-browser-audio');
if (inputModeToggle) inputModeToggle.checked = config.audioInputMode === 'browser';
```

**Step 3 — Add global handler** (alongside `window._tunerToggleFloating`):

```js
window._tunerToggleBrowserAudio = (forceBrowser) => {
    config.audioInputMode = forceBrowser ? 'browser' : 'auto';
    save();
};
```

**Step 4 — Add the toggle row HTML** in the `<div class="space-y-6 py-2">` container, directly below the Floating Button toggle block (lines 2–11). Only render it when `window.slopsmithDesktop?.isDesktop`:

```html
<!-- Inserted below the Floating Button toggle block, before the Tuning Visibility section -->
<script>
if (window.slopsmithDesktop && window.slopsmithDesktop.isDesktop) {
    document.currentScript.insertAdjacentHTML('beforebegin', `
    <div class="flex items-center justify-between bg-dark-900/50 p-3 rounded-xl border border-gray-800/50">
        <div>
            <h3 class="text-sm font-medium text-gray-200">Force Browser Audio</h3>
            <p class="text-[11px] text-gray-500">Use the browser microphone pipeline instead of the desktop audio engine.</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="tuner-force-browser-audio" class="sr-only peer" onchange="window._tunerToggleBrowserAudio(this.checked)">
            <div class="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
        </label>
    </div>`);
}
</script>
```

The toggle Tailwind classes are copied verbatim from the Floating Button toggle for visual consistency.

**Note on timing**: `settings.html` is the Plugin Manager page, separate from the live tuner panel. Changing this toggle does NOT restart the currently-running audio pipeline — the change takes effect next time the user opens the tuner panel. This is correct and expected; no `window._tunerReloadConfig()` call is needed here (that function reloads tuning/visualization config, not audio mode).

### `routes.py` — `audioInputMode` Config Field

In `_read()`, add to `defaults`:
```python
"audioInputMode": "auto",
```

In the parse block:
```python
raw_mode = str(data.get("audioInputMode", "auto"))
res["audioInputMode"] = raw_mode if raw_mode in ("auto", "browser") else "auto"
```

No change to `_write()` — partial updates already work; the key is just allowed through.

### What Must NOT Change

- ~~The `_TUNER_MIN_YIN_SAMPLES`, `_TUNER_FRAME_SIZE`, `_octaveFold`, `_median`, `_handleYinResult` logic — untouched; the bridge path bypasses `_handleYinResult` entirely by calling `_onResult` directly.~~ **Superseded (2026-06-04):** the bridge path now feeds the YIN worker and therefore *does* run through `_handleYinResult` like the browser path. `_octaveFold`/`_median`/`_TUNER_MIN_YIN_SAMPLES` are unchanged; the worker's *candidate-selection* internals were rewritten (see "Pitch accuracy" above).
- All existing error handling in `_doStart` (OverconstrainedError, NotFoundError fallbacks) — the bridge branch returns early if successful; all that code is reached only when `_tryBridgeStart` returns `false`.
- `updateUI` in `ui.js` — no changes; it consumes `{ smoothedFreq, rms, hasSignal }` identically regardless of source.
- `screen.js` audio error handling — `enable()` and `restartAudio()` catch blocks remain unchanged; if `_doStart` throws (browser pipeline error), the same `disable()` + `showMicError(e)` flow runs.

### Manual Verification

**Bridge path (requires Slopsmith Desktop + YIN mode):**
1. Open tuner; check `console.log`: should show `"[tuner] using desktop JUCE bridge for audio input"`
2. Confirm no `getUserMedia` permission prompt appears
3. Play a note — pitch, note name, and cents display correctly
4. Open in-panel settings gear: Microphone and Input Channel sections are hidden
5. Open Plugin Manager → Tuner settings: "Force Browser Audio" toggle is visible and unchecked
6. Check "Force Browser Audio" → close Plugin Manager → reopen tuner panel → audio restarts with browser pipeline; Microphone + Channel selectors now visible in panel settings

**Browser path:**
7. Open in a plain browser (no Electron) — no bridge probe, no errors, normal mic flow; Plugin Manager settings show NO "Force Browser Audio" toggle

**No-signal / poll failure:**
8. Mute input in desktop engine → tuner shows no pitch; no errors beyond `console.warn` for failed polls

### References

- `utils/audio.js` — full file read before editing; bridge branches added alongside existing patterns
- `utils/ui.js` lines 295–361 — settings panel HTML template and wiring; `updateUI` function lines 231–259
- `screen.js` lines 10–33 (`_state`), 147–181 (`loadConfig`), 204–213 (`restartAudio`), 215–267 (`enable`)
- `routes.py` lines 64–108 (`_read`) — add `audioInputMode` field
- slopsmith-desktop `src/audio/PitchDetector.h` — `Detection` struct (`frequency`, `confidence`, `midiNote`, `cents`)
- slopsmith-desktop `src/main/audio-bridge.ts` lines 459–472 — `audio:getRawPitch` IPC handler; typeof-guarded for downlevel addons; returns `{ frequency, confidence, midiNote, cents, noteName }`
- slopsmith-desktop `src/audio/AudioEngine.cpp` lines 2122–2133 — `getRawPitchDetection()`: always returns raw YIN result, bypasses ML preference
- slopsmith-desktop `src/main/preload.ts` lines 225–228 — `window.slopsmithDesktop.audio.getRawPitch` renderer exposure
- `tmp/slopsmith-plugin-notedetect/screen.js` lines 1872–2072 — reference bridge probe pattern (note-detect uses `setInterval` at 50ms; tuner uses 30ms to match existing YIN cadence)
- `settings.html` lines 2–11 (Floating Button toggle HTML) and lines 95–108 (`_tunerToggleFloating` + `save()`) — exact pattern to replicate for the "Force Browser Audio" toggle
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7, Story 7.2]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `routes.py`: added `audioInputMode` to defaults and parse block with `"auto"`/`"browser"` validation
- `screen.js`: added `audioInputMode: 'auto'` to `_state`; read from config in `loadConfig()`; passed as option to `start()` and `restart()`
- `utils/audio.js`: added `_usingDesktopBridge` and `_bridgeInterval` state; added `_tryBridgeStart()` with three-condition probe (isDesktop, `getRawPitch` present, isAvailable); no ML gate — `getRawPitch` always returns YIN regardless; bridge poll at 30ms using `getRawPitch()`; downlevel addon without `getRawPitch` falls through to browser YIN; `_doStop()` clears bridge interval and resets flag; public API updated with `audioInputMode` passthrough and `usingBridge` getter
- `utils/ui.js`: Microphone and Input Channel sections wrapped in `tuner-mic-section` / `tuner-channel-section` divs; hidden when `window._tunerAudio.usingBridge` is true at panel render time
- `settings.html`: "Force Browser Audio" toggle row rendered via `insertAdjacentHTML` only when `window.slopsmithDesktop?.isDesktop`; `_tunerToggleBrowserAudio()` global handler; toggle state populated from `config.audioInputMode` on load

**Revision (2026-06-04) — raw-audio bridge + pitch-accuracy:**

- `utils/audio.js`: reworked `_tryBridgeStart()` to tap `getRawAudioFrame(n)` and run the tuner's own YIN worker over the frames instead of polling `getRawPitch`. Probe is now `typeof desktop.audio.getRawAudioFrame === 'function'`; missing → return `false` → `getUserMedia` fallback. `getRawPitch` path removed entirely (jittery). Sample rate read once via `getSampleRate()` (fallback 48000). 30 ms poll with `_processingFrame` back-pressure, transferable buffer, short/empty frame skip; `_doStop()` terminates the worker on teardown. Also hardened the probe so a build exposing neither tap method falls back to `getUserMedia` rather than polling a missing method forever.
- `workers/yin.js`: replaced global-minimum-of-the-difference-function candidate selection with canonical YIN absolute-threshold selection (first local minimum below threshold), with global minimum kept only as a no-crossing fallback. Removed the single-step undertone-guard heuristic. Root-cause fix for octave-low / sub-harmonic detections (D1-for-D2, G0 on a D+G pluck); also corrects free-tune mode.
- `utils/ui.js`: auto-mode target selection made octave-aware via `_matchString()` (octave-folded nearest-string with smallest-shift tie-break) and `_foldToOctaveOf()` (cents + displayed freq folded into the matched octave). Added 40-cent target hysteresis with reset on tuning change / signal loss. Earlier raw-Hz nearest-note comparison replaced with log-2 distance.

### File List

- `utils/audio.js`
- `utils/ui.js`
- `workers/yin.js`
- `screen.js`
- `settings.html`
- `routes.py`
- `_bmad-output/implementation-artifacts/7-2-implement-juce-bridge-audio-input.md`

### Change Log

- 2026-06-03: Story 7.2 complete — JUCE bridge probe, poll loop, audioInputMode config field, in-panel selector hide, settings.html Force Browser Audio toggle
- 2026-06-03: Updated bridge to use `getRawPitch` (always-available YIN, ML-independent) instead of `getPitchDetection`; removed `isMlNoteDetection` gate; downlevel addon without `getRawPitch` falls back to browser YIN pipeline
- 2026-06-04: Reworked bridge to tap the raw audio stream via `getRawAudioFrame(n)` (slopsmith-desktop PR #282) and run the tuner's own YIN worker over the frames; **removed the `getRawPitch` code path entirely** (jittery readout). Probe now requires `getRawAudioFrame`; otherwise falls back to `getUserMedia` + YIN. ACs 1/2/5/9 revised accordingly.
- 2026-06-04: Fixed octave-low / sub-harmonic pitch errors at the root in `workers/yin.js` (canonical absolute-threshold candidate selection instead of global minimum). Added octave-aware nearest-string matching, octave-folded cents/frequency display, and 40-cent target hysteresis in `utils/ui.js`. Added ACs 10–11.
