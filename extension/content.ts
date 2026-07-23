/**
 * Companion Content Script
 *
 * Entry point for Chrome Extension content script injection.
 * Waits for DOM readiness, prevents duplicate initialization,
 * and bootstraps the Companion application.
 *
 * Responsibilities:
 *   - Wait until DOM is ready
 *   - Prevent duplicate initialization (idempotent)
 *   - Bootstrap Companion through existing bootstrap.ts
 *   - Error boundary (failures never break CRM)
 *
 * No business logic. No module logic. No UI creation.
 */

import { bootstrap } from "../src/companion/bootstrap";
import { StorageService } from "../src/companion/storage-service";
import { STORAGE_KEYS } from "../src/companion/storage-keys";

const EXTENSION_KEY = "__AB_COMPANION_EXTENSION_LOADED__";

function isAlreadyLoaded(): boolean {
    return (window as Record<string, unknown>)[EXTENSION_KEY] === true;
}

function markAsLoaded(): void {
    (window as Record<string, unknown>)[EXTENSION_KEY] = true;
}

function isDevMode(): boolean {
    try {
        return StorageService.get(STORAGE_KEYS.DEV_MODE) !== null;
    } catch {
        return false;
    }
}

function log(message: string): void {
    if (isDevMode()) {
        console.log("[Companion:Content]", message);
    }
}

function logError(message: string, error?: unknown): void {
    if (isDevMode()) {
        console.error("[Companion:Content]", message, error ?? "");
    }
}

function main(): void {
    try {
        if (isAlreadyLoaded()) {
            log("Already loaded, skipping");
            return;
        }

        markAsLoaded();
        log("Content script injected");

        bootstrap();
    } catch (error) {
        // Error boundary: content script failures never break CRM
        logError("Content script failed:", error);

        // Mark as loaded to prevent repeated failures
        markAsLoaded();
    }
}

main();
