/**
 * Companion Background Service Worker
 *
 * Runs in the extension background context (Manifest V3 service worker).
 *
 * Current responsibilities:
 *   - Extension lifecycle events
 *
 * Future responsibilities:
 *   - chrome.runtime messaging
 *   - chrome.storage synchronization
 *   - Update checks
 *   - Background data synchronization
 *
 * No module logic. No UI. No business logic.
 */

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        console.log("[Companion] Extension installed");
    } else if (details.reason === "update") {
        console.log("[Companion] Extension updated to", chrome.runtime.getManifest().version);
    }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Future: handle messages from content script
    // For now, acknowledge receipt
    if (message && typeof message === "object" && "type" in message) {
        sendResponse({ received: true });
    }
    return false;
});
