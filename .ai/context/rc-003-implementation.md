# Implementation Report — RC-003 Eliminate Release Candidate P2 Defect: VersionManager Collision

## 1. Analysis

**P2 defect (RC-001 Finding 16, RC-001-B2):** `VersionManager` declared both a `private history: Map` field and a public `history(): ReadonlyArray<...>` method. In the compiled bundle the instance field shadows the prototype method, so `versionManager.history()` resolved to the `Map` and calling it threw `TypeError: history is not a function`. `DiagnosticsService.snapshot()` (`diagnostics-service.ts:71`) invokes `this.versionManager.history().length` — the latent runtime failure identified in RC-001. The defect was latent because `ModuleManager.collectDiagnostics()` (the only runtime path into `snapshot()`) currently has no callers.

**Why the collision exists:** naming only — a private field and a public method share the identifier `history`. The architecture (history stored in a `Map`, exposed as an immutable array) is sound; the fix does not require redesign.

## 2. Investigation

All references to the affected member, located via repository-wide grep of `src/`:

| Location | Usage | Classification |
|----------|-------|----------------|
| `versioning.ts:42` | `private history: Map<...>` field declaration | Colliding field |
| `versioning.ts:77` | `this.history.set(...)` (createVersion) | Internal field ref |
| `versioning.ts:100` | `this.history.get(...)` (latest) | Internal field ref |
| `versioning.ts:107` | `history(): ReadonlyArray<...>` method declaration | Colliding method (public API) |
| `versioning.ts:108` | `this.history.values()` (history method body) | Internal field ref |
| `versioning.ts:115` | `this.history.get(id)` (get) | Internal field ref |
| `versioning.ts:122` | `this.history.clear()` (clear) | Internal field ref |
| `diagnostics-service.ts:71` | `this.versionManager.history().length` | External caller of the public method (currently resolves to the shadowing field → latent TypeError) |

No other callers of the affected member exist. Other `VersionManager` API users (`finance-module.ts:130,280` → `createVersion`; `module-manager.ts:302` → `getVersionManager()`) are unaffected. No tests exist in the repository (glob for `*.test.*`/`*.spec.*` returned none).

**Affected files:** `versioning.ts` is the only file requiring modification. `diagnostics-service.ts` requires **no change** — its `history()` call site is correct once the field no longer shadows the method.

## 3. Implementation Plan

- **Rename the private field** `history` → `historyMap` in `versioning.ts`, updating the 5 internal references.
- **Keep the public method** `history()` unchanged — preserves the public API and leaves `diagnostics-service.ts:71` untouched.
- This is the smallest complete fix: one file, no API change, no behavior change, eliminates the collision.

**Why not the alternative:** renaming the public method would change the public API and force a `diagnostics-service.ts` modification; renaming the private field preserves the API and minimizes the diff.

## 4. Modified Files

| Path | Reason |
|------|--------|
| `src/companion/versioning.ts` | Rename the private `history` field to `historyMap` to remove the field/method name collision. |

No other tracked files were created, deleted, or modified. Repository state verified with `git status` — only `src/companion/versioning.ts` is tracked-modified (6 insertions, 6 deletions) at commit time.

## 5. Changes Per File

### `src/companion/versioning.ts`

- `line 42`: field declaration `private history: Map<...>` → `private historyMap: Map<...>`.
- `line 77`: `this.history.set(id, ...)` → `this.historyMap.set(id, ...)`.
- `line 100`: `this.history.get(...)` → `this.historyMap.get(...)`.
- `line 108`: `this.history.values()` → `this.historyMap.values()` (body of the public `history()` method).
- `line 115`: `this.history.get(id)` → `this.historyMap.get(id)`.
- `line 122`: `this.history.clear()` → `this.historyMap.clear()`.
- Public method `history(): ReadonlyArray<...>` (line 107) unchanged. No exports changed.

## 6. Verification

| Item | Result | Evidence |
|------|--------|----------|
| TypeScript compilation | **VERIFIED** | `npm run typecheck` exit 0 |
| Lint | **VERIFIED** | `npm run lint` exit 0 |
| Build (`npm run build`, userscript) | **VERIFIED** | exit 0 — **duplicate-member warning eliminated** (previously emitted on every build) |
| Extension build (`node build-extension-dev.mjs`) | **VERIFIED** | exit 0, no warnings; product bundle now emits `historyMap` (`extension/dist/content.js`: `__publicField(this, "historyMap", new Map())` + 5 references) |
| Imports / module graph | **VERIFIED** | esbuild bundle of `versioning.ts` + `event-bus.ts` + `diagnostics-service.ts` succeeded (exit 0) |
| No remaining collisions | **VERIFIED** | build no longer emits `duplicate-class-member`; no `private history` member remains in `versioning.ts` |
| All VersionManager call sites | **VERIFIED** | grep confirms `diagnostics-service.ts:71` is the only external `history()` caller; all internal field references updated |
| Diagnostics runtime path (was latent crash) | **VERIFIED** | 11/11 assertions passed in Node harness against the bundled classes (see below) |
| No regressions | **VERIFIED** | `createVersion`, `subscribe`/unsubscribe, `latest`, `get`, `history`, `clear`, and `DiagnosticsService.snapshot()` all behave correctly |

**Runtime harness scenarios (Node, real bundled classes):**
- `history()` returns an array when empty (previously threw). PASS
- `history()` returns all versions after `createVersion` calls. PASS
- `latest()` resolves to the newest version (`v2`). PASS
- `get("v1")` resolves the stored version. PASS
- Subscriber notified on `createVersion`; unsubscribed subscriber not notified. PASS
- `DiagnosticsService.snapshot()` **does not throw** and returns `versionCount === 4` and `latestVersionId === "v4"`. PASS (this is the exact latent failure path from RC-001)
- `snapshot().modules` correctly reflects initialized state. PASS
- `clear()` empties history. PASS

**EXPECTED (not directly observed):** on a live CRM page, `ModuleManager.collectDiagnostics()` would now return a valid snapshot instead of throwing. This follows from the verified harness + source; no live-browser session was executed in this environment.

## 7. Remaining Limitations

- `DiagnosticsService.snapshot()` / `ModuleManager.collectDiagnostics()` still have no production caller; the fix unblocks them for future use but does not add callers (out of scope).
- No functional change to versioning behavior — this was a pure correctness/compilation fix.

## 8. Unknowns

- No live-browser runtime session was executed; the diagnostics path is verified at the Node/real-bundle level (**VERIFIED**) and the live-CRM behavior is **EXPECTED**.
- Whether any external consumer (outside this repository) calls `VersionManager.history()` on the shadowed member is **UNKNOWN**; within the repository, all references are accounted for.
