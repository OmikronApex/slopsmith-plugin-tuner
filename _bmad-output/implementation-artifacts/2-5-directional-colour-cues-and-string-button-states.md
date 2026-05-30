# Story 2.5: Directional Colour Cues and String Button State Clarity

Status: dismissed

## Story

As a player using the tuner,
I want the gauge needle to show blue when I'm flat and amber when I'm sharp, and I want a visible distinction between which string the tuner has auto-detected vs. which one I've manually locked,
So that I can read tuning direction at a glance and know whether the tuner is following me or I'm controlling it.

## Acceptance Criteria

1. In `visualization/default.js`, the gauge needle is `bg-blue-400` when `cents < -2` (flat), `bg-amber-400` when `cents > 2` (sharp), and `bg-green-400` when `Math.abs(cents) <= 2` (in tune). White is no longer used for sharp/flat.
2. In `visualization/strobe.js`, a small cents text readout (e.g. `+3 ¢` or `-1 ¢`) appears below the strobe panel when a signal is detected, and is hidden when no signal.
3. In `screen.js`, the auto-detected string button uses an outline style (`border-accent text-accent bg-transparent`) and the manual-locked string uses a filled style (`bg-accent text-white`), making the two states visually distinct.
4. No regressions — null signal, viz switch, destroy/init cycle, and the existing string button click-to-lock/click-to-unlock behaviour all continue to work.

## Tasks / Subtasks

- [ ] Task 1: Directional needle colour in Default viz (AC: 1)
  - [ ] Replace needle colour logic in `visualization/default.js` `update()` with three-state conditional
  - [ ] `cents < -2` → `bg-blue-400` (flat), `cents > 2` → `bg-amber-400` (sharp), else → `bg-green-400` (in tune)
  - [ ] Update the null-signal reset path to restore needle to `bg-white` (no-signal neutral)
- [ ] Task 2: Cents text readout below Strobe viz (AC: 2)
  - [ ] Add a `<div>` below `wrap` in `visualization/strobe.js` constructor for the cents readout
  - [ ] Show `+X ¢` / `-X ¢` / `0 ¢` when signal present; hide (or show `—`) when `note === null`
  - [ ] Styling: `text-xs font-mono text-accent/70 text-center mt-1`
- [ ] Task 3: Distinct auto vs. manual string button states (AC: 3)
  - [ ] In `screen.js` `_syncActiveStringFromFreq()`, change the auto-detected class from `bg-dark-700 text-accent border border-accent` to `bg-transparent text-accent border-2 border-accent`
  - [ ] Manual-locked class remains `bg-accent text-white border border-accent` (filled)
  - [ ] In `_syncStringHighlight()` (used for manual lock highlight), confirm class is the filled version
- [ ] Task 4: Manual verification (AC: 4)
  - [ ] Play a flat note → needle turns blue; sharp → amber; in tune → green
  - [ ] Strobe shows `+3 ¢` style readout below panel; disappears on no signal
  - [ ] Auto-detected string has outline accent; manually tapped string has filled accent
  - [ ] Tap locked string again → returns to auto (outline) state

## Dev Notes

### visualization/default.js — Needle Colour Change

Current needle colour logic in `update(note, cents, freq)`:

```js
// CURRENT (lines ~66-70):
if (Math.abs(cents) < 5) {
    gaugeNeedle.className = '... bg-green-400 ...';
} else {
    gaugeNeedle.className = '... bg-white ...';
}

// NEW (after Story 2.2 fixes threshold to < 2):
if (cents < -2) {
    gaugeNeedle.className = 'absolute top-0 bottom-0 w-1 bg-blue-400 transition-all duration-100 ease-out -translate-x-1/2 z-20 shadow-[0_0_8px_rgba(96,165,250,0.5)]';
} else if (cents > 2) {
    gaugeNeedle.className = 'absolute top-0 bottom-0 w-1 bg-amber-400 transition-all duration-100 ease-out -translate-x-1/2 z-20 shadow-[0_0_8px_rgba(251,191,36,0.5)]';
} else {
    gaugeNeedle.className = 'absolute top-0 bottom-0 w-1 bg-green-400 transition-all duration-100 ease-out -translate-x-1/2 z-20 shadow-[0_0_8px_rgba(74,222,128,0.5)]';
}
```

Null-signal reset (in `update(null, ...)` branch) should restore to neutral white:
```js
gaugeNeedle.className = 'absolute left-1/2 top-0 bottom-0 w-1 bg-white transition-all duration-100 ease-out -translate-x-1/2 z-20 shadow-[0_0_8px_rgba(255,255,255,0.5)]';
```

**Depends on Story 2.2 being complete** — threshold must already be ±2 before applying colour changes.

### visualization/strobe.js — Cents Readout

Add a new DOM element after `container.appendChild(wrap)` in the factory:

```js
const centsReadout = document.createElement('div');
centsReadout.className = 'text-xs font-mono text-accent/70 text-center mt-1 h-4';
centsReadout.textContent = '';
container.appendChild(centsReadout);
```

In `update(note, cents, freq)`:
```js
if (note === null) {
    centsReadout.textContent = '—';
} else {
    centsReadout.textContent = (cents > 0 ? '+' : '') + cents.toFixed(0) + ' ¢';
}
```

In `destroy()`:
```js
centsReadout.remove();
```

### screen.js — String Button State Classes

Current auto-detected class (in `_syncActiveStringFromFreq`, non-manual branch):
```js
'flex-1 py-1.5 text-xs font-bold rounded bg-dark-700 text-accent border border-accent transition-colors'
```

New auto-detected class (outline, no fill):
```js
'flex-1 py-1.5 text-xs font-bold rounded bg-transparent text-accent border-2 border-accent transition-colors'
```

Manual-locked class (unchanged — filled):
```js
'flex-1 py-1.5 text-xs font-bold rounded bg-accent text-white border border-accent transition-colors'
```

The inactive class (unchanged):
```js
'flex-1 py-1.5 text-xs font-bold rounded bg-dark-700 text-gray-400 border border-gray-800 hover:border-gray-600 transition-colors'
```

### Story Dependency

This story depends on Story 2.2 (threshold fix) being complete before applying the needle colour logic, since the colour branches use `< 2` / `> 2`. If Story 2.2 is not yet merged, apply both the threshold fix AND colour logic in this story to avoid a two-story dependency.

### References

- [Source: visualization/default.js] — `update()` function, needle colour logic ~lines 66–70
- [Source: visualization/strobe.js] — factory constructor, `update()`, `destroy()`
- [Source: screen.js] — `_syncActiveStringFromFreq()` ~lines 231–243, `_syncStringHighlight()` ~lines 221–229
- [Source: _bmad-output/planning-artifacts/ux-guidelines.md#UX-1.2-A, UX-1.3-B, UX-1.4-A]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `visualization/default.js` (MODIFIED)
- `visualization/strobe.js` (MODIFIED)
- `screen.js` (MODIFIED)
