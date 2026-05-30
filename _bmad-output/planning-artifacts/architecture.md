---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-slopsmith-plugin-tuner-2026-05-30/prd.md
  - _bmad-output/project-context.md
  - screen.js
  - routes.py
  - workers/yin.js
  - utils/tuning-utils.js
  - visualization/default.js
  - visualization/strobe.js
  - plugin.json
workflowType: architecture
project_name: slopsmith-plugin-tuner
user_name: OmikronApex
date: '2026-05-30'
---

# Architecture Decision Document — Slopsmith Tuner Plugin

_Derived from PRD v2026-05-30, project-context.md, and a full codebase audit of v1.2.5._

---

## 1. Technology Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Plugin manifest | Slopsmith plugin format | `plugin.json`: id, name, version, script, settings.html, routes |
| Frontend runtime | Vanilla JavaScript ES5 IIFE | No bundler, no transpiler, no framework |
| Styling | Tailwind CSS utility classes | Loaded by host app; no PostCSS build step |
| Backend | Python 3 + FastAPI | Routes defined via `setup(app, context)` |
| Audio engine | Web Audio API + Web Worker | `ScriptProcessorNode` + YIN pitch detection |
| Config persistence | Server-side JSON (`tuner.json`) + `localStorage` | Dual-layer; different scopes (see §6) |
| Deployment | Docker (`docker compose restart`) | No build step; plugin dir placed in Slopsmith `plugins/` |

### Constraint: No External JS Libraries (NFR-03)

The plugin must be self-contained. All runtime JS is either implemented in-repo or already provided by Slopsmith (e.g., Tailwind CSS). No npm packages or CDN scripts may be introduced.

---

## 2. Component Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                  Slopsmith Host Page                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │  screen.js  (IIFE — all state, entry point)      │   │
│  │                                                  │   │
│  │  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │  Audio       │  │  UI / Tuning             │  │   │
│  │  │  Pipeline    │  │  State                   │  │   │
│  │  └──────┬───────┘  └──────────────────────────┘  │   │
│  │         │ postMessage (transferable ArrayBuffer)  │   │
│  │  ┌──────▼───────┐  ┌──────────────────────────┐  │   │
│  │  │  yin.js      │  │  visualization/<name>.js  │  │   │
│  │  │  (Worker)    │  │  (lazy-loaded IIFE)       │  │   │
│  │  └──────────────┘  └──────────────────────────┘  │   │
│  │                                                  │   │
│  │  window._tunerUtils  (tuning-utils.js, IIFE)     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  settings.html  (Plugin Manager frame — independent)    │
└─────────────────────────────────────────────────────────┘
         │  HTTP  │
┌────────▼────────▼────────────────────────────────────┐
│  routes.py  (FastAPI, inside Slopsmith backend)       │
│  GET/POST /api/plugins/tuner/config                  │
│  GET /api/plugins/tuner/visualization/{filename}     │
│  GET /api/plugins/tuner/workers/{filename}           │
│  GET /api/plugins/tuner/utils/{filename}             │
└──────────────────────────────────────────────────────┘
```

### Component Table

| Component | File | Role |
|---|---|---|
| Plugin entry point | `screen.js` | IIFE; owns all runtime state, audio pipeline, UI injection, viz management, button lifecycle, Slopsmith event hooks |
| Backend routes | `routes.py` | `setup(app, context)` registers FastAPI routes; config CRUD + static JS file serving |
| YIN worker | `workers/yin.js` | Pitch detection; isolated from main thread; `postMessage` interface only |
| Tuning utilities | `utils/tuning-utils.js` | Frequency math, note names, `offsetsToFreqs`, `getTuningName`; exposed as `window._tunerUtils` |
| Visualization: Default | `visualization/default.js` | Needle/gauge factory; implements viz contract |
| Visualization: Strobe | `visualization/strobe.js` | Strobe phase factory; implements viz contract |
| Settings UI | `settings.html` | Plugin Manager settings page; separate browsing context |
| Plugin manifest | `plugin.json` | Slopsmith plugin descriptor: id, name, version, script, settings.html, routes |

---

## 3. Audio Pipeline Data Flow

```
User Gesture (button click)
        │
        ▼
  enable() in screen.js
        │
        ├── Load tuning-utils.js (if not already loaded)
        ├── loadConfig() → GET /api/plugins/tuner/config
        ├── initUI()
        └── _startAudio()
                │
                ▼
        getUserMedia({ audio: { echoCancellation: false,
                                noiseSuppression: false,
                                autoGainControl: false,
                                channelCount: 2 } })
                │
                ▼
        AudioContext
                │
         sourceNode (MediaStreamSource)
                │
         [optional] ChannelSplitter → ChannelMerger  ← channel routing (mono/left/right)
                │
         GainNode (gain=1.0)
                │
         ScriptProcessorNode (bufferSize=2048, inputs=1, outputs=1)
                │  onaudioprocess: accumulate into accumBuffer
                │  when accumBuffer ≥ 4096 samples → pendingBuffer = latest 4096 samples
                │
         setInterval (30 ms) ──────────────────────────────────────────────────┐
                                                                                │
                                ┌───────────────────────────────────────────────▼──────┐
                                │  if pendingBuffer && !processingFrame                 │
                                │  → yinWorker.postMessage({samples, sampleRate},      │
                                │                           [samples.buffer])           │
                                │    (ArrayBuffer transferred, zero-copy)               │
                                └──────────────────────────────────────────────────────┘
                                                                                │
                                                                  yinWorker.onmessage
                                                                                │
                                                                         { freq, confidence, rms }
                                                                                │
                                                                         updateUI()
                                                                                │
                                                              ┌─────────────────▼──────────────────┐
                                                              │ rms < 0.01 || confidence < 0.5     │
                                                              │   → activeViz.update(null, 0, 0)   │
                                                              │ else                               │
                                                              │   → compute cents deviation        │
                                                              │   → activeViz.update(note,cents,f) │
                                                              │   → _syncActiveStringFromFreq()    │
                                                              └────────────────────────────────────┘
```

### Key Invariants (NFR-02, NFR-04)

- Detection loop fires every **30 ms**; stale `pendingBuffer` is discarded each cycle.
- **No audio processing on main thread** — accumulation happens in `ScriptProcessorNode.onaudioprocess`, YIN runs in the Web Worker. The main thread only handles DOM updates.
- Minimum buffer: **4096 samples** (`_TUNER_MIN_YIN_SAMPLES`). Frames smaller than this are accumulated before dispatch.
- Minimum detectable frequency: **20 Hz** (`_TUNER_MIN_DETECTABLE_HZ`), covering 5-string bass (FR-03, NFR-01).

---

## 4. Global Namespace Strategy

**Rule:** All globals in `screen.js` that escape the IIFE must use the `_tuner` prefix (camelCase) or `_TUNER_` prefix (SCREAMING_SNAKE_CASE for module-level constants).

**Rationale:** The plugin runs inside the Slopsmith host page alongside other plugins. Generic global names (e.g., `utils`, `settings`, `worker`) risk silent collisions with other plugins or the host app. Prefixing is the only viable isolation strategy without ES modules.

| Category | Naming Pattern | Examples |
|---|---|---|
| Public API object | `window.tuner` | `window.tuner.toggle()`, `window.tuner.enable()` |
| Utility namespace | `window._tunerUtils` | `window._tunerUtils.freqToMidi()` |
| Viz factories | `window._tunerViz_<name>` | `window._tunerViz_default`, `window._tunerViz_strobe` |
| Reload hook | `window._tunerReloadConfig` | Called by settings.html after config save |
| Constants | `_TUNER_*` (inside IIFE) | `_TUNER_MIN_YIN_SAMPLES`, `_TUNER_FRAME_SIZE` |
| localStorage key | `slopsmith_tuner_settings` | Device ID and channel preference |

**IIFE-only constraint:** All JS files are served as plain scripts with no bundler. `import`/`export` will break silently or throw. Every file must use the IIFE pattern `(function() { ... })()`.

---

## 5. Visualization Factory Contract (NFR-06)

Every visualization is a factory function registered on `window`:

```
window._tunerViz_<name>(container: HTMLElement) → {
    update(note: string | null, cents: number, freq: number): void,
    destroy(): void
}
```

**Parameters:**
- `note` — note class string (e.g., `"E"`, `"A#"`) or `null` (no signal detected)
- `cents` — deviation from target pitch, range −50…+50 (negative = flat, positive = sharp)
- `freq` — detected frequency in Hz

**Lifecycle:**
1. Factory is called with the `vizContainer` DOM element; it appends its own DOM.
2. `update()` is called on every detection cycle from the main thread.
3. `destroy()` is called before switching to a different visualization or on `disable()`. It **must** remove all DOM nodes and cancel any animation frames or timers.
4. `activeViz` is always null-checked before `update()` is called — viz switches are async.

**Extension pattern:** Drop a `.js` file in `visualization/` and add an option to the settings `<select>`. No changes to core plugin code are needed (FR-16).

**Served via:** `GET /api/plugins/tuner/visualization/{filename}` — path traversal guarded by `.resolve()` + `.relative_to(base_dir)`.

---

## 6. API Contracts

### 6.1 Config API

#### `GET /api/plugins/tuner/config`

Returns the merged config with computed `defaultTunings` injected at read time.

```json
{
  "lastTuning": "Guitar Standard",
  "customTunings": {},
  "disabledTunings": [],
  "showFloatingButton": true,
  "visualizationMode": "default",
  "defaultTunings": {
    "General": { "Free Tune": [] },
    "Guitar": {
      "Guitar Standard": [82.41, 110.00, 146.83, 196.00, 246.94, 329.63],
      ...
    },
    "Bass 4-string": { ... },
    "Bass 5-string": { ... }
  }
}
```

#### `POST /api/plugins/tuner/config`

Accepts **partial updates** — only changed fields need to be sent. Backend merges with existing config.

```json
{ "lastTuning": "Guitar Drop D", "visualizationMode": "strobe" }
```

Response: `{ "ok": true }`

**Critical invariant:** `defaultTunings` is **never written to the config file**. It is computed server-side in `_read()` and injected in `get_config()` only. The `_write()` function strips it before persisting. Writing it would bloat `tuner.json` and cause merge conflicts.

### 6.2 Static File Serving

Three endpoints serve plugin-local JS files, all guarded against path traversal:

```
GET /api/plugins/tuner/visualization/{filename}  → visualization/<filename>
GET /api/plugins/tuner/workers/{filename}         → workers/<filename>
GET /api/plugins/tuner/utils/{filename}           → utils/<filename>
```

**Path traversal guard pattern (all three routes):**
```python
target = (base_dir / filename).resolve()
target.relative_to(base_dir.resolve())  # raises ValueError if outside base_dir
```

Only `.js` files are served; non-JS or missing files return HTTP 404.

---

## 7. Config Persistence Model

### 7.1 Server-side (tuner.json)

Stored in `context["config_dir"] / "tuner.json"`. Persists across container restarts.

| Field | Type | Default | Written by | Notes |
|---|---|---|---|---|
| `lastTuning` | string | `"Guitar Standard"` | `screen.js` (`saveConfig`) | Name of last selected tuning. `"_current"` is ephemeral and never written. |
| `visualizationMode` | string | `"default"` | `screen.js` (`saveConfig`) | Active viz name; canonical default is `"default"` |
| `customTunings` | object | `{}` | `settings.html` | User-defined tunings; merged with built-in at read time |
| `disabledTunings` | array | `[]` | `settings.html` | Names of built-in tunings hidden from selector |
| `showFloatingButton` | bool | `true` | `settings.html` | Whether the floating button is visible |

**Write responsibility split:** `screen.js` (`saveConfig()`) only persists the two fields that change during normal tuner use — `lastTuning` and `visualizationMode`. All other fields (`customTunings`, `disabledTunings`, `showFloatingButton`) are written exclusively by `settings.html` via the Plugin Manager. This is intentional: real-time state is owned by `screen.js`; persistent configuration preferences are owned by the Plugin Manager UI.

`defaultTunings` is computed server-side and **never stored**.

Config reads are fault-tolerant: missing or malformed file returns safe defaults, never crashes.

### 7.2 Client-side (localStorage)

Key: `slopsmith_tuner_settings`

| Field | Type | Notes |
|---|---|---|
| `deviceId` | string | Selected audio input device ID |
| `channel` | `"mono"` \| `"left"` \| `"right"` | Selected channel mode |

Client-side settings persist per browser profile. Stale device IDs are cleared on `OverconstrainedError` or `NotFoundError`.

### 7.3 Dual-layer Rationale

Server-side config survives container restarts and is accessible from both `screen.js` and `settings.html`. Client-side `localStorage` stores device/channel preferences that are browser-specific and not appropriate to persist server-side (they vary by machine/browser combination).

---

## 8. Slopsmith Integration Points

| Integration | API | Contract |
|---|---|---|
| Song tuning detection | `window.highway.getSongInfo()` | Returns `{ tuning: number[], stringCount?: number, arrangement?: string }` |
| Player screen events | `window.slopsmith.on/off('screen:changed', fn)` | `e.detail.id === 'player'` triggers viz/button swap |
| Song play events | `window.slopsmith.on('song:play', fn)` | Hides floating button, disables tuner during playback |
| Song stop events | `window.slopsmith.on('song:pause/song:ended', fn)` | Restores button visibility |
| Song ready event | `window.slopsmith.on('song:ready', fn)` | Re-fetches tuning metadata for "Current Song" option |
| Playing state | `window.slopsmith.isPlaying` | Boolean; polled during button init |
| Config reload hook | `window._tunerReloadConfig()` | Called by `settings.html` after a successful config POST |

**User-gesture requirement (NFR-05):** `AudioContext` must be created inside the `enable()` handler (triggered by button click), never on load. Browser autoplay policy silently fails or throws on pre-gesture audio context creation.

---

## 9. NFR Traceability

| NFR | Constraint | Enforcing Component | Mechanism |
|---|---|---|---|
| NFR-01 | ±2 cents accuracy | `workers/yin.js` | 4096-sample minimum buffer; YIN with parabolic interpolation; threshold 0.15 |
| NFR-02 | 30 ms detection loop; stale buffer discard | `screen.js` (`detectInterval`) | `setInterval(30)` + `pendingBuffer` overwrite pattern; `processingFrame` flag prevents queue buildup |
| NFR-03 | No external JS dependencies | `plugin.json`, `screen.js` | No CDN/npm references; all utilities in-repo; Tailwind provided by host |
| NFR-04 | No audio processing on main thread | `screen.js` + `workers/yin.js` | `ScriptProcessorNode.onaudioprocess` only accumulates; YIN runs in Web Worker via transferable postMessage |
| NFR-05 | No unhandled exceptions | `screen.js` | Try/catch on mic access (`_startAudio`), config fetch (`loadConfig`), script load (`_loadScript`); errors → inline banner or console |
| NFR-06 | Viz factory contract | `visualization/*.js` | Factory pattern: `window._tunerViz_<name>(container)` → `{ update, destroy }` |
| NFR-07 | Tailwind only; no inline styles | `screen.js`, `visualization/*.js` | All DOM styling via `element.className`; no `element.style.*` except viz animation offsets (functional, not cosmetic) |

---

## 10. Open Questions Resolution

### OQ-01: ScriptProcessorNode Migration to AudioWorkletNode

**Status:** Intentionally deferred. `ScriptProcessorNode` is deprecated but functional in all target browsers as of 2026.

**Recommended migration path:**

1. **Scope:** Replace the `ScriptProcessorNode` + accumulation loop in `screen.js` with an `AudioWorkletNode`. The YIN worker (`yin.js`) remains unchanged — it receives the same `{ samples, sampleRate }` message format.

2. **Approach:**
   - Create `workers/tuner-processor.js` as an AudioWorklet processor. It accumulates frames in the worklet's `process()` callback and posts a transferable `Float32Array` to the main thread when ≥4096 samples are ready.
   - In `screen.js`, replace `audioCtx.createScriptProcessor()` with `audioCtx.audioWorklet.addModule('/api/plugins/tuner/workers/tuner-processor.js')` followed by `new AudioWorkletNode(audioCtx, 'tuner-processor')`.
   - Route the worklet's `port.onmessage` to dispatch to `yinWorker` (same as the current `setInterval` pattern).
   - The worklet processor file must be served from the same route handler as other workers (`/api/plugins/tuner/workers/{filename}`).

3. **Risk:** `AudioWorklet` module loading is asynchronous and requires the AudioContext to be in `running` state before `addModule()` completes. Error handling must cover worklet load failure (fallback or clear error to user).

4. **Trigger condition:** Begin migration when browser vendors start enforcing `ScriptProcessorNode` removal (browser console deprecation warnings escalating to hard errors).

### Absence of Automated Test Suite

**Status:** No test framework exists. Manual testing is the current practice.

**Recommended testing strategy:**

| Layer | Framework | What to Test |
|---|---|---|
| Python backend | `pytest` + `httpx` (FastAPI test client) | Config CRUD, `defaultTunings` exclusion from writes, partial update merge, path traversal guard, missing/malformed config defaults |
| JS utilities | `jsdom` + script loader (e.g., `vm.runInContext`) | `tuning-utils.js` pure functions: `freqToMidi`, `midiToNote`, `offsetsToFreqs`, `getTuningName` |
| JS audio pipeline | Manual only (requires mic hardware) | YIN accuracy, accumulation logic, channel routing |
| Visualization | Manual + `jsdom` | Factory contract: `update(null,0,0)` clears state; `destroy()` removes all DOM; no `rAF` leak |

Priority: Python backend tests are highest-value because they protect config invariants (especially the `defaultTunings` write-guard). The YIN worker is a pure function and is easily unit-testable with synthetic buffers once a JS test runner is set up.

---

## 11. Architectural Invariants Summary

The following constraints are non-negotiable. Any implementation change that violates them breaks the plugin's integration with Slopsmith.

| # | Invariant | Why |
|---|---|---|
| 1 | **IIFE only** — no `import`/`export` | Files served as plain scripts; no bundler present |
| 2 | **`_tuner` / `_TUNER_` prefix** on all globals | Host page runs multiple plugins; generic names collide |
| 3 | **No main-thread audio processing** | Violates NFR-04; makes UI unresponsive under load |
| 4 | **ScriptProcessorNode** is intentional | AudioWorklet migration tracked in OQ-01; do not migrate without full pipeline update |
| 5 | **Config partial-update pattern** | POST only changed fields; backend merges |
| 6 | **`defaultTunings` never written** | Computed property; writing it bloats config and causes merge conflicts |
| 7 | **Path traversal guard** on all file-serving routes | Security: `.resolve()` + `.relative_to(base_dir)` |
| 8 | **Viz factory contract**: `window._tunerViz_<name>(container)` → `{ update, destroy }` | Core-viz decoupling; enables extension without touching core |
| 9 | **AudioContext after user gesture** | Browser autoplay policy; violating this causes silent failure |
| 10 | **Null-check `activeViz` before `update()`** | Viz switches are async; calling update after destroy throws |
