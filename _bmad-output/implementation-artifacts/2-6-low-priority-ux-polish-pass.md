# Story 2.6: Low-Priority UX Polish Pass

Status: dismissed

## Story

As a contributor,
I want all low-priority UX polish items from the guidelines applied in a single pass,
So that the tuner UI is fully aligned with the UX guidelines without requiring individual stories for minor improvements.

## Acceptance Criteria

1. Default viz: frequency readout uses `text-gray-400` (was `text-gray-500`); no-signal cents shows `— cts` (was `0 cents`).
2. Default viz: gauge height is `h-3` (was `h-2.5`); in-tune cents text shows `in tune` (was `+0 cents`).
3. Strobe viz: container height is `h-28` (was `h-32`).
4. String buttons: each has a `title` attribute ("Tap to lock" / "Tap again to unlock"); vertical padding is `py-2` (was `py-1.5`).
5. Tuning selector: options are grouped using `<optgroup>` elements matching the `defaultTunings` groups; "Current Song" option text is prefixed with `★ `.
6. Settings panel: gear icon `settingsBtn` has `p-1 -mr-1` padding for a larger click target; settings panel appearance uses `transition-opacity duration-150`.
7. Error banner: uses `text-red-200` (was `text-red-300`).
8. Settings page: first tuning group is expanded by default on load; floating button toggle exists and functions correctly (no change needed — this is a verification only).
9. Player controls bar button uses `text-xs` (was already `text-xs` — verify, no change if correct); floating button uses `text-xs` (was `text-sm` — align).
10. No regressions across all critical paths.

## Tasks / Subtasks

- [ ] Task 1: Default viz polish (AC: 1, 2)
  - [ ] `text-gray-500` → `text-gray-400` on `freqDisplay`
  - [ ] No-signal branch: `centsDisplay.textContent = '— cts'` (was `'0 cents'`)
  - [ ] `h-2.5` → `h-3` on `gaugeEl`
  - [ ] In-tune cents: when `Math.abs(cents) < 2`, show `'in tune'` instead of `'+0 cents'`
- [ ] Task 2: Strobe viz polish (AC: 3)
  - [ ] `h-32` → `h-28` on `wrap`
- [ ] Task 3: String button polish (AC: 4)
  - [ ] Add `btn.title = manualTargetFreq === f ? 'Tap again to unlock' : 'Tap to lock on this string'` in `renderStringNotes()`
  - [ ] `py-1.5` → `py-2` on all string button class strings (inactive, auto, manual — all three)
- [ ] Task 4: Tuning selector polish (AC: 5)
  - [ ] In `renderTuningOptions()`, wrap default tuning options in `<optgroup label="groupName">` elements
  - [ ] Change "Current Song" prefix: `` `★ Current Song [${tName}]` ``
- [ ] Task 5: Settings panel polish (AC: 6)
  - [ ] Add `p-1 -mr-1` to `settingsBtn.className`
  - [ ] Add `transition-opacity duration-150 opacity-0` to panel on creation, then set `opacity-100` on next frame (or just add `animate-in` if available)
- [ ] Task 6: Error banner colour (AC: 7)
  - [ ] `text-red-300` → `text-red-200` on `errEl` classes
- [ ] Task 7: Settings page default-expanded group (AC: 8)
  - [ ] In settings.html `load()`, after config is loaded, set `expandedGroups = [Object.keys(config.defaultTunings)[0]]` before calling `render()`
- [ ] Task 8: Button text size alignment (AC: 9)
  - [ ] In `updateFloatingButton()` / `addButton()`, change floating button `text-sm` → `text-xs`
- [ ] Task 9: Manual verification (AC: 10)
  - [ ] All critical paths: mic access, viz switch, tuning change, custom tuning, error banner

## Dev Notes

### File-by-File Change Map

**`visualization/default.js`:**
- `freqDisplay.className`: `text-gray-500` → `text-gray-400`
- `update(null,...)`: `centsDisplay.textContent = '0 cents'` → `'— cts'`
- `gaugeEl.className`: `h-2.5` → `h-3`
- `update(note,...)`: for in-tune case (`Math.abs(cents) < 2`), format cents as `'in tune'` instead of `(cents > 0 ? '+' : '') + cents.toFixed(0) + ' cents'`

**`visualization/strobe.js`:**
- `wrap.className`: `h-32` → `h-28`

**`screen.js`:**
- `renderStringNotes()`: add `btn.title` — use `manualTargetFreq === f ? 'Tap again to unlock' : 'Tap to lock on this string'`
- All three button class strings: `py-1.5` → `py-2` (inactive, auto-highlight, manual-locked in both `_syncActiveStringFromFreq` and `_syncStringHighlight`)
- `renderTuningOptions()`: wrap regular tuning `<option>` elements in `<optgroup>` per group; ★ prefix on Current Song
- `settingsBtn.className`: add `p-1 -mr-1`
- Error banner `errEl` class: `text-red-300` → `text-red-200`
- Floating button classes in `updateFloatingButton()`: `text-sm` → `text-xs`

**`settings.html`:**
- In `load()`: after awaiting config, add `expandedGroups = config.defaultTunings ? [Object.keys(config.defaultTunings)[0]] : [];`

### `<optgroup>` Pattern for Tuning Selector

```js
// In renderTuningOptions(), where default tunings are added:
// Replace: Object.keys(tunings).forEach(name => { ... append option ... })
// With: group options from defaultTunings under optgroup elements

Object.entries(defaultTunings).forEach(([groupName, group]) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = groupName;
    Object.keys(group).forEach(name => {
        if (tunings[name]) { // only add if not disabled
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            optgroup.appendChild(opt);
        }
    });
    if (optgroup.children.length > 0) tuningSelect.appendChild(optgroup);
});
// Custom tunings (no group):
const customs = Object.keys(tunings).filter(n => !Object.values(defaultTunings).some(g => n in g));
if (customs.length > 0) {
    const customGroup = document.createElement('optgroup');
    customGroup.label = 'Custom';
    customs.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        customGroup.appendChild(opt);
    });
    tuningSelect.appendChild(customGroup);
}
```

Note: `tunings` in `screen.js` is a flat merged object. Reconstruct group membership from `defaultTunings` which is available from `loadConfig()`.

### Story Dependencies

This story should be done LAST — after 2.2, 2.3, 2.4, and 2.5 are complete and merged. Some changes (e.g., py-2 on string buttons) overlap with class strings also touched in 2.5; if applied out of order, the string button classes will need reconciling. Implement in order.

### References

- [Source: visualization/default.js] — `update()`, constructor DOM setup
- [Source: visualization/strobe.js] — `wrap` creation
- [Source: screen.js] — `renderStringNotes()`, `renderTuningOptions()`, `initUI()`, `_syncActiveStringFromFreq()`, `_syncStringHighlight()`, `updateFloatingButton()`, `_showMicError()`
- [Source: settings.html] — `load()`, `render()`
- [Source: _bmad-output/planning-artifacts/ux-guidelines.md] — all Low priority items

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `visualization/default.js` (MODIFIED)
- `visualization/strobe.js` (MODIFIED)
- `screen.js` (MODIFIED)
- `settings.html` (MODIFIED)
