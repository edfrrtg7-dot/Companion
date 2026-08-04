# RC-STABLE-003-FIX-003 Implementation Report

## 1. Objective

Make snippet imports (IceBreaker and Broadcast) target the **currently active
GoldenBride profile** instead of the first `chat-sender-*` key in
`Object.keys(localStorage)` enumeration order. The active profile is resolved
at action time from the visible sidebar lady identity (`ID: 812510`), with an
explicit fallback chain, action-time revalidation (before confirmation and
again immediately before the write), tab-local resolution, and BLOCKED /
no-write behaviour whenever the active profile cannot be determined safely.
The UI, import history, and Diagnostics surface the resolved profile id, and
Diagnostics exposes a visible-vs-selected mismatch indicator. An isolated
first-message delay-0 regression in the same import code path is also fixed.

## 2. Baseline

- **Baseline Commit**: `0ac1b53a5991cef41884b72c3133d1a6a82681e3`
  (`HEAD == origin/master == 0ac1b53` verified before implementation).
  **Branch**: `master`. **Version**: 2.1.0.
- Baseline re-verified after the harness and before commit (Section 18/19).

## 3. Browser Evidence

No interactive GoldenBride session was executed for this EPIC. The following
runtime facts were captured during the preceding investigation and are reused
as VERIFIED evidence of the *original* behaviour:

- An import wrote to `chat-sender-812510` (`chat-sender-812510` before:
  exactly 1 "Hello" message; after: exactly 3 "Test IceBreaker A/B/C"
  messages).
- No later storage event modified `chat-sender-812510`; no revert and no
  overwrite was observed during the investigation window.
- All imported messages persisted with `intervalSeconds: 0`.
- After a page reload the imported messages were not visible in the UI.

New-code live-browser outcomes are classified EXPECTED / UNKNOWN (Section 20).

## 4. Repository Evidence

- `src/companion/crm-service.ts` (baseline `0ac1b53`): `findProfileKey()`
  (L65) returned the FIRST `chat-sender-*` key in `Object.keys(localStorage)`
  order — the root cause. Call sites: `companion-modal.ts:41,62,89`,
  `crm-service.ts:404`, `dashboard-service.ts:22`, and the diagnostics
  collectors.
- `readDelays.detectDelay` (baseline `0ac1b53`, L174–206): with a single
  existing message whose delay was `0` (the sentinel produced by the previous
  import), the item loop did not run and the fallback
  `typeof firstValue === "number" && firstValue >= 0` returned `0`, so the
  first-message sentinel `0` was propagated to all subsequent imported
  messages instead of `DEFAULT_DELAY` (65).
- `docs/storage/SENDER_STORAGE_MODEL.md`: canonical storage keys
  `chat-sender-<profileId>`, canonical messages schema `{ text,
  intervalSeconds }`.
- Import history type in `src/companion/dev.ts`
  (`ImportHistoryEntry { timestamp, profileKey, importedCount, result, target?,
  linesEntered?, uniqueSnippets?, previousMessageCount?, finalMessageCount?,
  duplicatesSkipped? }`), `MAX_IMPORT_HISTORY = 20`, storage key
  `STORAGE_KEYS.DIAGNOSTICS_IMPORT_HISTORY = "ab-diag-import-history"`.

## 5. Root Cause (VERIFIED)

1. **Wrong profile targeting.** `CrmService.findProfileKey()` returned the
   first `chat-sender-*` key in localStorage enumeration order, which is not
   guaranteed to be the currently open profile. Multiple call sites consumed
   this value for imports, dashboard reads, and diagnostics, so an import could
   silently write to a different lady's profile (repository evidence, Section 4).
2. **Delay regression.** `readDelays.detectDelay` propagated the
   first-message sentinel `0` as the delay for subsequent imported messages
   when the target had a single message (`>= 0` fallback). This explains the
   VERIFIED runtime fact that all imported messages persisted with
   `intervalSeconds: 0`.

Conclusion: imports must resolve the active profile at action time and use an
immutable, resolved `storageKey` for every stage; the delay sentinel must not
propagate.

## 6. Modified-File Plan

| File | Evidence | Required change | Expected side effects |
|------|----------|-----------------|-----------------------|
| `src/companion/profile-resolver.ts` | New module | Resolve active profile: `parseVisibleProfileId`, `extractProfileIdFromUrl`, `extractVisibleProfileId`, `resolveActiveProfile`, `resolveActionContext`; immutable `ProfileScopedActionContext` | Tab-local resolution; BLOCKED on ambiguity |
| `src/companion/crm-service.ts` | `findProfileKey` root cause; `readDelays` sentinel | `SnippetImportResult.profileId/storageKey`; `SnippetImportOptions.resolveProfile`; action-time resolution + revalidation; immutable key across all stages; history with `storageKey`; delay fallback `>= 0` → `> 0` | Imports target resolved profile; abort on change |
| `src/companion/companion-modal.ts` | Import action + `updateDashboard()` call | Pass `resolveProfile: () => resolveActionContext()`; refresh dashboard with the imported `storageKey` | UI flows use resolved profile |
| `src/companion/dev.ts` | `ImportHistoryEntry` type | Add optional `storageKey` field | Backward-compatible history |
| `src/companion/companion-diagnostics-collectors.ts` | Diagnostics consumers | Visible active profile / resolution source / confidence / mismatch in PROFILE; mismatch in Overall; history renderer shows `storageKey` | Diagnostics surface active profile |
| `src/companion/dashboard-service.ts`, `src/companion/dashboard.ts` | `readCRMData()`/`updateDashboard()` | Optional `storageKey` param | Dashboard refresh uses the imported key |
| `scripts/Companion.user.js`, `scripts/Companion.arena.user.js` | Regenerated build artifacts (tracked) | Regenerated by `build-finance.mjs` / `build-arena.mjs` | Artifacts reflect source changes |
| `.ai/context/rc-stable-003-fix-003-active-profile-import-implementation.md` | This report | New file | Documentation (required) |

No other files required changes. No Finance internals are imported. No new
runtime dependencies; `jsdom` is used only by the untracked harness.

## 7. Modified Files

1. `src/companion/profile-resolver.ts` (new)
2. `src/companion/crm-service.ts`
3. `src/companion/companion-modal.ts`
4. `src/companion/dev.ts`
5. `src/companion/companion-diagnostics-collectors.ts`
6. `src/companion/dashboard-service.ts`
7. `src/companion/dashboard.ts`
8. `scripts/Companion.user.js` (regenerated build artifact)
9. `scripts/Companion.arena.user.js` (regenerated build artifact)
10. `.ai/context/rc-stable-003-fix-003-active-profile-import-implementation.md` (this report)

`agencybooster-devtoolkit/rc-stable-003-fix-003-harness.ts` (+ `.cjs`) was
created for verification and remains **untracked** (not committed), consistent
with prior EPIC harnesses.

## 8. Changes Per File

### `src/companion/profile-resolver.ts` (new)
- **`parseVisibleProfileId(text)`** (pure): matches a standalone `ID: <digits>`
  line anchored by line boundaries (`(?:^|\n)\s*ID\s*:\s*(\d{1,20})\s*(?=\n|$)`).
  Rejects sentence-embedded labels (`Client ID:`, `User ID:`), non-digits, and
  empty strings.
- **`extractProfileIdFromUrl(href)`** (pure): conservative `?id=|profile=|lady=`
  numeric parameter extraction; returns `null` for unrelated params, hash
  fragments, and `client_id`.
- **`extractVisibleProfileId(doc)`**: TreeWalker text-node scan of the
  top-frame document; returns the id only when exactly one distinct id exists
  (two or more distinct ids → `null` so the caller can block). Bounded at
  2000 text nodes.
- **`resolveActiveProfile()`**: chain order — sidebar DOM (HIGH) → explicit URL
  param (MEDIUM) → single `chat-sender-*` profile in storage (LOW) → BLOCKED
  (NONE). Resolution is tab-local: every call reads the current page; no
  cached/global/last-active state is consulted or written.
- **`resolveActionContext()`**: returns the immutable
  `ProfileScopedActionContext { profileId, storageKey, source, confidence }` or
  `null` when blocked.

### `src/companion/crm-service.ts`
- **`SnippetImportResult`**: added optional `profileId` and `storageKey`.
- **`SnippetImportOptions`**: added optional
  `resolveProfile?: () => { profileId: string; storageKey: string } | null`.
- **`importSnippetsToProfile`**: resolves the profile at action time (the
  resolver is authoritative when provided; otherwise legacy
  `findProfileKey()`), builds the failure/cancelled/success result with the
  resolved `profileId`/`storageKey`, uses one immutable `key` for read → count →
  confirmation → re-read → write → verify → rollback → history, and:
  - confirmation copy is now `${targetName} profile: ${profileId}` with the
    current message count;
  - revalidates the resolver immediately before the write; abort messages:
    `"The active GoldenBride profile could no longer be determined. No data
    was changed."` and `"The active GoldenBride profile changed from ${id} to
    ${newId}. No data was changed."`; aborts never touch storage or history;
  - failure message when never resolved:
    `"Unable to determine the active GoldenBride profile. No data was changed."`;
  - success message includes `... for profile ${profileId} ...`;
  - history now records `storageKey`.
- **`readDelays.detectDelay`**: fallback changed from `firstValue >= 0` to
  `firstValue > 0`, so a single-message sentinel `0` no longer propagates and
  later messages fall back to `DEFAULT_DELAY` (65). Isolated to the import
  delay-read path (same code that drives imports); included in this EPIC.
- **`recordImportHistory`**: new signature `(profileId, storageKey, entry)`;
  `profileKey: profileId` retained for backward compatibility.

### `src/companion/companion-modal.ts`
- Import button handler now passes `resolveProfile: () => resolveActionContext()`
  and refreshes the dashboard with the imported `importResult.storageKey`.

### `src/companion/dev.ts`
- `ImportHistoryEntry` gains optional `storageKey` (backward compatible; all
  prior fields untouched).

### `src/companion/companion-diagnostics-collectors.ts`
- PROFILE section: `Visible active profile`, `Profile resolution source`
  (`GoldenBride sidebar DOM` / `URL parameter` / `Single profile fallback` /
  `Unavailable`), `Profile resolution confidence` (HIGH/MEDIUM/LOW/NONE),
  `Profile mismatch` (NO/YES/Unknown).
- RUNTIME section: mismatch is folded into `Overall` — mismatch forces
  `Attention Required`.
- IMPORT HISTORY renderer: includes `key <storageKey>` for new entries; legacy
  entries render unchanged.

### `src/companion/dashboard-service.ts`, `src/companion/dashboard.ts`
- `DashboardService.readCRMData(storageKey?)` and `renderDashboard(container,
  storageKey?)` / `updateDashboard(storageKey?)` accept an optional key; the
  polling path (no argument) keeps legacy `findProfileKey()` behaviour.

## 9. Resolution Chain

1. **Sidebar DOM (HIGH)** — the visible lady identity line `ID: <digits>` in
   the top frame; exactly one distinct id required.
2. **URL parameter (MEDIUM)** — explicit numeric `id`/`profile`/`lady` query
   param on the chat route.
3. **Single stored profile (LOW)** — exactly one `chat-sender-*` key.
4. **BLOCKED (NONE)** — otherwise; no write, no history, and
   `resolveActionContext()` returns `null`.

## 10. Ambiguity and Safety

- Two or more distinct visible ids in the page → `null` (blocked) rather than a
  guess.
- Two or more stored profiles with no DOM/URL signal → BLOCKED rather than the
  first key.
- Resolution is tab-local and re-read on every call; there is no global
  "last active" state that could leak across tabs.
- A blocked resolution never touches storage.

## 11. Revalidation Semantics

- The resolver is invoked once before confirmation and again immediately
  before the write.
- Same profile → proceed. Unresolved at write time → abort, "could no longer
  be determined". Different profile → abort, "changed from X to Y". Both aborts
  record no history and perform zero writes.

## 12. Immutable Action Context

- `ProfileScopedActionContext { profileId, storageKey, source, confidence }` is
  captured once from the resolution and reused for every stage of the import
  (read, count, confirmation, re-read, write, verify, rollback, history,
  dashboard refresh), so all stages observe the identical target key.

## 13. Import History

- Success / no-change / failed records now include `storageKey` (new optional
  field). `profileKey` (id without prefix) and `importedCount` are retained.
- Cancelled and aborted operations record nothing. Legacy entries are rendered
  unchanged.

## 14. Diagnostics

- PROFILE: visible active profile id, resolution source, resolution
  confidence, and a visible-vs-selected mismatch flag.
- Overall health becomes `Attention Required` when a mismatch is detected (in
  addition to the existing profile/UI-hook conditions).

## 15. Delay Regression Fix

- `readDelays.detectDelay` fallback `>= 0` → `> 0`. A first-message sentinel
  `0` is never a configured delay, so it no longer propagates to subsequent
  imported messages; those now use `DEFAULT_DELAY` (65). Harness P19 proves
  `[0, 65, 65]` for a single-message `intervalSeconds: 0` seed.

## 16. Storage Safety

- Unchanged from RC-STABLE-003 for the write path: one `writeProfile` on
  success, read-back verification, canonical rollback on verification failure.
  All of these operate on the resolved immutable key.

## 17. Multi-Tab Isolation

- The resolver stores no state: `resolveActiveProfile()` reads the current
  page DOM, current URL, and current storage each call. There is no shared
  mutable "last resolved profile", so each tab resolves independently at action
  time.

## 18. Runtime Harness

`agencybooster-devtoolkit/rc-stable-003-fix-003-harness.ts` — executable Node
harness (untracked). Built with `esbuild --bundle --platform=node
--format=cjs --external:jsdom`; `jsdom` is required at runtime (installed
`--no-save`; see Section 23).

Result: **42 checks, 0 failures** (exit code 0).

| Group | Coverage |
|-------|----------|
| N1–N13 | pure parsing: standalone `ID:` line, newline-anchored, Client/User ID rejected, non-digit rejected, whitespace-tolerant; URL: `?id=`/`?profile=`/`?lady=`, unrelated/hash/`client_id` rejected |
| O2–O10 | DOM extraction (sidebar id, two-distinct-ids ambiguity), full chain DOM HIGH → URL MEDIUM → single-profile LOW → BLOCKED, blocked → null context, immutable action context |
| P1–P19 | resolved import success; result carries profileId+storageKey; write lands on resolved key; other profile untouched; confirmation shows profile id; revalidation change/unresolved/never-resolved abort with messages; no writes on abort; history storageKey+profileId; legacy no-resolver fallback; delay sentinel not propagated |
| Q1–Q6 | diagnostics: matched profile fields, mismatch flag, blocked diagnostics, Overall Attention Required on mismatch / Healthy without, history renders storage key |

## 19. Build Verification

| Command | Exit Code | Output Summary |
|---------|-----------|----------------|
| `npm run lint` | 0 | `eslint src/ extension/`, no errors |
| `npm run typecheck` | 0 | `tsc --noEmit` (devtoolkit project), no errors |
| `npm run build` | 0 | `scripts/Companion.user.js` 295.5kb |
| `npm run build:arena` | 0 | `scripts/Companion.arena.user.js` 293.7kb |
| `npm run build:ext:prod` | 0 | `extension/dist/` production build complete |

Post-build bundle grep (both userscripts): `resolveProfile` present,
`sidebar-dom` present, `Unable to determine the active GoldenBride profile`
present. `extension/dist/` is gitignored and not committed.

## 20. Browser Verification

| Scenario | Classification | Notes |
|----------|----------------|-------|
| Import targets the active profile (812510 vs 978023) in a live session | UNKNOWN | Manual Test A / Test B / switch-during-confirmation were not executed in a live browser in this session; harness P VERIFIED at runtime |
| Confirmation dialog shows the resolved profile id | UNKNOWN | Not executed live; harness P6 VERIFIED |
| Diagnostics show visible/selected/mismatch on the live page | UNKNOWN | Not executed live; harness Q VERIFIED |
| Revalidation aborts when the profile is switched during the dialog | UNKNOWN | Not executed live; harness P8–P12 VERIFIED |
| Prior runtime fact (imports persisted with intervalSeconds 0) no longer reproduced | EXPECTED | Root cause fixed; harness P19 VERIFIED |

## 21. Regression Verification

All harnesses rebuilt from current source and executed:

| Harness | Result |
|---------|--------|
| `rc-stable-003-fix-003-harness` (this EPIC, 42 checks) | VERIFIED — 0 failures |
| `rc-stable-003-harness` (133 checks) | VERIFIED — 0 failures |
| `rc-stable-001-harness` (47 checks) | VERIFIED — 0 failures |
| `rc-stable-002-fix-001-harness` (20 checks) | VERIFIED — 0 failures |
| `rc-stable-002-fix-002-harness` (42 checks) | VERIFIED — 0 failures |
| `rc-polish-004-fix-harness` (29 checks) | VERIFIED — 0 failures |

## 22. Performance Impact

- Profile resolution is O(text nodes) bounded at 2000, executed only at action
  time (twice per import: before confirmation and before the write). No added
  timers or polling. The import write path is unchanged.

## 23. Remaining Limitations

1. **Interactive browser verification** not executed (Section 20); live import
   targeting on GoldenBride with 812510/978023 is UNKNOWN.
2. **Harness runtime dependency**: `jsdom` is not declared in the repo; it must
   be present in `agencybooster-devtoolkit/node_modules` to execute the harness
   (installed `--no-save` for this run, `package.json` unchanged).
3. **`agencybooster-devtoolkit/` is untracked** (local); the harness is not
   committed, consistent with prior EPIC harnesses.
4. URL fallback is intentionally conservative (explicit `id`/`profile`/`lady`
   params only); other route conventions are UNKNOWN and not guessed.
5. The delay-0 fix is included in this EPIC because it lives in the same import
   delay-read path and was an isolated, verified defect.

## 24. Unknowns

- Whether any live GoldenBride session shows a different sidebar layout that
  breaks the `ID: <digits>` extraction (DOM rule is new).
- Live-browser behaviour of the revalidation abort during an actual dialog
  (UI-level switching was not exercised live).
- Whether any callers of `importSnippetsToProfile` outside Companion pass a
  custom `resolveProfile` (public API is optional and additive).

## 25. Review Metrics

- Functions added: 5 module-level exports in `profile-resolver.ts`
  (`parseVisibleProfileId`, `extractProfileIdFromUrl`, `extractVisibleProfileId`,
  `resolveActiveProfile`, `resolveActionContext`) + 2 private module helpers
  (`listProfileKeys`); types `ProfileResolutionSource`,
  `ProfileResolutionConfidence`, `ProfileResolution`, `ProfileScopedActionContext`.
- Functions modified: `CrmService.importSnippetsToProfile`,
  `CrmService.recordImportHistory` (signature), `readDelays.detectDelay`
  (one-line fix), `DashboardService.readCRMData`, `renderDashboard`,
  `updateDashboard`; diagnostics collectors PROFILE/RUNTIME/IMPORT HISTORY
  sections; `companion-modal.ts` import handler.
- Functions removed: none.
- Exported APIs changed: `SnippetImportResult` and `SnippetImportOptions` gained
  optional fields; `recordImportHistory` is private; `ImportHistoryEntry` gained
  an optional field. All additive and backward compatible.
- Interfaces changed: none broken; additions only.
- No Finance internals imported; architecture preserved.
