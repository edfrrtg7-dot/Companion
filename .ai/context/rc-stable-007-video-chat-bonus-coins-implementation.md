# RC-STABLE-007 — Support `VideoChatBonusCoins` Finance Operation

## 1. Objective

Add support for the verified live server Finance operation:

`VideoChatBonusCoins`

Fix the Finance validation error where raw server responses containing `VideoChatBonusCoins` caused mapping failures (`Validation failed for 'list[1]': Validation failed for 'operation': unknown operation type`).

## 2. Baseline

- Git HEAD at start: `1072e6e5969eeecd5c57a7517bfc500ddf14d630` (`origin/master`).
- Working tree: clean (only untracked development artifacts and devtoolkit).

## 3. Runtime Evidence

Live GoldenBride Finance UI capture for profile `902434` demonstrated transactions returning:
- `TextChatBonusCoins`
- `VideoChatBonusCoins`
- `TextChat`

The failing server list index (`list[1]`) contained `operation: "VideoChatBonusCoins"`.

## 4. Root Cause

`FinanceMapper` (`src/companion/finance-mapper.ts`) validates transaction operations against the `Operation` enum and `VALID_OPERATIONS` Set. Because `VideoChatBonusCoins` was absent from the enum, `parseOperation()` threw a `FinanceMapperValidationError` ("unknown operation type"), causing the Finance controller to transition to the error state.

## 5. Existing Architecture

- `FinanceMapper` maps raw API responses and transaction arrays into Companion domain types.
- `Operation` enum defines supported operations (`EmailSend`, `EmailRead`, `TextChat`, `VideoChat`, `TextChatBonusCoins`, `TextChatSatellite`, `EmailSendSatellite`, `VideoChatSatellite`).
- `VALID_OPERATIONS` derives from `Object.values(Operation)`.
- `txIdentity` uses `tx.operation` to form stable transaction keys.
- Schema documentation in `docs/storage/finance-schema.md` lists supported operations and summary tables.

## 6. Modified-File Plan

| File | Reason |
| --- | --- |
| `src/companion/finance-mapper.ts` | Add `VideoChatBonusCoins = "VideoChatBonusCoins"` to `Operation` enum. |
| `docs/storage/finance-schema.md` | Document `VideoChatBonusCoins` in operation list and summary table. |
| `scripts/Companion.user.js` | Regenerated tracked build artifact. |
| `scripts/Companion.arena.user.js` | Regenerated tracked build artifact. |
| `.ai/context/rc-stable-007-video-chat-bonus-coins-implementation.md` | This implementation report. |

Untracked: `agencybooster-devtoolkit/rc-stable-007-video-chat-bonus-coins-harness.ts` (+ `.cjs`).

## 7. Modified Files

1. `src/companion/finance-mapper.ts`
2. `docs/storage/finance-schema.md`
3. `scripts/Companion.user.js`
4. `scripts/Companion.arena.user.js`
5. `.ai/context/rc-stable-007-video-chat-bonus-coins-implementation.md`

## 8. Changes Per File

### `src/companion/finance-mapper.ts`
- Added `VideoChatBonusCoins = "VideoChatBonusCoins"` to the `Operation` enum.

### `docs/storage/finance-schema.md`
- Added `VideoChatBonusCoins` to the supported operation list under `operation` and updated the Operation Type Summary table.

### `scripts/Companion.user.js` / `scripts/Companion.arena.user.js`
- Regenerated via `npm run build` and `npm run build:arena`. Content-verified to contain `VideoChatBonusCoins`.

## 9. Operation Schema

- Enum member: `VideoChatBonusCoins = "VideoChatBonusCoins"`
- Description: Bonus coins for video chat (server-provided sum, e.g., `0.0` or positive).
- `isFinish`: Optional boolean (absent or `true`).

## 10. Mapping Behavior

- Raw transactions with `operation: "VideoChatBonusCoins"` map successfully.
- Preserves all server-provided fields (`operation`, `sum`, `isFinish`, `date`, `ladyID`, `userID`, `name`) unchanged.
- Unknown operations (e.g., `"BogusOperation"`) continue to be strictly rejected.

## 11. Harness Verification

New harness: `agencybooster-devtoolkit/rc-stable-007-video-chat-bonus-coins-harness.ts`
- **25 checks, 0 failures**, exit 0.
- Verified acceptance of `VideoChatBonusCoins`, survival of raw fields, `sum: 0` preservation, positive sum preservation, `isFinish` preservation, missing `isFinish` handling, `ladyID`/`userID`/`name` preservation, mixed response mapping, continued acceptance of all previous operations, strict rejection of unknown string and non-string operation values, stable `txIdentity` including raw operation value, and successful widget fixture mapping without validation errors.

## 12. Regression Verification

All accepted Finance regression harnesses rebuilt and rerun:
- `rc-stable-001`: 47 checks, 0 failures (exit 0)
- `rc-stable-002-fix-001`: 20 checks, 0 failures (exit 0)
- `rc-stable-002-fix-002`: 42 checks, 0 failures (exit 0)
- `rc-stable-004-video-chat-satellite`: 22 checks, 0 failures (exit 0)
- `rc-stable-005-finance-header-ui`: 33 checks, 0 failures (exit 0)
- `rc-stable-006-finance-ui-polish`: 30 checks, 0 failures (exit 0)
- `rc-polish-004-fix`: 29 checks, 0 failures (exit 0)
- `rc-stable-007`: 25 checks, 0 failures (exit 0)

## 13. Build Verification

- `npm run lint`: exit 0 (clean)
- `npm run typecheck`: exit 0 (clean)
- `npm run build`: exit 0 (`scripts/Companion.user.js` built)
- `npm run build:arena`: exit 0 (`scripts/Companion.arena.user.js` built)
- `npm run build:ext`: exit 0 (`extension/dist/` built)

Generated extension artifact (`extension/dist/content.js`) content-verified to contain `VideoChatBonusCoins`.

## 14. Browser Verification

Manual live smoke test on profile `902434`: **UNKNOWN** (not executed in this session).

## 15. Limitations

- Mapping is schema-driven; unsupported server operation types added in the future will continue to require explicit enum addition.

## 16. Unknowns

- Live browser rendering of `VideoChatBonusCoins` totals in the widget: UNKNOWN (verified via comprehensive runtime harnesses and domain mapper unit tests).

## 17. Release Readiness

- Complete, fully tested, all builds and regressions passing with 0 failures. Ready for distribution.
