# RC-STABLE-005 — Refine Finance Header and New-Transaction Feedback

## 1. Objective

Refine the Finance widget UI in four parts:

- **Part A** — Remove the gold status light (`.ab-finance-cash-dot`) that pulsed next to the
  CASH control.
- **Part B** — Add a red circular `!` new-transaction indicator next to CASH, hidden by
  default, that appears only after a **user-triggered CASH refresh** detects a new
  transaction identity against the previous successful snapshot for the **same exact
  date + shift**. No numeric counter. Accessible `title`/`aria-label` = "New transaction".
  Must not shift header layout when hidden. Auto refresh, initial load, and date/shift
  change must never reveal it; failed, cancelled, stale, or aborted refreshes must never
  reveal it; the previous indicator is cleared when the next manual refresh starts. Not
  persisted.
- **Part C** — Move the shift selector from the header into the expanded body, next to the
  date/shift info. Preserve options, behavior, and the selected shift; reuse the existing
  refresh/state path; not rendered when collapsed; no inline styles.
- **Part D** — Reorder the header to
  `[FINANCE] [CASH refresh] [new indicator] [flexible empty drag area] [collapse] [close]`
  with a flexible spacer drag surface, consistent gaps, working double-click-to-toggle on
  empty header space, interactive controls excluded from the double-click toggle, and
  correct behavior at narrow widths.

Scope: **Finance widget UI only.** No changes to Finance API, mapping, profile resolution,
import logic, storage schema, or unrelated UI. Controller unviewed machinery
(`unviewedTxIds`, `isTxUnviewed`, `markTxViewed`, `unviewedTransactions`) left intact per
user decision.

## 2. Baseline

- Git HEAD at start: `fd8cf545822b19225cf9fa3e72a4c23ef3c24124` (commit
  `RC-STABLE-004: support VideoChatSatellite finance operation`), equal to
  `origin/master` (VERIFIED via `git rev-parse` before work).
- Working tree at start: only untracked files (`agencybooster-devtoolkit/`, `.ai/`,
  `extension/dist.zip`, `src/companion.zip`, `temp-collectors.ts`, `dashboard_result.txt`,
  `templates/`) — no tracked modifications.

## 3. Runtime Evidence

All runtime evidence is harness output (Node + JSDOM), captured this session:

- New harness `rc-stable-005-finance-header-ui-harness`: **33 checks, 0 failures**, exit 0.
  Covers the 28 required checks (Part A: 1–3; Part B: 4–15; Part C: 16–20; Part D: 21–28)
  plus 5 supplementary assertions (C2b, C7b, C8b, C20b, C27a).
- Finance regression harnesses (rebuilt from current source, rerun at 15:51 local, Day
  shift): all exit 0, 0 failures (see Section 16).

## 4. Existing Architecture

- `FinanceWidget` (`src/companion/finance-widget.ts`) extends `CompanionWindow`
  (`src/companion/companion-window.ts`). `createRoot()` builds header + body; the header is
  also the drag handle (`id ab-finance-drag-handle`). `initWindow(dragHandle, resizeHandle)`
  attaches `pointerdown` (drag), resize, collapse/close listeners.
- Header double-click toggle: a single `boundHeaderDblClick` on the header;
  `onHeaderDblClick` filters interactive targets (`closest()`), then `toggleCollapse()`.
- Status light: `cashDotEl` (`.ab-finance-cash-dot`, gold `●`, pulse via
  `updateCashIndicator()` when `unviewedTransactions > 0`). Rendered/pulsed in
  `render()`/`createRoot()`.
- CASH refresh: `cashIndicatorEl` (`.ab-finance-cash-indicator`, button) + `cashRefreshEl`
  (`.ab-finance-cash-refresh`, spinning `⟳`). `onHeaderRefreshClick` → `controller.refresh()`.
  Disabled while `controller.isLoading`.
- Shift selector: `shiftBtn`/`shiftDropdown` were created inside header `actions`
  (`onShiftToggle`, `onShiftSelect` → `controller.setShift`), synced via
  `updateShiftButton(shift)`; options from `FinanceShift.getAllDefinitions()`.
- Body: `contentEl` (`.ab-finance-body`); `fullRebuild()` (structural, shift-info rows +
  rows) vs `incrementalUpdate()`. `needsFullRebuild` keys on shift, waiting flag, filtered
  count.
- `FinanceState` (`finance-controller.ts:22-30`): `status`, `data`, `error`, `from: Date`,
  `to: Date`, `shift`, `unviewedTransactions`. `txIdentity` (`finance-controller.ts:60-62`)
  = `date.getTime()_ladyID_userID_operation_sum`.
- CSS is injected as `#ab-finance-styles` (`finance-module.ts:394-399`) from
  `FINANCE_WIDGET_CSS` (`src/companion/finance-widget.css.ts`).
- Refreshes originate from: constructor restored-expanded, first expand, and
  `applyChatPreference` expanded restore (all automatic); and the CASH click (manual).

## 5. Modified-File Plan

| File | Reason |
| --- | --- |
| `src/companion/finance-widget.ts` | Parts A–D DOM/state/logic changes. |
| `src/companion/finance-widget.css.ts` | Remove cash-dot styles; add indicator, spacer, header gap, body shift-select positioning. |
| `scripts/Companion.user.js` | Tracked build artifact; regenerated from changed source. |
| `scripts/Companion.arena.user.js` | Tracked build artifact; regenerated from changed source. |
| `.ai/context/rc-stable-005-finance-header-ui-implementation.md` | This report. |

Not modified (explicitly out of scope, per user decisions): `finance-controller.ts`,
`finance-api-client.ts`, `finance-mapper.ts`, `finance-shift.ts`, `companion-window.ts`,
`finance-module.ts`, storage schema, resolver, and every other file.

## 6. Modified Files

1. `src/companion/finance-widget.ts` (modified)
2. `src/companion/finance-widget.css.ts` (modified)
3. `scripts/Companion.user.js` (regenerated artifact)
4. `scripts/Companion.arena.user.js` (regenerated artifact)
5. `.ai/context/rc-stable-005-finance-header-ui-implementation.md` (created, this report)

`agencybooster-devtoolkit/` (harness source + `.cjs`) is untracked and NOT part of the
commit. `extension/dist/` is gitignored.

## 7. Changes Per File

### `src/companion/finance-widget.ts`

- Fields: removed `cashDotEl`, `manualRefreshPending`; added `newTxIndicatorEl`,
  `manualRefreshSeq` (monotonic manual-refresh id), `loadingCount` (observed loading-state
  counter), `lastLoadedKey` (date+shift key of last successful snapshot),
  `lastLoadedIds` (identity set of last successful snapshot).
- `destroy()`: nulls `newTxIndicatorEl`; cash-dot reference removed.
- `createRoot()`: removed cash-dot creation and its append; added
  `newTxIndicator` (`.ab-finance-new-indicator`, text `!`, `title`/`aria-label`
  "New transaction", **no** `hidden` attribute so layout is stable) and
  `headerSpacer` (`.ab-finance-header-spacer`) between the indicator and `actions`;
  removed shift-btn/shift-dropdown creation from the header; header child order is now
  title, CASH, indicator, spacer, actions.
- `render()`: `updateCashIndicator(state)` call removed; added
  `updateNewTxIndicator(state)` (runs before the collapsed-content guard so collapsed
  manual refreshes still evaluate).
- Removed `updateCashIndicator()` entirely.
- `createShiftSelector()` (new): builds `.ab-finance-shift-select` (button + dropdown) for
  the body, assigns `this.shiftBtn`/`this.shiftDropdown`, wires `onShiftToggle`/`onShiftSelect`,
  iterates `FinanceShift.getAllDefinitions()`.
- `fullRebuild()`: shift-info now renders Date row, then `createShiftSelector()`, then a
  "Shift:" row showing `${def.label} (${def.timeDisplay})` (`.ab-finance-shift-time-range`),
  then `updateShiftButton(shift)`.
- `onHeaderDblClick()`: `.ab-finance-new-indicator` added to the interactive-target filter
  (CASH, shift-btn, shift-dropdown, collapse, close unchanged).
- `onHeaderRefreshClick()`: clears the indicator, increments `manualRefreshSeq`, captures the
  previous snapshot key/ids, then evaluates the result on the `controller.refresh()`
  completion promise with a loading-generation guard (superseded refreshes never reveal).
- `snapshotKey()`/`showNewTxIndicator()`/`hideNewTxIndicator()` (new) and
  `updateNewTxIndicator()` (rewritten): see Sections 9–10.

### `src/companion/finance-widget.css.ts`

- Removed `.ab-finance-cash-dot`, `.ab-finance-cash-dot.pulse`, and
  `@keyframes ab-finance-gold-pulse`.
- Added `.ab-finance-new-indicator` (16×16 red circle, centered `!`, default
  `visibility: hidden`; `.visible` reveals it — layout-stable) and
  `.ab-finance-header-spacer` (`flex: 1 1 auto; min-width: 0; align-self: stretch`).
- Header: added `gap: clamp(4px, 1vw, 8px)` so FINANCE and CASH never touch and gaps stay
  consistent.
- `.ab-finance-header-actions`: removed `position: relative` (no longer a dropdown
  positioning context).
- Shift selector restyled for the body: `.ab-finance-shift-select` (`position: relative;
  align-self: flex-start`), `.ab-finance-shift-btn` given a visible bordered control look,
  `.ab-finance-shift-dropdown` now `left: 0` relative to the select (was `right: 0` relative
  to header actions).
- Added `.ab-finance-shift-time-range` (weight 500, 70% white).

### `scripts/Companion.user.js` / `scripts/Companion.arena.user.js`

Regenerated via `npm run build` / `npm run build:arena`. Verified to contain
`ab-finance-new-indicator` and `ab-finance-header-spacer` and no `ab-finance-cash-dot`
(content search).

## 8. Removed Status-Light Logic

- DOM: `.ab-finance-cash-dot` span no longer created or appended.
- State: `updateCashIndicator(state)` removed from `render()`.
- CSS: `.ab-finance-cash-dot`, `.ab-finance-cash-dot.pulse`, and the gold-pulse keyframes
  deleted.
- Dead code: `cashDotEl` field and all references removed; grep for
  `updateCashIndicator|cashDotEl|manualRefreshPending` returns no matches in `src/`.
- Controller unviewed machinery is untouched (per user decision) even though no UI consumes
  `unviewedTransactions` anymore; it remains a future-cleanup candidate (Section 19).

## 9. New-Transaction Detection

Detection is UI-only and reuses the existing `txIdentity` (`finance-controller.ts:60`).

**Baseline maintenance** (`updateNewTxIndicator`, called from `render()` on every state):
- On `loading` state: increment `loadingCount` (each refresh emits exactly one loading).
- Compute the context key = `${state.from.getTime()}|${state.to.getTime()}|${state.shift}`.
- If the key differs from `lastLoadedKey` (date or shift changed): hide the indicator and
  reset `lastLoadedIds` to empty — the indicator never carries across a date/shift change
  and comparisons never cross contexts.
- On the first successful `loaded` render for a context: store the filtered identity set as
  the baseline, keep hidden.
- On any later non-manual `loaded` render for the same context: update the baseline, keep
  hidden.

**Manual refresh evaluation** (`onHeaderRefreshClick`):
1. Hide the previous indicator immediately.
2. `manualId = ++manualRefreshSeq`; capture `prevKey` and `prevIds` (baseline snapshot).
3. Call `controller.refresh()`. Its `loading` state is emitted synchronously, so
   `loadingCount` right after the call is the generation of this manual refresh
   (`manualGen`).
4. On the completion promise, evaluate **only if**: the widget is alive, `manualId` is still
   the latest (`manualRefreshSeq` unchanged), `manualGen === loadingCount` (no newer refresh
   superseded this one), `state.status === "loaded"` (not failed/cancelled/aborted), and the
   key still matches `prevKey` (same date+shift).
5. Show iff at least one current identity is absent from `prevIds`; otherwise keep hidden.

This design guarantees: failed (error status), cancelled/aborted (context change voids the
key), and stale/superseded (generation guard) refreshes can never reveal the indicator.

## 10. Snapshot Identity Rules

- Snapshot = the **filtered** transaction set (`FinanceShift.filterByShiftSmart`) mapped
  through `txIdentity`, matching what the body renders.
- Baseline is scoped to the exact selected **date + shift** (`from.getTime() | to.getTime() |
  shift`). Any change to date or shift hides the indicator, discards the previous snapshot,
  and lets the next successful load establish a fresh baseline (verified by harness checks
  10/11).
- First-ever successful load establishes the baseline without showing (user decision) —
  including a manual CASH refresh performed before any successful load (e.g. collapsed
  first launch).
- Reordering transactions is not "new": the comparison is set-based on identities.
- The indicator is never persisted; a widget restart resets all fields.

## 11. Shift Selector Relocation

- The header no longer contains `shiftBtn`/`shiftDropdown`; header `actions` holds only
  collapse + close.
- `fullRebuild()` renders the selector inside `.ab-finance-shift-info` (the body) between
  the Date row and the Shift-time row, using the same `FinanceShift.getAllDefinitions()`
  options, `onShiftToggle`/`onShiftSelect` handlers, and `updateShiftButton(shift)`
  sync path. `controller.setShift()` is unchanged, so the existing refresh/state path is
  preserved.
- Because the selector lives in the body, it is hidden whenever the body is hidden
  (collapsed, or hidden widget) — verified by harness check 20.
- Positioning context moved from header `actions` to `.ab-finance-shift-select`
  (`position: relative`); dropdown opens `left: 0` under the button.

## 12. Header Interaction Layout

- Header order: `[.ab-finance-header-title] [.ab-finance-cash-indicator]
  [.ab-finance-new-indicator] [.ab-finance-header-spacer] [.ab-finance-header-actions]`
  (verifed by harness check 21).
- `.ab-finance-header-spacer` is `flex: 1 1 auto` and stretches to the header height; it
  consumes all remaining width between the indicator and the actions, giving the drag
  surface and keeping collapse/close right-aligned.
- Header `gap` (clamped) provides consistent spacing so FINANCE and CASH never touch.
- Double-click toggle: the single existing `boundHeaderDblClick` remains on the header;
  `onHeaderDblClick` ignores events whose target is inside `.ab-finance-cash-indicator`,
  `.ab-finance-new-indicator`, `.ab-finance-shift-btn`, `.ab-finance-shift-dropdown`,
  `.ab-finance-collapse-btn`, or `.ab-finance-close-btn`, then calls `toggleCollapse()`.

## 13. Listener Lifecycle

- Header double-click: exactly one listener, added in `createRoot()`, removed in
  `destroy()` (`boundHeaderDblClick`), and re-added fresh on recreation — no duplication
  across widget restarts (harness check 27: a single `dblclick` toggles exactly once after
  a `restartWidgetAndShow`).
- Shift selector listeners are re-attached per `fullRebuild()`; old nodes are discarded via
  `contentEl.innerHTML = ""` (no leak; arrow-field handlers are stable references).
- CASH click, collapse, close, drag, resize listeners unchanged.

## 14. Responsive Behavior

- Indicator is a fixed 16×16 element with `visibility: hidden` default, so it occupies no
  visual space change when toggled and never shifts the header at any width.
- Spacer is `flex: 1 1 auto` with `min-width: 0`, so it shrinks first at narrow widths,
  keeping CASH, indicator, and actions reachable.
- Existing container queries (`@container finance-widget (max-width: 340px)`) and legacy
  media queries (`@media (max-width: 320px)`) are preserved; the new elements inherit the
  responsive paddings. Harness check 28 verifies the responsive rules and spacer placement
  (jsdom cannot compute layout, so this is a structural check).

## 15. Harness Verification

New harness: `agencybooster-devtoolkit/rc-stable-005-finance-header-ui-harness.ts`
(untracked). Boots `FinanceModule` on JSDOM (chat route, persisted expanded + `shift: "day"`,
mock transactions at local hours 16:00–18:00 inside the Day window), then drives manual
refreshes, mutation/reordering of the mock response, failure injection, delayed fetch,
shift changes, collapse/expand, double-clicks, and a widget restart. All 28 required checks
plus 5 supplementary assertions pass:

```
33 checks, 0 failures
RUN_EXIT=0
```

Required-check coverage — Part A (status light): 1 no cash-dot element, 2 no
cash-dot/gold-pulse CSS, 3 CASH control intact. Part B (indicator): 4 exists in header,
5 `!` + title/aria, 6 hidden after initial load, 7 hidden on identical manual refresh,
8 shown on new tx, 9 hidden on reorder-only, 10 hidden after shift change, 11 hidden after
back-to-day + identical refresh (fresh baseline), 12 hidden on failed refresh, 13 hidden on
cancelled/superseded refresh, 14 cleared at next manual start, 15 hidden on auto refresh
with new data. Part C (shift selector): 16 none in header, 17 exactly one in body, 18 label
+ active option, 19 selection refreshes + updates label, 20 hidden when collapsed. Part D
(header): 21 child order, 22 flexible spacer, 23 dblclick empty toggles, 24 dblclick CASH
does not toggle, 25 dblclick collapse does not toggle, 26 dblclick close does not
toggle/hide, 27 single handler after restart, 28 responsive rules + spacer placement.

## 16. Regression Verification

All accepted Finance regression harnesses were rebuilt and rerun against the modified
widget (run at 15:51 local, Day shift):

| Harness | Checks | Failures | Run exit |
| --- | --- | --- | --- |
| `rc-stable-001` | 47 | 0 | 0 |
| `rc-stable-002-fix-001` | 20 | 0 | 0 |
| `rc-stable-002-fix-002` | 42 | 0 | 0 |
| `rc-stable-004-video-chat-satellite` | 22 | 0 | 0 |
| `rc-polish-004-fix` | 29 | 0 | 0 |
| `rc-stable-005` (new) | 33 | 0 | 0 |

Note on `rc-polish-004-fix`: its S1 scenario uses the widget's default shift computed from
the current clock and is known to fail when run during Morning shift (07:00–14:59 local)
because the mock transactions fall outside the shift. That flake was previously reproduced
on a clean baseline and is unrelated to this EPIC. This run was executed during Day shift,
so the harness passed 29/29.

## 17. Build Verification

| Command | Exit code | Result |
| --- | --- | --- |
| `npm run lint` | 0 | eslint `src/ extension/` clean |
| `npx tsc --noEmit` (in `agencybooster-devtoolkit/`) | 0 | typecheck clean |
| `npm run build` | 0 | `scripts/Companion.user.js` regenerated |
| `npm run build:arena` | 0 | `scripts/Companion.arena.user.js` regenerated |
| `npm run build:ext` | 0 | `extension/dist/content.js` regenerated |
| esbuild harness builds (6 harnesses) | 0 | all `.cjs` bundles built |

The gitignored `extension/dist/content.js` was verified to contain the new indicator class
(content search).

## 18. Browser Verification

Live browser verification (loading the unpacked extension from `extension/dist/`,
interacting with the Finance widget header on a GoldenBride page) was NOT executed in this
session. Browser runtime behaviour — layout of the new indicator/spacer at real widths,
dropdown rendering inside the scrollable body, real double-click/drag feel — is therefore
**UNKNOWN** and requires live confirmation before user-facing validation.

## 19. Remaining Limitations

- The body shift dropdown is absolutely positioned inside `.ab-finance-body`
  (`overflow-y: auto`); if the widget is very short, the opened dropdown could extend below
  the visible scrollport and require scrolling to reach lower options. Not exercised by the
  DOM harness (no layout).
- The controller's unviewed machinery (`unviewedTxIds`, `isTxUnviewed`, `markTxViewed`,
  `unviewedTransactions`) is now unused by the UI but intentionally left intact (user
  decision). Removing it is a separate cleanup EPIC, not part of this one.
- An automatic refresh that supersedes an in-flight manual refresh leaves any previously
  shown indicator visible (it never *adds* visibility, which is the requirement);
  only the next manual refresh clears/re-evaluates it.
- The indicator's snapshot uses the shift-filtered set; during the night "waiting" phase the
  filtered set is empty, so a manual refresh in that phase yields "no new" (hidden). This is
  consistent with what the body renders.

## 20. Unknowns

- Live browser rendering/layout of the indicator, spacer, and relocated shift selector:
  UNKNOWN (not executed this session).
- Whether a very short widget height clips the opened shift dropdown in a real browser:
  UNKNOWN (DOM harness cannot compute layout).
- Real-device double-click timing interplay with the drag gesture: UNKNOWN (jsdom does not
  model pointer sequences; harness used dispatched `dblclick` events).

## 21. Stable Release Readiness

- Implementation complete; lint, typecheck, build, arena build, and extension build all pass
  (exit 0).
- New harness: 33 checks, 0 failures, covering all 28 required checks. All Finance
  regression harnesses: 0 failures.
- Public APIs unchanged (no exported symbols renamed; `FinanceWidget` public surface
  unchanged); architecture and module boundaries preserved; Companion still never imports
  Finance internals; no new dependencies.
- Controller and Finance logic untouched per scope decisions.
- No unrelated files modified.
- Remaining gap: live browser verification (Section 18). Until performed, browser-level
  behaviour is UNKNOWN; the commit is ready for merge with live confirmation as the only
  open item.
