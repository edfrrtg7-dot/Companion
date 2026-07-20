# Changelog

All notable changes to this project will be documented in this file.

## v1.6.2

Reset IceBreaker — clear `delivered` field during reset to restore original AgencyBooster sender state.

- **Fixed**: `ResetManager.resetIceBreaker` — now clears `data.delivered` (guarded by `"delivered" in data`) alongside existing `chainProgress` and `sended` cleanup
- Ensures original AgencyBooster Completed counter resets correctly after private IceBreaker chain reset
- No changes to `getCompletedCount()`, `resetBroadcast()`, or Companion Dashboard logic
- Version bumped to 1.6.2

## v1.6.1

Runtime Source Repair — verified data sources, removed fake DOM selectors, fixed reset behavior.

- **Fixed**: `StateManager.getInProgressCount(data, moduleType)` — correctly computes from `data.chainProgress` (IceBreaker) or `data.broadcast.chainProgress` (Broadcast)
- **Fixed**: `StateManager.getCompletedCount(data, moduleType)` — correctly computes from `data.sended` or `data.broadcast.sended` split-by-semicolon
- **Removed**: `LiveReader._providerDOMDirect` — deleted entirely (guessed selectors never matched GoldenBride DOM)
- **Removed**: `LiveReader._providerDOMStructured` — deleted entirely (guessed label variants)
- **Removed**: `LiveReader._providerDOMText` — deleted entirely (regex text matching)
- **Removed**: `LiveReader._mergeField` — no longer needed (single source)
- **Removed**: `LiveReader._findLabeledValue`, `_extractNumber`, `_resolveStatus`, `_resolveDelay` — no longer needed
- **Simplified**: `LiveReader.readAll` — reads only from localStorage, always HIGH confidence; `startBtn`/`stopBtn` still from DOM
- **Fixed**: `ResetManager.resetIceBreaker` — now properly filters private IDs from `sended` string instead of reconstructing from `chainProgress` (preserves non-private completed IDs)
- **Added**: `CONFIG.DEBUG_FINANCE` flag for temporary finance debug mode
- **Added**: `FinanceManager._debugLog` — logs every DOM scan step when DEBUG_FINANCE is enabled (selectors tried, matched elements, table structure, parse results)
- **Added**: `FinanceManager.getDebugLog()` / `clearDebugLog()` accessors
- **Updated**: `CONFIG.RUNTIME_MAP` — finance fields marked as `confidence: "pending"` (selectors need real verification)
- **Updated**: Diagnostics LIVE READER section — added `parse` status per field (ok/no_data)
- **Updated**: Diagnostics FINANCE section — includes debug log entries when DEBUG_FINANCE enabled
- **Updated**: Text report — section title changed to "(localStorage)", added source summary
- **Updated**: Debug bundle — liveReader entries include `provider: "localStorage"`, finance includes `debugLog`
- **Updated**: `_detectLoadedModules` — added RuntimeMap to module list
- Version bumped to 1.6.1

## v1.6.0

Runtime Architecture Stabilization — shared data provider, runtime map, reset system, diagnostics expansion.

- Added `RuntimeMap` module with static field definitions (provider, objectPath, selector, confidence) for all 12 dashboard fields
- `DataProvider` is now the sole DOM reader — all callers (Diagnostics, SnapshotAPI) updated to use it
- All direct `LiveReader.readAll` calls outside DataProvider removed — single scan guarantee
- `ResetManager` refactored: added `resetBroadcast()` method, reset tracking (`_lastReset`, `_lastResetType`, `_lastResetDuration`), `getResetStats()` accessor
- `resetIceBreaker` fixed: clears chainProgress (private channel only), sended, status; preserves snippets/settings/delays
- `SnippetImporter` simplified to TXT-only: removed JSON parsing, dedup/append logic; immediate replace-after-confirm
- `parseFile(rawText)` simplified to plain text splitting by blank lines
- `executeImport(profileKey, parsed)` replaces snippets directly (no append)
- File input restricted to `.txt` only
- Diagnostics expanded: added RUNTIME MAP section with provider/objectPath/confidence per field
- Diagnostics added RESET section (completed count, in progress count, delivered count, last reset, type, duration)
- Diagnostics FINANCE section expanded: credits source, transactions source, parsed rows
- `generateTextReport` updated: 11 sections (was 9), fixed duplicate section numbering
- `exportDebugBundle` updated: uses DataProvider, includes runtimeMap, reset stats, expanded finance
- Removed unused `IMPORT_JSON_INVALID` config message
- Updated unsupported file type message for TXT-only
- Version bumped to 1.6.0

## v1.5.7

Dashboard & Finance Architecture Stabilization — shared data layer, finance redesign, performance.

- Added `DataProvider` module as single data source for Dashboard, Finance, and Diagnostics
- Single DOM scan per refresh cycle, cached for one poll interval — eliminates duplicate scans
- `LiveReader.readAll` now accepts optional `docs` parameter to share scanned documents
- `Dashboard.updateDashboard` reads from `DataProvider` instead of calling `LiveReader` directly
- Finance Widget redesigned: removed period dropdown and "Open Finance" button
- Added custom shift period with Start/End Date-Time picker, stored permanently in localStorage
- Added 3-tier finance parsing fallback: structured table → DOM selectors → text parsing
- Finance Widget now shows latest 5 transactions in a compact grid (Date, Time, Op, Target, Cr)
- Transaction cell parser identifies columns by content patterns (date, time, numeric, text)
- Shift period filter applied before truncating to 5 transactions
- Finance CSS compacted: smaller fonts, tighter spacing, transaction table grid layout
- `FinanceManager.parseFinanceFromDocs(docs)` replaces `fetchFinanceData(period)`
- Finance diagnostics expanded: parse method, failure reason, shift period, transaction count
- Debug bundle finance section includes `parseMethod`, `failureReason`, `shiftPeriod`
- Text report finance section updated with new fields
- Removed unused `FINANCE_DEFAULT_PERIOD` and `FINANCE_URL` config constants
- Version bumped from 1.5.6 to 1.5.7

## v1.5.6

Finance Widget — lightweight floating widget for credit balance and transaction tracking.

- Added `FinanceManager` module with localStorage persistence and DOM-based data fetching
- Floating draggable widget, default position bottom-left, position persisted across reloads
- Collapsible/closable with state persistence
- Displays: credits total, transactions count, selected period, last refresh time
- Period selector (Today, This Week, This Month, All Time) — stored permanently, never auto-changes
- Manual refresh only — no polling, no timers, no background requests
- "Open Finance" button navigates to configurable finance page URL
- Reopen widget via "Finance Widget" button in Manager view
- Diagnostics: new FINANCE section in object, text report, and debug bundle showing last refresh, request duration, status
- Widget initializes on `App.start`, renders only in top frame
- Drag implemented via mousedown/mousemove/mouseup on title bar
- Version bumped from 1.5.5 to 1.5.6

## v1.5.5

Snippet Import — full import functionality with JSON/TXT support, preview, validation, and diagnostics.

- Added `SnippetImporter` module with complete import workflow
- JSON import supports flat arrays, `{private: [], broadcast: []}` format, and `{text: "..."}` object entries
- TXT import uses existing `# PRIVATE` / `# BROADCAST` section markers
- File type auto-detected from extension (`.json` or `.txt`)
- Duplicate detection against existing snippets before import
- Preview modal shows import statistics (parsed, duplicates, invalid) with confirm/cancel
- Atomic import via `StorageManager.runTransaction` — existing snippets remain unchanged on failure
- Import history tracking (last 10 imports) with timestamp, counts, and status
- Diagnostics: new IMPORT HISTORY section in object, text report, and debug bundle
- Module detection list updated to include `SnippetImporter`
- Version bumped from 1.5.4 to 1.5.5

## v1.5.4

Dashboard Accuracy Fix — delay resolution, display improvements, diagnostics enrichment.

- Fixed `StateManager.getDelayValue` to find the actual configured delay (most frequent non-zero value) instead of blindly picking the second message's value
- Added `NOT_AVAILABLE` text constant; LiveReader now displays "Not Available" instead of "Unknown" when no provider has data
- Dashboard delay cards now show "Not Available" for unavailable values instead of "Unknown"
- Diagnostics LIVE READER section now shows `displayed` value per field (formatted as it appears in Dashboard)
- RUNTIME section formats IB/BR delay values with " sec" suffix for consistency
- Dashboard and LiveReader behavior unchanged
- Version bumped from 1.5.3 to 1.5.4

## v1.5.3

Debug Bundle Export — structured diagnostic data export.

- Added `Diagnostics.exportDebugBundle()` returning structured JSON with meta, system, profile, storage, dom, runtime, liveReader, errors sections
- Bundle uses machine-readable values (numbers, booleans, arrays) instead of display strings
- Added "Copy Debug Bundle" button to Diagnostics UI alongside existing Copy Report and Copy JSON
- Bundle includes LiveReader source/confidence metadata per field
- Bundle includes error history with timestamps
- Diagnostics view now renders nested objects as JSON in the table
- Dashboard and LiveReader behavior unchanged
- Version bumped from 1.5.2 to 1.5.3

## v1.5.2

Diagnostics Expansion — detailed runtime and environment data.

- Logger now collects recent errors (up to 20) with timestamps for diagnostics
- SYSTEM section: added Platform, Cookie Enabled, Online
- PROFILE section: added Status (raw), Broadcast status (raw)
- STORAGE section: added Storage usage (bytes), Storage limit, Storage used %, Profile size (bytes), localStorage keys
- DOM section: added Start/Stop button source
- RUNTIME section: added Last known IB/BR status, Last known IB/BR delay, Stop wait timeout, Stop required ticks, Default delay, Module count, Profile valid
- Added ERROR LOG section with error count, last error details
- Added ERROR HISTORY section with full error list (timestamp, message, detail)
- Text report expanded to 7 sections with all new fields
- Dashboard and LiveReader behavior unchanged
- Version bumped from 1.5.1 to 1.5.2

## v1.5.1

Dashboard Synchronization & Diagnostics Foundation.

- LiveReader now returns `{value, source, confidence}` for every field including startBtn/stopBtn
- Added `UNKNOWN` source constant, renamed `DOM_TEXT_FALLBACK` to `DOM_TEXT`
- Dashboard shows confidence-colored source badges on every card
- Diagnostics restructured: SYSTEM, PROFILE, STORAGE, LIVE READER, DOM, RUNTIME sections
- Debug report rewritten with 6 sections covering all runtime information
- Removed deprecated `Diagnostics.getStats` method
- Added `docs/TASKS.md` for project task tracking
- Version bumped from 1.5.0 to 1.5.1

## v1.5.0

LiveReader Phase - Dashboard synchronization with live DOM data.

- Added `LiveReader` module with 4 pluggable data providers
- Provider priority: DOM Direct → DOM Structured → localStorage → DOM Text Fallback
- Each read value includes `source` and `confidence` metadata
- Dashboard now reads live values from sender UI DOM instead of localStorage
- Diagnostics reports include LiveReader source metadata
- SnapshotAPI consumes LiveReader for statistics collection
- Version bumped from 1.4.2 to 1.5.0

## v1.4.2

Backup stabilization and QuotaExceededError handling.

- Fixed `createBackup` with iterative cleanup-retry loop on storage full
- Added `collectBackupKeys` helper for ordered backup key management
- Added `BACKUP_FAILED` user-facing text constant
- Documentation: README.md, ARCHITECTURE.md, ROADMAP.md, TODO.md, AI_CONTEXT.md, CODING_RULES.md, PROJECT.md

## v0.1.0

Repository initialized.

- Created project directory structure with all module directories
- Added README.md with project overview, goals, features, and structure
- Added docs/PROJECT.md with full project description
- Added docs/AI_CONTEXT.md with AI assistant guidance
- Added docs/CODING_RULES.md with coding standards and conventions
- Added docs/ARCHITECTURE.md with module descriptions and system diagrams
- Added docs/ROADMAP.md with milestone definitions
- Added docs/TODO.md with prioritized task list
- Added docs/CHANGELOG.md with version history
