# Implementation Report — RC-005 Respect Persisted Finance Widget Visibility

## 1. Analysis

**P2 defect (RC-001 Finding 11, RC-001-B5):** the Finance widget is automatically shown at startup even when the persisted window state is `hidden: true`. A user who closes the widget sees it reopen after every page reload.

**Startup call chain (the exact defect path):**

1. `bootstrap-coordinator.ts:87` — startup auto-launch: `this.financeModule?.open()` runs unconditionally after `app.start()` in `run()`.
2. `finance-module.ts:243-254` — `open()` creates the widget if needed (the `FinanceWidget` constructor and `CompanionWindow` superclass already load and apply the persisted state, including `display:none` when `hidden: true`), then unconditionally calls `this.widget.show()` (line 252).
3. `companion-window.ts:195-203` — `show()` sets `win.hidden = false`, `root.style.display = ""`, and persists `hidden: false`, permanently overriding the user's persisted `hidden: true`.

**Where persisted visibility is restored:** `CompanionWindow` constructor (`companion-window.ts:145-146`) loads the saved `WindowState` via `loadState()`; `FinanceWidget.createRoot()` (`finance-widget.ts:311-314`) applies `root.style.display = "none"` when `saved.hidden`, and `initWindow()` (`companion-window.ts:166`) skips the keyboard listener when hidden. So the widget construction already respects persistence — the defect is purely that `open()` unconditionally calls `show()` afterwards.

**Why the fix cannot live inside `open()`:** `open()` has two callers with different intents:
- `bootstrap-coordinator.ts:87` — startup auto-launch (must respect persistence).
- `bootstrap-coordinator.ts:76-79` — the Companion modal's "Finance Widget" button (`companion-modal.ts:136-142`), i.e. explicit user intent (must force-show even a previously hidden widget).

`docs/module-api.md` defines `open()` as "Open/show the module… Module's widget is visible and active" — force-show semantics. Preserving the modal click behavior requires keeping `open()` unchanged and scoping the persistence-respecting behaviour to the startup call site.

**Smallest safe correction:** introduce a `FinanceModule.restoreVisibility()` method that creates the widget (which applies the persisted visibility state) but never forces it visible, and call that from the startup auto-launch instead of `open()`. No widget-lifecycle, persistence, or storage redesign.

## 2. Investigation

- `bootstrap-coordinator.ts` (full read): auto-launch at line 87; modal-click handler at lines 76-79; single startup entry used by both Chrome and Arena bootstrap paths via `createComposition()`.
- `finance-module.ts` (full read): `open()` at 243-254 (create → `hide()` → `show()`); `close()` at 256-260; `isOpen` getter at 262-264 (backed by `widget.isVisible`); `initialize()` at 90-153.
- `companion-window.ts` (full read): `loadState()`/`saveState()` helpers (63-92); constructor loads persisted state (137-147); `show()`/`hide()` mutate `win.hidden` and persist (195-216); `initWindow()` skips keyboard listener when hidden (166).
- `finance-widget.ts` (full read): constructor → `render()` → `createRoot()` applies `saved.hidden` as `display:none` (311-314); `show()`/`hide()` delegate to `super`.
- `companion-modal.ts`: "Finance Widget" button binds `onFinanceClick` (136-142); `setFinanceClickHandler` (437-439).
- Grep `\.open\(\)|restoreVisibility` across `src/`: only `bootstrap-coordinator.ts:78` (modal) and `:87` (startup) call module open; the only `widget.show()` call is `finance-module.ts:252`. No other startup path forces the widget visible.
- Grep `\.show\(\)|\.hide\(\)`: `CompanionWindow.show/hide` and `FinanceWidget.show/hide` delegate; no other callers force widget visibility at startup.
- Docs: `docs/module-api.md` confirms `open()` = force-show semantics.

**Affected files:** only `src/companion/bootstrap-coordinator.ts` (startup call swap) and `src/companion/finance-module.ts` (new method). No changes to `companion-window.ts`, `finance-widget.ts`, or storage.

## 3. Implementation Plan

- Add `FinanceModule.restoreVisibility(): void` — same guards as `open()` (`initialized`/`disposed`/`controller`), creates the widget via `new FinanceWidget(this.controller)` when absent, then returns without calling `show()`. The widget's constructor applies the persisted visibility state (`display:none` when hidden), so no further action is needed.
- Change the startup auto-launch in `bootstrap-coordinator.ts:87` from `this.financeModule?.open()` to `this.financeModule?.restoreVisibility()`, and update the dev-mode diag text accordingly.
- Leave `open()`, `close()`, `isOpen`, `CompanionWindow`, `FinanceWidget`, and storage untouched.

**Why not alternatives:** (a) changing `open()` itself would break the modal "Finance Widget" button, which must force-show a previously closed widget (verified regression path — `companion-modal.ts:140`); (b) reading the widget storage key directly from the coordinator would duplicate `CompanionWindow.loadState()`'s parse/validation logic and couple the coordinator to the widget's storage schema; (c) a force-show parameter on `open()` changes the documented module API and adds a caller-contract.

## 4. Modified Files

| Path | Reason |
|------|--------|
| `src/companion/finance-module.ts` | Add `restoreVisibility()` — the persistence-respecting entry point for startup. |
| `src/companion/bootstrap-coordinator.ts` | Startup auto-launch now restores persisted visibility instead of forcing the widget open. |

No other tracked files were created, deleted, or modified. Repository state verified with `git status` — only these two files are tracked-modified at commit time.

## 5. Changes Per File

### `src/companion/finance-module.ts`
- Added public method `restoreVisibility()` after `open()`: guards mirror `open()`; creates the widget if absent (`new FinanceWidget(this.controller)`) without calling `hide()` or `show()`, so the constructor's persisted-state application (`display:none` when `hidden: true`) is preserved; dev-mode diag added.
- `open()`, `close()`, `isOpen` unchanged. Public exports unchanged (new method added only).

### `src/companion/bootstrap-coordinator.ts`
- Line 87: `this.financeModule?.open()` → `this.financeModule?.restoreVisibility()`.
- Dev-mode diag: `"[bootstrap] Auto-launching Finance module"` → `"[bootstrap] Restoring Finance module visibility"`.
- Modal-click handler (line 76-79) unchanged — still calls `open()`.

## 6. Verification

| Item | Result | Evidence |
|------|--------|----------|
| TypeScript compilation | **VERIFIED** | `npm run typecheck` exit 0 |
| Lint | **VERIFIED** | `npm run lint` exit 0 |
| Build (`npm run build`, userscript) | **VERIFIED** | exit 0, no warnings |
| Imports / module graph | **VERIFIED** | esbuild bundle of `finance-module` + `finance-widget` + `companion-window` + storage/platform modules succeeded (exit 0) |
| Only startup call site changed | **VERIFIED** | grep: `open()` remains only at `bootstrap-coordinator.ts:78` (modal); `restoreVisibility()` at `bootstrap-coordinator.ts:87` |
| Hidden widget stays hidden after startup restore | **VERIFIED** | runtime harness 21/21 assertions (see below) |
| Visible widget stays visible after startup restore | **VERIFIED** | runtime harness (scenarios B/C) |
| Persistence still functions | **VERIFIED** | runtime harness (scenarios A/E round-trip) |
| Modal force-open preserved (no regression) | **VERIFIED** | runtime harness (scenarios A5-A7, D) |

**Runtime harness scenarios (Node, real bundled source, minimal DOM shim + synchronous localStorage platform):**

- **A — persisted `hidden: true`, startup restore then modal click:**
  - `restoreVisibility()` creates the widget hidden: `isOpen === false`, root `display: none`, storage still `hidden: true`. PASS
  - `open()` (modal path) force-shows: `isOpen === true`, display restored, storage `hidden: false`. PASS
  - `close()` hides and persists `hidden: true`. PASS
- **B — persisted `hidden: false`:** `restoreVisibility()` keeps the widget visible, no display override, storage unchanged. PASS
- **C — first run (no persisted state):** `restoreVisibility()` shows the widget (default `hidden: false`). PASS
- **D — modal click on a fresh module with persisted `hidden: true`** (the exact former startup bug path through `open()`): widget is force-shown and persisted visible. PASS — the force-open path is preserved.
- **E — widget-level persistence:** constructor respects persisted hidden; `show()` persists `hidden: false`; `hide()` persists `hidden: true`. PASS

**EXPECTED (not directly observed):** on a live CRM page, after this change the finance widget opens at startup only when the persisted state is not hidden; a widget the user previously closed stays closed after reload. This follows from the verified module-level harness + source; no live-browser session was executed in this environment.

## 7. Remaining Limitations

- On a first run with no persisted widget state, `restoreVisibility()` no longer writes the default state to storage (previously `open()`'s hide→show sequence wrote `hidden: false`). The widget is visible either way; storage is now written only on user interaction (drag/resize/collapse/show/hide). This is an incidental, non-user-visible behavioural nuance of removing the forced show.
- Feature freeze respected: no other RC-001 findings were addressed. The cold-start storage hydration race (RC-001-B8) still applies to widget-state reads in the extension; out of scope here.

## 8. Unknowns

- No live-browser runtime session was executed; end-to-end startup behaviour is **EXPECTED**, not directly observed (**VERIFIED** only at the Node/real-bundle level).
- Whether persisted `hidden: true` finance-widget state exists in the wild (RC-001 Unknown 5) remains **UNKNOWN**; the fix makes the code respect it regardless.
