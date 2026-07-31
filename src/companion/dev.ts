/**
 * Dev-mode diagnostic logging.
 *
 * Centralized diagnostics with severity levels:
 *   - INFO: informational messages
 *   - WARN: warning messages
 *   - ERROR: error messages
 *   - DEBUG: verbose debug messages
 *
 * Enabled by setting localStorage "ab-dev" to any value.
 * No production console logging.
 */

import { StorageService } from "./storage-service";
import { STORAGE_KEYS } from "./storage-keys";

/** Diagnostic severity levels. */
export enum DiagnosticLevel {
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
    DEBUG = "DEBUG",
}

/** Error history entry. */
export interface ErrorHistoryEntry {
    readonly timestamp: string;
    readonly message: string;
    readonly stack?: string;
    readonly source?: string;
}

/** Maximum error history entries (legacy: up to 20). */
const MAX_ERROR_HISTORY = 20;

/** Load error history from storage. */
function loadErrorHistory(): ErrorHistoryEntry[] {
    try {
        const raw = StorageService.get(STORAGE_KEYS.DIAGNOSTICS_ERROR_HISTORY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
}

/** Save error history to storage. */
function saveErrorHistory(entries: ErrorHistoryEntry[]): void {
    try {
        StorageService.set(STORAGE_KEYS.DIAGNOSTICS_ERROR_HISTORY, JSON.stringify(entries));
    } catch { /* ignore */ }
}

/** Format a diagnostic message with level and timestamp. */
function format(level: DiagnosticLevel, _args: unknown[]): string {
    const timestamp = new Date().toISOString().slice(11, 23);
    return `[Companion:${level}] ${timestamp}`;
}

/** Add an entry to error history (bounded ring buffer). */
function addErrorHistory(message: string, stack?: string, source?: string): void {
    const entries = loadErrorHistory();
    entries.push({
        timestamp: new Date().toISOString(),
        message,
        stack,
        source,
    });
    if (entries.length > MAX_ERROR_HISTORY) entries.shift();
    saveErrorHistory(entries);
}

/**
 * Log an informational diagnostic message in dev mode only.
 */
export function diag(...args: unknown[]): void {
    if (isDevMode()) {
        console.log(format(DiagnosticLevel.INFO, args), ...args);
    }
}

/**
 * Log a warning diagnostic message in dev mode only.
 */
export function diagWarn(...args: unknown[]): void {
    if (isDevMode()) {
        console.warn(format(DiagnosticLevel.WARN, args), ...args);
    }
}

/**
 * Log an error diagnostic message in dev mode only.
 * Also records to error history.
 */
export function diagError(...args: unknown[]): void {
    if (isDevMode()) {
        console.error(format(DiagnosticLevel.ERROR, args), ...args);
    }
    // Always record errors to history regardless of dev mode
    const message = args.map(a => (a instanceof Error ? a.message : String(a))).join(" ");
    const stack = args.find(a => a instanceof Error)?.stack;
    addErrorHistory(message, stack, "diagError");
}

/**
 * Log a debug diagnostic message in dev mode only.
 */
export function diagDebug(...args: unknown[]): void {
    if (isDevMode()) {
        console.debug(format(DiagnosticLevel.DEBUG, args), ...args);
    }
}

/**
 * Check if dev mode is active.
 * Useful for conditional expensive logging.
 */
export function isDevMode(): boolean {
    try {
        // Prefer StorageService (respects chrome.storage if available)
        return StorageService.get(STORAGE_KEYS.DEV_MODE) !== null;
    } catch {
        try {
            // Fallback to direct localStorage
            return localStorage.getItem(STORAGE_KEYS.DEV_MODE) !== null;
        } catch {
            return false;
        }
    }
}

/**
 * Get error history entries (most recent last).
 */
export function getErrorHistory(): readonly ErrorHistoryEntry[] {
    return loadErrorHistory();
}

/**
 * Clear error history.
 */
export function clearErrorHistory(): void {
    saveErrorHistory([]);
}

/** Import history entry. */
export interface ImportHistoryEntry {
    readonly timestamp: string;
    readonly profileKey: string;
    readonly importedCount: number;
    readonly result: "success" | "partial" | "failed";
}

/** Maximum import history entries. */
const MAX_IMPORT_HISTORY = 20;

/** Load import history from storage. */
function loadImportHistory(): ImportHistoryEntry[] {
    try {
        const raw = StorageService.get(STORAGE_KEYS.DIAGNOSTICS_IMPORT_HISTORY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
}

/** Save import history to storage. */
function saveImportHistory(entries: ImportHistoryEntry[]): void {
    try {
        StorageService.set(STORAGE_KEYS.DIAGNOSTICS_IMPORT_HISTORY, JSON.stringify(entries));
    } catch { /* ignore */ }
}

/** Add an entry to import history (bounded ring buffer). */
export function addImportHistory(entry: ImportHistoryEntry): void {
    const entries = loadImportHistory();
    entries.push(entry);
    if (entries.length > MAX_IMPORT_HISTORY) entries.shift();
    saveImportHistory(entries);
}

/** Get import history entries (most recent last). */
export function getImportHistory(): readonly ImportHistoryEntry[] {
    return loadImportHistory();
}

/** Clear import history. */
export function clearImportHistory(): void {
    StorageService.remove(STORAGE_KEYS.DIAGNOSTICS_IMPORT_HISTORY);
}
