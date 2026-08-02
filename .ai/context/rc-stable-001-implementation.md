# RC-STABLE-001 Implementation Report

## Analysis

This EPIC stabilizes the Finance widget for a release candidate: (1) add explicit mapper support for the Finance operation `EmailSendSatellite`, (2) preserve strict rejection of genuinely unsupported operation values, and (3) fix the Finance half-collapsed startup state after reload so persisted collapse/expand restores deterministically.

Baseline commit: `7812cf154c61acad73c1ee09d869a63e8695a63d` (RC-POLISH-004-FIX).

### EmailSendSatellite evidence status

The task states the operation is supported "based on verified runtime evidence from the DevToolkit bundle." This report could not confirm that claim from the workspace:

- Exhaustive search (`EmailSendSatellite` across all tracked/untracked files excluding `node_modules`, git history via `git log -S`, and all zipped bundles) produced **no matches**. The current DevToolkit bundle (`rc-polish-004-fix-harness.cjs`), both committed userscripts, and `extension/dist/content.js` contain only the six pre-existing operations.
- The reference capture `docs/storage/finance-response.json` does not contain `EmailSendSatellite`.

Per the handbook, the claimed runtime evidence is therefore classified **UNKNOWN/UNSUPPORTED** in this workspace. The implementation was still performed because the task explicitly requires it; the acceptance behavior (mapper accepts the value, rejects everything else) is verified by runtime harness below. The real-API emission of `EmailSendSatellite` remains **UNKNOWN**.

### Half-collapsed startup root cause

Two independent defects caused a persisted-collapsed widget to restore "half-open":

1. **CSS `min-height`/`min-width` not overridden at creation.** `.ab-finance` CSS declares `min-height: 200px; min-width: 320px`. `CompanionWindow.collapse()` sets inline `min-height: 44px` + `min-width` to override it, but `FinanceWidget.createRoot()` (the path used on reload) only set inline `height: 44px`/`width` — so the restored collapsed bar resolved to `min-height: 200px` instead of a 44px header-only bar.
2. **Dead collapsed CSS selector.** The collapsed layout CSS targeted `.ab-finance.collapsed` (bare class) while `createRoot()` adds `${classPrefix}-collapsed` (`ab-finance-collapsed`). The collapsed header/resize styling never applied. The RC-POLISH-004-FIX harness documented this as evidence (`S1 has PREFIXED collapsed class only`), but the mismatch was never resolved.

## Plan

1. Add `EmailSendSatellite` to the `Operation` enum in `src/companion/finance-mapper.ts`. `VALID_OPERATIONS` is derived from `Object.values(Operation)`, so strict rejection of unknown values is preserved automatically.
2. In `FinanceWidget.createRoot()` collapsed branch, also set inline `min-height: 44px` and `min-width` = saved width, mirroring `CompanionWindow.collapse()`, so persisted collapsed state restores as a header-only 44px bar.
3. Fix the collapsed CSS selectors from `.ab-finance.collapsed` to `.ab-finance-collapsed` so the collapsed header/resize styling actually applies.
4. Update `docs/storage/finance-schema.md` to document `EmailSendSatellite` and the strict-rejection rule, keeping the "not observed in reference capture" distinction.
5. Regenerate committed userscripts (`scripts/Companion.user.js`, `scripts/Companion.arena.user.js`) via the standard build scripts.
6. Verify: typecheck, lint, version-check, userscript + extension builds, runtime harness.
7. Write this report; commit and push to `origin/master`.

## Modified Files

| Path | Reason | Summary of Changes |
|------|--------|-------------------|
| `src/companion/finance-mapper.ts` | Requirement 1 | Added `EmailSendSatellite = "EmailSendSatellite"` to `Operation`; updated enum doc comment. Strict rejection unchanged (`VALID_OPERATIONS` derives from enum). |
| `src/companion/finance-widget.ts` | Requirement 3 | `createRoot()` collapsed branch now sets inline `min-height: 44px` and `min-width: saved.width px`, overriding the CSS 200px/320px minimums so persisted collapsed restores as header-only. |
| `src/companion/finance-widget.css.ts` | Requirement 3 | Collapsed selectors corrected from `.ab-finance.collapsed` → `.ab-finance-collapsed` so the collapsed header/resize styling matches the class added at runtime. |
| `docs/storage/finance-schema.md` | Documentation | `operation` section renamed "Observed values" → "Supported values" with `EmailSendSatellite` entry (noted as mapper-accepted, not observed in reference capture) plus explicit unknown-value rejection note; operation summary table row added. |
| `scripts/Companion.user.js` | Build artifact | Regenerated — `Operation` enum now includes `EmailSendSatellite`. |
| `scripts/Companion.arena.user.js` | Build artifact | Regenerated — `Operation` enum now includes `EmailSendSatellite`. |

## Engineering Rationale

- **Enum-only change:** `EmailSendSatellite` is a string-enum member; `parseOperation` validates against `VALID_OPERATIONS`, so adding one member extends acceptance while the throw-on-unknown path (`FinanceMapperValidationError`) is untouched. No mapper signature changes.
- **`createRoot()` mirrors `collapse()`:** the inline minimums are applied at creation exactly where the collapsed geometry is established, guaranteeing the reload path and the interactive collapse path produce identical 44px header-only bars.
- **CSS selector alignment:** the runtime class is `ab-finance-collapsed`; aligning the stylesheet selector removes the dead rule without changing DOM structure or class-naming conventions elsewhere.

## Verification

| Command | Exit Code | Notes |
|---------|-----------|-------|
| `npm run typecheck` | 0 | Pass |
| `npm run lint` | 0 | Pass |
| `npm run version:check` | 0 | Pass — all artifacts report 2.1.0 |
| `npm run build` | 0 | Pass (version-check + finance userscript rebuild) |
| `npm run build:arena` | 0 | Pass |
| `npm run build:ext` | 0 | Pass |

**Runtime harness** (`agencybooster-devtoolkit/rc-stable-001-harness.ts` → bundled `.cjs`): **47 checks, 0 failures**.

1. Mapper: `EmailSendSatellite` accepted (M1); `TextChatSatellite` still accepted (M2); unknown `"BogusOp"` rejected with `FinanceMapperValidationError` (M3); non-string operation rejected (M4).
2. S1 first install: widget created, collapsed (`ab-finance-collapsed`), height 44px, **min-height 44px override present**, body hidden, no startup fetch; first expand → exactly one refresh, height restored to 380px default, min-height cleared, body populated.
3. S2 expanded reload: restored fully expanded (440px height, 400px width preserved), exactly one auto-refresh, body populated (not idle placeholder).
4. S3 collapsed reload: restored header-only (44px, min-height 44px, body hidden), no fetch; expand → exactly one refresh, 440px/400px restored.
5. S4 invalid persisted state: corrupted JSON and structurally invalid object both normalized to collapsed default (360px width / 44px bar), no fetch.
6. S5 hidden restore: stays hidden (`display: none`), no fetch.
7. S6 launcher restart: exactly one widget (no stale DOM), visible, 440px/400px restored, refresh count 2 (restore + restart), body populated.

## Remaining Limitations

- The "verified runtime evidence from the DevToolkit bundle" claim for `EmailSendSatellite` could not be reproduced from this workspace; only the mapper's accept/reject behavior is verified. Live API emission remains unverified.
- Browser/live verification was not executed in this environment → classified **UNKNOWN**. Expected behavior: on Golden Bride reload, a previously collapsed Finance widget shows a 44px header-only bar; an expanded one restores full size with one refresh; a transaction with `EmailSendSatellite` maps without error.
- `agencybooster-devtoolkit/` is untracked (pre-existing condition); the harness lives there and is not committed.

## Unknowns

- Whether the live Finance API emits `EmailSendSatellite` — **UNKNOWN** (not in capture, not in any bundle in this workspace).
- Long-term behavior if the API introduces operation values beyond the enum — rejected by design (strict), per requirement.

## Conclusion

All three requirements are implemented: `EmailSendSatellite` is accepted by the mapper with strict rejection preserved for anything else; the half-collapsed startup state is fixed at the root cause (missing inline minimums + dead CSS selector); and all six restore rules (first-install collapsed, collapsed → header-only, expanded → fully expanded, expanded → one correctly ordered refresh, invalid state normalized, geometry/dimensions preserved) are verified by the 47-assertion runtime harness. All build/lint/typecheck gates pass.
