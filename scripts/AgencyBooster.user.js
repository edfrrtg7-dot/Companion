// ==UserScript==
// @name         AgencyBooster Manager
// @namespace    http://tampermonkey.net/
// @version      1.6.2
// @description  Enterprise-grade management utility for AgencyBooster. Runtime mapping, reset system, dashboard recovery.
// @author       Senior Staff JavaScript Engineer
// @match        https://goldenbride.net/*
// @grant        none
// ==/UserScript==

(() => {
    "use strict";

    // 1. SINGLETON & IFRAME GUARDS
    if (window !== window.top) return;
    if (window.__AB_MANAGER_INITIALIZED__) return;
    window.__AB_MANAGER_INITIALIZED__ = true;

    // 2. CONFIGURATION (NO MAGIC NUMBERS ANYWHERE ELSE)
    const CONFIG = {
        DEBUG: false,
        DEBUG_FINANCE: false,
        MAX_WAIT_MS: 5000,
        POLL_INTERVAL_MS: 250,
        BUTTON_POLL_MS: 2000,
        DASHBOARD_POLL_MS: 1000,
        REQUIRED_STOP_TICKS: 4,
        STORAGE_PREFIX: "chat-sender-",
        BACKUP_PREFIX: "agencybooster-backup-",
        DEFAULT_DELAY: 65,
        BUTTON_SIZE_PX: 64,
        MODAL_Z_INDEX: 2147483647,
        OVERLAY_Z_INDEX_BASE: 2147483648,
        TOAST_TIMEOUT_MS: 3000,
        ANIMATION_MS: 300,
        MAX_STORAGE_WARNING_BYTES: 4000000,
        BYTES_PER_KB: 1024,
        SNAPSHOT_VERSION: "1.0",
            DIAGNOSTICS_VERSION: "1.6.2",
        DELAY_PROPERTIES: ["intervalSeconds", "delay", "interval", "timeout", "seconds"],
        SELECTORS: {
            START: "start",
            STOP: "stop"
        },
        TEXT: {
            UNKNOWN: "Unknown",
            NOT_AVAILABLE: "Not Available",
            STOP_REQUIRED: "Please stop IceBreaker and Broadcast before changing delays.",
            CONFIRM_FORCE: "Stop verification failed. Force continue?",
            INVALID_PROFILE: "Invalid profile structure.",
            STORAGE_FULL: "Operation failed: localStorage is fully occupied.",
            OP_FAILED: "Operation failed. State rolled back.",
            IMPORT_EMPTY: "Error: No valid snippets found.",
            FILE_READ_ERROR: "Failed to read the file.",
            BACKUP_FAILED: "Backup failed: storage is full. Old backups were removed, but there is still not enough space.",
            IMPORT_CANCELLED: "Import cancelled. No changes were made.",
            IMPORT_UNSUPPORTED: "Unsupported file type. Please select a .txt file."
        },
        FINANCE_STORAGE_PREFIX: "agencybooster-finance-",
        FINANCE_WIDGET_SIZE: { WIDTH: 280, COLLAPSED_HEIGHT: 40, EXPANDED_HEIGHT: 300 },
        RUNTIME_MAP: {
            ibStatus:     { label: "IceBreaker Status",    provider: "localStorage", objectPath: "data.status",                          confidence: "high" },
            brStatus:     { label: "Broadcast Status",     provider: "localStorage", objectPath: "data.broadcast.status",                confidence: "high" },
            privDelay:    { label: "Private Delay",        provider: "localStorage", objectPath: "data.messages[id].intervalSeconds",     confidence: "high" },
            broadDelay:   { label: "Broadcast Delay",      provider: "localStorage", objectPath: "data.broadcast.messages[id].intervalSeconds", confidence: "high" },
            ibInProgress: { label: "IceBreaker InProgress", provider: "localStorage", objectPath: "Object.keys(data.chainProgress).length", confidence: "high" },
            ibCompleted:  { label: "IceBreaker Completed",  provider: "localStorage", objectPath: "data.sended.split(';').filter(Boolean).length", confidence: "high" },
            brInProgress: { label: "Broadcast InProgress",  provider: "localStorage", objectPath: "Object.keys(data.broadcast.chainProgress).length", confidence: "high" },
            brCompleted:  { label: "Broadcast Completed",   provider: "localStorage", objectPath: "data.broadcast.sended.split(';').filter(Boolean).length", confidence: "high" },
            startBtn:     { label: "Start Button",          provider: "DOM",          selector: "button[id*='start'], input[value*='start']", confidence: "high" },
            stopBtn:      { label: "Stop Button",           provider: "DOM",          selector: "button[id*='stop'], input[value*='stop']",  confidence: "high" },
            credits:      { label: "Credits",               provider: "DOM",          selector: "finance_pending_identification",           confidence: "pending" },
            transactions: { label: "Transactions",          provider: "DOM",          selector: "finance_pending_identification",           confidence: "pending" }
        }
    };

    // 3. MODULES WITH STRICT PUBLIC APIS

    const Logger = {
        _recentErrors: [],
        _maxErrors: 20,
        info: (msg, data = "") => {
            if (CONFIG.DEBUG) console.log(`[AgencyBooster:INFO] ${msg}`, data);
        },
        warn: (msg, data = "") => {
            if (CONFIG.DEBUG) console.warn(`[AgencyBooster:WARN] ${msg}`, data);
        },
        error: (msg, e = "") => {
            const detail = e instanceof Error ? e.message : String(e);
            console.error(`[AgencyBooster:ERROR] ${msg}`, detail);
            Logger._recentErrors.push({
                timestamp: new Date().toISOString(),
                message: msg,
                detail: detail
            });
            if (Logger._recentErrors.length > Logger._maxErrors) {
                Logger._recentErrors.shift();
            }
        },
        getRecentErrors: () => [...Logger._recentErrors]
    };

    const Utils = {
        sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        deepClone: (obj) => JSON.parse(JSON.stringify(obj)),
        getCurrentURL: () => window.location.href,
        getTimestamp: () => new Date().toISOString()
    };

    const Validator = {
        isValidProfile: (data) => {
            if (!data || typeof data !== "object" || Array.isArray(data)) return false;
            return "status" in data && "chainProgress" in data;
        }
    };

    const StorageManager = {
        getProfileKey: (id) => `${CONFIG.STORAGE_PREFIX}${id}`,
        getBackupKey: (id) => `${CONFIG.BACKUP_PREFIX}${id}`,
        getAllProfiles: () => {
            try {
                return Object.keys(localStorage).filter(k => 
                    new RegExp(`^${CONFIG.STORAGE_PREFIX}\\d+$`).test(k)
                );
            } catch (e) {
                Logger.error("Failed reading localStorage keys", e);
                return [];
            }
        },
        readProfile: (key) => {
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                Logger.error(`Read error on key: ${key}`, e);
                return null;
            }
        },
        writeProfile: (key, data) => {
            try {
                localStorage.setItem(key, JSON.stringify(data));
                return true;
            } catch (e) {
                Logger.error(`Write error on key: ${key}`, e);
                if (e.name === "QuotaExceededError") {
                    CustomUI.showAlert(CONFIG.TEXT.STORAGE_FULL);
                }
                return false;
            }
        },
        verifyWrite: (key, expected) => {
            const actual = StorageManager.readProfile(key);
            return JSON.stringify(actual) === JSON.stringify(expected);
        },
        createBackup: (profileKey, data) => {
            const id = profileKey.replace(CONFIG.STORAGE_PREFIX, "");
            const backupKey = StorageManager.getBackupKey(id);
            try {
                localStorage.setItem(backupKey, JSON.stringify(data));
                return true;
            } catch (e) {
                Logger.error(`Failed to create backup: ${backupKey}`, e);
                if (e.name === "QuotaExceededError") {
                    Logger.info("Storage full. Removing old backups to free space.");
                    const backupKeys = StorageManager.collectBackupKeys(backupKey);
                    for (const key of backupKeys) {
                        try {
                            localStorage.removeItem(key);
                            Logger.info(`Removed old backup: ${key}`);
                        } catch (removeErr) {
                            Logger.warn(`Failed to remove backup key: ${key}`, removeErr);
                            continue;
                        }
                        try {
                            localStorage.setItem(backupKey, JSON.stringify(data));
                            return true;
                        } catch (retryErr) {
                            Logger.warn(`Backup still failed after removing: ${key}`);
                        }
                    }
                    CustomUI.showAlert(CONFIG.TEXT.BACKUP_FAILED);
                    return false;
                }
                return false;
            }
        },
        rollback: (profileKey, id) => {
            const backupKey = StorageManager.getBackupKey(id);
            try {
                const backupRaw = localStorage.getItem(backupKey);
                if (backupRaw) {
                    localStorage.setItem(profileKey, backupRaw);
                }
            } catch (e) {
                Logger.error(`Rollback critical failure for profile: ${profileKey}`, e);
            }
        },
        runTransaction: async (profileKey, operationFn) => {
            const originalData = StorageManager.readProfile(profileKey);
            if (!originalData) return false;

            const id = profileKey.replace(CONFIG.STORAGE_PREFIX, "");
            if (!StorageManager.createBackup(profileKey, originalData)) return false;

            const backupKey = StorageManager.getBackupKey(id);
            const backupData = StorageManager.readProfile(backupKey);
            if (JSON.stringify(backupData) !== JSON.stringify(originalData)) return false;

            try {
                const mutatedData = Utils.deepClone(originalData);
                const success = await operationFn(mutatedData);
                if (!success) return false;

                if (!StorageManager.writeProfile(profileKey, mutatedData)) throw new Error("Local storage write failed.");
                if (!StorageManager.verifyWrite(profileKey, mutatedData)) throw new Error("Post-write verification failed.");

                return true;
            } catch (e) {
                Logger.error(`Transaction execution exception on ${profileKey}. Reverting...`, e);
                StorageManager.rollback(profileKey, id);
                return false;
            }
        },
        calculateTotalUsage: () => {
            let total = 0;
            try {
                for(let i = 0; i < localStorage.length; i++) {
                    total += (localStorage.getItem(localStorage.key(i)) || "").length;
                }
            } catch(e) {}
            return total;
        },
        collectBackupKeys: (currentBackupKey) => {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CONFIG.BACKUP_PREFIX)) {
                    keys.push({ key, index: i });
                }
            }
            keys.sort((a, b) => {
                if (a.key === currentBackupKey) return -1;
                if (b.key === currentBackupKey) return 1;
                return a.index - b.index;
            });
            return keys.map(k => k.key);
        }
    };

    const DOMManager = {
        getAccessibleDocuments: (win, visited = new Set()) => {
            if (!win || visited.has(win)) return [];
            visited.add(win);
            const docs = [];
            try {
                if (win.document) docs.push(win.document);
            } catch {
                return docs;
            }
            try {
                const iframes = win.document.querySelectorAll("iframe");
                iframes.forEach(f => {
                    try {
                        if (f.contentWindow) {
                            docs.push(...DOMManager.getAccessibleDocuments(f.contentWindow, visited));
                        }
                    } catch {}
                });
            } catch (e) {
                Logger.warn("Error accessing frame elements", e);
            }
            return docs;
        },
        findButton: (targetId) => {
            const documents = DOMManager.getAccessibleDocuments(window);
            const lowerTarget = targetId.toLowerCase();
            for (const doc of documents) {
                try {
                    const elements = Array.from(doc.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']"));
                    for (const el of elements) {
                        const labelText = (el.textContent || el.value || el.innerText || el.getAttribute("aria-label") || "").trim().toLowerCase();
                        if (labelText === lowerTarget) {
                            return { button: el, document: doc };
                        }
                    }
                } catch {}
            }
            return null;
        },
        removeElements: (selector) => {
            const existing = document.querySelectorAll(selector);
            existing.forEach(el => el.remove());
        },
        appendBody: (element) => {
            document.body.appendChild(element);
        }
    };

    const DOMScanner = {
        scanDOMMetrics: () => {
            const docs = DOMManager.getAccessibleDocuments(window);
            let accessibleIframesCount = 0;
            let blockedIframesCount = 0;
            let shadowRootsCount = 0;
            let totalButtonsCount = 0;

            try {
                docs.forEach(doc => {
                    const iframes = doc.querySelectorAll("iframe");
                    iframes.forEach(f => {
                        try {
                            if (f.contentWindow && f.contentWindow.document) accessibleIframesCount++;
                            else blockedIframesCount++;
                        } catch (e) {
                            blockedIframesCount++;
                        }
                    });

                    const buttons = doc.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']");
                    totalButtonsCount += buttons.length;

                    const walker = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_ELEMENT);
                    let node = walker.nextNode();
                    while (node) {
                        if (node.shadowRoot) shadowRootsCount++;
                        node = walker.nextNode();
                    }
                });
            } catch (e) {
                Logger.warn("Error scanning DOM metrics", e);
            }

            return {
                docsCount: docs.length,
                accessibleIframes: accessibleIframesCount,
                blockedIframes: blockedIframesCount,
                shadowRoots: shadowRootsCount,
                buttonsScanned: totalButtonsCount
            };
        }
    };

    const SenderManager = {
        isStopped: () => {
            const startBtn = DOMManager.findButton(CONFIG.SELECTORS.START);
            const stopBtn = DOMManager.findButton(CONFIG.SELECTORS.STOP);
            const startExists = !!startBtn;
            const stopDisabled = !!(stopBtn && (stopBtn.button.disabled || stopBtn.button.getAttribute("disabled") !== null || stopBtn.button.classList.contains("disabled")));
            const stopDisappeared = !stopBtn;
            return startExists || stopDisabled || stopDisappeared;
        },
        stopSenderSafely: async () => {
            const stopBtn = DOMManager.findButton(CONFIG.SELECTORS.STOP);
            if (!stopBtn) return true;
            if (stopBtn.button.disabled || stopBtn.button.getAttribute("disabled") !== null) return true;
            
            try {
                stopBtn.button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
                stopBtn.button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
                stopBtn.button.click();
            } catch (e) {
                Logger.error("Failed to click stopper control", e);
                return false;
            }

            const startLimit = Date.now();
            let checkTicks = 0;
            while (Date.now() - startLimit < CONFIG.MAX_WAIT_MS) {
                if (SenderManager.isStopped()) {
                    checkTicks++;
                    if (checkTicks >= CONFIG.REQUIRED_STOP_TICKS) return true;
                } else {
                    checkTicks = 0;
                }
                await Utils.sleep(CONFIG.POLL_INTERVAL_MS);
            }
            return false;
        }
    };

    const StateManager = {
        getModuleStatus: (data, moduleType) => {
            if (!data) return CONFIG.TEXT.UNKNOWN;
            const statusRaw = moduleType === 'broadcast' ? data.broadcast?.status : data.status;
            if (!statusRaw) return CONFIG.TEXT.UNKNOWN;
            
            const s = statusRaw.toString().toLowerCase();
            if (s === "stopped") return "Stopped";
            if (s === "progress") return "Progress";
            if (s === "running") return "Running";
            if (s === "paused") return "Paused";
            return CONFIG.TEXT.UNKNOWN;
        },
        getExactCount: (data, key) => {
            if (data && data[key] !== undefined && typeof data[key] === 'number') {
                return data[key];
            }
            return CONFIG.TEXT.UNKNOWN;
        },
        getDelayValue: (data, moduleType) => {
            const target = moduleType === 'broadcast' ? data.broadcast?.messages : data.messages;
            const delayProp = DelayManager.detectDelayProperty(target);
            if (!target || !delayProp) return CONFIG.TEXT.UNKNOWN;

            const items = Object.values(target).filter(v => v && typeof v === "object");
            if (items.length === 0) return CONFIG.TEXT.UNKNOWN;

            const nonZero = items.map(v => v[delayProp]).filter(v => typeof v === "number" && v > 0);
            if (nonZero.length > 0) {
                const freq = {};
                nonZero.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
                return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0] * 1;
            }

            const first = items[0][delayProp];
            return typeof first === "number" ? first : CONFIG.TEXT.UNKNOWN;
        },
        getInProgressCount: (data, moduleType) => {
            if (!data) return 0;
            if (moduleType === "broadcast") {
                return data.broadcast?.chainProgress ? Object.keys(data.broadcast.chainProgress).length : 0;
            }
            return data.chainProgress ? Object.keys(data.chainProgress).length : 0;
        },
        getCompletedCount: (data, moduleType) => {
            if (!data) return 0;
            if (moduleType === "broadcast") {
                const raw = data.broadcast?.sended || "";
                return raw.split(';').filter(Boolean).length;
            }
            const raw = data.sended || "";
            return raw.split(';').filter(Boolean).length;
        },
        isEngineActive: (status) => {
            return status === "Running" || status === "Progress" || status === "Paused";
        }
    };

    const ResetManager = {
        _lastReset: null,
        _lastResetType: null,
        _lastResetDuration: null,

        resetIceBreaker: (data) => {
            const startTime = performance.now();
            const chain = data.chainProgress || {};
            const privateIds = new Set();
            const cleanChain = {};
            if (typeof chain === "object" && !Array.isArray(chain)) {
                for (const [id, value] of Object.entries(chain)) {
                    if (value && value.channel === "private") {
                        privateIds.add(id);
                    } else if (value) {
                        cleanChain[id] = value;
                    }
                }
            }
            data.chainProgress = cleanChain;
            if (data.sended) {
                data.sended = data.sended.split(';').filter(id => id && !privateIds.has(id)).join(';');
            }
            if ("delivered" in data) {
                data.delivered = "";
            }
            data.status = "stopped";
            const duration = Math.round(performance.now() - startTime);
            ResetManager._lastReset = Utils.getTimestamp();
            ResetManager._lastResetType = "icebreaker";
            ResetManager._lastResetDuration = duration;
            return true;
        },

        resetBroadcast: (data) => {
            const startTime = performance.now();
            if (data.broadcast && typeof data.broadcast === "object") {
                data.broadcast.chainProgress = {};
                data.broadcast.sended = "";
                data.broadcast.status = "stopped";
            }
            const duration = Math.round(performance.now() - startTime);
            ResetManager._lastReset = Utils.getTimestamp();
            ResetManager._lastResetType = "broadcast";
            ResetManager._lastResetDuration = duration;
            return true;
        },

        newShift: (data) => {
            const startTime = performance.now();
            data.chainProgress = {};
            data.sended = "";
            data.delivered = "";
            data.status = "stopped";
            if (data.broadcast && typeof data.broadcast === "object") {
                data.broadcast.chainProgress = {};
                data.broadcast.sended = "";
                data.broadcast.status = "stopped";
            }
            const duration = Math.round(performance.now() - startTime);
            ResetManager._lastReset = Utils.getTimestamp();
            ResetManager._lastResetType = "new_shift";
            ResetManager._lastResetDuration = duration;
            return true;
        },

        getResetStats(data) {
            const chainSize = data.chainProgress ? Object.keys(data.chainProgress).length : 0;
            const deliveredCount = data.delivered ? data.delivered.split(';').filter(Boolean).length : 0;
            const sendedCount = data.sended ? data.sended.split(';').filter(Boolean).length : 0;
            return {
                completedCount: sendedCount,
                inProgressCount: chainSize,
                deliveredCount: deliveredCount,
                lastReset: ResetManager._lastReset,
                lastResetType: ResetManager._lastResetType,
                lastResetDuration: ResetManager._lastResetDuration
            };
        }
    };

    const DelayManager = {
        detectDelayProperty: (messages) => {
            if (!messages || typeof messages !== "object") return null;
            const collection = Object.values(messages);
            for (const item of collection) {
                if (item && typeof item === "object") {
                    const match = CONFIG.DELAY_PROPERTIES.find(p => p in item);
                    if (match) return match;
                }
            }
            return null;
        },
        applyPropertyUpdates: (messages, delayValue) => {
            if (!messages || typeof messages !== "object") return;
            const property = DelayManager.detectDelayProperty(messages);
            if (!property) return;
            
            const items = Object.values(messages);
            items.forEach((item, index) => {
                if (item && typeof item === "object") {
                    item[property] = index === 0 ? 0 : delayValue;
                }
            });
        },
        applyDelays: (data, privDelay, broadDelay) => {
            DelayManager.applyPropertyUpdates(data.messages, privDelay);
            if (data.broadcast && data.broadcast.messages) {
                DelayManager.applyPropertyUpdates(data.broadcast.messages, broadDelay);
            }
            return true;
        }
    };

    const SnippetManager = {
        parseText: (rawText) => {
            const lines = rawText.split(/\r?\n/);
            const result = { private: [], broadcast: [] };
            let currentSection = "private";
            
            for (let line of lines) {
                line = line.trim();
                if (!line) continue;
                
                const upper = line.toUpperCase();
                if (upper === "# PRIVATE") {
                    currentSection = "private";
                    continue;
                }
                if (upper === "# BROADCAST") {
                    currentSection = "broadcast";
                    continue;
                }
                
                result[currentSection].push(line);
            }
            return result;
        },

        detectTextProperty: (messages) => {
            if (!messages || typeof messages !== "object") return "text";
            const items = Object.values(messages);
            if (items.length === 0) return "text";
            const first = items[0];
            
            if (first && typeof first === "object") {
                for (const key in first) {
                    if (typeof first[key] === "string" && !CONFIG.DELAY_PROPERTIES.includes(key)) {
                        return key;
                    }
                }
            }
            return "text";
        },

        buildMessages: (snippets, existingMessages, delayVal) => {
            if (!snippets || snippets.length === 0) return existingMessages;
            
            const newMessages = {};
            const textProp = SnippetManager.detectTextProperty(existingMessages);
            const delayProp = DelayManager.detectDelayProperty(existingMessages) || "intervalSeconds";
            
            let template = {};
            if (existingMessages && typeof existingMessages === "object") {
                const vals = Object.values(existingMessages);
                if (vals.length > 0 && typeof vals[0] === "object") {
                    template = vals[0];
                }
            }

            snippets.forEach((snippet, index) => {
                const msgId = (index + 1).toString();
                if (template && Object.keys(template).length > 0) {
                    const msgObj = Utils.deepClone(template);
                    msgObj[textProp] = snippet;
                    msgObj[delayProp] = (index === 0) ? 0 : delayVal;
                    newMessages[msgId] = msgObj;
                } else {
                    newMessages[msgId] = {
                        [textProp]: snippet,
                        [delayProp]: (index === 0) ? 0 : delayVal
                    };
                }
            });
            
            return newMessages;
        }
    };

    const SnippetImporter = {
        _importHistory: [],
        _maxHistory: 10,

        detectFileType: (fileName) => {
            if (!fileName) return "unknown";
            const ext = fileName.split(".").pop().toLowerCase();
            if (ext === "txt") return "txt";
            return "unknown";
        },

        parseFile: (rawText) => {
            return SnippetManager.parseText(rawText);
        },

        buildPreview: (parsed, existingData) => {
            const existingPrivCount = existingData?.messages ? Object.keys(existingData.messages).length : 0;
            const existingBroadCount = existingData?.broadcast?.messages ? Object.keys(existingData.broadcast.messages).length : 0;
            return {
                totalParsed: parsed.private.length + parsed.broadcast.length,
                privateCount: parsed.private.length,
                broadcastCount: parsed.broadcast.length,
                existingPrivateCount: existingPrivCount,
                existingBroadcastCount: existingBroadCount
            };
        },

        recordImport: (stats) => {
            SnippetImporter._importHistory.push({
                timestamp: Utils.getTimestamp(),
                imported: stats.imported,
                duplicates: 0,
                invalid: stats.invalid || 0,
                status: stats.status
            });
            if (SnippetImporter._importHistory.length > SnippetImporter._maxHistory) {
                SnippetImporter._importHistory.shift();
            }
        },

        getImportHistory: () => [...SnippetImporter._importHistory],

        executeImport: async (profileKey, parsed) => {
            const privSnippets = parsed.private;
            const broadSnippets = parsed.broadcast;
            const totalToImport = privSnippets.length + broadSnippets.length;
            if (totalToImport === 0) return { imported: 0, invalid: 0, status: "nothing_to_import" };

            const ok = await StorageManager.runTransaction(profileKey, async (data) => {
                if (privSnippets.length > 0) {
                    const privDelay = StateManager.getDelayValue(data, "icebreaker");
                    const dVal = privDelay !== CONFIG.TEXT.UNKNOWN ? privDelay : CONFIG.DEFAULT_DELAY;
                    data.messages = SnippetManager.buildMessages(privSnippets, {}, dVal);
                }
                if (broadSnippets.length > 0) {
                    if (!data.broadcast) data.broadcast = {};
                    const brDelay = StateManager.getDelayValue(data, "broadcast");
                    const dVal = brDelay !== CONFIG.TEXT.UNKNOWN ? brDelay : CONFIG.DEFAULT_DELAY;
                    data.broadcast.messages = SnippetManager.buildMessages(broadSnippets, {}, dVal);
                }
                return true;
            });

            const imported = ok ? totalToImport : 0;
            return {
                imported,
                invalid: 0,
                status: ok ? "success" : "failed"
            };
        }
    };

    const FinanceManager = {
        _cache: null,
        _debugLog: [],

        _debugEntry(type, data) {
            if (!CONFIG.DEBUG_FINANCE) return;
            this._debugLog.push({ ts: Utils.getTimestamp(), type, ...data });
            if (this._debugLog.length > 100) this._debugLog.shift();
        },

        getDebugLog() {
            return [...this._debugLog];
        },

        clearDebugLog() {
            this._debugLog = [];
        },
        _SHIFT_KEY: "agencybooster-finance-shift",

        _read(key) {
            try {
                const raw = localStorage.getItem(CONFIG.FINANCE_STORAGE_PREFIX + key);
                return raw ? JSON.parse(raw) : null;
            } catch { return null; }
        },

        _write(key, value) {
            try {
                localStorage.setItem(CONFIG.FINANCE_STORAGE_PREFIX + key, JSON.stringify(value));
                return true;
            } catch { return false; }
        },

        getDefaultState() {
            return {
                x: null,
                y: null,
                collapsed: false,
                closed: false,
                lastRefresh: null,
                lastDuration: null,
                lastStatus: null,
                credits: null,
                transactions: [],
                parseMethod: null,
                failureReason: null
            };
        },

        readState() {
            return this._read("widget-state") || this.getDefaultState();
        },

        writeState(state) {
            return this._write("widget-state", state);
        },

        getShiftPeriod() {
            try {
                const raw = localStorage.getItem(this._SHIFT_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch { return null; }
        },

        setShiftPeriod(start, end) {
            try {
                localStorage.setItem(this._SHIFT_KEY, JSON.stringify({ start, end }));
                return true;
            } catch { return false; }
        },

        clearShiftPeriod() {
            try {
                localStorage.removeItem(this._SHIFT_KEY);
                return true;
            } catch { return false; }
        },

        async fetchFinanceData(docs) {
            const startTime = performance.now();
            try {
                const result = FinanceManager.parseFinanceFromDocs(docs);
                const duration = Math.round(performance.now() - startTime);
                const state = FinanceManager.readState();
                state.credits = result.credits;
                state.transactions = result.transactions;
                state.parseMethod = result.parseMethod;
                state.failureReason = result.failureReason;
                state.lastRefresh = Utils.getTimestamp();
                state.lastDuration = duration;
                state.lastStatus = (result.credits !== null || result.transactions.length > 0) ? "ok" : "no_data";
                FinanceManager.writeState(state);
                FinanceManager._cache = state;
                return state;
            } catch (e) {
                const duration = Math.round(performance.now() - startTime);
                const state = FinanceManager.readState();
                state.lastRefresh = Utils.getTimestamp();
                state.lastDuration = duration;
                state.lastStatus = "error";
                state.failureReason = e.message || String(e);
                FinanceManager.writeState(state);
                FinanceManager._cache = state;
                Logger.error("FinanceWidget: fetch failed", e);
                return state;
            }
        },

        parseFinanceFromDocs(docs) {
            let credits = null;
            let transactions = [];
            let parseMethod = "none";
            let failureReason = null;

            FinanceManager.clearDebugLog();
            FinanceManager._debugEntry("scan_start", { docCount: docs.length });

            try {
                const result = FinanceManager._parseStructuredTable(docs);
                FinanceManager._debugEntry("structured_result", { credits: result.credits, txCount: result.transactions.length });
                if (result.credits !== null || result.transactions.length > 0) {
                    credits = result.credits;
                    transactions = result.transactions;
                    parseMethod = "structured";
                }
            } catch (e) { failureReason = "structured: " + e.message; FinanceManager._debugEntry("structured_error", { error: e.message }); }

            if (parseMethod === "none") {
                try {
                    const result = FinanceManager._parseDOMSelectors(docs);
                    FinanceManager._debugEntry("dom_result", { credits: result.credits, txCount: result.transactions.length });
                    if (result.credits !== null || result.transactions.length > 0) {
                        credits = result.credits;
                        transactions = result.transactions;
                        parseMethod = "dom";
                    }
                } catch (e) { failureReason = "dom: " + e.message; FinanceManager._debugEntry("dom_error", { error: e.message }); }
            }

            if (parseMethod === "none") {
                try {
                    const result = FinanceManager._parseTextFallback(docs);
                    FinanceManager._debugEntry("text_result", { credits: result.credits });
                    if (result.credits !== null) {
                        credits = result.credits;
                        parseMethod = "text";
                    }
                } catch (e) { failureReason = "text: " + e.message; FinanceManager._debugEntry("text_error", { error: e.message }); }
            }

            FinanceManager._debugEntry("scan_complete", { credits, txCount: transactions.length, parseMethod, failureReason });

            const shift = FinanceManager.getShiftPeriod();
            if (shift && shift.start && shift.end && transactions.length > 0) {
                transactions = FinanceManager._filterByShiftPeriod(transactions, shift);
            }

            transactions = transactions.slice(-5);

            return { credits, transactions, parseMethod, failureReason };
        },

        _parseStructuredTable(docs) {
            let credits = null;
            const transactions = [];

            for (const doc of docs) {
                try {
                    if (credits === null) {
                        const creditEl = doc.querySelector("[class*='credit'], [class*='balance'], [data-field='credits'], [data-field='balance']");
                        if (creditEl) {
                            const raw = (creditEl.textContent || "").trim();
                            const num = parseFloat(raw.replace(/[^\d.\-]/g, ""));
                            FinanceManager._debugEntry("structured_credit_found", { tag: creditEl.tagName, class: creditEl.className, raw, parsed: num });
                            if (!isNaN(num)) credits = num;
                        } else {
                            FinanceManager._debugEntry("structured_credit_miss", { docUrl: doc.location?.href || "unknown" });
                        }
                    }

                    const tables = doc.querySelectorAll("table");
                    FinanceManager._debugEntry("structured_tables", { count: tables.length });
                    for (const table of tables) {
                        const rows = table.querySelectorAll("tbody tr");
                        FinanceManager._debugEntry("structured_table_rows", { rows: rows.length, cols: rows[0] ? rows[0].querySelectorAll("td").length : 0 });
                        for (const row of rows) {
                            const cells = row.querySelectorAll("td");
                            if (cells.length < 2) continue;
                            const texts = Array.from(cells).map(c => (c.textContent || "").trim());
                            const tx = FinanceManager._parseTransactionCells(texts);
                            if (tx) transactions.push(tx);
                        }
                    }
                } catch (e) { FinanceManager._debugEntry("structured_doc_error", { error: e.message }); }
                if (credits !== null && transactions.length > 0) break;
            }

            return { credits, transactions };
        },

        _parseDOMSelectors(docs) {
            let credits = null;
            const transactions = [];

            for (const doc of docs) {
                try {
                    if (credits === null) {
                        const creditEl = doc.querySelector("[class*='credit'], [class*='balance'], [data-field='credits'], [data-field='balance']");
                        if (creditEl) {
                            const raw = (creditEl.textContent || "").trim();
                            const num = parseFloat(raw.replace(/[^\d.\-]/g, ""));
                            FinanceManager._debugEntry("dom_credit_found", { tag: creditEl.tagName, class: creditEl.className, raw, parsed: num });
                            if (!isNaN(num)) credits = num;
                        }
                    }

                    const txRows = doc.querySelectorAll(".transaction-row, [class*='transaction']");
                    FinanceManager._debugEntry("dom_tx_rows", { count: txRows.length });
                    for (const row of txRows) {
                        const cells = row.querySelectorAll("td, .cell, [class*='cell']");
                        if (cells.length < 2) continue;
                        const texts = Array.from(cells).map(c => (c.textContent || "").trim());
                        const tx = FinanceManager._parseTransactionCells(texts);
                        if (tx) transactions.push(tx);
                    }
                } catch (e) { FinanceManager._debugEntry("dom_doc_error", { error: e.message }); }
                if (credits !== null && transactions.length > 0) break;
            }

            return { credits, transactions };
        },

        _parseTextFallback(docs) {
            let credits = null;
            const allText = [];
            for (const doc of docs) {
                try { allText.push(doc.body ? doc.body.innerText : ""); } catch {}
            }
            const blob = allText.join("\n");
            FinanceManager._debugEntry("text_blob_size", { chars: blob.length, docs: allText.length });
            const creditMatch = blob.match(/(?:credits?|balance)\s*[:=]?\s*([\d,.]+)/i);
            if (creditMatch) credits = parseFloat(creditMatch[1].replace(/,/g, ""));
            FinanceManager._debugEntry("text_credit_match", { match: creditMatch ? creditMatch[0] : null, credits });
            return { credits, transactions: [] };
        },

        _parseTransactionCells(texts) {
            if (texts.length < 2) return null;
            let date = "", time = "", operation = "", target = "", credits = "";

            for (const text of texts) {
                if (!text) continue;
                if (/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}$/.test(text)) {
                    date = text;
                } else if (/^\d{1,2}:\d{2}/.test(text)) {
                    time = text;
                } else if (/^[\-+]?\d+[\.,]?\d*$/.test(text.replace(/[^\d.\-+]/g, ""))) {
                    const num = parseFloat(text.replace(/[^\d.\-]/g, ""));
                    if (!isNaN(num)) credits = text;
                } else {
                    if (!operation) operation = text;
                    else if (!target) target = text;
                }
            }

            if (!operation && !credits) return null;
            return { date, time, operation, target, credits };
        },

        _filterByShiftPeriod(transactions, shift) {
            const start = new Date(shift.start);
            const end = new Date(shift.end);
            if (isNaN(start) || isNaN(end)) return transactions;

            return transactions.filter(tx => {
                if (!tx.date) return true;
                try {
                    const txDate = new Date(tx.date + (tx.time ? " " + tx.time : ""));
                    return !isNaN(txDate) && txDate >= start && txDate <= end;
                } catch { return true; }
            });
        },

        getCachedState() {
            if (FinanceManager._cache) return FinanceManager._cache;
            FinanceManager._cache = FinanceManager.readState();
            return FinanceManager._cache;
        }
    };

    const Diagnostics = {
        _countBackups: () => {
            let count = 0;
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(CONFIG.BACKUP_PREFIX)) count++;
                }
            } catch {}
            return count;
        },
        _detectLoadedModules: () => {
            const modules = [];
            if (typeof LiveReader !== "undefined") modules.push("LiveReader");
            if (typeof RuntimeMap !== "undefined") modules.push("RuntimeMap");
            if (typeof SnapshotAPI !== "undefined") modules.push("SnapshotAPI");
            if (typeof SenderManager !== "undefined") modules.push("SenderManager");
            if (typeof StateManager !== "undefined") modules.push("StateManager");
            if (typeof ResetManager !== "undefined") modules.push("ResetManager");
            if (typeof DelayManager !== "undefined") modules.push("DelayManager");
            if (typeof SnippetManager !== "undefined") modules.push("SnippetManager");
            if (typeof SnippetImporter !== "undefined") modules.push("SnippetImporter");
            if (typeof FinanceManager !== "undefined") modules.push("FinanceManager");
            if (typeof DataProvider !== "undefined") modules.push("DataProvider");
            if (typeof DOMScanner !== "undefined") modules.push("DOMScanner");
            if (typeof Validator !== "undefined") modules.push("Validator");
            if (typeof CustomUI !== "undefined") modules.push("CustomUI");
            if (typeof App !== "undefined") modules.push("App");
            return modules;
        },
        getDiagnosticsObj: (profileKey, allProfiles) => {
            const ctx = DataProvider.refresh(profileKey);
            const live = ctx.live;
            const data = StorageManager.readProfile(profileKey) || {};
            const id = profileKey ? profileKey.replace(CONFIG.STORAGE_PREFIX, "") : "";
            
            const chromeMatch = navigator.userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
            const totalStorageSize = StorageManager.calculateTotalUsage();
            const profileSize = new Blob([JSON.stringify(data)]).size;
            const backupCount = Diagnostics._countBackups();
            const domMetrics = DOMScanner.scanDOMMetrics();
            const isProfileValid = Validator.isValidProfile(data);
            const loadedModules = Diagnostics._detectLoadedModules();
            const isSenderRunning = !SenderManager.isStopped();
            const recentErrors = Logger.getRecentErrors();
            const resetStats = ResetManager.getResetStats(data);

            const ibMsgCount = data.messages ? Object.keys(data.messages).length : 0;
            const brMsgCount = data.broadcast?.messages ? Object.keys(data.broadcast.messages).length : 0;
            const chainSize = data.chainProgress ? Object.keys(data.chainProgress).length : 0;
            const deliveredCount = data.delivered ? data.delivered.split(';').filter(Boolean).length : 0;
            const sendedCount = data.sended ? data.sended.split(';').filter(Boolean).length : 0;

            const dashboardFields = ["ibStatus", "brStatus", "privDelay", "broadDelay", "ibInProgress", "ibCompleted", "brInProgress", "brCompleted"];
            const liveReaderSection = {};
            for (const field of dashboardFields) {
                const r = live[field];
                const meta = RuntimeMap.getField(field);
                const hasValue = r.value !== CONFIG.TEXT.NOT_AVAILABLE && r.value !== CONFIG.TEXT.UNKNOWN;
                liveReaderSection[`${field} value`] = r.value;
                liveReaderSection[`${field} displayed`] = (field === "privDelay" || field === "broadDelay")
                    ? (hasValue ? `${r.value} sec` : CONFIG.TEXT.NOT_AVAILABLE)
                    : r.value;
                liveReaderSection[`${field} source`] = r.source;
                liveReaderSection[`${field} confidence`] = r.confidence;
                liveReaderSection[`${field} provider`] = meta.provider;
                liveReaderSection[`${field} path`] = meta.objectPath || meta.selector || "N/A";
                liveReaderSection[`${field} parse`] = hasValue ? "ok" : "no_data";
            }

            const storagePercent = totalStorageSize > 0 ? ((totalStorageSize / CONFIG.MAX_STORAGE_WARNING_BYTES) * 100).toFixed(1) : "0.0";

            const errorSummary = {};
            if (recentErrors.length > 0) {
                errorSummary["Error count"] = recentErrors.length;
                errorSummary["Last error message"] = recentErrors[recentErrors.length - 1].message;
                errorSummary["Last error detail"] = recentErrors[recentErrors.length - 1].detail;
                errorSummary["Last error timestamp"] = recentErrors[recentErrors.length - 1].timestamp;
            } else {
                errorSummary["Error count"] = 0;
                errorSummary["Status"] = "No errors recorded";
            }

            return {
                "SYSTEM": {
                    "AgencyBooster Version": `v${CONFIG.DIAGNOSTICS_VERSION}`,
                    "Userscript Version": `v${CONFIG.SNAPSHOT_VERSION}`,
                    "Browser": chromeMatch ? `Chrome ${chromeMatch[1]}` : "Other",
                    "URL": Utils.getCurrentURL(),
                    "Timestamp": Utils.getTimestamp(),
                    "UserAgent": navigator.userAgent,
                    "Viewport": `${window.innerWidth}x${window.innerHeight}`,
                    "Platform": navigator.platform || CONFIG.TEXT.UNKNOWN,
                    "Cookie Enabled": navigator.cookieEnabled ? "Yes" : "No",
                    "Online": navigator.onLine ? "Yes" : "No"
                },
                "PROFILE": {
                    "Profile ID": id || CONFIG.TEXT.UNKNOWN,
                    "Active profile": profileKey || CONFIG.TEXT.UNKNOWN,
                    "Messages (private)": ibMsgCount,
                    "Messages (broadcast)": brMsgCount,
                    "Chain progress entries": chainSize,
                    "Delivered entries": deliveredCount,
                    "Sended entries": sendedCount,
                    "Status (raw)": data.status || CONFIG.TEXT.UNKNOWN,
                    "Broadcast status (raw)": data.broadcast?.status || CONFIG.TEXT.UNKNOWN,
                    "Valid": isProfileValid ? "Yes" : "No"
                },
                "STORAGE": {
                    "Storage usage": `${(totalStorageSize / CONFIG.BYTES_PER_KB).toFixed(2)} KB`,
                    "Storage usage (bytes)": totalStorageSize,
                    "Storage limit": `${(CONFIG.MAX_STORAGE_WARNING_BYTES / CONFIG.BYTES_PER_KB / CONFIG.BYTES_PER_KB).toFixed(1)} MB`,
                    "Storage used %": `${storagePercent}%`,
                    "Storage health": totalStorageSize < CONFIG.MAX_STORAGE_WARNING_BYTES ? "OK" : "Warning",
                    "Profile size": `${(profileSize / CONFIG.BYTES_PER_KB).toFixed(2)} KB`,
                    "Profile size (bytes)": profileSize,
                    "Backup count": backupCount,
                    "Active profile key": profileKey || CONFIG.TEXT.UNKNOWN,
                    "Total profiles": allProfiles.length,
                    "All profiles": allProfiles.length > 0 ? allProfiles.join(", ") : "None",
                    "localStorage keys": (() => { try { return localStorage.length; } catch { return CONFIG.TEXT.UNKNOWN; } })()
                },
                "LIVE READER": liveReaderSection,
                "RUNTIME MAP": (() => {
                    const mapSection = {};
                    for (const [name, meta] of Object.entries(CONFIG.RUNTIME_MAP)) {
                        mapSection[name] = `${meta.provider} | ${meta.objectPath || meta.selector || "N/A"} | ${meta.confidence}`;
                    }
                    return mapSection;
                })(),
                "RESET": {
                    "Completed count": resetStats.completedCount,
                    "In Progress count": resetStats.inProgressCount,
                    "Delivered count": resetStats.deliveredCount,
                    "Last reset": resetStats.lastReset || "Never",
                    "Last reset type": resetStats.lastResetType || "N/A",
                    "Last reset duration": resetStats.lastResetDuration !== null ? `${resetStats.lastResetDuration}ms` : "N/A"
                },
                "DOM": {
                    "Start button": live.startBtn.value ? "Detected" : "Not detected",
                    "Stop button": live.stopBtn.value ? "Detected" : "Not detected",
                    "Start button source": live.startBtn.source,
                    "Stop button source": live.stopBtn.source,
                    "Dashboard open": document.querySelector(".ab-modal") ? "Yes" : "No",
                    "Sender window": window === window.top ? "Top" : "Iframe",
                    "IceBreaker module": ibMsgCount > 0 ? "Loaded" : "Not loaded",
                    "Broadcast module": brMsgCount > 0 ? "Loaded" : "Not loaded",
                    "Accessible documents": domMetrics.docsCount,
                    "Accessible iframes": domMetrics.accessibleIframes,
                    "Blocked iframes": domMetrics.blockedIframes,
                    "Shadow roots": domMetrics.shadowRoots,
                    "Buttons scanned": domMetrics.buttonsScanned
                },
                "RUNTIME": {
                    "Sender running": isSenderRunning ? "Yes" : "No",
                    "Last known IB status": live.ibStatus.value,
                    "Last known BR status": live.brStatus.value,
                    "Last known IB delay": (live.privDelay.value === CONFIG.TEXT.NOT_AVAILABLE) ? CONFIG.TEXT.NOT_AVAILABLE : `${live.privDelay.value} sec`,
                    "Last known BR delay": (live.broadDelay.value === CONFIG.TEXT.NOT_AVAILABLE) ? CONFIG.TEXT.NOT_AVAILABLE : `${live.broadDelay.value} sec`,
                    "Dashboard poll interval": `${CONFIG.DASHBOARD_POLL_MS}ms`,
                    "Button poll interval": `${CONFIG.BUTTON_POLL_MS}ms`,
                    "Stop wait timeout": `${CONFIG.MAX_WAIT_MS}ms`,
                    "Stop required ticks": CONFIG.REQUIRED_STOP_TICKS,
                    "Default delay": `${CONFIG.DEFAULT_DELAY} sec`,
                    "Loaded modules": loadedModules.join(", "),
                    "Module count": loadedModules.length,
                    "UI hooks": (live.startBtn.value || live.stopBtn.value) ? "OK" : "Warning",
                    "Profile valid": isProfileValid ? "Yes" : "No",
                    "Overall health": isProfileValid && (live.startBtn.value || live.stopBtn.value) ? "Healthy" : "Attention Required"
                },
                "IMPORT HISTORY": (() => {
                    const history = SnippetImporter.getImportHistory();
                    if (history.length === 0) return { "Status": "No imports performed" };
                    const last = history[history.length - 1];
                    const section = {
                        "Last import time": last.timestamp,
                        "Last import status": last.status,
                        "Last imported count": last.imported,
                        "Last duplicate count": last.duplicates,
                        "Last invalid count": last.invalid,
                        "Total imports": history.length
                    };
                    history.forEach((entry, i) => {
                        section[`Import #${i + 1}`] = `[${entry.timestamp}] ${entry.status} — imported: ${entry.imported}, dupes: ${entry.duplicates}, invalid: ${entry.invalid}`;
                    });
                    return section;
                })(),
                "FINANCE": (() => {
                    const fs = FinanceManager.getCachedState();
                    const shift = FinanceManager.getShiftPeriod();
                    const finSection = {
                        "Last refresh": fs.lastRefresh || "Never",
                        "Request duration": fs.lastDuration !== null ? `${fs.lastDuration}ms` : "N/A",
                        "Last request status": fs.lastStatus || "N/A",
                        "Credits source": fs.parseMethod || "N/A",
                        "Credits value": fs.credits !== null ? fs.credits : "Not loaded",
                        "Transactions source": fs.parseMethod || "N/A",
                        "Parsed rows": Array.isArray(fs.transactions) ? fs.transactions.length : 0,
                        "Parse method": fs.parseMethod || "N/A",
                        "Parse failure": fs.failureReason || "None",
                        "Shift period": shift && shift.start && shift.end ? `${shift.start} — ${shift.end}` : "All Time",
                        "Widget collapsed": fs.collapsed ? "Yes" : "No",
                        "Widget visible": fs.closed ? "No" : "Yes"
                    };
                    if (CONFIG.DEBUG_FINANCE) {
                        const dbg = FinanceManager.getDebugLog();
                        finSection["Debug log entries"] = dbg.length;
                        dbg.forEach((entry, i) => {
                            finSection[`Debug #${i + 1}`] = `[${entry.type}] ${JSON.stringify(entry)}`;
                        });
                    }
                    return finSection;
                })(),
                "ERROR LOG": errorSummary,
                "ERROR HISTORY": recentErrors.length > 0
                    ? recentErrors.map((err, i) => ({
                        "#": i + 1,
                        "Timestamp": err.timestamp,
                        "Message": err.message,
                        "Detail": err.detail
                    }))
                    : [{ "Status": "No errors recorded" }]
            };
        },
        generateTextReport: (profileKey, allProfiles) => {
            const diagObj = Diagnostics.getDiagnosticsObj(profileKey, allProfiles);
            const ctx = DataProvider.refresh(profileKey);
            const live = ctx.live;
            const vs = (r) => `${r.value} [${r.source}, ${r.confidence}]`;
            const errors = Logger.getRecentErrors();

            const errorLines = errors.length > 0
                ? errors.map((err, i) => `  ${i + 1}. [${err.timestamp}] ${err.message} — ${err.detail}`).join("\n")
                : "  No errors recorded.";

            return `========================================
AGENCYBOOSTER DEBUG REPORT
========================================
Generated on        : ${diagObj.SYSTEM["Timestamp"]}

----------------------------------------
1. SYSTEM
----------------------------------------
AB Version          : ${diagObj.SYSTEM["AgencyBooster Version"]}
Userscript Version  : ${diagObj.SYSTEM["Userscript Version"]}
Browser             : ${diagObj.SYSTEM["Browser"]}
URL                 : ${diagObj.SYSTEM["URL"]}
Viewport            : ${diagObj.SYSTEM["Viewport"]}
Platform            : ${diagObj.SYSTEM["Platform"]}
Cookie Enabled      : ${diagObj.SYSTEM["Cookie Enabled"]}
Online              : ${diagObj.SYSTEM["Online"]}

----------------------------------------
2. PROFILE
----------------------------------------
Profile ID          : ${diagObj.PROFILE["Profile ID"]}
Active profile      : ${diagObj.PROFILE["Active profile"]}
Private messages    : ${diagObj.PROFILE["Messages (private)"]}
Broadcast messages  : ${diagObj.PROFILE["Messages (broadcast)"]}
Chain progress      : ${diagObj.PROFILE["Chain progress entries"]} entries
Delivered           : ${diagObj.PROFILE["Delivered entries"]} entries
Sended              : ${diagObj.PROFILE["Sended entries"]} entries
Status (raw)        : ${diagObj.PROFILE["Status (raw)"]}
Broadcast (raw)     : ${diagObj.PROFILE["Broadcast status (raw)"]}
Valid               : ${diagObj.PROFILE["Valid"]}

----------------------------------------
3. DASHBOARD VALUES (localStorage)
----------------------------------------
IB Status           : ${vs(live.ibStatus)}
BR Status           : ${vs(live.brStatus)}
Private Delay       : ${vs(live.privDelay)}
Broadcast Delay     : ${vs(live.broadDelay)}
IB In Progress      : ${vs(live.ibInProgress)}
IB Completed        : ${vs(live.ibCompleted)}
BR In Progress      : ${vs(live.brInProgress)}
BR Completed        : ${vs(live.brCompleted)}

All dashboard fields read from localStorage (source: profile data).
All fields have HIGH confidence when data exists.

----------------------------------------
4. RUNTIME MAP
----------------------------------------
${Object.entries(diagObj["RUNTIME MAP"]).map(([k, v]) => `${k.padEnd(16)}: ${v}`).join("\n")}

----------------------------------------
5. STORAGE
----------------------------------------
Usage               : ${diagObj.STORAGE["Storage usage"]} (${diagObj.STORAGE["Storage used %"]} of limit)
Storage health      : ${diagObj.STORAGE["Storage health"]}
Profile size        : ${diagObj.STORAGE["Profile size"]}
Backups             : ${diagObj.STORAGE["Backup count"]}
Total profiles      : ${diagObj.STORAGE["Total profiles"]}
All profiles        : ${diagObj.STORAGE["All profiles"]}
localStorage keys   : ${diagObj.STORAGE["localStorage keys"]}

----------------------------------------
6. DOM
----------------------------------------
Start button        : ${diagObj.DOM["Start button"]} (${diagObj.DOM["Start button source"]})
Stop button         : ${diagObj.DOM["Stop button"]} (${diagObj.DOM["Stop button source"]})
Dashboard open      : ${diagObj.DOM["Dashboard open"]}
Sender window       : ${diagObj.DOM["Sender window"]}
IceBreaker module   : ${diagObj.DOM["IceBreaker module"]}
Broadcast module    : ${diagObj.DOM["Broadcast module"]}
Accessible docs     : ${diagObj.DOM["Accessible documents"]}
Accessible iframes  : ${diagObj.DOM["Accessible iframes"]}
Blocked iframes     : ${diagObj.DOM["Blocked iframes"]}
Shadow roots        : ${diagObj.DOM["Shadow roots"]}
Buttons scanned     : ${diagObj.DOM["Buttons scanned"]}

----------------------------------------
7. RUNTIME
----------------------------------------
Sender running      : ${diagObj.RUNTIME["Sender running"]}
Last IB status      : ${diagObj.RUNTIME["Last known IB status"]}
Last BR status      : ${diagObj.RUNTIME["Last known BR status"]}
Last IB delay       : ${diagObj.RUNTIME["Last known IB delay"]}
Last BR delay       : ${diagObj.RUNTIME["Last known BR delay"]}
Dashboard poll      : ${diagObj.RUNTIME["Dashboard poll interval"]}
Button poll         : ${diagObj.RUNTIME["Button poll interval"]}
Stop wait timeout   : ${diagObj.RUNTIME["Stop wait timeout"]}
Default delay       : ${diagObj.RUNTIME["Default delay"]}
Loaded modules      : ${diagObj.RUNTIME["Loaded modules"]}
Module count        : ${diagObj.RUNTIME["Module count"]}
UI hooks            : ${diagObj.RUNTIME["UI hooks"]}
Profile valid       : ${diagObj.RUNTIME["Profile valid"]}
Overall health      : ${diagObj.RUNTIME["Overall health"]}

----------------------------------------
8. IMPORT HISTORY
----------------------------------------
Last import time    : ${diagObj["IMPORT HISTORY"]["Last import time"] || "N/A"}
Last import status  : ${diagObj["IMPORT HISTORY"]["Last import status"] || "N/A"}
Last imported       : ${diagObj["IMPORT HISTORY"]["Last imported count"] ?? "N/A"}
Last duplicates     : ${diagObj["IMPORT HISTORY"]["Last duplicate count"] ?? "N/A"}
Last invalid        : ${diagObj["IMPORT HISTORY"]["Last invalid count"] ?? "N/A"}
Total imports       : ${diagObj["IMPORT HISTORY"]["Total imports"] ?? 0}

----------------------------------------
9. FINANCE
----------------------------------------
Last refresh        : ${diagObj.FINANCE["Last refresh"]}
Request duration    : ${diagObj.FINANCE["Request duration"]}
Last request status : ${diagObj.FINANCE["Last request status"]}
Credits source      : ${diagObj.FINANCE["Credits source"]}
Credits value       : ${diagObj.FINANCE["Credits value"]}
Transactions source : ${diagObj.FINANCE["Transactions source"]}
Parsed rows         : ${diagObj.FINANCE["Parsed rows"]}
Parse method        : ${diagObj.FINANCE["Parse method"]}
Parse failure       : ${diagObj.FINANCE["Parse failure"]}
Shift period        : ${diagObj.FINANCE["Shift period"]}
Widget collapsed    : ${diagObj.FINANCE["Widget collapsed"]}
Widget visible      : ${diagObj.FINANCE["Widget visible"]}
${CONFIG.DEBUG_FINANCE ? `Debug entries       : ${diagObj.FINANCE["Debug log entries"] || 0}` : `Debug               : disabled (set CONFIG.DEBUG_FINANCE=true to enable)`}

----------------------------------------
10. RESET
----------------------------------------
Completed count     : ${diagObj.RESET["Completed count"]}
In Progress count   : ${diagObj.RESET["In Progress count"]}
Delivered count     : ${diagObj.RESET["Delivered count"]}
Last reset          : ${diagObj.RESET["Last reset"]}
Last reset type     : ${diagObj.RESET["Last reset type"]}
Last reset duration : ${diagObj.RESET["Last reset duration"]}

----------------------------------------
11. ERROR LOG
----------------------------------------
Error count         : ${diagObj["ERROR LOG"]["Error count"]}
${diagObj["ERROR LOG"]["Status"] ? `Status              : ${diagObj["ERROR LOG"]["Status"]}` : `Last error          : ${diagObj["ERROR LOG"]["Last error message"]}`}
Recent errors:
${errorLines}
=======================================`;
        },
        exportDebugBundle: (profileKey, allProfiles) => {
            const ctx = DataProvider.refresh(profileKey);
            const live = ctx.live;
            const data = StorageManager.readProfile(profileKey) || {};
            const id = profileKey ? profileKey.replace(CONFIG.STORAGE_PREFIX, "") : "";
            const chromeMatch = navigator.userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
            const totalStorageSize = StorageManager.calculateTotalUsage();
            const profileSize = new Blob([JSON.stringify(data)]).size;
            const backupCount = Diagnostics._countBackups();
            const domMetrics = DOMScanner.scanDOMMetrics();
            const isProfileValid = Validator.isValidProfile(data);
            const loadedModules = Diagnostics._detectLoadedModules();
            const isSenderRunning = !SenderManager.isStopped();
            const recentErrors = Logger.getRecentErrors();

            const ibMsgCount = data.messages ? Object.keys(data.messages).length : 0;
            const brMsgCount = data.broadcast?.messages ? Object.keys(data.broadcast.messages).length : 0;

            const lastError = recentErrors.length > 0 ? recentErrors[recentErrors.length - 1] : null;

            return {
                meta: {
                    bundleVersion: "1.0",
                    generatedAt: Utils.getTimestamp(),
                    generator: "AgencyBooster Debug Bundle",
                    abVersion: CONFIG.DIAGNOSTICS_VERSION,
                    userscriptVersion: CONFIG.SNAPSHOT_VERSION
                },
                system: {
                    abVersion: `v${CONFIG.DIAGNOSTICS_VERSION}`,
                    userscriptVersion: `v${CONFIG.SNAPSHOT_VERSION}`,
                    url: Utils.getCurrentURL(),
                    browser: chromeMatch ? `Chrome ${chromeMatch[1]}` : "Other",
                    userAgent: navigator.userAgent,
                    viewport: `${window.innerWidth}x${window.innerHeight}`,
                    platform: navigator.platform || CONFIG.TEXT.UNKNOWN,
                    cookieEnabled: navigator.cookieEnabled,
                    online: navigator.onLine
                },
                profile: {
                    id: id || null,
                    key: profileKey || null,
                    valid: isProfileValid,
                    privateMessages: ibMsgCount,
                    broadcastMessages: brMsgCount,
                    chainProgress: data.chainProgress ? Object.keys(data.chainProgress).length : 0,
                    delivered: data.delivered ? data.delivered.split(';').filter(Boolean).length : 0,
                    sended: data.sended ? data.sended.split(';').filter(Boolean).length : 0,
                    status: data.status || null,
                    broadcastStatus: data.broadcast?.status || null
                },
                storage: {
                    usageBytes: totalStorageSize,
                    usageKB: +(totalStorageSize / CONFIG.BYTES_PER_KB).toFixed(2),
                    limitMB: +(CONFIG.MAX_STORAGE_WARNING_BYTES / CONFIG.BYTES_PER_KB / CONFIG.BYTES_PER_KB).toFixed(1),
                    usedPercent: +((totalStorageSize / CONFIG.MAX_STORAGE_WARNING_BYTES) * 100).toFixed(1),
                    health: totalStorageSize < CONFIG.MAX_STORAGE_WARNING_BYTES ? "ok" : "warning",
                    profileSizeBytes: profileSize,
                    profileSizeKB: +(profileSize / CONFIG.BYTES_PER_KB).toFixed(2),
                    backupCount: backupCount,
                    totalProfiles: allProfiles.length,
                    allProfiles: allProfiles,
                    localStorageKeys: (() => { try { return localStorage.length; } catch { return null; } })()
                },
                dom: {
                    startButton: live.startBtn.value,
                    startButtonSource: live.startBtn.source,
                    stopButton: live.stopBtn.value,
                    stopButtonSource: live.stopBtn.source,
                    dashboardOpen: !!document.querySelector(".ab-modal"),
                    senderWindow: window === window.top ? "top" : "iframe",
                    iceBreakerLoaded: ibMsgCount > 0,
                    broadcastLoaded: brMsgCount > 0,
                    accessibleDocs: domMetrics.docsCount,
                    accessibleIframes: domMetrics.accessibleIframes,
                    blockedIframes: domMetrics.blockedIframes,
                    shadowRoots: domMetrics.shadowRoots,
                    buttonsScanned: domMetrics.buttonsScanned
                },
                runtime: {
                    senderRunning: isSenderRunning,
                    ibStatus: live.ibStatus.value,
                    brStatus: live.brStatus.value,
                    ibDelay: live.privDelay.value,
                    brDelay: live.broadDelay.value,
                    dashboardPollMs: CONFIG.DASHBOARD_POLL_MS,
                    buttonPollMs: CONFIG.BUTTON_POLL_MS,
                    stopWaitMs: CONFIG.MAX_WAIT_MS,
                    stopTicks: CONFIG.REQUIRED_STOP_TICKS,
                    defaultDelay: CONFIG.DEFAULT_DELAY,
                    loadedModules: loadedModules,
                    moduleCount: loadedModules.length,
                    uiHooksOk: live.startBtn.value || live.stopBtn.value,
                    profileValid: isProfileValid,
                    overallHealth: isProfileValid && (live.startBtn.value || live.stopBtn.value) ? "healthy" : "attention_required"
                },
                liveReader: {
                    ibStatus: { value: live.ibStatus.value, source: live.ibStatus.source, confidence: live.ibStatus.confidence, provider: "localStorage" },
                    brStatus: { value: live.brStatus.value, source: live.brStatus.source, confidence: live.brStatus.confidence, provider: "localStorage" },
                    privDelay: { value: live.privDelay.value, source: live.privDelay.source, confidence: live.privDelay.confidence, provider: "localStorage" },
                    broadDelay: { value: live.broadDelay.value, source: live.broadDelay.source, confidence: live.broadDelay.confidence, provider: "localStorage" },
                    ibInProgress: { value: live.ibInProgress.value, source: live.ibInProgress.source, confidence: live.ibInProgress.confidence, provider: "localStorage" },
                    ibCompleted: { value: live.ibCompleted.value, source: live.ibCompleted.source, confidence: live.ibCompleted.confidence, provider: "localStorage" },
                    brInProgress: { value: live.brInProgress.value, source: live.brInProgress.source, confidence: live.brInProgress.confidence, provider: "localStorage" },
                    brCompleted: { value: live.brCompleted.value, source: live.brCompleted.source, confidence: live.brCompleted.confidence, provider: "localStorage" }
                },
                importHistory: (() => {
                    const history = SnippetImporter.getImportHistory();
                    return {
                        totalImports: history.length,
                        lastImport: history.length > 0 ? history[history.length - 1] : null,
                        history: history
                    };
                })(),
                finance: (() => {
                    const fs = FinanceManager.getCachedState();
                    const shift = FinanceManager.getShiftPeriod();
                    return {
                        lastRefresh: fs.lastRefresh,
                        lastDuration: fs.lastDuration,
                        lastStatus: fs.lastStatus,
                        creditsSource: fs.parseMethod || null,
                        creditsValue: fs.credits,
                        transactionsSource: fs.parseMethod || null,
                        parsedRows: Array.isArray(fs.transactions) ? fs.transactions.length : 0,
                        parseMethod: fs.parseMethod || null,
                        failureReason: fs.failureReason || null,
                        shiftPeriod: shift && shift.start && shift.end ? shift : "all",
                        collapsed: fs.collapsed,
                        closed: fs.closed,
                        position: { x: fs.x, y: fs.y },
                        debugLog: CONFIG.DEBUG_FINANCE ? FinanceManager.getDebugLog() : null
                    };
                })(),
                runtimeMap: (() => {
                    const map = {};
                    for (const [name, meta] of Object.entries(CONFIG.RUNTIME_MAP)) {
                        map[name] = { provider: meta.provider, objectPath: meta.objectPath || null, selector: meta.selector || null, confidence: meta.confidence };
                    }
                    return map;
                })(),
                reset: ResetManager.getResetStats(data),
                errors: {
                    count: recentErrors.length,
                    lastError: lastError ? { message: lastError.message, detail: lastError.detail, timestamp: lastError.timestamp } : null,
                    history: recentErrors.map((err) => ({ timestamp: err.timestamp, message: err.message, detail: err.detail }))
                }
            };
        }
    };

    const LiveReader = {
        SOURCES: {
            LOCAL_STORAGE: "local_storage",
            DOM_DIRECT: "dom_direct",
            UNKNOWN: "unknown"
        },
        CONFIDENCE: {
            HIGH: "high",
            MEDIUM: "medium",
            LOW: "low",
            NONE: "none"
        },
        _makeResult: (value, source, confidence, raw) => ({
            value,
            source,
            confidence,
            raw: raw !== undefined ? raw : value
        }),
        _unknownResult: () => LiveReader._makeResult(CONFIG.TEXT.NOT_AVAILABLE, LiveReader.SOURCES.UNKNOWN, LiveReader.CONFIDENCE.NONE),
        _readLocalStorage: (profileKey) => {
            const data = StorageManager.readProfile(profileKey) || {};
            const isSenderStopped = SenderManager.isStopped();

            const ibRaw = StateManager.getModuleStatus(data, "icebreaker");
            const ibStatus = (ibRaw === "Running" && isSenderStopped) ? "Stopped" : ibRaw;
            const brRaw = StateManager.getModuleStatus(data, "broadcast");
            const privRaw = StateManager.getDelayValue(data, "icebreaker");
            const broadRaw = StateManager.getDelayValue(data, "broadcast");

            return {
                ibStatus: ibStatus,
                brStatus: brRaw,
                privDelay: privRaw,
                broadDelay: broadRaw,
                ibInProgress: StateManager.getInProgressCount(data, "icebreaker"),
                ibCompleted: StateManager.getCompletedCount(data, "icebreaker"),
                brInProgress: StateManager.getInProgressCount(data, "broadcast"),
                brCompleted: StateManager.getCompletedCount(data, "broadcast")
            };
        },
        readAll: (profileKey) => {
            const ls = LiveReader._readLocalStorage(profileKey);
            const fields = ["ibStatus", "brStatus", "privDelay", "broadDelay", "ibInProgress", "ibCompleted", "brInProgress", "brCompleted"];
            const result = {};
            for (const field of fields) {
                const val = ls[field];
                if (val !== null && val !== undefined && val !== CONFIG.TEXT.UNKNOWN) {
                    result[field] = LiveReader._makeResult(val, LiveReader.SOURCES.LOCAL_STORAGE, LiveReader.CONFIDENCE.HIGH);
                } else {
                    result[field] = LiveReader._unknownResult();
                }
            }
            const startBtnFound = !!DOMManager.findButton(CONFIG.SELECTORS.START);
            const stopBtnFound = !!DOMManager.findButton(CONFIG.SELECTORS.STOP);
            result.startBtn = LiveReader._makeResult(
                startBtnFound,
                startBtnFound ? LiveReader.SOURCES.DOM_DIRECT : LiveReader.SOURCES.UNKNOWN,
                startBtnFound ? LiveReader.CONFIDENCE.HIGH : LiveReader.CONFIDENCE.NONE
            );
            result.stopBtn = LiveReader._makeResult(
                stopBtnFound,
                stopBtnFound ? LiveReader.SOURCES.DOM_DIRECT : LiveReader.SOURCES.UNKNOWN,
                stopBtnFound ? LiveReader.CONFIDENCE.HIGH : LiveReader.CONFIDENCE.NONE
            );
            return result;
        }
    };

    const DataProvider = {
        _cache: null,
        _cacheTimestamp: 0,
        refresh(profileKey) {
            if (this._cache && (Date.now() - this._cacheTimestamp) < CONFIG.DASHBOARD_POLL_MS) {
                return this._cache;
            }
            const docs = DOMManager.getAccessibleDocuments(window);
            const live = LiveReader.readAll(profileKey);
            this._cache = { live, docs, timestamp: Utils.getTimestamp() };
            this._cacheTimestamp = Date.now();
            return this._cache;
        },
        invalidate() {
            this._cache = null;
            this._cacheTimestamp = 0;
        }
    };

    const RuntimeMap = {
        _config: CONFIG.RUNTIME_MAP,
        getField(name) {
            return this._config[name] || { label: name, provider: "unknown", objectPath: "N/A", selector: "N/A", confidence: "none" };
        },
        getDisplayMeta(name) {
            const f = this.getField(name);
            return `${f.provider} | ${f.objectPath || f.selector || "N/A"} | ${f.confidence}`;
        },
        getAllFields() {
            return Object.entries(this._config).map(([key, meta]) => ({ name: key, ...meta }));
        }
    };

    const SnapshotAPI = {
        collectSystemInfo: () => {
            const chromeMatch = navigator.userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
            return {
                scriptVersion: CONFIG.SNAPSHOT_VERSION,
                timestamp: Utils.getTimestamp(),
                currentURL: Utils.getCurrentURL(),
                browser: chromeMatch ? `Chrome ${chromeMatch[1]}` : "Other",
                userAgent: navigator.userAgent,
                viewport: `${window.innerWidth}x${window.innerHeight}`
            };
        },
        collectProfileInfo: (profileKey, allProfiles) => {
            const data = StorageManager.readProfile(profileKey) || {};
            const id = profileKey ? profileKey.replace(CONFIG.STORAGE_PREFIX, "") : "";
            const backupExists = !!StorageManager.readProfile(StorageManager.getBackupKey(id));
            const profileSize = new Blob([JSON.stringify(data)]).size;
            
            return {
                detectedProfiles: allProfiles,
                selectedProfile: id || CONFIG.TEXT.UNKNOWN,
                storageKey: profileKey || CONFIG.TEXT.UNKNOWN,
                profileSizeKb: (profileSize / CONFIG.BYTES_PER_KB).toFixed(2),
                backupExists: backupExists,
                estimatedLocalStorageUsageKb: (StorageManager.calculateTotalUsage() / CONFIG.BYTES_PER_KB).toFixed(2)
            };
        },
        collectStorageInfo: (profileKey) => {
            const data = StorageManager.readProfile(profileKey) || {};
            return {
                status: data.status || CONFIG.TEXT.UNKNOWN,
                broadcastStatus: data.broadcast?.status || CONFIG.TEXT.UNKNOWN,
                chainProgressSize: data.chainProgress ? Object.keys(data.chainProgress).length : 0,
                deliveredSize: data.delivered ? data.delivered.split(';').filter(Boolean).length : 0,
                sendedSize: data.sended ? data.sended.split(';').filter(Boolean).length : 0
            };
        },
        collectDOMInfo: () => {
            return DOMScanner.scanDOMMetrics();
        },
        collectStatistics: (profileKey) => {
            const live = DataProvider.refresh(profileKey).live;
            return {
                ibStatus: live.ibStatus.value,
                brStatus: live.brStatus.value,
                ibCompleted: live.ibCompleted.value,
                ibInProgress: live.ibInProgress.value,
                brCompleted: live.brCompleted.value,
                brInProgress: live.brInProgress.value
            };
        },
        collectDiagnostics: (profileKey, allProfiles) => {
            return {
                system: SnapshotAPI.collectSystemInfo(),
                profile: SnapshotAPI.collectProfileInfo(profileKey, allProfiles),
                storage: SnapshotAPI.collectStorageInfo(profileKey),
                dom: SnapshotAPI.collectDOMInfo(),
                statistics: SnapshotAPI.collectStatistics(profileKey)
            };
        }
    };

    // --- UI LAYER ---

    const CustomUI = {
        overlay: null,
        activeProfileKey: null,
        dashboardInterval: null,
        
        injectCSS: () => {
            if (document.getElementById("ab-styles")) return;
            const style = document.createElement("style");
            style.id = "ab-styles";
            style.innerHTML = `
                :root {
                    --ab-bg: rgba(15, 23, 42, 0.85);
                    --ab-bg-card: rgba(30, 41, 59, 0.6);
                    --ab-text: #f8fafc;
                    --ab-text-dim: #94a3b8;
                    --ab-accent: #3b82f6;
                    --ab-accent-hover: #2563eb;
                    --ab-border: rgba(255, 255, 255, 0.1);
                    --ab-danger: #ef4444;
                    --ab-success: #10b981;
                    --ab-warning: #f59e0b;
                    --ab-font: system-ui, -apple-system, sans-serif;
                }
                
                @keyframes ab-pulse {
                    0% { box-shadow: 0 8px 32px 0 rgba(37, 99, 235, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2); }
                    50% { box-shadow: 0 8px 32px 14px rgba(37, 99, 235, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.2); }
                    100% { box-shadow: 0 8px 32px 0 rgba(37, 99, 235, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2); }
                }

                #ab-floating-btn {
                    position: fixed; 
                    bottom: 24px; 
                    right: 24px; 
                    width: ${CONFIG.BUTTON_SIZE_PX}px; 
                    height: ${CONFIG.BUTTON_SIZE_PX}px; 
                    border-radius: 50%; 
                    background: linear-gradient(135deg, rgba(37, 99, 235, 0.75) 0%, rgba(29, 78, 216, 0.75) 100%);
                    backdrop-filter: blur(12px); 
                    -webkit-backdrop-filter: blur(12px);
                    color: white; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    cursor: pointer; 
                    z-index: ${CONFIG.MODAL_Z_INDEX}; 
                    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 1px 1px rgba(255, 255, 255, 0.2); 
                    border: 1px solid rgba(255, 255, 255, 0.18); 
                    transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
                    animation: ab-pulse 3.5s infinite ease-in-out;
                }
                #ab-floating-btn:hover { 
                    transform: scale(1.08) translateY(-2px); 
                    box-shadow: 0 12px 40px 0 rgba(37, 99, 235, 0.65), inset 0 1px 1px rgba(255, 255, 255, 0.3); 
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.85) 0%, rgba(37, 99, 235, 0.85) 100%);
                }
                #ab-floating-btn svg { width: 32px; height: 32px; fill: currentColor; }

                .ab-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
                    background: rgba(0,0,0,0.5); z-index: ${CONFIG.MODAL_Z_INDEX}; 
                    display: flex; align-items: center; justify-content: center; 
                    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                    font-family: var(--ab-font); color: var(--ab-text); opacity: 0; 
                    animation: ab-fade-in 0.2s forwards ease-out;
                }

                @keyframes ab-fade-in { to { opacity: 1; } }
                @keyframes ab-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes ab-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .ab-modal {
                    background: var(--ab-bg); border-radius: 12px; width: 400px; max-height: 90vh;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); border: 1px solid var(--ab-border);
                    display: flex; flex-direction: column; overflow: hidden;
                    animation: ab-slide-up 0.3s forwards cubic-bezier(0.16, 1, 0.3, 1);
                }
                .ab-modal.large { width: 600px; }
                .ab-modal.small { width: 320px; }

                .ab-header {
                    padding: 16px 20px; border-bottom: 1px solid var(--ab-border);
                    display: flex; justify-content: space-between; align-items: center;
                    background: rgba(255,255,255,0.02);
                }
                .ab-header h2 { margin: 0; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;}
                .ab-close-icon { cursor: pointer; opacity: 0.7; transition: opacity 0.2s; display:flex; }
                .ab-close-icon:hover { opacity: 1; }
                .ab-close-icon svg { width: 20px; height: 20px; fill: var(--ab-text); }

                .ab-tabs { display: flex; border-bottom: 1px solid var(--ab-border); background: rgba(0,0,0,0.2); }
                .ab-tab { flex: 1; padding: 12px; text-align: center; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--ab-text-dim); border-bottom: 2px solid transparent; transition: all 0.2s; user-select: none; }
                .ab-tab:hover { color: var(--ab-text); background: rgba(255,255,255,0.03); }
                .ab-tab.active { color: var(--ab-accent); border-bottom-color: var(--ab-accent); background: rgba(59,130,246,0.1); }

                .ab-content { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; max-height: 65vh; }
                .ab-content::-webkit-scrollbar { width: 6px; }
                .ab-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }

                .ab-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .ab-card { background: var(--ab-bg-card); border: 1px solid var(--ab-border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
                .ab-card-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ab-text-dim); }
                .ab-card-value { font-size: 15px; font-weight: 600; color: var(--ab-text); }
                
                .ab-btn {
                    background: rgba(255,255,255,0.05); color: var(--ab-text); border: 1px solid var(--ab-border);
                    padding: 10px 14px; border-radius: 6px; cursor: pointer; text-align: center; 
                    transition: all 0.2s; font-size: 13px; font-weight: 500; width: 100%; 
                    display: flex; align-items: center; justify-content: center; gap: 8px; outline: none;
                }
                .ab-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
                .ab-btn:active { transform: scale(0.98); }
                .ab-btn.primary { background: var(--ab-accent); border-color: var(--ab-accent); color: #fff; }
                .ab-btn.primary:hover { background: var(--ab-accent-hover); }
                .ab-btn.danger { background: rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.4); color: #fca5a5; }
                .ab-btn.danger:hover { background: rgba(239,68,68,0.3); }

                .ab-input-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
                .ab-input-group label { font-size: 12px; color: var(--ab-text-dim); }
                .ab-input-group input { 
                    background: rgba(0,0,0,0.2); border: 1px solid var(--ab-border); color: var(--ab-text); 
                    padding: 10px; border-radius: 6px; outline: none; font-family: monospace; font-size: 14px;
                    transition: border-color 0.2s;
                }
                .ab-input-group input:focus { border-color: var(--ab-accent); }

                .ab-row { display: flex; gap: 10px; width: 100%; }
                
                .ab-diag-group { margin-bottom: 16px; }
                .ab-diag-group h3 { margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: var(--ab-accent); border-bottom: 1px solid rgba(59,130,246,0.3); padding-bottom: 4px; }
                .ab-table { width: 100%; border-collapse: collapse; font-size: 12px; }
                .ab-table td { padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); word-break: break-all; }
                .ab-table td:first-child { color: var(--ab-text-dim); width: 45%; }
                
                .ab-toast { position: fixed; bottom: 80px; right: 20px; background: var(--ab-success); color: white; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 500; z-index: ${CONFIG.OVERLAY_Z_INDEX_BASE}; box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: ab-slide-up 0.3s forwards; }

                #ab-finance-widget {
                    position: fixed; bottom: 24px; left: 24px;
                    width: ${CONFIG.FINANCE_WIDGET_SIZE.WIDTH}px;
                    background: var(--ab-bg); border: 1px solid var(--ab-border);
                    border-radius: 10px; z-index: ${CONFIG.MODAL_Z_INDEX - 1};
                    font-family: var(--ab-font); color: var(--ab-text);
                    box-shadow: 0 8px 32px 0 rgba(0,0,0,0.5);
                    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                    user-select: none; display: flex; flex-direction: column;
                    transition: height 0.25s ease, opacity 0.2s ease;
                }
                #ab-finance-widget.ab-finance-hidden { display: none; }
                #ab-finance-widget.ab-finance-collapsed {
                    height: ${CONFIG.FINANCE_WIDGET_SIZE.COLLAPSED_HEIGHT}px;
                    overflow: hidden;
                }
                #ab-finance-widget.ab-finance-expanded {
                    height: ${CONFIG.FINANCE_WIDGET_SIZE.EXPANDED_HEIGHT}px;
                    overflow: hidden;
                }
                .ab-finance-header {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 8px 12px; cursor: grab; border-bottom: 1px solid var(--ab-border);
                    background: rgba(255,255,255,0.03); min-height: ${CONFIG.FINANCE_WIDGET_SIZE.COLLAPSED_HEIGHT}px;
                    border-radius: 10px 10px 0 0; flex-shrink: 0;
                }
                .ab-finance-header:active { cursor: grabbing; }
                .ab-finance-header-title {
                    font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;
                    color: var(--ab-text-dim); text-transform: uppercase; letter-spacing: 0.5px;
                }
                .ab-finance-header-title svg { width: 14px; height: 14px; fill: var(--ab-accent); }
                .ab-finance-header-actions { display: flex; gap: 4px; }
                .ab-finance-header-actions button {
                    background: none; border: none; color: var(--ab-text-dim); cursor: pointer;
                    padding: 2px; border-radius: 3px; display: flex; align-items: center; justify-content: center;
                    transition: all 0.15s;
                }
                .ab-finance-header-actions button:hover { color: var(--ab-text); background: rgba(255,255,255,0.1); }
                .ab-finance-header-actions button svg { width: 14px; height: 14px; fill: currentColor; }
                .ab-finance-body { padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; flex: 1; }
                .ab-finance-body::-webkit-scrollbar { width: 4px; }
                .ab-finance-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
                .ab-finance-row { display: flex; justify-content: space-between; align-items: center; }
                .ab-finance-label { font-size: 10px; color: var(--ab-text-dim); text-transform: uppercase; letter-spacing: 0.3px; }
                .ab-finance-value { font-size: 12px; font-weight: 600; color: var(--ab-text); }
                .ab-finance-value.ab-finance-accent { color: var(--ab-accent); }
                .ab-finance-value.ab-finance-success { color: var(--ab-success); }
                .ab-finance-value.ab-finance-warning { color: var(--ab-warning); }
                .ab-finance-btn-row { display: flex; gap: 4px; margin-top: 1px; }
                .ab-finance-btn {
                    flex: 1; background: rgba(255,255,255,0.05); color: var(--ab-text); border: 1px solid var(--ab-border);
                    padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: 500;
                    text-align: center; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 4px;
                }
                .ab-finance-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
                .ab-finance-btn:active { transform: scale(0.97); }
                .ab-finance-btn.primary { background: var(--ab-accent); border-color: var(--ab-accent); color: #fff; }
                .ab-finance-btn.primary:hover { background: var(--ab-accent-hover); }
                .ab-finance-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .ab-finance-btn svg { width: 11px; height: 11px; fill: currentColor; }
                .ab-finance-divider { height: 1px; background: var(--ab-border); margin: 2px 0; }
                .ab-finance-status { font-size: 9px; color: var(--ab-text-dim); text-align: center; margin-top: 1px; }
                .ab-finance-tx-container { display: flex; flex-direction: column; gap: 0; }
                .ab-finance-tx-header {
                    display: grid; grid-template-columns: 48px 42px 1fr 60px 45px; gap: 2px;
                    font-size: 9px; text-transform: uppercase; color: var(--ab-text-dim); letter-spacing: 0.3px;
                    padding: 2px 0; border-bottom: 1px solid var(--ab-border);
                }
                .ab-finance-tx-row {
                    display: grid; grid-template-columns: 48px 42px 1fr 60px 45px; gap: 2px;
                    font-size: 10px; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.03);
                    color: var(--ab-text);
                }
                .ab-finance-tx-cell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .ab-finance-tx-op { color: var(--ab-text-dim); }
            `;
            document.head.appendChild(style);
        },
        createOverlay: (isTopLevel = false) => {
            const overlay = document.createElement("div");
            overlay.className = "ab-overlay";
            if (!isTopLevel) overlay.style.zIndex = `${CONFIG.OVERLAY_Z_INDEX_BASE}`; 
            DOMManager.appendBody(overlay);
            return overlay;
        },
        closeOverlay: (overlayEl) => {
            if (overlayEl) {
                overlayEl.style.opacity = '0';
                setTimeout(() => overlayEl.remove(), CONFIG.ANIMATION_MS);
            }
        },
        showToast: (msg) => {
            const toast = document.createElement("div");
            toast.className = "ab-toast";
            toast.innerText = msg;
            DOMManager.appendBody(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px)';
                toast.style.transition = 'all 0.3s';
                setTimeout(() => toast.remove(), CONFIG.ANIMATION_MS);
            }, CONFIG.TOAST_TIMEOUT_MS);
        },
        showAlert: (msgHtml) => {
            return new Promise(resolve => {
                const overlay = CustomUI.createOverlay();
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
                document.getElementById("ab-alert-ok").onclick = () => {
                    CustomUI.closeOverlay(overlay);
                    resolve();
                };
            });
        },
        showConfirm: (msgHtml) => {
            return new Promise(resolve => {
                const overlay = CustomUI.createOverlay();
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
                document.getElementById("ab-confirm-yes").onclick = () => {
                    CustomUI.closeOverlay(overlay);
                    resolve(true);
                };
                document.getElementById("ab-confirm-no").onclick = () => {
                    CustomUI.closeOverlay(overlay);
                    resolve(false);
                };
            });
        },
        showDelayModal: () => {
            return new Promise(resolve => {
                const overlay = CustomUI.createOverlay();
                overlay.innerHTML = `
                    <div class="ab-modal small">
                        <div class="ab-header">
                            <h2>Change Delays</h2>
                        </div>
                        <div class="ab-content">
                            <div class="ab-input-group">
                                <label>Private Delay (seconds)</label>
                                <input type="number" id="ab-delay-priv" value="${CONFIG.DEFAULT_DELAY}">
                            </div>
                            <div class="ab-input-group">
                                <label>Broadcast Delay (seconds)</label>
                                <input type="number" id="ab-delay-broad" value="${CONFIG.DEFAULT_DELAY}">
                            </div>
                            <div class="ab-row" style="margin-top: 4px;">
                                <button class="ab-btn primary" id="ab-delay-apply">Apply</button>
                                <button class="ab-btn" id="ab-delay-cancel">Cancel</button>
                            </div>
                        </div>
                    </div>
                `;
                
                document.getElementById("ab-delay-apply").onclick = () => {
                    const priv = parseInt(document.getElementById("ab-delay-priv").value, 10);
                    const broad = parseInt(document.getElementById("ab-delay-broad").value, 10);
                    if (isNaN(priv) || isNaN(broad)) {
                        CustomUI.showAlert("Invalid numeric value.");
                        return;
                    }
                    CustomUI.closeOverlay(overlay);
                    resolve({ priv, broad });
                };
                
                document.getElementById("ab-delay-cancel").onclick = () => {
                    CustomUI.closeOverlay(overlay);
                    resolve(null);
                };
            });
        },
        selectProfile: (profiles) => {
            return new Promise(resolve => {
                const overlay = CustomUI.createOverlay(true);
                const btnHtml = profiles.map(p => 
                    `<button class="ab-btn" style="margin-bottom:8px" data-profile="${p}">Profile: ${p.replace(CONFIG.STORAGE_PREFIX, "")}</button>`
                ).join("");
                
                overlay.innerHTML = `
                    <div class="ab-modal small">
                        <div class="ab-header">
                            <h2>Select Profile</h2>
                            <div class="ab-close-icon" id="ab-prof-close">
                                <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                            </div>
                        </div>
                        <div class="ab-content">
                            ${btnHtml}
                        </div>
                    </div>
                `;
                
                overlay.querySelectorAll("[data-profile]").forEach(btn => {
                    btn.onclick = (e) => {
                        CustomUI.closeOverlay(overlay);
                        resolve(e.target.getAttribute("data-profile"));
                    };
                });
                
                document.getElementById("ab-prof-close").onclick = () => {
                    CustomUI.closeOverlay(overlay);
                    resolve(null);
                };
            });
        },
        
        showMainWindow: (profileKey, allProfiles) => {
            if (CustomUI.overlay) return; 
            CustomUI.activeProfileKey = profileKey;
            
            const overlay = CustomUI.createOverlay(true);
            CustomUI.overlay = overlay;
            
            overlay.innerHTML = `
                <div class="ab-modal large">
                    <div class="ab-header">
                        <h2>
                            <svg style="width:20px;height:20px;fill:var(--ab-accent);" viewBox="0 0 24 24"><path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/></svg>
                            AgencyBooster Manager <span style="font-size:12px;color:var(--ab-text-dim);font-weight:normal;margin-left:8px;">[v${CONFIG.DIAGNOSTICS_VERSION} - ${profileKey.replace(CONFIG.STORAGE_PREFIX, "")}]</span>
                        </h2>
                        <div class="ab-close-icon" id="ab-main-close">
                            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </div>
                    </div>
                    <div class="ab-tabs">
                        <div class="ab-tab active" data-target="dashboard">Dashboard</div>
                        <div class="ab-tab" data-target="manager">Manager</div>
                        <div class="ab-tab" data-target="diagnostics">Diagnostics</div>
                    </div>
                    
                    <div id="ab-view-dashboard" class="ab-content"></div>
                    <div id="ab-view-manager" class="ab-content" style="display:none;"></div>
                    <div id="ab-view-diagnostics" class="ab-content" style="display:none;"></div>
                </div>
            `;

            const tabs = overlay.querySelectorAll(".ab-tab");
            tabs.forEach(tab => {
                tab.onclick = () => {
                    tabs.forEach(t => t.classList.remove("active"));
                    tab.classList.add("active");
                    
                    ['dashboard', 'manager', 'diagnostics'].forEach(view => {
                        document.getElementById(`ab-view-${view}`).style.display = 'none';
                    });
                    
                    const target = tab.getAttribute("data-target");
                    document.getElementById(`ab-view-${target}`).style.display = 'flex';
                    
                    if (target === 'dashboard') CustomUI.updateDashboard();
                    if (target === 'diagnostics') CustomUI.buildDiagnosticsView(allProfiles);
                };
            });

            document.getElementById("ab-main-close").onclick = () => {
                clearInterval(CustomUI.dashboardInterval);
                CustomUI.closeOverlay(CustomUI.overlay);
                CustomUI.overlay = null;
            };

            CustomUI.buildManagerView();
            CustomUI.buildDiagnosticsView(allProfiles);
            CustomUI.updateDashboard();
            
            CustomUI.dashboardInterval = setInterval(() => {
                if (document.getElementById("ab-view-dashboard").style.display !== 'none') {
                    CustomUI.updateDashboard();
                }
            }, CONFIG.DASHBOARD_POLL_MS);
        },

        updateDashboard: () => {
            const live = DataProvider.refresh(CustomUI.activeProfileKey).live;
            const dashView = document.getElementById("ab-view-dashboard");
            if (!dashView) return;

            const badge = (r) => {
                const color = r.confidence === "high" ? "var(--ab-success)" : r.confidence === "medium" ? "var(--ab-accent)" : r.confidence === "low" ? "var(--ab-warning)" : "var(--ab-text-dim)";
                return `<span style="font-size:9px;color:${color};font-weight:normal;margin-left:4px;">[${r.source}/${r.confidence}]</span>`;
            };
            const delayStr = (r) => (r.value === CONFIG.TEXT.UNKNOWN || r.value === CONFIG.TEXT.NOT_AVAILABLE) ? CONFIG.TEXT.NOT_AVAILABLE : `${r.value} sec`;

            dashView.innerHTML = `
                <div class="ab-grid">
                    <div class="ab-card">
                        <div class="ab-card-title">IceBreaker Status${badge(live.ibStatus)}</div>
                        <div class="ab-card-value">${live.ibStatus.value}</div>
                    </div>
                    <div class="ab-card">
                        <div class="ab-card-title">Broadcast Status${badge(live.brStatus)}</div>
                        <div class="ab-card-value">${live.brStatus.value}</div>
                    </div>
                    
                    <div class="ab-card">
                        <div class="ab-card-title">Private Delay${badge(live.privDelay)}</div>
                        <div class="ab-card-value">${delayStr(live.privDelay)}</div>
                    </div>
                    <div class="ab-card">
                        <div class="ab-card-title">Broadcast Delay${badge(live.broadDelay)}</div>
                        <div class="ab-card-value">${delayStr(live.broadDelay)}</div>
                    </div>

                    <div class="ab-card">
                        <div class="ab-card-title">IceBreaker Progress${badge(live.ibInProgress)}</div>
                        <div class="ab-card-value" style="font-size:13px; font-weight:normal;">
                            <div style="margin-top:2px;">In Progress: <strong style="color:var(--ab-text)">${live.ibInProgress.value}</strong></div>
                            <div style="margin-top:4px;">Completed: <strong style="color:var(--ab-text)">${live.ibCompleted.value}</strong></div>
                        </div>
                    </div>
                    <div class="ab-card">
                        <div class="ab-card-title">Broadcast Progress${badge(live.brInProgress)}</div>
                        <div class="ab-card-value" style="font-size:13px; font-weight:normal;">
                            <div style="margin-top:2px;">In Progress: <strong style="color:var(--ab-text)">${live.brInProgress.value}</strong></div>
                            <div style="margin-top:4px;">Completed: <strong style="color:var(--ab-text)">${live.brCompleted.value}</strong></div>
                        </div>
                    </div>
                </div>
            `;
        },

        buildManagerView: () => {
            const mgrView = document.getElementById("ab-view-manager");
            mgrView.innerHTML = `
                <div style="text-align:center; color:var(--ab-text-dim); font-size:13px; margin-bottom: 8px;">
                    Execute core operations safely. State will be backed up automatically before changes.
                </div>
                <button class="ab-btn" id="ab-action-reset">
                    <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
                    Reset IceBreaker
                </button>
                <button class="ab-btn danger" id="ab-action-newshift">
                    <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4ZM6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V8H6V19Z"/></svg>
                    New Shift
                </button>
                <div style="border-top:1px solid var(--ab-border); margin: 8px 0;"></div>
                <button class="ab-btn primary" id="ab-action-delays">
                    <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                    Change Delays
                </button>
                <div style="border-top:1px solid var(--ab-border); margin: 8px 0;"></div>
                <input type="file" id="ab-file-import" accept=".txt" style="display:none;" />
                <button class="ab-btn" id="ab-action-import">
                    <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                    Import Snippets
                </button>
                <div style="border-top:1px solid var(--ab-border); margin: 8px 0;"></div>
                <button class="ab-btn" id="ab-action-finance">
                    <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
                    Finance Widget
                </button>
            `;
            
            document.getElementById("ab-action-reset").onclick = () => App.handleReset();
            document.getElementById("ab-action-newshift").onclick = () => App.handleNewShift();
            document.getElementById("ab-action-delays").onclick = () => App.handleChangeDelays();
            
            document.getElementById("ab-action-import").onclick = () => {
                document.getElementById("ab-file-import").click();
            };
            
            document.getElementById("ab-file-import").onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    App.handleImportSnippets(file);
                    e.target.value = ""; 
                }
            };

            document.getElementById("ab-action-finance").onclick = () => {
                CustomUI.showFinanceWidget();
            };
        },

        buildDiagnosticsView: (allProfiles) => {
            const diagView = document.getElementById("ab-view-diagnostics");
            if (!diagView) return;

            const diagObj = Diagnostics.getDiagnosticsObj(CustomUI.activeProfileKey, allProfiles);
            
            let html = `<div style="display:flex; gap:10px; margin-bottom:16px;">
                <button class="ab-btn primary" id="ab-copy-report">Copy Report</button>
                <button class="ab-btn" id="ab-copy-json">Copy JSON</button>
                <button class="ab-btn" id="ab-copy-bundle">Copy Debug Bundle</button>
            </div>`;

            for (const [groupName, groupData] of Object.entries(diagObj)) {
                html += `
                    <div class="ab-diag-group">
                        <h3>${groupName}</h3>
                        <table class="ab-table"><tbody>
                            ${Object.entries(groupData).map(([k, v]) => `<tr><td>${k}</td><td>${typeof v === "object" ? JSON.stringify(v) : v}</td></tr>`).join("")}
                        </tbody></table>
                    </div>
                `;
            }
            
            diagView.innerHTML = html;

            document.getElementById("ab-copy-report").onclick = () => {
                const reportText = Diagnostics.generateTextReport(CustomUI.activeProfileKey, allProfiles);
                navigator.clipboard.writeText(reportText).then(() => {
                    CustomUI.showToast("Report copied to clipboard!");
                });
            };

            document.getElementById("ab-copy-json").onclick = () => {
                navigator.clipboard.writeText(JSON.stringify(diagObj, null, 2)).then(() => {
                    CustomUI.showToast("JSON copied to clipboard!");
                });
            };

            document.getElementById("ab-copy-bundle").onclick = () => {
                const bundle = Diagnostics.exportDebugBundle(CustomUI.activeProfileKey, allProfiles);
                const bundleStr = JSON.stringify(bundle, null, 2);
                navigator.clipboard.writeText(bundleStr).then(() => {
                    CustomUI.showToast("Debug bundle copied to clipboard!");
                });
            };
        },

        initFloatingButton: () => {
            DOMManager.removeElements("#ab-floating-btn");

            if (window !== window.top) return;

            const btn = document.createElement("button");
            btn.id = "ab-floating-btn";
            btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 13h6c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1zm0 8h6c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1zm10 0h6c.55 0 1-.45 1-1v-8c0-.55-.45-1-1-1h-6c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1zM13 4v4c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1h-6c-.55 0-1 .45-1 1z"/></svg>`;
            
            DOMManager.appendBody(btn);
            btn.onclick = () => App.openMenu();
        },

        buildFinanceWidget: () => {
            DOMManager.removeElements("#ab-finance-widget");
            if (window !== window.top) return;

            const state = FinanceManager.readState();
            if (state.closed) return;

            const widget = document.createElement("div");
            widget.id = "ab-finance-widget";
            widget.classList.add(state.collapsed ? "ab-finance-collapsed" : "ab-finance-expanded");

            if (state.x !== null && state.y !== null) {
                widget.style.left = state.x + "px";
                widget.style.top = state.y + "px";
                widget.style.bottom = "auto";
            }

            CustomUI._renderFinanceWidget(widget, state);
            DOMManager.appendBody(widget);
            CustomUI._initFinanceDrag(widget);
        },

        _renderFinanceWidget: (widget, state) => {
            const shift = FinanceManager.getShiftPeriod();
            const periodDisplay = shift && shift.start && shift.end
                ? `${new Date(shift.start).toLocaleString()} — ${new Date(shift.end).toLocaleString()}`
                : "All Time";

            const creditsDisplay = state.credits !== null
                ? `<span class="ab-finance-value ab-finance-accent">${state.credits.toLocaleString()}</span>`
                : `<span class="ab-finance-value" style="color:var(--ab-text-dim)">—</span>`;

            const transactions = Array.isArray(state.transactions) ? state.transactions : [];
            let txTableHtml = "";
            if (transactions.length > 0) {
                const rows = transactions.map(tx => `
                    <div class="ab-finance-tx-row">
                        <span class="ab-finance-tx-cell">${tx.date || "—"}</span>
                        <span class="ab-finance-tx-cell">${tx.time || "—"}</span>
                        <span class="ab-finance-tx-cell ab-finance-tx-op">${tx.operation || "—"}</span>
                        <span class="ab-finance-tx-cell">${tx.target || "—"}</span>
                        <span class="ab-finance-tx-cell" style="font-weight:600;color:var(--ab-accent)">${tx.credits || "—"}</span>
                    </div>
                `).join("");
                txTableHtml = `
                    <div class="ab-finance-tx-header">
                        <span class="ab-finance-tx-cell">Date</span>
                        <span class="ab-finance-tx-cell">Time</span>
                        <span class="ab-finance-tx-cell">Op</span>
                        <span class="ab-finance-tx-cell">Target</span>
                        <span class="ab-finance-tx-cell">Cr</span>
                    </div>
                    ${rows}
                `;
            } else {
                txTableHtml = `<div style="text-align:center;color:var(--ab-text-dim);font-size:10px;padding:6px 0;">No transactions</div>`;
            }

            const lastRefreshDisplay = state.lastRefresh
                ? new Date(state.lastRefresh).toLocaleTimeString()
                : "Never";

            const statusDisplay = state.lastStatus === "ok"
                ? `<span class="ab-finance-status" style="color:var(--ab-success)">Last refresh: ${lastRefreshDisplay}</span>`
                : state.lastStatus === "error"
                    ? `<span class="ab-finance-status" style="color:var(--ab-danger)">Refresh failed</span>`
                    : `<span class="ab-finance-status">Last refresh: ${lastRefreshDisplay}</span>`;

            const collapseIcon = state.collapsed
                ? `<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>`
                : `<svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>`;

            widget.innerHTML = `
                <div class="ab-finance-header" id="ab-finance-drag-handle">
                    <div class="ab-finance-header-title">
                        <svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
                        Finance
                    </div>
                    <div class="ab-finance-header-actions">
                        <button id="ab-finance-toggle" title="Collapse/Expand">${collapseIcon}</button>
                        <button id="ab-finance-close" title="Close widget">
                            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                    </div>
                </div>
                <div class="ab-finance-body">
                    <div class="ab-finance-row">
                        <span class="ab-finance-label">Credits</span>
                        ${creditsDisplay}
                    </div>
                    <div class="ab-finance-row">
                        <span class="ab-finance-label">Period</span>
                        <span class="ab-finance-value" style="font-size:10px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${periodDisplay}">${periodDisplay}</span>
                    </div>
                    <div class="ab-finance-btn-row">
                        <button class="ab-finance-btn" id="ab-finance-set-period">Set</button>
                        <button class="ab-finance-btn" id="ab-finance-clear-period">Clear</button>
                    </div>
                    <div class="ab-finance-divider"></div>
                    <div class="ab-finance-tx-container">
                        ${txTableHtml}
                    </div>
                    <div class="ab-finance-divider"></div>
                    <div class="ab-finance-btn-row">
                        <button class="ab-finance-btn primary" id="ab-finance-refresh">
                            <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                            Refresh
                        </button>
                    </div>
                    ${statusDisplay}
                </div>
            `;

            widget.querySelector("#ab-finance-toggle").onclick = () => {
                const s = FinanceManager.readState();
                s.collapsed = !s.collapsed;
                FinanceManager.writeState(s);
                widget.classList.toggle("ab-finance-collapsed", s.collapsed);
                widget.classList.toggle("ab-finance-expanded", !s.collapsed);
                const icon = s.collapsed
                    ? `<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>`
                    : `<svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>`;
                widget.querySelector("#ab-finance-toggle").innerHTML = icon;
            };

            widget.querySelector("#ab-finance-close").onclick = () => {
                const s = FinanceManager.readState();
                s.closed = true;
                FinanceManager.writeState(s);
                widget.classList.add("ab-finance-hidden");
            };

            widget.querySelector("#ab-finance-refresh").onclick = () => App.handleFinanceRefresh();

            widget.querySelector("#ab-finance-set-period").onclick = () => CustomUI.showShiftPeriodModal();

            widget.querySelector("#ab-finance-clear-period").onclick = () => {
                FinanceManager.clearShiftPeriod();
                CustomUI.updateFinanceWidget();
            };
        },

        _initFinanceDrag: (widget) => {
            const handle = widget.querySelector("#ab-finance-drag-handle");
            if (!handle) return;
            let isDragging = false;
            let startX, startY, origX, origY;

            const onMouseMove = (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const newX = origX + (e.clientX - startX);
                const newY = origY + (e.clientY - startY);
                widget.style.left = newX + "px";
                widget.style.top = newY + "px";
                widget.style.bottom = "auto";
            };

            const onMouseUp = () => {
                if (!isDragging) return;
                isDragging = false;
                handle.style.cursor = "grab";
                const rect = widget.getBoundingClientRect();
                const s = FinanceManager.readState();
                s.x = rect.left;
                s.y = rect.top;
                FinanceManager.writeState(s);
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            handle.addEventListener("mousedown", (e) => {
                if (e.target.closest("button") || e.target.closest("select")) return;
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = widget.getBoundingClientRect();
                origX = rect.left;
                origY = rect.top;
                handle.style.cursor = "grabbing";
                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
            });
        },

        showFinanceWidget: () => {
            const s = FinanceManager.readState();
            s.closed = false;
            FinanceManager.writeState(s);
            CustomUI.buildFinanceWidget();
        },

        showShiftPeriodModal: () => {
            return new Promise(resolve => {
                const existing = FinanceManager.getShiftPeriod();
                const overlay = CustomUI.createOverlay();
                overlay.innerHTML = `
                    <div class="ab-modal small">
                        <div class="ab-header">
                            <h2>Shift Period</h2>
                            <div class="ab-close-icon" id="ab-shift-close">
                                <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                            </div>
                        </div>
                        <div class="ab-content">
                            <div class="ab-input-group">
                                <label>Start Date & Time</label>
                                <input type="datetime-local" id="ab-shift-start" value="${existing && existing.start ? existing.start : ""}">
                            </div>
                            <div class="ab-input-group">
                                <label>End Date & Time</label>
                                <input type="datetime-local" id="ab-shift-end" value="${existing && existing.end ? existing.end : ""}">
                            </div>
                            <div class="ab-row">
                                <button class="ab-btn primary" id="ab-shift-apply">Apply</button>
                                <button class="ab-btn" id="ab-shift-cancel">Cancel</button>
                            </div>
                        </div>
                    </div>
                `;

                document.getElementById("ab-shift-apply").onclick = () => {
                    const start = document.getElementById("ab-shift-start").value;
                    const end = document.getElementById("ab-shift-end").value;
                    if (!start || !end) {
                        CustomUI.showAlert("Both start and end are required.");
                        return;
                    }
                    if (new Date(start) >= new Date(end)) {
                        CustomUI.showAlert("Start must be before end.");
                        return;
                    }
                    FinanceManager.setShiftPeriod(start, end);
                    CustomUI.closeOverlay(overlay);
                    CustomUI.updateFinanceWidget();
                    resolve(true);
                };

                document.getElementById("ab-shift-cancel").onclick = () => {
                    CustomUI.closeOverlay(overlay);
                    resolve(false);
                };

                document.getElementById("ab-shift-close").onclick = () => {
                    CustomUI.closeOverlay(overlay);
                    resolve(false);
                };
            });
        },

        updateFinanceWidget: () => {
            const widget = document.getElementById("ab-finance-widget");
            if (!widget) return;
            const state = FinanceManager.getCachedState();
            CustomUI._renderFinanceWidget(widget, state);
            widget.classList.toggle("ab-finance-collapsed", state.collapsed);
            widget.classList.toggle("ab-finance-expanded", !state.collapsed);
        }
    };

    // --- APPLICATION LOGIC ---

    const App = {
        getProfile: async () => {
            const profiles = StorageManager.getAllProfiles();
            if (profiles.length === 0) {
                await CustomUI.showAlert("No valid chat-sender profiles found.");
                return null;
            }
            if (profiles.length === 1) return profiles[0];
            return await CustomUI.selectProfile(profiles);
        },
        
        processOperation: async (profileKey, successMsg) => {
            const data = StorageManager.readProfile(profileKey);
            if (!Validator.isValidProfile(data)) {
                await CustomUI.showAlert(CONFIG.TEXT.INVALID_PROFILE);
                return false;
            }

            if (!await SenderManager.stopSenderSafely()) {
                if (!await CustomUI.showConfirm(CONFIG.TEXT.CONFIRM_FORCE)) return false;
            }
            
            return true;
        },
        
        handleReset: async () => {
            const pk = CustomUI.activeProfileKey;
            if (!await App.processOperation(pk, "")) return;
            
            const ok = await StorageManager.runTransaction(pk, async (m) => ResetManager.resetIceBreaker(m));
            if (ok) {
                await CustomUI.showAlert("IceBreaker reset successfully. Reloading...");
                window.location.reload();
            } else {
                await CustomUI.showAlert(CONFIG.TEXT.OP_FAILED);
            }
        },

        handleNewShift: async () => {
            const pk = CustomUI.activeProfileKey;
            if (!await App.processOperation(pk, "")) return;
            
            const ok = await StorageManager.runTransaction(pk, async (m) => ResetManager.newShift(m));
            if (ok) {
                await CustomUI.showAlert("New Shift started. Reloading...");
                window.location.reload();
            } else {
                await CustomUI.showAlert(CONFIG.TEXT.OP_FAILED);
            }
        },

        handleChangeDelays: async () => {
            const pk = CustomUI.activeProfileKey;
            const data = StorageManager.readProfile(pk);
            if (!Validator.isValidProfile(data)) {
                await CustomUI.showAlert(CONFIG.TEXT.INVALID_PROFILE);
                return;
            }
            
            const ibStatus = StateManager.getModuleStatus(data, 'icebreaker');
            const brStatus = StateManager.getModuleStatus(data, 'broadcast');
            
            if (StateManager.isEngineActive(ibStatus) || StateManager.isEngineActive(brStatus)) {
                await CustomUI.showAlert(CONFIG.TEXT.STOP_REQUIRED);
                return;
            }

            if (!await SenderManager.stopSenderSafely()) {
                if (!await CustomUI.showConfirm(CONFIG.TEXT.CONFIRM_FORCE)) return;
            }

            const delays = await CustomUI.showDelayModal();
            if (!delays) return;
            
            const ok = await StorageManager.runTransaction(pk, async (m) => {
                return DelayManager.applyDelays(m, delays.priv, delays.broad);
            });
            
            if (ok) {
                await CustomUI.showAlert("Delays successfully updated and verified.");
            } else {
                await CustomUI.showAlert(CONFIG.TEXT.OP_FAILED);
            }
        },

        handleImportSnippets: async (file) => {
            const pk = CustomUI.activeProfileKey;
            if (!await App.processOperation(pk, "")) return;

            const fileType = SnippetImporter.detectFileType(file.name);
            if (fileType === "unknown") {
                await CustomUI.showAlert(CONFIG.TEXT.IMPORT_UNSUPPORTED);
                return;
            }

            const reader = new FileReader();
            reader.onload = async (ev) => {
                const rawText = ev.target.result;
                const parsed = SnippetImporter.parseFile(rawText);

                if (parsed.private.length === 0 && parsed.broadcast.length === 0) {
                    await CustomUI.showAlert(CONFIG.TEXT.IMPORT_EMPTY);
                    SnippetImporter.recordImport({ imported: 0, invalid: 0, status: "empty" });
                    return;
                }

                const existingData = StorageManager.readProfile(pk) || {};
                const preview = SnippetImporter.buildPreview(parsed, existingData);

                const previewLines = [];
                previewLines.push(`<strong>Import Preview (TXT):</strong>`);
                previewLines.push(``);
                previewLines.push(`Private snippets: ${preview.privateCount}`);
                previewLines.push(`Broadcast snippets: ${preview.broadcastCount}`);
                previewLines.push(``);
                previewLines.push(`<strong>Current:</strong> Private: ${preview.existingPrivateCount} | Broadcast: ${preview.existingBroadcastCount}`);
                previewLines.push(``);
                previewLines.push(`This will REPLACE all current snippets. Proceed?`);

                const confirmed = await CustomUI.showConfirm(previewLines.join("<br>"));
                if (!confirmed) {
                    SnippetImporter.recordImport({ imported: 0, invalid: 0, status: "cancelled" });
                    return;
                }

                const stats = await SnippetImporter.executeImport(pk, parsed);
                SnippetImporter.recordImport(stats);

                if (stats.status === "success") {
                    await CustomUI.showAlert(
                        `<strong>Import Complete:</strong><br>` +
                        `Imported: ${stats.imported}<br>` +
                        `Private: ${preview.privateCount} | Broadcast: ${preview.broadcastCount}`
                    );
                } else {
                    await CustomUI.showAlert(CONFIG.TEXT.OP_FAILED);
                }
            };

            reader.onerror = async () => {
                await CustomUI.showAlert(CONFIG.TEXT.FILE_READ_ERROR);
            };

            reader.readAsText(file, "UTF-8");
        },

        handleFinanceRefresh: async () => {
            const refreshBtn = document.getElementById("ab-finance-refresh");
            if (refreshBtn) {
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:11px;height:11px;fill:currentColor;animation:ab-spin 1s linear infinite"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg> Loading...`;
            }
            DataProvider.invalidate();
            const docs = DataProvider.refresh(CustomUI.activeProfileKey).docs;
            await FinanceManager.fetchFinanceData(docs);
            CustomUI.updateFinanceWidget();
        },

        openMenu: async () => {
            const profileKey = await App.getProfile();
            if (!profileKey) return;
            CustomUI.showMainWindow(profileKey, StorageManager.getAllProfiles());
        },
        
        start: () => {
            CustomUI.injectCSS();
            CustomUI.initFloatingButton();
            CustomUI.buildFinanceWidget();

            if (!window.__AB_MONITOR_SET__) {
                window.__AB_MONITOR_SET__ = true;
                setInterval(() => {
                    const btn = document.getElementById("ab-floating-btn");
                    if (!btn && window === window.top) {
                        CustomUI.initFloatingButton();
                    }
                }, CONFIG.BUTTON_POLL_MS);
            }
        }
    };

    if (document.readyState === "complete" || document.readyState === "interactive") {
        App.start();
    } else {
        window.addEventListener("DOMContentLoaded", App.start);
    }

})();