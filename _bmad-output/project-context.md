---
project_name: 'slopsmith-plugin-tuner'
user_name: 'OmikronApex'
date: '2026-05-30'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 37
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Plugin format**: Slopsmith plugin manifest (`plugin.json`) — fields: `id`, `name`, `version`, `script`, `settings.html`, `routes`
- **Frontend**: Vanilla JavaScript (ES5 IIFE pattern) — no bundler, no transpiler, no framework
- **Styling**: Tailwind CSS utility classes applied via DOM manipulation (no PostCSS build step — Tailwind is loaded by the host app)
- **Backend**: Python 3 + FastAPI — plugin routes defined in `routes.py` via `setup(app: FastAPI, context: dict)`
- **Audio**: Web Audio API + Web Workers (YIN pitch detection algorithm)
- **Persistence**: Server-side JSON file (`tuner.json` in `context["config_dir"]`) + client-side `localStorage` key `slopsmith_tuner_settings`
- **Plugin version**: 1.2.5

## Critical Implementation Rules

### Critical Don't-Miss Rules

- **Never use ES modules** — `import`/`export` will break because files are served as plain scripts with no bundler; always use IIFEs and `window.*` globals
- **Never write `defaultTunings` to the config file** — it is always computed server-side and injected at read time; writing it would bloat the config and cause merge conflicts
- **Never skip the path traversal guard** when serving user-supplied filenames — always `.resolve()` + `.relative_to(base_dir)` before reading files
- **Never start audio without user gesture** — `AudioContext` must be created or resumed inside a user interaction handler (browser autoplay policy); attempting it on load will silently fail or throw
- **Never assume mic access** — always handle `NotAllowedError`, `NotFoundError`, and `OverconstrainedError` from `getUserMedia`; the Real Tone Cable (USB guitar interface) requires specific error handling
- **Never call `activeViz.update()` after `destroy()`** — always null-check `activeViz` before calling update; viz switches are async
- **Config POST accepts partial updates** — when writing new config keys, only send the changed fields; the backend merges with existing config, so sending a full object is safe but sending only a subset is the intended pattern
- **Global scope pollution risk** — this plugin runs inside the Slopsmith host page alongside other plugins; never use generic global names (e.g., `utils`, `settings`, `worker`); always prefix with `_tuner`

### Development Workflow Rules

- **Branch naming** (from git history): `fix/<kebab-description>` for bug fixes (e.g., `fix/mic-error-handling-real-tone-cable`)
- **Commit message format**: `<type>: <description> (<version>)` — e.g., `fix: improve mic error handling and Real Tone Cable support (1.2.5)`; types used: `fix`, `feat`, `refactor`
- **Version bump**: update `plugin.json` `version` field with each release; version is referenced in commit messages and PR titles
- **Deployment**: plugin is deployed by placing the repo in Slopsmith `plugins/` and restarting Docker (`docker compose restart`) — no build step required
- **PR workflow**: features/fixes go through PRs to `main`; merge commits are used (not squash)
- **No CI/CD pipeline** configured — testing is manual before merging
- **GitHub Issues**: every epic gets a GitHub Issue; every story gets a GitHub sub-task Issue with the epic issue as its parent (using GitHub's sub-issue linking)
- **Branch per epic**: one feature branch is created per epic, named after the epic's GitHub Issue number and description (e.g., `feat/42-strobe-visualization`); all story commits for that epic land on this branch

### Code Quality & Style Rules

- **No linter or formatter is configured** — no `.eslintrc`, `.prettierrc`, or `pyproject.toml` found; follow existing patterns visually
- **JS file naming**: kebab-case (e.g., `tuning-utils.js`, `default.js`)
- **JS internal naming**: camelCase for variables/functions, `_prefixed` for private/internal symbols, `_SCREAMING_SNAKE_CASE` for module-level constants
- **Python naming**: snake_case throughout; inner functions prefixed with `_` (e.g., `_read`, `_write`, `_serve_js_from`)
- **Comments**: used sparingly — only for section headers (using `── Section ──` style in JS) and non-obvious contracts (e.g., viz factory interface docs)
- **No multi-line docstrings** in Python routes — keep handlers concise; the route decorator is the documentation
- **Tailwind classes only** for styling — never write inline `style=""` attributes or separate CSS files; classes are applied directly in JS via `element.className`
- **No external JS dependencies** — do not introduce npm packages or CDN scripts; everything must work with what the host app provides

### Testing Rules

- **No automated test suite exists** — there is no test runner, test framework, or coverage requirement configured
- Manual testing is done by running Slopsmith locally (via Docker) and loading the plugin
- When adding tests in the future: Python backend should use `pytest`; JS has no bundler so any test runner would need to handle raw IIFE scripts (e.g., jsdom + a script loader)
- Critical paths to manually verify after any change:
  - Mic access granted → YIN worker starts → pitch displays in the active visualization
  - Config POST (partial update) → persisted to `tuner.json` → survives restart
  - Viz switch → `destroy()` called on old viz → new viz factory invoked cleanly
  - Settings page → custom tuning saved → appears in frontend dropdown

### Plugin Integration Rules (Slopsmith)

- The plugin's entry point (`screen.js`) is injected into the host page — all code runs in the **host page's global scope**; prefix all globals with `_tuner` or `_TUNER_` to avoid collisions
- Plugin API routes are served under `/api/plugins/tuner/` — always use this prefix for `fetch` calls from the frontend
- The plugin receives a `context` dict in `setup()` with at least `config_dir` — do not assume any other keys without verifying the Slopsmith plugin API docs
- Settings UI lives in `settings.html` and is loaded separately by the plugin manager — it communicates with the backend via the same `/api/plugins/tuner/config` endpoint

### Visualization Extension Rules

- Every visualization is a **factory function** assigned to `window._tunerViz_<name>` — the function receives a `container` DOM element and returns `{ update(note, cents, freq), destroy() }`
- `note`: `string | null` (null = no signal detected)
- `cents`: `number` in range −50…+50 (deviation from target pitch)
- `freq`: `number` (detected frequency in Hz)
- `destroy()` must clean up all DOM and timers — it is called before switching visualizations
- To add a new visualization: drop a `.js` file in `visualization/` and add an option to the settings select — **no other changes needed**

### Web Audio / Worker Rules

- The YIN worker receives `{ samples: Float32Array, sampleRate: number }` — pass the `ArrayBuffer` as a **transferable** to avoid copying: `worker.postMessage({...}, [samples.buffer])`
- Worker responds with `{ freq, confidence, rms }` — `freq === 0` means no pitch detected; always check `rms < 0.01` threshold before processing
- Audio accumulation uses a rolling `Float32Array` buffer (`accumBuffer`) — never process frames smaller than `_TUNER_MIN_YIN_SAMPLES` (4096 samples)
- `ScriptProcessorNode` is used (not `AudioWorklet`) — keep this consistent; do not migrate to AudioWorklet without updating the whole pipeline

### JavaScript Rules

- All JS files use the **IIFE pattern** `(function() { ... })()` — never use ES modules (`import`/`export`) or top-level code
- Utilities are exposed via **`window` namespace** (e.g., `window._tunerUtils`, `window._tunerViz_<name>`) — never return values from IIFEs directly
- No `async`/`await` in worker scripts — workers use `self.onmessage` / `self.postMessage` only
- DOM manipulation is done with vanilla JS (`document.createElement`, `classList`, `textContent`) — no jQuery or virtual DOM
- Script loading is lazy and guarded via `_loadedScripts` Set — never double-load a script URL
- Constants use `_SCREAMING_SNAKE_CASE` prefixed with `_TUNER_` (e.g., `_TUNER_FRAME_SIZE`) to avoid collisions in the host page's global scope

### Python Rules

- All route handlers live inside the `setup(app, context)` function — **do not define routes at module level**
- Use `pathlib.Path` for all filesystem operations — never `os.path`
- Config reads always return full defaults if the file is missing or malformed — never let a bad config crash the plugin
- `defaultTunings` is a computed property — **never write it to the config file** (the `_write` function strips it)
- Path traversal is guarded by `.resolve()` + `.relative_to()` — always apply this pattern when serving user-supplied filenames

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-05-30
