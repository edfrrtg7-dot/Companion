# Implementation Report — RC-HOTFIX-002 Recover Off-Screen Companion Windows

## 1. Objective

Restore the Finance widget (and any `CompanionWindow` subclass) when a persisted position places it off-screen (for example, a header saved above the viewport). The widget must recover automatically at startup/restore and on viewport changes so the header and its controls (collapse/close) stay reachable, valid positions must be preserved unchanged, and corrected state must be persisted.

Required commit message (exact): `RC-HOTFIX-002: recover off-screen Companion windows`.

## 2. Runtime Evidence

`VERIFIED` — Node runtime harness against the real bundled production source (esbuild bundle of `src/companion/companion-window.ts` + `src/companion/finance-widget.ts`): **68/68 checks passed** across 19 scenarios. Full harness output captured in the verification section below. Harness files: `rc-hotfix-002-entry.ts`, `rc-hotfix-002-bundle.cjs`, `rc-hotfix-002-runtime-test.cjs` (temp, not committed).

## 3. Repository Evidence

`VERIFIED` — Baseline `HEAD == origin/master == 0660ae2ecbdfb7af26fd78d8eb47317e5609cf01` (RC-FINAL-FIX-001). At commit time, `git status --short` shows exactly one tracked modification: `src/companion/companion-window.ts`. The regenerated build artifacts `scripts/Companion.user.js` and `scripts/Companion.arena.user.js` were restored with `git restore` after the builds.

Source evidence collected during investigation:
- `src/companion/finance-widget.ts:306-307` — `createRoot()` applies `saved.x`/`saved.y` directly to `root.style.left`/`top` with **no clamping** at restore time.
- `src/companion/companion-window.ts` (pre-change) — drag handler clamps only during an active pointer drag (`onDragPointerMove`, `maxX = window.innerWidth - 44`); the clamp never repaired persisted startup state, and no `resize` listener existed. There was no position normalization at constructor, `show()`, `collapse()`, or `expand()`.
- `src/companion/storage-keys.ts` — `COMPANION_WINDOW_STATE = "ab-companion-window-state"` (unused by FinanceWidget), `FINANCE_WIDGET_STATE = "ab-finance-widget-state"` (used by FinanceWidget).
- `src/companion/finance-widget.css.ts:6` — the widget root is `position: fixed`, so `style.left`/`top` are viewport-relative; a persisted position outside the viewport is unreachable and cannot be scrolled to.

## 4. Root Cause

The persisted `x`/`y` (loaded in the `CompanionWindow` constructor) were applied verbatim to the fixed-position root. The only safeguard — the drag clamp — runs exclusively during an active pointer gesture, so a widget restored at, e.g., `x = -150` or `y` above the viewport could never be grabbed. Because the drag clamp does not repair startup state, the invalid position was also re-persisted unchanged, making the widget permanently unreachable. A viewport shrink (window resize) could likewise strand a previously valid widget.

## 5. Plan

Modify only `src/companion/companion-window.ts` — the single shared owner of window geometry, layout state, and persistence:

1. Add a private `boundOnWindowResize` field and a `window` `resize` listener installed in `initWindow()` and removed in `destroy()` (idempotent, single listener, no polling/timers).
2. Add `normalizePosition()` — clamps `this.win.x`/`y` against the current viewport using the effective widget size (collapsed constants or expanded `win.width`/`height`); returns whether a correction was made.
3. Add `applyPosition()` — writes the corrected `win.x`/`y` back to `root.style.left`/`top`.
4. Add `recoverPosition()` — normalizes; when changed, re-applies to the DOM and persists the corrected state.
5. Call `recoverPosition()` at the minimal lifecycle points: constructor (restore), `show()`, `collapse()`, `expand()`, and the `resize` listener. No Finance-specific code changes required — the base constructor normalizes before `FinanceWidget.createRoot()` reads `this.win`, so the widget's own geometry application receives already-corrected values.

## 6. Modified Files

| Path | Reason | Responsibility |
|------|--------|----------------|
| `src/companion/companion-window.ts` | Sole owner of window geometry, layout, and persistence for the Finance widget. The correction belongs in the shared base class; `finance-widget.ts` required no change because it reads `this.win` after the base constructor normalizes. | Adds viewport-based position normalization and a cleaned-up `resize` listener. |

No other tracked files were created, deleted, or modified. Repository state verified with `git status` — only `src/companion/companion-window.ts` is tracked-modified at commit time.

## 7. Changes Per File

### `src/companion/companion-window.ts` (+49 lines)
- Field: `private boundOnWindowResize: (() => void) | null = null;` — tracks the single resize listener.
- Constructor: `this.recoverPosition();` after loading persisted state — normalizes before any subclass DOM creation; corrects and persists off-screen startup state.
- `initWindow()`: registers `this.onWindowResize` on `window` for `resize` alongside the other window listeners.
- `destroy()`: `this.removeWindowResizeListener();` — the new listener is always paired with removal (no leak).
- `show()`: `this.recoverPosition();` after revealing — recovers when the viewport changed while hidden.
- `collapse()`: `this.recoverPosition();` before persisting — pulls the widget into viewport with collapsed dimensions.
- `expand()`: `this.recoverPosition();` before persisting — re-clamps with the larger expanded dimensions.
- New private methods: `normalizePosition()`, `applyPosition()`, `recoverPosition()`, `onWindowResize`, `removeWindowResizeListener()`.

## 8. Normalization Policy

Deterministic, applied only at lifecycle points (never during drag/resize gestures):

- Effective size = collapsed constants (`COLLAPSED_WIDTH = 330`, `COLLAPSED_HEIGHT = 44`) when collapsed, otherwise `win.width`/`win.height`.
- `maxX = max(0, innerWidth - width)`, `maxY = max(0, innerHeight - height)`.
- `x = clamp(x, 0, maxX)`, `y = clamp(y, 0, maxY)`.
- When the widget fits, the full widget (and therefore the full header with close/collapse controls) stays in viewport. When the widget is larger than the viewport, `maxX`/`maxY` collapse to `0`, keeping the header (priority: header → controls → content) reachable at the top-left.
- Only changed positions are re-applied and persisted — a valid position causes zero writes. This is consistent with the drag clamp's stated intent ("header and close button remain reachable") while being stricter than the drag clamp (which permits a partially off-screen right edge); any position the drag clamp allows is either already valid or corrected at the next lifecycle event.

## 9. Verification

| Item | Result | Evidence |
|------|--------|----------|
| TypeScript compilation | **VERIFIED** | `npm run typecheck` exit 0 |
| Lint | **VERIFIED** | `npm run lint` exit 0 |
| Userscript build (`npm run build`) | **VERIFIED** | exit 0, 278.5kb, no warnings |
| Extension dev build (`npm run build:ext`) | **VERIFIED** | exit 0, content.js 279.2kb |
| Arena build (`npm run build:arena`) | **VERIFIED** | exit 0, 277.3kb |
| Runtime behaviour (19 scenarios) | **VERIFIED** | Node harness on real bundled source, 68/68 checks (below) |
| Build artifacts restored | **VERIFIED** | `git restore scripts/Companion.user.js scripts/Companion.arena.user.js`; `git status` clean except `companion-window.ts` |
| No timers/polling introduced | **VERIFIED** | harness asserts zero `setInterval`/`setTimeout` creations |

## 10. Runtime Assertions (harness, 68 checks, 19 scenarios)

- **S1** negative `x` → clamped to `0`, valid `y` preserved, corrected state persisted, exactly one corrective write. **(4 checks)**
- **S2** negative `y` → clamped to `0`, valid `x` preserved, persisted. **(3 checks)**
- **S3** `y = -1` (single-pixel off-screen) → normalized to `0`. **(1 check)**
- **S4** `x` far beyond right edge → clamped to `innerWidth - width` (right edge exactly at viewport). **(3 checks)**
- **S5** `y` far beyond bottom → clamped to `innerHeight - height`. **(2 checks)**
- **S6** valid position → x/y unchanged, **zero** writes on valid startup, exactly one resize listener. **(4 checks)**
- **S7** collapsed startup off-screen → clamped with collapsed dims (330x44), persisted, header top-left reachable. **(5 checks)**
- **S8** narrow viewport (200x150, widget 360x380) → `(0,0)`, header reachable, persisted. **(4 checks)**
- **S9** oversized widget (height 1000 > viewport 720) → `y = 0` (header prioritized at top). **(2 checks)**
- **S10** resize shrink 1280x720→800x600 while visible → clamped to `(440, 220)`, persisted. **(4 checks)**
- **S11** hidden widget + resize shrink to 500x400 → normalized to `(140, 20)` while hidden; `show()` keeps the normalized position and un-hides. **(4 checks)**
- **S12** drag clamp regression (drag to `(1236, 624)`, drag limits intact, position persisted, listeners cleaned) then collapse → `x=950`; expand → `x=920` (recovery chain). **(7 checks)**
- **S13** right-edge valid position `(920, 340)` stable through collapse/expand — no jumping. **(4 checks)**
- **S14** `destroy()` removes the resize and keyboard listeners and detaches the root. **(4 checks)**
- **S15** 50 consecutive `resize` events on a valid position → zero writes, exactly one listener. **(2 checks)**
- **S16** FinanceWidget (real class) expanded off-screen `(-9999, -9999)` → normalized to `(0, 0)`, persisted, root in DOM. **(4 checks)**
- **S17** FinanceWidget collapsed off-screen → normalized with 330x44, collapsed class applied, persisted. **(4 checks)**
- **S18** FinanceWidget hidden-at-startup (RC-005) — `display:none`, no keyboard listener while hidden; `show()`/`hide()` persist `hidden` correctly and toggle the keyboard listener. **(5 checks)**
- **S19** zero timers created by the widget lifecycle. **(2 checks)**

## 11. Manual Browser Verification

**UNKNOWN** — no live browser session was executed in this environment. On a live GoldenBride page, the expected behaviour is: a widget restored with a header above the viewport or beyond a screen edge appears with its header reachable; window-resize shrink pulls the widget back in; valid positions do not jump. This is implied by the verified Node harness + source but not directly observed.

## 12. Regression Results

Covered by the harness and builds:
- Drag clamping, drag persistence, and drag-listener cleanup: **VERIFIED** (S12).
- Collapse/expand geometry + persistence: **VERIFIED** (S12, S13).
- Hide/show and hidden-state persistence: **VERIFIED** (S11, S18).
- RC-005 hidden-at-startup visibility: **VERIFIED** (S18).
- No keyboard-listener leak: **VERIFIED** (S14).
- No timers/polling: **VERIFIED** (S19).
- All three production bundles compile and build: **VERIFIED**.

## 13. Performance Impact

`VERIFIED` — negligible. Normalization is O(1), runs only at lifecycle events (construct, show, collapse, expand, resize) and never during pointer gestures; it is a no-op (no DOM write, no storage write) whenever the position is already valid. One `resize` listener per window, removed on `destroy()`. No timers or polling added.

## 14. Remaining Limitations

- The drag clamp still permits a partially off-screen right edge during an active drag (pre-existing behavior, out of scope); such a position is corrected at the next lifecycle event. Dragging never normalizes mid-gesture.
- When the widget is wider or taller than the viewport, only the header region can be kept reachable (left/top-aligned at `(0,0)`); the far edge and resize handle may fall outside the viewport. This is the documented priority order (header → controls → content) for a pathological viewport smaller than the widget.
- `persistState()` in `show()`/`hide()`/`collapse()`/`expand()` may issue a second idempotent write immediately after `recoverPosition()` when a correction also occurred; the state written is identical and this is limited to correction moments.

## 15. Unknowns

- Live-browser end-to-end recovery on goldenbride.net is **UNKNOWN** (no browser runtime executed); classified **EXPECTED** from the verified Node harness and source.
- Multi-monitor negative-coordinate layouts (e.g., a persisted position on a secondary monitor to the left of the primary) cannot be distinguished from an off-screen position; normalization will pull such windows onto the primary viewport. Whether this is desired on the target CRM is **UNKNOWN**; no multi-monitor support is implemented (out of scope).

## 16. Demonstration Readiness

**VERIFIED** at build level: typecheck, lint, and all three production bundles pass. The off-screen-recovery path is exercised by the runtime harness against the real bundled source (68/68). A live demonstration should verify: restore with the widget stranded above the viewport → header reappears reachable; shrink the browser window → widget is pulled back in; valid positions remain unmoved. Those live steps are classified **EXPECTED**/**UNKNOWN** until executed in a browser.
