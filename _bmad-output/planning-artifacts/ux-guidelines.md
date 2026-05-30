---
project: slopsmith-plugin-tuner
date: '2026-05-30'
skill: bmad-ux
primary_focus: tuner panel
secondary_focus: settings page, button injection
inputs:
  - _bmad-output/planning-artifacts/prds/prd-slopsmith-plugin-tuner-2026-05-30/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/project-context.md
  - screen.js
  - visualization/default.js
  - visualization/strobe.js
  - settings.html
---

# UX Guidelines — Slopsmith Tuner Plugin

_Audit of the existing UI against PRD requirements and UX best practices. Primary focus: tuner panel. Secondary: settings page, button injection. All recommendations are constrained to Tailwind-only styling, IIFE pattern, and no external JS dependencies._

---

## Constraints Reference

All improvements must comply with:

| Constraint | Rule |
|---|---|
| **NFR-07** | Tailwind utility classes only — no inline `style=""` attributes |
| **NFR-03** | No new external JS libraries |
| **IIFE** | No `import`/`export`; all new globals prefixed `_tuner`/`_TUNER_` |
| **Viz contract** | Any new visualization: `window._tunerViz_<name>(container)` → `{ update, destroy }` |
| **Exempt** | Functional animation offsets only: `strobeEl.style.backgroundPosition`, `gaugeNeedle.style.left` |

---

## 1. Tuner Panel — Primary Focus

### 1.1 Note Display (Default Visualization)

**Current state** (`visualization/default.js`):
- Note name: `text-5xl font-black` — switches between `text-white` and `text-green-400`
- Frequency readout: `text-xs text-gray-500 font-mono`
- In-tune threshold for green color: **±5 cents** (`Math.abs(cents) < 5`)

**Discrepancy with PRD:**
- FR-17 states "indicator turns green within ±2 cents". The code uses ±5 cents for both the note text colour and the needle colour. This is a functional UX bug — the visual "in tune" signal fires too early.

**Improvement opportunities:**

| # | Finding | Priority | Implementation note |
|---|---|---|---|
| UX-1.1-A | Align in-tune green threshold from ±5 → ±2 cents in `default.js` (note text + needle) | **High** | Change `Math.abs(cents) < 5` to `Math.abs(cents) < 2` in two places |
| UX-1.1-B | Frequency readout is de-emphasised but useful — consider `text-gray-400` instead of `text-gray-500` for slightly improved legibility | Low | Single class change |
| UX-1.1-C | No cents value shown when no signal (`note === null`) — `'0 cents'` is misleading. Show `'— cents'` or empty instead | Low | Change default text in `update(null,...)` branch |

---

### 1.2 Cents Indicator — Default Visualization (Needle/Gauge)

**Current state:**
- Container: `w-full h-2.5 bg-dark-900 border border-gray-800 rounded-full relative overflow-hidden`
- Center marker: `absolute left-1/2 top-0 bottom-0 w-0.5 bg-accent z-10`
- Needle: `absolute ... w-1 bg-white transition-all duration-100 ease-out` (white when sharp/flat, green when in tune)
- Position driven by `gaugeNeedle.style.left` — exempt functional offset
- Cents text: `text-sm font-bold tracking-tight`

**Improvement opportunities:**

| # | Finding | Priority | Implementation note |
|---|---|---|---|
| UX-1.2-A | Needle colour is binary (white / green) — no directional colour cue for sharp vs. flat. Adding `text-blue-400` for flat and `text-amber-400` for sharp would improve at-a-glance reads | Med | Add conditional class in `update()`: cents < -2 → blue, cents > 2 → amber, abs < 2 → green |
| UX-1.2-B | Gauge height (`h-2.5`) is quite thin — `h-3` or `h-3.5` would improve hit area and visual weight | Low | Single class change on container |
| UX-1.2-C | Cents text shows `+0 cents` when in tune — `0 ¢` or `in tune` would be more user-friendly | Low | Format string change in `update()` |

---

### 1.3 Cents Indicator — Strobe Visualization

**Current state** (`visualization/strobe.js`):
- LCD segment display for note name (16-segment font map)
- Sharp symbol: `opacity: 0.05` (inactive) / `opacity: 1` (active) — uses inline style but this is a functional animation, consistent with the exemption
- Strobe: opacity `1.0` when in tune (`Math.abs(cents) < 5`), `0.6` otherwise
- Background `bg-dark-900 border border-gray-800 rounded-lg`

**Discrepancy with PRD:**
- Same ±5 cents threshold for "in tune" opacity — should be ±2 to match FR-17.

**Improvement opportunities:**

| # | Finding | Priority | Implementation note |
|---|---|---|---|
| UX-1.3-A | Align strobe in-tune opacity threshold from ±5 → ±2 cents | **High** | Change `Math.abs(cents) < 5` to `Math.abs(cents) < 2` in `update()` |
| UX-1.3-B | No cents deviation indicator — the strobe conveys in/out but not magnitude or direction. A subtle text overlay showing cents value would help beginners | Med | Add a small `text-accent/60 text-xs font-mono` cents readout below the strobe panel |
| UX-1.3-C | Strobe container height is `h-32` fixed — on the 72px-wide `w-72` panel this works but the proportions feel squat. `h-28` may feel better proportioned | Low | Single class change |

---

### 1.4 String Buttons

**Current state** (`screen.js` — `renderStringNotes`, `_syncStringHighlight`, `_syncActiveStringFromFreq`):
- Container: `flex justify-between w-full mb-4 gap-1`
- Each button: `flex-1 py-1.5 text-xs font-bold rounded`
- **Inactive:** `bg-dark-700 text-gray-400 border border-gray-800 hover:border-gray-600`
- **Auto-detected (active):** `bg-dark-700 text-accent border border-accent` — same background, accent text/border
- **Manual lock:** `bg-accent text-white border border-accent` — filled accent background

**Improvement opportunities:**

| # | Finding | Priority | Implementation note |
|---|---|---|---|
| UX-1.4-A | Auto-detected and manual-locked states are too similar — both use `border-accent`. The filled background on manual is the only distinction. Consider adding a lock icon or `ring-2 ring-accent` on manual for clearer differentiation | Med | Class change in `_syncActiveStringFromFreq` and `_syncStringHighlight`; no new assets if using Tailwind ring utilities |
| UX-1.4-B | No tooltip or label indicating tap-to-lock behaviour. A `title` attribute on each button (`"Tap to lock on this string"`) adds discoverability at zero cost | Low | Add `btn.title = 'Tap to lock'` / `'Tap again to unlock'` in `renderStringNotes` |
| UX-1.4-C | Button height `py-1.5` is quite tight for touch/click targets — `py-2` would improve hit area while keeping the panel compact | Low | Single class change |

---

### 1.5 Tuning Selector

**Current state** (`screen.js` — `renderTuningOptions`):
- Element: `<select>` with `w-full bg-dark-700 text-sm text-gray-200 border border-gray-800 mb-4 p-2 rounded-lg outline-none focus:border-accent`
- "Current Song" option text: `` `Current Song [${tName}]` ``
- No visual grouping of options (browser default `<optgroup>` not used)

**Improvement opportunities:**

| # | Finding | Priority | Implementation note |
|---|---|---|---|
| UX-1.5-A | Tuning groups (Guitar, Bass 4-string, etc.) are not visually separated in the dropdown. Use `<optgroup label="...">` elements to group options — standard HTML, no JS needed | Med | Add `<optgroup>` in `renderTuningOptions` when iterating `defaultTunings` groups |
| UX-1.5-B | "Current Song" option is at the top but its bracket-format label `[Drop D]` is not obviously different from a regular tuning. Consider prefixing with a separator or adding an emoji-free visual cue like `★ Current Song — Drop D` | Low | String format change in `renderTuningOptions` |
| UX-1.5-C | No indication of string count for the selected tuning — a player switching from guitar to bass has no confirmation they picked the right tuning. The string note buttons below implicitly show this, but a `(6 strings)` suffix would help | Low | Append string count to option text |

---

### 1.6 Settings Panel (Inline / Collapsible)

**Current state** (`screen.js` — `showSettings`, `populateDevices`):
- Triggered by gear icon (`h-4 w-4`) in panel header — absolute positioned top-right
- Panel inserts before the tuning selector
- Contains: "Audio Settings" label, Microphone select, Input Channel select, Visualization select
- Toggle: clicking gear again removes the panel (no animation)

**Improvement opportunities:**

| # | Finding | Priority | Implementation note |
|---|---|---|---|
| UX-1.6-A | No explicit close button inside the panel — users must re-click the gear icon. A `×` button inside the panel improves discoverability | Med | Add a close button that calls `panel.remove()` |
| UX-1.6-B | The gear icon `h-4 w-4` is a small touch target. Wrapping it in `p-1 -mr-1` would enlarge the clickable area without changing visual size | Low | Class change on `settingsBtn` |
| UX-1.6-C | No visual active-state on the gear icon when settings are open. Adding `text-accent` when open makes state visible | Low | Toggle class on `settingsBtn` when opening/closing |
| UX-1.6-D | Panel appears instantly — a subtle `transition-all duration-150` or `animate-in` would make the appearance feel less abrupt. Tailwind provides `transition-opacity` | Low | Add transition class to panel element |

---

### 1.7 Error Banner

**Current state** (`screen.js` — `_showMicError`):
- Classes: `w-full mt-2 p-3 bg-red-900/40 border border-red-700/60 rounded-lg text-xs text-red-300 leading-relaxed`
- Content: `<strong>message</strong><br>hint` — no dismiss control
- Cleared only by: successful device switch (FR-25) or screen navigation (FR-26)

**Improvement opportunities:**

| # | Finding | Priority | Implementation note |
|---|---|---|---|
| UX-1.7-A | No dismiss button — once shown, the error persists until the user takes a corrective action. For `NotAllowedError` (needs browser restart), there is nothing the plugin can do; a dismiss `×` would at least let the user acknowledge and hide the banner | Med | Add a dismiss button that calls `errEl.remove()` |
| UX-1.7-B | Error text colour `text-red-300` on `bg-red-900/40` — the contrast may be borderline. `text-red-200` improves contrast slightly | Low | Class change |
| UX-1.7-C | Hint text contains HTML entities (`&amp;`) in the source; these render correctly in the browser but the code string is harder to read. Use real `&` in the string and rely on `innerHTML`'s encoding | Low | String cleanup in `_showMicError` |

---

## 2. Settings Page — Secondary Coverage

**Current state** (`settings.html`):
- Hosted in Plugin Manager iframe
- Sections: Floating Button toggle, Tuning Visibility (collapsible groups), Custom Tunings (add/delete)

**Key UX concerns:**

| # | Finding | Priority | Implementation note |
|---|---|---|---|
| UX-2-A | **NFR-07 violation — inline styles in settings.html:** `chevron.style.transform = 'rotate(0deg)'` / `'rotate(90deg)'` and `div.style.borderTop = 'none'`. These should use Tailwind classes (`rotate-0`/`rotate-90` and `border-t-0`) | **High** | Replace inline style assignments with `classList.add/remove/toggle` |
| UX-2-B | The "Add Tuning" `alert()` calls for validation errors (`alert('Please enter name…')`) violate FR-23's spirit — use inline validation messages instead | Med | Replace `alert()` with inline error text elements |
| UX-2-C | Tuning groups default to collapsed — a first-time user sees no tunings and may not know they exist. Consider expanding the first group by default | Low | Initialise `expandedGroups` with the first group name from `defaultTunings` |
| UX-2-D | Custom tuning frequency display (`fEl.textContent = config.customTunings[name].join(', ')`) shows raw Hz values (e.g. `82.41, 110.0, …`). Showing note names (via `_tunerUtils.midiToNote`) would be more readable | Low | Requires `_tunerUtils` to be available in the settings page context — may not be; needs investigation |

---

## 3. Button Injection — Secondary Coverage

**Current state** (`screen.js` — `addButton`, `injectPlayerButton`):
- **Floating button:** `fixed bottom-5 right-5 px-4 py-2.5 … rounded-xl text-sm z-[1001]`
- **Player bar button:** `px-3 py-1.5 … rounded-lg text-xs`
- Active state: `bg-accent/20 border border-accent text-accent`
- Inactive state: `bg-dark-700 border border-gray-800 text-gray-300`

**Key UX concerns:**

| # | Finding | Priority | Implementation note |
|---|---|---|---|
| UX-3-A | Floating button active state (`bg-accent/20`) and inactive state (`bg-dark-700`) are visually distinct — this is working well. No change needed | — | No action |
| UX-3-B | The floating button text is just `"Tuner"` with no icon — consistent with Slopsmith conventions. No change needed | — | No action |
| UX-3-C | Player controls bar button uses `text-xs` while the floating button uses `text-sm` — minor inconsistency. Aligning both to `text-xs` (matching the player controls context) is cosmetically cleaner | Low | Class change on floating button or player button |

---

## 4. Improvement Summary

### High Priority (should be stories)

| ID | Area | Description |
|---|---|---|
| UX-1.1-A | Note display | Align in-tune green threshold: ±5 → ±2 cents (`default.js`) |
| UX-1.3-A | Strobe viz | Align strobe in-tune threshold: ±5 → ±2 cents (`strobe.js`) |
| UX-2-A | Settings page | Fix NFR-07 violations: replace inline `style=` with Tailwind classes (`settings.html`) |

### Medium Priority (should be stories)

| ID | Area | Description |
|---|---|---|
| UX-1.2-A | Gauge needle | Add directional colour cue: flat=blue, sharp=amber, in-tune=green |
| UX-1.3-B | Strobe viz | Add cents readout below strobe panel |
| UX-1.4-A | String buttons | Clearer visual distinction between auto-detected and manual-locked states |
| UX-1.6-A | Settings panel | Add explicit close button inside inline settings panel |
| UX-1.6-C | Settings panel | Active state on gear icon when settings are open |
| UX-1.7-A | Error banner | Add dismiss button to error banner |
| UX-2-B | Settings page | Replace `alert()` validation with inline error messages |

### Low Priority (batch into a polish story)

UX-1.1-B, UX-1.1-C, UX-1.2-B, UX-1.2-C, UX-1.3-C, UX-1.4-B, UX-1.4-C, UX-1.5-A, UX-1.5-B, UX-1.5-C, UX-1.6-B, UX-1.6-D, UX-1.7-B, UX-1.7-C, UX-2-C, UX-2-D, UX-3-C

---

## 5. Suggested Story Breakdown for Epic 2

| Story | Covers | Key files |
|---|---|---|
| 2.2 | Fix in-tune threshold in both visualizations (UX-1.1-A, UX-1.3-A) | `visualization/default.js`, `visualization/strobe.js` |
| 2.3 | Fix NFR-07 inline style violations in settings page (UX-2-A) | `settings.html` |
| 2.4 | Error banner and settings panel UX improvements (UX-1.6-A, UX-1.6-C, UX-1.7-A, UX-2-B) | `screen.js`, `settings.html` |
| 2.5 | Directional colour cues on gauge, strobe cents readout, string button state clarity (UX-1.2-A, UX-1.3-B, UX-1.4-A) | `visualization/default.js`, `visualization/strobe.js`, `screen.js` |
| 2.6 | Low-priority polish pass (all Low items) | `screen.js`, `visualization/default.js`, `visualization/strobe.js`, `settings.html` |
