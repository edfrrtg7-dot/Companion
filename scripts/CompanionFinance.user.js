// ==UserScript==
// @name         AgencyBooster Finance Companion
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Finance widget for AgencyBooster
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      if (options?.signal) {
        if (options.signal.aborted) {
          clearTimeout(timeoutId);
          throw new FinanceApiAbortError("Signal already aborted");
        }
        options.signal.addEventListener("abort", () => controller.abort(), { once: true });
      }
      try {
        const response = await fetch(url, {
          method: "GET",
          credentials: "same-origin",
          signal: controller.signal,
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
     * Format the shift date range for display.
     */
    static formatDateRange(range) {
      return `${_FinanceShift.formatDate(range.from)} \u2014 ${_FinanceShift.formatDate(range.to)}`;
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
      const controller = new AbortController();
      this.abortController = controller;
      try {
        const raw = await this.client.fetchTransactions(
          this.state.from,
          this.state.to,
          {
            signal: controller.signal,
            timeoutMs: this.timeoutMs
          }
        );
        if (controller.signal.aborted) {
          return;
        }
        const mapped = FinanceMapper.mapResponse(raw);
        this.setState({ status: "loaded", data: mapped, error: null });
      } catch (error) {
        if (controller.signal.aborted) {
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
        if (this.abortController === controller) {
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

  // ../src/companion/finance-widget.ts
  var DEFAULT_CLASS_PREFIX = "ab-finance";
  var FinanceWidget = class {
    constructor(controller, config = {}) {
      __publicField(this, "controller");
      __publicField(this, "container");
      __publicField(this, "classPrefix");
      __publicField(this, "unsubscribe");
      __publicField(this, "root", null);
      __publicField(this, "refreshBtn", null);
      __publicField(this, "shiftBtn", null);
      __publicField(this, "shiftDropdown", null);
      __publicField(this, "contentEl", null);
      __publicField(this, "destroyed", false);
      // Drag state
      __publicField(this, "isDragging", false);
      __publicField(this, "dragStartX", 0);
      __publicField(this, "dragStartY", 0);
      __publicField(this, "dragOrigX", 0);
      __publicField(this, "dragOrigY", 0);
      __publicField(this, "boundOnDragPointerMove", null);
      __publicField(this, "boundOnDragPointerUp", null);
      // -------------------------------------------------------------------------
      // State rendering
      // -------------------------------------------------------------------------
      __publicField(this, "onStateChange", (state) => {
        if (this.destroyed) return;
        this.render(state);
      });
      // -------------------------------------------------------------------------
      // Drag handling
      // -------------------------------------------------------------------------
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
        if (this.root.firstElementChild) {
          this.root.firstElementChild.style.cursor = "grabbing";
        }
        this.boundOnDragPointerMove = this.onDragPointerMove;
        this.boundOnDragPointerUp = this.onDragPointerUp;
        document.addEventListener("pointermove", this.boundOnDragPointerMove);
        document.addEventListener("pointerup", this.boundOnDragPointerUp);
        document.addEventListener("pointercancel", this.boundOnDragPointerUp);
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
        if (this.root && this.root.firstElementChild) {
          this.root.firstElementChild.style.cursor = "grab";
        }
        this.removeDragListeners();
      });
      __publicField(this, "onRefreshClick", () => {
        if (this.destroyed) return;
        this.controller.refresh();
      });
      __publicField(this, "onShiftToggle", () => {
        if (this.destroyed || !this.shiftDropdown) return;
        const isVisible = this.shiftDropdown.style.display !== "none";
        this.shiftDropdown.style.display = isVisible ? "none" : "flex";
      });
      __publicField(this, "onShiftSelect", (event) => {
        if (this.destroyed) return;
        const target = event.currentTarget;
        const shift = target.dataset.shift;
        if (shift && (shift === "morning" || shift === "day" || shift === "night")) {
          this.controller.setShift(shift);
          if (this.shiftDropdown) {
            this.shiftDropdown.style.display = "none";
          }
        }
      });
      this.controller = controller;
      this.container = config.container ?? document.body;
      this.classPrefix = config.classPrefix ?? DEFAULT_CLASS_PREFIX;
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
      this.destroyed = true;
      this.unsubscribe();
      this.controller.cancelPending();
      this.removeDragListeners();
      this.root?.remove();
      this.root = null;
      this.refreshBtn = null;
      this.shiftBtn = null;
      this.shiftDropdown = null;
      this.contentEl = null;
    }
    /** Check if the widget has been destroyed. */
    get isDestroyed() {
      return this.destroyed;
    }
    render(state) {
      if (!this.root) {
        this.createRoot();
      }
      this.updateRefreshButton(state.status);
      this.updateShiftButton(state.shift);
      this.updateContent(state);
    }
    // -------------------------------------------------------------------------
    // DOM creation
    // -------------------------------------------------------------------------
    createRoot() {
      const root = document.createElement("div");
      root.className = this.classPrefix;
      root.id = `${this.classPrefix}-widget`;
      root.style.width = "360px";
      root.style.height = "380px";
      root.style.position = "fixed";
      root.style.bottom = "20px";
      root.style.right = "20px";
      root.style.zIndex = "2147483647";
      const dragHandle = document.createElement("div");
      dragHandle.className = `${this.classPrefix}-header`;
      dragHandle.id = `${this.classPrefix}-drag-handle`;
      dragHandle.style.cursor = "grab";
      const title = document.createElement("div");
      title.className = `${this.classPrefix}-header-title`;
      title.textContent = "Finance";
      const actions = document.createElement("div");
      actions.className = `${this.classPrefix}-header-actions`;
      const shiftBtn = document.createElement("button");
      shiftBtn.className = `${this.classPrefix}-shift-btn`;
      shiftBtn.title = "Shift";
      const shiftDropdown = document.createElement("div");
      shiftDropdown.className = `${this.classPrefix}-shift-dropdown`;
      shiftDropdown.style.display = "none";
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
      actions.appendChild(shiftBtn);
      actions.appendChild(shiftDropdown);
      actions.appendChild(refreshBtn);
      dragHandle.appendChild(title);
      dragHandle.appendChild(actions);
      const content = document.createElement("div");
      content.className = `${this.classPrefix}-body`;
      root.appendChild(dragHandle);
      root.appendChild(content);
      this.root = root;
      this.refreshBtn = refreshBtn;
      this.shiftBtn = shiftBtn;
      this.shiftDropdown = shiftDropdown;
      this.contentEl = content;
      dragHandle.addEventListener("pointerdown", this.onDragPointerDown);
      shiftBtn.addEventListener("click", this.onShiftToggle);
      refreshBtn.addEventListener("click", this.onRefreshClick);
      this.container.appendChild(root);
    }
    removeDragListeners() {
      if (this.boundOnDragPointerMove) {
        document.removeEventListener("pointermove", this.boundOnDragPointerMove);
      }
      if (this.boundOnDragPointerUp) {
        document.removeEventListener("pointerup", this.boundOnDragPointerUp);
        document.removeEventListener("pointercancel", this.boundOnDragPointerUp);
      }
      this.boundOnDragPointerMove = null;
      this.boundOnDragPointerUp = null;
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
      const dateRange = FinanceShift.computeDateRange(state.shift);
      const shiftInfo = document.createElement("div");
      shiftInfo.className = `${this.classPrefix}-shift-info`;
      const row1 = document.createElement("div");
      row1.className = `${this.classPrefix}-shift-info-row`;
      const label1 = document.createElement("span");
      label1.className = `${this.classPrefix}-label`;
      label1.textContent = "Today:";
      const value1 = document.createElement("span");
      value1.className = `${this.classPrefix}-value`;
      value1.textContent = FinanceShift.formatDate(dateRange.from);
      row1.appendChild(label1);
      row1.appendChild(value1);
      const row2 = document.createElement("div");
      row2.className = `${this.classPrefix}-shift-info-row`;
      const label2 = document.createElement("span");
      label2.className = `${this.classPrefix}-label`;
      label2.textContent = "Shift:";
      const value2 = document.createElement("span");
      value2.className = `${this.classPrefix}-value ${this.classPrefix}-accent`;
      value2.textContent = def.label;
      row2.appendChild(label2);
      row2.appendChild(value2);
      const row3 = document.createElement("div");
      row3.className = `${this.classPrefix}-shift-info-row`;
      const label3 = document.createElement("span");
      label3.className = `${this.classPrefix}-label`;
      label3.textContent = "Schedule:";
      const value3 = document.createElement("span");
      value3.className = `${this.classPrefix}-value ${this.classPrefix}-shift-time-display`;
      value3.textContent = def.timeDisplay;
      row3.appendChild(label3);
      row3.appendChild(value3);
      shiftInfo.appendChild(row1);
      shiftInfo.appendChild(row2);
      shiftInfo.appendChild(row3);
      const divider1 = document.createElement("div");
      divider1.className = `${this.classPrefix}-divider`;
      const creditsRow = document.createElement("div");
      creditsRow.className = `${this.classPrefix}-row`;
      const creditsLabel = document.createElement("span");
      creditsLabel.className = `${this.classPrefix}-label`;
      creditsLabel.textContent = "Credits";
      const creditsValue = document.createElement("span");
      creditsValue.className = `${this.classPrefix}-value ${this.classPrefix}-accent`;
      creditsValue.textContent = state.data?.total?.toLocaleString() ?? "\u2014";
      creditsRow.appendChild(creditsLabel);
      creditsRow.appendChild(creditsValue);
      const divider2 = document.createElement("div");
      divider2.className = `${this.classPrefix}-divider`;
      const transactions = state.data?.list ?? [];
      this.contentEl.appendChild(shiftInfo);
      this.contentEl.appendChild(divider1);
      this.contentEl.appendChild(creditsRow);
      this.contentEl.appendChild(divider2);
      if (transactions.length === 0) {
        const empty = this.createMessage("No transactions found.");
        this.contentEl.appendChild(empty);
      } else {
        const txContainer = document.createElement("div");
        txContainer.className = `${this.classPrefix}-tx-container`;
        const headerRow = document.createElement("div");
        headerRow.className = `${this.classPrefix}-tx-header`;
        headerRow.appendChild(this.createTxCell("Date"));
        headerRow.appendChild(this.createTxCell("Time"));
        headerRow.appendChild(this.createTxCell("Op"));
        headerRow.appendChild(this.createTxCell("Target"));
        headerRow.appendChild(this.createTxCell("Cr"));
        txContainer.appendChild(headerRow);
        for (const tx of transactions) {
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
      const dateStr = FinanceShift.formatDate(tx.date);
      const timeStr = FinanceShift.formatTime(tx.date);
      row.appendChild(this.createTxCell(dateStr));
      row.appendChild(this.createTxCell(timeStr));
      row.appendChild(this.createTxCell(tx.operation, true));
      row.appendChild(this.createTxCell(tx.name));
      row.appendChild(this.createTxCell(tx.sum.toLocaleString(), false, true));
      return row;
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

  // ../src/companion/bootstrap.ts
  function bootstrap() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootstrap);
      return;
    }
    if (window.__AB_FINANCE_COMPANION__) return;
    window.__AB_FINANCE_COMPANION__ = true;
    if (window !== window.top) return;
    const controller = new FinanceController();
    new FinanceWidget(controller);
  }
  bootstrap();
})();
})();
