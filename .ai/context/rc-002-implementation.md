# Implementation Report — RC-002 Eliminate Release Candidate P1 Defects

## 1. Analysis

**P1 issue (RC-001-B1, from `.ai/context/rc-001-investigation.md`):** `SessionMemory` runs a 1000ms `setInterval` for the entire page lifetime. Polling begins at composition creation (`create-composition.ts:41` → `sessionMemory.start()`); `stop()` had zero callers. This was the only verified always-on background timer in the product (RC-001 Finding 8, Performance Inventory).

**Entry points:** `create-composition.ts:41` (`sessionMemory.start()`); badge wiring `companion-app.ts:231`; session list / export / import `companion-modal.ts:173,323,349`.

**Lifecycle ownership:** `SessionMemory` owns the interval (`trackingId`), save debounce (`saveTimer`), and dirty flag. `start()` is invoked once at composition creation; `stop()` was a dead lifecycle primitive.

**Current start path:** `start()` → load persisted events → record current URL if changed → start interval.

**Current cleanup path:** `stop()` → clear interval + clear save timer + flush. Never called.

**Dependencies:** `StorageService`, `STORAGE_KEYS`, `window.location`, `document.title`.

**Affected modules:** `SessionMemory` only. No consumer changes — badge, session list, export, and import behavior are untouched.

**Affected files:** `src/companion/session-memory.ts` (only file modified).

## 2. Implementation Plan

Eliminate the always-on timer by pausing polling while the page is hidden, using the Page Visibility API:

- On `visibilitychange` with `document.hidden === true`: pause the interval, clear the pending save debounce, and flush immediately.
- On `visibilitychange` with `document.hidden === false`: resume the interval and immediately run `checkPageChange()` to catch any URL change that occurred while hidden.
- `start()`: after the existing load/record logic, install the visibility listener and resume tracking (guarded to never create a duplicate interval and to not poll while hidden).
- `stop()`: full inverse of `start()` — remove the visibility listener, pause tracking, flush.
- Duplicate-safety: `resumeTracking()` no-ops when already running or when hidden; `installVisibilityListener()` no-ops when already bound.

**Why this approach (vs. alternatives):**
- **Pause-on-hidden** preserves 100% of user-visible behaviour: while a tab is hidden, no navigation can occur, so no events can be generated. The timer now runs only while the page is actually visible, which is the work the feature requires.
- **Lazy start on first modal open (suggested alternative)** was rejected: it drops navigations that occur before the first modal open of a page load and makes the badge go stale within a load — a user-visible regression.
- **Event-driven tracking (`popstate`/History hooks)** was rejected: explicitly backlogged as FUTURE (RC-001-F1) and out of scope for RC-002.
- **Longer interval** was rejected: it would remain always-on and does not address the finding.
- Reuses the existing `start()`/`stop()` shape and the existing `TRACK_INTERVAL_MS`/`SAVE_DEBOUNCE_MS` constants. No new abstractions, no new dependencies, no public API renames.

## 3. Modified Files

| Path | Reason |
|------|--------|
| `src/companion/session-memory.ts` | Eliminate the always-on 1Hz polling interval by pausing it while `document.hidden`. |

No other files were created, deleted, or modified. Repository state verified with `git status` — only `src/companion/session-memory.ts` is tracked-modified (36 insertions, 2 deletions).

## 4. Changes Per File

### `src/companion/session-memory.ts`

- Added `private visibilityBound = false` — tracks whether the `visibilitychange` listener is installed.
- `start()`: replaced direct `setInterval` assignment with `installVisibilityListener()` + `resumeTracking()`.
- `stop()`: now performs the full inverse — `removeVisibilityListener()` + `pauseTracking()` + `flush()` (previous interval/save-timer clearing logic preserved inside `pauseTracking()`).
- Added `resumeTracking()`: starts the interval only when the page is visible and no interval is already running (prevents duplicate timers).
- Added `pauseTracking()`: clears the interval and any pending save debounce.
- Added `installVisibilityListener()` / `removeVisibilityListener()`: idempotent binding/unbinding of the `visibilitychange` handler.
- Added `onVisibilityChange` handler: hidden → `pauseTracking()` + `flush()`; visible → `resumeTracking()` + immediate `checkPageChange()`.

## 5. Verification

| Item | Result | Evidence |
|------|--------|----------|
| TypeScript compilation | **VERIFIED** | `npx tsc --noEmit` exit 0 |
| Lint | **VERIFIED** | `npx eslint src/companion/session-memory.ts` exit 0 |
| Build | **VERIFIED** | `node build-extension-dev.mjs` exit 0 (single pre-existing warning: `versioning.ts` duplicate member "history" — P2 RC-001-B2, out of scope, not introduced by this change) |
| Imports / module graph | **VERIFIED** | esbuild bundle of `session-memory.ts` succeeded (exit 0); extension bundle contains the new logic (`extension/dist/content.js` — `onVisibilityChange`, `addEventListener("visibilitychange", …)`, `removeEventListener("visibilitychange", …)`) |
| Runtime lifecycle behaviour | **VERIFIED** | 17/17 assertions passed in Node harness against the bundled `SessionMemory` with real timers (see below) |
| No duplicate timers | **VERIFIED** | Instrumented interval tracking: exactly 1 live interval during visible polling, 0 while hidden, 1 after double `start()`, 0 after `stop()` |
| No regressions | **VERIFIED** | Event capture, initial-record, catch-up-on-resume, and teardown behaviour all verified; consumer APIs (`getEvents`, `getRecentCount`, `exportToJson`, `importFromJson`, `setNewEventCallback`) unchanged |
| Architectural consistency | **VERIFIED** | Only lifecycle internals of `SessionMemory` touched; no new abstractions/dependencies; pattern matches existing arrow-property handlers (cf. `companion-window.ts`) |

**Runtime harness scenarios (Node, real timers, instrumented `setInterval`/`clearInterval`, visibility shim):**
- A: `start()` while visible → interval created, 1 live interval, listener bound, initial event recorded. PASS
- B: URL change while visible → recorded within ~1.3s. PASS
- C: hide → interval cleared, 0 live intervals, URL change while hidden NOT recorded. PASS
- D: show → interval resumed, immediate catch-up of URL change, subsequent navigation recorded, exactly 1 live interval. PASS
- E: double `start()` → still 1 interval and 1 listener (idempotent). PASS
- F: `stop()` → interval cleared, 0 live intervals, listener removed. PASS
- G: `start()` while hidden → no interval, no event recorded; interval starts on visible. PASS

**EXPECTED (not directly observed):** on a live goldenbride.net page, the interval now runs only while the tab is visible; a hidden background tab performs zero session-memory polling and zero storage writes until visible again. This follows from the verified runtime harness + source, but no live-browser session was executed in this environment.

## 6. Remaining Limitations

- The interval still runs at 1Hz while the page is visible, even if Companion is never opened. This is inherent to the feature design (speculative capture of page visits) and matches the RC-001 recommendation scope; full elimination of polling is the FUTURE item RC-001-F1 (event-driven tracking).
- `stop()` remains without external callers. It is now a complete lifecycle inverse of `start()` and is exercised internally through the visibility handler; a caller may be added if a teardown path is ever introduced.
- The additional flush-on-hide partially mitigates RC-001-B4 (last-event data loss on rapid navigation) for the background-tab case but does **not** implement the full unload-flush fix (P2, out of scope).

## 7. Unknowns

- Live-browser runtime on goldenbride.net was not executed; runtime classification above is **VERIFIED** at the Node/real-timer level against the actual bundled code and **EXPECTED** for the browser context.
- Whether the CRM page ever changes `document.title` without a URL change is irrelevant to the poll (it only compares `window.location.href`) and was not investigated further (pre-existing behaviour).

## Engineering Rationale

- Kept the change to one file, reusing the existing interval/debounce constants and the `start()`/`stop()` public shape, per the "prefer extending the existing implementation" constraint.
- Pause-on-hidden was chosen over lazy-start because it is the only option that removes unnecessary always-on background work without changing user-visible behaviour.
- The visibility handler is an arrow-function property so the same reference can be passed to both `addEventListener` and `removeEventListener`, matching the existing `CompanionWindow` pattern.

## Review Metrics

- **Functions added:** 5 private methods (`resumeTracking`, `pauseTracking`, `installVisibilityListener`, `removeVisibilityListener`, `onVisibilityChange`).
- **Functions modified:** 2 public methods (`start`, `stop`).
- **Exported APIs changed:** none.
- **Interfaces changed:** none.
