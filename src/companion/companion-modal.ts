/**
 * CompanionModal
 *
 * The original Companion window: overlay + modal + tabs (Dashboard | Manager | Diagnostics).
 * Restored from b44e683 — the last userscript commit.
 *
 * This is NOT a CompanionWindow (draggable panel). It is a modal overlay
 * that matches the original AgencyBooster UX exactly.
 *
 * Responsibilities:
 *   - Create/destroy overlay + modal DOM
 *   - Tab switching with localStorage persistence
 *   - Render Dashboard (status cards), Manager (action buttons), Diagnostics (runtime table)
 *   - Close on ESC, overlay click, or X button
 */

import { STORAGE_KEYS } from "./storage-keys";
import { StorageService } from "./storage-service";
import { collectDiagnostics } from "./companion-diagnostics";
import { CrmService } from "./crm-service";
import { FinanceController } from "./finance-controller";
import { FinanceShift } from "./finance-shift";
import { diag } from "./dev";
import { COMPANION_MODAL_CSS } from "./companion-modal.css";
import { COMPANION_LOGO_DATA_URI } from "./brand-logo";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_TABS = ["dashboard", "manager", "diagnostics"] as const;
type TabName = (typeof VALID_TABS)[number];

const COMPANION_VERSION = "v2.0.0";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let modalOverlay: HTMLElement | null = null;
let modalStylesInjected = false;
let dashboardInterval: ReturnType<typeof setInterval> | null = null;
let financeController: FinanceController | null = null;

// ---------------------------------------------------------------------------
// Style injection
// ---------------------------------------------------------------------------

function injectStyles(): void {
    if (modalStylesInjected) return;
    modalStylesInjected = true;
    const style = document.createElement("style");
    style.id = "ab-modal-styles";
    style.textContent = COMPANION_MODAL_CSS;
    document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Tab persistence
// ---------------------------------------------------------------------------

function readTab(): string {
    try {
        return localStorage.getItem(STORAGE_KEYS.COMPANION_ACTIVE_TAB) ?? "dashboard";
    } catch {
        return "dashboard";
    }
}

function writeTab(tab: string): void {
    try {
        localStorage.setItem(STORAGE_KEYS.COMPANION_ACTIVE_TAB, tab);
    } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Dashboard — reads localStorage for live CRM status
// ---------------------------------------------------------------------------

const CRM_STORAGE_PREFIX = "chat-sender-";

interface DashboardField {
    label: string;
    path: string;
}

const DASHBOARD_FIELDS: DashboardField[] = [
    { label: "IceBreaker Status", path: "data.status" },
    { label: "Broadcast Status", path: "data.broadcast.status" },
    { label: "Private Delay", path: "data.messages" },
    { label: "Broadcast Delay", path: "data.broadcast.messages" },
    { label: "IceBreaker In Progress", path: "data.chainProgress" },
    { label: "IceBreaker Completed", path: "data.sended" },
    { label: "Broadcast In Progress", path: "data.broadcast.chainProgress" },
    { label: "Broadcast Completed", path: "data.broadcast.sended" },
];

function readCRMData(): Record<string, unknown> | null {
    try {
        const keys = Object.keys(localStorage);
        const dataKey = keys.find((k) => k.startsWith(CRM_STORAGE_PREFIX) && k !== "chat-sender-" && !k.includes("backup"));
        if (!dataKey) return null;
        const raw = localStorage.getItem(dataKey);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function resolveField(data: Record<string, unknown>, field: DashboardField): string {
    try {
        if (field.path === "data.status") {
            return String((data as any)?.status ?? "Unknown");
        }
        if (field.path === "data.broadcast.status") {
            return String((data as any)?.broadcast?.status ?? "Unknown");
        }
        if (field.path === "data.messages") {
            const msgs = (data as any)?.messages;
            if (msgs && typeof msgs === "object") {
                const first = Object.values(msgs as Record<string, unknown>)[0] as Record<string, unknown> | undefined;
                return first?.intervalSeconds != null ? `${first.intervalSeconds} sec` : "N/A";
            }
            return "N/A";
        }
        if (field.path === "data.broadcast.messages") {
            const bmsgs = (data as any)?.broadcast?.messages;
            if (bmsgs && typeof bmsgs === "object") {
                const first = Object.values(bmsgs as Record<string, unknown>)[0] as Record<string, unknown> | undefined;
                return first?.intervalSeconds != null ? `${first.intervalSeconds} sec` : "N/A";
            }
            return "N/A";
        }
        if (field.path === "data.chainProgress") {
            const cp = (data as any)?.chainProgress;
            return cp && typeof cp === "object" ? String(Object.keys(cp).length) : "0";
        }
        if (field.path === "data.sended") {
            const s = (data as any)?.sended;
            return typeof s === "string" ? String(s.split(";").filter(Boolean).length) : "0";
        }
        if (field.path === "data.broadcast.chainProgress") {
            const cp = (data as any)?.broadcast?.chainProgress;
            return cp && typeof cp === "object" ? String(Object.keys(cp).length) : "0";
        }
        if (field.path === "data.broadcast.sended") {
            const s = (data as any)?.broadcast?.sended;
            return typeof s === "string" ? String(s.split(";").filter(Boolean).length) : "0";
        }
        return "N/A";
    } catch {
        return "N/A";
    }
}

function renderDashboard(container: HTMLElement): void {
    container.innerHTML = "";
    const data = readCRMData();

    if (!data) {
        const empty = document.createElement("div");
        empty.className = "ab-empty";
        empty.textContent = "No CRM data found. Start IceBreaker or Broadcast to see live status.";
        container.appendChild(empty);
        return;
    }

    const grid = document.createElement("div");
    grid.className = "ab-grid";

    for (const field of DASHBOARD_FIELDS) {
        const card = document.createElement("div");
        card.className = "ab-card";

        const label = document.createElement("div");
        label.className = "ab-card-title";
        label.textContent = field.label;

        const value = document.createElement("div");
        value.className = "ab-card-value";
        value.textContent = resolveField(data, field);

        card.appendChild(label);
        card.appendChild(value);
        grid.appendChild(card);
    }

    container.appendChild(grid);
}

function updateDashboard(): void {
    const container = document.getElementById("ab-view-dashboard");
    if (container && container.style.display !== "none") {
        renderDashboard(container);
    }
}

// ---------------------------------------------------------------------------
// Manager — action buttons
// ---------------------------------------------------------------------------

function renderManager(container: HTMLElement, onFinanceClick: () => void): void {
    container.innerHTML = "";

    const hint = document.createElement("div");
    hint.style.textAlign = "center";
    hint.style.color = "var(--ab-text-dim)";
    hint.style.fontSize = "13px";
    hint.style.marginBottom = "8px";
    hint.textContent = "Execute core operations safely. State will be backed up automatically before changes.";
    container.appendChild(hint);

    // Reset IceBreaker
    const resetBtn = document.createElement("button");
    resetBtn.className = "ab-btn";
    resetBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg> Reset IceBreaker`;
    resetBtn.addEventListener("click", async () => {
        const key = CrmService.findProfileKey();
        if (!key) { await showAlert("No CRM profile found."); return; }
        const data = CrmService.readProfile(key);
        if (!data || !CrmService.validateProfile(data)) { await showAlert("Invalid profile structure."); return; }
        if (!await CrmService.stopSenderSafely()) {
            if (!await showConfirm("Stop verification failed. Force continue?")) return;
        }
        CrmService.resetIceBreaker(data);
        CrmService.writeProfile(key, data);
        try { localStorage.setItem("ab-last-reset", JSON.stringify({ timestamp: new Date().toISOString(), type: "resetIceBreaker", profileKey: key })); } catch { /* ignore */ }
        await showAlert("IceBreaker reset successfully. Reloading...");
        window.location.reload();
    });
    container.appendChild(resetBtn);

    // New Shift
    const newShiftBtn = document.createElement("button");
    newShiftBtn.className = "ab-btn danger";
    newShiftBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4ZM6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V8H6V19Z"/></svg> New Shift`;
    newShiftBtn.addEventListener("click", async () => {
        const key = CrmService.findProfileKey();
        if (!key) { await showAlert("No CRM profile found."); return; }
        const data = CrmService.readProfile(key);
        if (!data || !CrmService.validateProfile(data)) { await showAlert("Invalid profile structure."); return; }
        if (!await CrmService.stopSenderSafely()) {
            if (!await showConfirm("Stop verification failed. Force continue?")) return;
        }
        CrmService.newShift(data);
        CrmService.writeProfile(key, data);
        await showAlert("New Shift started. Reloading...");
        window.location.reload();
    });
    container.appendChild(newShiftBtn);

    // Divider
    container.appendChild(createDivider());

    // Change Delays
    const delaysBtn = document.createElement("button");
    delaysBtn.className = "ab-btn primary";
    delaysBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> Change Delays`;
    delaysBtn.addEventListener("click", async () => {
        const key = CrmService.findProfileKey();
        if (!key) { await showAlert("No CRM profile found."); return; }
        const data = CrmService.readProfile(key);
        if (!data || !CrmService.validateProfile(data)) { await showAlert("Invalid profile structure."); return; }
        if (CrmService.isEngineActive(data)) {
            await showAlert("Please stop IceBreaker and Broadcast before changing delays.");
            return;
        }
        if (!await CrmService.stopSenderSafely()) {
            if (!await showConfirm("Stop verification failed. Force continue?")) return;
        }
        const delays = await showDelayModal();
        if (!delays) return;
        CrmService.applyDelays(data, delays.priv, delays.broad);
        CrmService.writeProfile(key, data);
        await showAlert("Delays successfully updated and verified.");
    });
    container.appendChild(delaysBtn);

    // Divider
    container.appendChild(createDivider());

    // Import Snippets (hidden file input)
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".txt";
    fileInput.style.display = "none";
    fileInput.id = "ab-file-import";
    container.appendChild(fileInput);

    const importBtn = document.createElement("button");
    importBtn.className = "ab-btn";
    importBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg> Import Snippets`;
    importBtn.addEventListener("click", () => fileInput.click());
    container.appendChild(importBtn);

    // Divider
    container.appendChild(createDivider());

    // Finance Widget button — calls FinanceModule.open() via module manager
    const financeBtn = document.createElement("button");
    financeBtn.className = "ab-btn";
    financeBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg> Finance Widget`;
    financeBtn.addEventListener("click", onFinanceClick);
    container.appendChild(financeBtn);
}

function createDivider(): HTMLDivElement {
    const div = document.createElement("div");
    div.style.borderTop = "1px solid var(--ab-border)";
    div.style.margin = "8px 0";
    return div;
}

// ---------------------------------------------------------------------------
// Dialog helpers — overlay-based alerts, confirms, input modals
// ---------------------------------------------------------------------------

function createDialogOverlay(): HTMLElement {
    injectStyles();
    const overlay = document.createElement("div");
    overlay.className = "ab-overlay";
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("visible"));
    return overlay;
}

function closeDialogOverlay(overlay: HTMLElement): void {
    overlay.classList.remove("visible");
    setTimeout(() => overlay.remove(), 150);
}

function showAlert(msgHtml: string): Promise<void> {
    return new Promise((resolve) => {
        const overlay = createDialogOverlay();
        overlay.innerHTML = `
            <div class="ab-modal small">
                <div class="ab-header">
                    <h2>Attention</h2>
                </div>
                <div class="ab-content" style="text-align: center; font-size: 14px; line-height: 1.5;">
                    ${msgHtml}
                </div>
                <div class="ab-content" style="padding-top: 0;">
                    <button class="ab-btn primary" id="ab-alert-ok">OK</button>
                </div>
            </div>
        `;
        document.getElementById("ab-alert-ok")!.onclick = () => {
            closeDialogOverlay(overlay);
            resolve();
        };
    });
}

function showConfirm(msgHtml: string): Promise<boolean> {
    return new Promise((resolve) => {
        const overlay = createDialogOverlay();
        overlay.innerHTML = `
            <div class="ab-modal small">
                <div class="ab-header">
                    <h2>Confirm Action</h2>
                </div>
                <div class="ab-content" style="text-align: center; font-size: 14px; line-height: 1.5;">
                    ${msgHtml}
                </div>
                <div class="ab-content" style="padding-top: 0; display:flex; gap:10px;">
                    <button class="ab-btn primary" id="ab-confirm-yes">Yes</button>
                    <button class="ab-btn" id="ab-confirm-no">No</button>
                </div>
            </div>
        `;
        document.getElementById("ab-confirm-yes")!.onclick = () => {
            closeDialogOverlay(overlay);
            resolve(true);
        };
        document.getElementById("ab-confirm-no")!.onclick = () => {
            closeDialogOverlay(overlay);
            resolve(false);
        };
    });
}

function showDelayModal(): Promise<{ priv: number; broad: number } | null> {
    return new Promise((resolve) => {
        const overlay = createDialogOverlay();
        overlay.innerHTML = `
            <div class="ab-modal small">
                <div class="ab-header">
                    <h2>Change Delays</h2>
                </div>
                <div class="ab-content">
                    <div class="ab-input-group">
                        <label>Private Delay (seconds)</label>
                        <input type="number" id="ab-delay-priv" value="65">
                    </div>
                    <div class="ab-input-group">
                        <label>Broadcast Delay (seconds)</label>
                        <input type="number" id="ab-delay-broad" value="65">
                    </div>
                    <div class="ab-row" style="margin-top: 4px;">
                        <button class="ab-btn primary" id="ab-delay-apply">Apply</button>
                        <button class="ab-btn" id="ab-delay-cancel">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById("ab-delay-apply")!.onclick = () => {
            const priv = parseInt((document.getElementById("ab-delay-priv") as HTMLInputElement).value, 10);
            const broad = parseInt((document.getElementById("ab-delay-broad") as HTMLInputElement).value, 10);
            if (isNaN(priv) || isNaN(broad)) {
                showAlert("Invalid numeric value.");
                return;
            }
            closeDialogOverlay(overlay);
            resolve({ priv, broad });
        };
        document.getElementById("ab-delay-cancel")!.onclick = () => {
            closeDialogOverlay(overlay);
            resolve(null);
        };
    });
}

// ---------------------------------------------------------------------------
// Diagnostics — data collectors
//
// TECHNICAL DEBT: These collectors (collect*Data, generate*, copyToClipboard)
// should be extracted to a dedicated companion-diagnostics-collectors module.
// companion-modal.ts currently owns modal, dashboard, manager, dialogs,
// diagnostics rendering, report generation, and clipboard operations.
// Extraction would improve separation of concerns and testability.
// ---------------------------------------------------------------------------

/** Set the FinanceController reference for diagnostics. Called by bootstrap. */
export function setFinanceController(controller: FinanceController): void {
    financeController = controller;
}

async function collectStorageData(): Promise<Record<string, string>> {
    const info = collectDiagnostics();
    let storageKeys = 0;
    let profileSize = "0 KB";
    let backupKeys = "None";
    let quotaUsage = "N/A";

    try { storageKeys = localStorage.length; } catch { /* ignore */ }

    const profileKey = CrmService.findProfileKey();
    if (profileKey) {
        const raw = localStorage.getItem(profileKey);
        if (raw) {
            try { profileSize = `${(new Blob([raw]).size / 1024).toFixed(2)} KB`; } catch { /* ignore */ }
        }
    }

    const backups = Object.keys(localStorage).filter(k => k.includes("backup"));
    backupKeys = backups.length > 0 ? `${backups.length} (${backups.slice(0, 3).join(", ")}${backups.length > 3 ? "..." : ""})` : "None";

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

    return {
        "localStorage Keys": String(storageKeys),
        "Profile Size": profileSize,
        "Backup Keys": backupKeys,
        "Quota Usage": quotaUsage,
        "Storage Adapter": info.storage,
        "Storage Version": String(info.storageVersion),
    };
}

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

    return {
        "Modules": info.modules.join(", ") || "None",
        "Module Count": String(info.modules.length),
        "Environment": info.environment,
        "Top Frame": info.runtime.isTopFrame ? "Yes" : "No",
        "Extension": info.runtime.isExtension ? "Yes" : "No",
        "Dev Mode": info.runtime.devMode ? "Yes" : "No",
        "Ready State": info.runtime.readyState,
        "Sender Stopped": senderStopped ? "Yes" : "No",
        "Engine Active": engineActive ? "Yes" : "No",
        "IceBreaker Status": ibStatus,
        "Broadcast Status": brStatus,
        "Health": health,
    };
}

function collectDomData(): Record<string, string> {
    const startBtn = CrmService["findButton"]("start");
    const stopBtn = CrmService["findButton"]("stop");

    const iframes = document.querySelectorAll("iframe");
    const iframeDetails = Array.from(iframes).slice(0, 5).map((f, i) => {
        const el = f as HTMLIFrameElement;
        return `#${i + 1}: ${el.src || "no src"} (${el.width || "?"}x${el.height || "?"})`;
    }).join("; ") || "None";

    return {
        "Dashboard Open": document.querySelector(".ab-modal") ? "Yes" : "No",
        "Sender Window": window === window.top ? "Top" : "Iframe",
        "Iframe Count": String(iframes.length),
        "Iframe Details": iframeDetails,
        "Start Button": startBtn ? "Found" : "Not found",
        "Stop Button": stopBtn ? (stopBtn.disabled ? "Disabled" : "Enabled") : "Not found",
        "Document Title": document.title || "Untitled",
        "Document ReadyState": document.readyState,
    };
}

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
    return result;
}

function collectRuntimeMapData(): Record<string, string> {
    const info = collectDiagnostics();

    // Determine actual source of version at runtime
    const versionSource = (() => {
        try {
            if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
                return "chrome.runtime.getManifest()";
            }
        } catch { /* not available */ }
        return "fallback (1.0.0)";
    })();

    // Determine actual source of environment at runtime
    const environmentSource = (() => {
        if (typeof chrome !== "undefined" && chrome.runtime?.id) return "chrome.runtime.id (extension)";
        if (typeof GM_info !== "undefined" || typeof Tampermonkey !== "undefined") return "GM_info (userscript)";
        return "fallback (unknown)";
    })();

    // Determine actual source of storage at runtime
    const storageSource = (() => {
        if (typeof chrome !== "undefined" && chrome.storage?.local) return "chrome.storage.local";
        return "localStorage";
    })();

    // Determine actual source of devMode at runtime
    const devModeSource = (() => {
        try {
            const hasDevFlag = StorageService.get(STORAGE_KEYS.DEV_MODE) !== null;
            if (hasDevFlag) return "localStorage[ab-dev] (active)";
            if (typeof chrome !== "undefined" && chrome.storage?.local) return "chrome.storage.local[ab-dev] (inactive)";
            return "localStorage[ab-dev] (inactive)";
        } catch {
            return "unavailable";
        }
    })();

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
        "Extension | source": "chrome.runtime.id",
        "Extension | confidence": "HIGH",
        "DevMode | value": info.runtime.devMode ? "Yes" : "No",
        "DevMode | source": devModeSource,
        "DevMode | confidence": "HIGH",
        "ReadyState | value": info.runtime.readyState,
        "ReadyState | source": "document.readyState",
        "ReadyState | confidence": "HIGH",
    };
}

function collectResetData(): Record<string, string> {
    const profileKey = CrmService.findProfileKey();
    const profileData = profileKey ? CrmService.readProfile(profileKey) : null;

    const cpCount = profileData && typeof (profileData as any).chainProgress === "object"
        ? String(Object.keys((profileData as any).chainProgress).length) : "0";
    const sendedCount = typeof (profileData as any)?.sended === "string"
        ? String(((profileData as any).sended as string).split(";").filter(Boolean).length) : "0";
    const deliveredCount = typeof (profileData as any)?.delivered === "string"
        ? String(((profileData as any).delivered as string).split(";").filter(Boolean).length) : "0";

    let lastReset = "Never";
    let resetType = "N/A";
    try {
        const raw = localStorage.getItem("ab-last-reset");
        if (raw) {
            const parsed = JSON.parse(raw);
            lastReset = parsed.timestamp || "Unknown";
            resetType = parsed.type || "Unknown";
        }
    } catch { /* ignore */ }

    return {
        "Completed Count": sendedCount,
        "In-Progress Count": cpCount,
        "Delivered Count": deliveredCount,
        "Last Reset": lastReset,
        "Reset Duration": "N/A (not tracked)",
        "Reset Type": resetType,
    };
}

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

// ---------------------------------------------------------------------------
// Diagnostics — action buttons (Copy Report, Copy JSON, Copy Debug Bundle)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Diagnostics — runtime diagnostics table
// ---------------------------------------------------------------------------

async function renderDiagnostics(container: HTMLElement): Promise<void> {
    container.innerHTML = "";
    const info = collectDiagnostics();

    // Profile data
    const profileKey = CrmService.findProfileKey();
    const profileData = profileKey ? CrmService.readProfile(profileKey) : null;
    const profileValid = profileData ? CrmService.validateProfile(profileData) : false;

    const groups: Record<string, Record<string, string>> = {
        "SYSTEM": {
            "Version": info.version,
            "Browser": (() => { const m = navigator.userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/); return m ? `Chrome ${m[1]}` : "Other"; })(),
            "URL": window.location.href,
            "Timestamp": new Date().toISOString(),
            "UserAgent": navigator.userAgent,
            "Viewport": `${window.innerWidth}x${window.innerHeight}`,
            "Platform": navigator.platform || "Unknown",
            "Cookie Enabled": navigator.cookieEnabled ? "Yes" : "No",
            "Online": navigator.onLine ? "Yes" : "No",
        },
        "PROFILE": {
            "Profile Key": profileKey || "Not found",
            "Profile ID": profileKey ? profileKey.replace("chat-sender-", "") : "Unknown",
            "Valid": profileValid ? "Yes" : "No",
            "Status (raw)": profileData ? String((profileData as any).status ?? "Unknown") : "N/A",
            "Broadcast Status (raw)": profileData ? String((profileData as any).broadcast?.status ?? "Unknown") : "N/A",
            "Chain Progress Entries": profileData ? String(Object.keys((profileData as any).chainProgress ?? {}).length) : "0",
            "Sended Entries": profileData ? String(((profileData as any).sended ?? "").split(";").filter(Boolean).length) : "0",
            "Delivered Entries": profileData ? String(((profileData as any).delivered ?? "").split(";").filter(Boolean).length) : "0",
            "Private Messages": profileData ? String(Object.keys((profileData as any).messages ?? {}).length) : "0",
            "Broadcast Messages": profileData ? String(Object.keys((profileData as any).broadcast?.messages ?? {}).length) : "0",
        },
        "STORAGE": await collectStorageData(),
        "RUNTIME": collectRuntimeData(),
        "DOM": collectDomData(),
        "LIVE READER": collectLiveReaderData(),
        "RUNTIME MAP": collectRuntimeMapData(),
        "RESET": collectResetData(),
        "IMPORT HISTORY": {
            "Status": "Unavailable — SnippetImporter not yet migrated",
        },
        "FINANCE": collectFinanceData(),
        "ERROR LOG": {
            "Status": "Unavailable — Logger not yet migrated",
        },
        "ERROR HISTORY": {
            "Status": "Unavailable — Logger not yet migrated",
        },
    };

    // Action buttons
    const actionsBar = document.createElement("div");
    actionsBar.style.display = "flex";
    actionsBar.style.gap = "8px";
    actionsBar.style.marginBottom = "12px";
    actionsBar.style.flexWrap = "wrap";

    const copyReportBtn = document.createElement("button");
    copyReportBtn.className = "ab-btn";
    copyReportBtn.textContent = "Copy Report";
    copyReportBtn.addEventListener("click", async () => {
        const text = generateReport(groups);
        const ok = await copyToClipboard(text);
        await showAlert(ok ? "Report copied to clipboard." : "Failed to copy. Check console.");
    });

    const copyJsonBtn = document.createElement("button");
    copyJsonBtn.className = "ab-btn";
    copyJsonBtn.textContent = "Copy JSON";
    copyJsonBtn.addEventListener("click", async () => {
        const text = generateJson(groups);
        const ok = await copyToClipboard(text);
        await showAlert(ok ? "JSON copied to clipboard." : "Failed to copy. Check console.");
    });

    const copyBundleBtn = document.createElement("button");
    copyBundleBtn.className = "ab-btn";
    copyBundleBtn.textContent = "Copy Debug Bundle";
    copyBundleBtn.addEventListener("click", async () => {
        const text = generateDebugBundle(groups);
        const ok = await copyToClipboard(text);
        await showAlert(ok ? "Debug bundle copied to clipboard." : "Failed to copy. Check console.");
    });

    actionsBar.appendChild(copyReportBtn);
    actionsBar.appendChild(copyJsonBtn);
    actionsBar.appendChild(copyBundleBtn);
    container.appendChild(actionsBar);

    // Render sections
    for (const [groupName, groupData] of Object.entries(groups)) {
        const group = document.createElement("div");
        group.className = "ab-diag-group";

        const heading = document.createElement("h3");
        heading.textContent = groupName;
        group.appendChild(heading);

        const table = document.createElement("table");
        table.className = "ab-table";
        const tbody = document.createElement("tbody");

        for (const [key, value] of Object.entries(groupData)) {
            const tr = document.createElement("tr");
            const tdKey = document.createElement("td");
            tdKey.textContent = key;
            const tdVal = document.createElement("td");
            tdVal.textContent = value;
            tr.appendChild(tdKey);
            tr.appendChild(tdVal);
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        group.appendChild(table);
        container.appendChild(group);
    }
}

// ---------------------------------------------------------------------------
// Close handlers
// ---------------------------------------------------------------------------

function handleClose(): void {
    hide();
}

function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") handleClose();
}

function onOverlayClick(e: MouseEvent): void {
    if (e.target === modalOverlay) handleClose();
}

// ---------------------------------------------------------------------------
// Show / Hide
// ---------------------------------------------------------------------------

function show(onFinanceClick: () => void): void {
    if (modalOverlay) return;

    injectStyles();

    const overlay = document.createElement("div");
    overlay.className = "ab-overlay";
    overlay.id = "ab-overlay";
    overlay.innerHTML = `
        <div class="ab-modal large">
            <div class="ab-header">
                <div class="ab-header-brand">
                    <img class="ab-header-logo" src="${COMPANION_LOGO_DATA_URI}" alt="" />
                    <span class="ab-header-title">Companion</span>
                </div>
                <div class="ab-header-right">
                    <span class="ab-header-version">${COMPANION_VERSION}</span>
                    <div class="ab-close-icon" id="ab-main-close">
                        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </div>
                </div>
            </div>
            <div class="ab-tabs">
                <div class="ab-tab" data-target="dashboard">Dashboard</div>
                <div class="ab-tab" data-target="manager">Manager</div>
                <div class="ab-tab" data-target="diagnostics">Diagnostics</div>
            </div>
            <div id="ab-view-dashboard" class="ab-content" style="display:none;"></div>
            <div id="ab-view-manager" class="ab-content" style="display:none;"></div>
            <div id="ab-view-diagnostics" class="ab-content" style="display:none;"></div>
        </div>
    `;

    document.body.appendChild(overlay);
    modalOverlay = overlay;

    // Close button
    document.getElementById("ab-main-close")?.addEventListener("click", handleClose);

    // ESC key
    document.addEventListener("keydown", onKeyDown);

    // Overlay click
    overlay.addEventListener("click", onOverlayClick);

    // Tab switching
    const tabs = overlay.querySelectorAll(".ab-tab");
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const target = tab.getAttribute("data-target") as TabName | null;
            if (!target || !VALID_TABS.includes(target)) return;

            tabs.forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");

            for (const view of VALID_TABS) {
                const el = document.getElementById(`ab-view-${view}`);
                if (el) el.style.display = "none";
            }

            const targetEl = document.getElementById(`ab-view-${target}`);
            if (targetEl) targetEl.style.display = "flex";

            writeTab(target);

            // Render content for the selected tab
            if (target === "dashboard") updateDashboard();
            if (target === "manager") {
                const managerEl = document.getElementById("ab-view-manager");
                if (managerEl) renderManager(managerEl, onFinanceClick);
            }
            if (target === "diagnostics") {
                const diagEl = document.getElementById("ab-view-diagnostics");
                if (diagEl) void renderDiagnostics(diagEl);
            }
        });
    });

    // Restore saved tab
    const savedTab = readTab();
    const initialTab = VALID_TABS.includes(savedTab as TabName) ? (savedTab as TabName) : "dashboard";
    const initialTabEl = overlay.querySelector(`.ab-tab[data-target="${initialTab}"]`);
    if (initialTabEl) initialTabEl.classList.add("active");
    const initialView = document.getElementById(`ab-view-${initialTab}`);
    if (initialView) initialView.style.display = "flex";

    // Render initial content
    if (initialTab === "dashboard") updateDashboard();
    if (initialTab === "manager") {
        const managerEl = document.getElementById("ab-view-manager");
        if (managerEl) renderManager(managerEl, onFinanceClick);
    }
    if (initialTab === "diagnostics") {
        const diagEl = document.getElementById("ab-view-diagnostics");
        if (diagEl) void renderDiagnostics(diagEl);
    }

    // Fade in
    requestAnimationFrame(() => overlay.classList.add("visible"));

    // Dashboard auto-refresh
    dashboardInterval = setInterval(updateDashboard, 5000);

    diag("CompanionModal shown");

    // Notify listeners of visibility change
    CompanionModal.getInstance().onVisibilityChange?.();
}

function hide(): void {
    if (!modalOverlay) return;

    // Stop dashboard refresh
    if (dashboardInterval) {
        clearInterval(dashboardInterval);
        dashboardInterval = null;
    }

    // Remove event listeners
    document.removeEventListener("keydown", onKeyDown);

    // Fade out
    modalOverlay.classList.remove("visible");
    const overlay = modalOverlay;
    setTimeout(() => overlay?.remove(), 150);
    modalOverlay = null;

    diag("CompanionModal hidden");

    // Notify listeners of visibility change
    CompanionModal.getInstance().onVisibilityChange?.();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class CompanionModal {
    private static instance: CompanionModal | null = null;
    private onFinanceClick: (() => void) | null = null;
    private onVisibilityChange: (() => void) | null = null;

    static getInstance(): CompanionModal {
        if (!CompanionModal.instance) {
            CompanionModal.instance = new CompanionModal();
        }
        return CompanionModal.instance;
    }

    /** Set the callback for the Finance Widget button in Manager. */
    setFinanceClickHandler(handler: () => void): void {
        this.onFinanceClick = handler;
    }

    /** Set the callback for visibility changes (show/hide). */
    setOnVisibilityChange(callback: (() => void) | null): void {
        this.onVisibilityChange = callback;
    }

    /** Show the Companion modal. */
    show(): void {
        show(this.onFinanceClick ?? (() => {}));
    }

    /** Hide the Companion modal. */
    hide(): void {
        hide();
    }

    /** Toggle the Companion modal. */
    toggle(): void {
        if (modalOverlay) {
            hide();
        } else {
            this.show();
        }
    }

    /** Whether the modal is currently visible. */
    get isVisible(): boolean {
        return modalOverlay !== null;
    }
}
