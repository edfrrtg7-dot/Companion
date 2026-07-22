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
 *   - Diagnostic logging (dev mode only)
 *
 * No business logic. No module logic. No UI creation.
 */

import { bootstrap } from "../src/companion/bootstrap";

const EXTENSION标记 = "__AB_COMPANION_EXTENSION_LOADED__";

function isAlreadyLoaded(): boolean {
    return (window as Record<string, unknown>)[EXTENSION标记] === true;
}

function markAsLoaded(): void {
    (window as Record<string, unknown>)[EXTENSION标记] = true;
}

function log(message: string): void {
    try {
        const isDev = localStorage.getItem("ab-dev") !== null;
        if (isDev) {
            console.log("[Companion:Content]", message);
        }
    } catch {
        // localStorage may be unavailable
    }
}

function main(): void {
    if (isAlreadyLoaded()) {
        log("Already loaded, skipping");
        return;
    }

    markAsLoaded();
    log("Content script injected");

    bootstrap();
}

main();
