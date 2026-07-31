# Investigation Report — RC-007 Premise Contradicted by Repository

## Objective

Determine whether the RC-007 defect described as "remaining runtime code that retrieves the active Platform implementation through `getGlobal("platform")`" exists in the repository, and if so, eliminate it. The repository is the single source of truth; conclusions must be traceable to collected evidence.

**Result: RC-007 is aborted. The premise is disproved by repository evidence. No code was modified.**

---

## Evidence

Evidence ordered by reliability. All paths relative to repo root `C:\Users\denme\OneDrive\Документы\Default Project`.

### Repository — git baseline (VERIFIED)

```
$ git rev-parse HEAD
680978d307582d0d15e03dcabe51f17bbe9030a3   (RC-006: flush pending session memory on page exit)
$ git rev-parse origin/master
680978d307582d0d15e03dcabe51f17bbe9030a3
```

Working tree: only pre-existing untracked files (`.ai/`, `agencybooster-devtoolkit/`, `dashboard_result.txt`, `extension/dist.zip`, `src/companion.zip`, `temp-collectors.ts`, `templates/`). No tracked files modified at investigation start.

### Repository — `getGlobal("platform")` literal (VERIFIED, zero occurrences)

```
$ git grep -n 'getGlobal("platform")' $(git rev-list --all)
(no output)
$ git log --all --oneline -S 'getGlobal("platform")'
(no output)
```

The literal exists in **no revision of repository history**, therefore it has never been introduced and removed.

### Source — full-tree grep of `src/` for `"platform"` (VERIFIED)

```
grep pattern: "platform"  (string literal)
Result: No files found
```

The string literal `"platform"` appears nowhere in `src/`. There is no GlobalState or runtime key named `"platform"` anywhere in source.

### Source — `getGlobal(` occurrences (VERIFIED, interface declarations only)

All 9 occurrences of `getGlobal(` in `src/` are interface method **declarations or generic implementations**. There are **zero call sites**:

| Location | Kind |
|----------|------|
| `platform-interface.ts:23` | `Platform` interface declaration |
| `runtime-environment.ts:7` | `RuntimeEnvironment` interface declaration |
| `chrome-platform.ts:94` | `Platform` implementation (window lookup) |
| `arena-platform.ts:59` | `Platform` implementation (window lookup) |
| `arena-runtime-environment.ts:26` | `RuntimeEnvironment` implementation (window lookup) |
| `global-state.ts:29` | `ChromeGlobalState.get` (window lookup) |

```
$ Select-String -Pattern "\.getGlobal\(" src/**/*.ts
(no output)
```

No code calls `getGlobal(...)` with any argument, let alone `"platform"`.

### Source — GlobalState keys in use (VERIFIED)

The only GlobalState keys written or read anywhere in `src/`:

- `__AB_COMPANION_APP__` — `bootstrap-coordinator.ts:32`, `:36`, `:103` (duplicate-init guard and error flag).
- `__AB_COMPANION_EXTENSION_LOADED__` — content-script guard (Chrome entry point).

No `"platform"` key exists.

### Source — actual platform accessor (VERIFIED)

The established platform accessor is the module-level singleton `getPlatform()` in `platform-interface.ts:31-36` (backed by `setPlatform()` called from `create-composition.ts:25`). Consumers:

- `storage-adapter.ts:13,45,53,61,69,77,113,160,168,176`
- `storage-service.ts:20,37,107`
- `runtime-environment.ts:26,30,42` (`ChromeRuntimeEnvironment`)
- `companion-diagnostics.ts:21`
- `companion-diagnostics-collectors.ts:26,369,378`

Platform is injected via constructor composition (`create-composition.ts:24-27` → `setPlatform`/`setRuntimeEnvironment`/`setGlobalState`), not via any global-state string lookup. There is no service-locator pattern involving a `"platform"` key.

### Source — `getPlatform(` (module singleton, unrelated to GlobalState)

`getPlatform()` is a direct module-scope holder in `platform-interface.ts` — not a GlobalState/runtime window lookup. It is the designed dependency-flow accessor and is out of scope for "eliminate `getGlobal("platform")` lookup".

### Repository — RC-001-B6 actual content (VERIFIED)

The authoritative backlog item `RC-001-B6` in `.ai/context/rc-001-investigation.md:269` is:

> **RC-001-B6 — Refresh session list while modal open.** Re-render the list on new-event callback or a low-frequency interval so relative timestamps stay current.

This is a UI refresh item. **No RC-001 finding** mentions `getGlobal("platform")` or any platform-lookup coupling. The roadmap (`.ai/context/roadmap.md`) contains no reference to RC-007 or to a platform-global-lookup defect.

### Source — build artifacts (VERIFIED, zero occurrences)

```
Select-String -SimpleMatch 'getGlobal("platform")'   extension/dist/content.js, extension/dist/background.js,
                                                      scripts/Companion.user.js, scripts/Companion.arena.user.js,
                                                      scripts/AgencyBooster.user.js
Select-String -SimpleMatch "getGlobal('platform')"    (same files)
(no output for either variant)
```

---

## Findings

1. **The defect does not exist.** `getGlobal("platform")` has zero occurrences in source, build artifacts, and the entire git history (VERIFIED). It has never existed in the repository.
2. **The referenced backlog item is misattributed.** `RC-001-B6` is the session-list-refresh UI item, not a platform-coupling defect (VERIFIED, `rc-001-investigation.md:269`).
3. **No `"platform"` key exists in GlobalState or any runtime.** The string literal is absent from `src/` (VERIFIED).
4. **The platform dependency flow is already explicit.** Platform is constructor-injected at composition (`create-composition.ts:24-27`) and accessed via the module-level `getPlatform()` singleton (`platform-interface.ts:31`); there is no GlobalState-based platform retrieval to eliminate.
5. **`getGlobal(` exists only as interface contract + generic window-key implementations, with zero callers** (VERIFIED). No runtime path retrieves the Platform implementation through it.

## Unknowns

- Whether the RC-007 task author intended `getPlatform()` (module singleton) rather than `getGlobal("platform")`. The task explicitly names `getGlobal("platform")` and that string is absent. If `getPlatform()` were the target, the task's own constraints ("preserve Platform abstraction", "do not redesign dependency injection", "avoid service-locator patterns") would still prohibit its removal without a redesign, which the task forbids.
- Whether a future/planned EPIC will introduce such a lookup. No such code exists today.

## Conclusions

1. **RC-007 as specified has nothing to fix.** Implementing it would require fabricating a coupling that the repository disproves — a violation of evidence integrity.
2. **No code change is justified by repository evidence.** Every requirement that "no unrelated files be modified" and "every modification be justified by repository evidence" would be violated by any change.
3. **The genuine `RC-001-B6` backlog item** (session list refresh) is out of scope for this task's stated objective and remains unimplemented in the backlog.

## Recommended Actions

1. **Abort RC-007 implementation.** Commit this investigation report only; do not modify source.
2. **Correct the task.** The author should generate a corrected RC task based on the verified backlog — either repointing at the real `RC-001-B6` (session list refresh) or dropping the platform-lookup premise entirely.
3. **No platform-coupling cleanup is required** — none exists. If a future change introduces GlobalState-based platform lookups, it should be rejected as a service-locator pattern.

---

## Review Metrics

- Functions added: 0
- Functions modified: 0
- Exported APIs changed: none
- Interfaces changed: none
- Files changed (source): 0
