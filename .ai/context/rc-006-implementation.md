# Implementation Report — RC-006 Flush Pending Session Memory on Page Exit

## 1. Analysis

**P2 defect (RC-001 Finding 9, RC-001-B4):** `SessionMemory` persists through a 300 ms debounce (`scheduleSave()` → `setTimeout(..., SAVE_DEBOUNCE_MS)`). A tab close, reload, or navigation that occurs inside that debounce window discards the newest session event, because no page-exit lifecycle handler flushes pending dirty state. `visibilitychange` covers only the tab-hidden subset of exits (RC-002); it is not a guaranteed exit signal (e.g. direct navigation, bfcache, or exit without a visibility transition).

**Current state of the persistence pipeline (all pre-existing):**
- `scheduleSave()` marks `dirty = true` and arms a 300 ms `saveTimer`; the timer callback calls `save()`.
- `flush()` is the synchronous save primitive: `if (!this.storage || !this.dirty) return; this.save();`.
- `save()` writes the full `StoredSession` JSON via `StorageService.set` and clears `dirty`.
- `visibilitychange` on hidden already runs `pauseTracking()` + `flush()` (RC-002).
- `stop()` removes the visibility listener, pauses timers, flushes. It has zero production callers.

The implementation already contains the required persistence primitive (`flush()`). The correction only needs to guarantee that primitive runs on page exit, reusing the existing save path — no second save mechanism.

## 2. Investigation

1. **`pagehide` vs `beforeunload`:** repository-wide grep (`pagehide|pageshow|beforeunload|unload|visibilitychange`) found **zero** existing page-exit handling; only `visibilitychange` exists in `session-memory.ts` (the other `visibilitychange` hits are in `agencybooster-devtoolkit` exploration tooling, not production). `pagehide` is the appropriate event: it fires on tab close, reload, navigation, and bfcache in both the Chrome extension content-script context and modern userscript engines. `beforeunload` has bfcache gaps (not fired on bfcache enter in some browsers) and implies user-cancellable semantics this flush does not need. A single `pagehide` listener is the smallest reliable addition; adding both would duplicate the write.

2. **Existing visibility coverage:** `onVisibilityChange` already flushes when `document.hidden` (covers tab switch/close subset). `pagehide` adds the authoritative exit guarantee for paths where visibility never transitions. Because `flush()` no-ops when `dirty === false`, overlapping coverage cannot produce a duplicate write.

3. **Smallest reliable addition:** one `window` `pagehide` listener whose handler mirrors the visibility hidden-branch exactly — `pauseTracking()` (cancels the tracking interval and any pending debounce timer) then `flush()` (writes dirty state synchronously).

4. **Storage adapter synchronous guarantee:** `ChromeStorageAdapter.set()` (`storage-adapter.ts:134-137`) mutates the in-memory cache synchronously and only then fire-and-forgets the async `chrome.storage` persist. `save()` therefore updates the adapter cache synchronously inside the `pagehide` handler, so the flushed data is not lost from the page's perspective — the same mechanism the existing visibility flush already relies on (verified in RC-004).

5. **Handler lifecycle:** installed in `start()` (after the visibility listener) and removed in `stop()` (before the visibility listener), keeping `start()`/`stop()` symmetrical and both listeners paired with install/remove.

6. **Repeated `start()`:** an `exitBound` flag mirrors the existing `visibilityBound` guard, so repeated `start()` cannot register duplicate exit listeners; `resumeTracking()` already guards the interval.

**Entry points:** the only production start is `sessionMemory.start()` at `create-composition.ts:41` (both Chrome and Arena bootstraps go through `createComposition`). `stop()` has no production caller but remains the symmetric teardown path.

**Lifecycle ownership:** `SessionMemory` owns its timers and listeners; install and remove are always paired within the class. No other module touches these members.

**Affected files:** `src/companion/session-memory.ts` only. No other production file is required; the change is entirely within the class's existing lifecycle and persistence primitives.

**Affected APIs:** none public. Public surface (`start`, `stop`, `getEvents`, `getRecentCount`, `setNewEventCallback`, `exportToJson`, `importFromJson`) is unchanged. Only three private members are added.

**Possible side effects:** on page exit the pending debounce is cancelled and dirty state is written synchronously to the storage cache. No `preventDefault`, no unload blocking, no user-interaction change. When clean (`dirty === false`), `flush()` performs no write. Because `pagehide` fires before actual unload, the flush completes within the page lifetime.

## 3. Plan

In `src/companion/session-memory.ts`:
- Add `private exitBound = false` next to `visibilityBound`.
- `start()`: call `this.installExitListener()` after `installVisibilityListener()`.
- `stop()`: call `this.removeExitListener()` before `removeVisibilityListener()`.
- Add `installExitListener()` / `removeExitListener()` (guarded by `exitBound`) and `onPageHide` (`pauseTracking()` + `flush()`), placed adjacent to the existing visibility listener methods.

No changes to `flush()`, `save()`, `scheduleSave()`, `pauseTracking()`, the visibility listener, or any other file.

## 4. Modified Files

| Path | Reason | Responsibility |
|------|--------|----------------|
| `src/companion/session-memory.ts` | Add the page-exit flush. Sole production file containing the session-memory lifecycle and persistence primitives; the correction belongs here and here only. | Installs/removes the `pagehide` listener and flushes dirty state on page exit. |

No other tracked files were created, deleted, or modified. Repository state verified with `git status` — only `src/companion/session-memory.ts` is tracked-modified at commit time.

## 5. Changes Per File

### `src/companion/session-memory.ts` (+17 lines)
- Field: `private exitBound = false;` — duplicate-registration guard for the exit listener.
- `start()` (line 48): added `this.installExitListener();` after `installVisibilityListener()`.
- `stop()` (line 53): added `this.removeExitListener();` before `removeVisibilityListener()`, keeping teardown symmetrical.
- `installExitListener()`: guarded by `exitBound`, registers `onPageHide` on `window` for the `pagehide` event.
- `removeExitListener()`: guarded by `exitBound`, removes `onPageHide`.
- `onPageHide()`: `pauseTracking()` (cancels tracking interval and any pending debounce timer) then `flush()` (writes dirty state synchronously via the existing save path; no-op when clean). Mirrors the `visibilitychange` hidden-branch.

## 6. Engineering Rationale

- **Reuse, not a second path:** `flush()` already exists and is idempotent (`dirty === false` → no write). The handler only orchestrates the existing primitives, satisfying "reuse the existing `flush()` and persistence path".
- **`pagehide` over `beforeunload`:** `pagehide` fires on all exit paths (close, reload, navigation, bfcache) in both target runtimes and carries no user-cancellation semantics; `beforeunload` has bfcache gaps. One event, no duplicate writes.
- **`pauseTracking()` before `flush()`:** cancels the pending 300 ms debounce timer so a later timer firing (e.g. after bfcache restore) cannot issue a redundant write; mirrors the existing hidden-branch ordering exactly.
- **`exitBound` guard:** mirrors the proven `visibilityBound` pattern, satisfying "prevent duplicate listener registration" and "keep `start()`/`stop()` symmetrical".
- **Rejected alternative — a `beforeunload` + `pagehide` pair:** redundant duplicate writes on overlapping exit paths; the visibility flush already covers the hidden subset and `flush()` is idempotent.

## 7. Verification

| Item | Result | Evidence |
|------|--------|----------|
| TypeScript compilation | **VERIFIED** | `npm run typecheck` exit 0 |
| Lint | **VERIFIED** | `npm run lint` exit 0 |
| Build (`npm run build`, userscript) | **VERIFIED** | exit 0, no warnings |
| Imports / module graph | **VERIFIED** | esbuild bundle of `session-memory.ts` succeeded (exit 0) |
| Dirty + pagehide flushes, no loss | **VERIFIED** | runtime harness 27/27 (see below) |
| Clean + pagehide writes nothing | **VERIFIED** | runtime harness |
| Double `start()` idempotent | **VERIFIED** | runtime harness |
| `stop()` removes every listener/timer and flushes | **VERIFIED** | runtime harness |
| RC-002 visibility behaviour preserved | **VERIFIED** | runtime harness |

**Runtime harness scenarios (Node, real bundled source, instrumented timers/listeners, write-tracking fake `StorageService`):**

- **Scenario 1 — dirty + pagehide:** after a navigation event is recorded by the interval, its debounce is pending and unflushed; `pagehide` cancels the debounce timer and the tracking interval, flushes synchronously, and the stored JSON contains both events with the newest first — no pending event lost.
- **Scenario 2 — clean + pagehide:** after the debounce completes naturally, `pagehide` causes no additional write.
- **Scenario 3 — double `start()`:** exactly one exit listener, one visibility listener, one tracking interval.
- **Scenario 4 — `stop()`:** interval removed, debounce timer removed, exit listener removed, visibility listener removed, pending state flushed (newest event included), and a post-`stop()` `pagehide` does no further work.
- **Scenario 5 — RC-002 regression:** hide pauses + flushes, no polling while hidden, show resumes + catches up immediately.
- **Scenario 6 — start-while-hidden (RC-002 scenario G):** no interval while hidden, interval starts on visible, catch-up records the URL change.
- **Scenario 7 — immediate pagehide after start:** the very first event (debounce pending, zero writes) is flushed by an instant `pagehide`; stored JSON contains the event.

**EXPECTED (not directly observed):** on a live CRM page, closing/reloading/navigating within the 300 ms debounce window now persists the newest session event, while the existing debounce cadence and hidden/visible behaviour are unchanged. This follows from the verified Node harness + source; no live-browser session was executed in this environment. A live `pagehide` additionally runs asynchronously after a real `chrome.storage` persist is dispatched, whereas the harness observes the synchronous cache mutation.

## 8. Remaining Limitations

- The flush depends on the adapter's synchronous cache mutation (verified for `ChromeStorageAdapter` in RC-004); the async `chrome.storage` background persist is fire-and-forget, so a hard system crash immediately after unload could still lose a write — inherent to the existing persistence design and out of scope.
- `stop()` still has no production caller; the exit listener is added in `start()` and the guard prevents duplication regardless.
- Feature freeze respected: no other RC backlog items were addressed.

## 9. Unknowns

- No live-browser runtime session was executed; end-to-end page-exit behaviour on goldenbride.net is **EXPECTED**, not directly observed (**VERIFIED** only at the Node/real-bundle level).
- Whether bfcache is ever exercised on the target CRM is **UNKNOWN**; the `pagehide` handler is bfcache-safe either way (it neither cancels the event nor blocks caching).

## 10. Review Metrics

- Functions added: 3 (private `installExitListener`, `removeExitListener`, `onPageHide`).
- Functions modified: 2 (`start()`, `stop()` — one line each).
- Exported APIs changed: none.
- Interfaces changed: none.
