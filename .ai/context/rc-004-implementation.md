# Implementation Report — RC-004 Eliminate Release Candidate P1 Defect: Dev-Mode Detection Race

## 1. Analysis

**P1 defect (RC-001-B3):** dev mode was detected once at module scope. `src/companion/dev.ts` evaluated `const IS_DEV: boolean = (() => StorageService.get(STORAGE_KEYS.DEV_MODE) !== null ...)()` at import time. In the extension context `StorageService` uses `ChromeStorageAdapter`, which hydrates its in-memory cache **asynchronously** from `chrome.storage.local` (`storage-adapter.ts:112-128` — the cache starts empty and is populated in the background). Therefore every module-scope `IS_DEV` evaluation during bundle initialization ran against an empty cache and resolved to `false` permanently. All diagnostics gated on dev mode (`diag`, `diagWarn`, `diagError` logging, `LauncherDiagnostics` tracking, `companion-diagnostics.ts` collectors) were permanently disabled in the extension even when `ab-dev` was present in storage. The userscript (arena) context uses the synchronous `LocalStorageAdapter`, so dev mode worked there — masking the defect.

**Second cached dev-state found during investigation:** `launcher-diagnostics.ts` cached `this.enabled = isDevMode()` in the constructor. The module-scope `defaultInstance` (line 91) and the `create-composition.ts:29` instance were both constructed before hydration, so even a working `isDevMode()` would have been captured as `false` at construction time.

**Why the fix is a runtime re-evaluation, not a storage redesign:** the async-hydration design of `ChromeStorageAdapter` is intentional (sync reads backed by a background-populated cache). Redesigning it is out of scope. The defect is purely that dev mode was snapshotted once, at module scope, too early. Evaluating dev mode at call time makes `isDevMode()` reflect the hydrated cache on every read.

## 2. Investigation

- `dev.ts` (full read): `IS_DEV` module-scope constant (former lines 36-49); guards `if (IS_DEV)` in `diag`/`diagWarn`/`diagError`/`diagDebug`; `isDevMode()` (line 118) returned `IS_DEV`. `IS_DEV` was never exported — safe to remove.
- `launcher-diagnostics.ts` (full read): `private readonly enabled: boolean` set in constructor (line 42) to `isDevMode()`; read at `track()` (line 56), `markCompleted()` (line 71), `getState()` (line 77). Module-scope `defaultInstance` (line 91) and legacy export `launcherDiagnostics` (line 103).
- `storage-service.ts`: `getAdapter()` lazily runs `initStorage()` on first access → adapter created on the very first `StorageService.get` call.
- `storage-adapter.ts`: `ChromeStorageAdapter` cache empty until `cs.getAll().then(...)` resolves; `get()` reads the cache synchronously.
- `platform-interface.ts`: `Platform.chromeStorage: PlatformChromeStorage | null` — extension context provides it; arena/userscrip does not.
- `storage-keys.ts`: `DEV_MODE = "ab-dev"`.
- ~70 inline `isDevMode()` call sites (`bootstrap-coordinator.ts`, `companion-diagnostics.ts:93,104,123`, `companion-window.ts`, etc.) all evaluate at call time and require no change.

**Affected files:** only `src/companion/dev.ts` and `src/companion/launcher-diagnostics.ts`.

## 3. Implementation Plan

- **`dev.ts`**: delete the module-scope `IS_DEV` constant; move the detection logic (StorageService → localStorage fallback → `false`, unchanged semantics) into the exported `isDevMode()`; the four `diag*` guards call `isDevMode()`.
- **`launcher-diagnostics.ts`**: replace the `enabled` field with a private getter `get enabled(): boolean { return isDevMode(); }` so `track`/`markCompleted`/`getState` evaluate dev mode at access time. The constructor becomes empty and is removed.
- No changes to `StorageService`, `ChromeStorageAdapter`, `platform-interface`, or any `isDevMode()` consumer.

**Why not alternatives:** (a) eagerly waiting for hydration before startup would require an async bootstrap redesign across `create-composition.ts`/`bootstrap-coordinator.ts` — out of scope and larger; (b) refreshing `IS_DEV` after hydration would still leave `LauncherDiagnostics` and any other pre-hydration snapshots stale, and requires coupling to hydration events — larger diff, more moving parts.

## 4. Modified Files

| Path | Reason |
|------|--------|
| `src/companion/dev.ts` | Remove module-scope `IS_DEV`; make `isDevMode()` evaluate storage at call time. |
| `src/companion/launcher-diagnostics.ts` | Remove constructor-cached `enabled`; evaluate dev mode at access time via getter. |

No other tracked files were created, deleted, or modified. Repository state verified with `git status` — only these two files are tracked-modified at commit time.

## 5. Changes Per File

### `src/companion/dev.ts`
- Deleted the `const IS_DEV: boolean = (() => ...)()` module-scope block (10 lines). No remaining `IS_DEV` references (grep-confirmed).
- `diag`/`diagWarn`/`diagError`/`diagDebug` (4 functions): guard `if (IS_DEV)` → `if (isDevMode())`. The `diagError` error-history recording (always-on) is unchanged.
- `isDevMode()`: now evaluates `StorageService.get(STORAGE_KEYS.DEV_MODE) !== null` with the same `try/catch` → `localStorage` fallback → `false` semantics as the removed IIFE. Public signature unchanged.

### `src/companion/launcher-diagnostics.ts`
- Removed `private readonly enabled: boolean;` field and the constructor (which cached `isDevMode()` at construction).
- Added private getter `get enabled(): boolean { return isDevMode(); }` — `track()`, `markCompleted()`, and `getState()` read `this.enabled` unchanged, now resolving at access time.
- Public API unchanged (`track`, `markCompleted`, `getState`, `setActiveImplementations`, `setModuleInfo`). Module-scope `defaultInstance` and legacy `launcherDiagnostics` export unchanged.

## 6. Verification

| Item | Result | Evidence |
|------|--------|----------|
| TypeScript compilation | **VERIFIED** | `npm run typecheck` exit 0 |
| Lint | **VERIFIED** | `npm run lint` exit 0 |
| Build (`npm run build`, userscript) | **VERIFIED** | exit 0, no warnings |
| Imports / module graph | **VERIFIED** | esbuild bundle of `dev.ts` + `launcher-diagnostics.ts` + storage/platform modules succeeded (exit 0) |
| No remaining `IS_DEV` references | **VERIFIED** | repository grep returns none in `src/` |
| Runtime race eliminated | **VERIFIED** | 12/12 assertions passed in Node harness against the real bundled source (see below) |
| No regressions | **VERIFIED** | pre-hydration reads still return `false`; post-hydration reads return `true`; error-history recording unaffected |

**Runtime harness scenarios (Node, real bundled source, simulated async `chrome.storage`):**
- Module-scope `LauncherDiagnostics` construction does not throw (no platform access at import). PASS
- Pre-hydration `isDevMode() === false` (empty cache). PASS
- Pre-hydration instance `getState().enabled === false`. PASS
- Post-hydration `isDevMode() === true` (cache populated with `ab-dev`). PASS
- The **same instance created pre-hydration** records stages, enables, and completes after hydration (`track("bootstrap")`, `markCompleted()` → `getState().enabled === true`, `stages.length === 1`, `completed === true`). PASS — this is the exact RC-001-B3 failure path, now functional.
- `diag()` writes `[Companion:INFO] ...` to console once dev mode is on. PASS
- `diagError` records error history regardless of dev mode. PASS
- Runtime re-evaluation: removing the `ab-dev` key makes `isDevMode()` return `false` immediately; a fresh instance is disabled and tracks nothing. PASS

**EXPECTED (not directly observed):** on a live CRM page with `ab-dev` set in `chrome.storage.local`, the extension's diagnostics (companion diagnostics collectors, launcher stages, dev logs) become active after hydration completes. This follows from the verified harness + source; no live-browser session was executed in this environment.

## 7. Remaining Limitations

- Dev-mode reads during the brief pre-hydration window still return `false`; diagnostics collected before hydration completes remain disabled. This is the intended safe default and matches the pre-existing behavior for genuinely unset dev mode.
- No behavior change to the userscript/arena context — `LocalStorageAdapter` is synchronous, so `isDevMode()` there was and remains correct.
- Feature freeze respected: no other RC-001 findings were addressed.

## 8. Unknowns

- No live-browser runtime session was executed; extension behavior after hydration is **EXPECTED**, not directly observed (**VERIFIED** only at the Node/real-bundle level).
- Whether any external consumer (outside this repository) relied on the removed module-scope `IS_DEV` is **UNKNOWN**; it was never exported, and within the repository all references are accounted for.
