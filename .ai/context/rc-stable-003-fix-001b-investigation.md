# RC-STABLE-003-FIX-001B — Collect Real Import-Resolution Evidence from a Fresh Companion Build

## 1. Objective

Replace the stale deployed Companion extension with a fresh build from the
current repository baseline and collect the diagnostic payload for the real
profile that fails with `Target collection not found in profile.`

The previous browser capture is invalid for target-layout investigation because
the deployed `extension/dist/content.js` predated commit `d1861d1` and did not
contain the diagnostic instrumentation.

No detection changes. No speculative profile layouts. No import-behavior changes
(until the payload evidence was obtained; the follow-up FIX-001 implementation
then added array-container support, see section 13).

## 2. Repository Baseline

- `git status --short --branch`: `## master...origin/master`; no tracked
  modifications (only untracked files listed).
- `HEAD` = `d1861d1d6bdadf46111414e70ecee657c7a9225e`
- `origin/master` = `d1861d1d6bdadf46111414e70ecee657c7a9225e`
- Condition `HEAD == origin/master == d1861d1` — VERIFIED.

## 3. Stale-Build Evidence (from the prior investigation)

- Commit `d1861d1` created `2026-08-03 20:26:01`.
- Previously deployed `extension/dist/content.js` built `2026-08-03 19:13:52`
  (295 683 bytes): `importTargetResolution` = 0, failure text = 2,
  `importSnippetsToProfile` = 2.
- Packaged `extension/dist.zip` also predates the diagnostic
  (`importTargetResolution` = 0, failure text = 1).
- Root cause: the deployed bundle was built before the FIX-001A instrumentation
  existed. The failure message is produced only by
  `CrmService.importSnippetsToProfile` (`crm-service.ts:410`, `crm-service.ts:437`),
  which the stale bundle contained; the diagnostic code was absent.

## 4. Correct Companion Build Entry Point

The Companion extension is built by:

- `node build-extension-dev.mjs`
- `node build-extension-prod.mjs`

Both write to `extension/dist/` (resolving the project root from
`agencybooster-devtoolkit/`).

The npm commands `npm run build`, `npm run build:ext`, `npm run build:ext:prod`
run `agencybooster-devtoolkit/build.mjs`, which bundles the **AgencyBooster
Developer Toolkit** (manifest name "AgencyBooster Developer Toolkit" 0.1.0) —
a separate product. They must not be treated as proof that Companion
`extension/dist/` is current. VERIFIED.

## 5. Fresh Artifact Verification

Build command (exact): `node build-extension-dev.mjs` (run from
`agencybooster-devtoolkit/`).

Artifact: `extension/dist/content.js`

| Property | Value |
|---|---|
| File size | 301 125 bytes |
| Last write | `2026-08-03 21:24:20` |
| SHA-256 | `6E364716BC4D9A981358EF6B3DD02C9529347CB4311AF0B26F3F6DB8072FAB6D` |
| Git commit | `d1861d1d6bdadf46111414e70ecee657c7a9225e` |
| `[RC-STABLE-003-FIX-001] importTargetResolution` | 1 |
| `Target collection not found in profile.` | 2 |
| `importSnippetsToProfile` | 2 |
| Manifest name / version | Companion / 2.1.0 |

Acceptance for the artifact: diagnostic prefix ≥ 1; failure string present;
import implementation present. VERIFIED.

Note: multiple commits share the semantic version 2.1.0; do not use the version
to identify the build. Use the SHA-256 above.

## 6. Loaded Extension Path

PENDING MANUAL COLLECTION — requires the live Chrome session:

1. Open `chrome://extensions`.
2. Locate the Companion extension (not AgencyBooster DevToolkit).
3. Confirm its loaded folder points to this repository's `extension/dist/`.
4. Click Reload.
5. Close all GoldenBride tabs; open a new GoldenBride tab.
6. Open DevTools before reproducing the import.
7. Enable Console levels Info, Warnings, Errors, Verbose (if available); clear all filters.

Status: UNKNOWN (not performed; no browser tool available in this environment).

## 7. Failing Profile Payload

CAPTURED — provided as runtime evidence in the FIX-001 EPIC for profile
`chat-sender-1373302` (IceBreaker target attempt).

Objective payload facts:

- `target`: `"icebreaker"`
- `phase`: `"initial"`
- `profileKey`: `chat-sender-1373302`
- `profileFound`: `true`, `profileRead`: `true`, `profileValid`: `true`
- `resolved`: `false`, `resolutionPath`: `null`
- Candidate `data.messages`:
  - `exists`: `true`, `containerType`: `"array"`
  - `reason`: `"array container (not a message object)"`
- `profileShape.topLevel`: `type`, `status`, `messages` (`"array"`),
  `specified`, `activeTab`, `broadcast` (`"object"`), `sended`, `delivered`,
  `ignore`, `advanced` (`"boolean"`), `chainProgress` (`"object"`), `message`.

Broadcast target payload (separate attempt on the same profile):

- Candidate `data.broadcast`: `containerType`: `"object"` — container present;
  `data.broadcast` keys observed: `type`, `status`, `message`, `messages`,
  `specified`.
- Candidate `data.broadcast.messages`: `containerType`: `"array"`, `reason`:
  `"array container (not a message object)"`.
- `resolved`: `false`, `resolutionPath`: `null`.

The verbatim payload JSON was delivered in the FIX-001 EPIC conversation; the
facts above are reproduced from that capture and are not reconstructed.

## 8. Working Profile Payload

Not separately captured as a new working comparison in the FIX-001B session.
Sufficient working evidence already exists: the canonical object layout
(`data.messages` / `data.broadcast.messages` as `Record<string, unknown>`) is
covered by the rc-stable-003 harness (groups B–K) and resolves with
`resolved:true`. VERIFIED by harness. A live working capture was not repeated;
status of a fresh live comparison: UNKNOWN.

## 9. Evidence Comparison

- VERIFIED: `profileFound`/`profileRead`/`profileValid` are all `true` — the
  profile is located, parsed, and structurally valid. The failure is therefore
  NOT caused by a missing profile, an unreadable profile, or an invalid profile.
- VERIFIED: `resolved:false` with `resolutionPath:null` — `getTargetMessages()`
  returned `undefined` for both canonical paths.
- VERIFIED: the rejected candidate at BOTH canonical paths
  (`data.messages` and `data.broadcast.messages`) is a real, populated **array**;
  the rejection reason is `"array container (not a message object)"`.
- VERIFIED: `data.broadcast` is an object; `data.broadcast.messages` is the
  array container. Broadcast path layout is `data.broadcast.messages` — the
  canonical path is correct.
- VERIFIED root cause: the canonical paths are correct; the failure is a
  **container-shape compatibility issue**, not a path-layout issue.
  `getTargetMessages()` accepted only plain non-array objects
  (`Record<string, unknown>`); real profiles store the collections as arrays.

## 10. Findings

- VERIFIED: stale deployed bundle explained the missing diagnostic; fresh build
  from `d1861d1` contains the instrumentation.
- VERIFIED: single import implementation; no bypass.
- VERIFIED: `npm run build` builds the DevToolkit, not Companion.
- VERIFIED: real failing profile stores both IceBreaker and Broadcast message
  collections as arrays; the canonical object layout is not the only real shape.
- VERIFIED: the failure is solely the array-vs-object container-shape guard in
  `getTargetMessages()`; detection paths themselves are correct.
- UNRELATED (recorded, not investigated): GoldenBride main-app console error
  `common.js?version=1.5.0:473 TypeError: Cannot read properties of undefined
  (reading 'id')`. Outside Companion; status UNKNOWN; no modification made.

## 11. Unknowns

- Which exact artifact Chrome loads and whether it points at this
  `extension/dist/`.
- Whether any other real container shapes exist beyond keyed object and array
  (e.g., sparse arrays, arrays with string-key metadata). No evidence for other
  shapes; treated as UNKNOWN and intentionally not implemented.
- Origin/impact of the unrelated `common.js` console error.

## 12. Conclusion

- The failure mode is objectively confirmed: real GoldenBride profiles persist
  IceBreaker and Broadcast message collections as **arrays**, and the previous
  object-only container guard in `CrmService.getTargetMessages()` rejected them.
- No path-layout change is required. The FIX-001 implementation must accept both
  the keyed-object and the array container shapes, preserving shape on rebuild,
  and must keep the canonical `data.messages` / `data.broadcast.messages` paths.

## 13. Follow-up Implementation (FIX-001) Status

Implemented and verified in commit `RC-STABLE-003-FIX-001: support array-based
snippet collections`:

- `MessageCollection = Record<string, unknown> | unknown[]` accepted at both
  canonical paths; object/array shape preserved on rebuild; empty collections
  supported; deterministic replacement, no-change detection, confirmation,
  verification and rollback all shape-aware (shape discriminator in the
  canonical snapshot).
- Temporary diagnostic (`logImportResolutionDiagnostic`,
  `buildImportResolutionDiagnostic`, `describeProfileShape`, both call sites)
  removed. Source and all generated bundles report
  `RC-STABLE-003-FIX-001` = 0 and `importTargetResolution` = 0.
- Harness group L removed; group M added (54 checks). rc-stable-003 harness:
  133 checks, 0 failures. Regression harnesses: 001 47, fix-001 20, fix-002 42,
  polish-004 29 — all 0 failures.
- Browser (live GoldenBride) re-verification of array imports: UNKNOWN — no live
  session performed in this environment.

## 14. Required Regression Fixtures

Implemented as harness seeds (no private message text committed): real-shape
array profiles for IceBreaker and Broadcast, empty array/object collections,
shape-change-during-confirmation profiles. No temporary profile exports
containing private message text are committed.

## Capture Instructions (manual, in Chrome)

1. Build: `node build-extension-dev.mjs` → `extension/dist/`.
2. `chrome://extensions` → Companion → confirm folder = `extension/dist/` → Reload.
3. New GoldenBride tab → DevTools → Console (Info/Warnings/Errors/Verbose, no filters).
4. Reproduce the import on a real profile; confirm the import now succeeds for
   array collections.
5. If a failure remains, copy each `[RC-STABLE-003-FIX-001] importTargetResolution`
   payload (present only in a pre-FIX-001 build) for comparison.

## Source Modification Constraint

FIX-001B itself modifies no production detection logic (tracked change: this
investigation report only). The subsequent FIX-001 implementation modifies
`src/companion/crm-service.ts` and regenerated userscripts; `extension/dist/`
is governed by existing repository policy. No temporary profile exports are
committed.
