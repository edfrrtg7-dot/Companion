# RC-STABLE-002-FIX-001 Implementation Report

## 1. Objective

Fix the route-dependent Finance lifecycle introduced by RC-STABLE-002: on non-chat routes the widget is forced collapsed via `widget.collapse()`, which persisted `collapsed: true` and erased the operator's expanded state chosen on the chat route; on return to the chat route the saved preference was not restored.

The fix introduces two distinct state concepts — the **user chat-route preference** and the **route-enforced presentation** — and makes SPA route transitions restore the preference immediately without overwriting it and without duplicate refreshes.

## 2. Baseline

- **Repository**: `edfrrtg7-dot/Companion`
- **Baseline Commit**: `071b7dcca75ddccf2f1708caf48aa4747f83583e` (RC-STABLE-002, HEAD == origin/master)
- **Branch**: `master`
- **Version**: 2.1.0 (package.json, app-version.ts, manifest.json all in sync)

## 3. Repository Evidence

Key files inspected before implementation:

- `src/companion/finance-module.ts` — `restoreVisibility()` (L247–280) and `onHashChange()` (L375–398): both called `widget.collapse()` on non-chat, which persisted `collapsed: true`; the chat branch did nothing on non-chat→chat.
- `src/companion/finance-widget.ts` — `FinanceWidgetConfig` (L44–51), `DEFAULT_STATE` (L60–67), constructor `super()` → render → `if (!this.win.collapsed) { firstExpandDone = true; controller.refresh(); }` (L128–138), `expand()` override with first-expand auto-refresh (L196–204).
- `src/companion/companion-window.ts` — `WindowState` (L18–31), `loadState()` (L68–94), `toggleCollapse()` (L317–328), `collapse()`/`expand()`, `persistState()`.
- `src/companion/runtime-environment.ts` — `RuntimeEnvironment.isChatRoute()`, `getRouteCategory()` (added in RC-STABLE-002), `setRuntimeEnvironment()` (L26–28).
- `src/companion/bootstrap-coordinator.ts` L92 — calls `financeModule?.restoreVisibility()` during bootstrap.
- `src/companion/create-composition.ts` L25 — calls `setRuntimeEnvironment(runtime)` during bootstrap, before any module lifecycle.
- `agencybooster-devtoolkit/rc-stable-001-harness.ts` — harness template (esbuild bundle + node run).

Grep-confirmed facts:
- Only `finance-module.ts` registers a `hashchange` listener (initialize L134, dispose L157).
- `windowState.collapsed` was the single persisted field for both preference and presentation — the root cause of the loss.
- No polling, timers, or URL polling anywhere in the Finance lifecycle.
- Existing runtime harnesses (`rc-stable-001-harness.ts`, `rc-polish-004-fix-harness.ts`) predate the RC-STABLE-002 runtime-environment requirement and did not call `setRuntimeEnvironment()`.

## 4. Root Cause

RC-STABLE-002 forced the widget collapsed on non-chat routes by calling `widget.collapse()` in `restoreVisibility()` and `onHashChange()`. `collapse()` writes `win = { ..., collapsed: true }` and `persistState()`, so the persisted `collapsed` flag flipped to `true` on every non-chat visit. Because `collapsed` was the only persisted state, the operator's chat-route expanded choice was lost. Additionally, the non-chat→chat `onHashChange()` branch performed no restore action at all.

Evidence: `collapse()` (companion-window.ts) sets `collapsed: true`; `toggleCollapse()` was the only path distinguishing user intent, but route-forced calls bypassed it.

## 5. Modified-File Plan

| File | Reason | Owner | Expected Side Effects |
|------|--------|-------|----------------------|
| `src/companion/companion-window.ts` | Add `chatCollapsed` state field + migration + user-preference recording + `applyChatPreference()` | CompanionWindow | Persisted states gain `chatCollapsed`; legacy states migrate; route-forced collapse never touches preference |
| `src/companion/finance-widget.ts` | Apply route presentation in constructor; add `forceCollapsed` config; override `applyChatPreference()` with exactly-one refresh | FinanceWidget | Non-chat construction starts collapsed without refresh; chat construction restores preference; SPA expanded restore refreshes once |
| `src/companion/finance-module.ts` | Pass `forceCollapsed` in `restoreVisibility()`; route logic in `onHashChange()` uses `collapse()`/`applyChatPreference()` | FinanceModule | Chat preference preserved across routes; no duplicate refresh; listener lifecycle unchanged |

## 6. Modified Files

1. `src/companion/companion-window.ts`
2. `src/companion/finance-widget.ts`
3. `src/companion/finance-module.ts`
4. `scripts/Companion.user.js` (regenerated build artifact)
5. `scripts/Companion.arena.user.js` (regenerated build artifact)

## 7. Changes Per File

### `src/companion/companion-window.ts`
- **Added**: `chatCollapsed: boolean` to `WindowState` with doc comment — the operator's chat-route collapse preference, distinct from live `collapsed`.
- **Modified**: `loadState()` — legacy persisted states (pre-preference) are migrated by setting `chatCollapsed = collapsed`.
- **Added**: `applyChatPreference()` — applies the saved chat preference to the live presentation via `collapse()`/`expand()`; never writes the preference.
- **Modified**: `toggleCollapse()` — after expanding/collapsing, persists `chatCollapsed: <resulting state>` (the header button / user-initiated path records the preference; programmatic `collapse()`/`expand()` calls do not).

### `src/companion/finance-widget.ts`
- **Added**: `readonly forceCollapsed?: boolean` to `FinanceWidgetConfig` — non-chat construction forces collapsed regardless of the saved preference.
- **Modified**: `DEFAULT_STATE` gains `chatCollapsed: true`.
- **Modified**: constructor — after `super()`, sets `collapsed = config.forceCollapsed ? true : this.win.chatCollapsed` before the first render. The existing `if (!this.win.collapsed) { firstExpandDone = true; controller.refresh(); }` handles chat-route expanded startup with exactly one refresh; collapsed startup performs none.
- **Added**: `override applyChatPreference()` — sets `firstExpandDone = true` (suppresses the `expand()` override's first-expand auto-refresh), calls `super.applyChatPreference()`, then refreshes once only when the widget was previously collapsed and is now expanded.

### `src/companion/finance-module.ts`
- **Modified**: `restoreVisibility()` — creates the widget with `{ forceCollapsed: routeCategory === "non-chat" }`; for non-chat ensures collapsed + shows; for chat/unknown relies on the constructor having applied the saved chat preference (persisted visibility preserved).
- **Modified**: `onHashChange()` — chat→non-chat calls `widget.collapse()` (presentation-only, no preference update, no refresh); non-chat→chat calls `widget.applyChatPreference()` (restores preference immediately; expanded restore triggers exactly one refresh).
- **Unchanged**: `initialize()` hashchange listener registration and `dispose()` removal (L134, L157).

## 8. State Semantics

Two distinct persisted fields in the unified finance state:

| Field | Meaning | Written by |
|-------|---------|------------|
| `collapsed` | Live presentation (what the widget currently renders) | `collapse()`/`expand()`, constructor route presentation |
| `chatCollapsed` | User chat-route preference (what the operator last chose on a chat route) | `toggleCollapse()` (header button / user action), legacy migration |

- User actions (header collapse button, header double-click → `toggleCollapse()`) update `chatCollapsed`.
- Route-forced presentation changes call `collapse()`/`expand()` directly and never update `chatCollapsed`.
- The widget constructor resolves presentation: `collapsed = forceCollapsed ? true : chatCollapsed`.
- Legacy persisted states without `chatCollapsed` migrate to `chatCollapsed = collapsed`, preserving prior behavior.

## 9. Route Lifecycle

- **Chat startup, expanded preference**: constructor applies `collapsed = chatCollapsed = false` → `if (!this.win.collapsed)` triggers exactly one refresh.
- **Chat startup, collapsed preference**: constructor applies `collapsed = true` → no refresh.
- **Non-chat startup**: widget constructed with `forceCollapsed` → collapsed, zero refreshes; `chatCollapsed`, x/y, expanded width/height, shift, and visibility preserved.
- **SPA chat→non-chat**: `onHashChange()` → `widget.collapse()`; visual collapse only, preference untouched, no refresh.
- **SPA non-chat→chat (expanded preference)**: `widget.applyChatPreference()` → expands and triggers exactly one refresh.
- **SPA non-chat→chat (collapsed preference)**: `applyChatPreference()` → stays collapsed, zero refreshes.
- **Repeated transitions**: each expanded restore yields exactly one refresh; the single hashchange listener is never duplicated.
- **Dispose**: existing `dispose()` removes the hashchange listener.

## 10. Runtime Harness

`agencybooster-devtoolkit/rc-stable-002-fix-001-harness.ts` — executable Node harness following the established pattern (esbuild `--bundle --platform=node --format=cjs --external:jsdom`, then `node`).

Environment:
- JSDOM with mocked `fetch` (3 transactions) and mocked `localStorage`.
- `getBoundingClientRect()` mocked on `HTMLElement.prototype` (jsdom has no layout engine — derived from inline style so `collapse()`'s geometry snapshot stays sane).
- Mutable runtime-environment stub (`setRuntimeEnvironment`) with a switchable `routeHash`; hashchange dispatched on `window`.
- `EventTarget.prototype.addEventListener/removeEventListener` wrappers tracking listener lifecycle.

Exactly **20 executable assertions** (F1–F17), all passing:

| # | Assertion |
|---|-----------|
| F1 | Chat startup (expanded pref) → expanded presentation + exactly one refresh |
| F2 | Chat startup (collapsed pref) → collapsed presentation + zero refreshes |
| F3 | Non-chat startup → collapsed presentation |
| F4 | Non-chat startup → `chatCollapsed` preference preserved |
| F5 | Non-chat startup → zero refreshes |
| F6 | chat→non-chat → collapsed presentation |
| F7 | chat→non-chat → preference unchanged, no refresh |
| F8 | non-chat→chat (expanded pref) → expanded presentation |
| F9 | non-chat→chat (expanded pref) → exactly one refresh |
| F10 | Repeated transitions → exactly one refresh per expanded restore |
| F11 | x/y + expanded width/height unchanged across transitions |
| F12 | Shift unchanged across transitions |
| F13 | No duplicate hashchange listeners |
| F14 | non-chat→chat (collapsed pref) → stays collapsed + zero refreshes |
| F15 | User collapse/expand on chat updates `chatCollapsed` preference |
| F16 | Route-forced collapse does not update `chatCollapsed`, but collapses presentation |
| F17 | Hashchange listener registered on initialize, removed on dispose |

Result: **20 checks, 0 failures** (exit code 0).

## 11. Verification

### Build Verification (all commands executed in repository root)

| Command | Exit Code | Output Summary |
|---------|-----------|----------------|
| `npm run typecheck` | 0 | tsc --noEmit, no errors |
| `npm run lint` | 0 | eslint src/ extension/, no errors |
| `npm run version:check` | 0 | "Version check OK: all artifacts report 2.1.0" |
| `npm run build` | 0 | `Companion.user.js` 280.8kb |
| `npm run build:arena` | 0 | `Companion.arena.user.js` 279.0kb |
| `npm run build:ext` | 0 | `extension/dist/content.js` 281.4kb, `background.js` 605b |

### Runtime Assertions

| Check | Result |
|-------|--------|
| FIX-001 harness (20 assertions, this EPIC) | VERIFIED — 20 checks, 0 failures |
| `rc-stable-001-harness` (47 checks) | VERIFIED — 0 failures (harness updated to set a runtime stub) |
| `rc-polish-004-fix-harness` (29 checks) | 1 pre-existing failure — unrelated date-sensitive test data (see Regressions) |

## 12. Browser Verification

| Scenario | Classification | Notes |
|----------|----------------|-------|
| Chat route startup, expanded preference → expanded + one refresh | EXPECTED | Constructor applies `chatCollapsed`; harness F1 VERIFIED |
| Chat route startup, collapsed preference → collapsed, no refresh | EXPECTED | Harness F2 VERIFIED |
| Non-chat route startup → collapsed, no refresh, preference preserved | EXPECTED | Harness F3–F5 VERIFIED |
| SPA chat→non-chat → collapse, no refresh, preference preserved | EXPECTED | Harness F6–F7 VERIFIED |
| SPA non-chat→chat (expanded pref) → expand + one refresh | EXPECTED | Harness F8–F9 VERIFIED |
| SPA non-chat→chat (collapsed pref) → stays collapsed, no refresh | EXPECTED | Harness F14 VERIFIED |
| Repeated SPA transitions → no duplicate refresh/listeners | EXPECTED | Harness F10, F13 VERIFIED |
| x/y and expanded dims preserved across transitions | EXPECTED | Harness F11 VERIFIED |
| Shift preserved across transitions | EXPECTED | Harness F12 VERIFIED |
| User collapse/expand on chat updates preference | EXPECTED | Harness F15 VERIFIED |
| Route-forced collapse does not update preference | EXPECTED | Harness F16 VERIFIED |
| Dispose removes hashchange listener | EXPECTED | Harness F17 VERIFIED |

Actual browser execution on GoldenBride was not performed in this session — interactive verification remains UNKNOWN.

## 13. Regressions

Preserved behaviors (source untouched or behavior-equivalent):
- CASH refresh logic and concurrency guard — untouched.
- Responsive Finance CSS (container queries, clamp) — untouched.
- Change Delays UI — untouched.
- Operation validation, launcher, New Shift, Reset IceBreaker, Import Snippets, dashboard actions — untouched.
- Legacy persisted states (no `chatCollapsed`) behave as before via migration.
- Prior harness expectations preserved with a runtime stub (chat route): `rc-stable-001-harness` 47/47 pass.

**Pre-existing unrelated finding (reported, not acted on):** `rc-polish-004-fix-harness` check "S1 body contains transaction data" fails (1/29) because its mock transactions are dated 2026-08-01 while the harness runs on 2026-08-03; the shift filter yields "No transactions for this shift." Verified identical at the baseline commit `071b7dc` — not caused by this EPIC.

## 14. Limitations

1. **Route detection granularity**: route category comes from `getRouteCategory()` (`VIEWMAIL` → chat, other `#!` → non-chat, else unknown). GoldenBride route format changes would require updating that helper.
2. **Unknown route category**: an unknown route at startup follows the chat path (applies saved chat preference) — a safe default, consistent with RC-STABLE-002.
3. **Non-chat user expansion**: on a non-chat route the launcher (`open()`/`toggle()`) creates the widget with default config, applying the saved chat preference. This is a user-initiated override and intentionally does not force-collapse.

## 15. Unknowns

- **Browser verification**: interactive GoldenBride behavior (real hashchange timing, real layout) was not executed in a live environment; harness results are classified VERIFIED at the runtime level, browser scenarios EXPECTED.
- **GoldenBride SPA navigation**: whether other navigation paths besides `hashchange` (e.g., history pushState) can change the route is UNKNOWN; the listener lifecycle covers the documented `hashchange` path.
