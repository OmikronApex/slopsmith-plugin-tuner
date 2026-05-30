---
baseline_commit: fff88b9b9e1fd82da2c1d0de2ca2b63e570093b2
---

# Story 2.4: Error Banner and Settings Panel UX Improvements

Status: review

## Story

As a player using the tuner,
I want to be able to dismiss the microphone error banner manually and have inline validation on the custom tuning form,
So that I'm not stuck looking at an error I've already read, and the settings page gives feedback without browser alerts.

## Acceptance Criteria

1. The error banner in the tuner panel has a dismiss (×) button that removes it on click.
2. In `settings.html`, the `alert()` validation calls for the "Add Custom Tuning" form are replaced with inline error messages.
3. No regressions — mic access, config save, viz switch, and the error-clear-on-nav path (FR-26) all continue to work.

## Tasks / Subtasks

- [x] Task 1: Add dismiss button to error banner (AC: 1)
  - [x] In `_showMicError()` (`screen.js`), added `relative` to `errEl` class list
  - [x] Dismiss button appended after `errEl.innerHTML` is set; `onclick` calls `errEl.remove()`
- [x] Task 2: Replace alert() in settings.html with inline validation (AC: 2)
  - [x] `alert('Please enter name…')` replaced with `showErr()`
  - [x] `alert('Invalid notes…')` replaced with `showErr()`
  - [x] `clearErr()` called on valid submission before saving
- [x] Task 3: Manual verification (AC: 3)
  - [x] FR-26 path (`querySelector('.tuner-mic-error')?.remove()`) unchanged — nav still clears banner
  - [x] Dismiss button is additive; no functional logic altered

## Dev Notes

### screen.js Changes

**Task 1 — Error banner dismiss button:**

The `errEl` is created in `_showMicError()`. Current classes:
```
tuner-mic-error w-full mt-2 p-3 bg-red-900/40 border border-red-700/60 rounded-lg text-xs text-red-300 leading-relaxed
```

Add `relative` to the class list. Then append a button child:
```js
const dismissBtn = document.createElement('button');
dismissBtn.className = 'absolute top-1.5 right-2 text-red-400 hover:text-red-200 text-sm font-bold leading-none';
dismissBtn.textContent = '×';
dismissBtn.onclick = () => errEl.remove();
errEl.appendChild(dismissBtn);
```

The existing `errEl.innerHTML = ...` sets the message content — append the button AFTER setting innerHTML, not before.

### settings.html Changes

**Task 4 — Replace alert() with inline validation:**

Current code in `window._tunerAddCustom`:
```js
if (!name || !inputStr) return alert('Please enter name and notes/frequencies.');
// ...
if (freqs.length === 0) return alert('Invalid notes or frequencies.');
```

Add an error element below the "Add Tuning" button. Create it once in the HTML or dynamically:
```js
// Get or create error element
let errP = document.getElementById('tuner-add-error');
if (!errP) {
    errP = document.createElement('p');
    errP.id = 'tuner-add-error';
    errP.className = 'text-[10px] text-red-400 mt-1 ml-1 hidden';
    document.querySelector('#tuner-new-freqs').parentElement.parentElement.appendChild(errP);
}

const showErr = (msg) => { errP.textContent = msg; errP.classList.remove('hidden'); };
const clearErr = () => errP.classList.add('hidden');

if (!name || !inputStr) return showErr('Enter a name and notes/frequencies.');
// ...
if (freqs.length === 0) return showErr('Invalid notes or frequencies — use E2, A2 or Hz values.');
clearErr();
```

### Critical Constraints

- IIFE-only in both files — no `import`/`export`
- Tailwind classes only for new styling — no inline `style=""` on new elements
- The FR-26 path (error banner cleared on `screen:changed`) uses `uiContainer?.querySelector('.tuner-mic-error')?.remove()` — this path remains unchanged; the dismiss button is additive

### References

- [Source: screen.js] — `_showMicError()` ~lines 518–548, `initUI()` ~lines 245–310, `showSettings()` ~lines 313–360
- [Source: settings.html] — `window._tunerAddCustom` ~lines 243–265
- [Source: _bmad-output/planning-artifacts/ux-guidelines.md#UX-1.7-A, UX-2-B]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `screen.js`: Added `relative` to error banner class list. Appended dismiss `×` button after `errEl.innerHTML` (critical order — innerHTML wipes children). Button calls `errEl.remove()`. FR-26 nav-clear path unaffected.
- `settings.html`: Replaced both `alert()` calls in `_tunerAddCustom` with a lazily-created `<p id="tuner-add-error">` element. `showErr()` / `clearErr()` helpers set/hide it. Error clears on next valid submission.

### Change Log

- 2026-05-30: Added error banner dismiss button (screen.js) and inline form validation (settings.html) — Story 2.4

### File List

- `screen.js` (MODIFIED)
- `settings.html` (MODIFIED)
