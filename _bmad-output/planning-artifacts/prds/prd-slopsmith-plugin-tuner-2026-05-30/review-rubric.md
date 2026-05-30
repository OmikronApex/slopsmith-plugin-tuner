# PRD Quality Review — slopsmith-plugin-tuner

## Overall verdict

A well-constructed baseline PRD for a feature-complete hobby plugin. It reads honestly, avoids persona theater, and the FR list is specific enough to act on. The main gaps are minor: one internal inconsistency in defaults (OQ-02 should be a stated assumption, not an open question), light coverage of what "done" looks like for the two visualizations, and a few NFRs that duplicate FRs rather than adding orthogonal constraint.

---

## Decision-readiness — strong

The problem statement is concrete (§2: players must leave the app to tune; Real Tone Cable users need native support). Goals map cleanly to success metrics (§3). Counter-metrics are present. Constraints and non-goals are explicit (§7). A decision-maker can read this and know what the plugin does, why, and what it deliberately does not do.

### Findings

- **low** Missing version-lifecycle framing (§1) — The PRD states v1.2.5 is the "feature-complete baseline" but does not say what that means for the future: is this a maintenance-only artifact? Are new features gated on community requests? One sentence of intent would close this. *Fix:* Add a one-sentence disposition note after "Current version: 1.2.5" — e.g., "This PRD documents the current baseline. Future features require a community request threshold (see OQ-03)."

---

## Substance over theater — strong

No NFR boilerplate. NFR-01 through NFR-07 all have a specific, testable flavor — sample rates named, timing interval given (30 ms), Tailwind tokens referenced. The user section (§4) is two sentences, which is exactly right for a hobby plugin; it does not pad personas with fictional names or invented empathy quotes. Counter-metrics in §3 are a genuine addition.

### Findings

- **medium** NFR-04 duplicates FR-04 verbatim (§5.1, §6) — "Audio processing shall run in a dedicated Web Worker" appears identically in both sections. NFRs should add orthogonal constraint (e.g., Worker startup budget, memory ceiling), not restate FRs. *Fix:* Either drop NFR-04 and note the constraint is captured in FR-04, or reframe it as a performance constraint (e.g., "Worker must initialise within X ms of panel open").

- **low** NFR-06 duplicates FR-16 almost verbatim (§5.6, §6) — Same pattern as above. *Fix:* Convert NFR-06 to an architectural constraint ("no changes to `core/` files required") or remove it.

---

## Strategic coherence — strong

There is a clear thesis: embed a self-contained, accurate, low-friction tuner into Slopsmith so players never leave the app. Every feature section serves that arc — song-aware tuning (§5.4), graceful fallback for pro audio hardware (§5.7, FR-22), error recovery that keeps the user in-app (§5.8). The visualization extensibility hook (FR-16) is a mild outlier — it enables future contributors but is not required by the thesis — yet it is scoped narrowly enough not to bloat.

### Findings

- **low** FR-28/FR-29 interaction not reconciled (§5.9) — FR-28 says the floating button is hidden during active song playback; FR-29 says a separate player-controls button is injected. The PRD does not state whether both can be visible at the same time during the loading/pre-playback window, or whether they are mutually exclusive. This is a small edge but a reader implementing this could make either choice. *Fix:* Add one sentence: "The floating button and the player-controls button are mutually exclusive — exactly one is visible at any time when the plugin is active."

---

## Done-ness clarity — adequate

Most FRs are specific enough. FR-01 names the algorithm (YIN), the frame size (4,096 samples), and anchors to the device sample rate. FR-24 provides the exact error-message copy in a table. FR-05 enumerates every preset by name.

Three FRs are underspecified:

### Findings

- **high** FR-17: Visualization behavior undefined (§5.6) — "Needle/gauge with cents readout and color-coded in-tune indicator" leaves the threshold for "in-tune" unspecified. What cent deviation triggers the green state? Without this, two implementations of the same spec could disagree on the visual result. *Fix:* Add "(in-tune = within ±N cents)" to FR-17, consistent with the ±2 cents accuracy metric in §3.

- **medium** FR-10: "Current Song" option lifecycle ambiguous (§5.4) — When does the option appear/disappear? On song load? On player screen activation? What happens if the song has no tuning metadata? *Fix:* Add: "The option appears when `highway` returns a non-null tuning offset; it disappears when the player screen is exited or a new song without tuning metadata is loaded."

- **low** FR-07/FR-08 settings surface not specified (§5.2, §5.3) — Both reference "Plugin Manager settings" but the PRD does not describe what that surface looks like or link to it. For a standalone PRD documenting existing behavior this is acceptable, but a future reader will not know if the Plugin Manager is a modal, a sidebar, or a route. *Fix:* Add a one-liner: "Plugin Manager settings = the per-plugin settings panel accessible from the Slopsmith Plugin Manager screen (existing Slopsmith feature, not defined here)."

---

## Scope honesty — adequate

Non-goals are explicit and well-chosen (§7): no mobile, no MIDI, no polyphonic, no standalone mode. Open questions are tabulated with owners and revisit conditions (§8), which is good practice.

### Findings

- **medium** OQ-02 is a ship-blocking inconsistency, not an open question (§8) — The backend and frontend disagree on the default visualization (`"default"` vs `"strobe"`). This is a latent bug for new installs, not a strategic ambiguity. Leaving it as an "open question" lets it drift. *Fix:* Resolve it in the PRD (pick one canonical default, e.g., `"default"` since it is the backend source of truth), document the chosen value in FR-18 or a config note, and remove OQ-02 from the table.

- **low** Assumption about browser environment is implicit (§7) — The PRD constrains to "desktop browser only" but does not name which browsers are in scope. Slopsmith's embedded browser (if it uses Electron/CEF) vs. a general Chrome/Firefox target changes whether Web Worker, `localStorage`, and `MediaDevices` API availability are actually guaranteed. *Fix:* Add one line: "Target runtime: [Electron / Chrome / Firefox — specify]."

---

## Downstream usability — adequate

*Note: lighter weight per review brief — standalone PRD, no downstream UX/architecture workflow planned.*

FR IDs are stable and sequential. The error-message table (FR-24) is copy-paste ready. The preset table (FR-05) is implementation-ready.

### Findings

- **low** No cross-reference between FR-32/FR-33 (§5.10) — The config persistence FRs reference a REST API but do not link to FR-08 (custom tunings) or FR-07 (show/hide tunings), which are the primary consumers of that API. A reader implementing stories would have to infer the connection. *Fix:* Add parenthetical refs: "FR-32 (persists data defined by FR-07, FR-08, FR-18, FR-21, FR-30)."

---

## Shape fit — strong

The PRD is appropriately sized for a hobby/community plugin documenting a feature-complete product. It is not a vision document, a roadmap, or a greenfield spec — it reads as a faithful inventory of what exists, why it exists, and where the edges are. Length is right (no padding). The open-questions table is the correct mechanism for surfacing remaining uncertainty without inflating scope. The success metrics are honest about measurement difficulty at hobby scale (no user analytics, no A/B infrastructure implied).

### Findings

- **low** Status tag is "draft" (frontmatter) — If this is a baseline document for a shipped product, "draft" understates its authority. *Fix:* Change to `status: baseline` or `status: approved` after the team is satisfied with the review.

---

## Mechanical notes

- **Glossary drift**: "Plugin Manager" (§5.2, §5.3, §5.9) and "Plugin Manager settings" are used interchangeably. Standardise to one term.
- **ID continuity**: FR-01 through FR-33 and NFR-01 through NFR-07 are continuous with no gaps. OQ-01 through OQ-03 are continuous. No issues.
- **Table formatting**: FR-05 preset table and FR-24 error table render correctly in standard Markdown. No issues.
- **Inconsistent capitalization**: "Plugin Manager" (capitalized, correct) vs. "plugin config API" (lowercase, §5.10) — pick one convention for "plugin."
