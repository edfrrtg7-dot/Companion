/**
 * Diagnostics Collectors
 *
 * All CRM profile data collection functions for the Diagnostics tab.
 * Extracted from companion-modal.ts to improve separation of concerns.
 *
 * Collected data includes:
 *   - Storage usage and profile info
 *   - Runtime environment and system status
 *   - Document and session state
 *   - Live CRM profile data (IceBreaker, Broadcast)
 *   - Runtime detection and version information
 *   - Reset history
 *   - Finance module state (via FinanceController)
 *
 * This module is imported by companion-modal.ts for Diagnostics tab rendering.
 */

import { CrmService } from "./crm-service";
import { resolveActiveProfile } from "./profile-resolver";
import { StorageService } from "./storage-service";
import { STORAGE_KEYS } from "./storage-keys";
import { collectDiagnostics } from "./companion-diagnostics";
import { FinanceController } from "./finance-controller";
import { FinanceShift } from "./finance-shift";
import { getErrorHistory, getImportHistory } from "./dev";
import { getPlatform } from "./platform-interface";
import { getRuntimeEnvironment } from "./runtime-environment";

/**
 * FinanceController dependency — injected via setFinanceController().
 * Mirrors the pattern used in companion-modal.ts.
 */
let financeController: FinanceController | null = null;

/**
 * Inject the FinanceController instance for Finance diagnostics.
 */
export function setFinanceController(controller: FinanceController | null): void {
    financeController = controller;
}

/**
 * Collect storage-related data (localStorage keys, profile size, etc.)
 */
async function collectStorageData(): Promise<Record<string, string>> {
    const info = collectDiagnostics();
    let storageKeys = 0;
    let profileSize = "0 KB";
    let backupKeys = "None";
    let quotaUsage = "N/A";
    let detectedProfiles = "None";
    let selectedProfile = "Unknown";
    let storageKey = "Unknown";
    let backupExists = "No";
    let estimatedLocalStorageKB = "N/A";

    try { storageKeys = localStorage.length; } catch { /* ignore */ }

    const profileKey = CrmService.findProfileKey();
    if (profileKey) {
        const raw = localStorage.getItem(profileKey);
        if (raw) {
            try { profileSize = `${(new Blob([raw]).size / 1024).toFixed(2)} KB`; } catch { /* ignore */ }
        }
    }

    // Unified backup detection: find all backup keys in localStorage
    const allBackupKeys = Object.keys(localStorage).filter(k => k.includes("backup"));
    backupKeys = allBackupKeys.length > 0
        ? `${allBackupKeys.length} (${allBackupKeys.slice(0, 3).join(", ")}${allBackupKeys.length > 3 ? "..." : ""})`
        : "None";

    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
        try {
            const estimate = await navigator.storage.estimate();
            if (estimate.usage != null && estimate.quota != null) {
                const usedMB = (estimate.usage / (1024 * 1024)).toFixed(2);
                const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(0);
                quotaUsage = `${usedMB} MB / ${quotaMB} MB`;
            }
        } catch { /* ignore */ }
    }

    // Userscript profile fields
    const allProfiles = Object.keys(localStorage).filter(k => k.startsWith("chat-sender-"));
    detectedProfiles = allProfiles.length > 0 ? allProfiles.join(", ") : "None";
    selectedProfile = profileKey ? profileKey.replace("chat-sender-", "") : "Unknown";
    storageKey = profileKey || "Unknown";

    // Active profile resolution (RC-STABLE-003-FIX-003)
    const activeResolution = resolveActiveProfile();
    const visibleProfileId = activeResolution.ok ? activeResolution.profileId : null;
    const selectedId = profileKey ? profileKey.replace("chat-sender-", "") : null;
    const profileMismatch = (visibleProfileId && selectedId)
        ? (visibleProfileId === selectedId ? "NO" : "YES")
        : "Unknown";
    const activeSource = activeResolution.ok
        ? (activeResolution.source === "sidebar-dom"
            ? "GoldenBride sidebar DOM"
            : activeResolution.source === "url"
                ? "URL parameter"
                : "Single profile fallback")
        : "Unavailable";

    // Backup exists: check if any backup key relates to the current profile
    if (profileKey) {
        const profileId = profileKey.replace("chat-sender-", "");
        backupExists = allBackupKeys.some(k => k.includes(profileId)) ? "Yes" : "No";
    } else {
        backupExists = allBackupKeys.length > 0 ? "Yes (orphaned)" : "No";
    }

    try {
        const totalSize = Object.values(localStorage).reduce((sum, v) => sum + new Blob([v]).size, 0);
        estimatedLocalStorageKB = `${(totalSize / 1024).toFixed(2)} KB`;
    } catch { /* ignore */ }

    // Storage Diagnostics: detailed breakdown of important entries
    const storageEntries: string[] = [];
    const entriesByType: Record<string, Array<{key: string, size: string, type: string}>> = {
        "CRM Profile": [],
        "Backup": [],
        "App State": [],
        "Finance": [],
        "Other": []
    };
    const importantPrefixes = ["chat-sender-", "ab-", "finance-"];
    for (const key of Object.keys(localStorage)) {
        const isImportant = importantPrefixes.some(p => key.startsWith(p));
        if (!isImportant) continue;

        let type = "Unknown";
        let size = "0 B";
        try {
            const val = localStorage.getItem(key) || "";
            size = `${new Blob([val]).size} B`;
            if (key.startsWith("chat-sender-") && !key.includes("backup")) type = "CRM Profile";
            else if (key.includes("backup")) type = "Backup";
            else if (key.startsWith("ab-")) type = "App State";
            else if (key.startsWith("finance-")) type = "Finance";
            else type = "Other";
        } catch { /* ignore */ }
        entriesByType[type].push({ key, size, type });
    }

    // Build readable output: numbered entries grouped by type
    let entryNum = 1;
    for (const [type, entries] of Object.entries(entriesByType)) {
        if (entries.length === 0) continue;
        storageEntries.push(`=== ${type} (${entries.length}) ===`);
        for (const e of entries) {
            storageEntries.push(`${entryNum++}. ${e.key} | ${e.size} | ${e.type}`);
        }
    }

    return {
        "localStorage Keys": String(storageKeys),
        "Profile Size": profileSize,
        "Backup Keys": backupKeys,
        "Quota Usage": quotaUsage,
        "Storage Adapter": info.storage,
        "Storage Version": String(info.storageVersion),
        // Userscript PROFILE fields
        "Detected profiles": detectedProfiles,
        "Selected profile": selectedProfile,
        "Storage key": storageKey,
        "Visible active profile": visibleProfileId ?? "Unavailable",
        "Profile resolution source": activeSource,
        "Profile resolution confidence": activeResolution.ok ? activeResolution.confidence : "NONE",
        "Profile mismatch": profileMismatch,
        "Profile size (json)": profileSize,
        "Backup exists": backupExists,
        "Estimated localStorage usage (KB)": estimatedLocalStorageKB,
        // Storage Diagnostics
        "Storage Entries": storageEntries.length > 0 ? storageEntries.join("\n") : "No important entries",
    };
}

/**
 * Collect runtime environment and system status
 */
function collectRuntimeData(): Record<string, string> {
    const info = collectDiagnostics();
    const profileKey = CrmService.findProfileKey();
    const profileData = profileKey ? CrmService.readProfile(profileKey) : null;

    const senderStopped = CrmService.isSenderStopped();
    const engineActive = profileData ? CrmService.isEngineActive(profileData) : false;

    const ibStatus = profileData ? String((profileData as any).status ?? "Unknown") : "N/A";
    const brStatus = profileData ? String((profileData as any).broadcast?.status ?? "Unknown") : "N/A";

    let health = "OK";
    if (!info.runtime.isTopFrame) health = "Iframe context";
    else if (engineActive) health = "Engine active";

    // Userscript HEALTH CHECK fields
    const profileValid = profileData ? CrmService.validateProfile(profileData) : false;
    const totalStorageSize = Object.values(localStorage).reduce((sum, v) => sum + new Blob([v]).size, 0);
    const isStorageOk = totalStorageSize < 5 * 1024 * 1024;

    // UI Hooks: determine if applicable on current page
    const startBtn = CrmService["findButton"]("start");
    const stopBtn = CrmService["findButton"]("stop");
    const uiHooksPresent = !!startBtn || !!stopBtn;

    // CRM page detection: check for GoldenBride CRM indicators
    // More reliable than text content: check URL or specific CRM elements
    const isCrmPage = (() => {
        try {
            const url = window.location.href;
            if (url.includes("goldenbride") || url.includes("crm") || url.includes("chat-sender")) return true;
            // Check for CRM-specific DOM elements
            if (document.querySelector("[data-crm], .crm-container, #chat-sender, .sender-panel")) return true;
        } catch { /* ignore */ }
        return false;
    })();

    let uiHooksStatus: string;
    if (uiHooksPresent) {
        uiHooksStatus = "Present";
    } else if (isCrmPage) {
        uiHooksStatus = "Missing";
    } else {
        uiHooksStatus = "Not applicable";
    }

    // Active profile resolution mismatch (RC-STABLE-003-FIX-003)
    const activeResolution = resolveActiveProfile();
    const visibleProfileId = activeResolution.ok ? activeResolution.profileId : null;
    const selectedId = profileKey ? profileKey.replace("chat-sender-", "") : null;
    const profileMismatch = !!(visibleProfileId && selectedId && visibleProfileId !== selectedId);

    // Overall health: Not applicable UI hooks should not trigger "Attention Required"
    const overallHealth = profileMismatch || !profileValid || (!uiHooksPresent && uiHooksStatus !== "Not applicable")
        ? "Attention Required"
        : "Healthy";

    return {
        "Modules": info.modules.join(", ") || "None",
        "Module Count": String(info.modules.length),
        "Environment": info.environment,
        "Top Frame": info.runtime.isTopFrame ? "Yes" : "No",
        "Extension": info.runtime.isExtension ? "Yes" : "No",
        "DevMode": info.runtime.devMode ? "Yes" : "No",
        "Ready State": info.runtime.readyState,
        "Sender Stopped": senderStopped ? "Yes" : "No",
        "Engine Active": engineActive ? "Yes" : "No",
        "IceBreaker Status": ibStatus,
        "Broadcast Status": brStatus,
        "Health": health,
        // Userscript HEALTH CHECK fields
        "Profile": profileValid ? "OK" : "Warning",
        "Storage": isStorageOk ? "OK" : "Warning",
        "UI Hooks": uiHooksStatus,
        "Overall": overallHealth,
    };
}

/**
 * Collect document and session state data
 */
function collectDomData(): Record<string, string> {
    const startBtn = CrmService["findButton"]("start");
    const stopBtn = CrmService["findButton"]("stop");

    const iframes = document.querySelectorAll("iframe");
    const iframeDetails = Array.from(iframes).slice(0, 5).map((f, i) => {
        const el = f as HTMLIFrameElement;
        return `#${i + 1}: ${el.src || "no src"} (${el.width || "?"}x${el.height || "?"})`;
    }).join("; ") || "None";

    // DOM metrics for userscript parity
    let accessibleIframes = 0;
    let blockedIframes = 0;
    iframes.forEach(f => {
        try { const _ = (f as HTMLIFrameElement).contentDocument; accessibleIframes++; } catch { blockedIframes++; }
    });
    const shadowRoots = document.querySelectorAll("*").length;
    const buttonsScanned = document.querySelectorAll("button").length;

    return {
        // Userscript RUNTIME fields (renamed)
        "Booster UI opened": document.querySelector(".ab-modal") ? "YES" : "NO",
        "START button": startBtn ? "FOUND" : "NOT FOUND",
        "STOP button": stopBtn ? "FOUND" : "NOT FOUND",
        // Original DOM fields
        "Dashboard Open": document.querySelector(".ab-modal") ? "Yes" : "No",
        "Sender Window": window === window.top ? "Top" : "Iframe",
        "Iframe Count": String(iframes.length),
        "Iframe Details": iframeDetails,
        "Start Button": startBtn ? "Found" : "Not found",
        "Stop Button": stopBtn ? (stopBtn.disabled ? "Disabled" : "Enabled") : "Not found",
        "Document Title": document.title || "Untitled",
        "Document ReadyState": document.readyState,
        // Userscript DOM fields
        "Accessible documents": "1",
        "Accessible iframes": String(accessibleIframes),
        "Blocked iframes": String(blockedIframes),
        "ShadowRoots": String(shadowRoots),
        "Buttons scanned": String(buttonsScanned),
    };
}

/**
 * Collect live CRM profile data from both IceBreaker and Broadcast
 */
function collectLiveReaderData(): Record<string, string> {
    const profileKey = CrmService.findProfileKey();
    const profileData = profileKey ? CrmService.readProfile(profileKey) : null;
    if (!profileData) {
        return { "Status": "No profile loaded" };
    }

    const p = profileData as any;
    const ibStatus = String(p.status ?? "Unknown");
    const brStatus = String(p.broadcast?.status ?? "Unknown");

    const ibMessages = p.messages;
    const ibDelay = ibMessages && typeof ibMessages === "object"
        ? (() => { const first = Object.values(ibMessages)[0] as Record<string, unknown> | undefined; return first?.intervalSeconds != null ? `${first.intervalSeconds} sec` : "N/A"; })()
        : "N/A";

    const brMessages = p.broadcast?.messages;
    const brDelay = brMessages && typeof brMessages === "object"
        ? (() => { const first = Object.values(brMessages)[0] as Record<string, unknown> | undefined; return first?.intervalSeconds != null ? `${first.intervalSeconds} sec` : "N/A"; })()
        : "N/A";

    const ibCpCount = p.chainProgress && typeof p.chainProgress === "object" ? String(Object.keys(p.chainProgress).length) : "0";
    const ibSended = typeof p.sended === "string" ? String(p.sended.split(";").filter(Boolean).length) : "0";
    const brCpCount = p.broadcast?.chainProgress && typeof p.broadcast.chainProgress === "object" ? String(Object.keys(p.broadcast.chainProgress).length) : "0";
    const brSended = typeof p.broadcast?.sended === "string" ? String(p.broadcast.sended.split(";").filter(Boolean).length) : "0";

    // Profile structure presence
    const hasMessages = p.messages ? "FOUND" : "NOT FOUND";
    const hasBroadcastMessages = p.broadcast?.messages ? "FOUND" : "NOT FOUND";
    const hasChainProgress = p.chainProgress ? "FOUND" : "NOT FOUND";
    const hasDelivered = p.delivered !== undefined ? "FOUND" : "NOT FOUND";
    const hasSended = p.sended !== undefined ? "FOUND" : "NOT FOUND";
    const hasBroadcast = p.broadcast ? "FOUND" : "NOT FOUND";

    const fields: Array<{ label: string; value: string; dataPath: string }> = [
        { label: "IceBreaker Status", value: ibStatus, dataPath: "status" },
        { label: "Broadcast Status", value: brStatus, dataPath: "broadcast.status" },
        { label: "Private Delay", value: ibDelay, dataPath: "messages.*.intervalSeconds" },
        { label: "Broadcast Delay", value: brDelay, dataPath: "broadcast.messages.*.intervalSeconds" },
        { label: "IceBreaker In Progress", value: ibCpCount, dataPath: "chainProgress" },
        { label: "IceBreaker Completed", value: ibSended, dataPath: "sended" },
        { label: "Broadcast In Progress", value: brCpCount, dataPath: "broadcast.chainProgress" },
        { label: "Broadcast Completed", value: brSended, dataPath: "broadcast.sended" },
    ];

    const result: Record<string, string> = {};
    for (const f of fields) {
        result[`${f.label} | value`] = f.value;
        result[`${f.label} | displayed`] = f.value;
        result[`${f.label} | source`] = "CrmService.readProfile()";
        result[`${f.label} | confidence`] = "HIGH";
        result[`${f.label} | dataPath`] = `chat-sender-*.${f.dataPath}`;
        result[`${f.label} | parseStatus`] = f.value !== "N/A" && f.value !== "Unknown" ? "OK" : "EMPTY";
    }

    // Userscript profile structure fields
    result["messages"] = hasMessages;
    result["broadcast.messages"] = hasBroadcastMessages;
    result["chainProgress"] = hasChainProgress;
    result["delivered"] = hasDelivered;
    result["sended"] = hasSended;
    result["broadcast"] = hasBroadcast;

    return result;
}

/**
 * Collect runtime detection and version information
 */
function collectRuntimeMapData(): Record<string, string> {
    const info = collectDiagnostics();

    // Determine actual source of version at runtime
    const versionSource = (() => {
        const v = getRuntimeEnvironment().getExtensionVersion();
        if (v !== "0.0.0") return `getRuntimeEnvironment().getExtensionVersion() [${v}]`;
        return "fallback (0.0.0)";
    })();

    // Determine actual source of environment at runtime
    const environmentSource = (() => {
        if (getRuntimeEnvironment().isExtension()) return "getRuntimeEnvironment().isExtension() (extension)";
        if (typeof GM_info !== "undefined" || typeof Tampermonkey !== "undefined") return "GM_info (userscript)";
        return "fallback (unknown)";
    })();

    // Determine actual source of storage at runtime
    const storageSource = (() => {
        if (getPlatform().chromeStorage) return "getPlatform().chromeStorage";
        return "localStorage";
    })();

    // Determine actual source of devMode at runtime
    const devModeSource = (() => {
        try {
            const hasDevFlag = StorageService.get(STORAGE_KEYS.DEV_MODE) !== null;
            if (hasDevFlag) return "localStorage[ab-dev] (active)";
            if (getPlatform().chromeStorage) return "getPlatform().chromeStorage[ab-dev] (inactive)";
            return "localStorage[ab-dev] (inactive)";
        } catch {
            return "unavailable";
        }
    })();

    // SYSTEM fields for userscript parity
    const timestamp = new Date().toISOString();
    const currentUrl = window.location.href;
    const browser = (() => {
        const m = navigator.userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
        return m ? `Chrome ${m[1]}` : "Other";
    })();
    const userAgent = navigator.userAgent;
    const viewport = `${window.innerWidth}x${window.innerHeight}`;

    return {
        "Version | value": info.version,
        "Version | source": versionSource,
        "Version | confidence": info.version !== "1.0.0" ? "HIGH" : "LOW (fallback)",
        "Environment | value": info.environment,
        "Environment | source": environmentSource,
        "Environment | confidence": info.environment !== "unknown" ? "HIGH" : "LOW (fallback)",
        "Storage Adapter | value": info.storage,
        "Storage Adapter | source": storageSource,
        "Storage Adapter | confidence": "HIGH",
        "Storage Schema | value": String(info.storageVersion),
        "Storage Schema | source": "StorageService.get(ab-storage-version)",
        "Storage Schema | confidence": "HIGH",
        "Modules | value": info.modules.join(", ") || "None",
        "Modules | source": `ModuleManager.getAll() [${info.modules.length}]`,
        "Modules | confidence": "HIGH",
        "TopFrame | value": info.runtime.isTopFrame ? "Yes" : "No",
        "TopFrame | source": "window === window.top",
        "TopFrame | confidence": "HIGH",
        "Extension | value": info.runtime.isExtension ? "Yes" : "No",
        "Extension | source": "getRuntimeEnvironment().isExtension()",
        "Extension | confidence": "HIGH",
        "DevMode | value": info.runtime.devMode ? "Yes" : "No",
        "DevMode | source": devModeSource,
        "DevMode | confidence": "HIGH",
        "ReadyState | value": info.runtime.readyState,
        "ReadyState | source": "document.readyState",
        "ReadyState | confidence": "HIGH",
        // Userscript SYSTEM fields
        "Timestamp": timestamp,
        "Current URL": currentUrl,
        "Browser": browser,
        "UserAgent": userAgent,
        "Viewport": viewport,
    };
}

/**
 * Collect reset history and statistics
 */
function collectResetData(): Record<string, string> {
    const profileKey = CrmService.findProfileKey();
    const profileData = profileKey ? CrmService.readProfile(profileKey) : null;

    const cpCount = profileData && typeof (profileData as any).chainProgress === "object"
        ? String(Object.keys((profileData as any).chainProgress).length) : "0";
    const sendedCount = typeof (profileData as any)?.sended === "string"
        ? String(((profileData as any).sended as string).split(";").filter(Boolean).length) : "0";
    const deliveredCount = typeof (profileData as any)?.delivered === "string"
        ? String(((profileData as any).delivered as string).split(";").filter(Boolean).length) : "0";
    const brSendedCount = typeof (profileData as any)?.broadcast?.sended === "string"
        ? String(((profileData as any).broadcast.sended as string).split(";").filter(Boolean).length) : "0";

    let lastReset = "Never";
    let resetType = "N/A";
    let resetDuration = "N/A";
    try {
        const raw = localStorage.getItem("ab-last-reset");
        if (raw) {
            const parsed = JSON.parse(raw);
            lastReset = parsed.timestamp || "Unknown";
            resetType = parsed.type || "Unknown";
            if (typeof parsed.durationMs === "number") {
                resetDuration = `${parsed.durationMs} ms`;
            }
        }
    } catch { /* ignore */ }

    // Determine why progress might be unavailable
    let iceBreakerCompletedReason = "Unknown";
    if (sendedCount !== "0") {
        iceBreakerCompletedReason = `${sendedCount} (Explicit Counter)`;
    } else if (!profileKey) {
        iceBreakerCompletedReason = "Profile missing";
    } else if (!profileData) {
        iceBreakerCompletedReason = "Profile unreadable";
    } else if (!(profileData as any).sended) {
        iceBreakerCompletedReason = "No completed messages";
    } else {
        iceBreakerCompletedReason = "Counter unavailable";
    }

    let broadcastCompletedReason = "Unknown";
    if (brSendedCount !== "0") {
        broadcastCompletedReason = `${brSendedCount} (Explicit Counter)`;
    } else if (!profileKey) {
        broadcastCompletedReason = "Profile missing";
    } else if (!profileData) {
        broadcastCompletedReason = "Profile unreadable";
    } else if (!(profileData as any).broadcast?.sended) {
        broadcastCompletedReason = "No completed messages";
    } else {
        broadcastCompletedReason = "Counter unavailable";
    }

    return {
        "Completed Count": sendedCount,
        "In-Progress Count": cpCount,
        "Delivered Count": deliveredCount,
        "Broadcast Completed": brSendedCount,
        "Last Reset": lastReset,
        "Reset Duration": resetDuration,
        "Reset Type": resetType,
        "IB Completed Reason": iceBreakerCompletedReason,
        "BR Completed Reason": broadcastCompletedReason,
    };
}

/**
 * Collect Finance module state data
 */
function collectFinanceData(): Record<string, string> {
    if (!financeController) {
        return { "Status": "FinanceController not initialized" };
    }
    const state = financeController.getState();
    const shiftDef = FinanceShift.getDefinition(state.shift);

    let txCount = "0";
    if (state.data?.list) {
        txCount = String(state.data.list.length);
    }

    const result: Record<string, string> = {
        "Status": state.status,
        "Current Shift": `${shiftDef.label} (${shiftDef.timeDisplay})`,
        "Date From": state.from.toISOString().split("T")[0],
        "Date To": state.to.toISOString().split("T")[0],
        "Transaction Count": txCount,
        "Subscriber Count": String(financeController.subscriberCount),
        "Is Loading": financeController.isLoading ? "Yes" : "No",
    };

    if (state.error) {
        result["Last Error"] = state.error;
    }
    if (state.data) {
        result["Has Data"] = "Yes";
        result["Data Total"] = String(state.data.total);
    } else {
        result["Has Data"] = "No";
    }

    return result;
}

/**
 * Collect error log (recent errors).
 */
function collectErrorLog(): Record<string, string> {
    const errors = getErrorHistory();
    if (errors.length === 0) {
        return {
            "Status": "Empty",
            "Entries": "0",
            "Capacity": "10",
        };
    }
    const result: Record<string, string> = {};
    // Show last 10 errors (most recent last)
    const recent = errors.slice(-10);
    recent.forEach((e, i) => {
        const idx = errors.length - recent.length + i + 1;
        result[`Error ${idx}`] = `${e.timestamp} | ${e.source || "unknown"} | ${e.message}`;
        if (e.stack) {
            result[`Error ${idx} Stack`] = e.stack.slice(0, 200);
        }
    });
    result["Total Errors"] = String(errors.length);
    return result;
}

/**
 * Collect full error history.
 */
function collectErrorHistory(): Record<string, string> {
    const errors = getErrorHistory();
    if (errors.length === 0) {
        return {
            "Status": "Empty",
            "Entries": "0",
            "Capacity": "Unlimited",
        };
    }
    const result: Record<string, string> = {};
    errors.forEach((e, i) => {
        result[`#${i + 1}`] = `${e.timestamp} | ${e.source || "unknown"} | ${e.message}`;
        if (e.stack) {
            result[`#${i + 1} Stack`] = e.stack.slice(0, 300);
        }
    });
    result["Total Errors"] = String(errors.length);
    return result;
}

/**
 * Collect import history.
 */
function collectImportHistory(): Record<string, string> {
    const imports = getImportHistory();
    if (imports.length === 0) {
        return {
            "Status": "Empty",
            "Entries": "0",
            "Capacity": "Unlimited",
        };
    }
    const result: Record<string, string> = {};
    imports.forEach((imp, i) => {
        // Legacy entries (without RC-STABLE-003 optional fields) keep the original format.
        if (imp.target === undefined) {
            result[`Import ${i + 1}`] = `${imp.timestamp} | ${imp.profileKey} | ${imp.importedCount} items | ${imp.result}`;
            return;
        }
        const targetLabel = imp.target === "icebreaker" ? "IceBreaker" : "Broadcast";
        result[`Import ${i + 1}`] = `${imp.timestamp} | ${imp.profileKey} | ${targetLabel} | ${imp.importedCount} items | ${imp.result} | key ${imp.storageKey ?? "-"} | lines ${imp.linesEntered ?? "-"} | unique ${imp.uniqueSnippets ?? "-"} | prev ${imp.previousMessageCount ?? "-"} | final ${imp.finalMessageCount ?? "-"} | dups ${imp.duplicatesSkipped ?? "-"}`;
    });
    result["Total Imports"] = String(imports.length);
    return result;
}

/**
 * Collect diagnostics data matching the original userscript structure.
 * This provides the exact sections and fields from the AgencyBooster userscript.
 * ADAPTER ONLY — composes verified collector outputs, no business logic.
 */
async function collectUserscriptDiagnostics(): Promise<Record<string, Record<string, string>>> {
     const info = collectDiagnostics();

     // Helper to create structured fallback for failed collectors
     const fallback = (collectorName: string, error: unknown): Record<string, string> => ({
         "Status": "Collector failed",
         "Error": error instanceof Error ? error.message : String(error),
         "Collector": collectorName,
     });

     // Compose data from existing collectors — each collector is isolated
     // so a failure in one does not blank the entire Diagnostics UI.
     let storageData: Record<string, string>;
     try { storageData = await collectStorageData(); }
     catch (e) { storageData = fallback("Storage", e); }

     let runtimeData: Record<string, string>;
     try { runtimeData = collectRuntimeData(); }
     catch (e) { runtimeData = fallback("Runtime", e); }

     let domData: Record<string, string>;
     try { domData = collectDomData(); }
     catch (e) { domData = fallback("DOM", e); }

     let liveReaderData: Record<string, string>;
     try { liveReaderData = collectLiveReaderData(); }
     catch (e) { liveReaderData = fallback("LiveReader", e); }

     let runtimeMapData: Record<string, string>;
     try { runtimeMapData = collectRuntimeMapData(); }
     catch (e) { runtimeMapData = fallback("RuntimeMap", e); }

     let resetData: Record<string, string>;
     try { resetData = collectResetData(); }
     catch (e) { resetData = fallback("Reset", e); }

     let errorLogData: Record<string, string>;
     try { errorLogData = collectErrorLog(); }
     catch (e) { errorLogData = fallback("ErrorLog", e); }

     let errorHistoryData: Record<string, string>;
     try { errorHistoryData = collectErrorHistory(); }
     catch (e) { errorHistoryData = fallback("ErrorHistory", e); }

     let importHistoryData: Record<string, string>;
     try { importHistoryData = collectImportHistory(); }
     catch (e) { importHistoryData = fallback("ImportHistory", e); }

// SYSTEM — concise summary (detailed runtime fields are in RUNTIME MAP)
      const systemSection: Record<string, string> = {
          "Script version": `v${info.version}`,
          "Environment": info.environment,
          "Extension": info.runtime.isExtension ? "Yes" : "No",
          "Top Frame": info.runtime.isTopFrame ? "Yes" : "No",
          "DevMode": info.runtime.devMode ? "Yes" : "No",
          "Storage Adapter": info.storage,
          "Storage Schema": String(info.storageVersion),
          "Modules": info.modules.join(", ") || "None",
      };

     // PROFILE — from storageData
     const profileSection: Record<string, string> = {
         "Detected profiles": storageData["Detected profiles"] ?? "None",
         "Selected profile": storageData["Selected profile"] ?? "Unknown",
         "Storage key": storageData["Storage key"] ?? "Unknown",
         "Visible active profile": storageData["Visible active profile"] ?? "Unavailable",
         "Profile resolution source": storageData["Profile resolution source"] ?? "Unavailable",
         "Profile resolution confidence": storageData["Profile resolution confidence"] ?? "NONE",
         "Profile mismatch": storageData["Profile mismatch"] ?? "Unknown",
         "Profile size": storageData["Profile Size"] ?? "0 KB",
         "Backup exists": storageData["Backup exists"] ?? "No",
         "Estimated localStorage usage": storageData["Estimated localStorage usage (KB)"] ?? "N/A",
     };

     // RUNTIME — from domData (format: YES/NO, FOUND/NOT FOUND)
     const runtimeSection: Record<string, string> = {
         "Booster UI opened": domData["Booster UI opened"] ?? "NO",
         "START button": domData["START button"] ?? "NOT FOUND",
         "STOP button": domData["STOP button"] ?? "NOT FOUND",
     };

     // PROFILE STRUCTURE — from liveReaderData
     const profileStructureSection: Record<string, string> = {
         "messages": liveReaderData["messages"] ?? "NOT FOUND",
         "broadcast.messages": liveReaderData["broadcast.messages"] ?? "NOT FOUND",
         "chainProgress": liveReaderData["chainProgress"] ?? "NOT FOUND",
         "delivered": liveReaderData["delivered"] ?? "NOT FOUND",
         "sended": liveReaderData["sended"] ?? "NOT FOUND",
         "broadcast": liveReaderData["broadcast"] ?? "NOT FOUND",
     };

// PROGRESS SOURCE — from resetData
      const progressSourceSection: Record<string, string> = {
          "IceBreaker completed": resetData["IB Completed Reason"] ?? "Unknown",
          "Broadcast completed": resetData["BR Completed Reason"] ?? "Unknown",
      };

     // RUNTIME MAP — from runtimeMapData (restored as standalone section)
     const runtimeMapSection: Record<string, string> = {};
     for (const [key, value] of Object.entries(runtimeMapData)) {
         runtimeMapSection[key] = value;
     }

// STORAGE — from runtimeData and resetData
      const storageSection: Record<string, string> = {
          "status": runtimeData["IceBreaker Status"] ?? "Profile missing",
          "broadcast.status": runtimeData["Broadcast Status"] ?? "Profile missing",
          "chainProgress size": resetData["In-Progress Count"] !== "0" ? `${resetData["In-Progress Count"]} items` : (resetData["In-Progress Count"] === "0" ? "0 items" : "Counter unavailable"),
          "delivered size": resetData["Delivered Count"] !== "0" ? `${resetData["Delivered Count"]} items` : (resetData["Delivered Count"] === "0" ? "0 items" : "Counter unavailable"),
          "sended size": resetData["Completed Count"] !== "0" ? `${resetData["Completed Count"]} items` : (resetData["Completed Count"] === "0" ? "0 items" : "Counter unavailable"),
      };

     // DOM — from domData
     const domSection: Record<string, string> = {
         "Accessible documents": "1",
         "Accessible iframes": domData["Accessible iframes"] ?? "0",
         "Blocked iframes": domData["Blocked iframes"] ?? "0",
         "ShadowRoots": domData["ShadowRoots"] ?? "0",
         "Buttons scanned": domData["Buttons scanned"] ?? "0",
     };

     // HEALTH CHECK — from runtimeData (new health fields)
     const healthCheckSection: Record<string, string> = {
         "Profile": runtimeData["Profile"] ?? "Unknown",
         "Storage": runtimeData["Storage"] ?? "Unknown",
         "UI Hooks": runtimeData["UI Hooks"] ?? "Unknown",
         "IceBreaker": runtimeData["IceBreaker Status"] ?? "Unknown",
         "Broadcast": runtimeData["Broadcast Status"] ?? "Unknown",
         "Overall": runtimeData["Overall"] ?? "Unknown",
     };

     // ERROR LOG — from errorLogData
     const errorLogSection: Record<string, string> = errorLogData;

     // ERROR HISTORY — from errorHistoryData
     const errorHistorySection: Record<string, string> = errorHistoryData;

     // IMPORT HISTORY — from importHistoryData
     const importHistorySection: Record<string, string> = importHistoryData;

     return {
         "SYSTEM": systemSection,
         "PROFILE": profileSection,
         "RUNTIME": runtimeSection,
         "PROFILE STRUCTURE": profileStructureSection,
         "PROGRESS SOURCE": progressSourceSection,
         "RUNTIME MAP": runtimeMapSection,
         "STORAGE": storageSection,
         "DOM": domSection,
         "HEALTH CHECK": healthCheckSection,
         "ERROR LOG": errorLogSection,
         "ERROR HISTORY": errorHistorySection,
         "IMPORT HISTORY": importHistorySection,
     };
 }

function generateReport(groups: Record<string, Record<string, string>>): string {
    const lines: string[] = [];
    lines.push("=== Companion — Diagnostics Report ===");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push("");

    for (const [groupName, groupData] of Object.entries(groups)) {
        lines.push(`--- ${groupName} ---`);
        for (const [key, value] of Object.entries(groupData)) {
            lines.push(`  ${key}: ${value}`);
        }
        lines.push("");
    }

    return lines.join("\n");
}

function generateJson(groups: Record<string, Record<string, string>>): string {
    return JSON.stringify({
        generated: new Date().toISOString(),
        groups,
    }, null, 2);
}

function generateDebugBundle(groups: Record<string, Record<string, string>>): string {
    const report = generateReport(groups);
    const json = generateJson(groups);

    const extras: string[] = [];
    extras.push("--- Navigator ---");
    extras.push(`  userAgent: ${navigator.userAgent}`);
    extras.push(`  platform: ${navigator.platform}`);
    extras.push(`  language: ${navigator.language}`);
    extras.push(`  cookieEnabled: ${navigator.cookieEnabled}`);
    extras.push(`  onLine: ${navigator.onLine}`);
    extras.push(`  hardwareConcurrency: ${navigator.hardwareConcurrency}`);
    extras.push("");

    extras.push("--- localStorage Keys ---");
    try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            extras.push(`  ${key}`);
        }
    } catch { extras.push("  (access denied)"); }
    extras.push("");

    extras.push("--- Performance ---");
    try {
        const perf = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (perf) {
            extras.push(`  domContentLoaded: ${Math.round(perf.domContentLoadedEventEnd)}ms`);
            extras.push(`  loadComplete: ${Math.round(perf.loadEventEnd)}ms`);
        }
    } catch { extras.push("  (unavailable)"); }

    return [
        report,
        "",
        "=== JSON Data ===",
        json,
        "",
        "=== Debug Extras ===",
        extras.join("\n"),
    ].join("\n");
}

async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch { /* fallback below */ }

    try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        textarea.remove();
        return ok;
    } catch {
        return false;
    }
}

async function copyDebugBundle(): Promise<boolean> {
    const groups = await collectUserscriptDiagnostics();
    const bundle = generateDebugBundle(groups);
    return copyToClipboard(bundle);
}

export {
    collectStorageData,
    collectRuntimeData,
    collectDomData,
    collectLiveReaderData,
    collectRuntimeMapData,
    collectResetData,
    collectFinanceData,
    collectUserscriptDiagnostics,
    generateReport,
    generateJson,
    generateDebugBundle,
    copyToClipboard,
    copyDebugBundle,
};