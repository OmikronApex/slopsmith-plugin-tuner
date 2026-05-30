# Story 2.3: Fix NFR-07 Inline Style Violations in Settings Page

Status: ready-for-dev

## Story

As a contributor maintaining the plugin,
I want `settings.html` to use only Tailwind utility classes for styling,
So that the settings page complies with NFR-07 (no inline `style=""` attributes) and is consistent with the rest of the plugin.

## Acceptance Criteria

1. `chevron.style.transform` assignments are replaced with Tailwind class toggles (`rotate-0` / `rotate-90`).
2. `div.style.borderTop = 'none'` is replaced with a Tailwind class (`border-t-0`).
3. The collapsible group expand/collapse animation still works correctly — chevron rotates, content shows/hides.
4. No other inline styles are introduced.
5. No regressions in the settings page — floating button toggle, tuning visibility checkboxes, and custom tuning add/delete all work.

## Tasks / Subtasks

- [ ] Task 1: Replace chevron inline style with Tailwind classes (AC: 1, 3)
  - [ ] Remove `chevron.style.transform = 'rotate(0deg)'` — replace with `chevron.classList.remove('rotate-90')`
  - [ ] Remove `chevron.style.transform = 'rotate(90deg)'` — replace with `chevron.classList.add('rotate-90')`
  - [ ] Add `rotate-0` as a default class on the chevron `<span>` and `transition-transform duration-200` for animation
- [ ] Task 2: Replace `div.style.borderTop = 'none'` with Tailwind class (AC: 2)
  - [ ] Replace `div.style.borderTop = 'none'` → add `border-t-0` class to the first item in each group
  - [ ] The condition is `if (idx === 0)` — replace with a conditional class addition
- [ ] Task 3: Manual verification (AC: 3, 4, 5)
  - [ ] Collapse/expand tuning groups — chevron rotates correctly
  - [ ] Floating button toggle works
  - [ ] Custom tuning add/delete works

## Dev Notes

### Current Violations in settings.html

**Violation 1 — chevron rotation (two locations in `render()`):**

```js
// BEFORE (inside render(), when group is NOT expanded):
chevron.style.transform = 'rotate(0deg)';
// AFTER:
chevron.classList.remove('rotate-90');

// BEFORE (inside render(), when group IS expanded):
chevron.style.transform = 'rotate(90deg)';
// AFTER:
chevron.classList.add('rotate-90');
```

The SVG inside the `chevron` span already has `class="w-3 h-3 transition-transform duration-200"`. Move `transition-transform duration-200` to the outer `chevron` span so the rotation animates, then just toggle `rotate-90` on the span.

Updated chevron element creation:
```js
chevron.className = 'text-gray-500 transition-transform duration-200';
// (remove transition-transform from the SVG element class)
```

**Violation 2 — first-item border removal (in `groupTunings.forEach`):**

```js
// BEFORE:
const div = document.createElement('div');
div.className = 'flex items-center justify-between p-2 bg-dark-800/30 hover:bg-dark-800/50 transition-colors border-t border-gray-800/20';
if (idx === 0) div.style.borderTop = 'none';

// AFTER:
div.className = `flex items-center justify-between p-2 bg-dark-800/30 hover:bg-dark-800/50 transition-colors ${idx === 0 ? 'border-t-0' : 'border-t border-gray-800/20'}`;
```

### What NOT to Touch

- `strobeEl.style.backgroundPosition` and `gaugeNeedle.style.left` — these are in viz files, not settings.html, and are the exempt functional animation offsets
- The `expandedGroups` array logic — only the style assignments change, not the data model
- All other settings.html CSS classes — only fix the two inline style violations

### Critical Project Rules

- settings.html is an IIFE — all code is inside `(function() { ... })()`
- No ES modules, no `import`/`export`
- Tailwind classes are applied by the host app; all utility classes are available

### References

- [Source: settings.html] — `render()` function, chevron creation ~line 108–112, tuning item creation ~lines 165–170
- [Source: _bmad-output/planning-artifacts/ux-guidelines.md#UX-2-A]
- [Source: _bmad-output/planning-artifacts/architecture.md — NFR-07]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `settings.html` (MODIFIED)
