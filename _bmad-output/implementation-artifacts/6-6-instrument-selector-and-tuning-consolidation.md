# Story 6.6: Instrument Selector & Tuning Consolidation

---
baseline_commit: c3077c5
---

Status: done

## Story

As a guitarist or bassist using the tuner plugin,
I want to select my instrument (Guitar 6/7/8-string, Bass 4/5-string) separately from my tuning,
so that the tuning dropdown only shows tunings relevant to what I'm holding, and I don't have to scroll past irrelevant entries.

## Acceptance Criteria

### Instrument selector in the tuner window

1. The single tuning `<select>` is replaced by two controls rendered side-by-side above the string buttons: an **instrument select** (left) and a **tuning select** (right).
2. The instrument select uses `<optgroup>` — no cascading selects, no custom component:
   ```
   <optgroup label="Guitar">
     Guitar 6-string
     Guitar 7-string
     Guitar 8-string
   </optgroup>
   <optgroup label="Bass">
     Bass 4-string
     Bass 5-string
   </optgroup>
   ```
3. Changing the instrument select immediately repopulates the tuning select with only that instrument's tunings (filtered by `disabledTunings`).
4. **Free Tune is the topmost option** in the tuning select for every instrument, regardless of sort order.
5. The Current Song option (`_current`) still appears at the top of the tuning select when on the player screen and a song with tuning metadata is loaded — above Free Tune.
6. When the highway sets a tuning (via `loadConfig` / `_syncCurrentTuning`), the instrument select updates to reflect the instrument group that owns the active tuning. If the tuning is `_current`, the instrument select remains unchanged.
7. `lastInstrument` is persisted to the server-side config alongside `lastTuning` and restored on load.
8. On first load with no saved `lastInstrument`, default to `guitar-6`.
9. Changing the instrument select resets `manualTargetFreq` to `null` and re-renders string buttons.

### New instrument groups in routes.py

10. **All tuning names drop the instrument prefix** — the instrument dropdown already provides context. Use short names throughout, including the existing Guitar and Bass groups. Use A4=440 Hz equal temperament. All values are Hz rounded to 2 decimal places.

    Rename existing groups:
    ```python
    "Guitar": {
        "Standard":  [82.41, 110.00, 146.83, 196.00, 246.94, 329.63],
        "Drop D":    [73.42, 110.00, 146.83, 196.00, 246.94, 329.63],
        "Open G":    [73.42, 98.00, 146.83, 196.00, 246.94, 293.66],
        "DADGAD":    [73.42, 110.00, 146.83, 196.00, 220.00, 293.66],
        "Open E":    [82.41, 123.47, 164.81, 207.65, 246.94, 329.63],
    },
    "Bass 4-string": {
        "Standard":    [41.20, 55.00, 73.42, 98.00],
        "Drop D":      [36.71, 55.00, 73.42, 98.00],
        "D Standard":  [36.71, 48.99, 65.41, 87.31],
        "Drop C":      [32.70, 48.99, 65.41, 87.31],
    },
    "Bass 5-string": {
        "Standard":    [30.87, 41.20, 55.00, 73.42, 98.00],
        "Drop D":      [30.87, 36.71, 55.00, 73.42, 98.00],
        "D Standard":  [27.50, 36.71, 48.99, 65.41, 87.31],
        "Drop C":      [27.50, 32.70, 48.99, 65.41, 87.31],
    },
    ```

    New groups:
    ```python
    "Guitar 7-string": {
        # B1 E2 A2 D3 G3 B3 E4
        "Standard":    [61.74, 82.41, 110.00, 146.83, 196.00, 246.94, 329.63],
        # A1 E2 A2 D3 G3 B3 E4
        "Drop A":      [55.00, 82.41, 110.00, 146.83, 196.00, 246.94, 329.63],
        # A1 D2 G2 C3 F3 A3 D4
        "A Standard":  [55.00, 73.42, 98.00, 130.81, 174.61, 220.00, 293.66],
        # G1 D2 A2 D3 G3 B3 E4
        "Drop G":      [49.00, 73.42, 110.00, 146.83, 196.00, 246.94, 329.63],
        # Bb1 Eb2 Ab2 Db3 Gb3 Bb3 Eb4  (whole step down)
        "Bb Standard": [58.27, 77.78, 103.83, 138.59, 185.00, 233.08, 311.13],
    },
    "Guitar 8-string": {
        # F#1 B1 E2 A2 D3 G3 B3 E4
        "Standard":    [46.25, 61.74, 82.41, 110.00, 146.83, 196.00, 246.94, 329.63],
        # E1 B1 E2 A2 D3 G3 B3 E4
        "Drop E":      [41.20, 61.74, 82.41, 110.00, 146.83, 196.00, 246.94, 329.63],
        # E1 A1 D2 G2 C3 F3 A3 D4  (half step down)
        "E Standard":  [41.20, 55.00, 73.42, 98.00, 130.81, 174.61, 220.00, 293.66],
        # D1 A1 D2 G2 C3 F3 A3 D4
        "Drop D":      [36.71, 55.00, 73.42, 98.00, 130.81, 174.61, 220.00, 293.66],
        # D#1 G#1 C#2 F#2 B2 E3 G#3 C#4  (full step down)
        "Eb Standard": [38.89, 51.91, 69.30, 92.50, 123.47, 164.81, 207.65, 277.18],
    },
    ```
11. The `"General"` group and its `"Free Tune"` entry are **removed** from `DEFAULT_TUNINGS`. Free Tune is injected client-side as the first option in the tuning select for every instrument (see AC-4).
12. The config schema gains `lastInstrument` (string, default `"guitar-6"`). `_read()` in `routes.py` handles missing key with the default. `_write()` persists it alongside `lastTuning`.

### Instrument key mapping

The instrument select option values map to `DEFAULT_TUNINGS` group keys as follows:

| `value` | `DEFAULT_TUNINGS` key |
|---|---|
| `guitar-6` | `"Guitar"` |
| `guitar-7` | `"Guitar 7-string"` |
| `guitar-8` | `"Guitar 8-string"` |
| `bass-4` | `"Bass 4-string"` |
| `bass-5` | `"Bass 5-string"` |

This mapping is defined as a module-level constant `_TUNER_INSTRUMENT_GROUPS` in `screen.js`.

### Custom tunings: instrument selector in settings.html

13. The "Add Custom Tuning" form gains an instrument `<select>` between the name field and the notes/frequencies field:
    ```html
    <select id="tuner-new-instrument">
      <optgroup label="Guitar">
        <option value="guitar-6">Guitar 6-string</option>
        <option value="guitar-7">Guitar 7-string</option>
        <option value="guitar-8">Guitar 8-string</option>
      </optgroup>
      <optgroup label="Bass">
        <option value="bass-4">Bass 4-string</option>
        <option value="bass-5">Bass 5-string</option>
      </optgroup>
    </select>
    ```
14. Custom tunings are saved in the new shape: `{ "My Tuning": { "instrument": "guitar-6", "strings": [82.41, ...] } }`.
15. The existing custom tuning list renders the instrument label alongside the tuning name (e.g. "My Tuning · Guitar 6-string").

### Custom tuning migration

16. On `_read()` in `routes.py`, any `customTunings` entry that is a bare list (old format) is automatically migrated to the new dict format by inferring `instrument` from string count:

    | String count | Assigned `instrument` |
    |---|---|
    | 4 | `"bass-4"` |
    | 5 | `"bass-5"` |
    | 7 | `"guitar-7"` |
    | 8 | `"guitar-8"` |
    | anything else | `"guitar-6"` |

    Migration is applied on every `_read()` call — no one-time migration script. The migrated value is written back to disk on the next `_write()` call (which happens on any config POST).
17. `screen.js` `loadConfig` handles both old (`list`) and new (`{ instrument, strings }`) custom tuning formats gracefully — treating bare lists as `guitar-6` instrument until migrated.

### Tuning visibility in settings.html

18. The "Tuning Visibility" section in `settings.html` requires no structural changes to its group rendering — it already iterates `Object.keys(config.defaultTunings)`. The new groups appear automatically. The `General` group disappears automatically.
19. `disabledTunings` entries are now **compound keys** of the form `"instrument:TuningName"` (e.g. `"bass-5:Standard"`, `"guitar-6:Drop D"`). The settings page must write and read this format when toggling individual tunings.
20. On `_read()` in `routes.py`, any `disabledTunings` entry that does **not** contain a `:` is a legacy plain-name entry — it must be **dropped and not returned**. The cleaned list is written back to the config file on the next `_write()` call. No explicit one-time migration step is needed beyond this filter.

### "Save as Custom" — Current Song tuning

21. When `selectedTuningName === '_current'` and a valid `selectedTuning` is loaded from the highway, a **"Save as Custom"** label/button is rendered directly below the string buttons. It must not appear in any other state.
22. The label is hidden if the current song's frequencies already match an existing custom tuning **or** an existing default tuning for any instrument — comparison is by rounded frequency values (2 decimal places), not by name.
23. Clicking "Save as Custom" opens an **inline name input** directly in the tuner panel (not in settings). A text field pre-populated with the highway's tuning label (from `window._tunerUtils.getTuningName`) and a confirm button. Pressing confirm (or Enter) saves the tuning and hides the input.
24. The instrument is inferred from string count using the same table as the custom tuning migration (AC-16). This is automatic — the user does not choose the instrument for this flow.
25. Frequencies are rounded to 2 decimal places on save — same rule as manual custom tuning entry.
26. After saving, the new custom tuning appears in the tuning select for the matching instrument, `lastTuning` and `lastInstrument` update to the new tuning, and the "Save as Custom" label disappears.

### Frequency precision on custom tuning save

27. All custom tuning frequency values are rounded to 2 decimal places at save time — both in the "Save as Custom" flow (AC-25) and in the manual add form in `settings.html`. This applies to Hz values entered directly and to values converted from note names via `noteToFreq`.

## Tasks / Subtasks

- [x] **routes.py**
  - [x] Add `Guitar 7-string` and `Guitar 8-string` groups to `DEFAULT_TUNINGS` with standard Hz values
  - [x] Rename all existing tuning keys to strip instrument prefix (e.g. `"Guitar Standard"` → `"Standard"`, `"Bass 4-string Drop D"` → `"Drop D"`)
  - [x] Remove `General` group from `DEFAULT_TUNINGS`
  - [x] Add `lastInstrument` key to `_read()` defaults and merge logic
  - [x] Add `lastInstrument` write support to `_write()` (strip `defaultTunings` already handled)
  - [x] Add `_migrate_custom_tuning(name, value)` helper — returns `{ instrument, strings }` for both old and new formats
  - [x] Apply migration in `_read()` over `customTunings` entries before returning
  - [x] Strip legacy `disabledTunings` entries (no `:`) in `_read()` — filter to only compound-key entries

- [x] **screen.js**
  - [x] Add `_TUNER_INSTRUMENT_GROUPS` constant mapping instrument keys to `DEFAULT_TUNINGS` group names
  - [x] Add `selectedInstrument` state variable (default `'guitar-6'`)
  - [x] Replace single `tuningSelect` with `instrumentSelect` + `tuningSelect` side-by-side in `initUI()`
  - [x] Update `renderTuningOptions()` to filter by `selectedInstrument`, inject Free Tune first, preserve Current Song above Free Tune
  - [x] Add `renderInstrumentOptions()` — builds the `<optgroup>` select; called once in `initUI()`
  - [x] Update `loadConfig()` to read `lastInstrument` from config; handle both old flat-list and new `{ instrument, strings }` custom tuning formats (extract `.strings` for the `tunings` map); update `disabledTunings` filter to use compound `"instrument:name"` keys via `_isTuningEnabled(instrument, name)`
  - [x] Update `saveConfig()` to include `lastInstrument`
  - [x] Update `_syncCurrentTuning()` — when restoring to a non-`_current` tuning, derive instrument from the tuning name by scanning `_TUNER_INSTRUMENT_GROUPS`; update `instrumentSelect.value` accordingly
  - [x] Wire `instrumentSelect.onchange` — update `selectedInstrument`, reset `manualTargetFreq`, call `renderTuningOptions()`, `renderStringNotes()`
  - [x] Add `currentSongOffsets` and `currentSongIsBass` module-level variables; populate in `_syncCurrentTuning()`
  - [x] Add `saveAsCustomContainer` element below `stringNoteContainer`; show/hide via `_updateSaveAsCustomVisibility()`
  - [x] `_updateSaveAsCustomVisibility()` — shows label only when `selectedTuningName === '_current'` and frequencies don't match any existing default or custom tuning (2dp rounded comparison)
  - [x] Inline name input flow: clicking label renders a text input + confirm button inside `saveAsCustomContainer`; Enter key triggers confirm
  - [x] On confirm: round frequencies to 2dp, infer instrument from string count, POST to config as `{ instrument, strings }`, call `loadConfig()`, update `selectedTuningName` / `selectedInstrument` to the new tuning

- [x] **utils/tuning-utils.js**
  - [x] Remove `len !== 6 && len !== 4` guard; support len 4–8
  - [x] Replace drop tuning note-name calculation with `_STRING_BASE_MIDI` per-length lookup
  - [x] Add 7-string and 8-string named lookup entries (`Drop A`, `Drop E`)
  - [x] Fix `offsetsToFreqs` to use per-length base MIDI arrays; fix 5-string bass (base B0 E1 A1 D2 G2)

- [x] **settings.html**
  - [x] Add instrument `<optgroup>` select between name and notes/freqs fields in "Add Custom Tuning" form
  - [x] Update `_tunerAddCustom()` to read `#tuner-new-instrument` value; save `{ instrument, strings }` shape
  - [x] Update custom tuning list render to show instrument label alongside name
  - [x] Clear instrument select back to `guitar-6` after successful add
  - [x] Round all frequencies to 2dp on save (`Math.round(f * 100) / 100`) — both `noteToFreq` output and direct Hz input
  - [x] Update tuning visibility toggle handlers to write/read compound `"instrument:TuningName"` keys using `_groupToInstrument` reverse map
  - [x] Add `_groupToInstrument` constant in settings.html script block

## Dev Notes

### Free Tune is client-side only

`Free Tune` is no longer in `DEFAULT_TUNINGS`. It is injected by `renderTuningOptions()` as the first `<option>` with `value="free-tune"` and an empty `selectedTuning` (i.e. `[]`). When `selectedTuningName === 'free-tune'`, `selectedTuning` is set to `[]` — this already renders as no string buttons (existing `renderStringNotes` guards `selectedTuning.length === 0`). `saveConfig` should **not** persist `free-tune` as `lastTuning`; treat it the same as `_current` (ephemeral).

### Instrument derive from tuning name

When `_syncCurrentTuning()` restores a saved `lastTuning` that has no saved `lastInstrument`, derive the instrument by scanning `defaultTunings`:

```javascript
function _instrumentForTuning(name) {
    for (var key in _TUNER_INSTRUMENT_GROUPS) {
        var groupName = _TUNER_INSTRUMENT_GROUPS[key];
        if (defaultTunings[groupName] && defaultTunings[groupName][name]) return key;
    }
    return 'guitar-6';
}
```

### Side-by-side layout

Both selects share the same `w-full mb-4` row. Use a `flex gap-2` wrapper:

```javascript
var selectorRow = document.createElement('div');
selectorRow.className = 'flex gap-2 w-full mb-4';
// instrumentSelect: flex-none w-auto (shrinks to content)
// tuningSelect: flex-1 (takes remaining width)
```

`instrumentSelect` should not stretch — it has at most 5 options. Use `flex-none` or a fixed width (`w-36`) so the tuning dropdown gets more space.

### Custom tuning backward compat in screen.js

In `loadConfig`, when populating `tunings` from `customTunings`:

```javascript
Object.entries(config.customTunings || {}).forEach(function([name, val]) {
    // Support both old flat-list and new {instrument, strings} shapes
    var strings = Array.isArray(val) ? val : (val.strings || []);
    tunings[name] = strings;
});
```

The `instrument` field is only needed by the settings page for display — `screen.js` only cares about the frequency array.

### `disabledTunings` — new compound key format

`disabledTunings` is now a flat list of `"instrument:TuningName"` compound strings, e.g. `["bass-5:Standard", "guitar-6:Drop D"]`. This gives per-instrument granularity without changing the list-of-strings type.

**Filter in `loadConfig` (`screen.js`)** — replace the existing `includes(name)` check:
```javascript
// Old: !config.disabledTunings?.includes(name)
// New:
function _isTuningEnabled(instrument, name) {
    return !(config.disabledTunings || []).includes(instrument + ':' + name);
}
```

**Filter in `_read()` (`routes.py`)** — strip legacy plain-name entries on load:
```python
disabled = data.get("disabledTunings", [])
if isinstance(disabled, list):
    disabled = [e for e in disabled if isinstance(e, str) and ':' in e]
res["disabledTunings"] = disabled
```
The cleaned list is returned and written back on the next `_write()` call. Previously hidden tunings will reappear once — acceptable one-time side effect.

**settings.html toggle handlers** — the group key from `DEFAULT_TUNINGS` (e.g. `"Guitar 7-string"`) must be mapped to its instrument key (e.g. `"guitar-7"`) when building the compound key. Pass the instrument key alongside the group name when rendering the visibility list, using the same `_TUNER_INSTRUMENT_GROUPS` reverse mapping. The reverse map (group name → instrument key) can be built from `_TUNER_INSTRUMENT_GROUPS` at render time:
```javascript
// In settings.html, build reverse map from defaultTunings group names to instrument keys
var _groupToInstrument = {
    "Guitar": "guitar-6",
    "Guitar 7-string": "guitar-7",
    "Guitar 8-string": "guitar-8",
    "Bass 4-string": "bass-4",
    "Bass 5-string": "bass-5"
};
// Compound key for a tuning toggle:
var key = _groupToInstrument[groupName] + ':' + tuningName;
// Check: config.disabledTunings.includes(key)
// Add:   config.disabledTunings.push(key)
// Remove: config.disabledTunings.filter(k => k !== key)
```

### `tuning-utils.js` — extend for 7-string and 8-string

The existing `getTuningName` has a hard guard on line 21:
```javascript
if (len !== 6 && len !== 4) return offsets.join(' ');
```
This means 7-string and 8-string highway data falls back to a raw numeric string like `"0 0 0 0 0 0 -5"`. Fix by extending to support `len` of 5, 6, 7, and 8.

**Drop tuning note calculation** (line 31–36) uses a base-note offset to compute the dropped string's note name. The current code only adjusts for bass (`len === 4 ? 4 : 0`). The full table of lowest-string base notes (semitones above C):

| `len` | Lowest string | MIDI | Note | Offset from E (idx 4) |
|---|---|---|---|---|
| 4 | A1 (bass) | 33 | A | +4 (mod 12 from E=4 → A=9, delta=+4) |
| 5 | B1 (bass 5) | 35 | B | — (bass 5 lowest is B, not in current code) |
| 6 | E2 (guitar) | 40 | E | 0 |
| 7 | B1 (guitar) | 35 | B | +11 (mod 12: E=4, B=11, delta=+7… easier: use absolute index) |
| 8 | F#1 (guitar) | 30 | F# | +6 |

Rewrite the drop detection note-name lookup using a per-length base MIDI note:

```javascript
var _STRING_BASE_MIDI = { 4: 33, 5: 35, 6: 40, 7: 35, 8: 30 };
// note index = (baseMidi + offsets[0]) mod 12
var baseMidi = _STRING_BASE_MIDI[len] !== undefined ? _STRING_BASE_MIDI[len] : 40;
var noteIdx = ((baseMidi + offsets[0]) % 12 + 12) % 12;
var names = ['C','C#','D','D#','E','F','F#','G','Ab','A','Bb','B'];
return 'Drop ' + names[noteIdx];
```

**Standard tuning detection** — the all-equal check already works for any length. The `standard` dict returns `"E Standard"` etc. based on the offset value, which is correct: a 7-string with all offsets `0` is still "Standard" (meaning standard 7-string, B E A D G B E).

**Named lookup** — add 7-string and 8-string entries alongside the existing 6-string ones:
```javascript
// 7-string
'-2,0,0,0,0,0,0': 'Drop A',
// 8-string
'-2,0,0,0,0,0,0,0': 'Drop E',
```
Other 7/8 patterns (A Standard, Bb Standard etc.) fall through to the all-equal check or drop check and are handled correctly.

**`offsetsToFreqs`** — the current implementation repeats `base[base.length-1]` for extra strings, which is wrong for 7/8 guitar (it would repeat E4 instead of correctly stepping down). Add 7-string and 8-string base arrays:

```javascript
var _BASE_MIDI = {
    4: [28, 33, 38, 43],                     // bass 4: B E A D
    5: [23, 28, 33, 38, 43],                  // bass 5: B E A D G  (wait - standard bass 5 is B0 E1 A1 D2 G2)
    6: [40, 45, 50, 55, 59, 64],              // guitar 6: E A D G B E
    7: [35, 40, 45, 50, 55, 59, 64],          // guitar 7: B E A D G B E
    8: [30, 35, 40, 45, 50, 55, 59, 64],      // guitar 8: F# B E A D G B E
};
```

Use `isBass` to choose between the bass and guitar arrays when the count is ambiguous (4 or 5 strings could be bass or guitar). For counts 6, 7, 8: always guitar. For counts 4, 5: use `isBass` flag as today.

Note: `5` with `isBass=true` should use `[23, 28, 33, 38, 43]` (B0 E1 A1 D2 G2 — standard 5-string bass). Current code uses guitarBase fallback for 5-string, which is wrong. Fix this at the same time.

**Store offsets in screen.js** — `_syncCurrentTuning()` has access to `songInfo.tuning` (the raw offset array) and `songInfo.stringCount`. The highway sends the **full untruncated offset array** for 7/8-string songs — `songInfo.tuning` can legitimately be 7 or 8 elements long. `songInfo.stringCount` is the authoritative string count (integer 4–8); prefer it over `offsets.length` for instrument inference.

Store both in module-level variables and use `getTuningName` for the pre-populated "Save as Custom" name:

```javascript
// Module-level
var currentSongOffsets = null;
var currentSongIsBass  = false;

// In _syncCurrentTuning(), after computing selectedTuning:
var sc = songInfo.stringCount || songInfo.tuning.length;
currentSongOffsets = songInfo.tuning.slice(0, sc);
currentSongIsBass  = isBass;

// In Save as Custom name input:
var suggestedName = window._tunerUtils.getTuningName(currentSongOffsets) || 'Custom Tuning';
nameInput.value = suggestedName;
```

**Instrument inference for "Save as Custom"** — use `stringCount` from the highway (stored in `currentSongOffsets.length` after slicing) to infer the instrument key, same table as AC-16/AC-24. `window.highway.getStringCount()` is also available as a direct call if needed.

**Why the library tuning label may differ** — Slopsmith's song card label is computed from only the first 6 offsets (`range(6)` in `server.py` metadata extraction). For a 7-string song in Drop A (`[-2,0,0,0,0,0,0]`), the card shows `"Drop D"` (first 6 look like Drop D) but the highway sends all 7 offsets. Our `getTuningName` with the full 7-offset array will correctly produce `"Drop A"`. This is *more accurate* than the card label, not inconsistent.

**Tasks to add to `utils/tuning-utils.js`:**
- Remove `len !== 6 && len !== 4` guard; replace with support for len 4–8
- Update drop tuning note-name calculation to use `_STRING_BASE_MIDI` per-length lookup
- Add 7-string and 8-string named lookup entries
- Fix `offsetsToFreqs` to use per-length base MIDI arrays; fix 5-string bass base

**Tasks to add to `screen.js`:**
- Add `currentSongOffsets` and `currentSongIsBass` module-level variables
- Populate them in `_syncCurrentTuning()` using `songInfo.stringCount` for the slice length
- Use `getTuningName(currentSongOffsets)` to pre-populate the "Save as Custom" name input

### "Save as Custom" duplicate check

The visibility check compares rounded frequencies (2dp) against all known tunings — both `defaultTunings` (all groups) and `customTunings`. Comparison is array equality after rounding:

```javascript
function _freqsEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    return a.every(function(f, i) {
        return Math.round(f * 100) === Math.round(b[i] * 100);
    });
}

function _tuningAlreadyKnown(freqs) {
    // Check default tunings across all groups
    for (var group in defaultTunings) {
        for (var name in defaultTunings[group]) {
            if (_freqsEqual(freqs, defaultTunings[group][name])) return true;
        }
    }
    // Check custom tunings
    for (var cname in config.customTunings) {
        var val = config.customTunings[cname];
        var strings = Array.isArray(val) ? val : (val.strings || []);
        if (_freqsEqual(freqs, strings)) return true;
    }
    return false;
}
```

`_updateSaveAsCustomVisibility()` calls `_tuningAlreadyKnown(selectedTuning)` and shows/hides the container accordingly. Call it after `renderStringNotes()` and after `loadConfig()`.

### Highway / `_current` interaction

`_syncCurrentTuning()` determines instrument from the song's `arrangement` and `stringCount` values:
- `isBass = arrangement.includes('bass')` — use existing logic
- Do not update `instrumentSelect` when `selectedTuningName === '_current'`; the instrument select reflects the user's manual selection, not the highway-derived instrument

### Manual Verification

After implementation, verify these paths:
1. Load plugin → instrument select shows Guitar 6-string, tuning shows Free Tune first, then Guitar Standard etc.
2. Switch instrument to Bass 4-string → tuning dropdown shows only Bass 4-string tunings (Free Tune first)
3. Switch instrument to Guitar 7-string → shows Guitar 7 Standard, Guitar 7 Drop A
4. Select a tuning → string buttons update to correct string count
5. Open settings → "Add Custom Tuning" form has instrument selector; add a tuning → appears in list with instrument label
6. Restart plugin → last instrument + last tuning are restored
7. On player screen with song loaded → "Current Song" appears above Free Tune in tuning dropdown
8. Old custom tunings (bare list format) → migrated to correct instrument on first load; no errors

### References

- Current `screen.js` tuning state: lines 57–60 (`defaultTunings`, `tunings`, `selectedTuning`, `selectedTuningName`)
- `renderTuningOptions()`: lines 193–228 — replace this function entirely
- `loadConfig()`: lines 145–176 — extend `tunings` population and add `lastInstrument` restore
- `saveConfig()`: lines 180–190 — add `lastInstrument` to POST body
- `initUI()` tuning select creation: lines 297–317 — replace with instrument+tuning row
- `settings.html` add-form: lines 29–44 — insert instrument select after name input
- `settings.html` `_tunerAddCustom`: lines 242–275 — read instrument, save new shape
- `routes.py` `DEFAULT_TUNINGS`: lines 11–34
- `routes.py` `_read()`: lines 40–69
- Party mode design decisions: this story was shaped by a multi-round party mode discussion — instrument-first mental model, `<optgroup>` for two-click selection, per-instrument tuning grouping in settings, string-count migration heuristic

## File List

- routes.py
- screen.js
- utils/tuning-utils.js
- settings.html

## Dev Agent Record

### Completion Notes

Implemented all ACs in a single session.

**routes.py:** Added `Guitar 7-string` and `Guitar 8-string` groups to `DEFAULT_TUNINGS`; stripped instrument prefixes from all tuning names; removed `General`/`Free Tune` group; added `lastInstrument` (default `"guitar-6"`) to `_read()`/`_write()`; added `_migrate_custom_tuning()` helper converting flat-list custom tunings to `{instrument, strings}` dict; applied migration on `_read()`; stripped legacy plain-name `disabledTunings` entries (no `:`) on load.

**screen.js:** Added `_TUNER_INSTRUMENT_GROUPS` constant, `selectedInstrument` state, `currentSongOffsets`/`currentSongIsBass` vars. Replaced single tuning select with `flex gap-2` row containing `instrumentSelect` (flex-none w-36) + `tuningSelect` (flex-1). `renderInstrumentOptions()` builds Guitar/Bass `<optgroup>` select. `renderTuningOptions()` now filters by selected instrument (via `_isTuningEnabled` with compound `"instrument:name"` keys), injects Free Tune first, preserves Current Song above it. `loadConfig()` restores `lastInstrument`, builds `tunings` map for selected instrument only, handles both custom tuning shapes. `saveConfig()` posts `lastInstrument`. `_syncCurrentTuning()` stores `currentSongOffsets`/`currentSongIsBass`, derives instrument for fallback path. `instrumentSelect.onchange` rebuilds tunings, resets `manualTargetFreq`. Added `saveAsCustomContainer` with `_updateSaveAsCustomVisibility()` (shows only for `_current` with unknown frequencies), inline name input with Enter-to-confirm, saves `{instrument, strings}` inferred from string count.

**utils/tuning-utils.js:** Removed `len !== 6 && len !== 4` guard; extended to len 4–8. Drop tuning detection now uses `_STRING_BASE_MIDI` per-length lookup. Added `Drop A` (7-string) and `Drop E` (8-string) named lookups. `offsetsToFreqs` uses `_BASE_MIDI` per-length arrays including correct 5-string bass (B0 E1 A1 D2 G2). `isBass` flag still used to select 4/5-string bass vs guitar arrays.

**settings.html:** Added instrument `<optgroup>` select in Add Custom Tuning form. `_tunerAddCustom()` reads instrument, saves `{instrument, strings}`, rounds all Hz to 2dp, clears instrument back to `guitar-6`. Custom tuning list shows `"Name · Guitar 6-string"` style label. Added `_groupToInstrument` reverse map; visibility toggles now use compound `"instrument:TuningName"` keys for group and individual toggle handlers.

### Change Log

- Implemented story 6.6: Instrument Selector & Tuning Consolidation (Date: 2026-06-01)
