# RC-STABLE-002-FIX-002 Implementation Report

## 1. Objective

Fix the browser-confirmed bug where the Finance widget starts collapsed on a non-chat route, the operator expands it, the data request succeeds, but the widget remains stuck on `Loading…` indefinitely. Additionally guarantee that the Finance controller never remains permanently in the `loading` state and that stale responses cannot overwrite a newer request.

## 2. Baseline

- **Repository**: `edfrrtg7-dot/Companion`
- **Baseline Commit**: `43fa82829f7d5961a02e022f87eb8db7317dd620` (RC-STABLE-002-FIX-001, HEAD == origin/master verified at start of this EPIC)
- **Branch**: `master`
- **Version**: 2.1.0 (package.json, app-version.ts, manifest.json all in sync — `version:check` exit 0)

## 3. Runtime Evidence

Captured from the live bug (probe + network, provided with the task):

- Reproduced at `https://goldenbride.net/lady#!HOME;favoriteForLadyId=1408104`.
- Widget mounted and visible, `collapsed: false`, `persistedCollapsed: false`, rect `x:12 y:13 700×600`; body text preview contained `Loading`; `txRowCount` 0.
- Request `GET /usermodule/services/agencyhelper/v2?command=finances&from=2026-08-03&to=2026-08-03` → **200**, 328.2 ms.
- Response body: `{ total: 1.5, from: "2026-08-03", to: "2026-08-03", list: [{ date: 1785705463000, ladyID: 1408104, name: "Kira", sum: 1.5, userID: 819531, operation: "EmailRead" }], success: true }`.
- `errors: []` in the finance diagnostics.
- Timestamp `1785705463000` = 2026-08-02 21:17:43 UTC / 2026-08-03 00:17:43 GMT+3.

Implication: the request, HTTP status, JSON parsing, and payload are all valid. The exact internal boundary where the loaded state stopped reaching the rendered body was UNKNOWN before this EPIC and is established below from repository + executable evidence.

## 4. Repository Evidence

Files inspected (all at baseline `43fa828`):

- `src/companion/finance-controller.ts` — `refresh()` returned without a terminal state on the aborted-signal paths (former L164–166 and L188–190), leaving `status: "loading"` forever when the active request was cancelled with no successor. The success path (former L186) wrote `setState({ status: "loaded", ... })` with no current-request guard, so a request that resolved just before being superseded could overwrite a newer request's state.
- `src/companion/finance-widget.ts` — `render()` (L350–357) skips `updateContent()` whenever `win.collapsed` is true, silently dropping any state notification received while collapsed. `expand()` (L211–219) refreshed only on the *first* expand (`firstExpandDone`) and never re-rendered the controller's current state afterward.
- `src/companion/finance-module.ts` — `onHashChange()` collapses the widget on non-chat routes (L381–384); `restartWidgetAndShow()`/`toggle()` destroy the widget (`destroy()` → `unsubscribe()` then `cancelPending()`, finance-widget.ts L163–164), which cancels any in-flight request.
- `src/companion/companion-window.ts` — `collapse()`/`expand()`/`toggleCollapse()`; no refresh or cancel logic on collapse.
- `src/companion/finance-mapper.ts` — `Operation` enum includes `EmailSendSatellite` (L52); `parseOperation()` rejects unknown operations; `mapResponse()`/`mapTransaction()` validate all required fields.
- `src/companion/companion-diagnostics-collectors.ts` — `collectFinanceData()` reads `state.status`/`isLoading` as passthrough values (no exhaustive switch), so no status-model expansion was required.
- `agencybooster-devtoolkit/rc-stable-001-harness.ts`, `rc-stable-002-fix-001-harness.ts`, `rc-polish-004-fix-harness.ts` — harness template (esbuild bundle + node run).

Grep-confirmed facts:
- Only the Finance controller's `refresh()` can leave `status: "loading"`; the only cancellation sources are `cancelPending()`, `setShift()`, `setDateRange()`, `FinanceWidget.destroy()`, and `FinanceModule.dispose()`.
- Only `finance-widget.ts` renders on `FinanceStatus` (single `switch` in `updateContent()`).
- No polling, timers, or retry loops exist anywhere in the Finance lifecycle.

## 5. Root Cause

Two structural defects combine to produce the stuck `Loading…`:

**Defect A (widget — primary).** `render()` drops any state notification received while the widget is collapsed, and `expand()` re-renders nothing after the first expand. If the widget is collapsed at any moment while a refresh is in flight (operator collapse/expand toggle, header double-click, or the SPA `hashchange` → `onHashChange()` → `collapse()` path on a non-chat route), the successful `loaded` notification is silently discarded. On re-expand the widget shows the stale `Loading…` content while `controller.status === "loaded"` — indefinitely.

**Defect B (controller — secondary).** `refresh()` returns early on an aborted signal without writing a terminal state. Any cancellation of the active request with no successor (widget restart/destroy during flight via launcher `toggle()`/`restartWidgetAndShow()`/`dispose()`) leaves `status: "loading"` permanently; a successor widget then renders `Loading…` with no terminal state ever arriving. The success path also lacked a current-request guard, permitting a stale response (resolved just before being superseded) to overwrite a newer request's state.

## 6. Modified-File Plan

| File | Evidence | Required change | Expected side effects |
|------|----------|-----------------|-----------------------|
| `src/companion/finance-controller.ts` | Aborted-returns leave `loading` (Defect B); no stale guard on success path | Add monotonic `requestSeq`; guard every terminal write with `seq === this.requestSeq`; on cancelled-with-no-successor call new `exitLoadingOnCancellation()` → `loading → idle` preserving `data`, clearing `error` | Controller always exits `loading`; superseded requests never write; stale responses discarded; public API unchanged |
| `src/companion/finance-widget.ts` | `render()` drops state while collapsed; `expand()` never re-renders after first expand (Defect A) | `expand()`: keep exactly-one refresh on first expand; on later collapse→expand transitions render `controller.getState()` (no request) | Re-expanded widget shows the current state (loaded/empty/error/idle/loading), never stale `Loading…`; first-expand single refresh preserved |
| `scripts/Companion.user.js`, `scripts/Companion.arena.user.js` | Regenerated build artifacts (tracked; repository policy) | Regenerated by `npm run build` / `npm run build:arena` | Artifacts reflect the two source changes |

No other files required changes; no `FinanceStatus` members added; no interfaces, exports, or snapshot shapes changed.

## 7. Modified Files

1. `src/companion/finance-controller.ts`
2. `src/companion/finance-widget.ts`
3. `scripts/Companion.user.js` (regenerated build artifact)
4. `scripts/Companion.arena.user.js` (regenerated build artifact)
5. `.ai/context/rc-stable-002-fix-002-implementation.md` (this report)

## 8. Changes Per File

### `src/companion/finance-controller.ts`
- **Added** `private requestSeq = 0` — monotonic generation counter for the request sequence mechanism.
- **Modified** `refresh()`:
  - After creating the request `AbortController`, captures `const seq = ++this.requestSeq`.
  - Success path: after `await fetchTransactions(...)`, discards the result when `seq !== this.requestSeq` (superseded/stale — no state write); when the current request's signal is aborted, calls `exitLoadingOnCancellation()`; re-checks `seq === this.requestSeq` after `mapResponse()`; only then writes `loaded`.
  - Catch path: discards when `seq !== this.requestSeq`; calls `exitLoadingOnCancellation()` when the current signal is aborted; otherwise preserves the existing error mapping (`FinanceApiAbortError` → "Request timed out", `FinanceApiError`, generic `Error`, unknown).
  - The former aborted-signal `return` statements that left the controller permanently in `loading` are removed.
- **Added** `private exitLoadingOnCancellation()`:
  - `if (this.state.status === "loading") this.setState({ status: "idle", error: null })`.
  - Preserves existing `data`, `from`, `to`, `shift`, `unviewedTransactions`; clears the current error; publishes exactly one terminal state; guarded on status so it never overwrites a terminal state already produced by `setShift()`/`setDateRange()` (which set `idle` synchronously before the async settle runs).
  - Callers invoke it only for the current request (`seq === this.requestSeq`), per the mandatory ordering: detect abort → verify `seq === this.requestSeq` → then settle.

### `src/companion/finance-widget.ts`
- **Modified** `expand()`:
  - First collapse→expand transition (`!firstExpandDone`): unchanged — sets `firstExpandDone = true`, triggers exactly one `controller.refresh()`.
  - Later collapse→expand transitions: `this.render(this.controller.getState())` — re-renders the controller's current state immediately, with no new request.
  - Duplicate `expand()` while already expanded: `super.expand()` early-returns and `wasCollapsed` is false, so no refresh and no render.
  - `render()` handles every status the state machine can produce: `loaded`/empty → data or "No transactions for this shift."; `error` → error UI; `idle` → "Ready to load finance data."; `loading` → "Loading…".

## 9. Refresh State Machine

```
idle → loading → loaded | error | idle   (cancelled with no successor → idle)
```

- Success → `loaded` (including a valid empty result → `loaded` with empty list; the widget renders "No transactions for this shift.").
- Network / mapper / validation failure → `error` (clears loading; CASH control re-enabled).
- Timeout → `error` ("Request timed out") — the external signal is *not* aborted on timeout, so the timeout path reaches the error mapping, not the cancellation path.
- Cancellation with a successor request → superseded request writes nothing; the successor owns the terminal state.
- Cancellation with no successor → `exitLoadingOnCancellation()` → `idle`, preserving `data`.
- No path leaves the controller permanently in `loading`.

## 10. Expand Lifecycle

- **First expand** (collapsed→expanded, `firstExpandDone` false): exactly one refresh; loading → loaded/error terminal states.
- **Re-expand** (later collapse→expand): renders `controller.getState()` immediately; no refresh; correct for loaded, empty, error, idle, and still-loading states; never relies on cached widget state.
- **Duplicate expand while already expanded**: no-op (no request, no render).
- **Collapse during in-flight request**: the request is not cancelled by collapse; it completes and the controller reaches `loaded`. The `loaded` notification is skipped by `render()` while collapsed (no DOM mutation), and the re-expanded widget renders the current state instead of stale `Loading…`.
- **Re-expand while still loading**: renders `Loading…` accurately (controller genuinely still loading), then the terminal state when it arrives.

## 11. Subscription Lifecycle

- The widget subscribes in its constructor and unsubscribes in `destroy()` **before** `cancelPending()` (finance-widget.ts L163–164), so a cancelled request's settle never notifies the destroyed widget.
- `restartWidgetAndShow()` destroys the old widget (unsubscribes) then constructs a new one: the old subscription is removed (subscriber count returns to module + new widget), and the new widget's constructor renders `getState()` (idle/loaded/error), never a stuck `loading`.
- The module's own subscription and the hashchange listener lifecycle are unchanged.

## 12. Loading-State Terminal Paths

| Terminal path | Guarantee |
|---|---|
| Success | `loaded` published with mapped data |
| Empty success | `loaded` published with empty list; empty-state message rendered |
| Network failure | `error` published; error UI rendered; CASH usable afterward |
| Mapper/validation failure | `error` published |
| Timeout | `error` ("Request timed out") |
| Cancellation with successor | no write from the superseded request; successor publishes the terminal state |
| Cancellation without successor | `idle` published once, `data` preserved, `error` cleared |

## 13. Cancellation and Stale Responses

- `requestSeq` is incremented only when a new request starts (`refresh()`). `cancelPending()`/`setShift()`/`setDateRange()` do not increment it, so a cancel-with-no-successor lets the in-flight request detect it is still the latest (`seq === this.requestSeq`) and settle to `idle`.
- `setShift()`/`setDateRange()` set `idle` synchronously; the async settle sees `status !== "loading"` and does not overwrite it.
- A response that resolved before being superseded is discarded by the `seq !== this.requestSeq` guard on the success path (harness scenario D: a late-arriving stale payload cannot overwrite a newer one).
- No request that is no longer current can write state (guards run before every terminal write, including the cancellation settle).

## 14. Runtime Harness

`agencybooster-devtoolkit/rc-stable-002-fix-002-harness.ts` — executable Node harness (untracked; not committed), following the established pattern: esbuild `--bundle --platform=node --format=cjs --external:jsdom`, then `node`. The mock `fetch` is fully controllable (deferred resolution, immediate resolution, and AbortError rejection on signal abort) so in-flight collapse, cancellation, and stale-response races are exercised deterministically. Mock transactions are dated at local midday so they always fall inside the seeded `morning` shift (avoiding the wall-clock trap that affects the polish-004 harness).

Result: **42 checks, 0 failures** (exit code 0).

| Group | Coverage (examples) |
|---|---|
| A — expand → loaded (primary repro) | non-chat startup collapsed + zero auto-refresh; first expand exactly one request; loading→loaded; controller emits; captured tx row (EmailRead, ladyID 1408104, userID 819531) rendered; credits 1.5; CASH indicator clears; duplicate expand no second request |
| B — collapse during flight (primary bug) | collapse during in-flight request → controller ends non-loading; no detached-DOM mutation; re-expand renders final state (row, no `Loading…`); no new request |
| C — cancellation / restart | restart during flight → controller settles `idle` (terminal non-loading); data preserved; old subscription removed; new widget receives current state |
| D — stale responses | late stale payload cannot overwrite a newer request's state |
| E — error / empty | network reject → error + error UI + CASH usable; mapper reject (unsupported op) → error; validation reject (missing total) → error; CASH recovers to loaded; empty response → terminal loaded + empty-state message |
| F — re-expand while loading | re-expand while still loading renders `Loading…` (no cached state), then renders final state |
| G — FIX-001 regression | chat expanded restore exactly one refresh; chat collapsed restore zero refreshes; non-chat `chatCollapsed` preference preserved; route-forced collapse leaves preference unchanged |
| H — mapper | EmailSendSatellite accepted; unsupported operation rejected (`FinanceMapperValidationError`); captured payload maps (total 1.5, EmailRead, sum 1.5, userID 819531, epoch preserved) |

## 15. Build Verification

All commands executed at repository root; exit codes recorded.

| Command | Exit Code | Output Summary |
|---------|-----------|----------------|
| `npm run typecheck` | 0 | `tsc --noEmit`, no errors |
| `npm run lint` | 0 | `eslint src/ extension/`, no errors |
| `npm run version:check` | 0 | "Version check OK: all artifacts report 2.1.0" |
| `npm run build` | 0 | `scripts/Companion.user.js` 281.9kb |
| `npm run build:arena` | 0 | `scripts/Companion.arena.user.js` 280.1kb |
| `npm run build:ext` | 0 | `extension/dist/content.js` 282.5kb (+512.3kb map), `background.js` 605b |

## 16. Browser Verification

No interactive browser session was executed for this EPIC; the bug repro itself is captured runtime evidence (Section 3). Harness-level runtime verification is VERIFIED; live-browser scenarios are classified EXPECTED.

| Scenario | Classification | Notes |
|----------|----------------|-------|
| Non-chat expand → request → loaded body with captured transaction | EXPECTED | Harness scenario A VERIFIED at runtime level |
| Collapse during in-flight request → controller non-loading; re-expand renders data | EXPECTED | Harness scenario B VERIFIED |
| Widget restart during in-flight request → controller idle, new widget not stuck | EXPECTED | Harness scenario C VERIFIED |
| Stale response cannot overwrite newer | EXPECTED | Harness scenario D VERIFIED |
| Error/empty terminal paths + CASH recovery | EXPECTED | Harness scenario E VERIFIED |
| FIX-001 route behaviors preserved | EXPECTED | Harness scenario G + FIX-001 harness VERIFIED |
| Interactive browser execution on GoldenBride | UNKNOWN | Not performed in this session |

## 17. Regression Verification

All harnesses rebuilt from current source and executed:

| Harness | Result |
|---------|--------|
| `rc-stable-002-fix-002-harness` (this EPIC, 42 checks) | VERIFIED — 0 failures |
| `rc-stable-001-harness` (47 checks) | VERIFIED — 0 failures |
| `rc-stable-002-fix-001-harness` (20 checks) | VERIFIED — 0 failures (FIX-001 contract intact: non-chat zero auto-refresh, chat expanded restore exactly-one refresh, chat collapsed restore zero refreshes, route preference preserved) |
| `rc-polish-004-fix-harness` (29 checks) | VERIFIED — 0 failures **at this run time**; remains wall-clock-sensitive (see Section 19) |

Untouched subsystems: CASH refresh logic and its loading guard, Finance CSS, Change Delays UI, operation validation, launcher, New Shift, Reset IceBreaker, Import Snippets, dashboard actions, diagnostics collectors, and storage migration.

## 18. Performance Impact

- `requestSeq` increments once per refresh (constant-time field operations; no timers, polling, or listeners added).
- The re-expand re-render is a single synchronous `render(getState())` — the same cost as any state-driven render, and only on a collapse→expand transition.
- Cancellation settle adds at most one extra `setState` per cancelled request; superseded requests perform no DOM work.
- No additional network traffic: the fix never adds requests (first expand still exactly one; re-expand adds none).

## 19. Remaining Limitations

1. **Cancellation-with-data renders the idle message**: on a cancel-with-no-successor the controller preserves `data` at `status: idle`, but the widget's `idle` rendering shows "Ready to load finance data." (per the approved decision to reuse `idle` rather than add a new status). The preserved data remains available via `getState()`/`createSnapshot()`/diagnostics. In practice this is transient: a restarted widget reloads on its first expand.
2. **Empty is expressed as `loaded` with an empty list** (approved decision): no distinct `empty` status; the empty-state message is rendered by the existing path.
3. **polish-004 harness wall-clock sensitivity (pre-existing, unrelated)**: its mock transaction is fixed at local hour 15:40; when the harness runs at a time when the detected shift is `morning`/`night` (or the mock date drifts from the run date), its "S1 body contains transaction data" check fails. It passes in this session because the run occurs in the `day` shift window. Not caused by this EPIC and not modified.
4. **Interactive browser verification** was not executed (Section 16).

## 20. Unknowns

- **Collapse trigger in the live repro**: whether the stuck `Loading…` was caused by an operator collapse/expand, a header double-click, or a SPA `hashchange` is not observable from the captured probe. The fix is trigger-agnostic and covers all three paths.
- **GoldenBride SPA navigation beyond `hashchange`** (e.g., history pushState): unchanged from FIX-001; not addressed here.
- **Live layout/rendering differences** (real `toLocaleString` locale output, real viewport) were not exercised in a browser; the harness normalizes the locale-dependent decimal separator.

## 21. Stable Release Readiness

Ready for release. The fix is minimal (two source files), additive (no public API, interface, or state-model changes), preserves all FIX-001 route behaviors, closes both loading-stuck defects and the stale-response race, and passes every build gate (typecheck, lint, version:check, build, build:arena, build:ext — all exit 0) plus the new 42-assertion harness and all existing regression harnesses. No version bump was required (`version:check` passes at 2.1.0, consistent with the FIX-001 precedent).

Review metrics:
- Functions added: 1 (private `FinanceController.exitLoadingOnCancellation()`).
- Functions modified: 2 (`FinanceController.refresh()`, `FinanceWidget.expand()`).
- Exported APIs changed: none.
- Interfaces changed: none.
- `FinanceStatus` union changed: none (per approved decision).
