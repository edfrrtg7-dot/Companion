# RC-STABLE-003-FIX-001 — Target Collection Detection Investigation

## Objective

Fix IceBreaker/Broadcast target message-collection detection so real existing
profiles import instead of failing with "Target collection not found in profile."
Binding protocol: do not assume alternative layouts; collect objective runtime
evidence from a real failing profile first, and only then modify detection logic
for layouts confirmed by evidence.

## State

- Baseline: commit `04809f431484f6e7ae99dc56f92363dedcd0c5d3` (RC-STABLE-003).
- No detection-logic changes have been made yet. Only a temporary diagnostic has
  been added (see below).

## Evidence

### 1. Failure is produced by a single code path

`CrmService.getTargetMessages()` (`src/companion/crm-service.ts`) resolves only
canonical layouts and returns `undefined` otherwise. The only places that render
"Target collection not found in profile." are the two call sites in
`importSnippetsToProfile`:

- initial read: `crm-service.ts` ~L408-411
- post-confirmation re-read: `crm-service.ts` ~L434-437

### 2. Canonical layouts (repo evidence)

- `docs/storage/SENDER_STORAGE_MODEL.md`: IceBreaker messages at
  `data.messages`; Broadcast messages at `data.broadcast.messages`.
- `AgencyBooster.user.js` (restored original userscript): writes only
  `data.messages` and `data.broadcast.messages` (L332, L1322, L1329).
- `git log --all -S` across the full history, all of `src/companion`, all
  harnesses: no other message-collection path ever produced.
- Storage key regex: `^chat-sender-\d+$`.

### 3. No real exported profile exists in the repo

- `dashboard_result.txt` is empty.
- No `chat-sender-*` JSON export anywhere in the repository.

### 4. Runtime evidence (harness)

A temporary diagnostic was added (see below) and the 003 harness extended with
group L (28 checks). Observed for synthetic profiles:

- Working IceBreaker profile -> `resolved:true`, `resolutionPath:"data.messages"`.
- Working Broadcast profile -> `resolved:true`, `resolutionPath:"data.broadcast.messages"`.
- Missing `data.messages` -> `resolved:false`, candidate reason `missing`.
- Missing `data.broadcast` -> `resolved:false`, candidate reason `missing`.
- `data.messages` as array -> `resolved:false`, candidate reason
  `array container (not a message object)`.
- Invalid profile `{bogus:true}` -> `profileValid:false`.

All 118 harness checks green. Automated suites green (70). Build gates green.
`format:check` fails on a pre-existing project-wide formatting divergence (41
files including untouched ones); not caused by this work and not to be fixed
per project policy.

## Temporary diagnostic (to be removed)

Added at `src/companion/crm-service.ts`:

- `logImportResolutionDiagnostic(target, key, initial, phase)` after the
  initial profile read (`phase: "initial"`, emitted on every import attempt),
  and again with the fresh `data` at the post-confirmation re-read failure site
  (`phase: "post-confirmation"`).
- Unconditional `console.log` (NOT dev-mode gated), prefixed
  `[RC-STABLE-003-FIX-001] importTargetResolution`, JSON payload:
  - `target`, `phase` (`initial` | `post-confirmation`), `profileKey`
  - `profileFound` (key located), `profileRead` (key read and parsed),
    `profileValid`
  - `candidates`: for each canonical path — `exists`, `containerType`, `reason`
    (accepted / missing / null container / array container / wrong type)
  - `resolved`, `resolutionPath`
  - `profileShape`: top-level key types, `messages` and `broadcast` shapes
    (key count, sample keys, first-item field types), broadcast keys.
- Helpers: `buildImportResolutionDiagnostic`, `describeProfileShape`.
- Logging only; never changes behaviour (wrapped in try/catch). REMOVE once the
  structural difference has been identified.

Harness group L: `agencybooster-devtoolkit/rc-stable-003-harness.ts` (39 checks,
L1-L39), intercepts the diagnostic via a `console.log` proxy and asserts target,
phase, candidates, resolution path, and profile shape for working + failing
profiles.

## Findings

1. Deterministic resolution is implemented and harness-verified for canonical
   layouts only.
2. "Target collection not found in profile." can only be produced by
   `getTargetMessages` returning `undefined` at the two call sites.
3. No repo evidence exists for any alternative layout.
4. No real failing profile exists in the repo; therefore the actual structural
   difference behind a real-world failure is UNKNOWN.

## Unknowns

- What structural difference (if any) a real failing profile has compared with a
  working canonical profile. No real profile has been observed.

## Conclusions

- Detection logic must NOT be broadened without runtime evidence of a real
  failing profile (binding protocol).
- The temporary diagnostic is the mechanism to collect that evidence in a live
  GoldenBride session.

## Recommended actions / reproduction steps (collect the real failing profile)

1. Build and load `extension/dist/` as an unpacked extension in
   `chrome://extensions` (`npm run build` in `agencybooster-devtoolkit`).
2. Open a GoldenBride IceBreaker chat page in which the user has a real saved
   profile (the one that fails).
3. Open the Companion import modal and attempt an IceBreaker (and separately a
   Broadcast) snippet import; reproduce the failure.
4. Capture the browser console entries with prefix
   `[RC-STABLE-003-FIX-001] importTargetResolution`. There will be one per
   import attempt (and an extra one on the post-confirmation re-read failure).
5. Also capture the diagnostic from a profile that imports successfully for
   comparison.
6. Paste both JSON payloads (failing + working) into this report or into the
   conversation. That is the objective evidence the detection change requires.
7. Optionally export the failing profile JSON (storage key `chat-sender-<id>`)
   and place it in the repo as a regression fixture.

## Verification summary

- Harness rc-stable-003: 118 checks, 0 failures (79 prior + 39 group L).
- Regression harnesses: rc-stable-001 47, rc-stable-002-fix-001 20,
  rc-stable-002-fix-002 42, rc-polish-004-fix 29 — all 0 failures.
- `npm run lint`, `npm run typecheck`, `npm run build`,
  `npm run build:ext:prod`, `npm test` (70 checks) — all green.
- `format:check` — FAILS on pre-existing project-wide divergence (41 files,
  incl. files untouched by this work). Not a regression from this change.
- Browser (live GoldenBride) — UNKNOWN: no live session performed yet.
