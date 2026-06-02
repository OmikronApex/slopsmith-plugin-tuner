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

1. On startup inside Slopsmith Desktop with the JUCE engine running in YIN mode, the bridge probe passes and the tuner uses the bridge: `getUserMedia` and `ScriptProcessorNode` are not called; the YIN Web Worker is not started; the tuner displays pitch normally.
2. When `isMlNoteDetection()` returns `true`, bridge mode is NOT activated; the browser pipeline starts instead; `console.log` notes `"[tuner] bridge skipped — ML detector active, using browser pipeline"`.
3. When `window.slopsmithDesktop` is absent (plain browser), the bridge probe is skipped entirely; the browser pipeline starts with no errors or console warnings.
4. When `audioInputMode` is `"browser"` in config, the bridge probe is bypassed and the browser pipeline starts regardless of bridge availability.
5. Each bridge IPC poll wraps `getPitchDetection()` in try/catch; a throw or `midiNote < 0` / `frequency <= 0` is treated as no-signal for that tick (`updateUI` receives `{ smoothedFreq: null, rms: 0, hasSignal: false }`); the error is logged at `console.warn` level; the interval continues.
6. When bridge mode is active and the settings panel is open, the Microphone and Input Channel selectors are hidden or disabled (they are irrelevant when the desktop engine owns the device).
7. `settings.html` (Plugin Manager) renders an "Audio Input" toggle row only when `window.slopsmithDesktop?.isDesktop` is true. It reads `config.audioInputMode` on load and writes it back via `save()` when changed. No restart of the running tuner is triggered from this page — the change takes effect next time the tuner panel is opened.
8. `audioInputMode` persists server-side: a `POST /api/plugins/tuner/config` update with `{ audioInputMode: "browser" }` (or `"auto"`) is accepted and survives restart.
9. When `stopAudio()` is called while bridge mode is active, `clearInterval` fires on the bridge poll interval; `_usingDesktopBridge` resets to `false`; no orphaned interval continues.

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

## Dev Notes

### Architecture: Where Each Concern Lives

| Concern | File | Why |
|---|---|---|
| Bridge probe + poll loop | `utils/audio.js` | Owns all audio lifecycle; `screen.js` should not touch Web Audio or IPC directly |
| `audioInputMode` state + config load | `screen.js` | Owns server config; passes mode as option to audio |
| In-panel selector hide (bridge active) | `utils/ui.js` | Owns the in-panel settings DOM |
| Persistent override toggle | `settings.html` | Plugin Manager settings page — the right place for durable user preferences |
| Config persistence field | `routes.py` | Owns `tuner.json` read/write |

### The Bridge Detection Data Flow

`window.slopsmithDesktop` is injected by the Electron preload script (`src/main/preload.ts` in slopsmith-desktop). It is undefined in a plain browser. The Electron IPC bridge (`src/main/audio-bridge.ts`) handles the `audio:getPitchDetection` IPC channel and returns a `PitchDetector::Detection` struct serialized as:

```js
{
  frequency: float,   // Hz, -1.0 if no pitch
  confidence: float,  // 0-1
  midiNote: int,      // nearest MIDI note, -1 if none
  cents: float,       // deviation from nearest semitone in cents (YIN path only; 0.0 on ML path)
  noteName: string,   // e.g. "A4", "E2" (includes octave — NOT used by the tuner)
}
```

**Critical**: `cents` is `0.0` hardcoded when ML is active (AudioEngine.cpp line 2087). The fourth probe condition `isMlNoteDetection() === false` prevents activating bridge mode in this case. If ML activates mid-session (not currently possible — it is session-fixed), `frequency` from `getPitchDetection()` would still be discrete-semitone-only anyway.

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
        || typeof desktop.audio.getPitchDetection !== 'function'
        || typeof desktop.audio.isAvailable !== 'function') return false;

    var available = false;
    try { available = await desktop.audio.isAvailable(); } catch (_) {}
    if (!available) return false;

    var mlActive = false;
    try {
        if (typeof desktop.audio.isMlNoteDetection === 'function') {
            mlActive = (await desktop.audio.isMlNoteDetection()) === true;
        }
    } catch (_) {}
    if (mlActive) {
        console.log('[tuner] bridge skipped — ML detector active, using browser pipeline');
        return false;
    }

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
            var p = await desktop.audio.getPitchDetection();
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

- The `_TUNER_MIN_YIN_SAMPLES`, `_TUNER_FRAME_SIZE`, `_octaveFold`, `_median`, `_handleYinResult` logic — untouched; the bridge path bypasses `_handleYinResult` entirely by calling `_onResult` directly.
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
- slopsmith-desktop `src/main/audio-bridge.ts` lines 455–457 — IPC handler returns `{ frequency, confidence, midiNote, cents, noteName }`
- slopsmith-desktop `src/audio/AudioEngine.cpp` lines 2067–2092 — `getActiveDetection()`: ML path hardcodes `cents = 0.0`; YIN path returns real cents
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
- `utils/audio.js`: added `_usingDesktopBridge` and `_bridgeInterval` state; added `_tryBridgeStart()` with four-condition probe (isDesktop, getPitchDetection present, isAvailable, !isMlNoteDetection); bridge poll at 30ms using `p.frequency` as `smoothedFreq`; `_doStop()` clears bridge interval and resets flag; public API updated with `audioInputMode` passthrough and `usingBridge` getter
- `utils/ui.js`: Microphone and Input Channel sections wrapped in `tuner-mic-section` / `tuner-channel-section` divs; hidden when `window._tunerAudio.usingBridge` is true at panel render time
- `settings.html`: "Force Browser Audio" toggle row rendered via `insertAdjacentHTML` only when `window.slopsmithDesktop?.isDesktop`; `_tunerToggleBrowserAudio()` global handler; toggle state populated from `config.audioInputMode` on load

### File List

- `utils/audio.js`
- `utils/ui.js`
- `screen.js`
- `settings.html`
- `routes.py`
- `_bmad-output/implementation-artifacts/7-2-implement-juce-bridge-audio-input.md`

### Change Log

- 2026-06-03: Story 7.2 complete — JUCE bridge probe, poll loop, audioInputMode config field, in-panel selector hide, settings.html Force Browser Audio toggle
