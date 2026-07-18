// ==UserScript==
// @name         AgencyBooster Manager
// @namespace    http://tampermonkey.net/
// @version      1.4.2
// @description  Enterprise-grade management utility for AgencyBooster. Stabilization Phase.
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
        DIAGNOSTICS_VERSION: "1.4.2",
        DELAY_PROPERTIES: ["intervalSeconds", "delay", "interval", "timeout", "seconds"],
        SELECTORS: {
            START: "start",
            STOP: "stop"
        },
        TEXT: {
            UNKNOWN: "Unknown",
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
        info: (msg, data = "") => {
            if (CONFIG.DEBUG) console.log(`[AgencyBooster:INFO] ${msg}`, data);
        },
        warn: (msg, data = "") => {
            if (CONFIG.DEBUG) console.warn(`[AgencyBooster:WARN] ${msg}`, data);
        },
        error: (msg, e = "") => {
            console.error(`[AgencyBooster:ERROR] ${msg}`, e instanceof Error ? e.message : e);
        }
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
            if (target && Object.values(target)[1] && delayProp) {
                return Object.values(target)[1][delayProp];
            } else if (target && Object.values(target)[0] && delayProp) {
                return Object.values(target)[0][delayProp];
            }
            return CONFIG.TEXT.UNKNOWN;
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
        getStats: (profileKey) => {
            const data = StorageManager.readProfile(profileKey) || {};
            
            const isSenderStopped = SenderManager.isStopped();
            let ibStatus = StateManager.getModuleStatus(data, 'icebreaker');
            if (ibStatus === "Running" && isSenderStopped) ibStatus = "Stopped";

            const brStatus = StateManager.getModuleStatus(data, 'broadcast');
            
            const privDelay = StateManager.getDelayValue(data, 'icebreaker');
            const broadDelay = StateManager.getDelayValue(data, 'broadcast');

            const ibCompleted = StateManager.getExactCount(data, 'ibCompleted');
            const ibInProgress = StateManager.getExactCount(data, 'ibInProgress');
            const brCompleted = StateManager.getExactCount(data, 'brCompleted');
            const brInProgress = StateManager.getExactCount(data, 'brInProgress');

            const startBtn = DOMManager.findButton(CONFIG.SELECTORS.START);
            const stopBtn = DOMManager.findButton(CONFIG.SELECTORS.STOP);

            return {
                data,
                ibStatus, brStatus,
                privDelay, broadDelay,
                ibCompleted, ibInProgress,
                brCompleted, brInProgress,
                startBtn: !!startBtn,
                stopBtn: !!stopBtn
            };
        },
        getDiagnosticsObj: (profileKey, allProfiles) => {
            const stats = Diagnostics.getStats(profileKey);
            const data = stats.data;
            const id = profileKey ? profileKey.replace(CONFIG.STORAGE_PREFIX, "") : "";
            
            const chromeMatch = navigator.userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
            const backupExists = !!StorageManager.readProfile(StorageManager.getBackupKey(id));
            const profileSize = new Blob([JSON.stringify(data)]).size;
            const totalStorageSize = StorageManager.calculateTotalUsage();

            const isProfileValid = Validator.isValidProfile(data);
            const uiHooksOk = stats.startBtn || stats.stopBtn;
            const domMetrics = DOMScanner.scanDOMMetrics();

            return {
                "SYSTEM": {
                    "Script version": `v${CONFIG.DIAGNOSTICS_VERSION}`,
                    "Timestamp": Utils.getTimestamp(),
                    "Current URL": Utils.getCurrentURL(),
                    "Browser": chromeMatch ? `Chrome ${chromeMatch[1]}` : "Other",
                    "UserAgent": navigator.userAgent,
                    "Viewport": `${window.innerWidth}x${window.innerHeight}`
                },
                "PROFILE": {
                    "Detected profiles": allProfiles.length > 0 ? allProfiles.join(", ") : "None",
                    "Selected profile": id || CONFIG.TEXT.UNKNOWN,
                    "Storage key": profileKey || CONFIG.TEXT.UNKNOWN,
                    "Profile size": `${(profileSize / CONFIG.BYTES_PER_KB).toFixed(2)} KB`,
                    "Backup exists": backupExists ? "Yes" : "No",
                    "Estimated localStorage usage": `${(totalStorageSize / CONFIG.BYTES_PER_KB).toFixed(2)} KB`
                },
                "RUNTIME": {
                    "Booster UI opened": document.querySelector(".ab-modal") ? "YES" : "NO",
                    "START button": stats.startBtn ? "FOUND" : "NOT FOUND",
                    "STOP button": stats.stopBtn ? "FOUND" : "NOT FOUND"
                },
                "PROFILE STRUCTURE": {
                    "messages": data.messages ? "FOUND" : "NOT FOUND",
                    "broadcast.messages": data.broadcast?.messages ? "FOUND" : "NOT FOUND",
                    "chainProgress": data.chainProgress ? "FOUND" : "NOT FOUND",
                    "delivered": data.delivered !== undefined ? "FOUND" : "NOT FOUND",
                    "sended": data.sended !== undefined ? "FOUND" : "NOT FOUND",
                    "broadcast": data.broadcast ? "FOUND" : "NOT FOUND"
                },
                "PROGRESS SOURCE": {
                    "IceBreaker completed": stats.ibCompleted !== CONFIG.TEXT.UNKNOWN ? `${stats.ibCompleted} (Explicit Counter)` : CONFIG.TEXT.UNKNOWN,
                    "Broadcast completed": stats.brCompleted !== CONFIG.TEXT.UNKNOWN ? `${stats.brCompleted} (Explicit Counter)` : CONFIG.TEXT.UNKNOWN
                },
                "STORAGE": {
                    "status": data.status || CONFIG.TEXT.UNKNOWN,
                    "broadcast.status": data.broadcast?.status || CONFIG.TEXT.UNKNOWN,
                    "chainProgress size": data.chainProgress ? `${Object.keys(data.chainProgress).length} items` : CONFIG.TEXT.UNKNOWN,
                    "delivered size": data.delivered ? `${data.delivered.split(';').filter(Boolean).length} items` : CONFIG.TEXT.UNKNOWN,
                    "sended size": data.sended ? `${data.sended.split(';').filter(Boolean).length} items` : CONFIG.TEXT.UNKNOWN
                },
                "DOM": {
                    "Accessible documents": domMetrics.docsCount,
                    "Accessible iframes": domMetrics.accessibleIframes,
                    "Blocked iframes": domMetrics.blockedIframes,
                    "ShadowRoots": domMetrics.shadowRoots,
                    "Buttons scanned": domMetrics.buttonsScanned
                },
                "HEALTH CHECK": {
                    "Profile": isProfileValid ? "OK" : "Warning",
                    "Storage": totalStorageSize < CONFIG.MAX_STORAGE_WARNING_BYTES ? "OK" : "Warning",
                    "UI Hooks": uiHooksOk ? "OK" : "Warning",
                    "IceBreaker": stats.ibStatus,
                    "Broadcast": stats.brStatus,
                    "Overall": isProfileValid && uiHooksOk ? "Healthy" : "Attention Required"
                }
            };
        },
        generateTextReport: (profileKey, allProfiles) => {
            const diagObj = Diagnostics.getDiagnosticsObj(profileKey, allProfiles);
            const stats = Diagnostics.getStats(profileKey);
            const id = profileKey ? profileKey.replace(CONFIG.STORAGE_PREFIX, "") : "";

            return `========================================
AGENCYBOOSTER DIAGNOSTICS REPORT
========================================
Generated on        : ${diagObj.SYSTEM["Timestamp"]}

----------------------------------------
1. GENERAL SYSTEM INFO
----------------------------------------
Profile ID          : ${id}
Current Page        : ${diagObj.SYSTEM["Current URL"]}
Script Version      : ${diagObj.SYSTEM["Script version"]}
Browser             : ${diagObj.SYSTEM["Browser"]}

----------------------------------------
2. STATUS & DELAYS
----------------------------------------
IceBreaker Status   : ${stats.ibStatus}
Broadcast Status    : ${stats.brStatus}
Private Delay       : ${stats.privDelay}${stats.privDelay !== CONFIG.TEXT.UNKNOWN ? " sec" : ""}
Broadcast Delay     : ${stats.broadDelay}${stats.broadDelay !== CONFIG.TEXT.UNKNOWN ? " sec" : ""}

----------------------------------------
3. PROGRESS & COUNTERS
----------------------------------------
IceBreaker Completed: ${stats.ibCompleted}
IceBreaker In Prog  : ${stats.ibInProgress}
Broadcast Completed : ${stats.brCompleted}
Broadcast In Prog   : ${stats.brInProgress}

----------------------------------------
4. RUNTIME STATUS
----------------------------------------
Booster UI Opened   : ${diagObj.RUNTIME["Booster UI opened"]}

----------------------------------------
5. BUTTONS (UI HOOKS)
----------------------------------------
START Button        : ${diagObj.RUNTIME["START button"]}
STOP Button         : ${diagObj.RUNTIME["STOP button"]}

----------------------------------------
6. STORAGE STATUS
----------------------------------------
Profile Status      : ${diagObj.STORAGE["status"]}
Broadcast Status    : ${diagObj.STORAGE["broadcast.status"]}
chainProgress Size  : ${diagObj.STORAGE["chainProgress size"]}
delivered Size      : ${diagObj.STORAGE["delivered size"]}
sended Size         : ${diagObj.STORAGE["sended size"]}

----------------------------------------
7. DOM INFORMATION
----------------------------------------
Accessible Docs     : ${diagObj.DOM["Accessible documents"]}
Accessible Iframes  : ${diagObj.DOM["Accessible iframes"]}
Blocked Iframes     : ${diagObj.DOM["Blocked iframes"]}
ShadowRoots         : ${diagObj.DOM["ShadowRoots"]}
Buttons Scanned     : ${diagObj.DOM["Buttons scanned"]}

----------------------------------------
8. DETECTED PROFILE STRUCTURE
----------------------------------------
messages            : ${diagObj["PROFILE STRUCTURE"]["messages"]}
broadcast.messages  : ${diagObj["PROFILE STRUCTURE"]["broadcast.messages"]}
chainProgress       : ${diagObj["PROFILE STRUCTURE"]["chainProgress"]}
delivered           : ${diagObj["PROFILE STRUCTURE"]["delivered"]}
sended              : ${diagObj["PROFILE STRUCTURE"]["sended"]}
broadcast           : ${diagObj["PROFILE STRUCTURE"]["broadcast"]}
========================================`;
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
            const data = StorageManager.readProfile(profileKey) || {};
            return {
                ibStatus: StateManager.getModuleStatus(data, 'icebreaker'),
                brStatus: StateManager.getModuleStatus(data, 'broadcast'),
                ibCompleted: StateManager.getExactCount(data, 'ibCompleted'),
                ibInProgress: StateManager.getExactCount(data, 'ibInProgress'),
                brCompleted: StateManager.getExactCount(data, 'brCompleted'),
                brInProgress: StateManager.getExactCount(data, 'brInProgress')
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
            const stats = Diagnostics.getStats(CustomUI.activeProfileKey);
            const dashView = document.getElementById("ab-view-dashboard");
            if (!dashView) return;

            dashView.innerHTML = `
                <div class="ab-grid">
                    <div class="ab-card">
                        <div class="ab-card-title">IceBreaker Status</div>
                        <div class="ab-card-value">${stats.ibStatus}</div>
                    </div>
                    <div class="ab-card">
                        <div class="ab-card-title">Broadcast Status</div>
                        <div class="ab-card-value">${stats.brStatus}</div>
                    </div>
                    
                    <div class="ab-card">
                        <div class="ab-card-title">Private Delay</div>
                        <div class="ab-card-value">${stats.privDelay} ${stats.privDelay !== CONFIG.TEXT.UNKNOWN ? "sec" : ""}</div>
                    </div>
                    <div class="ab-card">
                        <div class="ab-card-title">Broadcast Delay</div>
                        <div class="ab-card-value">${stats.broadDelay} ${stats.broadDelay !== CONFIG.TEXT.UNKNOWN ? "sec" : ""}</div>
                    </div>

                    <div class="ab-card">
                        <div class="ab-card-title">IceBreaker Progress</div>
                        <div class="ab-card-value" style="font-size:13px; font-weight:normal;">
                            <div style="margin-top:2px;">In Progress: <strong style="color:var(--ab-text)">${stats.ibInProgress}</strong></div>
                            <div style="margin-top:4px;">Completed: <strong style="color:var(--ab-text)">${stats.ibCompleted}</strong></div>
                        </div>
                    </div>
                    <div class="ab-card">
                        <div class="ab-card-title">Broadcast Progress</div>
                        <div class="ab-card-value" style="font-size:13px; font-weight:normal;">
                            <div style="margin-top:2px;">In Progress: <strong style="color:var(--ab-text)">${stats.brInProgress}</strong></div>
                            <div style="margin-top:4px;">Completed: <strong style="color:var(--ab-text)">${stats.brCompleted}</strong></div>
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
            </div>`;

            for (const [groupName, groupData] of Object.entries(diagObj)) {
                html += `
                    <div class="ab-diag-group">
                        <h3>${groupName}</h3>
                        <table class="ab-table"><tbody>
                            ${Object.entries(groupData).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
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