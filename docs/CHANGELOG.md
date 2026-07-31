# Changelog

All notable changes to this project will be documented in this file.

## v2.1.0

RC-POLISH-003 — operator UI cleanup and Finance workflow restoration.

- **Changed**: Launcher version is now `v2.1.0`, sourced from a single authoritative constant (`src/companion/app-version.ts`) consumed by the modal header; extension manifest kept in sync.
- **Removed**: Session UI from the launcher modal (search list, export/import). SessionMemory runtime work is no longer started.
- **Removed**: Red unread badge/artifact from the launcher — the launcher presents as a clean circle.
- **Changed**: Finance widget `CASH` indicator is now the refresh control (with a refresh icon beside the label); the separate header refresh button was removed.
- **Removed**: Finance header double-click collapse; collapse is triggered by the collapse button only.
- **Restored**: Finance shift selector (Morning / Day / Night) in the widget header, reusing `FinanceShift` persistence.
- **Changed**: Collapsed Finance header keeps the expanded widget width and vertically centers its content.
- **Changed**: Launcher Finance button now toggles the widget (opens when hidden, closes when visible) for full lifecycle control.

## v1.11.0

Finance Synchronization Layer — automatic widget sync via DOM observation.

- **Added**: `DomFinanceDataProvider._observer` — `MutationObserver` instance for Finance container monitoring
- **Added**: `_FINANCE_SELECTORS` — consolidated selector string for Finance-related DOM elements
- **Added**: `_hasFinanceContent(doc)` — checks if a document contains Finance-related elements
- **Added**: `_startObserving()` — creates observer, attaches to all accessible document bodies
- **Added**: `_stopObserving()` — disconnects observer, clears debounce timer, resets targets
- **Added**: `_attachToDoc(doc)` — attaches observer to a document body (deduplicated via `WeakSet`)
- **Added**: `_onMutation()` — mutation callback that schedules debounced refresh
- **Added**: `_scheduleRefresh()` — 300ms debounce to batch rapid DOM mutations
- **Changed**: `refresh()` now dynamically attaches observer to new Finance-containing documents
- **Changed**: `App.start()` calls `_startObserving()` after initial refresh
- **Changed**: Close button handler calls `_stopObserving()` to prevent leaks
- **Removed**: No polling — pure DOM observation with debounced response

## v1.10.0

Finance DOM Provider — real Finance data from sender DOM, replacing mock provider.

- **Added**: `DomFinanceDataProvider` — reads live Finance data from accessible sender documents
- **Added**: `_getDocs()` — locates accessible documents via `DOMManager.getAccessibleDocuments()`
- **Added**: `_parseCredits(docs)` — extracts credit balance from DOM elements
- **Added**: `_parseTransactions(docs)` — extracts transaction rows from table/DOM selectors
- **Added**: `_parseTransactionCells(texts)` — classifies cell text into date/time/operation/target/credits
- **Added**: `refresh()` — parses DOM, applies shift filtering, builds `FinanceModel`, notifies subscribers
- **Added**: `getCurrentModel()` — returns current `FinanceModel` snapshot
- **Added**: `subscribe()`/`unsubscribe()`/`notify()` — observer pattern for widget updates
- **Changed**: `App.start()` wires `DomFinanceDataProvider` as default provider, calls `refresh()` on startup
- **Changed**: `handleFinanceRefresh()` delegates to provider's `refresh()` without double-notify
- **Removed**: `MockFinanceDataProvider` no longer wired by default (kept as fallback)
- **Removed**: Widget has zero coupling to `DataProvider`, `FinanceManager.fetchFinanceData()`, or `FinanceManager.getCachedState()`

## v1.9.0

Finance Data Layer Preparation — domain model, provider abstraction, widget dependency injection.

- **Added**: `FinanceDomain` — domain model factory: `createModel()`, `createTransaction()`, `createTotals()`, `createPeriod()`, `emptyModel()`
- **Added**: `MockFinanceDataProvider` — static placeholder data with `getCurrentModel()`, `subscribe()`/`unsubscribe()`/`notify()` observer pattern
- **Added**: `CustomUI._financeProvider` — provider field for widget dependency injection
- **Changed**: `buildFinanceWidget(provider)` accepts optional provider parameter, defaults to `MockFinanceDataProvider`
- **Changed**: `_renderFinanceWidget(widget, model, widgetState)` consumes `FinanceModel` instead of raw `getCachedState()` data
- **Changed**: `updateFinanceWidget()` reads from provider via `_financeProvider`
- **Changed**: `handleFinanceRefresh()` delegates to provider's `refresh()` and `notify()` methods
- **Changed**: `App.start()` passes `MockFinanceDataProvider` to `buildFinanceWidget()`
- **Removed**: Widget no longer directly reads `FinanceManager.getCachedState()` for rendering
- **Removed**: `handleFinanceRefresh` no longer calls `DataProvider.invalidate()` and `FinanceManager.fetchFinanceData(docs)` directly

## v1.8.0

Finance Widget Integration & Time Presets — architecture separation, working time presets, shift info display.

- **Changed**: FinanceManager state architecture split into three independent stores: `agencybooster-finance-widget` (dimensions, collapsed, closed), `agencybooster-finance-data` (credits, transactions, parseMethod, failureReason, lastRefresh, lastDuration, lastStatus), `agencybooster-finance-preset` (morning/day/night)
- **Changed**: Widget dimensions never depend on Finance settings; Finance settings never recreate the widget; refreshing Finance data never resets widget state
- **Removed**: `showShiftPeriodModal()` — custom datetime-local picker replaced by preset buttons
- **Removed**: Set/Clear buttons from Finance widget body
- **Removed**: Period display row from Finance widget body
- **Removed**: `_SHIFT_KEY`, `getShiftPeriod()`, `setShiftPeriod()`, `clearShiftPeriod()`, `getDefaultState()`, `readState()`, `writeState()`
- **Added**: `readWidget()` / `writeWidget()` — widget UI state persistence
- **Added**: `readData()` / `writeData()` — finance runtime data persistence
- **Added**: `readPreset()` / `writePreset()` — preset selection persistence (default: "morning")
- **Added**: `computeShiftRange(preset)` — computes Date range from preset with midnight-crossing support for Night
- **Added**: `getShiftLabel(preset)` — Ukrainian locale shift labels (Ранок/День/Ніч)
- **Added**: `getShiftTimeDisplay(preset)` — human-readable time ranges with "(наступний)" for Night
- **Added**: Clock icon button in Finance widget header — opens compact shift dropdown
- **Added**: Shift dropdown with three preset buttons (Ранок 07:00–14:59, День 15:00–22:59, Ніч 23:00–06:59)
- **Added**: Active preset visually highlighted with `primary` class in dropdown
- **Added**: Shift info display in widget body: today's date (Ukrainian format), shift name, time range
- **Changed**: `_filterByShiftPeriod()` updated to handle midnight-crossing ranges (Night preset: start > end)
- **Changed**: Time displays now use Ukrainian locale (`uk-UA`)
- **Changed**: Finance data filtering always active — preset is never null (defaults to "morning")
- **Changed**: Finance data layer isolated from widget UI — ready for live data source integration
- **Added**: CSS for shift dropdown (`.ab-finance-shift-dropdown`, `.ab-finance-shift-option`, `.ab-finance-shift-open`)
- **Added**: CSS for shift info display (`.ab-finance-shift-info`, `.ab-finance-shift-info-row`, `.ab-finance-shift-time-display`)
- Version bumped to 1.8.0

## v1.7.0

Companion UI & Branding Improvements — resizable Finance widget, launcher relocation, application identity.

- **Fixed**: Finance widget drag/resize now uses Pointer Events consistently — eliminates stuck drag states and event conflicts
- **Fixed**: `setPointerCapture` ensures drag/resize continues even if pointer leaves the handle
- **Fixed**: `pointercancel` handler prevents orphaned drag/resize state
- **Added**: `touch-action: none` on drag and resize handles prevents browser default touch interference
- **Added**: Finance widget is now resizable via bottom-right corner handle; dimensions persist across reloads
- **Added**: `CONFIG.FINANCE_WIDGET_SIZE` expanded with `MIN_WIDTH`, `MIN_HEIGHT`, `MAX_WIDTH`, `MAX_HEIGHT` bounds
- **Added**: `CONFIG.COMPANION_STORAGE_PREFIX` for Companion-specific storage
- **Added**: `CustomUI._initFinanceResize()` — resize handler with min/max clamping and live layout updates
- **Added**: `CustomUI._readTab()` / `_writeTab()` — tab persistence via localStorage
- **Changed**: Finance widget default size: 360×380px (was 280×300px)
- **Changed**: Finance widget position persistence removed — always opens at default location
- **Changed**: Launcher moved from bottom-right to top-right
- **Changed**: Window title renamed from "AgencyBooster Manager" to "AgencyBooster Companion"
- **Changed**: Diagnostics SYSTEM section: "Userscript Version" renamed to "AgencyBooster Companion"
- **Changed**: Companion grid icon now used in both launcher and window header
- **Changed**: Active tab restored automatically after reopening Companion
- **Changed**: UI polish — header padding, tab font weight, card border-radius, button styling
- **Updated**: Export debug bundle and SnapshotAPI field names (`userscriptVersion` → `companionVersion`)
- Version bumped to 1.7.0

## v1.6.2

Reset IceBreaker — clear `delivered` field during reset to restore original AgencyBooster sender state.

- **Fixed**: `ResetManager.resetIceBreaker` — now clears `data.delivered` (guarded by `"delivered" in data`) alongside existing `chainProgress` and `sended` cleanup
- **Why**: The original AgencyBooster Completed counter is driven by the `delivered` field, not `sended`. Clearing only `chainProgress` and `sended` left the original extension's Completed counter stale after reset. Verified on GoldenBride.
- **Scope**: `resetIceBreaker` only. `getCompletedCount()`, `resetBroadcast()`, and Companion Dashboard logic unchanged.
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
