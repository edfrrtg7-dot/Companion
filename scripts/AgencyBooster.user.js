// ==UserScript==
// @name         AgencyBooster Manager
// @namespace    http://tampermonkey.net/
// @version      1.5.4
// @description  Enterprise-grade management utility for AgencyBooster. Dashboard Accuracy Fix.
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
            DIAGNOSTICS_VERSION: "1.5.4",
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
            BACKUP_FAILED: "Backup failed: storage is full. Old backups were removed, but there is still not enough space."
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
        isEngineActive: (status) => {
            return status === "Running" || status === "Progress" || status === "Paused";
        }
    };

    const ResetManager = {
        resetIceBreaker: (data) => {
            const chain = data.chainProgress || {};
            const cleanChain = {};
            if (typeof chain === "object" && !Array.isArray(chain)) {
                for (const [id, value] of Object.entries(chain)) {
                    if (value && value.channel !== "private") {
                        cleanChain[id] = value;
                    }
                }
            }
            data.chainProgress = cleanChain;
            data.sended = Object.keys(cleanChain).join(";");
            data.status = "stopped";
            return true;
        },
        newShift: (data) => {
            data.chainProgress = {};
            data.sended = "";
            data.delivered = "";
            data.status = "stopped";
            if (data.broadcast && typeof data.broadcast === "object") {
                data.broadcast.status = "stopped";
            }
            return true;
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
            if (typeof SnapshotAPI !== "undefined") modules.push("SnapshotAPI");
            if (typeof SenderManager !== "undefined") modules.push("SenderManager");
            if (typeof StateManager !== "undefined") modules.push("StateManager");
            if (typeof ResetManager !== "undefined") modules.push("ResetManager");
            if (typeof DelayManager !== "undefined") modules.push("DelayManager");
            if (typeof SnippetManager !== "undefined") modules.push("SnippetManager");
            if (typeof DOMScanner !== "undefined") modules.push("DOMScanner");
            if (typeof Validator !== "undefined") modules.push("Validator");
            if (typeof CustomUI !== "undefined") modules.push("CustomUI");
            if (typeof App !== "undefined") modules.push("App");
            return modules;
        },
        getDiagnosticsObj: (profileKey, allProfiles) => {
            const live = LiveReader.readAll(profileKey);
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
            const chainSize = data.chainProgress ? Object.keys(data.chainProgress).length : 0;
            const deliveredCount = data.delivered ? data.delivered.split(';').filter(Boolean).length : 0;
            const sendedCount = data.sended ? data.sended.split(';').filter(Boolean).length : 0;

            const dashboardFields = ["ibStatus", "brStatus", "privDelay", "broadDelay", "ibInProgress", "ibCompleted", "brInProgress", "brCompleted"];
            const liveReaderSection = {};
            for (const field of dashboardFields) {
                const r = live[field];
                liveReaderSection[`${field} value`] = r.value;
                liveReaderSection[`${field} displayed`] = (field === "privDelay" || field === "broadDelay")
                    ? ((r.value === CONFIG.TEXT.UNKNOWN || r.value === CONFIG.TEXT.NOT_AVAILABLE) ? CONFIG.TEXT.NOT_AVAILABLE : `${r.value} sec`)
                    : r.value;
                liveReaderSection[`${field} source`] = r.source;
                liveReaderSection[`${field} confidence`] = r.confidence;
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
            const live = LiveReader.readAll(profileKey);
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
3. DASHBOARD VALUES (LiveReader)
----------------------------------------
IB Status           : ${vs(live.ibStatus)}
BR Status           : ${vs(live.brStatus)}
Private Delay       : ${vs(live.privDelay)}
Broadcast Delay     : ${vs(live.broadDelay)}
IB In Progress      : ${vs(live.ibInProgress)}
IB Completed        : ${vs(live.ibCompleted)}
BR In Progress      : ${vs(live.brInProgress)}
BR Completed        : ${vs(live.brCompleted)}

----------------------------------------
4. STORAGE
----------------------------------------
Usage               : ${diagObj.STORAGE["Storage usage"]} (${diagObj.STORAGE["Storage used %"]} of limit)
Storage health      : ${diagObj.STORAGE["Storage health"]}
Profile size        : ${diagObj.STORAGE["Profile size"]}
Backups             : ${diagObj.STORAGE["Backup count"]}
Total profiles      : ${diagObj.STORAGE["Total profiles"]}
All profiles        : ${diagObj.STORAGE["All profiles"]}
localStorage keys   : ${diagObj.STORAGE["localStorage keys"]}

----------------------------------------
5. DOM
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
6. RUNTIME
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
7. ERROR LOG
----------------------------------------
Error count         : ${diagObj["ERROR LOG"]["Error count"]}
${diagObj["ERROR LOG"]["Status"] ? `Status              : ${diagObj["ERROR LOG"]["Status"]}` : `Last error          : ${diagObj["ERROR LOG"]["Last error message"]}`}
Recent errors:
${errorLines}
=======================================`;
        },
        exportDebugBundle: (profileKey, allProfiles) => {
            const live = LiveReader.readAll(profileKey);
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
                    ibStatus: { value: live.ibStatus.value, source: live.ibStatus.source, confidence: live.ibStatus.confidence },
                    brStatus: { value: live.brStatus.value, source: live.brStatus.source, confidence: live.brStatus.confidence },
                    privDelay: { value: live.privDelay.value, source: live.privDelay.source, confidence: live.privDelay.confidence },
                    broadDelay: { value: live.broadDelay.value, source: live.broadDelay.source, confidence: live.broadDelay.confidence },
                    ibInProgress: { value: live.ibInProgress.value, source: live.ibInProgress.source, confidence: live.ibInProgress.confidence },
                    ibCompleted: { value: live.ibCompleted.value, source: live.ibCompleted.source, confidence: live.ibCompleted.confidence },
                    brInProgress: { value: live.brInProgress.value, source: live.brInProgress.source, confidence: live.brInProgress.confidence },
                    brCompleted: { value: live.brCompleted.value, source: live.brCompleted.source, confidence: live.brCompleted.confidence }
                },
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
            DOM_DIRECT: "dom_direct",
            DOM_STRUCTURED: "dom_structured",
            LOCAL_STORAGE: "local_storage",
            DOM_TEXT: "dom_text",
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
        _textFallbackRegex: /(?:status|delay|in\s*progress|completed)\s*[:=]\s*([^\n<]{1,60})/gi,
        _findLabeledValue: (docs, labelVariants) => {
            for (const doc of docs) {
                try {
                    const allElements = doc.querySelectorAll("span, div, td, p, label, strong, b, em, h1, h2, h3, h4, h5, h6, input, textarea");
                    for (const el of allElements) {
                        const text = (el.textContent || "").trim();
                        for (const variant of labelVariants) {
                            const lowerText = text.toLowerCase();
                            const lowerVariant = variant.toLowerCase();
                            if (lowerText.startsWith(lowerVariant)) {
                                const after = text.substring(variant.length).replace(/^[\s:=]+/, "").trim();
                                if (after.length > 0 && after.length < 80) return after;
                            }
                        }
                        const label = el.previousElementSibling || el.parentElement;
                        if (label) {
                            const labelText = (label.textContent || "").trim().toLowerCase();
                            for (const variant of labelVariants) {
                                if (labelText.includes(variant.toLowerCase())) {
                                    const val = text.replace(/^[\s:=]+/, "").trim();
                                    if (val.length > 0 && val.length < 80) return val;
                                }
                            }
                        }
                    }
                } catch {}
            }
            return null;
        },
        _extractNumber: (raw) => {
            if (raw === null || raw === undefined) return null;
            const str = String(raw).trim();
            const num = parseInt(str, 10);
            return isNaN(num) ? null : num;
        },
        _resolveStatus: (raw) => {
            if (!raw) return null;
            const s = raw.toLowerCase();
            if (s.includes("running")) return "Running";
            if (s.includes("stopped") || s.includes("stop")) return "Stopped";
            if (s.includes("progress")) return "Progress";
            if (s.includes("paused") || s.includes("pause")) return "Paused";
            return null;
        },
        _resolveDelay: (raw) => {
            if (!raw) return null;
            const cleaned = raw.replace(/[^\d.]/g, "");
            const num = parseFloat(cleaned);
            return isNaN(num) ? null : num;
        },
        _providerDOMDirect: (docs) => {
            const result = {};
            const tryFind = (selectors, transform) => {
                for (const doc of docs) {
                    try {
                        for (const sel of selectors) {
                            const el = doc.querySelector(sel);
                            if (el) {
                                const raw = (el.value !== undefined ? el.value : el.textContent || "").trim();
                                return transform ? transform(raw) : raw;
                            }
                        }
                    } catch {}
                }
                return null;
            };
            result.ibStatus = tryFind(
                ["[data-module='icebreaker'][data-field='status']", "[data-ib-status]", ".ib-status", "#ib-status"],
                LiveReader._resolveStatus
            );
            result.brStatus = tryFind(
                ["[data-module='broadcast'][data-field='status']", "[data-br-status]", ".br-status", "#br-status"],
                LiveReader._resolveStatus
            );
            result.privDelay = tryFind(
                ["[data-module='icebreaker'][data-field='delay']", "[data-ib-delay]", ".ib-delay", "#ib-delay"],
                LiveReader._resolveDelay
            );
            result.broadDelay = tryFind(
                ["[data-module='broadcast'][data-field='delay']", "[data-br-delay]", ".br-delay", "#br-delay"],
                LiveReader._resolveDelay
            );
            result.ibInProgress = tryFind(
                ["[data-module='icebreaker'][data-field='inprogress']", "[data-ib-inprogress]", ".ib-inprogress", "#ib-inprogress"],
                LiveReader._extractNumber
            );
            result.ibCompleted = tryFind(
                ["[data-module='icebreaker'][data-field='completed']", "[data-ib-completed]", ".ib-completed", "#ib-completed"],
                LiveReader._extractNumber
            );
            result.brInProgress = tryFind(
                ["[data-module='broadcast'][data-field='inprogress']", "[data-br-inprogress]", ".br-inprogress", "#br-inprogress"],
                LiveReader._extractNumber
            );
            result.brCompleted = tryFind(
                ["[data-module='broadcast'][data-field='completed']", "[data-br-completed]", ".br-completed", "#br-completed"],
                LiveReader._extractNumber
            );
            return result;
        },
        _providerDOMStructured: (docs) => {
            const result = {};
            result.ibStatus = LiveReader._resolveStatus(
                LiveReader._findLabeledValue(docs, ["IceBreaker Status", "IB Status", "Private Status"])
            );
            result.brStatus = LiveReader._resolveStatus(
                LiveReader._findLabeledValue(docs, ["Broadcast Status", "BR Status", "Group Status"])
            );
            result.privDelay = LiveReader._resolveDelay(
                LiveReader._findLabeledValue(docs, ["Private Delay", "IB Delay", "IceBreaker Delay", "Private Interval"])
            );
            result.broadDelay = LiveReader._resolveDelay(
                LiveReader._findLabeledValue(docs, ["Broadcast Delay", "BR Delay", "Group Delay", "Broadcast Interval"])
            );
            result.ibInProgress = LiveReader._extractNumber(
                LiveReader._findLabeledValue(docs, ["IB In Progress", "IceBreaker In Progress", "Private In Progress", "IB Progressing"])
            );
            result.ibCompleted = LiveReader._extractNumber(
                LiveReader._findLabeledValue(docs, ["IB Completed", "IceBreaker Completed", "Private Completed", "IB Done"])
            );
            result.brInProgress = LiveReader._extractNumber(
                LiveReader._findLabeledValue(docs, ["BR In Progress", "Broadcast In Progress", "Group In Progress", "BR Progressing"])
            );
            result.brCompleted = LiveReader._extractNumber(
                LiveReader._findLabeledValue(docs, ["BR Completed", "Broadcast Completed", "Group Completed", "BR Done"])
            );
            return result;
        },
        _providerLocalStorage: (profileKey) => {
            const data = StorageManager.readProfile(profileKey) || {};
            const isSenderStopped = SenderManager.isStopped();

            const ibRaw = StateManager.getModuleStatus(data, "icebreaker");
            const ibStatus = (ibRaw === "Running" && isSenderStopped) ? "Stopped" : ibRaw;
            const brRaw = StateManager.getModuleStatus(data, "broadcast");
            const privRaw = StateManager.getDelayValue(data, "icebreaker");
            const broadRaw = StateManager.getDelayValue(data, "broadcast");

            return {
                ibStatus: ibRaw !== CONFIG.TEXT.UNKNOWN ? ibStatus : null,
                brStatus: brRaw !== CONFIG.TEXT.UNKNOWN ? brRaw : null,
                privDelay: privRaw !== CONFIG.TEXT.UNKNOWN ? privRaw : null,
                broadDelay: broadRaw !== CONFIG.TEXT.UNKNOWN ? broadRaw : null,
                ibInProgress: StateManager.getExactCount(data, "ibInProgress") !== CONFIG.TEXT.UNKNOWN ? StateManager.getExactCount(data, "ibInProgress") : null,
                ibCompleted: StateManager.getExactCount(data, "ibCompleted") !== CONFIG.TEXT.UNKNOWN ? StateManager.getExactCount(data, "ibCompleted") : null,
                brInProgress: StateManager.getExactCount(data, "brInProgress") !== CONFIG.TEXT.UNKNOWN ? StateManager.getExactCount(data, "brInProgress") : null,
                brCompleted: StateManager.getExactCount(data, "brCompleted") !== CONFIG.TEXT.UNKNOWN ? StateManager.getExactCount(data, "brCompleted") : null
            };
        },
        _providerDOMText: (docs) => {
            const result = {};
            const allText = [];
            for (const doc of docs) {
                try {
                    allText.push(doc.body ? doc.body.innerText : "");
                } catch {}
            }
            const blob = allText.join("\n");
            const matches = [];
            let m;
            const re = new RegExp(LiveReader._textFallbackRegex.source, "gi");
            while ((m = re.exec(blob)) !== null) {
                matches.push({ label: m[0].split(/[\s:=]/)[0].toLowerCase(), raw: m[1].trim() });
            }
            for (const match of matches) {
                const label = match.label;
                if (!result.ibStatus && (label.includes("icebreaker") || label.includes("ib") || label.includes("private")) && label.includes("status")) {
                    result.ibStatus = LiveReader._resolveStatus(match.raw);
                } else if (!result.brStatus && (label.includes("broadcast") || label.includes("br") || label.includes("group")) && label.includes("status")) {
                    result.brStatus = LiveReader._resolveStatus(match.raw);
                } else if (!result.privDelay && (label.includes("icebreaker") || label.includes("ib") || label.includes("private")) && label.includes("delay")) {
                    result.privDelay = LiveReader._resolveDelay(match.raw);
                } else if (!result.broadDelay && (label.includes("broadcast") || label.includes("br") || label.includes("group")) && label.includes("delay")) {
                    result.broadDelay = LiveReader._resolveDelay(match.raw);
                }
            }
            return result;
        },
        _mergeField: (providers, field) => {
            const order = [
                { data: providers.domDirect, source: LiveReader.SOURCES.DOM_DIRECT, confidence: LiveReader.CONFIDENCE.HIGH },
                { data: providers.domStructured, source: LiveReader.SOURCES.DOM_STRUCTURED, confidence: LiveReader.CONFIDENCE.MEDIUM },
                { data: providers.localStorage, source: LiveReader.SOURCES.LOCAL_STORAGE, confidence: LiveReader.CONFIDENCE.LOW },
                { data: providers.domText, source: LiveReader.SOURCES.DOM_TEXT, confidence: LiveReader.CONFIDENCE.LOW }
            ];
            for (const { data, source, confidence } of order) {
                if (data[field] !== null && data[field] !== undefined) {
                    return LiveReader._makeResult(data[field], source, confidence);
                }
            }
            return LiveReader._unknownResult();
        },
        readAll: (profileKey) => {
            const docs = DOMManager.getAccessibleDocuments(window);
            const providers = {
                domDirect: LiveReader._providerDOMDirect(docs),
                domStructured: LiveReader._providerDOMStructured(docs),
                localStorage: LiveReader._providerLocalStorage(profileKey),
                domText: LiveReader._providerDOMText(docs)
            };
            const fields = ["ibStatus", "brStatus", "privDelay", "broadDelay", "ibInProgress", "ibCompleted", "brInProgress", "brCompleted"];
            const result = {};
            for (const field of fields) {
                result[field] = LiveReader._mergeField(providers, field);
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
            const live = LiveReader.readAll(profileKey);
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
            const live = LiveReader.readAll(CustomUI.activeProfileKey);
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

            const reader = new FileReader();
            reader.onload = async (ev) => {
                const rawText = ev.target.result;
                const parsed = SnippetManager.parseText(rawText);
                
                if (parsed.private.length === 0 && parsed.broadcast.length === 0) {
                    await CustomUI.showAlert(CONFIG.TEXT.IMPORT_EMPTY);
                    return;
                }

                const ok = await StorageManager.runTransaction(pk, async (data) => {
                    if (parsed.private.length > 0) {
                        const privDelay = StateManager.getDelayValue(data, 'icebreaker');
                        const dVal = privDelay !== CONFIG.TEXT.UNKNOWN ? privDelay : CONFIG.DEFAULT_DELAY;
                        data.messages = SnippetManager.buildMessages(parsed.private, data.messages, dVal);
                    }
                    
                    if (parsed.broadcast.length > 0) {
                        if (!data.broadcast) data.broadcast = {};
                        const brDelay = StateManager.getDelayValue(data, 'broadcast');
                        const dVal = brDelay !== CONFIG.TEXT.UNKNOWN ? brDelay : CONFIG.DEFAULT_DELAY;
                        data.broadcast.messages = SnippetManager.buildMessages(parsed.broadcast, data.broadcast.messages, dVal);
                    }
                    return true;
                });
                
                if (ok) {
                    await CustomUI.showAlert(`<strong>Imported:</strong><br>Private: ${parsed.private.length}<br>Broadcast: ${parsed.broadcast.length}`);
                } else {
                    await CustomUI.showAlert(CONFIG.TEXT.OP_FAILED);
                }
            };
            
            reader.onerror = async () => {
                await CustomUI.showAlert(CONFIG.TEXT.FILE_READ_ERROR);
            };
            
            reader.readAsText(file, "UTF-8");
        },

        openMenu: async () => {
            const profileKey = await App.getProfile();
            if (!profileKey) return;
            CustomUI.showMainWindow(profileKey, StorageManager.getAllProfiles());
        },
        
        start: () => {
            CustomUI.injectCSS();
            CustomUI.initFloatingButton();

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