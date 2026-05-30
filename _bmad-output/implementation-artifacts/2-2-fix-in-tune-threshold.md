# Story 2.2: Fix In-Tune Threshold in Visualizations

Status: dismissed

## Story

As a guitarist or bassist using the tuner,
I want the visualizations to indicate "in tune" at ±2 cents — not ±5 cents,
So that the visual feedback matches the accuracy the plugin is capable of and the PRD specifies.

## Acceptance Criteria

1. In `visualization/default.js`, the note name turns `text-green-400` only when `Math.abs(cents) < 2` (was `< 5`).
2. In `visualization/default.js`, the gauge needle turns green only when `Math.abs(cents) < 2` (was `< 5`).
3. In `visualization/strobe.js`, the strobe opacity is `1.0` only when `Math.abs(cents) < 2` (was `< 5`).
4. No regressions — viz switch, destroy/init cycle, and null-signal paths continue to work correctly.

## Tasks / Subtasks

- [ ] Task 1: Fix Default visualization threshold (AC: 1, 2)
  - [ ] `visualization/default.js` line ~57: change `Math.abs(cents) < 5` → `Math.abs(cents) < 2` (note text colour)
  - [ ] `visualization/default.js` line ~66: change `Math.abs(cents) < 5` → `Math.abs(cents) < 2` (needle colour)
- [ ] Task 2: Fix Strobe visualization threshold (AC: 3)
  - [ ] `visualization/strobe.js` in `update()`: change `Math.abs(cents) < 5` → `Math.abs(cents) < 2` (strobe opacity)
- [ ] Task 3: Manual verification (AC: 4)
  - [ ] Open tuner, play a note in tune — green only appears when within ±2 cents
  - [ ] Strobe stops spinning only within ±2 cents
  - [ ] Viz switch (Default ↔ Strobe) works cleanly; no errors in console

## Dev Notes

### Exact Changes

**`visualization/default.js` — two locations:**

```js
// Line ~57: note text colour (in update() function)
// BEFORE:
noteText.className = 'text-5xl font-black ' + (Math.abs(cents) < 5 ? 'text-green-400' : 'text-white');
// AFTER:
noteText.className = 'text-5xl font-black ' + (Math.abs(cents) < 2 ? 'text-green-400' : 'text-white');

// Line ~66: needle colour (in update() function)
// BEFORE:
if (Math.abs(cents) < 5) {
// AFTER:
if (Math.abs(cents) < 2) {
```

**`visualization/strobe.js` — one location:**

```js
// In update() function — strobe opacity
// BEFORE:
strobeEl.style.opacity = Math.abs(cents) < 5 ? '1' : '0.6';
// AFTER:
strobeEl.style.opacity = Math.abs(cents) < 2 ? '1' : '0.6';
```

### Why This Is a Bug

FR-17 states: "indicator turns green within ±2 cents". NFR-01 states ±2 cents accuracy. The ±5 threshold means the plugin shows "in tune" even when the pitch is 3–4 cents off — within its measurable range but not its stated accuracy target.

### What NOT to Touch

- The `null` signal path (`note === null`) — no changes needed
- The `rms < 0.01` / `confidence < 0.5` guards in `screen.js` — not affected
- The `destroy()` functions — not affected
- `gaugeNeedle.style.left` and `strobeEl.style.backgroundPosition` — functional offsets, exempt from NFR-07

### References

- [Source: visualization/default.js] — `update()` function, lines ~45–80
- [Source: visualization/strobe.js] — `update()` function, lines ~138–168
- [Source: _bmad-output/planning-artifacts/ux-guidelines.md#UX-1.1-A, UX-1.3-A]
- [Source: PRD FR-17, NFR-01]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `visualization/default.js` (MODIFIED)
- `visualization/strobe.js` (MODIFIED)
