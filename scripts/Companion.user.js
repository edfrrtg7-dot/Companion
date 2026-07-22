// ==UserScript==
// @name         Companion
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Companion application — Finance module
// @author       Senior Staff JavaScript Engineer
// @match        https://goldenbride.net/*
// @grant        none
// ==/UserScript==

(() => {
    "use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // ../src/companion/dev.ts
  var IS_DEV = (() => {
    try {
      return localStorage.getItem("ab-dev") !== null;
    } catch {
      return false;
    }
  })();
  function diag(...args) {
    if (IS_DEV) {
      console.log("[Companion]", ...args);
    }
  }

  // ../src/companion/companion-app.ts
  var LAUNCHER_BUTTON_CSS = `
#ab-companion-launcher {
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 2147483647;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #2F6BFF;
    border: 2px solid rgba(255,255,255,0.15);
    color: #FFFFFF;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(47,107,255,0.4);
    transition: all 0.2s ease;
    font-size: 16px;
    font-weight: 700;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    user-select: none;
    touch-action: none;
}

#ab-companion-launcher:hover {
    background: #4A82FF;
    box-shadow: 0 6px 24px rgba(47,107,255,0.6);
    transform: scale(1.05);
}

#ab-companion-launcher:active {
    transform: scale(0.95);
}

#ab-companion-launcher.active {
    background: #EF5350;
    box-shadow: 0 4px 16px rgba(239,83,80,0.4);
}

#ab-companion-launcher.active:hover {
    background: #E57373;
}

#ab-companion-modules {
    position: fixed;
    top: 76px;
    right: 24px;
    z-index: 2147483646;
    display: none;
    flex-direction: column;
    gap: 4px;
    background: #1F2235;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 6px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    min-width: 160px;
}

#ab-companion-modules.open {
    display: flex;
}

.ab-companion-module-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 8px 12px;
    cursor: pointer;
    text-align: left;
    color: #E0E0E0;
    font-size: 12px;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    transition: all 0.15s ease;
    width: 100%;
}

.ab-companion-module-item:hover {
    background: rgba(255,255,255,0.08);
}

.ab-companion-module-item.open {
    background: rgba(47,107,255,0.15);
    border-color: #2F6BFF;
    color: #FFFFFF;
}

.ab-companion-module-item .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    flex-shrink: 0;
}

.ab-companion-module-item.open .status-dot {
    background: #81C784;
}
`;
  var _CompanionApp = class _CompanionApp {
    constructor(moduleManager) {
      __publicField(this, "moduleManager");
      __publicField(this, "launcher", null);
      __publicField(this, "moduleMenu", null);
      __publicField(this, "started", false);
      if (_CompanionApp.instance) {
        throw new Error("CompanionApp is a singleton. Use CompanionApp.getInstance() or check existing instance.");
      }
      _CompanionApp.instance = this;
      this.moduleManager = moduleManager;
    }
    injectStyles() {
      const existing = document.getElementById("ab-companion-styles");
      if (existing) return;
      const style = document.createElement("style");
      style.id = "ab-companion-styles";
      style.textContent = LAUNCHER_BUTTON_CSS;
      document.head.appendChild(style);
    }
    /** Start the Companion application and create the launcher UI. */
    start() {
      if (this.started) return;
      this.started = true;
      this.injectStyles();
      this.createUI();
      diag("initialized");
    }
    // -------------------------------------------------------------------------
    // UI
    // -------------------------------------------------------------------------
    createUI() {
      const btn = document.createElement("button");
      btn.id = "ab-companion-launcher";
      btn.title = "Companion";
      btn.textContent = "C";
      btn.addEventListener("click", () => this.onLauncherClick());
      document.body.appendChild(btn);
      this.launcher = btn;
      const menu = document.createElement("div");
      menu.id = "ab-companion-modules";
      document.body.appendChild(menu);
      this.moduleMenu = menu;
      this.buildMenuItems();
    }
    buildMenuItems() {
      if (!this.moduleMenu) return;
      this.moduleMenu.innerHTML = "";
      for (const mod of this.moduleManager.getAll()) {
        const item = document.createElement("button");
        item.className = "ab-companion-module-item";
        item.dataset.module = mod.name;
        const dot = document.createElement("span");
        dot.className = "status-dot";
        item.appendChild(dot);
        const label = document.createElement("span");
        label.textContent = mod.label;
        item.appendChild(label);
        item.addEventListener("click", () => this.onModuleItemClick(mod.name));
        this.moduleMenu.appendChild(item);
      }
      this.updateMenuItems();
    }
    updateMenuItems() {
      if (!this.moduleMenu) return;
      const items = this.moduleMenu.querySelectorAll(".ab-companion-module-item");
      items.forEach((el) => {
        const modName = el.dataset.module;
        if (!modName) return;
        const mod = this.moduleManager.get(modName);
        if (mod && mod.isOpen) {
          el.classList.add("open");
        } else {
          el.classList.remove("open");
        }
      });
    }
    onLauncherClick() {
      if (!this.moduleMenu) return;
      if (this.moduleMenu.classList.contains("open")) {
        this.closeMenu();
      } else {
        this.openMenu();
      }
    }
    openMenu() {
      if (!this.moduleMenu || !this.launcher) return;
      this.updateMenuItems();
      this.moduleMenu.classList.add("open");
      this.launcher.classList.add("active");
    }
    closeMenu() {
      if (!this.moduleMenu || !this.launcher) return;
      this.moduleMenu.classList.remove("open");
      this.launcher.classList.remove("active");
    }
    onModuleItemClick(name) {
      this.moduleManager.toggle(name);
      this.updateMenuItems();
      this.closeMenu();
    }
  };
  /** Singleton guard — prevents multiple instances. */
  __publicField(_CompanionApp, "instance", null);
  var CompanionApp = _CompanionApp;

  // ../src/companion/module-manager.ts
  var ModuleManager = class {
    constructor() {
      __publicField(this, "modules", /* @__PURE__ */ new Map());
    }
    /** Register a module. Ignores duplicates. */
    register(module) {
      if (this.modules.has(module.name)) return;
      this.modules.set(module.name, module);
    }
    /** Get a module by name. */
    get(name) {
      return this.modules.get(name);
    }
    /** Get all registered modules. */
    getAll() {
      return Array.from(this.modules.values());
    }
    /** Open a module by name. No-op if not found or already open. */
    open(name) {
      const mod = this.modules.get(name);
      if (mod && !mod.isOpen) {
        mod.open();
      }
    }
    /** Close a module by name. No-op if not found or already closed. */
    close(name) {
      const mod = this.modules.get(name);
      if (mod && mod.isOpen) {
        mod.close();
      }
    }
    /** Toggle a module open/closed. No-op if not found. */
    toggle(name) {
      const mod = this.modules.get(name);
      if (!mod) return;
      if (mod.isOpen) {
        mod.close();
      } else {
        mod.open();
      }
    }
    /** Check if a module is open. Returns false if not found. */
    isOpen(name) {
      return this.modules.get(name)?.isOpen ?? false;
    }
  };

  // ../src/companion/finance-api-client.ts
  var FinanceApiError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "FinanceApiError";
    }
  };
  var FinanceApiAbortError = class extends FinanceApiError {
    constructor(reason = "Request aborted") {
      super(reason);
      this.name = "FinanceApiAbortError";
    }
  };
  var FinanceApiHttpError = class extends FinanceApiError {
    constructor(status, statusText, body) {
      super(`HTTP ${status} ${statusText}`);
      __publicField(this, "status");
      __publicField(this, "statusText");
      __publicField(this, "body");
      this.name = "FinanceApiHttpError";
      this.status = status;
      this.statusText = statusText;
      this.body = body;
    }
  };
  var FinanceApiParseError = class extends FinanceApiError {
    constructor(message, body) {
      super(message);
      __publicField(this, "body");
      this.name = "FinanceApiParseError";
      this.body = body;
    }
  };
  var FinanceApiServerError = class extends FinanceApiError {
    constructor(message, serverError) {
      super(message);
      __publicField(this, "serverError");
      this.name = "FinanceApiServerError";
      this.serverError = serverError;
    }
  };
  var DEFAULT_BASE_PATH = "/usermodule/services/agencyhelper/v2";
  var DEFAULT_TIMEOUT_MS = 3e4;
  var FinanceApiClient = class {
    constructor(config = {}) {
      __publicField(this, "basePath");
      __publicField(this, "defaultTimeoutMs");
      this.basePath = config.basePath ?? DEFAULT_BASE_PATH;
      this.defaultTimeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    }
    /**
     * Fetch finance transactions for the given date range.
     *
     * @param from - Start date (inclusive). Will be formatted as YYYY-MM-DD.
     * @param to   - End date (inclusive). Will be formatted as YYYY-MM-DD.
     * @param options - Optional: AbortSignal, custom timeout.
     * @returns The raw parsed JSON response from the server.
     * @throws {FinanceApiAbortError}    If the request was aborted.
     * @throws {FinanceApiHttpError}     If the HTTP status is not 2xx.
     * @throws {FinanceApiParseError}    If the response body is not valid JSON.
     * @throws {FinanceApiServerError}   If the server returned a structured error.
     */
    async fetchTransactions(from, to, options) {
      const url = this.buildUrl(from, to);
      const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
      const controller2 = new AbortController();
      const timeoutId = setTimeout(() => controller2.abort(), timeoutMs);
      if (options?.signal) {
        if (options.signal.aborted) {
          clearTimeout(timeoutId);
          throw new FinanceApiAbortError("Signal already aborted");
        }
        options.signal.addEventListener("abort", () => controller2.abort(), { once: true });
      }
      try {
        const response = await fetch(url, {
          method: "GET",
          credentials: "same-origin",
          signal: controller2.signal,
          headers: {
            "Accept": "application/json"
          }
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new FinanceApiHttpError(response.status, response.statusText, body);
        }
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new FinanceApiParseError(
            `Response is not valid JSON (${text.length} chars)`,
            text
          );
        }
        if (this.isServerError(data)) {
          throw new FinanceApiServerError(
            `Server error: ${this.extractServerError(data)}`,
            data
          );
        }
        return data;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof FinanceApiError) {
          throw error;
        }
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new FinanceApiAbortError("Request timed out or was aborted");
        }
        if (error instanceof TypeError) {
          throw new FinanceApiError(`Network error: ${error.message}`);
        }
        throw new FinanceApiError(
          `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------
    /**
     * Build the full request URL with date parameters.
     * Uses relative URL so the browser includes cookies automatically.
     */
    buildUrl(from, to) {
      const fromStr = this.formatDate(from);
      const toStr = this.formatDate(to);
      return `${this.basePath}?command=finances&from=${fromStr}&to=${toStr}`;
    }
    /**
     * Format a Date as YYYY-MM-DD for the API.
     */
    formatDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    /**
     * Check if a parsed response looks like a server error object.
     */
    isServerError(data) {
      if (typeof data !== "object" || data === null) return false;
      const obj = data;
      return "error" in obj && "success" in obj && obj.success === false;
    }
    /**
     * Extract the error message from a server error object.
     */
    extractServerError(data) {
      if (typeof data !== "object" || data === null) return "Unknown server error";
      const obj = data;
      return typeof obj.error === "string" ? obj.error : "Unknown server error";
    }
  };

  // ../src/companion/finance-mapper.ts
  var Operation = /* @__PURE__ */ ((Operation2) => {
    Operation2["EmailSend"] = "EmailSend";
    Operation2["EmailRead"] = "EmailRead";
    Operation2["TextChat"] = "TextChat";
    Operation2["VideoChat"] = "VideoChat";
    Operation2["TextChatBonusCoins"] = "TextChatBonusCoins";
    Operation2["TextChatSatellite"] = "TextChatSatellite";
    return Operation2;
  })(Operation || {});
  var VALID_OPERATIONS = new Set(Object.values(Operation));
  var FinanceMapperError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "FinanceMapperError";
    }
  };
  var FinanceMapperValidationError = class extends FinanceMapperError {
    constructor(field, value, message) {
      super(`Validation failed for '${field}': ${message}`);
      __publicField(this, "field");
      __publicField(this, "value");
      this.name = "FinanceMapperValidationError";
      this.field = field;
      this.value = value;
    }
  };
  var FinanceMapper = class _FinanceMapper {
    /**
     * Map a raw Finance API response into the Companion domain model.
     *
     * @param raw - The raw JSON response from the server.
     * @returns A fully mapped FinanceResponse.
     * @throws {FinanceMapperValidationError} If required fields are missing or invalid.
     * @throws {FinanceMapperError} If the raw response is not an object.
     */
    static mapResponse(raw) {
      if (typeof raw !== "object" || raw === null) {
        throw new FinanceMapperError("Response is not an object");
      }
      const obj = raw;
      return {
        total: _FinanceMapper.parseTotal(obj.total),
        from: _FinanceMapper.parseDate(obj.from),
        to: _FinanceMapper.parseDate(obj.to),
        list: _FinanceMapper.parseList(obj.list),
        success: _FinanceMapper.parseSuccess(obj.success)
      };
    }
    /**
     * Map a single raw transaction into the domain model.
     *
     * @param raw - A raw transaction object.
     * @returns A mapped FinanceTransaction.
     * @throws {FinanceMapperValidationError} If required fields are missing or invalid.
     */
    static mapTransaction(raw) {
      if (typeof raw !== "object" || raw === null) {
        throw new FinanceMapperError("Transaction is not an object");
      }
      const obj = raw;
      return {
        date: _FinanceMapper.parseTransactionDate(obj.date),
        ladyID: _FinanceMapper.parseNumber(obj.ladyID, "ladyID"),
        name: _FinanceMapper.parseString(obj.name, "name"),
        sum: _FinanceMapper.parseSum(obj.sum),
        userID: _FinanceMapper.parseNumber(obj.userID, "userID"),
        operation: _FinanceMapper.parseOperation(obj.operation),
        isFinish: _FinanceMapper.parseBoolean(obj.isFinish)
      };
    }
    // -------------------------------------------------------------------------
    // Field parsers
    // -------------------------------------------------------------------------
    static parseTotal(value) {
      if (typeof value !== "number") {
        throw new FinanceMapperValidationError("total", value, "expected number");
      }
      return value;
    }
    static parseDate(value) {
      if (typeof value !== "string") {
        throw new FinanceMapperValidationError("date", value, "expected string (YYYY-MM-DD)");
      }
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!match) {
        throw new FinanceMapperValidationError("date", value, "expected YYYY-MM-DD format");
      }
      const [, yearStr, monthStr, dayStr] = match;
      const year = Number(yearStr);
      const month = Number(monthStr) - 1;
      const day = Number(dayStr);
      const date = new Date(year, month, day);
      if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
        throw new FinanceMapperValidationError("date", value, "invalid date");
      }
      return date;
    }
    static parseTransactionDate(value) {
      if (typeof value !== "number") {
        throw new FinanceMapperValidationError("date", value, "expected number (milliseconds)");
      }
      if (!Number.isFinite(value) || value <= 0) {
        throw new FinanceMapperValidationError("date", value, "expected positive finite number");
      }
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new FinanceMapperValidationError("date", value, "invalid timestamp");
      }
      return date;
    }
    static parseList(value) {
      if (!Array.isArray(value)) {
        throw new FinanceMapperValidationError("list", value, "expected array");
      }
      return value.map((item, index) => {
        try {
          return _FinanceMapper.mapTransaction(item);
        } catch (error) {
          if (error instanceof FinanceMapperError) {
            throw new FinanceMapperValidationError(
              `list[${index}]`,
              item,
              error.message
            );
          }
          throw error;
        }
      });
    }
    static parseSuccess(value) {
      if (typeof value !== "boolean") {
        throw new FinanceMapperValidationError("success", value, "expected boolean");
      }
      return value;
    }
    static parseNumber(value, field) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new FinanceMapperValidationError(field, value, "expected finite number");
      }
      return value;
    }
    static parseString(value, field) {
      if (typeof value !== "string") {
        throw new FinanceMapperValidationError(field, value, "expected string");
      }
      return value;
    }
    static parseSum(value) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new FinanceMapperValidationError("sum", value, "expected finite number");
      }
      return value;
    }
    static parseOperation(value) {
      if (typeof value !== "string") {
        throw new FinanceMapperValidationError("operation", value, "expected string");
      }
      if (!VALID_OPERATIONS.has(value)) {
        throw new FinanceMapperValidationError("operation", value, `unknown operation type`);
      }
      return value;
    }
    static parseBoolean(value) {
      if (value === void 0 || value === null) {
        return false;
      }
      if (typeof value !== "boolean") {
        throw new FinanceMapperValidationError("isFinish", value, "expected boolean");
      }
      return value;
    }
  };

  // ../src/companion/finance-shift.ts
  var SHIFT_DEFINITIONS = /* @__PURE__ */ new Map([
    [
      "morning",
      {
        type: "morning",
        startHour: 7,
        startMinute: 0,
        endHour: 14,
        endMinute: 59,
        label: "Morning",
        timeDisplay: "07:00 \u2013 14:59"
      }
    ],
    [
      "day",
      {
        type: "day",
        startHour: 15,
        startMinute: 0,
        endHour: 22,
        endMinute: 59,
        label: "Day",
        timeDisplay: "15:00 \u2013 22:59"
      }
    ],
    [
      "night",
      {
        type: "night",
        startHour: 23,
        startMinute: 0,
        endHour: 6,
        endMinute: 59,
        label: "Night",
        timeDisplay: "23:00 \u2013 06:59"
      }
    ]
  ]);
  var ALL_SHIFTS = ["morning", "day", "night"];
  var STORAGE_KEY = "agencybooster-finance-shift";
  function loadShift() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && isShiftType(raw)) {
        return raw;
      }
    } catch {
    }
    return null;
  }
  function saveShift(shift) {
    try {
      localStorage.setItem(STORAGE_KEY, shift);
    } catch {
    }
  }
  function isShiftType(value) {
    return ALL_SHIFTS.includes(value);
  }
  var FinanceShift = class _FinanceShift {
    /**
     * Get the definition for a shift type.
     */
    static getDefinition(type) {
      const def = SHIFT_DEFINITIONS.get(type);
      if (!def) {
        throw new Error(`Unknown shift type: ${type}`);
      }
      return def;
    }
    /**
     * Get all available shift definitions.
     */
    static getAllDefinitions() {
      return ALL_SHIFTS.map((type) => _FinanceShift.getDefinition(type));
    }
    /**
     * Auto-detect the current shift based on local time.
     */
    static detectCurrentShift() {
      const now = /* @__PURE__ */ new Date();
      const hour = now.getHours();
      if (hour >= 7 && hour < 15) {
        return "morning";
      }
      if (hour >= 15 && hour < 23) {
        return "day";
      }
      return "night";
    }
    /**
     * Get the saved shift or auto-detect if none saved.
     * On first launch: auto-detect based on current time.
     * On subsequent launches: restore saved shift.
     */
    static getSavedOrDetect() {
      return loadShift() ?? _FinanceShift.detectCurrentShift();
    }
    /**
     * Save the selected shift to localStorage.
     */
    static save(shift) {
      saveShift(shift);
    }
    /**
     * Compute the date range for a shift on a given date.
     *
     * Morning (07:00 → 14:59): same day
     * Day (15:00 → 22:59): same day
     * Night (23:00 → 06:59): spans midnight
     *   - from: today at 23:00
     *   - to: tomorrow at 06:59
     *
     * For API purposes:
     *   - from: start of the shift day (YYYY-MM-DD)
     *   - to: end of the shift day (YYYY-MM-DD)
     *
     * @param type - Shift type.
     * @param referenceDate - The date to compute ranges for. Default: today.
     */
    static computeDateRange(type, referenceDate) {
      const def = _FinanceShift.getDefinition(type);
      const date = referenceDate ? new Date(referenceDate) : /* @__PURE__ */ new Date();
      const from = new Date(date);
      const to = new Date(date);
      if (type === "night") {
        from.setHours(def.startHour, def.startMinute, 0, 0);
        to.setDate(to.getDate() + 1);
        to.setHours(def.endHour, def.endMinute, 0, 0);
      } else {
        from.setHours(def.startHour, def.startMinute, 0, 0);
        to.setHours(def.endHour, def.endMinute, 0, 0);
      }
      return { from, to };
    }
    /**
     * Format a date for display (dd.MM.yyyy).
     */
    static formatDate(date) {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    }
    /**
     * Format time for display (HH:mm).
     */
    static formatTime(date) {
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    }
    /**
     * Check if a timestamp falls within a shift's time window.
     *
     * Morning (07:00–14:59): hour >= 7 && hour < 15
     * Day (15:00–22:59): hour >= 15 && hour < 23
     * Night (23:00–06:59): hour >= 23 || hour < 7
     *
     * @param timestamp - The transaction timestamp to check.
     * @param shiftType - The shift type to test against.
     * @returns true if the timestamp falls within the shift.
     */
    static isInShift(timestamp, shiftType) {
      const hour = timestamp.getHours();
      switch (shiftType) {
        case "morning":
          return hour >= 7 && hour < 15;
        case "day":
          return hour >= 15 && hour < 23;
        case "night":
          return hour >= 23 || hour < 7;
      }
    }
    /**
     * Filter a list of transactions to those falling within the given shift.
     */
    static filterByShift(transactions, shiftType) {
      return transactions.filter((tx) => _FinanceShift.isInShift(tx.date, shiftType));
    }
    /**
     * Format the shift date range for display.
     */
    static formatDateRange(range) {
      return `${_FinanceShift.formatDate(range.from)} \u2014 ${_FinanceShift.formatDate(range.to)}`;
    }
    // -------------------------------------------------------------------------
    // Smart Night Shift Logic
    // -------------------------------------------------------------------------
    /**
     * Night shift phase based on current local time.
     *
     * - "active-23": 23:00–23:59 — night is active, show transactions from 23:00 to now
     * - "active-00": 00:00–06:59 — night is active, show transactions from yesterday 23:00 to now
     * - "waiting": 07:00–22:59 — night has not started, show waiting message
     */
    static getNightPhase(now) {
      const current = now ?? /* @__PURE__ */ new Date();
      const hour = current.getHours();
      if (hour >= 23) {
        return "active-23";
      }
      if (hour < 7) {
        return "active-00";
      }
      return "waiting";
    }
    /**
     * Check if night shift is currently active (23:00–06:59).
     */
    static isNightActive(now) {
      const phase = _FinanceShift.getNightPhase(now);
      return phase === "active-23" || phase === "active-00";
    }
    /**
     * Compute the time-bounded filter range for night shift.
     *
     * Case 1 (23:00–23:59): today 23:00 → now
     * Case 2 (00:00–06:59): yesterday 23:00 → now
     * Case 3 (07:00–22:59): no range (waiting)
     */
    static computeNightFilterRange(now) {
      const current = now ?? /* @__PURE__ */ new Date();
      const phase = _FinanceShift.getNightPhase(current);
      if (phase === "waiting") {
        return null;
      }
      const to = new Date(current);
      const from = new Date(current);
      if (phase === "active-23") {
        from.setHours(23, 0, 0, 0);
      } else {
        from.setDate(from.getDate() - 1);
        from.setHours(23, 0, 0, 0);
      }
      return { from, to };
    }
    /**
     * Smart filter: applies time-bounded filtering for night shift.
     * For morning/day: uses standard hour-based filtering.
     * For night: uses time range filtering based on current phase.
     *
     * @returns Filtered transactions, or null if night shift is in waiting state.
     */
    static filterByShiftSmart(transactions, shiftType, now) {
      if (shiftType !== "night") {
        return {
          filtered: _FinanceShift.filterByShift(transactions, shiftType),
          isWaiting: false
        };
      }
      const phase = _FinanceShift.getNightPhase(now);
      if (phase === "waiting") {
        return { filtered: [], isWaiting: true };
      }
      const range = _FinanceShift.computeNightFilterRange(now);
      if (!range) {
        return { filtered: [], isWaiting: true };
      }
      const filtered = transactions.filter((tx) => {
        const txTime = tx.date.getTime();
        return txTime >= range.from.getTime() && txTime <= range.to.getTime();
      });
      return { filtered, isWaiting: false };
    }
  };

  // ../src/companion/finance-controller.ts
  var DEFAULT_TIMEOUT_MS2 = 3e4;
  var FinanceController = class {
    constructor(config = {}) {
      __publicField(this, "state");
      __publicField(this, "listeners", /* @__PURE__ */ new Set());
      __publicField(this, "client");
      __publicField(this, "timeoutMs");
      __publicField(this, "abortController", null);
      const shift = config.shift ?? FinanceShift.getSavedOrDetect();
      const range = FinanceShift.computeDateRange(shift);
      this.state = {
        status: "idle",
        data: null,
        error: null,
        from: range.from,
        to: range.to,
        shift
      };
      this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS2;
      this.client = new FinanceApiClient({ timeoutMs: this.timeoutMs });
    }
    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------
    /** Get current state (immutable snapshot). */
    getState() {
      return { ...this.state };
    }
    /** Get the current shift type. */
    getCurrentShift() {
      return this.state.shift;
    }
    /**
     * Set the active shift and optionally refresh.
     * Computes the correct date range and persists the selection.
     *
     * @param shift - The shift type to activate.
     * @param autoRefresh - If true, automatically fetch after setting shift. Default: true.
     */
    setShift(shift, autoRefresh = true) {
      if (this.state.shift === shift) {
        if (autoRefresh) {
          this.refresh();
        }
        return;
      }
      this.cancelPending();
      FinanceShift.save(shift);
      const range = FinanceShift.computeDateRange(shift);
      this.setState({
        shift,
        from: range.from,
        to: range.to,
        data: null,
        status: "idle",
        error: null
      });
      if (autoRefresh) {
        this.refresh();
      }
    }
    /**
     * Fetch finance data for the current date range.
     * Cancels any in-flight request before starting a new one.
     */
    async refresh() {
      this.cancelPending();
      this.setState({ status: "loading", error: null });
      const controller2 = new AbortController();
      this.abortController = controller2;
      try {
        const raw = await this.client.fetchTransactions(
          this.state.from,
          this.state.to,
          {
            signal: controller2.signal,
            timeoutMs: this.timeoutMs
          }
        );
        if (controller2.signal.aborted) {
          return;
        }
        const mapped = FinanceMapper.mapResponse(raw);
        this.setState({ status: "loaded", data: mapped, error: null });
      } catch (error) {
        if (controller2.signal.aborted) {
          return;
        }
        if (error instanceof FinanceApiAbortError) {
          this.setState({ status: "error", error: "Request timed out" });
        } else if (error instanceof FinanceApiError) {
          this.setState({ status: "error", error: error.message });
        } else if (error instanceof Error) {
          this.setState({ status: "error", error: error.message });
        } else {
          this.setState({ status: "error", error: "Unknown error" });
        }
      } finally {
        if (this.abortController === controller2) {
          this.abortController = null;
        }
      }
    }
    /**
     * Set the date range and optionally refresh.
     * Cancels any in-flight request.
     *
     * @param from - Start date (inclusive).
     * @param to   - End date (inclusive).
     * @param autoRefresh - If true, automatically fetch after setting dates. Default: false.
     */
    setDateRange(from, to, autoRefresh = false) {
      this.cancelPending();
      this.setState({ from, to, data: null, status: "idle", error: null });
      if (autoRefresh) {
        this.refresh();
      }
    }
    /** Cancel any in-flight request. */
    cancelPending() {
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }
    }
    /** Check if a request is in progress. */
    get isLoading() {
      return this.state.status === "loading";
    }
    /** Subscribe to state changes. Returns an unsubscribe function. */
    subscribe(listener) {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    }
    /** Unsubscribe from state changes. */
    unsubscribe(listener) {
      this.listeners.delete(listener);
    }
    /** Get the number of active subscribers. */
    get subscriberCount() {
      return this.listeners.size;
    }
    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------
    setState(partial) {
      this.state = { ...this.state, ...partial };
      this.notify();
    }
    notify() {
      for (const listener of this.listeners) {
        try {
          listener(this.state);
        } catch {
        }
      }
    }
  };

  // ../src/companion/companion-window.ts
  var DEFAULT_CLASS_PREFIX = "ab-window";
  var MIN_WIDTH = 280;
  var MIN_HEIGHT = 200;
  var MAX_WIDTH = 700;
  var MAX_HEIGHT = 600;
  var COLLAPSED_WIDTH = 330;
  var COLLAPSED_HEIGHT = 44;
  function loadState(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && typeof parsed.x === "number" && typeof parsed.y === "number" && typeof parsed.width === "number" && parsed.width > 0 && typeof parsed.height === "number" && parsed.height > 0 && typeof parsed.collapsed === "boolean" && typeof parsed.hidden === "boolean") {
        return parsed;
      }
    } catch {
    }
    return null;
  }
  function saveState(storageKey, state) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
    }
  }
  var CompanionWindow = class {
    constructor(config) {
      __publicField(this, "container");
      __publicField(this, "classPrefix");
      __publicField(this, "storageKey");
      __publicField(this, "defaultState");
      __publicField(this, "onClose");
      __publicField(this, "root", null);
      __publicField(this, "contentEl", null);
      __publicField(this, "collapseBtn", null);
      __publicField(this, "closeBtn", null);
      __publicField(this, "destroyed", false);
      // Window state model — single source of truth
      __publicField(this, "win");
      // Keyboard handler
      __publicField(this, "boundOnKeyDown", null);
      // Drag state
      __publicField(this, "isDragging", false);
      __publicField(this, "dragStartX", 0);
      __publicField(this, "dragStartY", 0);
      __publicField(this, "dragOrigX", 0);
      __publicField(this, "dragOrigY", 0);
      __publicField(this, "boundOnDragPointerMove", null);
      __publicField(this, "boundOnDragPointerUp", null);
      // Resize state
      __publicField(this, "isResizing", false);
      __publicField(this, "resizeStartX", 0);
      __publicField(this, "resizeStartY", 0);
      __publicField(this, "resizeOrigW", 0);
      __publicField(this, "resizeOrigH", 0);
      __publicField(this, "boundOnResizePointerMove", null);
      __publicField(this, "boundOnResizePointerUp", null);
      __publicField(this, "onKeyDown", (e) => {
        if (this.destroyed || this.win.hidden) return;
        if (e.key === "Escape") {
          this.hide();
          this.onClose?.();
        }
      });
      __publicField(this, "onCollapseClick", () => {
        if (this.destroyed) return;
        this.toggleCollapse();
      });
      __publicField(this, "onCloseClick", () => {
        if (this.destroyed) return;
        this.hide();
        this.onClose?.();
      });
      __publicField(this, "onHeaderDoubleClick", (e) => {
        if (this.destroyed) return;
        const target = e.target;
        if (target.closest("button")) return;
        this.toggleCollapse();
      });
      __publicField(this, "onDragPointerDown", (e) => {
        if (this.destroyed || !this.root) return;
        const target = e.target;
        if (target.closest("button") || target.closest("select") || target.closest("input")) {
          return;
        }
        e.preventDefault();
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        const rect = this.root.getBoundingClientRect();
        this.dragOrigX = rect.left;
        this.dragOrigY = rect.top;
        const header = this.root.querySelector(`.${this.classPrefix}-header`);
        if (header) {
          header.style.cursor = "grabbing";
        }
        this.boundOnDragPointerMove = this.onDragPointerMove;
        this.boundOnDragPointerUp = this.onDragPointerUp;
        document.addEventListener("pointermove", this.boundOnDragPointerMove);
        document.addEventListener("pointerup", this.boundOnDragPointerUp);
        document.addEventListener("pointercancel", this.boundOnDragPointerUp);
        window.addEventListener("blur", this.boundOnDragPointerUp);
      });
      __publicField(this, "onDragPointerMove", (e) => {
        if (!this.isDragging || !this.root) return;
        e.preventDefault();
        const newX = this.dragOrigX + (e.clientX - this.dragStartX);
        const newY = this.dragOrigY + (e.clientY - this.dragStartY);
        this.root.style.left = newX + "px";
        this.root.style.top = newY + "px";
        this.root.style.bottom = "auto";
        this.root.style.right = "auto";
      });
      __publicField(this, "onDragPointerUp", () => {
        this.isDragging = false;
        if (this.root) {
          const header = this.root.querySelector(`.${this.classPrefix}-header`);
          if (header) {
            header.style.cursor = "grab";
          }
        }
        if (this.root) {
          const rect = this.root.getBoundingClientRect();
          this.win = { ...this.win, x: Math.round(rect.left), y: Math.round(rect.top) };
        }
        this.persistState();
        this.removeDragListeners();
      });
      __publicField(this, "onResizePointerDown", (e) => {
        if (this.destroyed || !this.root || this.win.collapsed) return;
        e.preventDefault();
        e.stopPropagation();
        this.isResizing = true;
        this.resizeStartX = e.clientX;
        this.resizeStartY = e.clientY;
        const rect = this.root.getBoundingClientRect();
        this.resizeOrigW = rect.width;
        this.resizeOrigH = rect.height;
        this.boundOnResizePointerMove = this.onResizePointerMove;
        this.boundOnResizePointerUp = this.onResizePointerUp;
        document.addEventListener("pointermove", this.boundOnResizePointerMove);
        document.addEventListener("pointerup", this.boundOnResizePointerUp);
        document.addEventListener("pointercancel", this.boundOnResizePointerUp);
        window.addEventListener("blur", this.boundOnResizePointerUp);
      });
      __publicField(this, "onResizePointerMove", (e) => {
        if (!this.isResizing || !this.root) return;
        e.preventDefault();
        const dx = e.clientX - this.resizeStartX;
        const dy = e.clientY - this.resizeStartY;
        const newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, this.resizeOrigW + dx));
        const newH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, this.resizeOrigH + dy));
        this.root.style.width = newW + "px";
        this.root.style.height = newH + "px";
      });
      __publicField(this, "onResizePointerUp", () => {
        this.isResizing = false;
        if (this.root) {
          const rect = this.root.getBoundingClientRect();
          this.win = {
            ...this.win,
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        }
        this.persistState();
        this.removeResizeListeners();
      });
      this.container = config.container ?? document.body;
      this.classPrefix = config.classPrefix ?? DEFAULT_CLASS_PREFIX;
      this.storageKey = config.storageKey;
      this.defaultState = config.defaultState;
      this.onClose = config.onClose;
      const saved = loadState(this.storageKey) ?? this.defaultState;
      this.win = { ...saved };
    }
    // -------------------------------------------------------------------------
    // Initialization — called by subclass after creating DOM
    // -------------------------------------------------------------------------
    /**
     * Attach window behavior to DOM elements.
     * Must be called by subclass after creating root, contentEl, collapseBtn, closeBtn.
     */
    initWindow(dragHandle, resizeHandle) {
      dragHandle.addEventListener("pointerdown", this.onDragPointerDown);
      dragHandle.addEventListener("dblclick", this.onHeaderDoubleClick);
      resizeHandle.addEventListener("pointerdown", this.onResizePointerDown);
      this.collapseBtn?.addEventListener("click", this.onCollapseClick);
      this.closeBtn?.addEventListener("click", this.onCloseClick);
      if (!this.win.hidden) {
        this.installKeyboardListener();
      }
    }
    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------
    /** Remove the widget from the DOM and clean up listeners. */
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.cancelDrag();
      this.cancelResize();
      this.removeKeyboardListener();
      this.root?.remove();
      this.root = null;
      this.contentEl = null;
      this.collapseBtn = null;
      this.closeBtn = null;
    }
    /** Check if the widget has been destroyed. */
    get isDestroyed() {
      return this.destroyed;
    }
    /** Show the widget (after close). */
    show() {
      if (this.destroyed || !this.root) return;
      this.win = { ...this.win, hidden: false };
      this.root.style.display = "";
      this.installKeyboardListener();
      this.persistState();
    }
    /** Hide the widget (close). */
    hide() {
      if (this.destroyed || !this.root) return;
      this.cancelDrag();
      this.cancelResize();
      this.win = { ...this.win, hidden: true };
      this.root.style.display = "none";
      this.removeKeyboardListener();
      this.persistState();
    }
    /** Check if widget is visible. */
    get isVisible() {
      return !this.win.hidden;
    }
    /** Check if widget is collapsed. */
    get isCollapsed() {
      return this.win.collapsed;
    }
    // -------------------------------------------------------------------------
    // Collapse / Expand — two independent layouts
    // -------------------------------------------------------------------------
    /** Expand the widget. Restores exact previous dimensions from state. */
    expand() {
      if (!this.win.collapsed || !this.root || !this.contentEl) return;
      this.contentEl.style.display = "";
      this.contentEl.style.overflow = "";
      this.contentEl.style.height = "";
      this.contentEl.style.minHeight = "";
      this.contentEl.style.padding = "";
      this.root.style.width = this.win.width + "px";
      this.root.style.height = this.win.height + "px";
      this.root.style.minHeight = "";
      this.root.style.minWidth = "";
      this.root.style.overflow = "";
      this.win = { ...this.win, collapsed: false };
      this.root.classList.remove(`${this.classPrefix}-collapsed`);
      this.updateCollapseButton();
      this.persistState();
    }
    /**
     * Collapse the widget to a compact title bar.
     * Uses fixed constants — no DOM measurement.
     */
    collapse() {
      if (this.win.collapsed || !this.root || !this.contentEl) return;
      const rect = this.root.getBoundingClientRect();
      this.win = {
        ...this.win,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        collapsed: true
      };
      this.contentEl.style.display = "none";
      this.root.style.width = COLLAPSED_WIDTH + "px";
      this.root.style.height = COLLAPSED_HEIGHT + "px";
      this.root.style.minHeight = COLLAPSED_HEIGHT + "px";
      this.root.style.minWidth = COLLAPSED_WIDTH + "px";
      this.root.style.overflow = "hidden";
      this.root.classList.add(`${this.classPrefix}-collapsed`);
      this.updateCollapseButton();
      this.persistState();
    }
    /** Toggle collapse state. */
    toggleCollapse() {
      if (this.win.collapsed) {
        this.expand();
      } else {
        this.collapse();
      }
    }
    // -------------------------------------------------------------------------
    // State persistence
    // -------------------------------------------------------------------------
    persistState() {
      if (this.win.width <= 0 || this.win.height <= 0) {
        return;
      }
      saveState(this.storageKey, { ...this.win });
    }
    // -------------------------------------------------------------------------
    // Keyboard shortcuts
    // -------------------------------------------------------------------------
    installKeyboardListener() {
      if (this.boundOnKeyDown) return;
      this.boundOnKeyDown = this.onKeyDown;
      document.addEventListener("keydown", this.boundOnKeyDown);
    }
    removeKeyboardListener() {
      if (this.boundOnKeyDown) {
        document.removeEventListener("keydown", this.boundOnKeyDown);
        this.boundOnKeyDown = null;
      }
    }
    // -------------------------------------------------------------------------
    // Window controls
    // -------------------------------------------------------------------------
    updateCollapseButton() {
      if (!this.collapseBtn) return;
      this.collapseBtn.textContent = this.win.collapsed ? "\u25B6" : "\u25BC";
      this.collapseBtn.title = this.win.collapsed ? "Expand" : "Collapse";
    }
    // -------------------------------------------------------------------------
    // Drag handling — bulletproof state management
    // -------------------------------------------------------------------------
    cancelDrag() {
      if (!this.isDragging) return;
      this.isDragging = false;
      if (this.root) {
        const header = this.root.querySelector(`.${this.classPrefix}-header`);
        if (header) {
          header.style.cursor = "grab";
        }
      }
      this.removeDragListeners();
    }
    removeDragListeners() {
      if (this.boundOnDragPointerMove) {
        document.removeEventListener("pointermove", this.boundOnDragPointerMove);
      }
      if (this.boundOnDragPointerUp) {
        document.removeEventListener("pointerup", this.boundOnDragPointerUp);
        document.removeEventListener("pointercancel", this.boundOnDragPointerUp);
        window.removeEventListener("blur", this.boundOnDragPointerUp);
      }
      this.boundOnDragPointerMove = null;
      this.boundOnDragPointerUp = null;
    }
    // -------------------------------------------------------------------------
    // Resize handling — bulletproof state management
    // -------------------------------------------------------------------------
    cancelResize() {
      if (!this.isResizing) return;
      this.isResizing = false;
      this.removeResizeListeners();
    }
    removeResizeListeners() {
      if (this.boundOnResizePointerMove) {
        document.removeEventListener("pointermove", this.boundOnResizePointerMove);
      }
      if (this.boundOnResizePointerUp) {
        document.removeEventListener("pointerup", this.boundOnResizePointerUp);
        document.removeEventListener("pointercancel", this.boundOnResizePointerUp);
        window.removeEventListener("blur", this.boundOnResizePointerUp);
      }
      this.boundOnResizePointerMove = null;
      this.boundOnResizePointerUp = null;
    }
  };

  // ../src/companion/brand-logo.ts
  var COMPANION_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 505 494">
  <g transform="translate(0,494) scale(0.1,-0.1)" fill="#2F6BFF" stroke="none">
    <path d="M2175 4453 c-132 -21 -369 -81 -453 -114 -402 -159 -744 -435 -977 -789 -135 -205 -251 -468 -296 -670 -4 -19 -14 -66 -23 -105 -35 -153 -52 -408 -37 -551 47 -444 167 -752 431 -1109 115 -155 392 -405 538 -486 27 -14 66 -37 88 -51 167 -102 460 -196 741 -237 92 -14 363 -14 473 -1 115 14 233 41 223 50 -4 5 -87 10 -183 13 -163 4 -184 7 -309 42 -276 76 -447 169 -656 358 -49 45 -103 97 -120 116 -16 19 -37 42 -46 51 -19 20 -149 214 -149 223 0 4 -18 36 -40 72 -22 36 -40 70 -40 75 0 6 -4 10 -8 10 -5 0 -9 6 -10 13 -1 6 -19 64 -41 128 -36 106 -79 267 -96 364 -21 116 -10 419 20 572 14 70 73 267 95 318 116 270 267 484 454 644 217 185 473 315 730 369 108 23 144 26 331 27 185 0 223 -3 315 -23 234 -53 435 -132 648 -256 63 -37 92 -48 123 -48 78 1 172 66 183 127 10 53 -31 111 -194 276 -152 153 -210 200 -340 275 -36 21 -68 43 -72 48 -5 7 -8 7 -8 1 0 -6 -3 -6 -8 1 -22 32 -233 135 -363 177 -95 31 -190 54 -369 88 -99 18 -447 20 -555 2z"/>
  </g>
</svg>`;
  var COMPANION_LOGO_DATA_URI = `data:image/svg+xml,${encodeURIComponent(COMPANION_LOGO_SVG)}`;

  // ../src/companion/finance-widget.ts
  var DEFAULT_CLASS_PREFIX2 = "ab-finance";
  var STORAGE_KEY2 = "ab-finance-widget-state";
  var DEFAULT_STATE = {
    x: 24,
    y: 24,
    width: 360,
    height: 380,
    collapsed: false,
    hidden: false
  };
  var FinanceWidget = class extends CompanionWindow {
    constructor(controller2, config = {}) {
      const windowConfig = {
        container: config.container,
        classPrefix: config.classPrefix ?? DEFAULT_CLASS_PREFIX2,
        storageKey: STORAGE_KEY2,
        defaultState: DEFAULT_STATE,
        onClose: config.onClose
      };
      super(windowConfig);
      __publicField(this, "controller");
      __publicField(this, "unsubscribe");
      __publicField(this, "refreshBtn", null);
      __publicField(this, "shiftBtn", null);
      __publicField(this, "shiftDropdown", null);
      // -------------------------------------------------------------------------
      // State rendering
      // -------------------------------------------------------------------------
      __publicField(this, "onStateChange", (state) => {
        if (this.destroyed) return;
        this.render(state);
      });
      __publicField(this, "onRefreshClick", () => {
        if (this.destroyed) return;
        this.controller.refresh();
      });
      __publicField(this, "onShiftToggle", () => {
        if (this.destroyed || !this.shiftDropdown) return;
        const isVisible = this.shiftDropdown.classList.contains("open");
        if (isVisible) {
          this.shiftDropdown.classList.remove("open");
        } else {
          this.shiftDropdown.classList.add("open");
        }
      });
      __publicField(this, "onShiftSelect", (event) => {
        if (this.destroyed) return;
        const target = event.currentTarget;
        const shift = target.dataset.shift;
        if (shift && (shift === "morning" || shift === "day" || shift === "night")) {
          this.controller.setShift(shift);
          if (this.shiftDropdown) {
            this.shiftDropdown.classList.remove("open");
          }
        }
      });
      this.controller = controller2;
      this.unsubscribe = this.controller.subscribe(this.onStateChange);
      this.render(this.controller.getState());
      this.controller.refresh();
    }
    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------
    /** Remove the widget from the DOM and unsubscribe from the controller. */
    destroy() {
      if (this.destroyed) return;
      this.unsubscribe();
      this.controller.cancelPending();
      this.refreshBtn = null;
      this.shiftBtn = null;
      this.shiftDropdown = null;
      super.destroy();
    }
    render(state) {
      if (!this.root) {
        this.createRoot();
      }
      this.updateRefreshButton(state.status);
      this.updateShiftButton(state.shift);
      if (!this.win.collapsed) {
        this.updateContent(state);
      }
    }
    // -------------------------------------------------------------------------
    // DOM creation
    // -------------------------------------------------------------------------
    createRoot() {
      const saved = this.win;
      const root = document.createElement("div");
      root.className = this.classPrefix;
      root.id = `${this.classPrefix}-widget`;
      root.style.left = saved.x + "px";
      root.style.top = saved.y + "px";
      root.style.bottom = "auto";
      root.style.right = "auto";
      if (saved.hidden) {
        root.style.display = "none";
      }
      if (saved.collapsed) {
        root.classList.add(`${this.classPrefix}-collapsed`);
        root.style.width = "330px";
        root.style.height = "44px";
        root.style.overflow = "hidden";
      } else {
        root.style.width = saved.width + "px";
        root.style.height = saved.height + "px";
      }
      const dragHandle = document.createElement("div");
      dragHandle.className = `${this.classPrefix}-header`;
      dragHandle.id = `${this.classPrefix}-drag-handle`;
      const title = document.createElement("div");
      title.className = `${this.classPrefix}-header-title`;
      const logo = document.createElement("span");
      logo.className = `${this.classPrefix}-logo`;
      logo.innerHTML = COMPANION_LOGO_SVG;
      const titleText = document.createElement("span");
      titleText.textContent = "FINANCE";
      title.appendChild(logo);
      title.appendChild(titleText);
      const actions = document.createElement("div");
      actions.className = `${this.classPrefix}-header-actions`;
      const shiftBtn = document.createElement("button");
      shiftBtn.className = `${this.classPrefix}-shift-btn`;
      shiftBtn.title = "Shift";
      const shiftDropdown = document.createElement("div");
      shiftDropdown.className = `${this.classPrefix}-shift-dropdown`;
      for (const def of FinanceShift.getAllDefinitions()) {
        const option = document.createElement("button");
        option.className = `${this.classPrefix}-shift-option`;
        option.dataset.shift = def.type;
        option.innerHTML = `<span class="${this.classPrefix}-shift-name">${def.label}</span><span class="${this.classPrefix}-shift-time">${def.timeDisplay}</span>`;
        option.addEventListener("click", this.onShiftSelect);
        shiftDropdown.appendChild(option);
      }
      const refreshBtn = document.createElement("button");
      refreshBtn.className = `${this.classPrefix}-btn`;
      refreshBtn.title = "Refresh";
      refreshBtn.textContent = "\u21BB";
      const collapseBtn = document.createElement("button");
      collapseBtn.className = `${this.classPrefix}-btn ${this.classPrefix}-collapse-btn`;
      collapseBtn.title = "Collapse";
      collapseBtn.textContent = saved.collapsed ? "\u25B6" : "\u25BC";
      const closeBtn = document.createElement("button");
      closeBtn.className = `${this.classPrefix}-btn ${this.classPrefix}-close-btn`;
      closeBtn.title = "Close";
      closeBtn.textContent = "\u2715";
      actions.appendChild(shiftBtn);
      actions.appendChild(shiftDropdown);
      actions.appendChild(refreshBtn);
      actions.appendChild(collapseBtn);
      actions.appendChild(closeBtn);
      dragHandle.appendChild(title);
      dragHandle.appendChild(actions);
      const content = document.createElement("div");
      content.className = `${this.classPrefix}-body`;
      if (saved.collapsed) {
        content.style.display = "none";
      }
      const resizeHandle = document.createElement("div");
      resizeHandle.className = `${this.classPrefix}-resize-handle`;
      root.appendChild(dragHandle);
      root.appendChild(content);
      root.appendChild(resizeHandle);
      this.root = root;
      this.refreshBtn = refreshBtn;
      this.shiftBtn = shiftBtn;
      this.shiftDropdown = shiftDropdown;
      this.contentEl = content;
      this.collapseBtn = collapseBtn;
      this.closeBtn = closeBtn;
      shiftBtn.addEventListener("click", this.onShiftToggle);
      refreshBtn.addEventListener("click", this.onRefreshClick);
      this.container.appendChild(root);
      this.initWindow(dragHandle, resizeHandle);
    }
    // -------------------------------------------------------------------------
    // State-based rendering
    // -------------------------------------------------------------------------
    updateRefreshButton(status) {
      if (!this.refreshBtn) return;
      this.refreshBtn.disabled = status === "loading";
      this.refreshBtn.textContent = status === "loading" ? "\u2026" : "\u21BB";
    }
    updateShiftButton(shift) {
      if (!this.shiftBtn || !this.shiftDropdown) return;
      const def = FinanceShift.getDefinition(shift);
      this.shiftBtn.textContent = `${def.label} \u25BE`;
      const options = this.shiftDropdown.querySelectorAll(`.${this.classPrefix}-shift-option`);
      options.forEach((opt) => {
        const htmlOpt = opt;
        if (htmlOpt.dataset.shift === shift) {
          htmlOpt.classList.add("active");
        } else {
          htmlOpt.classList.remove("active");
        }
      });
    }
    updateContent(state) {
      if (!this.contentEl) return;
      switch (state.status) {
        case "idle":
          this.renderIdle();
          break;
        case "loading":
          this.renderLoading();
          break;
        case "loaded":
          this.renderLoaded(state);
          break;
        case "error":
          this.renderError(state);
          break;
      }
    }
    renderIdle() {
      if (!this.contentEl) return;
      this.contentEl.innerHTML = "";
      const message = this.createMessage("Ready to load finance data.");
      this.contentEl.appendChild(message);
    }
    renderLoading() {
      if (!this.contentEl) return;
      this.contentEl.innerHTML = "";
      const message = this.createMessage("Loading\u2026");
      this.contentEl.appendChild(message);
    }
    renderLoaded(state) {
      if (!this.contentEl) return;
      this.contentEl.innerHTML = "";
      const def = FinanceShift.getDefinition(state.shift);
      const allTransactions = state.data?.list ?? [];
      const { filtered, isWaiting } = FinanceShift.filterByShiftSmart(
        allTransactions,
        state.shift
      );
      const filteredSum = filtered.reduce((acc, tx) => acc + tx.sum, 0);
      const shiftInfo = document.createElement("div");
      shiftInfo.className = `${this.classPrefix}-shift-info`;
      const row1 = document.createElement("div");
      row1.className = `${this.classPrefix}-shift-info-row`;
      const label1 = document.createElement("span");
      label1.className = `${this.classPrefix}-label`;
      label1.textContent = "Date:";
      const value1 = document.createElement("span");
      value1.className = `${this.classPrefix}-value`;
      value1.textContent = FinanceShift.formatDate(/* @__PURE__ */ new Date());
      row1.appendChild(label1);
      row1.appendChild(value1);
      const row2 = document.createElement("div");
      row2.className = `${this.classPrefix}-shift-info-row`;
      const label2 = document.createElement("span");
      label2.className = `${this.classPrefix}-label`;
      label2.textContent = "Shift:";
      const value2 = document.createElement("span");
      value2.className = `${this.classPrefix}-value ${this.classPrefix}-accent`;
      value2.textContent = `${def.label} (${def.timeDisplay})`;
      row2.appendChild(label2);
      row2.appendChild(value2);
      shiftInfo.appendChild(row1);
      shiftInfo.appendChild(row2);
      const divider1 = document.createElement("div");
      divider1.className = `${this.classPrefix}-divider`;
      const creditsRow = document.createElement("div");
      creditsRow.className = `${this.classPrefix}-row`;
      const creditsLabel = document.createElement("span");
      creditsLabel.className = `${this.classPrefix}-label`;
      creditsLabel.textContent = "Credits";
      const creditsValue = document.createElement("span");
      creditsValue.className = `${this.classPrefix}-value ${this.classPrefix}-accent`;
      creditsValue.textContent = isWaiting ? "0" : filteredSum.toLocaleString();
      creditsRow.appendChild(creditsLabel);
      creditsRow.appendChild(creditsValue);
      const divider2 = document.createElement("div");
      divider2.className = `${this.classPrefix}-divider`;
      this.contentEl.appendChild(shiftInfo);
      this.contentEl.appendChild(divider1);
      this.contentEl.appendChild(creditsRow);
      this.contentEl.appendChild(divider2);
      if (isWaiting) {
        const waitingMsg = this.createMessage(`Waiting for Night shift (${def.timeDisplay}).`);
        this.contentEl.appendChild(waitingMsg);
        return;
      }
      if (filtered.length === 0) {
        const empty = this.createMessage("No transactions for this shift.");
        this.contentEl.appendChild(empty);
      } else {
        const txContainer = document.createElement("div");
        txContainer.className = `${this.classPrefix}-tx-container`;
        const headerRow = document.createElement("div");
        headerRow.className = `${this.classPrefix}-tx-header`;
        headerRow.appendChild(this.createTxHeaderCell("Time"));
        headerRow.appendChild(this.createTxHeaderCell("Operation"));
        headerRow.appendChild(this.createTxHeaderCell("Target ID"));
        headerRow.appendChild(this.createTxHeaderCell("Credits"));
        txContainer.appendChild(headerRow);
        for (const tx of filtered) {
          txContainer.appendChild(this.createTransactionRow(tx));
        }
        this.contentEl.appendChild(txContainer);
      }
    }
    renderError(state) {
      if (!this.contentEl) return;
      this.contentEl.innerHTML = "";
      const errorEl = document.createElement("div");
      errorEl.className = `${this.classPrefix}-error`;
      errorEl.textContent = state.error ?? "Unknown error";
      this.contentEl.appendChild(errorEl);
    }
    // -------------------------------------------------------------------------
    // Transaction row
    // -------------------------------------------------------------------------
    createTransactionRow(tx) {
      const row = document.createElement("div");
      row.className = `${this.classPrefix}-tx-row`;
      const timeStr = FinanceShift.formatTime(tx.date);
      row.appendChild(this.createTxCell(timeStr));
      row.appendChild(this.createTxCell(tx.operation, true));
      row.appendChild(this.createTxCell(String(tx.userID)));
      row.appendChild(this.createTxCell(tx.sum.toLocaleString(), false, true));
      return row;
    }
    createTxHeaderCell(text) {
      const cell = document.createElement("span");
      cell.className = `${this.classPrefix}-tx-cell ${this.classPrefix}-tx-header-cell`;
      cell.textContent = text;
      return cell;
    }
    createTxCell(text, isOp = false, isCredits = false) {
      const cell = document.createElement("span");
      let className = `${this.classPrefix}-tx-cell`;
      if (isOp) className += ` ${this.classPrefix}-tx-op`;
      if (isCredits) className += ` ${this.classPrefix}-accent`;
      cell.className = className;
      cell.textContent = text;
      return cell;
    }
    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------
    createMessage(text) {
      const el = document.createElement("div");
      el.className = `${this.classPrefix}-message`;
      el.textContent = text;
      return el;
    }
  };

  // ../src/companion/finance-widget.css.ts
  var FINANCE_WIDGET_CSS = `
/* Widget root */
.ab-finance {
    position: fixed;
    bottom: 24px;
    left: 24px;
    width: 360px;
    height: 380px;
    min-width: 280px;
    min-height: 200px;
    max-width: 700px;
    max-height: 600px;
    background: #1F2235;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    z-index: 2147483646;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #E0E0E0;
    box-shadow: 0 8px 32px 0 rgba(0,0,0,0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    user-select: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* Collapsed \u2014 JS sets explicit dimensions via COLLAPSED_WIDTH/HEIGHT constants.
   CSS only hides the resize handle and adjusts header border. */
.ab-finance.collapsed .ab-finance-resize-handle {
    display: none;
}

.ab-finance.collapsed .ab-finance-header {
    border-bottom: none;
    border-radius: 10px;
}

/* Resize handle */
.ab-finance-resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.3) 50%);
    border-radius: 0 0 10px 0;
    z-index: 1;
    touch-action: none;
}

.ab-finance-resize-handle:hover {
    background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.5) 50%);
}

/* Header / Drag handle */
.ab-finance-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    cursor: grab;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.03);
    min-height: 40px;
    border-radius: 10px 10px 0 0;
    flex-shrink: 0;
    touch-action: none;
}

.ab-finance-header-title {
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    color: rgba(255,255,255,0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
}

/* Companion Logo */
.ab-finance-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
}

.ab-finance-logo svg {
    width: 100%;
    height: 100%;
}

.ab-finance-header-actions {
    display: flex;
    gap: 2px;
    align-items: center;
    position: relative;
    flex-shrink: 0;
}

.ab-finance-header-actions button {
    background: none;
    border: none;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    font-size: 11px;
    flex-shrink: 0;
}

.ab-finance-header-actions button:hover {
    color: #E0E0E0;
    background: rgba(255,255,255,0.1);
}

/* Refresh button hover */
.ab-finance-header-actions .ab-finance-btn:hover {
    color: #59AFFF;
    background: rgba(89,175,255,0.1);
}

/* Collapse button */
.ab-finance-collapse-btn {
    font-size: 10px !important;
}

.ab-finance-collapse-btn:hover {
    color: #59AFFF !important;
    background: rgba(89,175,255,0.1) !important;
}

/* Close button */
.ab-finance-close-btn:hover {
    background: rgba(239,83,80,0.3) !important;
    color: #EF5350 !important;
}

/* Body */
.ab-finance-body {
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    flex: 1;
    user-select: text;
}

.ab-finance-body::-webkit-scrollbar {
    width: 4px;
}

.ab-finance-body::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 2px;
}

/* Row */
.ab-finance-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.ab-finance-label {
    font-size: 10px;
    color: rgba(255,255,255,0.5);
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

.ab-finance-value {
    font-size: 12px;
    font-weight: 600;
    color: #E0E0E0;
}

.ab-finance-value.ab-finance-accent {
    color: #59AFFF;
}

.ab-finance-value.ab-finance-success {
    color: #81C784;
}

.ab-finance-value.ab-finance-warning {
    color: #FFB74D;
}

/* Button */
.ab-finance-btn {
    flex: 1;
    background: rgba(255,255,255,0.05);
    color: #E0E0E0;
    border: 1px solid rgba(255,255,255,0.1);
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 10px;
    font-weight: 500;
    text-align: center;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
}

.ab-finance-btn:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.2);
}

.ab-finance-btn:active {
    transform: scale(0.97);
}

.ab-finance-btn.primary {
    background: #2F6BFF;
    border-color: #2F6BFF;
    color: #FFFFFF;
}

.ab-finance-btn.primary:hover {
    background: #4A82FF;
}

.ab-finance-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Divider */
.ab-finance-divider {
    height: 1px;
    background: rgba(255,255,255,0.1);
    margin: 2px 0;
}

/* Message */
.ab-finance-message {
    text-align: center;
    color: rgba(255,255,255,0.5);
    font-size: 10px;
    padding: 6px 0;
}

/* Error */
.ab-finance-error {
    text-align: center;
    color: #EF5350;
    font-size: 10px;
    padding: 6px 0;
}

/* Transaction container */
.ab-finance-tx-container {
    display: flex;
    flex-direction: column;
    gap: 0;
    width: 100%;
}

/* Transaction header: 4 columns \u2014 Time | Operation | Target ID | Credits */
.ab-finance-tx-header {
    display: grid;
    grid-template-columns: 50px 1fr 1fr 60px;
    gap: 4px;
    font-size: 9px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.3px;
    padding: 2px 0;
    border-bottom: 1px solid rgba(255,255,255,0.1);
}

/* Transaction rows: same 4 columns */
.ab-finance-tx-row {
    display: grid;
    grid-template-columns: 50px 1fr 1fr 60px;
    gap: 4px;
    font-size: 10px;
    padding: 3px 0;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    color: #E0E0E0;
}

.ab-finance-tx-cell {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
}

.ab-finance-tx-header-cell {
    text-align: center;
    font-weight: 600;
}

.ab-finance-tx-op {
    color: rgba(255,255,255,0.5);
}

/* Shift dropdown */
.ab-finance-shift-btn {
    background: none;
    border: none;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 500;
    transition: all 0.15s ease;
}

.ab-finance-shift-btn:hover {
    color: #E0E0E0;
    background: rgba(255,255,255,0.1);
}

.ab-finance-shift-dropdown {
    display: none;
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: #1F2235;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 4px;
    z-index: 10;
    min-width: 160px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}

.ab-finance-shift-dropdown.open {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.ab-finance-shift-option {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: none;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 6px 10px;
    cursor: pointer;
    text-align: left;
    color: #E0E0E0;
    transition: all 0.15s ease;
    width: 100%;
}

.ab-finance-shift-option:hover {
    background: rgba(255,255,255,0.08);
}

.ab-finance-shift-option.active {
    background: #2F6BFF;
    border-color: #2F6BFF;
    color: #FFFFFF;
}

.ab-finance-shift-option.active:hover {
    background: #4A82FF;
}

.ab-finance-shift-name {
    font-size: 11px;
    font-weight: 600;
}

.ab-finance-shift-time {
    font-size: 9px;
    opacity: 0.7;
}

/* Shift info */
.ab-finance-shift-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 2px 0;
}

.ab-finance-shift-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

/* Status */
.ab-finance-status {
    font-size: 9px;
    color: rgba(255,255,255,0.5);
    text-align: center;
    margin-top: 1px;
}
`;

  // ../src/companion/bootstrap.ts
  var app = null;
  var widget = null;
  var controller = null;
  var stylesInjected = false;
  var widgetInitialized = false;
  function injectFinanceStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement("style");
    style.id = "ab-finance-styles";
    style.textContent = FINANCE_WIDGET_CSS;
    document.head.appendChild(style);
  }
  function ensureFinanceWidget() {
    if (widgetInitialized) return;
    widgetInitialized = true;
    injectFinanceStyles();
    controller = new FinanceController();
    widget = new FinanceWidget(controller);
    widget.hide();
    diag("Finance created");
  }
  function createFinanceModule() {
    return {
      name: "finance",
      label: "Finance",
      open() {
        ensureFinanceWidget();
        widget?.show();
        diag("Finance shown");
      },
      close() {
        widget?.hide();
        diag("Finance hidden");
      },
      get isOpen() {
        return widget?.isVisible ?? false;
      },
      destroy() {
        widget?.destroy();
        controller?.cancelPending();
        widget = null;
        controller = null;
        widgetInitialized = false;
      }
    };
  }
  function createApp() {
    const manager = new ModuleManager();
    manager.register(createFinanceModule());
    app = new CompanionApp(manager);
    app.start();
  }
  function bootstrap() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootstrap);
      return;
    }
    if (window.__AB_COMPANION_APP__) return;
    window.__AB_COMPANION_APP__ = true;
    if (window !== window.top) return;
    createApp();
  }
  bootstrap();
})();
})();
