# RC-STABLE-004 — Support `VideoChatSatellite` finance operation

## 1. Objective

Add `VideoChatSatellite` to the Finance operation schema so `FinanceMapper` accepts the
verified live server operation that previously caused the widget to render an error
(`Validation failed for 'list[2]': Validation failed for 'operation': unknown operation
type`). Update the schema documentation, add harness coverage for the live capture, rebuild
tracked artifacts, and commit with evidence. Scope: **operation-schema support only** — no
other Finance logic, resolver, or unrelated files are modified.

## 2. Baseline

- Git HEAD at start: `f6bb848717a6490ca5ff41337c24334fca2e2440` (commit
  `RC-STABLE-003-FIX-003-FIX-001: scope profile detection to the lady sidebar`), equal to
  `origin/master` (VERIFIED via `git rev-parse HEAD` before work).
- Working tree was clean of tracked modifications at start (temporary resolver-trace
  diagnostics from the earlier FIX-001 live investigation had been reverted per user
  decision; verified `git status` showed only untracked files).
- `Operation` enum at `src/companion/finance-mapper.ts:45-53` contained 7 values:
  `EmailSend`, `EmailRead`, `TextChat`, `VideoChat`, `TextChatBonusCoins`,
  `TextChatSatellite`, `EmailSendSatellite`. `VALID_OPERATIONS` is derived via
  `Object.values(Operation)` at line 56, so adding an enum member updates validation
  automatically.

## 3. Runtime Evidence

VERIFIED live server response for profile `902409` (user-provided; the transaction that
broke the widget):

```
{ "date": 1785900097000, "ladyID": 902409, "name": "Madalina", "sum": 0.9,
  "isFinish": true, "userID": 831937, "operation": "VideoChatSatellite" }
```

The same response `success: true` contained additional operations: `TextChatSatellite`,
`TextChat`, `EmailRead`, and `VideoChat` — all already supported.

## 4. Root Cause

VERIFIED: the client schema was stale. The `Operation` enum lacked `VideoChatSatellite`,
so `parseOperation` (finance-mapper.ts:258) threw `FinanceMapperValidationError` for this
live value; the error was wrapped by `parseList` (:205-223) and surfaced via
`FinanceController.refresh()` catch → `FinanceWidget.renderError` (report prefix
`WidgetError:`). The server was returning a valid operation the client simply did not know.

## 5. Modified-File Plan

| File | Reason |
| --- | --- |
| `src/companion/finance-mapper.ts` | Add `VideoChatSatellite` to the `Operation` enum (the only production change required). |
| `docs/storage/finance-schema.md` | Document the new supported value, its `isFinish` presence, and its `sum` handling. |
| `scripts/Companion.user.js` | Tracked build artifact; regenerated from changed source. |
| `scripts/Companion.arena.user.js` | Tracked build artifact; regenerated from changed source. |
| `.ai/context/rc-stable-004-video-chat-satellite-implementation.md` | This report. |

Not modified: `finance-controller`, `finance-widget`, `finance-api-client`, `finance-shift`,
resolver, and every other file in the repository.

## 6. Modified Files

1. `src/companion/finance-mapper.ts` (modified)
2. `docs/storage/finance-schema.md` (modified)
3. `scripts/Companion.user.js` (regenerated artifact)
4. `scripts/Companion.arena.user.js` (regenerated artifact)
5. `.ai/context/rc-stable-004-video-chat-satellite-implementation.md` (created, this report)

`agencybooster-devtoolkit/` contains the untracked harness; it is NOT part of the commit.
`extension/dist/` is gitignored; the extension build is verified separately (Section 12).

## 7. Changes Per File

### `src/companion/finance-mapper.ts`

- Added `VideoChatSatellite = "VideoChatSatellite"` as enum member 8, after
  `EmailSendSatellite` (line 53). `VALID_OPERATIONS` (line 56) auto-updates from
  `Object.values(Operation)`; no other code change needed.

### `docs/storage/finance-schema.md`

- Supported-values list: added bullet `VideoChatSatellite — Satellite video chat session`
  (after `EmailSendSatellite`), preserving the existing `EmailSendSatellite` "accepted by
  the mapper; not observed in the reference capture" note and the "unknown values rejected"
  statement.
- `isFinish` section: "Present on" now lists `TextChat`, `VideoChat`,
  `TextChatSatellite`, `VideoChatSatellite` (live evidence has `isFinish: true` for the
  satellite video chat).
- Operation Type Summary table: added row `VideoChatSatellite | Present | Server-provided |
  Satellite video chat session`. Per user instruction the `sum` cell documents
  **`Server-provided`** — the captured `0.9` belongs to that specific transaction, not to
  the operation type.

### `scripts/Companion.user.js` / `scripts/Companion.arena.user.js`

Regenerated via `npm run build` / `npm run build:arena`. Verified to contain the new
`VideoChatSatellite` enum member.

## 8. Operation Schema

The accepted enum now has 8 values: `EmailSend`, `EmailRead`, `TextChat`, `VideoChat`,
`TextChatBonusCoins`, `TextChatSatellite`, `EmailSendSatellite`, `VideoChatSatellite`.
`VideoChatSatellite` follows the existing satellite convention: it is NOT normalized and is
mapped as-is (same as `TextChatSatellite` / `EmailSendSatellite`). Satellite chat-type
operations carry `isFinish: true` per live evidence.

## 9. Mapping Behavior

- `mapTransaction` for `VideoChatSatellite` preserves every field: `sum`, `isFinish`,
  `ladyID`, `userID`, `name`, and `date` → `Date`.
- `mapResponse` accepts mixed lists containing `VideoChatSatellite` alongside
  `TextChatSatellite`, `TextChat`, `EmailRead`, and `VideoChat` without error.
- No label/category/icon/switch maps are keyed by operation anywhere in `src/`; the widget
  renders the raw operation string (`finance-widget.ts:862`) and `txIdentity`
  (`finance-controller.ts:61`) uses it verbatim, so no downstream change is needed.
- Unknown values and non-string operations remain rejected
  (`FinanceMapperValidationError`), preserving the documented contract.

## 10. Runtime Harness

New harness: `agencybooster-devtoolkit/rc-stable-004-video-chat-satellite-harness.ts`
(untracked). Bundles with esbuild, runs on Node. It imports `FinanceMapper` and
`FinanceMapperValidationError` from `../src/companion/finance-mapper` and asserts:

- A1–A7: the exact live `902409` transaction maps — operation, `sum: 0.9`, `isFinish: true`,
  `ladyID: 902409`, `userID: 831937`, `name: "Madalina"`, `date` → `Date`.
- B1–B6: the full 5-operation live list maps via `mapResponse` in order.
- C1–C7: all 7 pre-existing operations still accepted.
- D1: unknown operation `"BogusOp"` rejected; D2: non-string operation (`42`) rejected.

Result (VERIFIED):

```
PASS A1–A7 (live capture)  PASS B1–B6 (mixed list)  PASS C1–C7 (existing ops)
PASS D1–D2 (rejection)
=== RESULT: 22 checks, 0 failures ===
RUN_EXIT=0
```

## 11. Regression Verification

All accepted regression harnesses were rebuilt and rerun against the modified mapper.
EXCEPT ONE pre-existing, time-of-day-dependent failure in `rc-polish-004-fix` (S1 only),
which was reproduced identically on the clean baseline (my change reverted and re-tested),
so it is NOT caused by this EPIC:

| Harness | Checks | Failures | Run exit |
| --- | --- | --- | --- |
| `rc-stable-001` | 47 | 0 | 0 |
| `rc-stable-002-fix-001` | 20 | 0 | 0 |
| `rc-stable-002-fix-002` | 42 | 0 | 0 |
| `rc-stable-003` | 133 | 0 | 0 |
| `rc-stable-003-fix-003` | 44 | 0 | 0 |
| `rc-polish-004-fix` | 29 | 1 (pre-existing S1 flake) | 1 |
| `rc-stable-004` (new) | 22 | 0 | 0 |

Baseline-reproduction evidence for the flake: with `finance-mapper.ts` temporarily checked
out to HEAD (my change reverted), `rc-polish-004-fix` produced the identical single S1
failure. The S1 scenario uses the widget's default shift computed from the current clock;
when run during Morning shift (07:00–14:59) the mock transactions (rendered at
15:40/16:40/17:40 in S2) fall outside the shift, so the body correctly shows
"No transactions for this shift." This is unrelated to the finance operation schema.

## 12. Build Verification

| Command | Exit code | Result |
| --- | --- | --- |
| `npm run lint` | 0 | eslint `src/ extension/` clean |
| `npx tsc --noEmit` (in `agencybooster-devtoolkit/`) | 0 | typecheck clean |
| `npm run build` | 0 | `scripts/Companion.user.js` regenerated |
| `npm run build:arena` | 0 | `scripts/Companion.arena.user.js` regenerated |
| `npm run build:ext` | 0 | `extension/dist/content.js` regenerated |
| esbuild harness build | 0 | `rc-stable-004-video-chat-satellite-harness.cjs` built |

The built extension artifact `extension/dist/content.js` (gitignored) was verified to
contain the new value (content search: `Operation2["VideoChatSatellite"] =
"VideoChatSatellite"`).

## 13. Browser Verification

Live browser verification (loading the updated unpacked extension from `extension/dist/`,
opening a GoldenBride lady, and confirming the Finance widget renders the
`VideoChatSatellite` transaction instead of the error banner) was NOT executed in this
session. Browser runtime behaviour is therefore **UNKNOWN** and requires live
confirmation. The evidence driving this change is the user-provided live server response
(Section 3), so the fix targets a verified real value, but the live rendering check remains
outstanding.

## 14. Limitations

- Only operation-schema acceptance was changed; no new label, category, icon, or switch
  handling was introduced for `VideoChatSatellite` (it renders as its raw string, like the
  other satellite operations). If a UI label is later desired, it is a separate EPIC.
- The `sum` value of a `VideoChatSatellite` transaction is server-provided; this EPIC makes
  no assumption about a fixed price for the operation type.

## 15. Unknowns

- Live browser rendering of the widget after this fix: UNKNOWN (not executed this session).
- Whether the server ever returns other unlisted satellite operation values (e.g.
  `VideoChatBonusCoins`): UNKNOWN.
- Whether `VideoChatSatellite` may be returned with `isFinish: false` (current evidence
  only shows `true`): UNKNOWN.

## 16. Stable Release Readiness

- Implementation complete; lint, typecheck, build, arena build, and extension build all
  pass (exit 0).
- New harness: 22 checks, 0 failures. All Finance regression harnesses: 0 failures (one
  pre-existing time-of-day flake in `rc-polish-004-fix` S1 reproduced on clean baseline,
  unrelated to this EPIC).
- Public mapper interface unchanged; architecture and module boundaries preserved;
  Companion still never imports Finance internals.
- No unrelated files modified.
- Remaining gap: live browser verification (Section 13). Until that is performed,
  browser-level behaviour is UNKNOWN, so this commit is ready for merge but live
  confirmation is the only open item before user-facing validation.
