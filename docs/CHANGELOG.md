# Changelog

All notable changes to this project will be documented in this file.

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
