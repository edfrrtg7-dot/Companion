# Finance API Response Schema

> Verified from live API response captured on 2026-07-21.
> Endpoint: `GET /usermodule/services/agencyhelper/v2?command=finances&from=YYYY-MM-DD&to=YYYY-MM-DD`

## Top-Level Response

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `total` | `number` | Yes | Sum of all `sum` values in `list` |
| `from` | `string` | Yes | Start date of the query range (`YYYY-MM-DD`) |
| `to` | `string` | Yes | End date of the query range (`YYYY-MM-DD`) |
| `list` | `Transaction[]` | Yes | Array of transaction objects (may be empty) |
| `success` | `boolean` | Yes | `true` on success |

### Example Top-Level

```json
{
  "total": 15.9,
  "from": "2026-06-21",
  "to": "2026-07-21",
  "list": [ ... ],
  "success": true
}
```

## Transaction Object

| Property | Type | Required | Nullable | Description |
|----------|------|----------|----------|-------------|
| `date` | `number` | Yes | No | Unix timestamp in **milliseconds** |
| `ladyID` | `number` | Yes | No | ID of the lady |
| `name` | `string` | Yes | No | Name of the lady |
| `sum` | `number` | Yes | No | Credit amount (float, may be `0.0`) |
| `userID` | `number` | Yes | No | ID of the user |
| `operation` | `string` | Yes | No | Operation type (see below) |
| `isFinish` | `boolean` | No | No | Only present on completed chat sessions |

### Example Transaction

```json
{
  "date": 1782085590000,
  "ladyID": 812510,
  "name": "Lilia",
  "sum": 0.15,
  "isFinish": true,
  "userID": 877681,
  "operation": "TextChat"
}
```

## Field Details

### `date`

- **Type:** `number` (integer)
- **Format:** Unix timestamp in milliseconds (not seconds)
- **Example:** `1782558221000` → `2026-07-21 09:43:41 UTC`
- **Conversion:** `new Date(1782558221000)` or `new Date(1782558221000).toISOString()`
- **Nullable:** No

### `ladyID`

- **Type:** `number` (integer)
- **Description:** Unique identifier for the lady
- **Example:** `812510`
- **Nullable:** No

### `name`

- **Type:** `string`
- **Description:** Display name of the lady
- **Example:** `"Lilia"`
- **Nullable:** No

### `sum`

- **Type:** `number` (float)
- **Description:** Credit amount for this transaction
- **Format:** Decimal number, may be `0.0` (e.g., bonus coins)
- **Examples:** `1.5`, `0.15`, `0.3`, `0.0`
- **Nullable:** No

### `userID`

- **Type:** `number` (integer)
- **Description:** Unique identifier for the user
- **Example:** `884829`
- **Nullable:** No

### `operation`

- **Type:** `string`
- **Description:** Type of operation performed
- **Supported values:**
  - `EmailSend` — Email sent to lady
  - `EmailRead` — Email read by lady
  - `TextChat` — Text chat session
  - `VideoChat` — Video chat session
  - `TextChatBonusCoins` — Bonus coins for text chat (sum is `0.0`)
  - `TextChatSatellite` — Satellite text chat session
  - `EmailSendSatellite` — Satellite email sent to lady (accepted by the mapper; not observed in the reference capture)
- **Nullable:** No
- **Unknown values:** The mapper rejects any operation value not in the supported list (`FinanceMapperValidationError`).

### `isFinish` (optional)

- **Type:** `boolean`
- **Description:** Indicates if the chat session completed
- **Present on:** Chat-type operations (`TextChat`, `VideoChat`, `TextChatSatellite`)
- **Not present on:** Email operations (`EmailSend`, `EmailRead`) and bonus operations (`TextChatBonusCoins`)
- **Nullable:** No (when present, always `true`)

## Pagination

There is **no pagination**. The server returns all transactions for the requested date range in a single `list` array. The `total` field provides the sum of credits.

## Date Range Parameters

| Parameter | Format | Description |
|-----------|--------|-------------|
| `from` | `YYYY-MM-DD` | Start date (inclusive) |
| `to` | `YYYY-MM-DD` | End date (inclusive) |

## Currency

- **Unit:** Credits
- **Precision:** Float (2 decimal places observed: `1.5`, `0.15`, `0.3`)
- **Zero values:** `0.0` for bonus/non-chargeable operations
- **No currency symbol** in the response — credits only

## Operation Type Summary

| Operation | `isFinish` | `sum` range | Description |
|-----------|-----------|-------------|-------------|
| `EmailSend` | Absent | 1.5 | Email sent |
| `EmailRead` | Absent | 1.5 | Email read |
| `TextChat` | Present | 0.15 | Text chat session |
| `VideoChat` | Present | 0.15–0.3 | Video chat session |
| `TextChatSatellite` | Present | 0.3 | Satellite text chat |
| `EmailSendSatellite` | Expected Absent | UNKNOWN | Satellite email sent (mapper-supported; not observed in reference capture) |
| `TextChatBonusCoins` | Absent | 0.0 | Bonus coins (free) |

## Response Size

- **24 transactions** in the captured response
- **~15.9 total credits** across all transactions
- **Date range:** 30 days (2026-06-21 to 2026-07-21)
- **No response compression observed** (plain JSON)
