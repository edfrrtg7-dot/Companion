# Investigation Report — RC-001 Release Candidate Audit

## Objective

Audit the Companion v2.0.0 codebase to determine release-candidate readiness. Produce an evidence-based RC stabilization backlog covering: launcher lifecycle, dashboard lifecycle, session-memory lifecycle, runtime/composition, and a full performance inventory (timers, observers, listeners, storage, network). **Investigation only — no code was modified.**

---

## Evidence

Evidence ordered by reliability (Runtime > Compiler > Build > Repository > Source > Static reasoning).

### Runtime semantics test — class field vs prototype method shadowing (Node)

```
$ node -e "class A { history = new Map(); history() { return [1]; } } const a = new A();
   try { console.log('call result:', a.history()); } catch (e) { console.log('THREW:', e.message); }
   console.log('typeof a.history:', typeof a.history);"
THREW: a.history is not a function
typeof a.history: object
```

An own property class field shadows a prototype method of the same name. Calling `instance.history()` throws `TypeError`.

### Compiler — typecheck

```
$ npx tsc --noEmit ; echo $?
TYPECHECK_EXIT=0
```

### Build — dev extension build

```
$ node build-extension-dev.mjs ; echo $?
▲ [WARNING] Duplicate member "history" in class body [duplicate-class-member]
    ../src/companion/versioning.ts:107:4:
    107 │     history(): ReadonlyArray<Version<Snapshot<unknown>, unknown>> {
    The original member "history" is here:
    ../src/companion/versioning.ts:42:12:
     42 │     private history: Map<VersionId, Version<Snapshot<unknown>, unknown>> = new Map();
1 warning
..\extension\dist\content.js      272.9kb
Done in 79ms
BUILD_EXIT=0
```

### Compiled bundle inspection — VersionManager (extension/dist/content.js)

```
var VersionManager = class {
  constructor() {
    __publicField(this, "counter", 0);
    __publicField(this, "history", /* @__PURE__ */ new Map());
    __publicField(this, "subscribers", /* @__PURE__ */ new Set());
  }
  ...
  history() { return Object.freeze(Array.from(this.history.values())); }
```

`history` is emitted as an own instance field via `__publicField`; the `history()` method lives on the prototype. The field shadows the method in the shipped bundle.

### Source — timer / observer inventory (grep, src/companion)

```
setInterval:        session-memory.ts:45 (1000ms), dashboard.ts:144 (5000ms)
setTimeout:         companion-dialogs.ts:27 (150ms), companion-styles.ts:22,24 (2500/200ms),
                    companion-modal.ts:404 (150ms), finance-api-client.ts:131 (30s abort, cleared),
                    finance-widget.ts:250 (highlight), session-memory.ts:174 (300ms debounce),
                    crm-service.ts:219 (250ms bounded poll, MAX_WAIT_MS=5000)
requestAnimationFrame: companion-modal.ts:383, companion-dialogs.ts:20 (one-shot fade-in)
MutationObserver / IntersectionObserver / ResizeObserver: none
addEventListener:   37 occurrences (detailed in Performance Inventory)
```

### Source — SessionMemory.stop() callers (grep, src)

```
$ grep -rn "sessionMemory\.stop\|getSessionMemory()\.stop\|\.stop()" src
No files found
```

`SessionMemory.stop()` and all `.stop()` variants have **zero callers**. The tracking interval started at composition creation (`create-composition.ts:41`) is never cleared.

### Repository — git baseline

```
HEAD ecf70a2 EPIC-INF-012 through INF-021: Runtime infrastructure + EPIC-FEAT-001 through FEAT-004: Session Memory features
Working tree clean (only untracked: .ai/, agencybooster-devtoolkit/, dashboard_result.txt,
extension/dist.zip, src/companion.zip, temp-collectors.ts, templates/)
```

### Source — key lifecycle wiring

- `create-composition.ts:41` — `sessionMemory.start()` runs at composition creation (module load), before DOM ready.
- `companion-modal.ts:385/396` — dashboard `start()` on show, `stop()` on hide.
- `bootstrap-coordinator.ts:87` — `this.financeModule?.open()` auto-launched unconditionally after `app.start()`.
- `finance-module.ts:243-254` — `open()` creates widget, calls `hide()` then `show()`; persisted `hidden` state is overridden.
- `companion-window.ts` — drag/resize document listeners removed on pointerup/pointercancel/blur; keyboard listener installed on show, removed on hide/destroy.
- `dev.ts:37-49` — `IS_DEV` evaluated at module scope via `StorageService.get(DEV_MODE)`.
- `storage-adapter.ts:102-128` — `ChromeStorageAdapter` hydrates cache asynchronously; cache empty until `getAll()` resolves.
- `diagnostics-service.ts:71` — `versionCount: this.versionManager.history().length`.
- `module-manager.ts:263` — `collectDiagnostics()` is the only path to `DiagnosticsService.snapshot()`; grep shows **no callers**.
- `companion-app.ts:185-191` — `started = true` set before `createUI()`; `createUI()` early-returns if `!document.body`.
- `companion-modal.ts:404-405` — `hide()` removes overlay after 150ms but nulls `modalOverlay` synchronously.

---

## Findings

### Launcher lifecycle

1. **Duplicate-init protection is layered and VERIFIED** (source): content-script flag `__AB_COMPANION_EXTENSION_LOADED__` (content.ts), global-state flag `__AB_COMPANION_APP__` (bootstrap-coordinator.ts:32), `CompanionApp` singleton + `started` flag. Defense in depth.
2. **No teardown path exists** for the launcher (no `destroy()`). Acceptable for a content-script-per-page model — element-bound listeners are GC'd with the DOM, no window/document listeners leak. **VERIFIED** (source).
3. **No SPA-recovery mechanism** (no MutationObserver to re-mount the launcher). Whether this matters depends on whether the CRM replaces `document.body` on navigation — **UNKNOWN**.
4. **`started` is set before `createUI()`** and `createUI()` returns early when `document.body` is null (companion-app.ts:186-189, 198). A silent no-UI state with no retry. Currently unreachable because `BootstrapCoordinator.start()` waits for DOM ready first — **VERIFIED** (source), low risk.

### Dashboard lifecycle

5. **Polling is correctly scoped to modal visibility** — `start()`/`stop()` invoked in modal `show()`/`hide()`. The 5s interval runs **only while the modal is open**. **VERIFIED** (source). This resolves the earlier suspicion that dashboard polls while hidden.
6. **Full grid re-render every 5s while open** (`renderDashboard` does `innerHTML = ""` + rebuild 6 cards). Acceptable; each render does a synchronous `localStorage` read via `DashboardService.readCRMData()`.
7. **Rapid toggle within 150ms creates a transient double overlay** — `hide()` nulls `modalOverlay` synchronously but removes the overlay after 150ms; a re-`show()` in that window creates a second overlay while the first fades. **VERIFIED** (source). Minor.

### Session Memory lifecycle

8. **P1 — Always-on 1Hz polling for the entire page lifetime.** `sessionMemory.start()` runs at composition creation; the 1000ms `setInterval` checks `window.location.href` on every goldenbride.net page, whether or not Companion is used. `stop()` exists but has **zero callers** (grep VERIFIED). This is the single always-on background activity in the product.
9. **P2 — Possible last-event data loss.** Saves are debounced 300ms; no `beforeunload`/`pagehide` flush exists. Navigating and closing the tab within the debounce window can drop the final event. **VERIFIED** (source).
10. **Session list goes stale while the modal is open.** Session section renders on open and on import only; new events and relative timestamps ("just now", "5m ago") do not refresh while open (the badge updates, the list does not). **VERIFIED** (source).

### Runtime / composition

11. **Finance widget auto-opens on every page load** (`bootstrap-coordinator.ts:87` → `FinanceModule.open()` → `widget.show()`), overriding the persisted `hidden` state stored by `CompanionWindow`. A user who closes the widget sees it reopen after every reload. **VERIFIED** (source).
12. **Finance network activity is on-demand only.** `FinanceController` has no timers and no auto-fetch; requests fire on user refresh, shift change, or date-range change. API client clears its abort timeout on settle. **VERIFIED** (source).
13. **Resilience: single module failure aborts bootstrap.** `ModuleManager.initializeAll()` rethrows on the first failed module, which propagates through `BootstrapCoordinator.run()` and prevents launcher creation. Only one module (finance) is registered today, limiting exposure. **VERIFIED** (source).
14. **Storage hydration race on cold start.** `ChromeStorageAdapter` hydrates from `chrome.storage.local` asynchronously; `get()` returns `null` until hydration completes. Session-memory load, window-geometry load, and finance persisted-state read all execute before hydration typically completes. Effects: persisted values may be missed on cold start; `CompanionWindow.persistState()` can overwrite previously saved geometry with defaults. **VERIFIED** (source), **EXPECTED** (runtime).
15. **P2 — Dev-mode diagnostics effectively disabled in the extension.** `IS_DEV` is captured at module scope by reading through `ChromeStorageAdapter` before hydration — the cache is empty, so `IS_DEV` is `false` even when the dev flag is set. The `localStorage` fallback is only reached on a thrown error, never on a `null` read, and in the extension the adapter reads `chrome.storage.local`, not `localStorage`. Consequence: `diag()`/`isDevMode()`/`LauncherDiagnostics.track()`/`exposeDiagnostics()` all no-op in extension context. Works correctly in userscript/Arena context (synchronous adapter). **VERIFIED** (source), **EXPECTED** (runtime).

### Versioning

16. **P2 — Latent crash in `DiagnosticsService.snapshot()` due to field/method collision.** `VersionManager` declares both a `private history: Map` field (versioning.ts:42) and a `history()` method (versioning.ts:107). The field shadows the method in the compiled bundle (build VERIFIED; Node runtime test VERIFIED). `diagnostics-service.ts:71` calls `this.versionManager.history().length`, which throws `TypeError: history is not a function`. **Currently unreachable at runtime** — `ModuleManager.collectDiagnostics()` (the only caller of `snapshot()`) has no callers (grep VERIFIED) — so severity is latent, not active.
17. **Migration framework is a safe no-op** — `MIGRATIONS` registry empty, version stamping on first run. **VERIFIED** (source).

### Positive lifecycle hygiene (VERIFIED, source)

18. `CompanionWindow` drag/resize document-level listeners are removed on pointerup/pointercancel/blur; keyboard listener is installed on `show()` and removed on `hide()`/`destroy()`.
19. Modal `keydown` listener is added on `show()` and removed on `hide()`.
20. No `MutationObserver`/`IntersectionObserver`/`ResizeObserver` anywhere in `src/companion`.
21. Build is clean (exit 0) and typecheck is clean (exit 0).

---

## Performance Inventory

### Recurring timers

| Timer | Location | Scope | Notes |
|-------|----------|-------|-------|
| `setInterval` 1000ms | session-memory.ts:45 | **Page lifetime, always on** | P1. Never stopped (no callers). |
| `setInterval` 5000ms | dashboard.ts:144 | Modal open only | Correctly started/stopped by show/hide. |

### One-shot timers

| Timer | Location | Purpose | Notes |
|-------|----------|---------|-------|
| 150ms | companion-modal.ts:404 | Overlay removal on hide | |
| 150ms | companion-dialogs.ts:27 | Dialog overlay removal | |
| 2500ms + 200ms | companion-styles.ts:22,24 | Toast dismiss | |
| 300ms | session-memory.ts:174 | Save debounce | No unload flush (Finding 9). |
| 30s | finance-api-client.ts:131 | Fetch abort | Cleared on settle. |
| 250ms | finance-widget.ts:250 | Row highlight removal | One-shot per new row. |
| 250ms | crm-service.ts:219 | `stopSenderSafely()` poll | Bounded by `MAX_WAIT_MS=5000`, user action only. |

### Animation frames

| Location | Purpose |
|----------|---------|
| companion-modal.ts:383 | Modal fade-in |
| companion-dialogs.ts:20 | Dialog fade-in |

### Observers

None (`MutationObserver`, `IntersectionObserver`, `ResizeObserver` — zero occurrences).

### Event listeners (37 addEventListener)

- **Persistent (page lifetime):** launcher click ×2 (companion-app.ts:205,222); `DOMContentLoaded` ×3 (platform/runtime implementations).
- **Modal-scoped:** `keydown` added/removed on show/hide; overlay click + close button per open (element-bound).
- **Widget-scoped:** drag/resize document listeners per gesture (properly removed); keyboard listener on show/hide/destroy; element-bound button/row listeners recreated per render (no leak).
- **Per-render (element-bound, GC with DOM):** action buttons, session item clicks, search input, import file input, finance row clicks.

### Storage activity

- Session memory: read at start; read + write per navigation (debounced 300ms).
- Dashboard: `localStorage` read every 5s while modal open.
- Window state: read at construction; write on drag/resize/collapse/show/hide.
- `chrome.storage.local`: async hydration at adapter construction; fire-and-forget `set`/`remove` persists.

### Network activity

- Finance API `GET /usermodule/services/agencyhelper/v2?command=finances&from=..&to=..` — **user action only** (refresh / shift / date-range). No background network polling.

---

## Functional Status

Legend: **S** = source-wired, **R** = runtime-verified on live CRM (none available in this environment), U = UNKNOWN.

| Feature | Status | Evidence |
|---------|--------|----------|
| Bootstrap / composition | S | create-composition.ts, bootstrap-coordinator.ts |
| Duplicate-init guards | S | content.ts, bootstrap-coordinator.ts, companion-app.ts |
| Launcher button + toggle | S | companion-app.ts:197-233 |
| Launcher badge (session count) | S | companion-app.ts:231-250 |
| Diagnostics launcher (copy Debug Bundle) | S | companion-app.ts:256-264 |
| Modal show/hide/ESC/overlay/X | S | companion-modal.ts:235-469 |
| Dashboard status grid (2×3) | S | dashboard.ts, companion-modal.ts:376 |
| Dashboard auto-refresh (modal-scoped) | S | dashboard.ts:142-151, modal show/hide |
| Reset IceBreaker / New Shift | S | companion-modal.ts:45-79 |
| Change Delays | S | companion-modal.ts:93-111 |
| Import Snippets | S | companion-modal.ts:118-130 |
| Session search / export / import | S | companion-modal.ts:144-215, 318-359 |
| Session badge updates | S | companion-app.ts:231-232 |
| Finance widget (drag/resize/collapse/persist) | S | companion-window.ts, finance-widget.ts |
| Finance fetch (refresh/shift/dates, on-demand) | S | finance-controller.ts, finance-api-client.ts |
| Finance unviewed tracking | S | finance-controller.ts:169-186 |
| Storage versioning + migrations | S | storage-version.ts, storage-migration.ts |
| **Live behavior on goldenbride.net** | **U** | No browser runtime evidence obtainable in this environment |

---

## Unknowns

1. **Runtime behavior on live CRM** — all functional items above are source-wired only; no browser session was executed. End-to-end runtime verification remains required before RC acceptance.
2. Whether the CRM replaces `document.body` during SPA navigation (affects launcher persistence; Finding 3).
3. Whether the dev flag (`ab-dev`) is ever set via `chrome.storage.local` in practice (affects Finding 15 impact).
4. Actual CPU/energy cost of the 1Hz session-memory poll on target machines (no profiling evidence collected).
5. Whether persisted `hidden: true` finance-widget state exists in the wild (affects Finding 11 impact).

---

## Conclusions

1. **No P0 defects found.** Compiler and build are clean; core lifecycle hygiene (launcher guards, dashboard scoping, window/modal listener cleanup) is high quality.
2. **One P1 performance item:** the always-on 1Hz session-memory poll is the only recurring background activity and runs on every CRM page regardless of Companion usage.
3. **Two confirmed latent correctness bugs** (neither active in end-user runtime today): the `VersionManager.history` field/method shadowing (crashes the diagnostics platform snapshot API if ever called) and the dev-mode detection race in extension context (disables diagnostics tooling).
4. **Finance is well-scoped:** on-demand network, no timers, correct abort/timeout handling.
5. **Release readiness:** code-level readiness is good, but RC acceptance is blocked on live-CRM runtime verification (Unknown 1), which cannot be performed from this environment.

---

## Recommended Actions (RC Backlog)

Ordered by priority. No changes were made in this investigation; items are proposals for the stabilization phase.

### P0

- None identified.

### P1

- **RC-001-B1 — Scope session-memory tracking to actual usage.** Start tracking lazily (e.g., on first modal open) and/or pause polling while `document.hidden`; wire `stop()` into an actual lifecycle (or remove the dead `stop()`). Removes the only always-on background timer.

### P2

- **RC-001-B2 — Fix `VersionManager` field/method collision.** Rename either the `history` field or the `history()` method. Resolves the build warning and unblocks `DiagnosticsService.snapshot()`/`ModuleManager.collectDiagnostics()`.
- **RC-001-B3 — Fix dev-mode detection in extension context.** Make `IS_DEV` refreshable or initialize the storage adapter before `dev.ts` module-scope evaluation; otherwise diagnostics tooling is permanently disabled in the extension.
- **RC-001-B4 — Flush session memory on unload.** Add a `pagehide`/`beforeunload` handler that flushes pending saves.
- **RC-001-B5 — Respect persisted Finance widget visibility.** Do not auto-`show()` when persisted state is `hidden: true`.
- **RC-001-B6 — Refresh session list while modal open.** Re-render the list on new-event callback or a low-frequency interval so relative timestamps stay current.
- **RC-001-B7 — Guard against overlapping overlays.** Reject `show()` while a fade-out is pending.
- **RC-001-B8 — Resolve cold-start storage hydration race.** Await `ChromeStorageAdapter` hydration (or expose a ready promise) before session/window/finance persisted-state reads.
- **RC-001-B9 — Isolate module initialization failures.** Let `initializeAll()` record per-module failures and continue, so one failing module cannot prevent launcher bootstrap.
- **RC-001-B10 — Make `CompanionApp.start()` failure-safe.** Only set `started` after `createUI()` succeeds, or make `createUI()` re-enterable.

### FUTURE

- **RC-001-F1 — Replace 1Hz session-memory polling with event-driven tracking** (`popstate`, `hashchange`, History API hooks) once RC stabilization is accepted.
- **RC-001-F2 — Dashboard delta rendering** instead of full grid rebuild every 5s while open.
