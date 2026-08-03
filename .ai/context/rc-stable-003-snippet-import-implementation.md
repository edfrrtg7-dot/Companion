# RC-STABLE-003 Implementation Report

## 1. Objective

Replace the append-and-deduplicate snippet import in Companion with **deterministic replacement semantics**: the pasted textarea list is treated as the authoritative, ordered message collection. Importing to IceBreaker or Broadcast rebuilds the target collection from scratch with sequential IDs (`"1".."N"`), so the operator can replace, remove, and reorder messages in one paste. The operation adds a line-number gutter, an in-modal replacement warning, a count-aware confirmation gate, empty-input defence, a verified single-write storage commit with rollback on verification failure, deterministic import history (`success`/`no-change`/`failed`, and nothing on cancellation), and removes the obsolete append-only `CrmService.importSnippets()`.

## 2. Baseline

- **Repository**: `edfrrtg7-dot/Companion`
- **Baseline Commit**: `22bf930b8a33d14025f2a5f87876d908e64b6b4e` (RC-STABLE-002-FIX-002; `HEAD == origin/master` verified at start of this EPIC)
- **Branch**: `master`
- **Version**: 2.1.0 (package.json, app-version.ts, manifest.json all in sync — `version:check` exit 0)
- Baseline is unchanged at commit time (verified `HEAD == origin/master` before commit).

## 3. Browser Evidence

No interactive GoldenBride session was executed for this EPIC. The behavioural contract is established from repository evidence (Section 4) and executed at runtime through the harness (Section 18). Live-browser outcomes are classified EXPECTED (Section 20).

## 4. Repository Evidence

Files inspected at baseline:

- `src/companion/crm-service.ts` — `importSnippets()` (former L317–368) appended: `nextId = maxNumericKey + 1`, rejected texts already present in the target ("No new snippets to import (all were duplicates)."), and defaulted delay to a hardcoded `60` when no template delay existed. `importSnippetsToProfile()` (former L377–430) auto-created missing target containers (`messages = {}`), and recorded history through a **detached** `import("./dev").then(({ addImportHistory }) => ...)` (former L419–426). `readDelays()` (L141–173) already returned `{ priv, broad }` detecting `intervalSeconds | delay | interval | timeout | seconds` with `DEFAULT_DELAY = 65`.
- `src/companion/companion-modal.ts` — sole call site of the import: L118 `CrmService.importSnippetsToProfile(target, snippets)` (synchronous, `.importedCount` result). Import flow L113–125.
- `src/companion/companion-dialogs.ts` — `showConfirm()` L55–81 hardcoded "Yes"/"No"; `showImportSnippetsModal()` L92–151 with textarea `ab-import-textarea`; `ImportSnippetsResult` L84.
- `src/companion/companion-styles.ts` — `.ab-import-textarea` L460–498, `.ab-import-buttons` L401.
- `src/companion/dev.ts` — `ImportHistoryEntry` L145–150 (`timestamp`, `profileKey`, `importedCount`, `result: "success" | "partial" | "failed"`); `MAX_IMPORT_HISTORY = 20`; `addImportHistory` L172–177; imports only `storage-service`/`storage-keys` (no circular-import risk for a static import from `crm-service.ts`).
- `src/companion/companion-diagnostics-collectors.ts` — `collectImportHistory()` L593–608 rendered `timestamp | profileKey | importedCount items | result`; the section is composed under `"IMPORT HISTORY"` (L754–755, returned L769); `collectUserscriptDiagnostics()` exported at L877.
- `docs/storage/SENDER_STORAGE_MODEL.md` — canonical message schema `{ text, intervalSeconds }`; profile key pattern `chat-sender-<id>`; `^chat-sender-\d+$` validation.
- `agencybooster-devtoolkit/rc-stable-001-harness.ts` and siblings — executable harness template (esbuild bundle `--platform=node --format=cjs --external:jsdom` → `node`), with `setPlatform` + `initStorage` + runtime-environment stub setup.

Grep-confirmed facts:
- Only `companion-modal.ts:118` calls `importSnippetsToProfile`; `importSnippets` is referenced only inside `crm-service.ts` itself (former L399, L407). No callers in `extension/**/*.ts` or `agencybooster-devtoolkit/*.mjs`. `scripts/Companion*.js` matches are regenerated build artifacts. → removal of `importSnippets()` is safe.
- `LocalStorageAdapter` delegates every operation to `getPlatform().localStorage` — the harness can count `chat-sender-*` writes at the adapter boundary.

## 5. Root Cause

Append-only import cannot express the required semantics:

1. **No replacement/removal/reorder.** The operator cannot reorder messages, remove an obsolete message, or fully replace the list — importing only ever *adds* at the end.
2. **Determinism gap.** `nextId = max + 1` makes the resulting keys depend on prior state; a pasted list of the same texts is not idempotent (the second paste adds nothing or duplicates remain in order).
3. **Unverified single write.** The profile was written once with no read-back verification and no rollback, so a partial/failed write was silently accepted.
4. **Detached history.** The dynamic `import("./dev").then(...)` records history asynchronously and can be lost before completion (and is untestable deterministically).
5. **Missing safety rails.** Empty input silently produced "No valid snippets to import." with no inline error; a destructive replace of an existing collection was never confirmed; the hardcoded delay default `60` could contradict the canonical `DEFAULT_DELAY = 65`.

## 6. Modified-File Plan

| File | Evidence | Required change | Expected side effects |
|------|----------|-----------------|-----------------------|
| `src/companion/crm-service.ts` | Import semantics (Section 5); sole caller verified | Remove `importSnippets`; add pure `normalizeSnippets`; rewrite `importSnippetsToProfile` (async, `confirmReplace`, sequential rebuild, canonical no-change compare, one write + read-back verify + rollback, static `addImportHistory`); `SnippetImportResult`/`SnippetImportOptions` interfaces | Deterministic replacement; history deterministic; failure/cancellation honest |
| `src/companion/dev.ts` | `ImportHistoryEntry` shape | Extend with optional `target/linesEntered/uniqueSnippets/previousMessageCount/finalMessageCount/duplicatesSkipped`; widen `result` with `"no-change"` | Backward-compatible storage format; legacy entries still parse |
| `src/companion/companion-diagnostics-collectors.ts` | `collectImportHistory` format | Render new fields when present; keep legacy format otherwise | No breakage of old diagnostics |
| `src/companion/companion-dialogs.ts` | `showConfirm` labels; modal | Optional `confirmLabel`/`cancelLabel` (defaults preserved); gutter + warning + inline empty error; listener cleanup on close | Existing Yes/No callers unaffected |
| `src/companion/companion-styles.ts` | Import dialog CSS | `.ab-import-editor`, `.ab-import-gutter`, `.ab-import-gutter-numbers`, `.ab-import-warning`, `.ab-import-error` | Layout only |
| `src/companion/companion-modal.ts` | Call site | `await`; pass `confirmReplace` (Replace/Cancel); handle all four outcomes; `updateDashboard()` only on success; render report with `<br>` | No stale dashboard refresh |
| `scripts/Companion.user.js`, `scripts/Companion.arena.user.js` | Regenerated build artifacts (tracked; repository policy) | Regenerated by `npm run build` / `npm run build:arena` | Artifacts reflect the source changes |
| `.ai/context/rc-stable-003-snippet-import-implementation.md` | This report | New file | Documentation (required) |

No other files required changes. No Finance internals are imported. No new dependencies.

## 7. Modified Files

1. `src/companion/crm-service.ts`
2. `src/companion/dev.ts`
3. `src/companion/companion-diagnostics-collectors.ts`
4. `src/companion/companion-dialogs.ts`
5. `src/companion/companion-styles.ts`
6. `src/companion/companion-modal.ts`
7. `scripts/Companion.user.js` (regenerated build artifact)
8. `scripts/Companion.arena.user.js` (regenerated build artifact)
9. `.ai/context/rc-stable-003-snippet-import-implementation.md` (this report)

`agencybooster-devtoolkit/rc-stable-003-harness.ts` + `rc-stable-003-harness.cjs` were created for verification and remain **untracked** (not committed), consistent with prior EPIC harnesses.

## 8. Changes Per File

### `src/companion/crm-service.ts`
- **Added** static import `import { addImportHistory } from "./dev"` + `import type { ImportHistoryEntry }` (replaces the detached dynamic import; no cycle — dev.ts imports only storage-service/storage-keys).
- **Added** module-level `export interface SnippetImportResult` (L32) and `export interface SnippetImportOptions` (L46).
- **Added** `static normalizeSnippets(lines)` (L339): pure — trims, drops empty lines, keeps first occurrence (case-sensitive), counts `linesEntered`, `unique`, `duplicatesSkipped`. No storage/profile/history/UI access (verified pure by harness A5).
- **Removed** `static importSnippets()` entirely (repo-wide grep confirmed no callers).
- **Rewrote** `static async importSnippetsToProfile(target, snippets, options = {})` (L376):
  1. `normalizeSnippets` first; `unique.length === 0` → `failure` "No valid snippets entered…", no write, no history.
  2. No profile → `failure`; invalid profile → `failure`; missing target collection → `failure` (no longer auto-creates containers).
  3. Reads profile once to count current target messages (`previousMessageCount`); if `> 0` and `options.confirmReplace` provided, awaits it with a count-aware message; `false` → `cancelled`, no write, no history, collection untouched.
  4. **Re-reads the profile fresh** after confirmation to operate on latest state.
  5. Detects delay **before** replacement via `readDelays(data)` (target-specific: `priv` for IceBreaker, `broad` for Broadcast; `DEFAULT_DELAY = 65` fallback — no hardcoded `60` remains in the path).
  6. Builds replacement in memory: sequential keys `"1".."N"`, canonical `{ text, intervalSeconds }`, first message delay `0`, later messages the detected delay. No runtime/progress fields copied.
  7. Canonical no-change compare (sequential keys, text order, canonical fields, delays) → `no-change`, no write, `no-change` history.
  8. Deep-copies the original collection (rollback source); one `writeProfile`; **read-back verification** (validate + canonical equivalence vs. rebuilt); on failure → rollback restore + honest report ("restored" vs "could not be restored"), `failed` history.
  9. Success → `success` history (with full new fields) and a multi-line report message.
- **Added** private helpers: `getTargetMessages`, `replaceTargetMessages`, `buildReplacementMessages`, `canonicalSnapshot`, `messagesEquivalent`, `deepCopyCollection`, `verifyReplacement`, `rollbackTargetCollection`, `recordImportHistory` (static-import based, best-effort, never throws).

### `src/companion/dev.ts`
- `ImportHistoryEntry.result` widened to include `"no-change"`.
- Added optional RC-STABLE-003 fields (all optional for backward compatibility): `target`, `linesEntered`, `uniqueSnippets`, `previousMessageCount`, `finalMessageCount`, `duplicatesSkipped`.
- `importedCount` retained (legacy) — for `success` it equals `finalMessageCount`; `0` for `no-change`/`failed`.

### `src/companion/companion-diagnostics-collectors.ts`
- `collectImportHistory()`: entries with `target` set render the extended format (`… | IceBreaker | 3 items | success | lines 3 | unique 3 | prev 0 | final 3 | dups 0`); legacy entries render the original format unchanged.

### `src/companion/companion-dialogs.ts`
- `showConfirm(msgHtml, confirmLabel = "Yes", cancelLabel = "No")` — existing callers (stop-verification, delays) keep Yes/No; the import flow passes "Replace"/"Cancel".
- `showImportSnippetsModal()`:
  - Added replacement warning banner `ab-import-warning`.
  - Wrapped the textarea in `.ab-import-editor` with a `.ab-import-gutter` + `.ab-import-gutter-numbers` line-number column.
  - Line numbers update on `input` (empty editor shows line `1`; numbers are in the gutter, never in the textarea content) and sync on `scroll` via `translateY(-scrollTop)`.
  - Empty/whitespace-only input shows an inline error (`ab-import-error` + `ab-import-editor-error` class) and keeps the modal open.
  - Named `input`/`scroll` handlers removed on cancel/confirm before resolving (no timers).

### `src/companion/companion-styles.ts`
- Added `.ab-import-warning`, `.ab-import-error`, `.ab-import-editor` (with `:focus-within` and error state), `.ab-import-gutter`, `.ab-import-gutter-numbers`; refactored `.ab-import-textarea` to sit inside the editor (border/radius/outline moved to the editor container).

### `src/companion/companion-modal.ts`
- Call site now `await CrmService.importSnippetsToProfile(target, snippets, { confirmReplace: (m) => showConfirm(m, "Replace", "Cancel") })`.
- On `success` → `updateDashboard()` (single refresh, only when storage actually changed).
- Report rendered with `\n` → `<br>` (alert uses `innerHTML`); all four outcomes surfaced to the operator.

## 9. Replacement Semantics

The pasted list is authoritative and ordered. Every import into a target rebuilds that target's collection:

- Existing messages that are not in the paste are **removed**.
- New messages from the paste are **created**.
- The pasted order is the stored order (verified by harness B5, C10).
- Importing into one target never touches the other target's collection (harness F4).
- The field name is `previousMessageCount`; the UI report still prints "Messages replaced: N" (harness C13).

## 10. Ordering and IDs

IDs are always rebuilt as the exact sequential `"1".."N"` (harness B4, C9, F2). There are no gaps, no preserved obsolete IDs, and no dependence on prior key values. Ordering is by paste order (JSON object insertion order, which is the sequential key order; canonical comparison sorts by numeric key so insertion order is irrelevant to equivalence).

## 11. Duplicate Handling

Deduplication happens only inside the pasted list (first occurrence wins, case-sensitive; trailing duplicates are counted in `duplicatesSkipped` and skipped). The **existing collection never participates in dedup** — existing texts may be reused, removed, or reordered by the paste (harness A1–A2, C10). A duplicate across separate imports is a "change" only if the resulting collection differs (handled by the no-change compare).

## 12. Message Schema Preservation

Rebuilt messages use only the canonical `{ text, intervalSeconds }` schema (proven by `docs/storage/SENDER_STORAGE_MODEL.md`). Property names are detected from the current target collection (`detectTextProperty`, `detectDelayProperty`), defaulting to `text` / `intervalSeconds`. No runtime/progress fields are copied from any template (harness B8: `Object.keys(msg2) === ["intervalSeconds","text"]`).

## 13. Delay Preservation

The target-specific current delay is detected via `readDelays(data)` on the *latest* profile **before** replacement: `priv` for IceBreaker, `broad` for Broadcast; fallback `DEFAULT_DELAY = 65`. The first message keeps delay `0`; all later messages use the detected value (harness B6–B7, C11, F3). The old hardcoded `60` is gone from the import path.

## 14. Line-Number UI

- Gutter renders one number per textarea line (`split("\n").length`, minimum 1).
- Updates on `input`; empty editor shows line `1`.
- Syncs on `scroll` by translating the numbers column with `translateY(-scrollTop)`.
- Numbers live in the gutter element only — never inside the textarea content.
- Named `input`/`scroll` listeners are removed when the modal closes (cancel or confirm); no timers are used.
- Harness I1–I4 verify the initial line, update-on-input, scroll sync, and (I5) that the empty-input error keeps the modal open.

## 15. Confirmation Workflow

Service-orchestrated (so it works for every caller):

1. Read profile → count current target messages.
2. If count `> 0` and a `confirmReplace` callback is provided, invoke it with `"<Target> currently has N message(s). …"`.
3. `false` → `cancelled`, no storage write, no dashboard update, no history entry (harness C1–C7).
4. `true` → re-read the profile fresh, then rebuild against the latest state.
5. First-time import into an empty target skips confirmation entirely (harness B3).

## 16. Storage Safety

- The original target collection is deep-copied (immutable snapshot) before any mutation.
- The full replacement is built in memory; exactly **one** `writeProfile` is issued for success.
- Immediately after the write, the profile is read back and verified: profile validates, target collection exists, count matches, sequential keys, canonical text/delay equivalence.
- On verification failure the original collection is written back and the read-back is re-verified (count check). The report states honestly whether the rollback succeeded or manual recovery is required (rollback is never claimed as atomic when its own verification fails).
- Harness write counting: success = exactly 1 `chat-sender-*` write (B9, C15); verification-failure path = exactly 2 writes (intended + rollback) (H2); no-change and failure/cancel paths = 0 writes (D2, C4, E2, E5).
- Empty input is defended in the modal (inline error, modal stays open) **and** in the service (`failure`, no write).

## 17. Import History

- History is recorded through the **static** `addImportHistory` import (deterministic, synchronous best-effort; no detached promise that can be lost).
- `success` → full entry with `target`, `linesEntered`, `uniqueSnippets`, `previousMessageCount`, `finalMessageCount`, `duplicatesSkipped`; `importedCount = finalMessageCount`.
- `no-change` → entry with `result: "no-change"`, `importedCount: 0`.
- `failure` → entry with `result: "failed"`, `importedCount: 0`.
- `cancelled` → **nothing** is recorded.
- Backward compatibility: new fields are optional; legacy entries render the original diagnostics format (harness K3); the `result` union remains compatible with existing consumers.

## 18. Runtime Harness

`agencybooster-devtoolkit/rc-stable-003-harness.ts` — executable Node harness (untracked), following the established pattern: esbuild `--bundle --platform=node --format=cjs --external:jsdom`, then `node`. It provides a Proxy-backed `localStorage` whose stored keys are enumerable (so `Object.keys(localStorage)` drives `findProfileKey`), the same store is exposed through `setPlatform` (for `StorageService`/history), and `chat-sender-*` writes are counted at the adapter boundary. A corruption flag on `setItem` forces a write-verification failure deterministically.

Result: **79 checks, 0 failures** (exit code 0).

| Group | Coverage |
|-------|----------|
| A — normalizeSnippets (pure) | trim/drop-empty/first-occurrence dedup, case sensitivity, empty & whitespace input, no storage side effects |
| B — first-time import | success outcome, sequential keys, text order, delay 0/65, canonical schema, exactly 1 write, counters, history (target/counts/profileId/importedCount) |
| C — replacement + confirm | cancel → cancelled/no-write/no-history/unchanged; proceed → rebuild, delay 90 preserved, report labels, previousMessageCount |
| D — no-change | no-change outcome, 0 writes, history `no-change`/0 |
| E — empty input | failure, no write, no history (array and whitespace-only) |
| F — broadcast | sequential rebuild, delay 120, IB untouched, missing-broadcast failure |
| G — failure paths | no profile, invalid profile, missing collection |
| H — verify failure + rollback | failure outcome, exactly 2 writes, collection restored, history `failed`/0 |
| I — modal UI | gutter line 1, warning banner, gutter update on input, scroll sync, empty-input error keeps modal open, valid resolve, cancel |
| J — showConfirm labels | custom Replace/Cancel and default Yes/No preserved |
| K — IMPORT HISTORY rendering | extended format for new entries, legacy format unchanged |

## 19. Build Verification

All commands executed at repository root; exit codes recorded.

| Command | Exit Code | Output Summary |
|---------|-----------|----------------|
| `npm run lint` | 0 | `eslint src/ extension/`, no errors |
| `npm run typecheck` | 0 | `tsc --noEmit` (devtoolkit project), no errors |
| `npm run version:check` | 0 | "Version check OK: all artifacts report 2.1.0" |
| `npm run build` | 0 | `scripts/Companion.user.js` 288.1kb |
| `npm run build:arena` | 0 | `scripts/Companion.arena.user.js` 286.4kb |
| `npm run build:ext` | 0 | `extension/dist/content.js` 288.8kb (+529.5kb map), `background.js` 605b |

Additional compiler evidence for the root `src/companion` tree (which the `npm run typecheck` gate does not cover, since the devtoolkit tsconfig includes only `devtoolkit/src/**/*`): a dedicated `tsc --noEmit` run over `src/companion/**/*` reports **zero new errors** from this EPIC's files. The four pre-existing `crm-service.ts` diagnostics (`readDelays` indexing and `.disabled` on `HTMLElement`) and the other pre-existing tree-wide errors (`chrome`/`GM_info` ambient names, readonly-assignment in storage-migration, etc.) are baseline noise present at `22bf930` and outside this EPIC's scope.

## 20. Browser Verification

No interactive browser session was executed. Harness-level runtime verification is VERIFIED; live-browser scenarios are classified EXPECTED.

| Scenario | Classification | Notes |
|----------|----------------|-------|
| First-time paste imports ordered messages with canonical schema/delays | EXPECTED | Harness B VERIFIED at runtime |
| Replace flow: confirm (Replace/Cancel) → rebuilt ordered list, delay preserved | EXPECTED | Harness C VERIFIED |
| Cancel leaves collection untouched with no history | EXPECTED | Harness C VERIFIED |
| Re-importing the identical list is a no-change with no write | EXPECTED | Harness D VERIFIED |
| Empty paste shows inline error and blocks import | EXPECTED | Harness E + I VERIFIED |
| Gutter line numbers and scroll sync in the real overlay | EXPECTED | Harness I VERIFIED in jsdom DOM |
| IMPORT HISTORY shows extended entry; legacy entries render | EXPECTED | Harness K VERIFIED |
| Interactive browser execution on GoldenBride | UNKNOWN | Not performed in this session |

## 21. Regression Verification

All harnesses rebuilt from current source and executed:

| Harness | Result |
|---------|--------|
| `rc-stable-003-harness` (this EPIC, 79 checks) | VERIFIED — 0 failures |
| `rc-stable-001-harness` (47 checks) | VERIFIED — 0 failures |
| `rc-stable-002-fix-001-harness` (20 checks) | VERIFIED — 0 failures (FIX-001 contract intact) |
| `rc-stable-002-fix-002-harness` (42 checks) | VERIFIED — 0 failures (loading-state/expand contract intact) |
| `rc-polish-004-fix-harness` (29 checks) | VERIFIED — 0 failures **at this run time**; remains wall-clock-sensitive (see Section 23) |

Untouched subsystems: CASH refresh, Finance controller/widget/module/mapper, Change Delays UI, Reset IceBreaker, New Shift, dashboard actions, storage migration, launcher.

## 22. Performance Impact

- `normalizeSnippets` is O(n) in pasted lines (single Set); rebuild is O(n) in unique snippets.
- The import is a single synchronous `writeProfile` (no added requests, timers, or polling); the read-back verify is one extra `localStorage.getItem`/parse.
- History uses the existing bounded ring buffer (`MAX_IMPORT_HISTORY = 20`).
- `updateDashboard()` now fires **only** on a real `success` (previously on every non-zero import), so the dashboard refresh frequency is reduced for no-change/failure/cancelled paths.

## 23. Remaining Limitations

1. **Interactive browser verification** was not executed (Section 20); real-overlay layout (gutter alignment under the live stylesheet) is EXPECTED, not observed.
2. **polish-004 harness wall-clock sensitivity (pre-existing, unrelated)**: its mock transaction is fixed at local hour 15:40; when the harness runs at a time when the detected shift is `morning`/`night`, its "S1 body contains transaction data" check fails. It passes in this session because the run occurs in the `day` shift window. Not caused by this EPIC and not modified.
3. **Root `src/companion` typecheck noise is pre-existing** (Section 19): the repo's `typecheck` gate does not cover the root tree; a scoped check confirms this EPIC adds no new errors, but the baseline errors remain unaddressed (outside scope).
4. **Confirmation is skipped when no `confirmReplace` callback is provided** by the caller; the shipped companion-modal caller always provides it, so the destructive-replace guard is active in production.

## 24. Unknowns

- **Real-browser rendering of the gutter** (font metrics, scrollbar widths, zoom) was not exercised; the implementation uses shared `line-height`/`font-size` so the `translateY(-scrollTop)` sync is expected to align, but this is not verified on GoldenBride.
- **Chrome Extension vs userscript storage timing** for the history entry: the static `addImportHistory` writes synchronously through the adapter; whether any browser storage-throttling ever swallows the write is not observable in the harness.
- **GoldenBride profile variation**: all tested profiles follow the canonical `{ text, intervalSeconds }` schema; a profile using an undocumented delay/text property name is handled via the existing detection helpers but was not observed live.

## Review Metrics

- Functions added: 1 public static (`CrmService.normalizeSnippets`), 9 private statics (`getTargetMessages`, `replaceTargetMessages`, `buildReplacementMessages`, `canonicalSnapshot`, `messagesEquivalent`, `deepCopyCollection`, `verifyReplacement`, `rollbackTargetCollection`, `recordImportHistory`).
- Functions modified: 2 (`CrmService.importSnippetsToProfile` rewritten; `showConfirm` gained optional labels).
- Functions removed: 1 (`CrmService.importSnippets`).
- Exported APIs changed: `CrmService.importSnippetsToProfile` signature changed (async, `options.confirmReplace`), `SnippetImportResult`/`SnippetImportOptions` added; `ImportHistoryEntry` extended (optional fields + `"no-change"` result) — all backward-compatible for existing consumers except the (verified) single call site which was updated.
- Interfaces changed: `SnippetImportResult` (new), `SnippetImportOptions` (new), `ImportHistoryEntry` (extended, optional additions).
- No Finance internals imported; architecture preserved.
