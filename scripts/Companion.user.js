// ==UserScript==
// @name         Companion
// @namespace    http://tampermonkey.net/
// @version      2.1.0
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

  // ../src/companion/platform-interface.ts
  var currentPlatform;
  function getPlatform() {
    if (!currentPlatform) {
      throw new Error("Platform not initialized. Call setPlatform() during bootstrap.");
    }
    return currentPlatform;
  }
  function setPlatform(platform) {
    currentPlatform = platform;
  }

  // ../src/companion/runtime-environment.ts
  var currentRuntime;
  function getRuntimeEnvironment() {
    if (!currentRuntime) {
      throw new Error("RuntimeEnvironment not initialized. Call setRuntimeEnvironment() during bootstrap.");
    }
    return currentRuntime;
  }
  function setRuntimeEnvironment(runtime) {
    currentRuntime = runtime;
  }
  var ChromeRuntimeEnvironment = class {
    isExtension() {
      return getPlatform().isExtension();
    }
    isTopFrame() {
      try {
        return window === window.top;
      } catch {
        return true;
      }
    }
    getExtensionVersion() {
      return getPlatform().getExtensionVersion();
    }
    getGlobal(key) {
      try {
        return window[key];
      } catch {
        return void 0;
      }
    }
    setGlobal(key, value) {
      try {
        window[key] = value;
      } catch {
      }
    }
    getReadyState() {
      try {
        return document.readyState;
      } catch {
        return "complete";
      }
    }
    onDomReady(callback) {
      try {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", callback);
        } else {
          queueMicrotask(callback);
        }
      } catch {
        queueMicrotask(callback);
      }
    }
    /** Detect if current GoldenBride route is the chat/mail route (e.g., #!VIEWMAIL;0;ALLMAIL). */
    isChatRoute() {
      try {
        const hash = window.location.hash;
        return hash.includes("VIEWMAIL");
      } catch {
        return false;
      }
    }
    /** Get current route category for Finance startup logic. */
    getRouteCategory() {
      if (this.isChatRoute()) return "chat";
      try {
        const hash = window.location.hash;
        if (hash.startsWith("#!")) return "non-chat";
      } catch {
      }
      return "unknown";
    }
  };

  // ../src/companion/global-state.ts
  var currentState;
  function getGlobalState() {
    if (!currentState) {
      throw new Error("GlobalState not initialized. Call setGlobalState() during bootstrap.");
    }
    return currentState;
  }
  function setGlobalState(state) {
    currentState = state;
  }
  var ChromeGlobalState = class {
    has(key) {
      try {
        return window[key] !== void 0;
      } catch {
        return false;
      }
    }
    get(key) {
      try {
        return window[key];
      } catch {
        return void 0;
      }
    }
    set(key, value) {
      try {
        window[key] = value;
      } catch {
      }
    }
  };

  // ../src/companion/storage-adapter.ts
  var LocalStorageAdapter = class {
    constructor() {
      __publicField(this, "readyPromise", Promise.resolve());
    }
    get(key) {
      try {
        return getPlatform().localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    set(key, value) {
      try {
        getPlatform().localStorage.setItem(key, value);
      } catch {
      }
    }
    remove(key) {
      try {
        getPlatform().localStorage.removeItem(key);
      } catch {
      }
    }
    clear() {
      try {
        getPlatform().localStorage.clear();
      } catch {
      }
    }
    exists(key) {
      try {
        return getPlatform().localStorage.getItem(key) !== null;
      } catch {
        return false;
      }
    }
  };
  var ChromeStorageAdapter = class {
    constructor() {
      __publicField(this, "cache", /* @__PURE__ */ new Map());
      __publicField(this, "ready", false);
      __publicField(this, "readyResolver", null);
      __publicField(this, "readyPromise");
      this.readyPromise = new Promise((resolve) => {
        this.readyResolver = resolve;
      });
      this.hydrate();
    }
    /**
     * Hydrate cache from chrome.storage.local.
     * This is async but we don't await it — the cache starts empty
     * and gets populated in the background. Subsequent get() calls
     * will return from cache once hydrated.
     */
    hydrate() {
      const cs = getPlatform().chromeStorage;
      if (cs) {
        cs.getAll().then((all) => {
          for (const [key, value] of Object.entries(all)) {
            if (typeof value === "string") {
              this.cache.set(key, value);
            }
          }
          this.ready = true;
          this.readyResolver?.();
        }).catch(() => {
          this.ready = true;
          this.readyResolver?.();
        });
      } else {
        this.ready = true;
        this.readyResolver?.();
      }
    }
    get(key) {
      return this.cache.get(key) ?? null;
    }
    set(key, value) {
      this.cache.set(key, value);
      this.persist(key, value);
    }
    remove(key) {
      this.cache.delete(key);
      this.persistRemove(key);
    }
    clear() {
      this.cache.clear();
      this.persistClear();
    }
    exists(key) {
      return this.cache.has(key);
    }
    /** Whether the cache has been hydrated from chrome.storage. */
    get isReady() {
      return this.ready;
    }
    persist(key, value) {
      try {
        getPlatform().chromeStorage?.set(key, value);
      } catch {
      }
    }
    persistRemove(key) {
      try {
        getPlatform().chromeStorage?.remove(key);
      } catch {
      }
    }
    persistClear() {
      try {
        getPlatform().chromeStorage?.clear();
      } catch {
      }
    }
  };

  // ../src/companion/storage-service.ts
  var adapter = null;
  function initStorage() {
    if (adapter) {
      return adapter.readyPromise;
    }
    if (getPlatform().chromeStorage) {
      adapter = new ChromeStorageAdapter();
    } else {
      adapter = new LocalStorageAdapter();
    }
    return adapter.readyPromise;
  }
  function getAdapter() {
    if (!adapter) {
      initStorage();
    }
    return adapter;
  }
  async function waitForStorageReady() {
    if (!adapter) {
      await initStorage();
    } else {
      await adapter.readyPromise;
    }
  }
  var StorageService = {
    /**
     * Read a value by key.
     * @param key - Storage key from STORAGE_KEYS
     * @returns The stored value, or null if not found
     */
    get(key) {
      return getAdapter().get(key);
    },
    /**
     * Write a value by key.
     * @param key - Storage key from STORAGE_KEYS
     * @param value - Value to store
     */
    set(key, value) {
      getAdapter().set(key, value);
    },
    /**
     * Remove a value by key.
     * @param key - Storage key from STORAGE_KEYS
     */
    remove(key) {
      getAdapter().remove(key);
    },
    /** Remove all stored values. Use with caution. */
    clear() {
      getAdapter().clear();
    },
    /**
     * Check if a key exists.
     * @param key - Storage key from STORAGE_KEYS
     * @returns true if the key exists
     */
    exists(key) {
      return getAdapter().exists(key);
    },
    /**
     * Get the active adapter type.
     * Useful for diagnostics.
     */
    getAdapterType() {
      if (getPlatform().chromeStorage) {
        return "chrome.storage.local";
      }
      return "localStorage";
    }
  };

  // ../src/companion/storage-keys.ts
  var STORAGE_KEYS = {
    /** Finance widget window state (position, size, collapsed, hidden). */
    COMPANION_WINDOW_STATE: "ab-companion-window-state",
    /** Finance widget unified state (position, size, collapsed, hidden, shift). Single authoritative source. */
    FINANCE_WIDGET_STATE: "ab-finance-widget-state",
    /** Legacy Finance state key — held the shift preset before unification. Removed by migration v1→v2. */
    FINANCE_STATE: "ab-finance-state",
    /** Legacy AgencyBooster widget state key (pre-Companion). Migrated to FINANCE_WIDGET_STATE. */
    LEGACY_FINANCE_WIDGET: "agencybooster-finance-widget",
    /** Legacy AgencyBooster shift preset key (pre-Companion). Migrated to FINANCE_WIDGET_STATE. */
    LEGACY_FINANCE_PRESET: "agencybooster-finance-preset",
    /** Development mode flag. */
    DEV_MODE: "ab-dev",
    /** Settings module preferences (future). */
    SETTINGS: "ab-settings",
    /** Active tab in the Companion modal. */
    COMPANION_ACTIVE_TAB: "ab-companion-active-tab",
    /** Storage version marker. */
    STORAGE_VERSION: "ab-storage-version",
    /** Diagnostics error history. */
    DIAGNOSTICS_ERROR_HISTORY: "ab-diag-error-history",
    /** Diagnostics import history. */
    DIAGNOSTICS_IMPORT_HISTORY: "ab-diag-import-history",
    /** Session memory history (persistent between browser restarts). */
    SESSION_MEMORY: "ab-session-memory"
  };

  // ../src/companion/dev.ts
  var MAX_ERROR_HISTORY = 20;
  function loadErrorHistory() {
    try {
      const raw = StorageService.get(STORAGE_KEYS.DIAGNOSTICS_ERROR_HISTORY);
      if (raw) return JSON.parse(raw);
    } catch {
    }
    return [];
  }
  function saveErrorHistory(entries) {
    try {
      StorageService.set(STORAGE_KEYS.DIAGNOSTICS_ERROR_HISTORY, JSON.stringify(entries));
    } catch {
    }
  }
  function format(level, _args) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().slice(11, 23);
    return `[Companion:${level}] ${timestamp}`;
  }
  function addErrorHistory(message, stack, source) {
    const entries = loadErrorHistory();
    entries.push({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      message,
      stack,
      source
    });
    if (entries.length > MAX_ERROR_HISTORY) entries.shift();
    saveErrorHistory(entries);
  }
  function diag(...args) {
    if (isDevMode()) {
      console.log(format("INFO" /* INFO */, args), ...args);
    }
  }
  function diagError(...args) {
    if (isDevMode()) {
      console.error(format("ERROR" /* ERROR */, args), ...args);
    }
    const message = args.map((a) => a instanceof Error ? a.message : String(a)).join(" ");
    const stack = args.find((a) => a instanceof Error)?.stack;
    addErrorHistory(message, stack, "diagError");
  }
  function isDevMode() {
    try {
      return StorageService.get(STORAGE_KEYS.DEV_MODE) !== null;
    } catch {
      try {
        return localStorage.getItem(STORAGE_KEYS.DEV_MODE) !== null;
      } catch {
        return false;
      }
    }
  }
  function getErrorHistory() {
    return loadErrorHistory();
  }
  var MAX_IMPORT_HISTORY = 20;
  function loadImportHistory() {
    try {
      const raw = StorageService.get(STORAGE_KEYS.DIAGNOSTICS_IMPORT_HISTORY);
      if (raw) return JSON.parse(raw);
    } catch {
    }
    return [];
  }
  function saveImportHistory(entries) {
    try {
      StorageService.set(STORAGE_KEYS.DIAGNOSTICS_IMPORT_HISTORY, JSON.stringify(entries));
    } catch {
    }
  }
  function addImportHistory(entry) {
    const entries = loadImportHistory();
    entries.push(entry);
    if (entries.length > MAX_IMPORT_HISTORY) entries.shift();
    saveImportHistory(entries);
  }
  function getImportHistory() {
    return loadImportHistory();
  }

  // ../src/companion/launcher-diagnostics.ts
  var LauncherDiagnostics = class {
    constructor() {
      __publicField(this, "stages", []);
      __publicField(this, "failed", false);
      __publicField(this, "completed", false);
      __publicField(this, "lastError");
      __publicField(this, "platformName");
      __publicField(this, "runtimeName");
      __publicField(this, "globalStateName");
      __publicField(this, "moduleInfo");
    }
    get enabled() {
      return isDevMode();
    }
    setActiveImplementations(platform, runtime, globalState) {
      this.platformName = platform;
      this.runtimeName = runtime;
      this.globalStateName = globalState;
    }
    setModuleInfo(info) {
      this.moduleInfo = info;
    }
    track(stageName, success, error, stack) {
      if (!this.enabled) return;
      this.stages.push({
        name: stageName,
        timestamp: Date.now(),
        success,
        error,
        stack
      });
      if (!success) {
        this.failed = true;
        this.lastError = error;
      }
    }
    markCompleted() {
      if (this.enabled) this.completed = true;
    }
    getState() {
      const lastSuccessful = [...this.stages].reverse().find((s) => s.success);
      return {
        enabled: this.enabled,
        stages: Object.freeze([...this.stages]),
        lastSuccessfulStage: lastSuccessful?.name ?? null,
        failed: this.failed,
        completed: this.completed,
        lastError: this.lastError,
        activePlatform: this.platformName,
        activeRuntime: this.runtimeName,
        activeGlobalState: this.globalStateName,
        modules: this.moduleInfo
      };
    }
  };
  var defaultInstance = new LauncherDiagnostics();
  var currentInstance;
  function getLauncherDiagnostics() {
    return currentInstance ?? defaultInstance;
  }
  function setLauncherDiagnostics(instance) {
    currentInstance = instance;
  }
  var launcherDiagnostics = defaultInstance;

  // ../src/companion/versioning.ts
  var VersionManager = class {
    constructor() {
      __publicField(this, "counter", 0);
      __publicField(this, "historyMap", /* @__PURE__ */ new Map());
      __publicField(this, "subscribers", /* @__PURE__ */ new Set());
    }
    /**
     * Create a new immutable version
     * VersionManager generates IDs, stores history, and notifies subscribers
     */
    createVersion(module, reason, snapshotData, diff) {
      const id = `v${++this.counter}`;
      const timestamp = Date.now();
      const snapshot = {
        state: Object.freeze({ ...snapshotData })
      };
      const frozenDiff = Object.freeze({ ...diff });
      const version = {
        id,
        timestamp,
        module,
        reason,
        snapshot,
        diff: frozenDiff
      };
      this.historyMap.set(id, Object.freeze(version));
      for (const subscriber of this.subscribers) {
        subscriber(Object.freeze(version));
      }
      return Object.freeze(version);
    }
    /**
     * Subscribe to new versions.
     * Returns a function to unsubscribe.
     */
    subscribe(callback) {
      this.subscribers.add(callback);
      return () => this.subscribers.delete(callback);
    }
    /**
     * Get the latest version.
     */
    latest() {
      const latest = this.historyMap.get(`v${this.counter}`);
      return latest;
    }
    /**
     * Get full history as immutable array.
     */
    history() {
      return Object.freeze(Array.from(this.historyMap.values()));
    }
    /**
     * Get a specific version by ID.
     */
    get(id) {
      return this.historyMap.get(id);
    }
    /**
     * Clear all history and subscribers.
     */
    clear() {
      this.historyMap.clear();
      this.subscribers.clear();
      this.counter = 0;
    }
  };

  // ../src/companion/event-bus.ts
  var EventBus = class {
    constructor() {
      __publicField(this, "subscribers", /* @__PURE__ */ new Map());
    }
    /**
     * Subscribe to an event.
     * Returns a Subscription with an idempotent unsubscribe method.
     */
    subscribe(eventName, handler) {
      if (!this.subscribers.has(eventName)) {
        this.subscribers.set(eventName, /* @__PURE__ */ new Set());
      }
      this.subscribers.get(eventName).add(handler);
      let unsubscribed = false;
      return {
        unsubscribe: () => {
          if (unsubscribed) return;
          unsubscribed = true;
          this.unsubscribe(eventName, handler);
        }
      };
    }
    /**
     * Unsubscribe from an event. Idempotent — safe to call multiple times.
     */
    unsubscribe(eventName, handler) {
      const handlers = this.subscribers.get(eventName);
      if (!handlers) return;
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscribers.delete(eventName);
      }
    }
    /**
     * Publish an event to all subscribers.
     * The event object is frozen before dispatch so every subscriber
     * observes the exact same immutable instance.
     * Returns a promise that resolves when all handlers complete.
     */
    async publish(eventName, data, sourceModule) {
      const handlers = this.subscribers.get(eventName);
      if (!handlers || handlers.size === 0) return;
      const event = Object.freeze({
        name: eventName,
        data,
        timestamp: Date.now(),
        sourceModule
      });
      const promises = [];
      for (const handler of handlers) {
        try {
          const result = handler(event);
          if (result instanceof Promise) {
            promises.push(result);
          }
        } catch (error) {
          console.error(`[EventBus] Handler error for ${eventName}:`, error);
        }
      }
      if (promises.length > 0) {
        const results = await Promise.allSettled(promises);
        for (let i = 0; i < results.length; i++) {
          if (results[i].status === "rejected") {
            console.error(`[EventBus] Async handler error for ${eventName}:`, results[i].reason);
          }
        }
      }
    }
    /**
     * Check if there are subscribers for an event.
     */
    hasSubscribers(eventName) {
      const handlers = this.subscribers.get(eventName);
      return handlers !== void 0 && handlers.size > 0;
    }
    /**
     * Get count of subscribers for an event.
     */
    subscriberCount(eventName) {
      return this.subscribers.get(eventName)?.size ?? 0;
    }
    /**
     * Clear all subscriptions.
     */
    clear() {
      this.subscribers.clear();
    }
  };

  // ../src/companion/diagnostics-service.ts
  var DiagnosticsService = class {
    constructor(versionManager, eventBus) {
      __publicField(this, "versionManager");
      __publicField(this, "eventBus");
      __publicField(this, "providers", []);
      this.versionManager = versionManager;
      this.eventBus = eventBus;
    }
    /**
     * Register a diagnostics provider for extensibility.
     * Providers are called when snapshot() is invoked.
     */
    registerProvider(provider) {
      this.providers.push(provider);
    }
    /**
     * Collect a read-only snapshot of the platform state.
     * All returned data is immutable — no internal references escape.
     */
    snapshot(registeredIds, initializedIds, disposedIds) {
      const initialized = new Set(initializedIds);
      const disposed = new Set(disposedIds);
      const modules = registeredIds.map((id) => ({
        id,
        state: disposed.has(id) ? "disposed" : initialized.has(id) ? "initialized" : "registered"
      }));
      const latest = this.versionManager.latest();
      return Object.freeze({
        modules: Object.freeze(modules),
        versionCount: this.versionManager.history().length,
        latestVersionId: latest?.id
      });
    }
  };

  // ../src/companion/storage-provider.ts
  var MemoryStorageProvider = class {
    constructor() {
      __publicField(this, "store", /* @__PURE__ */ new Map());
    }
    async get(key) {
      return this.store.get(key) ?? null;
    }
    async set(key, value) {
      this.store.set(key, value);
    }
    async remove(key) {
      this.store.delete(key);
    }
    async has(key) {
      return this.store.has(key);
    }
    async clear() {
      this.store.clear();
    }
  };

  // ../src/companion/platform-storage.ts
  var PlatformStorage = class {
    constructor(provider) {
      __publicField(this, "provider");
      this.provider = provider ?? new MemoryStorageProvider();
    }
    async get(key) {
      const raw = await this.provider.get(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    }
    async set(key, value) {
      await this.provider.set(key, JSON.stringify(value));
    }
    async remove(key) {
      await this.provider.remove(key);
    }
    async has(key) {
      return this.provider.has(key);
    }
    async clear() {
      await this.provider.clear();
    }
  };

  // ../src/companion/capability-registry.ts
  var CapabilityRegistry = class {
    constructor() {
      __publicField(this, "moduleCapabilities", /* @__PURE__ */ new Map());
      __publicField(this, "capabilityModules", /* @__PURE__ */ new Map());
    }
    /**
     * Register a module's capabilities. Called by ModuleManager during register().
     *
     * Duplicate module IDs throw deterministically — silent failure is not acceptable.
     * A capability may be claimed by multiple modules.
     *
     * An immutable copy of capabilities is stored internally.
     * Subsequent external mutation cannot affect registry state.
     */
    registerModule(id, capabilities) {
      if (this.moduleCapabilities.has(id)) {
        throw new Error(`CapabilityRegistry: module '${id}' is already registered`);
      }
      this.moduleCapabilities.set(id, Object.freeze({ ...capabilities }));
      for (const [cap, enabled] of Object.entries(capabilities)) {
        if (!enabled) continue;
        const name = cap;
        if (!this.capabilityModules.has(name)) {
          this.capabilityModules.set(name, /* @__PURE__ */ new Set());
        }
        this.capabilityModules.get(name).add(id);
      }
    }
    /**
     * Check if any registered module has the given capability.
     */
    has(capability) {
      const modules = this.capabilityModules.get(capability);
      return modules !== void 0 && modules.size > 0;
    }
    /**
     * Get all module IDs that claim the given capability.
     * Returns an empty readonly array for unknown capabilities — never throws.
     */
    getModulesWith(capability) {
      const modules = this.capabilityModules.get(capability);
      return modules ? Object.freeze(Array.from(modules)) : Object.freeze([]);
    }
    /**
     * Get the capabilities declared by a specific module.
     * Returns undefined if the module is not registered.
     */
    getCapabilities(moduleId) {
      const caps = this.moduleCapabilities.get(moduleId);
      return caps ? Object.freeze({ ...caps }) : void 0;
    }
    /**
     * Get all capability names that have at least one claiming module.
     */
    getAllCapabilities() {
      return Object.freeze(Array.from(this.capabilityModules.keys()));
    }
    /**
     * Get all module IDs that have at least one capability registered.
     */
    getAllModules() {
      return Object.freeze(Array.from(this.moduleCapabilities.keys()));
    }
  };

  // ../src/companion/service-registry.ts
  var ServiceRegistry = class {
    constructor() {
      __publicField(this, "services", /* @__PURE__ */ new Map());
      __publicField(this, "moduleServices", /* @__PURE__ */ new Map());
    }
    /**
     * Register a module's exported services. Called by ModuleManager during register().
     *
     * Duplicate module IDs and duplicate service names throw deterministically.
     * Platform must never silently replace services.
     */
    registerModule(id, services) {
      if (this.moduleServices.has(id)) {
        throw new Error(`ServiceRegistry: module '${id}' is already registered`);
      }
      const keys = /* @__PURE__ */ new Set();
      for (const [name, implementation] of Object.entries(services)) {
        if (this.services.has(name)) {
          const owner = this.services.get(name).moduleId;
          throw new Error(
            `ServiceRegistry: service '${name}' is already registered by module '${owner}'`
          );
        }
        const stored = implementation !== null && typeof implementation === "object" ? Object.freeze(implementation) : implementation;
        this.services.set(name, { moduleId: id, implementation: stored });
        keys.add(name);
      }
      if (keys.size > 0) {
        this.moduleServices.set(id, keys);
      }
    }
    /**
     * Check if a service is registered.
     */
    has(service) {
      return this.services.has(service);
    }
    /**
     * Get the implementation of a service.
     * Returns undefined if the service is not registered.
     */
    get(service) {
      return this.services.get(service)?.implementation;
    }
    /**
     * Get the module ID that owns a service.
     * Returns undefined if the service is not registered.
     */
    getOwner(service) {
      return this.services.get(service)?.moduleId;
    }
    /**
     * Get all service keys exported by a specific module.
     * Returns undefined if the module has no registered services.
     */
    getServices(moduleId) {
      const keys = this.moduleServices.get(moduleId);
      return keys ? Object.freeze(Array.from(keys)) : void 0;
    }
    /**
     * Get all registered service keys.
     */
    getAllServices() {
      return Object.freeze(Array.from(this.services.keys()));
    }
    /**
     * Get the count of registered services.
     */
    get serviceCount() {
      return this.services.size;
    }
  };

  // ../src/companion/dependency-registry.ts
  var DependencyRegistry = class {
    constructor() {
      __publicField(this, "dependencies", /* @__PURE__ */ new Map());
      __publicField(this, "registeredModules", /* @__PURE__ */ new Set());
      __publicField(this, "registeredServices", /* @__PURE__ */ new Set());
      __publicField(this, "registeredCapabilities", /* @__PURE__ */ new Set());
    }
    /**
     * Mark a module as registered (for dependency validation against other modules).
     * Called by ModuleManager during register().
     */
    markModuleRegistered(id) {
      this.registeredModules.add(id);
    }
    /**
     * Mark a service as registered (for dependency validation against services).
     * Called by ModuleManager during register().
     */
    markServiceRegistered(name) {
      this.registeredServices.add(name);
    }
    /**
     * Mark a capability as registered (for dependency validation against capabilities).
     * Called by ModuleManager during register().
     */
    markCapabilityRegistered(name) {
      this.registeredCapabilities.add(name);
    }
    /**
     * Register a module's declared dependencies.
     * Duplicate module IDs throw deterministically.
     */
    registerModule(id, deps) {
      if (this.dependencies.has(id)) {
        throw new Error(`DependencyRegistry: module '${id}' is already registered`);
      }
      this.dependencies.set(id, Object.freeze({
        services: deps.services ? Object.freeze([...deps.services]) : void 0,
        capabilities: deps.capabilities ? Object.freeze([...deps.capabilities]) : void 0,
        modules: deps.modules ? Object.freeze([...deps.modules]) : void 0
      }));
    }
    /**
     * Get the declared dependencies of a module.
     * Returns undefined if the module has no registered dependencies.
     */
    getDependencies(moduleId) {
      return this.dependencies.get(moduleId);
    }
    /**
     * Get all module IDs that declare a dependency on the given module.
     */
    getDependents(moduleId) {
      const result = [];
      for (const [id, deps] of this.dependencies) {
        if (deps.modules?.includes(moduleId)) {
          result.push(id);
        }
      }
      return Object.freeze(result);
    }
    /**
     * Validate a specific module's dependencies.
     * Checks that all declared module, service, and capability dependencies are registered.
     */
    validateModule(moduleId) {
      const deps = this.dependencies.get(moduleId);
      if (!deps) {
        return Object.freeze({
          moduleId,
          valid: true,
          missingModules: Object.freeze([]),
          missingServices: Object.freeze([]),
          missingCapabilities: Object.freeze([])
        });
      }
      const missingModules = (deps.modules ?? []).filter(
        (id) => !this.registeredModules.has(id)
      );
      const missingServices = (deps.services ?? []).filter(
        (s) => !this.registeredServices.has(s)
      );
      const missingCapabilities = (deps.capabilities ?? []).filter(
        (c) => !this.registeredCapabilities.has(c)
      );
      return Object.freeze({
        moduleId,
        valid: missingModules.length === 0 && missingServices.length === 0 && missingCapabilities.length === 0,
        missingModules: Object.freeze(missingModules),
        missingServices: Object.freeze(missingServices),
        missingCapabilities: Object.freeze(missingCapabilities)
      });
    }
    /**
     * Validate all registered modules' dependencies.
     */
    validateAll() {
      const results = [];
      for (const id of this.dependencies.keys()) {
        results.push(this.validateModule(id));
      }
      return Object.freeze(results);
    }
    /**
     * Get all module IDs that have declared dependencies.
     */
    getAllModules() {
      return Object.freeze(Array.from(this.dependencies.keys()));
    }
    /**
     * Get the count of modules with declared dependencies.
     */
    get moduleCount() {
      return this.dependencies.size;
    }
  };

  // ../src/companion/launcher-api.ts
  var LauncherRegistry = class {
    constructor() {
      __publicField(this, "entries", /* @__PURE__ */ new Map());
    }
    /**
     * Register a launcher entry. Called by ModuleManager during register().
     * Duplicate module IDs throw deterministically.
     */
    register(id, label, moduleId, order = 0) {
      if (this.entries.has(id)) {
        throw new Error(`LauncherRegistry: entry '${id}' is already registered`);
      }
      this.entries.set(id, Object.freeze({ id, label, moduleId, order }));
    }
    /**
     * Unregister a launcher entry.
     */
    unregister(id) {
      this.entries.delete(id);
    }
    /**
     * Get a launcher entry by id.
     */
    get(id) {
      return this.entries.get(id);
    }
    /**
     * Get all launcher entries, sorted by order.
     */
    getAll() {
      return Object.freeze(
        Array.from(this.entries.values()).sort((a, b) => a.order - b.order)
      );
    }
    /**
     * Get the count of registered launchers.
     */
    get count() {
      return this.entries.size;
    }
  };

  // ../src/companion/module-manager.ts
  var ModuleManager = class {
    /**
     * Create ModuleManager with owned platform services.
     * ModuleManager owns all platform infrastructure.
     */
    constructor() {
      __publicField(this, "modules", /* @__PURE__ */ new Map());
      __publicField(this, "versionManager");
      __publicField(this, "eventBus");
      __publicField(this, "diagnostics");
      __publicField(this, "storage");
      __publicField(this, "capabilities");
      __publicField(this, "services");
      __publicField(this, "dependencies");
      __publicField(this, "launchers");
      __publicField(this, "initializedModules", /* @__PURE__ */ new Set());
      __publicField(this, "disposedModules", /* @__PURE__ */ new Set());
      __publicField(this, "initializationOrder", []);
      __publicField(this, "initializationFailures", /* @__PURE__ */ new Map());
      this.versionManager = new VersionManager();
      this.eventBus = new EventBus();
      this.diagnostics = new DiagnosticsService(this.versionManager, this.eventBus);
      this.storage = new PlatformStorage();
      this.capabilities = new CapabilityRegistry();
      this.services = new ServiceRegistry();
      this.dependencies = new DependencyRegistry();
      this.launchers = new LauncherRegistry();
      this.diagnostics.registerProvider({
        name: "capabilities",
        collect: () => ({
          all: this.capabilities.getAllCapabilities(),
          modules: Object.fromEntries(
            this.capabilities.getAllModules().map((id) => [
              id,
              this.capabilities.getCapabilities(id)
            ])
          )
        })
      });
      this.diagnostics.registerProvider({
        name: "services",
        collect: () => ({
          count: this.services.serviceCount,
          all: this.services.getAllServices(),
          owners: Object.fromEntries(
            this.services.getAllServices().map((key) => [key, this.services.getOwner(key)])
          )
        })
      });
      this.diagnostics.registerProvider({
        name: "dependencies",
        collect: () => ({
          count: this.dependencies.moduleCount,
          modules: this.dependencies.getAllModules(),
          validation: Object.fromEntries(
            this.dependencies.validateAll().map((r) => [r.moduleId, r])
          )
        })
      });
      this.diagnostics.registerProvider({
        name: "launchers",
        collect: () => ({
          count: this.launchers.count,
          entries: this.launchers.getAll().map((e) => ({ id: e.id, label: e.label, moduleId: e.moduleId }))
        })
      });
    }
    /**
     * Register a module. Passive registration - no side effects.
     * Rules:
     *   - no initialization
     *   - no dependency resolution
     *   - no async work
     *   - no service injection
     *
     * Capability and service registration is automatic — read from module metadata.
     */
    register(module) {
      if (this.modules.has(module.id)) return;
      this.modules.set(module.id, module);
      this.capabilities.registerModule(module.id, module.capabilities);
      this.dependencies.markModuleRegistered(module.id);
      for (const [cap, enabled] of Object.entries(module.capabilities)) {
        if (enabled) {
          this.dependencies.markCapabilityRegistered(cap);
        }
      }
      if (module.services) {
        this.services.registerModule(module.id, module.services);
        for (const name of Object.keys(module.services)) {
          this.dependencies.markServiceRegistered(name);
        }
      }
      if (module.dependencies) {
        this.dependencies.registerModule(module.id, module.dependencies);
      }
    }
    /**
     * Get a module by id.
     */
    get(id) {
      return this.modules.get(id);
    }
    /**
     * Get all registered modules.
     */
    getAll() {
      return Array.from(this.modules.values());
    }
    /**
     * Get registered module ids.
     */
    getRegisteredIds() {
      return Array.from(this.modules.keys());
    }
    /**
     * Inject platform services into all registered modules.
     * Must be called after registration and before initializeAll().
     * Modules receive services through dependency injection.
     */
    injectPlatformServices() {
      const services = {
        versionManager: this.versionManager,
        eventBus: this.eventBus,
        diagnostics: this.diagnostics,
        storage: this.storage,
        capabilities: this.capabilities,
        services: this.services,
        dependencies: this.dependencies,
        launchers: this.launchers
      };
      for (const module of this.modules.values()) {
        module.injectPlatformServices(services);
      }
    }
    /**
     * Initialize all registered modules in deterministic order.
     * Platform lifecycle: register -> injectPlatformServices -> initializeAll
     * Initialization order is deterministic and reproducible.
     */
    async initializeAll() {
      this.initializedModules.clear();
      this.initializationOrder = [];
      this.initializationFailures.clear();
      for (const [id, module] of this.modules.entries()) {
        if (this.initializedModules.has(id)) {
          throw new Error(`Module ${id} already initialized`);
        }
        if (this.disposedModules.has(id)) {
          throw new Error(`Module ${id} has been disposed and cannot be reinitialized`);
        }
        try {
          await module.initialize();
          this.initializedModules.add(id);
          this.initializationOrder.push(id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.initializationFailures.set(id, message);
          throw error;
        }
      }
    }
    /**
     * Dispose all modules in reverse initialization order.
     * Platform lifecycle runs in reverse: disposeAll -> ...
     * Disposal order must be exactly the reverse of initialization.
     */
    async disposeAll() {
      for (let i = this.initializationOrder.length - 1; i >= 0; i--) {
        const id = this.initializationOrder[i];
        const module = this.modules.get(id);
        if (!module) continue;
        if (this.disposedModules.has(id)) {
          throw new Error(`Module ${id} already disposed`);
        }
        if (!this.initializedModules.has(id)) {
          throw new Error(`Module ${id} not initialized`);
        }
        await module.dispose();
        this.disposedModules.add(id);
        this.initializedModules.delete(id);
      }
      this.initializationOrder = [];
    }
    /**
     * Collect platform diagnostics snapshot.
     */
    collectDiagnostics() {
      return this.diagnostics.snapshot(
        this.getRegisteredIds(),
        Array.from(this.initializedModules),
        Array.from(this.disposedModules)
      );
    }
    /**
     * Get the initialization order of modules.
     */
    getInitializationOrder() {
      return Object.freeze([...this.initializationOrder]);
    }
    /**
     * Get module initialization failures (module id -> error message).
     */
    getInitializationFailures() {
      return new Map(this.initializationFailures);
    }
    /**
     * Check if a module is initialized.
     */
    isInitialized(id) {
      return this.initializedModules.has(id);
    }
    /**
     * Check if a module is disposed.
     */
    isDisposed(id) {
      return this.disposedModules.has(id);
    }
    /**
     * Get the VersionManager owned by ModuleManager.
     */
    getVersionManager() {
      return this.versionManager;
    }
    /**
     * Get the EventBus owned by ModuleManager.
     */
    getEventBus() {
      return this.eventBus;
    }
    /**
     * Get the DiagnosticsService owned by ModuleManager.
     */
    getDiagnostics() {
      return this.diagnostics;
    }
    /**
     * Get the PlatformStorage owned by ModuleManager.
     */
    getStorage() {
      return this.storage;
    }
    /**
     * Get the CapabilityRegistry owned by ModuleManager.
     */
    getCapabilityRegistry() {
      return this.capabilities;
    }
    /**
     * Get the ServiceRegistry owned by ModuleManager.
     */
    getServiceRegistry() {
      return this.services;
    }
    /**
     * Get the DependencyRegistry owned by ModuleManager.
     */
    getDependencyRegistry() {
      return this.dependencies;
    }
    /**
     * Get the LauncherRegistry owned by ModuleManager.
     */
    getLauncherRegistry() {
      return this.launchers;
    }
    /**
     * Validate all registered modules' dependencies.
     * Throws if any module has unmet dependencies.
     */
    validateDependencies() {
      return this.dependencies.validateAll();
    }
    /**
     * Get platform services for platform-level operations.
     */
    getPlatformServices() {
      return {
        versionManager: this.versionManager,
        eventBus: this.eventBus,
        diagnostics: this.diagnostics,
        storage: this.storage,
        capabilities: this.capabilities,
        services: this.services,
        dependencies: this.dependencies,
        launchers: this.launchers
      };
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
    Operation2["EmailSendSatellite"] = "EmailSendSatellite";
    Operation2["VideoChatSatellite"] = "VideoChatSatellite";
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
  var STORAGE_KEY = STORAGE_KEYS.FINANCE_WIDGET_STATE;
  function loadShift() {
    try {
      const raw = StorageService.get(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && isShiftType(parsed.shift)) {
        return parsed.shift;
      }
    } catch {
    }
    return null;
  }
  function saveShift(shift) {
    try {
      const raw = StorageService.get(STORAGE_KEY);
      let next = {};
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            next = { ...parsed };
          }
        } catch {
        }
      }
      next.shift = shift;
      StorageService.set(STORAGE_KEY, JSON.stringify(next));
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
  function txIdentity(tx) {
    return `${tx.date.getTime()}_${tx.ladyID}_${tx.userID}_${tx.operation}_${tx.sum}`;
  }
  var FinanceController = class {
    constructor(config = {}) {
      __publicField(this, "state");
      __publicField(this, "listeners", /* @__PURE__ */ new Set());
      __publicField(this, "client");
      __publicField(this, "timeoutMs");
      __publicField(this, "abortController", null);
      __publicField(this, "unviewedTxIds", /* @__PURE__ */ new Set());
      __publicField(this, "allSeenTxIds", /* @__PURE__ */ new Set());
      __publicField(this, "requestSeq", 0);
      const shift = config.shift ?? FinanceShift.getSavedOrDetect();
      const range = FinanceShift.computeDateRange(shift);
      this.state = {
        status: "idle",
        data: null,
        error: null,
        from: range.from,
        to: range.to,
        shift,
        unviewedTransactions: 0
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
      const seq = ++this.requestSeq;
      try {
        const raw = await this.client.fetchTransactions(
          this.state.from,
          this.state.to,
          {
            signal: controller.signal,
            timeoutMs: this.timeoutMs
          }
        );
        if (seq !== this.requestSeq) {
          return;
        }
        if (controller.signal.aborted) {
          this.exitLoadingOnCancellation();
          return;
        }
        const mapped = FinanceMapper.mapResponse(raw);
        if (seq !== this.requestSeq) {
          return;
        }
        const currentIds = new Set((mapped.list ?? []).map((tx) => txIdentity(tx)));
        for (const id of this.unviewedTxIds) {
          if (!currentIds.has(id)) {
            this.unviewedTxIds.delete(id);
          }
        }
        for (const id of currentIds) {
          if (!this.allSeenTxIds.has(id)) {
            this.unviewedTxIds.add(id);
          }
          this.allSeenTxIds.add(id);
        }
        this.setState({ status: "loaded", data: mapped, error: null, unviewedTransactions: this.unviewedTxIds.size });
      } catch (error) {
        if (seq !== this.requestSeq) {
          return;
        }
        if (controller.signal.aborted) {
          this.exitLoadingOnCancellation();
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
    /** Mark a specific transaction as viewed by its identity key. */
    markTxViewed(txId) {
      if (this.unviewedTxIds.delete(txId)) {
        this.setState({ unviewedTransactions: this.unviewedTxIds.size });
      }
    }
    /** Check if a transaction is unviewed by its identity key. */
    isTxUnviewed(txId) {
      return this.unviewedTxIds.has(txId);
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
    /**
     * Exit the loading state after the active request was cancelled with no
     * successor. Preserves existing data, clears the current error, and
     * publishes exactly one terminal state. Guarded on status so it never
     * overwrites a terminal state already produced by setShift() or
     * setDateRange(). Callers must only invoke this for the current request
     * (seq === this.requestSeq).
     */
    exitLoadingOnCancellation() {
      if (this.state.status === "loading") {
        this.setState({ status: "idle", error: null });
      }
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
  var COLLAPSED_HEIGHT = 44;
  function loadState(storageKey) {
    try {
      const raw = StorageService.get(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && typeof parsed.x === "number" && typeof parsed.y === "number" && typeof parsed.width === "number" && parsed.width > 0 && typeof parsed.height === "number" && parsed.height > 0 && typeof parsed.collapsed === "boolean" && typeof parsed.hidden === "boolean") {
        if (typeof parsed.chatCollapsed !== "boolean") {
          parsed.chatCollapsed = parsed.collapsed;
        }
        return parsed;
      }
    } catch {
    }
    return null;
  }
  function saveState(storageKey, state) {
    try {
      StorageService.set(storageKey, JSON.stringify(state));
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
      // Window resize handler
      __publicField(this, "boundOnWindowResize", null);
      // Drag state
      __publicField(this, "isDragging", false);
      __publicField(this, "dragStartX", 0);
      __publicField(this, "dragStartY", 0);
      __publicField(this, "dragOrigX", 0);
      __publicField(this, "dragOrigY", 0);
      __publicField(this, "boundOnDragPointerMove", null);
      __publicField(this, "boundOnDragPointerUp", null);
      __publicField(this, "boundOnDragBlur", null);
      // Resize state
      __publicField(this, "isResizing", false);
      __publicField(this, "resizeStartX", 0);
      __publicField(this, "resizeStartY", 0);
      __publicField(this, "resizeOrigW", 0);
      __publicField(this, "resizeOrigH", 0);
      __publicField(this, "boundOnResizePointerMove", null);
      __publicField(this, "boundOnResizePointerUp", null);
      __publicField(this, "boundOnResizeBlur", null);
      __publicField(this, "onWindowResize", () => {
        if (this.destroyed || !this.root) return;
        this.recoverPosition();
      });
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
          header.setPointerCapture(e.pointerId);
        }
        this.boundOnDragPointerMove = this.onDragPointerMove;
        this.boundOnDragPointerUp = this.onDragPointerUp;
        this.boundOnDragBlur = this.onDragBlur;
        document.addEventListener("pointermove", this.boundOnDragPointerMove);
        document.addEventListener("pointerup", this.boundOnDragPointerUp);
        document.addEventListener("pointercancel", this.boundOnDragPointerUp);
        window.addEventListener("blur", this.boundOnDragBlur);
      });
      __publicField(this, "onDragPointerMove", (e) => {
        if (!this.isDragging || !this.root) return;
        e.preventDefault();
        const newX = this.dragOrigX + (e.clientX - this.dragStartX);
        const newY = this.dragOrigY + (e.clientY - this.dragStartY);
        const rect = this.root.getBoundingClientRect();
        const headerHeight = 44;
        const maxX = window.innerWidth - headerHeight;
        const maxY = window.innerHeight - headerHeight;
        const clampedX = Math.max(0, Math.min(newX, maxX));
        const clampedY = Math.max(0, Math.min(newY, maxY));
        this.root.style.left = clampedX + "px";
        this.root.style.top = clampedY + "px";
        this.root.style.bottom = "auto";
        this.root.style.right = "auto";
      });
      __publicField(this, "onDragPointerUp", (e) => {
        this.isDragging = false;
        if (this.root) {
          const header = this.root.querySelector(`.${this.classPrefix}-header`);
          if (header) {
            header.style.cursor = "grab";
            if (header.hasPointerCapture(e.pointerId)) {
              header.releasePointerCapture(e.pointerId);
            }
          }
        }
        if (this.root) {
          const rect = this.root.getBoundingClientRect();
          this.win = { ...this.win, x: Math.round(rect.left), y: Math.round(rect.top) };
        }
        this.persistState();
        this.removeDragListeners();
      });
      __publicField(this, "onDragBlur", () => {
        this.cancelDrag();
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
        const handle = e.currentTarget;
        if (handle) {
          handle.setPointerCapture(e.pointerId);
        }
        this.boundOnResizePointerMove = this.onResizePointerMove;
        this.boundOnResizePointerUp = this.onResizePointerUp;
        this.boundOnResizeBlur = this.onResizeBlur;
        document.addEventListener("pointermove", this.boundOnResizePointerMove);
        document.addEventListener("pointerup", this.boundOnResizePointerUp);
        document.addEventListener("pointercancel", this.boundOnResizePointerUp);
        window.addEventListener("blur", this.boundOnResizeBlur);
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
      __publicField(this, "onResizePointerUp", (e) => {
        this.isResizing = false;
        if (this.root) {
          const resizeHandle = this.root.querySelector(`.${this.classPrefix}-resize`);
          if (resizeHandle && resizeHandle.hasPointerCapture(e.pointerId)) {
            resizeHandle.releasePointerCapture(e.pointerId);
          }
        }
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
      __publicField(this, "onResizeBlur", () => {
        this.cancelResize();
      });
      this.container = config.container ?? document.body;
      this.classPrefix = config.classPrefix ?? DEFAULT_CLASS_PREFIX;
      this.storageKey = config.storageKey;
      this.defaultState = config.defaultState;
      this.onClose = config.onClose;
      const saved = loadState(this.storageKey) ?? this.defaultState;
      this.win = { ...saved };
      this.recoverPosition();
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
      resizeHandle.addEventListener("pointerdown", this.onResizePointerDown);
      this.collapseBtn?.addEventListener("click", this.onCollapseClick);
      this.closeBtn?.addEventListener("click", this.onCloseClick);
      this.boundOnWindowResize = this.onWindowResize;
      window.addEventListener("resize", this.boundOnWindowResize);
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
      this.removeWindowResizeListener();
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
      if (isDevMode()) diag("[CompanionWindow] show() start, destroyed:", this.destroyed, "root:", !!this.root);
      if (this.destroyed || !this.root) return;
      this.win = { ...this.win, hidden: false };
      this.root.style.display = "";
      this.recoverPosition();
      this.installKeyboardListener();
      this.persistState();
      if (isDevMode()) diag("[CompanionWindow] show() end");
    }
    /** Hide the widget (close). */
    hide() {
      if (isDevMode()) diag("[CompanionWindow] hide() start, destroyed:", this.destroyed, "root:", !!this.root);
      if (this.destroyed || !this.root) return;
      this.cancelDrag();
      this.cancelResize();
      this.win = { ...this.win, hidden: true };
      this.root.style.display = "none";
      this.removeKeyboardListener();
      this.persistState();
      if (isDevMode()) diag("[CompanionWindow] hide() end");
    }
    /** Check if widget is visible. */
    get isVisible() {
      return !this.win.hidden;
    }
    /** Check if widget is collapsed. */
    get isCollapsed() {
      return this.win.collapsed;
    }
    /**
     * Apply the saved chat-route collapse preference to the live presentation.
     * Route-forced (non-chat) presentation changes call collapse()/expand()
     * directly and therefore never update the saved preference.
     */
    applyChatPreference() {
      if (this.destroyed || !this.root || !this.contentEl) return;
      if (this.win.chatCollapsed) {
        this.collapse();
      } else {
        this.expand();
      }
    }
    // -------------------------------------------------------------------------
    // Collapse / Expand — two independent layouts
    // -------------------------------------------------------------------------
    /** Expand the widget. Restores exact previous dimensions from state. */
    expand() {
      if (isDevMode()) diag("[CompanionWindow] expand() start, collapsed:", this.win.collapsed, "root:", !!this.root, "contentEl:", !!this.contentEl);
      if (!this.win.collapsed || !this.root || !this.contentEl) {
        if (isDevMode()) diag("[CompanionWindow] expand() - EARLY RETURN, collapsed:", this.win.collapsed, "root:", !!this.root, "contentEl:", !!this.contentEl);
        return;
      }
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
      this.recoverPosition();
      this.persistState();
      if (isDevMode()) diag("[CompanionWindow] expand() end");
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
      this.root.style.width = this.win.width + "px";
      this.root.style.height = COLLAPSED_HEIGHT + "px";
      this.root.style.minHeight = COLLAPSED_HEIGHT + "px";
      this.root.style.minWidth = this.win.width + "px";
      this.root.style.overflow = "hidden";
      this.root.classList.add(`${this.classPrefix}-collapsed`);
      this.updateCollapseButton();
      this.recoverPosition();
      this.persistState();
    }
    /** Toggle collapse state. */
    toggleCollapse() {
      if (this.win.collapsed) {
        this.expand();
      } else {
        this.collapse();
      }
      this.win = { ...this.win, chatCollapsed: this.win.collapsed };
      this.persistState();
    }
    // -------------------------------------------------------------------------
    // Position normalization — keep the header and its controls reachable
    // -------------------------------------------------------------------------
    /**
     * Clamp the window position to the current viewport so the header and its
     * controls stay reachable. The full widget fits in the viewport where
     * possible; when the widget is larger than the viewport, the header is
     * kept visible. Returns true when the position was corrected.
     */
    normalizePosition() {
      const viewportWidth = window.innerWidth || 0;
      const viewportHeight = window.innerHeight || 0;
      const width = this.win.width;
      const height = this.win.collapsed ? COLLAPSED_HEIGHT : this.win.height;
      const maxX = Math.max(0, viewportWidth - width);
      const maxY = Math.max(0, viewportHeight - height);
      const x = Math.max(0, Math.min(this.win.x, maxX));
      const y = Math.max(0, Math.min(this.win.y, maxY));
      if (x === this.win.x && y === this.win.y) return false;
      this.win = { ...this.win, x, y };
      return true;
    }
    /** Apply the persisted position to the root element. */
    applyPosition() {
      if (!this.root) return;
      this.root.style.left = this.win.x + "px";
      this.root.style.top = this.win.y + "px";
      this.root.style.bottom = "auto";
      this.root.style.right = "auto";
    }
    /**
     * Normalize the position against the current viewport and persist the
     * corrected state when a change was required.
     */
    recoverPosition() {
      if (!this.normalizePosition()) return;
      this.applyPosition();
      this.persistState();
    }
    removeWindowResizeListener() {
      if (this.boundOnWindowResize) {
        window.removeEventListener("resize", this.boundOnWindowResize);
        this.boundOnWindowResize = null;
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
      }
      if (this.boundOnDragBlur) {
        window.removeEventListener("blur", this.boundOnDragBlur);
      }
      this.boundOnDragPointerMove = null;
      this.boundOnDragPointerUp = null;
      this.boundOnDragBlur = null;
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
      }
      if (this.boundOnResizeBlur) {
        window.removeEventListener("blur", this.boundOnResizeBlur);
      }
      this.boundOnResizePointerMove = null;
      this.boundOnResizePointerUp = null;
      this.boundOnResizeBlur = null;
    }
  };

  // ../src/companion/brand-logo.ts
  var PATH_OUTER = "M 250.0 462.5 L 249.0 462.5 L 248.0 462.5 L 247.0 462.5 L 246.0 462.5 L 245.0 462.5 L 244.0 462.5 L 243.0 462.5 L 242.0 462.5 L 241.0 462.5 L 240.0 462.5 L 239.0 462.5 L 238.0 462.5 L 237.0 462.5 L 236.0 462.5 L 235.0 462.5 L 234.5 462.0 L 234.0 461.5 L 233.0 461.5 L 232.0 461.5 L 231.0 461.5 L 230.0 461.5 L 229.0 461.5 L 228.0 461.5 L 227.0 461.5 L 226.0 461.5 L 225.0 461.5 L 224.0 461.5 L 223.0 461.5 L 222.0 461.5 L 221.0 461.5 L 220.0 461.5 L 219.0 461.5 L 218.5 461.0 L 218.0 460.5 L 217.0 460.5 L 216.0 460.5 L 215.0 460.5 L 214.0 460.5 L 213.0 460.5 L 212.5 460.0 L 212.0 459.5 L 211.0 459.5 L 210.0 459.5 L 209.0 459.5 L 208.0 459.5 L 207.0 459.5 L 206.5 459.0 L 206.0 458.5 L 205.0 458.5 L 204.0 458.5 L 203.0 458.5 L 202.0 458.5 L 201.0 458.5 L 200.5 458.0 L 200.0 457.5 L 199.0 457.5 L 198.0 457.5 L 197.0 457.5 L 196.5 457.0 L 196.0 456.5 L 195.0 456.5 L 194.0 456.5 L 193.0 456.5 L 192.0 456.5 L 191.5 456.0 L 191.0 455.5 L 190.0 455.5 L 189.0 455.5 L 188.0 455.5 L 187.5 455.0 L 187.0 454.5 L 186.0 454.5 L 185.0 454.5 L 184.5 454.0 L 184.0 453.5 L 183.0 453.5 L 182.0 453.5 L 181.0 453.5 L 180.5 453.0 L 180.0 452.5 L 179.0 452.5 L 178.0 452.5 L 177.5 452.0 L 177.0 451.5 L 176.0 451.5 L 175.0 451.5 L 174.5 451.0 L 174.0 450.5 L 173.0 450.5 L 172.0 450.5 L 171.5 450.0 L 171.0 449.5 L 170.0 449.5 L 169.5 449.0 L 169.0 448.5 L 168.0 448.5 L 167.0 448.5 L 166.0 448.5 L 165.5 448.0 L 165.0 447.5 L 164.0 447.5 L 163.5 447.0 L 163.0 446.5 L 162.0 446.5 L 161.5 446.0 L 161.0 445.5 L 160.0 445.5 L 159.0 445.5 L 158.5 445.0 L 158.0 444.5 L 157.0 444.5 L 156.5 444.0 L 156.0 443.5 L 155.0 443.5 L 154.5 443.0 L 154.0 442.5 L 153.0 442.5 L 152.5 442.0 L 152.0 441.5 L 151.0 441.5 L 150.5 441.0 L 150.0 440.5 L 149.0 440.5 L 148.5 440.0 L 148.0 439.5 L 147.0 439.5 L 146.5 439.0 L 146.0 438.5 L 145.0 438.5 L 144.5 438.0 L 144.0 437.5 L 143.0 437.5 L 142.5 437.0 L 142.0 436.5 L 141.0 436.5 L 140.5 436.0 L 140.0 435.5 L 139.5 435.0 L 139.0 434.5 L 138.0 434.5 L 137.5 434.0 L 137.0 433.5 L 136.0 433.5 L 135.5 433.0 L 135.0 432.5 L 134.5 432.0 L 134.0 431.5 L 133.0 431.5 L 132.5 431.0 L 132.0 430.5 L 131.5 430.0 L 131.0 429.5 L 130.0 429.5 L 129.5 429.0 L 129.0 428.5 L 128.0 428.5 L 127.5 428.0 L 127.0 427.5 L 126.5 427.0 L 126.0 426.5 L 125.0 426.5 L 124.5 426.0 L 124.0 425.5 L 123.5 425.0 L 123.0 424.5 L 122.5 424.0 L 122.0 423.5 L 121.0 423.5 L 120.5 423.0 L 120.0 422.5 L 119.5 422.0 L 119.0 421.5 L 118.0 421.5 L 117.5 421.0 L 117.0 420.5 L 116.5 420.0 L 116.0 419.5 L 115.5 419.0 L 115.0 418.5 L 114.5 418.0 L 114.0 417.5 L 113.0 417.5 L 112.5 417.0 L 112.0 416.5 L 111.5 416.0 L 111.0 415.5 L 110.5 415.0 L 110.0 414.5 L 109.5 414.0 L 109.0 413.5 L 108.0 413.5 L 107.5 413.0 L 107.0 412.5 L 106.5 412.0 L 106.0 411.5 L 105.5 411.0 L 105.0 410.5 L 104.5 410.0 L 104.0 409.5 L 103.5 409.0 L 103.0 408.5 L 102.5 408.0 L 102.0 407.5 L 101.5 407.0 L 101.0 406.5 L 100.5 406.0 L 100.0 405.5 L 99.5 405.0 L 99.0 404.5 L 98.5 404.0 L 98.0 403.5 L 97.5 403.0 L 97.0 402.5 L 96.5 402.0 L 96.0 401.5 L 95.5 401.0 L 95.0 400.5 L 94.5 400.0 L 94.0 399.5 L 93.5 399.0 L 93.0 398.5 L 92.5 398.0 L 92.0 397.5 L 91.5 397.0 L 91.0 396.5 L 90.5 396.0 L 90.0 395.5 L 89.5 395.0 L 89.5 394.0 L 89.0 393.5 L 88.5 393.0 L 88.0 392.5 L 87.5 392.0 L 87.0 391.5 L 86.5 391.0 L 86.0 390.5 L 85.5 390.0 L 85.0 389.5 L 84.5 389.0 L 84.0 388.5 L 83.5 388.0 L 83.5 387.0 L 83.0 386.5 L 82.5 386.0 L 82.0 385.5 L 81.5 385.0 L 81.5 384.0 L 81.0 383.5 L 80.0 383.5 L 79.5 383.0 L 79.5 382.0 L 79.0 381.5 L 78.5 381.0 L 78.0 380.5 L 77.5 380.0 L 77.5 379.0 L 77.0 378.5 L 76.5 378.0 L 76.0 377.5 L 75.5 377.0 L 75.0 376.5 L 74.5 376.0 L 74.5 375.0 L 74.0 374.5 L 73.5 374.0 L 73.0 373.5 L 72.5 373.0 L 72.5 372.0 L 72.0 371.5 L 71.5 371.0 L 71.0 370.5 L 70.5 370.0 L 70.5 369.0 L 70.0 368.5 L 69.5 368.0 L 69.0 367.5 L 68.5 367.0 L 68.0 366.5 L 67.5 366.0 L 67.5 365.0 L 67.0 364.5 L 66.5 364.0 L 66.5 363.0 L 66.0 362.5 L 65.5 362.0 L 65.0 361.5 L 64.5 361.0 L 64.5 360.0 L 64.0 359.5 L 63.5 359.0 L 63.5 358.0 L 63.0 357.5 L 62.5 357.0 L 62.0 356.5 L 61.5 356.0 L 61.5 355.0 L 61.5 354.0 L 61.0 353.5 L 60.5 353.0 L 60.0 352.5 L 59.5 352.0 L 59.5 351.0 L 59.0 350.5 L 58.5 350.0 L 58.5 349.0 L 58.0 348.5 L 57.5 348.0 L 57.5 347.0 L 57.0 346.5 L 56.5 346.0 L 56.5 345.0 L 56.0 344.5 L 55.5 344.0 L 55.5 343.0 L 55.0 342.5 L 54.5 342.0 L 54.5 341.0 L 54.0 340.5 L 53.5 340.0 L 53.5 339.0 L 53.5 338.0 L 53.0 337.5 L 52.5 337.0 L 52.5 336.0 L 52.0 335.5 L 51.5 335.0 L 51.5 334.0 L 51.5 333.0 L 51.0 332.5 L 50.5 332.0 L 50.5 331.0 L 50.0 330.5 L 49.5 330.0 L 49.5 329.0 L 49.5 328.0 L 49.0 327.5 L 48.5 327.0 L 48.5 326.0 L 48.5 325.0 L 48.0 324.5 L 47.5 324.0 L 47.5 323.0 L 47.5 322.0 L 47.0 321.5 L 46.5 321.0 L 46.5 320.0 L 46.5 319.0 L 46.0 318.5 L 45.5 318.0 L 45.5 317.0 L 45.5 316.0 L 45.0 315.5 L 44.5 315.0 L 44.5 314.0 L 44.5 313.0 L 44.5 312.0 L 44.0 311.5 L 43.5 311.0 L 43.5 310.0 L 43.5 309.0 L 43.0 308.5 L 42.5 308.0 L 42.5 307.0 L 42.5 306.0 L 42.5 305.0 L 42.0 304.5 L 41.5 304.0 L 41.5 303.0 L 41.5 302.0 L 41.5 301.0 L 41.5 300.0 L 41.0 299.5 L 40.5 299.0 L 40.5 298.0 L 40.5 297.0 L 40.5 296.0 L 40.0 295.5 L 39.5 295.0 L 39.5 294.0 L 39.5 293.0 L 39.5 292.0 L 39.5 291.0 L 39.5 290.0 L 39.5 289.0 L 39.5 288.0 L 39.0 287.5 L 38.5 287.0 L 38.5 286.0 L 38.5 285.0 L 38.5 284.0 L 38.5 283.0 L 38.0 282.5 L 37.5 282.0 L 37.5 281.0 L 37.5 280.0 L 37.5 279.0 L 37.5 278.0 L 37.5 277.0 L 37.5 276.0 L 37.5 275.0 L 37.5 274.0 L 37.5 273.0 L 37.0 272.5 L 36.5 272.0 L 36.5 271.0 L 36.5 270.0 L 36.5 269.0 L 36.5 268.0 L 36.5 267.0 L 36.5 266.0 L 36.5 265.0 L 36.5 264.0 L 36.5 263.0 L 36.5 262.0 L 36.5 261.0 L 36.5 260.0 L 36.5 259.0 L 36.5 258.0 L 36.5 257.0 L 36.5 256.0 L 36.5 255.0 L 36.5 254.0 L 36.5 253.0 L 36.5 252.0 L 36.5 251.0 L 36.5 250.0 L 36.5 249.0 L 36.5 248.0 L 36.5 247.0 L 36.5 246.0 L 36.5 245.0 L 36.5 244.0 L 36.5 243.0 L 36.5 242.0 L 36.5 241.0 L 37.0 240.5 L 37.5 240.0 L 37.5 239.0 L 37.5 238.0 L 37.5 237.0 L 37.5 236.0 L 37.5 235.0 L 37.5 234.0 L 37.5 233.0 L 37.5 232.0 L 37.5 231.0 L 37.5 230.0 L 38.0 229.5 L 38.5 229.0 L 38.5 228.0 L 38.5 227.0 L 38.5 226.0 L 38.5 225.0 L 39.0 224.5 L 39.5 224.0 L 39.5 223.0 L 39.5 222.0 L 39.5 221.0 L 39.5 220.0 L 39.5 219.0 L 39.5 218.0 L 39.5 217.0 L 40.0 216.5 L 40.5 216.0 L 40.5 215.0 L 40.5 214.0 L 40.5 213.0 L 40.5 212.0 L 41.0 211.5 L 41.5 211.0 L 41.5 210.0 L 41.5 209.0 L 42.0 208.5 L 42.5 208.0 L 42.5 207.0 L 42.5 206.0 L 42.5 205.0 L 43.0 204.5 L 43.5 204.0 L 43.5 203.0 L 43.5 202.0 L 43.5 201.0 L 44.0 200.5 L 44.5 200.0 L 44.5 199.0 L 44.5 198.0 L 45.0 197.5 L 45.5 197.0 L 45.5 196.0 L 45.5 195.0 L 45.5 194.0 L 46.0 193.5 L 46.5 193.0 L 46.5 192.0 L 46.5 191.0 L 47.0 190.5 L 47.5 190.0 L 47.5 189.0 L 47.5 188.0 L 48.0 187.5 L 48.5 187.0 L 48.5 186.0 L 48.5 185.0 L 49.0 184.5 L 49.5 184.0 L 49.5 183.0 L 49.5 182.0 L 50.0 181.5 L 50.5 181.0 L 50.5 180.0 L 50.5 179.0 L 51.0 178.5 L 51.5 178.0 L 51.5 177.0 L 52.0 176.5 L 52.5 176.0 L 52.5 175.0 L 53.0 174.5 L 53.5 174.0 L 53.5 173.0 L 53.5 172.0 L 54.0 171.5 L 54.5 171.0 L 54.5 170.0 L 54.5 169.0 L 55.0 168.5 L 55.5 168.0 L 55.5 167.0 L 56.0 166.5 L 56.5 166.0 L 56.5 165.0 L 57.0 164.5 L 57.5 164.0 L 57.5 163.0 L 58.0 162.5 L 58.5 162.0 L 58.5 161.0 L 59.0 160.5 L 59.5 160.0 L 59.5 159.0 L 60.0 158.5 L 60.5 158.0 L 61.0 157.5 L 61.5 157.0 L 61.5 156.0 L 61.5 155.0 L 62.0 154.5 L 62.5 154.0 L 62.5 153.0 L 63.0 152.5 L 63.5 152.0 L 64.0 151.5 L 64.5 151.0 L 64.5 150.0 L 65.0 149.5 L 65.5 149.0 L 65.5 148.0 L 66.0 147.5 L 66.5 147.0 L 67.0 146.5 L 67.5 146.0 L 67.5 145.0 L 68.0 144.5 L 68.5 144.0 L 68.5 143.0 L 69.0 142.5 L 69.5 142.0 L 70.0 141.5 L 70.5 141.0 L 70.5 140.0 L 71.0 139.5 L 71.5 139.0 L 72.0 138.5 L 72.5 138.0 L 72.5 137.0 L 73.0 136.5 L 73.5 136.0 L 74.0 135.5 L 74.5 135.0 L 74.5 134.0 L 75.0 133.5 L 75.5 133.0 L 76.0 132.5 L 76.5 132.0 L 76.5 131.0 L 77.0 130.5 L 77.5 130.0 L 78.0 129.5 L 78.5 129.0 L 79.0 128.5 L 79.5 128.0 L 79.5 127.0 L 80.0 126.5 L 80.5 126.0 L 81.0 125.5 L 81.5 125.0 L 82.0 124.5 L 82.5 124.0 L 82.5 123.0 L 83.0 122.5 L 83.5 122.0 L 84.0 121.5 L 84.5 121.0 L 85.0 120.5 L 85.5 120.0 L 86.0 119.5 L 86.5 119.0 L 87.0 118.5 L 87.5 118.0 L 87.5 117.0 L 88.0 116.5 L 88.5 116.0 L 89.0 115.5 L 89.5 115.0 L 90.0 114.5 L 90.5 114.0 L 91.0 113.5 L 91.5 113.0 L 92.0 112.5 L 92.5 112.0 L 93.0 111.5 L 93.5 111.0 L 94.0 110.5 L 94.5 110.0 L 95.0 109.5 L 95.5 109.0 L 96.0 108.5 L 96.5 108.0 L 97.0 107.5 L 97.5 107.0 L 98.0 106.5 L 98.5 106.0 L 99.0 105.5 L 99.5 105.0 L 100.0 104.5 L 100.5 104.0 L 101.0 103.5 L 101.5 103.0 L 102.0 102.5 L 102.5 102.0 L 103.0 101.5 L 103.5 101.0 L 104.0 100.5 L 104.5 100.0 L 105.0 99.5 L 105.5 99.0 L 106.0 98.5 L 106.5 98.0 L 107.0 97.5 L 107.5 97.0 L 108.0 96.5 L 108.5 96.0 L 109.0 95.5 L 109.5 95.0 L 110.0 94.5 L 111.0 94.5 L 111.5 94.0 L 112.0 93.5 L 112.5 93.0 L 113.0 92.5 L 113.5 92.0 L 114.0 91.5 L 114.5 91.0 L 115.0 90.5 L 115.5 90.0 L 116.0 89.5 L 117.0 89.5 L 117.5 89.0 L 118.0 88.5 L 118.5 88.0 L 119.0 87.5 L 119.5 87.0 L 120.0 86.5 L 121.0 86.5 L 121.5 86.0 L 122.0 85.5 L 122.5 85.0 L 123.0 84.5 L 123.5 84.0 L 124.0 83.5 L 124.5 83.0 L 125.0 82.5 L 126.0 82.5 L 126.5 82.0 L 127.0 81.5 L 127.5 81.0 L 128.0 80.5 L 129.0 80.5 L 129.5 80.0 L 130.0 79.5 L 131.0 79.5 L 131.5 79.0 L 132.0 78.5 L 132.5 78.0 L 133.0 77.5 L 133.5 77.0 L 134.0 76.5 L 135.0 76.5 L 135.5 76.0 L 136.0 75.5 L 137.0 75.5 L 137.5 75.0 L 138.0 74.5 L 139.0 74.5 L 139.5 74.0 L 140.0 73.5 L 140.5 73.0 L 141.0 72.5 L 142.0 72.5 L 142.5 72.0 L 143.0 71.5 L 144.0 71.5 L 144.5 71.0 L 145.0 70.5 L 145.5 70.0 L 146.0 69.5 L 147.0 69.5 L 147.5 69.0 L 148.0 68.5 L 149.0 68.5 L 149.5 68.0 L 150.0 67.5 L 151.0 67.5 L 151.5 67.0 L 152.0 66.5 L 153.0 66.5 L 153.5 66.0 L 154.0 65.5 L 155.0 65.5 L 155.5 65.0 L 156.0 64.5 L 157.0 64.5 L 157.5 64.0 L 158.0 63.5 L 159.0 63.5 L 159.5 63.0 L 160.0 62.5 L 161.0 62.5 L 161.5 62.0 L 162.0 61.5 L 163.0 61.5 L 163.5 61.0 L 164.0 60.5 L 165.0 60.5 L 166.0 60.5 L 166.5 60.0 L 167.0 59.5 L 168.0 59.5 L 168.5 59.0 L 169.0 58.5 L 170.0 58.5 L 170.5 58.0 L 171.0 57.5 L 172.0 57.5 L 173.0 57.5 L 173.5 57.0 L 174.0 56.5 L 175.0 56.5 L 176.0 56.5 L 176.5 56.0 L 177.0 55.5 L 178.0 55.5 L 179.0 55.5 L 179.5 55.0 L 180.0 54.5 L 181.0 54.5 L 182.0 54.5 L 183.0 54.5 L 183.5 54.0 L 184.0 53.5 L 185.0 53.5 L 186.0 53.5 L 186.5 53.0 L 187.0 52.5 L 188.0 52.5 L 189.0 52.5 L 189.5 52.0 L 190.0 51.5 L 191.0 51.5 L 192.0 51.5 L 193.0 51.5 L 194.0 51.5 L 194.5 51.0 L 195.0 50.5 L 196.0 50.5 L 197.0 50.5 L 198.0 50.5 L 198.5 50.0 L 199.0 49.5 L 200.0 49.5 L 201.0 49.5 L 202.0 49.5 L 203.0 49.5 L 203.5 49.0 L 204.0 48.5 L 205.0 48.5 L 206.0 48.5 L 207.0 48.5 L 208.0 48.5 L 208.5 48.0 L 209.0 47.5 L 210.0 47.5 L 211.0 47.5 L 212.0 47.5 L 213.0 47.5 L 213.5 47.0 L 214.0 46.5 L 215.0 46.5 L 216.0 46.5 L 217.0 46.5 L 218.0 46.5 L 219.0 46.5 L 220.0 46.5 L 221.0 46.5 L 222.0 46.5 L 222.5 46.0 L 223.0 45.5 L 224.0 45.5 L 225.0 45.5 L 226.0 45.5 L 227.0 45.5 L 228.0 45.5 L 229.0 45.5 L 230.0 45.5 L 231.0 45.5 L 232.0 45.5 L 232.5 45.0 L 233.0 44.5 L 234.0 44.5 L 235.0 44.5 L 236.0 44.5 L 237.0 44.5 L 238.0 44.5 L 239.0 44.5 L 240.0 44.5 L 241.0 44.5 L 242.0 44.5 L 243.0 44.5 L 244.0 44.5 L 245.0 44.5 L 246.0 44.5 L 247.0 44.5 L 248.0 44.5 L 249.0 44.5 L 250.0 44.5 L 251.0 44.5 L 251.5 45.0 L 252.0 45.5 L 253.0 45.5 L 254.0 45.5 L 255.0 45.5 L 256.0 45.5 L 257.0 45.5 L 258.0 45.5 L 259.0 45.5 L 260.0 45.5 L 261.0 45.5 L 262.0 45.5 L 263.0 45.5 L 264.0 45.5 L 264.5 46.0 L 265.0 46.5 L 266.0 46.5 L 267.0 46.5 L 268.0 46.5 L 269.0 46.5 L 270.0 46.5 L 271.0 46.5 L 272.0 46.5 L 273.0 46.5 L 273.5 47.0 L 274.0 47.5 L 275.0 47.5 L 276.0 47.5 L 277.0 47.5 L 278.0 47.5 L 279.0 47.5 L 279.5 48.0 L 280.0 48.5 L 281.0 48.5 L 282.0 48.5 L 283.0 48.5 L 284.0 48.5 L 284.5 49.0 L 285.0 49.5 L 286.0 49.5 L 287.0 49.5 L 288.0 49.5 L 289.0 49.5 L 289.5 50.0 L 290.0 50.5 L 291.0 50.5 L 292.0 50.5 L 293.0 50.5 L 293.5 51.0 L 294.0 51.5 L 295.0 51.5 L 296.0 51.5 L 297.0 51.5 L 298.0 51.5 L 298.5 52.0 L 299.0 52.5 L 300.0 52.5 L 301.0 52.5 L 301.5 53.0 L 302.0 53.5 L 303.0 53.5 L 304.0 53.5 L 304.5 54.0 L 305.0 54.5 L 306.0 54.5 L 307.0 54.5 L 308.0 54.5 L 308.5 55.0 L 309.0 55.5 L 310.0 55.5 L 311.0 55.5 L 311.5 56.0 L 312.0 56.5 L 313.0 56.5 L 314.0 56.5 L 314.5 57.0 L 315.0 57.5 L 316.0 57.5 L 317.0 57.5 L 317.5 58.0 L 318.0 58.5 L 319.0 58.5 L 319.5 59.0 L 320.0 59.5 L 321.0 59.5 L 322.0 59.5 L 322.5 60.0 L 323.0 60.5 L 324.0 60.5 L 324.5 61.0 L 325.0 61.5 L 326.0 61.5 L 326.5 62.0 L 327.0 62.5 L 328.0 62.5 L 328.5 63.0 L 329.0 63.5 L 330.0 63.5 L 330.5 64.0 L 331.0 64.5 L 332.0 64.5 L 333.0 64.5 L 333.5 65.0 L 334.0 65.5 L 334.5 66.0 L 335.0 66.5 L 336.0 66.5 L 336.5 67.0 L 337.0 67.5 L 338.0 67.5 L 338.5 68.0 L 339.0 68.5 L 340.0 68.5 L 340.5 69.0 L 341.0 69.5 L 342.0 69.5 L 342.5 70.0 L 343.0 70.5 L 343.5 71.0 L 344.0 71.5 L 345.0 71.5 L 345.5 72.0 L 346.0 72.5 L 347.0 72.5 L 347.5 73.0 L 348.0 73.5 L 348.5 74.0 L 349.0 74.5 L 350.0 74.5 L 350.5 75.0 L 351.0 75.5 L 352.0 75.5 L 352.5 76.0 L 353.0 76.5 L 353.5 77.0 L 354.0 77.5 L 355.0 77.5 L 355.5 78.0 L 356.0 78.5 L 357.0 78.5 L 357.5 79.0 L 358.0 79.5 L 358.5 80.0 L 359.0 80.5 L 360.0 80.5 L 360.5 81.0 L 361.0 81.5 L 361.5 82.0 L 362.0 82.5 L 363.0 82.5 L 363.5 83.0 L 364.0 83.5 L 364.5 84.0 L 365.0 84.5 L 366.0 84.5 L 366.5 85.0 L 367.0 85.5 L 367.5 86.0 L 368.0 86.5 L 369.0 86.5 L 369.5 87.0 L 370.0 87.5 L 370.5 88.0 L 371.0 88.5 L 371.5 89.0 L 372.0 89.5 L 372.5 90.0 L 373.0 90.5 L 374.0 90.5 L 374.5 91.0 L 375.0 91.5 L 375.5 92.0 L 376.0 92.5 L 376.5 93.0 L 377.0 93.5 L 377.5 94.0 L 378.0 94.5 L 378.5 95.0 L 379.0 95.5 L 379.5 96.0 L 380.0 96.5 L 381.0 96.5 L 381.5 97.0 L 382.0 97.5 L 382.5 98.0 L 382.5 99.0 L 383.0 99.5 L 384.0 99.5 L 384.5 100.0 L 385.0 100.5 L 385.5 101.0 L 386.0 101.5 L 386.5 102.0 L 387.0 102.5 L 387.5 103.0 L 387.5 104.0 L 388.0 104.5 L 389.0 104.5 L 389.5 105.0 L 390.0 105.5 L 390.5 106.0 L 391.0 106.5 L 391.5 107.0 L 392.0 107.5 L 392.5 108.0 L 392.5 109.0 L 393.0 109.5 L 394.0 109.5 L 394.5 110.0 L 394.5 111.0 L 395.0 111.5 L 395.5 112.0 L 396.0 112.5 L 396.5 113.0 L 397.0 113.5 L 397.5 114.0 L 398.0 114.5 L 398.5 115.0 L 399.0 115.5 L 399.5 116.0 L 400.0 116.5 L 400.5 117.0 L 401.0 117.5 L 401.5 118.0 L 402.0 118.5 L 402.5 119.0 L 402.5 120.0 L 403.0 120.5 L 403.5 121.0 L 404.0 121.5 L 404.5 122.0 L 405.0 122.5 L 405.5 123.0 L 406.0 123.5 L 406.5 124.0 L 407.0 124.5 L 407.5 125.0 L 407.5 126.0 L 408.0 126.5 L 408.5 127.0 L 408.5 128.0 L 409.0 128.5 L 409.5 129.0 L 409.5 130.0 L 409.5 131.0 L 410.0 131.5 L 410.5 132.0 L 410.5 133.0 L 410.5 134.0 L 410.5 135.0 L 410.0 135.5 L 409.5 136.0 L 409.5 137.0 L 409.0 137.5 L 408.5 138.0 L 408.5 139.0 L 408.0 139.5 L 407.5 140.0 L 407.0 140.5 L 406.5 141.0 L 406.0 141.5 L 405.5 142.0 L 405.0 142.5 L 404.5 143.0 L 404.0 143.5 L 403.5 144.0 L 403.0 144.5 L 402.5 145.0 L 402.0 145.5 L 401.0 145.5 L 400.5 146.0 L 400.0 146.5 L 399.5 147.0 L 399.0 147.5 L 398.0 147.5 L 397.5 148.0 L 397.0 148.5 L 396.0 148.5 L 395.0 148.5 L 394.5 149.0 L 394.0 149.5 L 393.0 149.5 L 392.0 149.5 L 391.0 149.5 L 390.0 149.5 L 389.0 149.5 L 388.0 149.5 L 387.0 149.5 L 386.0 149.5 L 385.5 149.0 L 385.0 148.5 L 384.0 148.5 L 383.0 148.5 L 382.5 148.0 L 382.0 147.5 L 381.0 147.5 L 380.5 147.0 L 380.0 146.5 L 379.5 146.0 L 379.0 145.5 L 378.0 145.5 L 377.5 145.0 L 377.0 144.5 L 376.0 144.5 L 375.5 144.0 L 375.0 143.5 L 374.0 143.5 L 373.5 143.0 L 373.0 142.5 L 372.5 142.0 L 372.0 141.5 L 371.0 141.5 L 370.5 141.0 L 370.0 140.5 L 369.0 140.5 L 368.5 140.0 L 368.0 139.5 L 367.0 139.5 L 366.5 139.0 L 366.0 138.5 L 365.5 138.0 L 365.0 137.5 L 364.0 137.5 L 363.5 137.0 L 363.0 136.5 L 362.0 136.5 L 361.5 136.0 L 361.0 135.5 L 360.0 135.5 L 359.5 135.0 L 359.0 134.5 L 358.0 134.5 L 357.5 134.0 L 357.0 133.5 L 356.0 133.5 L 355.5 133.0 L 355.0 132.5 L 354.0 132.5 L 353.5 132.0 L 353.0 131.5 L 352.0 131.5 L 351.0 131.5 L 350.5 131.0 L 350.0 130.5 L 349.0 130.5 L 348.5 130.0 L 348.0 129.5 L 347.0 129.5 L 346.0 129.5 L 345.5 129.0 L 345.0 128.5 L 344.0 128.5 L 343.0 128.5 L 342.5 128.0 L 342.0 127.5 L 341.0 127.5 L 340.5 127.0 L 340.0 126.5 L 339.0 126.5 L 338.0 126.5 L 337.5 126.0 L 337.0 125.5 L 336.0 125.5 L 335.0 125.5 L 334.5 125.0 L 334.0 124.5 L 333.0 124.5 L 332.0 124.5 L 331.5 124.0 L 331.0 123.5 L 330.0 123.5 L 329.0 123.5 L 328.5 123.0 L 328.0 122.5 L 327.0 122.5 L 326.0 122.5 L 325.0 122.5 L 324.5 122.0 L 324.0 121.5 L 323.0 121.5 L 322.0 121.5 L 321.0 121.5 L 320.5 121.0 L 320.0 120.5 L 319.0 120.5 L 318.0 120.5 L 317.5 120.0 L 317.0 119.5 L 316.0 119.5 L 315.0 119.5 L 314.0 119.5 L 313.0 119.5 L 312.5 119.0 L 312.0 118.5 L 311.0 118.5 L 310.0 118.5 L 309.0 118.5 L 308.0 118.5 L 307.5 118.0 L 307.0 117.5 L 306.0 117.5 L 305.0 117.5 L 304.0 117.5 L 303.0 117.5 L 302.0 117.5 L 301.5 117.0 L 301.0 116.5 L 300.0 116.5 L 299.0 116.5 L 298.0 116.5 L 297.0 116.5 L 296.0 116.5 L 295.0 116.5 L 294.0 116.5 L 293.0 116.5 L 292.0 116.5 L 291.5 116.0 L 291.0 115.5 L 290.0 115.5 L 289.0 115.5 L 288.0 115.5 L 287.0 115.5 L 286.0 115.5 L 285.0 115.5 L 284.0 115.5 L 283.0 115.5 L 282.0 115.5 L 281.0 115.5 L 280.0 115.5 L 279.0 115.5 L 278.0 115.5 L 277.0 115.5 L 276.0 115.5 L 275.0 115.5 L 274.0 115.5 L 273.5 116.0 L 273.0 116.5 L 272.0 116.5 L 271.0 116.5 L 270.0 116.5 L 269.0 116.5 L 268.0 116.5 L 267.0 116.5 L 266.0 116.5 L 265.0 116.5 L 264.0 116.5 L 263.0 116.5 L 262.0 116.5 L 261.0 116.5 L 260.5 117.0 L 260.0 117.5 L 259.0 117.5 L 258.0 117.5 L 257.0 117.5 L 256.0 117.5 L 255.5 118.0 L 255.0 118.5 L 254.0 118.5 L 253.0 118.5 L 252.0 118.5 L 251.0 118.5 L 250.0 118.5 L 249.5 119.0 L 249.0 119.5 L 248.0 119.5 L 247.0 119.5 L 246.0 119.5 L 245.0 119.5 L 244.5 120.0 L 244.0 120.5 L 243.0 120.5 L 242.0 120.5 L 241.5 121.0 L 241.0 121.5 L 240.0 121.5 L 239.0 121.5 L 238.0 121.5 L 237.0 121.5 L 236.5 122.0 L 236.0 122.5 L 235.0 122.5 L 234.0 122.5 L 233.5 123.0 L 233.0 123.5 L 232.0 123.5 L 231.0 123.5 L 230.5 124.0 L 230.0 124.5 L 229.0 124.5 L 228.0 124.5 L 227.5 125.0 L 227.0 125.5 L 226.0 125.5 L 225.5 126.0 L 225.0 126.5 L 224.0 126.5 L 223.5 127.0 L 223.0 127.5 L 222.0 127.5 L 221.0 127.5 L 220.5 128.0 L 220.0 128.5 L 219.0 128.5 L 218.5 129.0 L 218.0 129.5 L 217.0 129.5 L 216.5 130.0 L 216.0 130.5 L 215.0 130.5 L 214.5 131.0 L 214.0 131.5 L 213.0 131.5 L 212.5 132.0 L 212.0 132.5 L 211.0 132.5 L 210.5 133.0 L 210.0 133.5 L 209.0 133.5 L 208.5 134.0 L 208.0 134.5 L 207.0 134.5 L 206.5 135.0 L 206.0 135.5 L 205.0 135.5 L 204.5 136.0 L 204.0 136.5 L 203.5 137.0 L 203.0 137.5 L 202.0 137.5 L 201.5 138.0 L 201.0 138.5 L 200.0 138.5 L 199.5 139.0 L 199.0 139.5 L 198.0 139.5 L 197.5 140.0 L 197.0 140.5 L 196.5 141.0 L 196.0 141.5 L 195.0 141.5 L 194.5 142.0 L 194.0 142.5 L 193.5 143.0 L 193.0 143.5 L 192.0 143.5 L 191.5 144.0 L 191.0 144.5 L 190.0 144.5 L 189.5 145.0 L 189.0 145.5 L 188.5 146.0 L 188.0 146.5 L 187.0 146.5 L 186.5 147.0 L 186.0 147.5 L 185.5 148.0 L 185.0 148.5 L 184.5 149.0 L 184.0 149.5 L 183.5 150.0 L 183.0 150.5 L 182.0 150.5 L 181.5 151.0 L 181.0 151.5 L 180.5 152.0 L 180.0 152.5 L 179.5 153.0 L 179.0 153.5 L 178.5 154.0 L 178.0 154.5 L 177.0 154.5 L 176.5 155.0 L 176.5 156.0 L 176.0 156.5 L 175.0 156.5 L 174.5 157.0 L 174.0 157.5 L 173.5 158.0 L 173.0 158.5 L 172.5 159.0 L 172.0 159.5 L 171.5 160.0 L 171.0 160.5 L 170.5 161.0 L 170.0 161.5 L 169.5 162.0 L 169.0 162.5 L 168.5 163.0 L 168.0 163.5 L 167.5 164.0 L 167.0 164.5 L 166.5 165.0 L 166.0 165.5 L 165.5 166.0 L 165.0 166.5 L 164.5 167.0 L 164.0 167.5 L 163.5 168.0 L 163.0 168.5 L 162.5 169.0 L 162.0 169.5 L 161.5 170.0 L 161.0 170.5 L 160.5 171.0 L 160.0 171.5 L 159.5 172.0 L 159.5 173.0 L 159.0 173.5 L 158.5 174.0 L 158.0 174.5 L 157.5 175.0 L 157.0 175.5 L 156.5 176.0 L 156.5 177.0 L 156.0 177.5 L 155.5 178.0 L 155.0 178.5 L 154.5 179.0 L 154.0 179.5 L 153.5 180.0 L 153.5 181.0 L 153.0 181.5 L 152.5 182.0 L 152.0 182.5 L 151.5 183.0 L 151.0 183.5 L 150.5 184.0 L 150.5 185.0 L 150.0 185.5 L 149.5 186.0 L 149.0 186.5 L 148.5 187.0 L 148.5 188.0 L 148.0 188.5 L 147.5 189.0 L 147.0 189.5 L 146.5 190.0 L 146.5 191.0 L 146.0 191.5 L 145.5 192.0 L 145.0 192.5 L 144.5 193.0 L 144.5 194.0 L 144.0 194.5 L 143.5 195.0 L 143.0 195.5 L 142.5 196.0 L 142.5 197.0 L 142.0 197.5 L 141.5 198.0 L 141.5 199.0 L 141.0 199.5 L 140.5 200.0 L 140.5 201.0 L 140.0 201.5 L 139.5 202.0 L 139.5 203.0 L 139.0 203.5 L 138.5 204.0 L 138.5 205.0 L 138.0 205.5 L 137.5 206.0 L 137.0 206.5 L 136.5 207.0 L 136.5 208.0 L 136.5 209.0 L 136.0 209.5 L 135.5 210.0 L 135.5 211.0 L 135.0 211.5 L 134.5 212.0 L 134.5 213.0 L 134.0 213.5 L 133.5 214.0 L 133.5 215.0 L 133.0 215.5 L 132.5 216.0 L 132.5 217.0 L 132.0 217.5 L 131.5 218.0 L 131.5 219.0 L 131.5 220.0 L 131.0 220.5 L 130.5 221.0 L 130.5 222.0 L 130.5 223.0 L 130.0 223.5 L 129.5 224.0 L 129.5 225.0 L 129.0 225.5 L 128.5 226.0 L 128.5 227.0 L 128.5 228.0 L 128.0 228.5 L 127.5 229.0 L 127.5 230.0 L 127.5 231.0 L 127.0 231.5 L 126.5 232.0 L 126.5 233.0 L 126.5 234.0 L 126.0 234.5 L 125.5 235.0 L 125.5 236.0 L 125.5 237.0 L 125.0 237.5 L 124.5 238.0 L 124.5 239.0 L 124.5 240.0 L 124.5 241.0 L 124.0 241.5 L 123.5 242.0 L 123.5 243.0 L 123.5 244.0 L 123.5 245.0 L 123.0 245.5 L 122.5 246.0 L 122.5 247.0 L 122.5 248.0 L 122.0 248.5 L 121.5 249.0 L 121.5 250.0 L 121.5 251.0 L 121.5 252.0 L 121.5 253.0 L 121.5 254.0 L 121.5 255.0 L 121.5 256.0 L 121.0 256.5 L 120.5 257.0 L 120.5 258.0 L 120.5 259.0 L 120.5 260.0 L 120.5 261.0 L 120.5 262.0 L 120.5 263.0 L 120.0 263.5 L 119.5 264.0 L 119.5 265.0 L 119.5 266.0 L 119.5 267.0 L 119.5 268.0 L 119.5 269.0 L 119.5 270.0 L 119.5 271.0 L 119.5 272.0 L 119.5 273.0 L 119.5 274.0 L 119.5 275.0 L 119.5 276.0 L 119.5 277.0 L 119.5 278.0 L 119.0 278.5 L 118.5 279.0 L 118.5 280.0 L 118.5 281.0 L 118.5 282.0 L 118.5 283.0 L 118.5 284.0 L 118.5 285.0 L 118.5 286.0 L 118.5 287.0 L 118.5 288.0 L 118.5 289.0 L 118.5 290.0 L 118.5 291.0 L 118.5 292.0 L 119.0 292.5 L 119.5 293.0 L 119.5 294.0 L 119.5 295.0 L 119.5 296.0 L 119.5 297.0 L 119.5 298.0 L 119.5 299.0 L 119.5 300.0 L 119.5 301.0 L 119.5 302.0 L 119.5 303.0 L 119.5 304.0 L 119.5 305.0 L 120.0 305.5 L 120.5 306.0 L 120.5 307.0 L 120.5 308.0 L 120.5 309.0 L 121.0 309.5 L 121.5 310.0 L 121.5 311.0 L 121.5 312.0 L 121.5 313.0 L 121.5 314.0 L 121.5 315.0 L 121.5 316.0 L 121.5 317.0 L 121.5 318.0 L 122.0 318.5 L 122.5 319.0 L 122.5 320.0 L 122.5 321.0 L 123.0 321.5 L 123.5 322.0 L 123.5 323.0 L 123.5 324.0 L 123.5 325.0 L 124.0 325.5 L 124.5 326.0 L 124.5 327.0 L 124.5 328.0 L 124.5 329.0 L 125.0 329.5 L 125.5 330.0 L 125.5 331.0 L 125.5 332.0 L 126.0 332.5 L 126.5 333.0 L 126.5 334.0 L 126.5 335.0 L 127.0 335.5 L 127.5 336.0 L 127.5 337.0 L 127.5 338.0 L 128.0 338.5 L 128.5 339.0 L 128.5 340.0 L 128.5 341.0 L 128.5 342.0 L 129.0 342.5 L 129.5 343.0 L 129.5 344.0 L 129.5 345.0 L 130.0 345.5 L 130.5 346.0 L 130.5 347.0 L 131.0 347.5 L 131.5 348.0 L 131.5 349.0 L 131.5 350.0 L 132.0 350.5 L 132.5 351.0 L 132.5 352.0 L 133.0 352.5 L 133.5 353.0 L 133.5 354.0 L 133.5 355.0 L 134.0 355.5 L 134.5 356.0 L 134.5 357.0 L 135.0 357.5 L 135.5 358.0 L 135.5 359.0 L 136.0 359.5 L 136.5 360.0 L 136.5 361.0 L 137.0 361.5 L 137.5 362.0 L 137.5 363.0 L 138.0 363.5 L 138.5 364.0 L 138.5 365.0 L 139.0 365.5 L 139.5 366.0 L 139.5 367.0 L 140.0 367.5 L 140.5 368.0 L 141.0 368.5 L 141.5 369.0 L 141.5 370.0 L 142.0 370.5 L 142.5 371.0 L 142.5 372.0 L 143.0 372.5 L 143.5 373.0 L 143.5 374.0 L 144.0 374.5 L 144.5 375.0 L 144.5 376.0 L 145.0 376.5 L 145.5 377.0 L 146.0 377.5 L 146.5 378.0 L 146.5 379.0 L 147.0 379.5 L 147.5 380.0 L 148.0 380.5 L 148.5 381.0 L 148.5 382.0 L 149.0 382.5 L 149.5 383.0 L 150.0 383.5 L 150.5 384.0 L 150.5 385.0 L 151.0 385.5 L 151.5 386.0 L 152.0 386.5 L 152.5 387.0 L 152.5 388.0 L 153.0 388.5 L 153.5 389.0 L 154.0 389.5 L 154.5 390.0 L 154.5 391.0 L 155.0 391.5 L 155.5 392.0 L 156.0 392.5 L 156.5 393.0 L 157.0 393.5 L 157.5 394.0 L 157.5 395.0 L 158.0 395.5 L 158.5 396.0 L 159.0 396.5 L 159.5 397.0 L 160.0 397.5 L 160.5 398.0 L 161.0 398.5 L 161.5 399.0 L 161.5 400.0 L 162.0 400.5 L 162.5 401.0 L 163.0 401.5 L 163.5 402.0 L 164.0 402.5 L 164.5 403.0 L 165.0 403.5 L 165.5 404.0 L 166.0 404.5 L 166.5 405.0 L 167.0 405.5 L 167.5 406.0 L 168.0 406.5 L 168.5 407.0 L 169.0 407.5 L 169.5 408.0 L 170.0 408.5 L 170.5 409.0 L 171.0 409.5 L 171.5 410.0 L 172.0 410.5 L 173.0 410.5 L 173.5 411.0 L 174.0 411.5 L 174.5 412.0 L 175.0 412.5 L 175.5 413.0 L 176.0 413.5 L 176.5 414.0 L 177.0 414.5 L 177.5 415.0 L 178.0 415.5 L 178.5 416.0 L 179.0 416.5 L 180.0 416.5 L 180.5 417.0 L 181.0 417.5 L 181.5 418.0 L 182.0 418.5 L 182.5 419.0 L 183.0 419.5 L 183.5 420.0 L 184.0 420.5 L 184.5 421.0 L 185.0 421.5 L 186.0 421.5 L 186.5 422.0 L 187.0 422.5 L 187.5 423.0 L 188.0 423.5 L 188.5 424.0 L 189.0 424.5 L 190.0 424.5 L 190.5 425.0 L 191.0 425.5 L 191.5 426.0 L 192.0 426.5 L 193.0 426.5 L 193.5 427.0 L 194.0 427.5 L 194.5 428.0 L 195.0 428.5 L 195.5 429.0 L 196.0 429.5 L 197.0 429.5 L 197.5 430.0 L 198.0 430.5 L 198.5 431.0 L 199.0 431.5 L 200.0 431.5 L 200.5 432.0 L 201.0 432.5 L 202.0 432.5 L 202.5 433.0 L 203.0 433.5 L 203.5 434.0 L 204.0 434.5 L 205.0 434.5 L 205.5 435.0 L 206.0 435.5 L 207.0 435.5 L 207.5 436.0 L 208.0 436.5 L 209.0 436.5 L 209.5 437.0 L 210.0 437.5 L 211.0 437.5 L 211.5 438.0 L 212.0 438.5 L 213.0 438.5 L 213.5 439.0 L 214.0 439.5 L 215.0 439.5 L 216.0 439.5 L 216.5 440.0 L 217.0 440.5 L 218.0 440.5 L 218.5 441.0 L 219.0 441.5 L 220.0 441.5 L 221.0 441.5 L 221.5 442.0 L 222.0 442.5 L 223.0 442.5 L 223.5 443.0 L 224.0 443.5 L 225.0 443.5 L 226.0 443.5 L 227.0 443.5 L 227.5 444.0 L 228.0 444.5 L 229.0 444.5 L 229.5 445.0 L 230.0 445.5 L 231.0 445.5 L 232.0 445.5 L 233.0 445.5 L 233.5 446.0 L 234.0 446.5 L 235.0 446.5 L 236.0 446.5 L 237.0 446.5 L 237.5 447.0 L 238.0 447.5 L 239.0 447.5 L 240.0 447.5 L 240.5 448.0 L 241.0 448.5 L 242.0 448.5 L 243.0 448.5 L 244.0 448.5 L 245.0 448.5 L 245.5 449.0 L 246.0 449.5 L 247.0 449.5 L 248.0 449.5 L 249.0 449.5 L 249.5 450.0 L 250.0 450.5 L 251.0 450.5 L 252.0 450.5 L 253.0 450.5 L 254.0 450.5 L 254.5 451.0 L 255.0 451.5 L 256.0 451.5 L 257.0 451.5 L 258.0 451.5 L 259.0 451.5 L 260.0 451.5 L 261.0 451.5 L 262.0 451.5 L 263.0 451.5 L 264.0 451.5 L 264.5 452.0 L 265.0 452.5 L 266.0 452.5 L 267.0 452.5 L 268.0 452.5 L 269.0 452.5 L 270.0 452.5 L 271.0 452.5 L 272.0 452.5 L 273.0 452.5 L 274.0 452.5 L 275.0 452.5 L 276.0 452.5 L 277.0 452.5 L 278.0 452.5 L 278.5 452.0 L 279.0 451.5 L 280.0 451.5 L 281.0 451.5 L 282.0 451.5 L 283.0 451.5 L 284.0 451.5 L 285.0 451.5 L 286.0 451.5 L 287.0 451.5 L 288.0 451.5 L 289.0 451.5 L 290.0 451.5 L 291.0 451.5 L 292.0 451.5 L 293.0 451.5 L 294.0 451.5 L 295.0 451.5 L 296.0 451.5 L 297.0 451.5 L 298.0 451.5 L 298.5 452.0 L 299.0 452.5 L 299.5 453.0 L 299.0 453.5 L 298.5 454.0 L 298.0 454.5 L 297.0 454.5 L 296.0 454.5 L 295.5 455.0 L 295.0 455.5 L 294.0 455.5 L 293.0 455.5 L 292.5 456.0 L 292.0 456.5 L 291.0 456.5 L 290.0 456.5 L 289.0 456.5 L 288.5 457.0 L 288.0 457.5 L 287.0 457.5 L 286.0 457.5 L 285.5 458.0 L 285.0 458.5 L 284.0 458.5 L 283.0 458.5 L 282.0 458.5 L 281.0 458.5 L 280.0 458.5 L 279.5 459.0 L 279.0 459.5 L 278.0 459.5 L 277.0 459.5 L 276.0 459.5 L 275.0 459.5 L 274.5 460.0 L 274.0 460.5 L 273.0 460.5 L 272.0 460.5 L 271.0 460.5 L 270.0 460.5 L 269.0 460.5 L 268.5 461.0 L 268.0 461.5 L 267.0 461.5 L 266.0 461.5 L 265.0 461.5 L 264.0 461.5 L 263.0 461.5 L 262.0 461.5 L 261.0 461.5 L 260.0 461.5 L 259.0 461.5 L 258.0 461.5 L 257.0 461.5 L 256.0 461.5 L 255.0 461.5 L 254.0 461.5 L 253.0 461.5 L 252.0 461.5 L 251.0 461.5 L 250.5 462.0 L 250.0 462.5 Z";
  var PATH_INNER = "M 316.0 438.5 L 315.0 438.5 L 314.0 438.5 L 313.0 438.5 L 312.0 438.5 L 311.0 438.5 L 310.0 438.5 L 309.0 438.5 L 308.0 438.5 L 307.0 438.5 L 306.0 438.5 L 305.0 438.5 L 304.0 438.5 L 303.0 438.5 L 302.0 438.5 L 301.0 438.5 L 300.0 438.5 L 299.0 438.5 L 298.0 438.5 L 297.0 438.5 L 296.0 438.5 L 295.0 438.5 L 294.0 438.5 L 293.0 438.5 L 292.0 438.5 L 291.0 438.5 L 290.0 438.5 L 289.0 438.5 L 288.0 438.5 L 287.0 438.5 L 286.0 438.5 L 285.0 438.5 L 284.5 438.0 L 284.0 437.5 L 283.0 437.5 L 282.0 437.5 L 281.0 437.5 L 280.0 437.5 L 279.0 437.5 L 278.5 437.0 L 278.0 436.5 L 277.0 436.5 L 276.0 436.5 L 275.0 436.5 L 274.0 436.5 L 273.0 436.5 L 272.0 436.5 L 271.0 436.5 L 270.5 436.0 L 270.0 435.5 L 269.0 435.5 L 268.0 435.5 L 267.0 435.5 L 266.0 435.5 L 265.0 435.5 L 264.5 435.0 L 264.0 434.5 L 263.0 434.5 L 262.0 434.5 L 261.0 434.5 L 260.5 434.0 L 260.0 433.5 L 259.0 433.5 L 258.0 433.5 L 257.0 433.5 L 256.5 433.0 L 256.0 432.5 L 255.0 432.5 L 254.0 432.5 L 253.5 432.0 L 253.0 431.5 L 252.0 431.5 L 251.0 431.5 L 250.5 431.0 L 250.0 430.5 L 249.0 430.5 L 248.0 430.5 L 247.5 430.0 L 247.0 429.5 L 246.0 429.5 L 245.5 429.0 L 245.0 428.5 L 244.0 428.5 L 243.0 428.5 L 242.5 428.0 L 242.0 427.5 L 241.0 427.5 L 240.5 427.0 L 240.0 426.5 L 239.0 426.5 L 238.0 426.5 L 237.5 426.0 L 237.0 425.5 L 236.0 425.5 L 235.5 425.0 L 235.0 424.5 L 234.0 424.5 L 233.5 424.0 L 233.0 423.5 L 232.0 423.5 L 231.0 423.5 L 230.5 423.0 L 230.0 422.5 L 229.0 422.5 L 228.5 422.0 L 228.0 421.5 L 227.0 421.5 L 226.5 421.0 L 226.0 420.5 L 225.0 420.5 L 224.5 420.0 L 224.0 419.5 L 223.0 419.5 L 222.5 419.0 L 222.0 418.5 L 221.0 418.5 L 220.5 418.0 L 220.0 417.5 L 219.0 417.5 L 218.5 417.0 L 218.0 416.5 L 217.0 416.5 L 216.5 416.0 L 216.0 415.5 L 215.5 415.0 L 215.0 414.5 L 214.0 414.5 L 213.5 414.0 L 213.0 413.5 L 212.0 413.5 L 211.5 413.0 L 211.0 412.5 L 210.5 412.0 L 210.0 411.5 L 209.0 411.5 L 208.5 411.0 L 208.0 410.5 L 207.0 410.5 L 206.5 410.0 L 206.0 409.5 L 205.5 409.0 L 205.0 408.5 L 204.0 408.5 L 203.5 408.0 L 203.5 407.0 L 203.0 406.5 L 202.0 406.5 L 201.5 406.0 L 201.0 405.5 L 200.5 405.0 L 200.0 404.5 L 199.0 404.5 L 198.5 404.0 L 198.0 403.5 L 197.5 403.0 L 197.0 402.5 L 196.5 402.0 L 196.0 401.5 L 195.5 401.0 L 195.0 400.5 L 194.5 400.0 L 194.0 399.5 L 193.5 399.0 L 193.0 398.5 L 192.5 398.0 L 192.0 397.5 L 191.5 397.0 L 191.0 396.5 L 190.0 396.5 L 189.5 396.0 L 189.5 395.0 L 189.0 394.5 L 188.5 394.0 L 188.0 393.5 L 187.0 393.5 L 186.5 393.0 L 186.5 392.0 L 186.0 391.5 L 185.0 391.5 L 184.5 391.0 L 184.0 390.5 L 183.5 390.0 L 183.5 389.0 L 183.0 388.5 L 182.0 388.5 L 181.5 388.0 L 181.5 387.0 L 181.0 386.5 L 180.5 386.0 L 180.0 385.5 L 179.5 385.0 L 179.0 384.5 L 178.5 384.0 L 178.0 383.5 L 177.5 383.0 L 177.0 382.5 L 176.5 382.0 L 176.0 381.5 L 175.5 381.0 L 175.5 380.0 L 175.0 379.5 L 174.5 379.0 L 174.0 378.5 L 173.5 378.0 L 173.0 377.5 L 172.5 377.0 L 172.0 376.5 L 171.5 376.0 L 171.5 375.0 L 171.0 374.5 L 170.5 374.0 L 170.0 373.5 L 169.5 373.0 L 169.0 372.5 L 168.5 372.0 L 168.0 371.5 L 167.5 371.0 L 167.5 370.0 L 167.0 369.5 L 166.5 369.0 L 166.0 368.5 L 165.5 368.0 L 165.0 367.5 L 164.5 367.0 L 164.5 366.0 L 164.0 365.5 L 163.5 365.0 L 163.0 364.5 L 162.5 364.0 L 162.5 363.0 L 162.0 362.5 L 161.5 362.0 L 161.0 361.5 L 160.5 361.0 L 160.5 360.0 L 160.0 359.5 L 159.5 359.0 L 159.5 358.0 L 159.0 357.5 L 158.5 357.0 L 158.5 356.0 L 158.0 355.5 L 157.5 355.0 L 157.5 354.0 L 157.0 353.5 L 156.5 353.0 L 156.5 352.0 L 156.0 351.5 L 155.5 351.0 L 155.5 350.0 L 155.0 349.5 L 154.5 349.0 L 154.5 348.0 L 154.0 347.5 L 153.5 347.0 L 153.5 346.0 L 153.0 345.5 L 152.5 345.0 L 152.5 344.0 L 152.0 343.5 L 151.5 343.0 L 151.5 342.0 L 151.5 341.0 L 151.0 340.5 L 150.5 340.0 L 150.5 339.0 L 150.0 338.5 L 149.5 338.0 L 149.5 337.0 L 149.5 336.0 L 149.0 335.5 L 148.5 335.0 L 148.5 334.0 L 148.0 333.5 L 147.5 333.0 L 147.5 332.0 L 147.0 331.5 L 146.5 331.0 L 146.5 330.0 L 146.5 329.0 L 146.0 328.5 L 145.5 328.0 L 145.5 327.0 L 145.5 326.0 L 145.0 325.5 L 144.5 325.0 L 144.5 324.0 L 144.5 323.0 L 144.0 322.5 L 143.5 322.0 L 143.5 321.0 L 143.5 320.0 L 143.5 319.0 L 143.0 318.5 L 142.5 318.0 L 142.5 317.0 L 142.5 316.0 L 142.5 315.0 L 142.0 314.5 L 141.5 314.0 L 141.5 313.0 L 141.5 312.0 L 141.5 311.0 L 141.5 310.0 L 141.5 309.0 L 141.0 308.5 L 140.5 308.0 L 140.5 307.0 L 140.5 306.0 L 140.5 305.0 L 140.5 304.0 L 140.5 303.0 L 140.5 302.0 L 140.5 301.0 L 140.0 300.5 L 139.5 300.0 L 139.5 299.0 L 139.5 298.0 L 139.5 297.0 L 139.5 296.0 L 139.5 295.0 L 139.5 294.0 L 139.5 293.0 L 139.5 292.0 L 139.5 291.0 L 139.5 290.0 L 139.5 289.0 L 139.5 288.0 L 139.0 287.5 L 138.5 287.0 L 138.5 286.0 L 138.5 285.0 L 138.5 284.0 L 138.5 283.0 L 138.5 282.0 L 138.5 281.0 L 138.5 280.0 L 138.5 279.0 L 138.5 278.0 L 138.5 277.0 L 138.5 276.0 L 138.5 275.0 L 138.5 274.0 L 138.5 273.0 L 138.5 272.0 L 138.5 271.0 L 139.0 270.5 L 139.5 270.0 L 139.5 269.0 L 139.5 268.0 L 139.5 267.0 L 139.5 266.0 L 139.5 265.0 L 139.5 264.0 L 139.5 263.0 L 139.5 262.0 L 139.5 261.0 L 140.0 260.5 L 140.5 260.0 L 140.5 259.0 L 141.0 258.5 L 141.5 258.0 L 141.5 257.0 L 142.0 256.5 L 142.5 256.0 L 143.0 255.5 L 144.0 255.5 L 144.5 256.0 L 144.5 257.0 L 145.0 257.5 L 145.5 258.0 L 145.5 259.0 L 145.5 260.0 L 145.5 261.0 L 145.5 262.0 L 145.5 263.0 L 145.5 264.0 L 145.5 265.0 L 145.5 266.0 L 145.5 267.0 L 145.5 268.0 L 145.5 269.0 L 145.5 270.0 L 146.0 270.5 L 146.5 271.0 L 146.5 272.0 L 146.5 273.0 L 146.5 274.0 L 146.5 275.0 L 146.5 276.0 L 146.5 277.0 L 146.5 278.0 L 146.5 279.0 L 146.5 280.0 L 147.0 280.5 L 147.5 281.0 L 147.5 282.0 L 147.5 283.0 L 147.5 284.0 L 148.0 284.5 L 148.5 285.0 L 148.5 286.0 L 148.5 287.0 L 148.5 288.0 L 148.5 289.0 L 149.0 289.5 L 149.5 290.0 L 149.5 291.0 L 149.5 292.0 L 149.5 293.0 L 150.0 293.5 L 150.5 294.0 L 150.5 295.0 L 150.5 296.0 L 151.0 296.5 L 151.5 297.0 L 151.5 298.0 L 151.5 299.0 L 152.0 299.5 L 152.5 300.0 L 152.5 301.0 L 152.5 302.0 L 153.0 302.5 L 153.5 303.0 L 153.5 304.0 L 154.0 304.5 L 154.5 305.0 L 154.5 306.0 L 154.5 307.0 L 155.0 307.5 L 155.5 308.0 L 155.5 309.0 L 156.0 309.5 L 156.5 310.0 L 156.5 311.0 L 157.0 311.5 L 157.5 312.0 L 157.5 313.0 L 158.0 313.5 L 158.5 314.0 L 159.0 314.5 L 159.5 315.0 L 159.5 316.0 L 160.0 316.5 L 160.5 317.0 L 160.5 318.0 L 161.0 318.5 L 161.5 319.0 L 162.0 319.5 L 162.5 320.0 L 162.5 321.0 L 163.0 321.5 L 163.5 322.0 L 163.5 323.0 L 164.0 323.5 L 164.5 324.0 L 165.0 324.5 L 165.5 325.0 L 166.0 325.5 L 166.5 326.0 L 166.5 327.0 L 167.0 327.5 L 167.5 328.0 L 168.0 328.5 L 168.5 329.0 L 169.0 329.5 L 169.5 330.0 L 170.0 330.5 L 170.5 331.0 L 171.0 331.5 L 171.5 332.0 L 171.5 333.0 L 172.0 333.5 L 172.5 334.0 L 173.0 334.5 L 173.5 335.0 L 174.0 335.5 L 174.5 336.0 L 175.0 336.5 L 175.5 337.0 L 176.0 337.5 L 176.5 338.0 L 177.0 338.5 L 177.5 339.0 L 178.0 339.5 L 178.5 340.0 L 179.0 340.5 L 179.5 341.0 L 180.0 341.5 L 180.5 342.0 L 181.0 342.5 L 181.5 343.0 L 182.0 343.5 L 183.0 343.5 L 183.5 344.0 L 184.0 344.5 L 184.5 345.0 L 185.0 345.5 L 185.5 346.0 L 186.0 346.5 L 187.0 346.5 L 187.5 347.0 L 188.0 347.5 L 188.5 348.0 L 189.0 348.5 L 189.5 349.0 L 190.0 349.5 L 191.0 349.5 L 191.5 350.0 L 192.0 350.5 L 192.5 351.0 L 193.0 351.5 L 194.0 351.5 L 194.5 352.0 L 195.0 352.5 L 195.5 353.0 L 196.0 353.5 L 197.0 353.5 L 197.5 354.0 L 198.0 354.5 L 199.0 354.5 L 199.5 355.0 L 200.0 355.5 L 201.0 355.5 L 201.5 356.0 L 202.0 356.5 L 202.5 357.0 L 203.0 357.5 L 204.0 357.5 L 204.5 358.0 L 205.0 358.5 L 206.0 358.5 L 206.5 359.0 L 207.0 359.5 L 208.0 359.5 L 208.5 360.0 L 209.0 360.5 L 210.0 360.5 L 211.0 360.5 L 211.5 361.0 L 212.0 361.5 L 213.0 361.5 L 213.5 362.0 L 214.0 362.5 L 215.0 362.5 L 215.5 363.0 L 216.0 363.5 L 217.0 363.5 L 218.0 363.5 L 219.0 363.5 L 219.5 364.0 L 220.0 364.5 L 221.0 364.5 L 222.0 364.5 L 222.5 365.0 L 223.0 365.5 L 224.0 365.5 L 225.0 365.5 L 226.0 365.5 L 227.0 365.5 L 227.5 366.0 L 228.0 366.5 L 229.0 366.5 L 230.0 366.5 L 231.0 366.5 L 232.0 366.5 L 232.5 367.0 L 233.0 367.5 L 234.0 367.5 L 235.0 367.5 L 235.5 368.0 L 236.0 368.5 L 237.0 368.5 L 238.0 368.5 L 239.0 368.5 L 240.0 368.5 L 241.0 368.5 L 242.0 368.5 L 243.0 368.5 L 243.5 369.0 L 244.0 369.5 L 245.0 369.5 L 246.0 369.5 L 247.0 369.5 L 248.0 369.5 L 249.0 369.5 L 250.0 369.5 L 251.0 369.5 L 252.0 369.5 L 252.5 369.0 L 253.0 368.5 L 254.0 368.5 L 255.0 368.5 L 256.0 368.5 L 257.0 368.5 L 258.0 368.5 L 258.5 368.0 L 259.0 367.5 L 260.0 367.5 L 261.0 367.5 L 262.0 367.5 L 262.5 367.0 L 263.0 366.5 L 264.0 366.5 L 265.0 366.5 L 266.0 366.5 L 267.0 366.5 L 267.5 366.0 L 268.0 365.5 L 269.0 365.5 L 270.0 365.5 L 271.0 365.5 L 271.5 365.0 L 272.0 364.5 L 273.0 364.5 L 274.0 364.5 L 275.0 364.5 L 275.5 364.0 L 276.0 363.5 L 277.0 363.5 L 278.0 363.5 L 279.0 363.5 L 279.5 363.0 L 280.0 362.5 L 281.0 362.5 L 282.0 362.5 L 282.5 362.0 L 283.0 361.5 L 284.0 361.5 L 284.5 361.0 L 285.0 360.5 L 286.0 360.5 L 287.0 360.5 L 288.0 360.5 L 288.5 360.0 L 289.0 359.5 L 290.0 359.5 L 291.0 359.5 L 291.5 359.0 L 292.0 358.5 L 293.0 358.5 L 294.0 358.5 L 294.5 358.0 L 295.0 357.5 L 296.0 357.5 L 296.5 357.0 L 297.0 356.5 L 298.0 356.5 L 299.0 356.5 L 299.5 356.0 L 300.0 355.5 L 301.0 355.5 L 301.5 355.0 L 302.0 354.5 L 303.0 354.5 L 304.0 354.5 L 305.0 354.5 L 305.5 354.0 L 306.0 353.5 L 307.0 353.5 L 308.0 353.5 L 308.5 353.0 L 309.0 352.5 L 310.0 352.5 L 310.5 352.0 L 311.0 351.5 L 312.0 351.5 L 313.0 351.5 L 313.5 351.0 L 314.0 350.5 L 315.0 350.5 L 316.0 350.5 L 316.5 350.0 L 317.0 349.5 L 318.0 349.5 L 318.5 349.0 L 319.0 348.5 L 320.0 348.5 L 321.0 348.5 L 322.0 348.5 L 322.5 348.0 L 323.0 347.5 L 324.0 347.5 L 324.5 347.0 L 325.0 346.5 L 326.0 346.5 L 327.0 346.5 L 327.5 346.0 L 328.0 345.5 L 329.0 345.5 L 330.0 345.5 L 330.5 345.0 L 331.0 344.5 L 332.0 344.5 L 332.5 344.0 L 333.0 343.5 L 334.0 343.5 L 335.0 343.5 L 335.5 343.0 L 336.0 342.5 L 337.0 342.5 L 337.5 342.0 L 338.0 341.5 L 339.0 341.5 L 339.5 341.0 L 340.0 340.5 L 341.0 340.5 L 341.5 340.0 L 342.0 339.5 L 343.0 339.5 L 344.0 339.5 L 344.5 339.0 L 345.0 338.5 L 346.0 338.5 L 346.5 338.0 L 347.0 337.5 L 348.0 337.5 L 348.5 337.0 L 349.0 336.5 L 350.0 336.5 L 350.5 336.0 L 351.0 335.5 L 352.0 335.5 L 352.5 335.0 L 353.0 334.5 L 354.0 334.5 L 355.0 334.5 L 355.5 334.0 L 356.0 333.5 L 357.0 333.5 L 357.5 333.0 L 358.0 332.5 L 359.0 332.5 L 359.5 332.0 L 360.0 331.5 L 361.0 331.5 L 362.0 331.5 L 362.5 331.0 L 363.0 330.5 L 364.0 330.5 L 364.5 330.0 L 365.0 329.5 L 366.0 329.5 L 366.5 329.0 L 367.0 328.5 L 368.0 328.5 L 369.0 328.5 L 369.5 328.0 L 370.0 327.5 L 371.0 327.5 L 371.5 327.0 L 372.0 326.5 L 373.0 326.5 L 373.5 326.0 L 374.0 325.5 L 375.0 325.5 L 376.0 325.5 L 376.5 325.0 L 377.0 324.5 L 378.0 324.5 L 378.5 324.0 L 379.0 323.5 L 380.0 323.5 L 380.5 323.0 L 381.0 322.5 L 382.0 322.5 L 382.5 322.0 L 383.0 321.5 L 384.0 321.5 L 384.5 321.0 L 385.0 320.5 L 386.0 320.5 L 387.0 320.5 L 387.5 320.0 L 388.0 319.5 L 388.5 319.0 L 389.0 318.5 L 390.0 318.5 L 391.0 318.5 L 391.5 318.0 L 392.0 317.5 L 393.0 317.5 L 393.5 317.0 L 394.0 316.5 L 395.0 316.5 L 395.5 316.0 L 396.0 315.5 L 397.0 315.5 L 397.5 315.0 L 398.0 314.5 L 399.0 314.5 L 399.5 314.0 L 400.0 313.5 L 401.0 313.5 L 402.0 313.5 L 402.5 313.0 L 403.0 312.5 L 404.0 312.5 L 404.5 312.0 L 405.0 311.5 L 406.0 311.5 L 407.0 311.5 L 407.5 311.0 L 408.0 310.5 L 408.5 310.0 L 409.0 309.5 L 410.0 309.5 L 410.5 309.0 L 411.0 308.5 L 412.0 308.5 L 413.0 308.5 L 413.5 308.0 L 414.0 307.5 L 415.0 307.5 L 415.5 307.0 L 416.0 306.5 L 417.0 306.5 L 417.5 306.0 L 418.0 305.5 L 419.0 305.5 L 419.5 305.0 L 420.0 304.5 L 421.0 304.5 L 421.5 304.0 L 422.0 303.5 L 423.0 303.5 L 424.0 303.5 L 424.5 303.0 L 425.0 302.5 L 426.0 302.5 L 426.5 302.0 L 427.0 301.5 L 428.0 301.5 L 428.5 301.0 L 429.0 300.5 L 430.0 300.5 L 431.0 300.5 L 431.5 300.0 L 432.0 299.5 L 433.0 299.5 L 433.5 299.0 L 434.0 298.5 L 435.0 298.5 L 435.5 298.0 L 436.0 297.5 L 437.0 297.5 L 437.5 297.0 L 438.0 296.5 L 439.0 296.5 L 440.0 296.5 L 441.0 296.5 L 441.5 297.0 L 442.0 297.5 L 442.5 298.0 L 442.5 299.0 L 442.5 300.0 L 442.5 301.0 L 442.0 301.5 L 441.5 302.0 L 441.5 303.0 L 441.5 304.0 L 441.5 305.0 L 441.0 305.5 L 440.5 306.0 L 440.5 307.0 L 440.5 308.0 L 440.5 309.0 L 440.0 309.5 L 439.5 310.0 L 439.5 311.0 L 439.5 312.0 L 439.5 313.0 L 439.0 313.5 L 438.5 314.0 L 438.5 315.0 L 438.0 315.5 L 437.5 316.0 L 437.5 317.0 L 437.5 318.0 L 437.0 318.5 L 436.5 319.0 L 436.5 320.0 L 436.5 321.0 L 436.0 321.5 L 435.5 322.0 L 435.5 323.0 L 435.5 324.0 L 435.0 324.5 L 434.5 325.0 L 434.5 326.0 L 434.5 327.0 L 434.0 327.5 L 433.5 328.0 L 433.5 329.0 L 433.5 330.0 L 433.0 330.5 L 432.5 331.0 L 432.5 332.0 L 432.0 332.5 L 431.5 333.0 L 431.5 334.0 L 431.5 335.0 L 431.0 335.5 L 430.5 336.0 L 430.5 337.0 L 430.0 337.5 L 429.5 338.0 L 429.5 339.0 L 429.0 339.5 L 428.5 340.0 L 428.5 341.0 L 428.0 341.5 L 427.5 342.0 L 427.5 343.0 L 427.0 343.5 L 426.5 344.0 L 426.5 345.0 L 426.0 345.5 L 425.5 346.0 L 425.5 347.0 L 425.0 347.5 L 424.5 348.0 L 424.5 349.0 L 424.0 349.5 L 423.5 350.0 L 423.5 351.0 L 423.0 351.5 L 422.5 352.0 L 422.5 353.0 L 422.0 353.5 L 421.5 354.0 L 421.5 355.0 L 421.0 355.5 L 420.5 356.0 L 420.5 357.0 L 420.0 357.5 L 419.5 358.0 L 419.5 359.0 L 419.0 359.5 L 418.5 360.0 L 418.0 360.5 L 417.5 361.0 L 417.5 362.0 L 417.0 362.5 L 416.5 363.0 L 416.5 364.0 L 416.0 364.5 L 415.5 365.0 L 415.0 365.5 L 414.5 366.0 L 414.5 367.0 L 414.0 367.5 L 413.5 368.0 L 413.0 368.5 L 412.5 369.0 L 412.5 370.0 L 412.0 370.5 L 411.5 371.0 L 411.0 371.5 L 410.5 372.0 L 410.5 373.0 L 410.0 373.5 L 409.5 374.0 L 409.0 374.5 L 408.5 375.0 L 408.0 375.5 L 407.5 376.0 L 407.5 377.0 L 407.0 377.5 L 406.5 378.0 L 406.0 378.5 L 405.5 379.0 L 405.5 380.0 L 405.0 380.5 L 404.5 381.0 L 404.0 381.5 L 403.5 382.0 L 403.0 382.5 L 402.5 383.0 L 402.5 384.0 L 402.0 384.5 L 401.5 385.0 L 401.0 385.5 L 400.5 386.0 L 400.0 386.5 L 399.5 387.0 L 399.5 388.0 L 399.0 388.5 L 398.5 389.0 L 398.0 389.5 L 397.5 390.0 L 397.0 390.5 L 396.5 391.0 L 396.0 391.5 L 395.5 392.0 L 395.0 392.5 L 394.5 393.0 L 394.0 393.5 L 393.5 394.0 L 393.0 394.5 L 392.5 395.0 L 392.0 395.5 L 391.5 396.0 L 391.0 396.5 L 390.5 397.0 L 390.5 398.0 L 390.0 398.5 L 389.5 399.0 L 389.0 399.5 L 388.5 400.0 L 388.0 400.5 L 387.5 401.0 L 387.0 401.5 L 386.5 402.0 L 386.0 402.5 L 385.5 403.0 L 385.0 403.5 L 384.5 404.0 L 384.0 404.5 L 383.5 405.0 L 383.0 405.5 L 382.5 406.0 L 382.0 406.5 L 381.5 407.0 L 381.0 407.5 L 380.5 408.0 L 380.0 408.5 L 379.5 409.0 L 379.0 409.5 L 378.5 410.0 L 378.0 410.5 L 377.0 410.5 L 376.5 411.0 L 376.0 411.5 L 375.5 412.0 L 375.0 412.5 L 374.5 413.0 L 374.0 413.5 L 373.5 414.0 L 373.0 414.5 L 372.5 415.0 L 372.0 415.5 L 371.0 415.5 L 370.5 416.0 L 370.0 416.5 L 369.5 417.0 L 369.0 417.5 L 368.5 418.0 L 368.0 418.5 L 367.5 419.0 L 367.0 419.5 L 366.0 419.5 L 365.5 420.0 L 365.0 420.5 L 364.5 421.0 L 364.0 421.5 L 363.5 422.0 L 363.0 422.5 L 362.5 423.0 L 362.0 423.5 L 361.0 423.5 L 360.5 424.0 L 360.0 424.5 L 359.5 425.0 L 359.0 425.5 L 358.0 425.5 L 357.5 426.0 L 357.0 426.5 L 356.5 427.0 L 356.0 427.5 L 355.0 427.5 L 354.5 428.0 L 354.0 428.5 L 353.5 429.0 L 353.0 429.5 L 352.0 429.5 L 351.5 430.0 L 351.0 430.5 L 350.5 431.0 L 350.0 431.5 L 349.0 431.5 L 348.0 431.5 L 347.5 432.0 L 347.0 432.5 L 346.5 433.0 L 346.0 433.5 L 345.0 433.5 L 344.0 433.5 L 343.0 433.5 L 342.0 433.5 L 341.5 434.0 L 341.0 434.5 L 340.0 434.5 L 339.0 434.5 L 338.0 434.5 L 337.5 435.0 L 337.0 435.5 L 336.0 435.5 L 335.0 435.5 L 334.0 435.5 L 333.0 435.5 L 332.0 435.5 L 331.0 435.5 L 330.5 436.0 L 330.0 436.5 L 329.0 436.5 L 328.0 436.5 L 327.0 436.5 L 326.0 436.5 L 325.0 436.5 L 324.0 436.5 L 323.0 436.5 L 322.0 436.5 L 321.5 437.0 L 321.0 437.5 L 320.0 437.5 L 319.0 437.5 L 318.0 437.5 L 317.0 437.5 L 316.5 438.0 L 316.0 438.5 Z";
  var COMPANION_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 505 494">
  <defs xmlns="http://www.w3.org/2000/svg"><linearGradient id="gradOuter" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#1F63F5" /><stop offset="100%" style="stop-color:#4F92FF" /></linearGradient><linearGradient id="gradInner" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#7DB4FF" /><stop offset="100%" style="stop-color:#5E9EFF" /></linearGradient></defs>
  <path fill="url(#gradOuter)" d="${PATH_OUTER}"/>
  <path fill="url(#gradInner)" d="${PATH_INNER}"/>
</svg>`;
  var COMPANION_LOGO_WHITE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 505 494">
  <path fill="#FFFFFF" d="${PATH_OUTER}"/>
  <path fill="#FFFFFF" d="${PATH_INNER}"/>
</svg>`;
  var COMPANION_LOGO_GRAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 505 494">
  <path fill="#808080" d="${PATH_OUTER}"/>
  <path fill="#808080" d="${PATH_INNER}"/>
</svg>`;
  var COMPANION_LOGO_DATA_URI = `data:image/svg+xml,${encodeURIComponent(COMPANION_LOGO_SVG)}`;

  // ../src/companion/finance-widget.ts
  var DEFAULT_CLASS_PREFIX2 = "ab-finance";
  var STORAGE_KEY2 = STORAGE_KEYS.FINANCE_WIDGET_STATE;
  var DEFAULT_STATE = {
    x: 24,
    y: 24,
    width: 360,
    height: 380,
    collapsed: true,
    hidden: false,
    chatCollapsed: true
  };
  var HIGHLIGHT_DURATION_MS = 2e3;
  var FinanceWidget = class extends CompanionWindow {
    constructor(controller, config = {}) {
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
      __publicField(this, "txContainerEl", null);
      __publicField(this, "cashRefreshEl", null);
      __publicField(this, "cashIndicatorEl", null);
      __publicField(this, "newTxIndicatorEl", null);
      __publicField(this, "shiftBtn", null);
      __publicField(this, "shiftDropdown", null);
      __publicField(this, "boundHeaderDblClick", null);
      /** Monotonic id of the latest user-triggered CASH refresh. */
      __publicField(this, "manualRefreshSeq", 0);
      /** Number of loading states observed; used to detect superseded refreshes. */
      __publicField(this, "loadingCount", 0);
      /** Date+shift key of the last successful loaded render. */
      __publicField(this, "lastLoadedKey", null);
      /** Transaction identities of the last successful loaded render (filtered). */
      __publicField(this, "lastLoadedIds", /* @__PURE__ */ new Set());
      /** Currently displayed transaction identity keys in order. */
      __publicField(this, "displayedTxIds", []);
      /** Map of identity → row DOM element for reuse. */
      __publicField(this, "txRowCache", /* @__PURE__ */ new Map());
      /** Previous shift for structural change detection. */
      __publicField(this, "prevShift", null);
      /** Previous waiting state for structural change detection. */
      __publicField(this, "prevIsWaiting", null);
      /** Previous filtered count for structural change detection. */
      __publicField(this, "prevFilteredCount", -1);
      /** Whether the first expand has occurred (for auto-refresh). */
      __publicField(this, "firstExpandDone", false);
      // -------------------------------------------------------------------------
      // State rendering
      // -------------------------------------------------------------------------
      __publicField(this, "onStateChange", (state) => {
        if (this.destroyed) return;
        if (isDevMode()) {
          diag("[FinanceWidget] onStateChange:", state.status, "destroyed:", this.destroyed);
        }
        this.render(state);
      });
      __publicField(this, "onShiftToggle", () => {
        if (this.destroyed || !this.shiftDropdown) return;
        const isOpen = this.shiftDropdown.classList.contains("open");
        if (isOpen) {
          this.shiftDropdown.classList.remove("open");
        } else {
          this.shiftDropdown.classList.add("open");
        }
      });
      __publicField(this, "onShiftSelect", (event) => {
        if (this.destroyed) return;
        const target = event.currentTarget;
        const shift = target.dataset.shift;
        if (!shift) return;
        if (this.shiftDropdown) {
          this.shiftDropdown.classList.remove("open");
        }
        this.controller.setShift(shift);
      });
      __publicField(this, "onHeaderDblClick", (event) => {
        if (this.destroyed) return;
        const target = event.target;
        if (!target) return;
        const classPrefix = this.classPrefix;
        const isInteractiveTarget = target.closest(`.${classPrefix}-cash-indicator`) !== null || target.closest(`.${classPrefix}-new-indicator`) !== null || target.closest(`.${classPrefix}-shift-btn`) !== null || target.closest(`.${classPrefix}-shift-dropdown`) !== null || target.closest(`.${classPrefix}-collapse-btn`) !== null || target.closest(`.${classPrefix}-close-btn`) !== null;
        if (isInteractiveTarget) return;
        this.toggleCollapse();
      });
      __publicField(this, "onHeaderRefreshClick", () => {
        if (isDevMode()) diag("[FinanceWidget] onHeaderRefreshClick()");
        if (this.destroyed) return;
        if (this.controller.isLoading) return;
        this.hideNewTxIndicator();
        const manualId = ++this.manualRefreshSeq;
        const prevKey = this.lastLoadedKey;
        const prevIds = new Set(this.lastLoadedIds);
        void this.controller.refresh().then(() => {
          if (this.destroyed || manualId !== this.manualRefreshSeq) return;
          if (manualGen !== this.loadingCount) return;
          const state = this.controller.getState();
          if (state.status !== "loaded") return;
          const key = this.snapshotKey(state);
          if (prevKey === null || key !== prevKey) return;
          const filtered = FinanceShift.filterByShiftSmart(state.data?.list ?? [], state.shift).filtered;
          const currentIds = new Set(filtered.map((tx) => txIdentity(tx)));
          const hasNew = [...currentIds].some((id) => !prevIds.has(id));
          if (hasNew) {
            this.showNewTxIndicator();
          } else {
            this.hideNewTxIndicator();
          }
        });
        const manualGen = this.loadingCount;
      });
      this.win = {
        ...this.win,
        collapsed: config.forceCollapsed ? true : this.win.chatCollapsed
      };
      if (isDevMode()) {
        diag("[FinanceWidget] constructor start");
      }
      this.controller = controller;
      this.unsubscribe = this.controller.subscribe(this.onStateChange);
      if (isDevMode()) {
        diag("[FinanceWidget] before initial render, state:", this.controller.getState().status);
      }
      this.render(this.controller.getState());
      if (isDevMode()) {
        diag("[FinanceWidget] after initial render, contentEl:", this.contentEl?.childElementCount, "isConnected:", this.contentEl?.isConnected);
      }
      if (!this.win.collapsed) {
        this.firstExpandDone = true;
        if (isDevMode()) diag("[FinanceWidget] restored expanded, triggering refresh");
        this.controller.refresh();
      } else if (isDevMode()) {
        diag("[FinanceWidget] constructor end, deferred refresh to first expand");
      }
    }
    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------
    /** Remove the widget from the DOM and unsubscribe from the controller. */
    destroy() {
      if (this.destroyed) return;
      this.unsubscribe();
      this.controller.cancelPending();
      if (this.boundHeaderDblClick && this.root) {
        const dragHandle = this.root.querySelector(`.${this.classPrefix}-header`);
        if (dragHandle) {
          dragHandle.removeEventListener("dblclick", this.boundHeaderDblClick);
        }
        this.boundHeaderDblClick = null;
      }
      this.txContainerEl = null;
      this.cashRefreshEl = null;
      this.cashIndicatorEl = null;
      this.newTxIndicatorEl = null;
      this.shiftBtn = null;
      this.shiftDropdown = null;
      this.txRowCache.clear();
      this.displayedTxIds = [];
      super.destroy();
    }
    /** Show the widget. */
    show() {
      super.show();
    }
    /** Hide the widget. */
    hide() {
      super.hide();
    }
    /**
     * Persist window state together with the current shift, keeping the
     * unified finance widget state (geometry + shift) under one storage key.
     * Guarded against the base-constructor window where the controller is
     * not yet assigned.
     */
    persistState() {
      const shift = this.controller?.getCurrentShift();
      if (shift) {
        this.win = { ...this.win, shift };
      }
      super.persistState();
    }
    /** Expand the widget and trigger initial refresh on first expand. */
    expand() {
      const wasCollapsed = this.win.collapsed;
      super.expand();
      if (wasCollapsed) {
        if (!this.firstExpandDone) {
          this.firstExpandDone = true;
          if (isDevMode()) diag("[FinanceWidget] first expand, triggering refresh");
          this.controller.refresh();
        } else {
          if (isDevMode()) diag("[FinanceWidget] re-expand, re-rendering current state");
          this.render(this.controller.getState());
        }
      }
    }
    /**
     * Apply the saved chat-route collapse preference to the live presentation.
     * On an expanded restore (SPA non-chat -> chat), triggers exactly one data
     * refresh. Route-forced collapse uses collapse()/expand() directly and
     * therefore never updates the saved preference.
     */
    applyChatPreference() {
      const wasCollapsed = this.win.collapsed;
      this.firstExpandDone = true;
      super.applyChatPreference();
      if (!this.win.collapsed && wasCollapsed) {
        if (isDevMode()) diag("[FinanceWidget] chat preference applied expanded, triggering refresh");
        this.controller.refresh();
      }
    }
    // -------------------------------------------------------------------------
    // Structural change detection
    // -------------------------------------------------------------------------
    /** Check if a full rebuild is required. */
    needsFullRebuild(shift, isWaiting, filteredCount) {
      if (this.prevShift !== shift) return true;
      if (this.prevIsWaiting !== isWaiting) return true;
      if (this.prevFilteredCount === -1) return true;
      if (this.prevFilteredCount === 0 && filteredCount > 0) return true;
      if (this.prevFilteredCount > 0 && filteredCount === 0) return true;
      return false;
    }
    recordStructuralState(shift, isWaiting, filteredCount) {
      this.prevShift = shift;
      this.prevIsWaiting = isWaiting;
      this.prevFilteredCount = filteredCount;
    }
    // -------------------------------------------------------------------------
    // Incremental transaction rendering
    // -------------------------------------------------------------------------
    /**
     * Rebuild the transaction container's children in correct order.
     * Reuses existing DOM nodes from cache. Highlights newly added rows.
     */
    updateTxRows(filtered) {
      if (!this.txContainerEl) return;
      const newIds = [];
      const newIdSet = /* @__PURE__ */ new Set();
      for (const tx of filtered) {
        const id = txIdentity(tx);
        newIds.push(id);
        if (!this.txRowCache.has(id)) {
          newIdSet.add(id);
          this.txRowCache.set(id, this.createTransactionRow(tx));
        }
      }
      const newIdLookup = new Set(newIds);
      for (const oldId of this.displayedTxIds) {
        if (!newIdLookup.has(oldId)) {
          this.txRowCache.delete(oldId);
        }
      }
      const fragment = document.createDocumentFragment();
      for (const id of newIds) {
        const row = this.txRowCache.get(id);
        if (row) {
          if (newIdSet.has(id)) {
            this.applyHighlight(row);
          }
          fragment.appendChild(row);
        }
      }
      const header = this.txContainerEl.querySelector(`.${this.classPrefix}-tx-header`);
      this.txContainerEl.innerHTML = "";
      if (header) {
        this.txContainerEl.appendChild(header);
      }
      this.txContainerEl.appendChild(fragment);
      this.displayedTxIds = newIds;
    }
    /** Apply a temporary highlight to a row. */
    applyHighlight(row) {
      row.classList.remove(`${this.classPrefix}-tx-new`);
      void row.offsetWidth;
      row.classList.add(`${this.classPrefix}-tx-new`);
      setTimeout(() => {
        row.classList.remove(`${this.classPrefix}-tx-new`);
      }, HIGHLIGHT_DURATION_MS);
    }
    render(state) {
      if (isDevMode()) {
        diag("[FinanceWidget] render() start, state:", state.status, "root:", !!this.root, "collapsed:", this.win.collapsed);
      }
      if (!this.root) {
        if (isDevMode()) {
          diag("[FinanceWidget] render() - no root, calling createRoot()");
        }
        this.createRoot();
      }
      this.updateCashRefreshIndicator(state.status);
      this.updateShiftButton(state.shift);
      this.updateNewTxIndicator(state);
      if (!this.win.collapsed) {
        if (isDevMode()) {
          diag("[FinanceWidget] render() - not collapsed, calling updateContent()");
        }
        this.updateContent(state);
      } else if (isDevMode()) {
        diag("[FinanceWidget] render() - WIDGET IS COLLAPSED, skipping updateContent");
      }
      if (isDevMode()) {
        diag("[FinanceWidget] render() end");
      }
    }
    // -------------------------------------------------------------------------
    // DOM creation
    // -------------------------------------------------------------------------
    createRoot() {
      if (isDevMode()) diag("[FinanceWidget] createRoot() start, saved:", this.win);
      const saved = this.win;
      const root = document.createElement("div");
      root.className = this.classPrefix;
      root.id = `${this.classPrefix}-widget`;
      root.style.left = saved.x + "px";
      root.style.top = saved.y + "px";
      root.style.bottom = "auto";
      root.style.right = "auto";
      if (saved.hidden) {
        if (isDevMode()) diag("[FinanceWidget] createRoot() - widget is HIDDEN");
        root.style.display = "none";
      }
      if (saved.collapsed) {
        if (isDevMode()) diag("[FinanceWidget] createRoot() - widget is COLLAPSED");
        root.classList.add(`${this.classPrefix}-collapsed`);
        root.style.width = saved.width + "px";
        root.style.height = "44px";
        root.style.minHeight = "44px";
        root.style.minWidth = saved.width + "px";
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
      const cashIndicator = document.createElement("button");
      cashIndicator.type = "button";
      cashIndicator.className = `${this.classPrefix}-cash-indicator`;
      cashIndicator.title = "Refresh";
      const cashIcon = document.createElement("span");
      cashIcon.className = `${this.classPrefix}-cash-icon`;
      cashIcon.textContent = "\u{1F4B0}";
      const cashLabel = document.createElement("span");
      cashLabel.className = `${this.classPrefix}-cash-label`;
      cashLabel.textContent = "CASH";
      const cashRefresh = document.createElement("span");
      cashRefresh.className = `${this.classPrefix}-cash-refresh`;
      cashRefresh.textContent = "\u27F3";
      this.cashRefreshEl = cashRefresh;
      cashIndicator.appendChild(cashIcon);
      cashIndicator.appendChild(cashLabel);
      cashIndicator.appendChild(cashRefresh);
      const newTxIndicator = document.createElement("span");
      newTxIndicator.className = `${this.classPrefix}-new-indicator`;
      newTxIndicator.title = "New transaction";
      newTxIndicator.setAttribute("aria-label", "New transaction");
      newTxIndicator.textContent = "!";
      this.newTxIndicatorEl = newTxIndicator;
      const actions = document.createElement("div");
      actions.className = `${this.classPrefix}-header-actions`;
      const headerSpacer = document.createElement("div");
      headerSpacer.className = `${this.classPrefix}-header-spacer`;
      const collapseBtn = document.createElement("button");
      collapseBtn.className = `${this.classPrefix}-btn ${this.classPrefix}-collapse-btn`;
      collapseBtn.title = "Collapse";
      collapseBtn.textContent = saved.collapsed ? "\u25B6" : "\u25BC";
      const closeBtn = document.createElement("button");
      closeBtn.className = `${this.classPrefix}-btn ${this.classPrefix}-close-btn`;
      closeBtn.title = "Close";
      closeBtn.textContent = "\u2715";
      actions.appendChild(collapseBtn);
      actions.appendChild(closeBtn);
      dragHandle.appendChild(title);
      dragHandle.appendChild(cashIndicator);
      dragHandle.appendChild(newTxIndicator);
      dragHandle.appendChild(headerSpacer);
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
      this.contentEl = content;
      this.collapseBtn = collapseBtn;
      this.closeBtn = closeBtn;
      this.cashIndicatorEl = cashIndicator;
      this.newTxIndicatorEl = newTxIndicator;
      cashIndicator.addEventListener("click", this.onHeaderRefreshClick);
      this.boundHeaderDblClick = this.onHeaderDblClick.bind(this);
      dragHandle.addEventListener("dblclick", this.boundHeaderDblClick);
      this.container.appendChild(root);
      this.initWindow(dragHandle, resizeHandle);
      if (isDevMode()) diag("[FinanceWidget] createRoot() end, contentEl:", !!this.contentEl, "root in DOM:", this.root.isConnected);
    }
    // -------------------------------------------------------------------------
    // State-based rendering
    // -------------------------------------------------------------------------
    updateCashRefreshIndicator(status) {
      if (!this.cashIndicatorEl || !this.cashRefreshEl) return;
      const isLoading = status === "loading";
      this.cashIndicatorEl.disabled = isLoading;
      this.cashRefreshEl.classList.toggle("spinning", isLoading);
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
    /** Build the shift selector (button + dropdown) used inside the body. */
    createShiftSelector() {
      const select = document.createElement("div");
      select.className = `${this.classPrefix}-shift-select`;
      const shiftBtn = document.createElement("button");
      shiftBtn.className = `${this.classPrefix}-shift-btn`;
      shiftBtn.title = "Shift";
      shiftBtn.addEventListener("click", this.onShiftToggle);
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
      this.shiftBtn = shiftBtn;
      this.shiftDropdown = shiftDropdown;
      select.appendChild(shiftBtn);
      select.appendChild(shiftDropdown);
      return select;
    }
    // -------------------------------------------------------------------------
    // New-transaction indicator
    // -------------------------------------------------------------------------
    /**
     * Snapshot key for a date+shift context. Indicator comparisons are scoped
     * to the exact selected date + shift; a change in either resets the
     * baseline and hides the indicator.
     */
    snapshotKey(state) {
      return `${state.from.getTime()}|${state.to.getTime()}|${state.shift}`;
    }
    /**
     * Evaluate the new-transaction indicator from a state change.
     *
     * Rules:
     * - Hidden by default, on initial load, on automatic refresh, and on
     *   date/shift change.
     * - The first successful load for a date+shift establishes the baseline
     *   (no indicator).
     * - A user-triggered CASH refresh compares the new filtered identity set
     *   against the previous successful snapshot for the same date+shift.
     * - Shows only when a new transaction identity appears; reordering existing
     *   transactions is not "new".
     * - Failed, cancelled, stale, or aborted refreshes never show it.
     */
    updateNewTxIndicator(state) {
      if (!this.newTxIndicatorEl) return;
      if (state.status === "loading") {
        this.loadingCount++;
        return;
      }
      const key = this.snapshotKey(state);
      if (this.lastLoadedKey !== null && key !== this.lastLoadedKey) {
        this.lastLoadedKey = key;
        this.lastLoadedIds = /* @__PURE__ */ new Set();
        this.hideNewTxIndicator();
      }
      if (state.status !== "loaded") return;
      const filtered = FinanceShift.filterByShiftSmart(state.data?.list ?? [], state.shift).filtered;
      const currentIds = new Set(filtered.map((tx) => txIdentity(tx)));
      if (this.lastLoadedKey === null) {
        this.lastLoadedKey = key;
        this.lastLoadedIds = currentIds;
        this.hideNewTxIndicator();
        return;
      }
      this.lastLoadedIds = currentIds;
    }
    showNewTxIndicator() {
      if (this.newTxIndicatorEl) {
        this.newTxIndicatorEl.classList.add("visible");
      }
    }
    hideNewTxIndicator() {
      if (this.newTxIndicatorEl) {
        this.newTxIndicatorEl.classList.remove("visible");
      }
    }
    updateContent(state) {
      if (isDevMode()) {
        diag("[FinanceWidget] updateContent() start, state:", state.status, "contentEl:", !!this.contentEl);
      }
      if (!this.contentEl) {
        if (isDevMode()) {
          diag("[FinanceWidget] updateContent() - NO contentEl!");
        }
        return;
      }
      switch (state.status) {
        case "idle":
          if (isDevMode()) diag("[FinanceWidget] updateContent() - rendering IDLE");
          this.renderIdle();
          break;
        case "loading":
          if (isDevMode()) diag("[FinanceWidget] updateContent() - rendering LOADING");
          if (this.displayedTxIds.length === 0 && !this.txContainerEl) {
            if (isDevMode()) diag("[FinanceWidget] updateContent() - initial load, showing loading");
            this.renderLoading();
          } else if (isDevMode()) {
            diag("[FinanceWidget] updateContent() - refresh, preserving content, displayedTxIds:", this.displayedTxIds.length, "txContainerEl:", !!this.txContainerEl);
          }
          break;
        case "loaded":
          if (isDevMode()) diag("[FinanceWidget] updateContent() - rendering LOADED, data:", !!state.data, "list length:", state.data?.list?.length);
          this.renderLoaded(state);
          break;
        case "error":
          if (isDevMode()) diag("[FinanceWidget] updateContent() - rendering ERROR:", state.error);
          this.renderError(state);
          break;
      }
      if (isDevMode()) {
        diag("[FinanceWidget] updateContent() end, contentEl children:", this.contentEl.childElementCount);
      }
    }
    renderIdle() {
      if (isDevMode()) diag("[FinanceWidget] renderIdle()");
      if (!this.contentEl) return;
      this.contentEl.innerHTML = "";
      this.resetTxState();
      const message = this.createMessage("Ready to load finance data.");
      this.contentEl.appendChild(message);
    }
    renderLoading() {
      if (isDevMode()) diag("[FinanceWidget] renderLoading()");
      if (!this.contentEl) return;
      this.contentEl.innerHTML = "";
      this.resetTxState();
      const message = this.createMessage("Loading\u2026");
      this.contentEl.appendChild(message);
    }
    renderLoaded(state) {
      if (isDevMode()) diag("[FinanceWidget] renderLoaded() start");
      if (!this.contentEl) return;
      const def = FinanceShift.getDefinition(state.shift);
      const allTransactions = state.data?.list ?? [];
      if (isDevMode()) diag("[FinanceWidget] renderLoaded() - allTransactions:", allTransactions.length);
      const { filtered, isWaiting } = FinanceShift.filterByShiftSmart(
        allTransactions,
        state.shift
      );
      if (isDevMode()) diag("[FinanceWidget] renderLoaded() - filtered:", filtered.length, "isWaiting:", isWaiting);
      const filteredSum = filtered.reduce((acc, tx) => acc + tx.sum, 0);
      const needsRebuild = this.needsFullRebuild(state.shift, isWaiting, filtered.length);
      if (isDevMode()) diag("[FinanceWidget] renderLoaded() - needsRebuild:", needsRebuild);
      if (needsRebuild) {
        if (isDevMode()) diag("[FinanceWidget] renderLoaded() - calling fullRebuild");
        this.fullRebuild(state.shift, isWaiting, filtered, filteredSum, def);
      } else {
        if (isDevMode()) diag("[FinanceWidget] renderLoaded() - calling incrementalUpdate");
        this.incrementalUpdate(filtered, filteredSum);
      }
      this.recordStructuralState(state.shift, isWaiting, filtered.length);
      if (isDevMode()) diag("[FinanceWidget] renderLoaded() end");
    }
    /** Full rebuild of the entire content area. */
    fullRebuild(shift, isWaiting, filtered, filteredSum, def) {
      if (isDevMode()) diag("[FinanceWidget] fullRebuild() start, isWaiting:", isWaiting, "filtered:", filtered.length);
      if (!this.contentEl) return;
      this.contentEl.innerHTML = "";
      this.resetTxState();
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
      shiftInfo.appendChild(row1);
      const select = this.createShiftSelector();
      shiftInfo.appendChild(select);
      const rowShiftTime = document.createElement("div");
      rowShiftTime.className = `${this.classPrefix}-shift-info-row`;
      const labelShift = document.createElement("span");
      labelShift.className = `${this.classPrefix}-label`;
      labelShift.textContent = "Shift:";
      const valueShift = document.createElement("span");
      valueShift.className = `${this.classPrefix}-value ${this.classPrefix}-shift-time-range`;
      valueShift.textContent = `${def.label} (${def.timeDisplay})`;
      rowShiftTime.appendChild(labelShift);
      rowShiftTime.appendChild(valueShift);
      shiftInfo.appendChild(rowShiftTime);
      this.updateShiftButton(shift);
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
      this.contentEl.appendChild(shiftInfo);
      this.contentEl.appendChild(divider1);
      this.contentEl.appendChild(creditsRow);
      if (isWaiting) {
        const divider2 = document.createElement("div");
        divider2.className = `${this.classPrefix}-divider`;
        this.contentEl.appendChild(divider2);
        const waitingMsg = this.createMessage(`Waiting for Night shift (${def.timeDisplay}).`);
        this.contentEl.appendChild(waitingMsg);
        if (isDevMode()) diag("[FinanceWidget] fullRebuild() - isWaiting, returning early");
        return;
      }
      if (filtered.length === 0) {
        const divider2 = document.createElement("div");
        divider2.className = `${this.classPrefix}-divider`;
        this.contentEl.appendChild(divider2);
        const empty = this.createMessage("No transactions for this shift.");
        this.contentEl.appendChild(empty);
      } else {
        const divider2 = document.createElement("div");
        divider2.className = `${this.classPrefix}-divider`;
        this.contentEl.appendChild(divider2);
        const txContainer = document.createElement("div");
        txContainer.className = `${this.classPrefix}-tx-container`;
        const headerRow = document.createElement("div");
        headerRow.className = `${this.classPrefix}-tx-header`;
        headerRow.appendChild(this.createTxHeaderCell("Time"));
        headerRow.appendChild(this.createTxHeaderCell("Operation"));
        headerRow.appendChild(this.createTxHeaderCell("Target ID"));
        headerRow.appendChild(this.createTxHeaderCell("Credits"));
        txContainer.appendChild(headerRow);
        const newIds = [];
        for (const tx of filtered) {
          const id = txIdentity(tx);
          const row = this.createTransactionRow(tx);
          this.txRowCache.set(id, row);
          txContainer.appendChild(row);
          newIds.push(id);
        }
        this.displayedTxIds = newIds;
        this.contentEl.appendChild(txContainer);
        this.txContainerEl = txContainer;
      }
      if (isDevMode()) diag("[FinanceWidget] fullRebuild() end, contentEl children:", this.contentEl.childElementCount);
    }
    /** Incremental update: reuse rows, preserve order, highlight new. */
    incrementalUpdate(filtered, filteredSum) {
      if (isDevMode()) diag("[FinanceWidget] incrementalUpdate() start, filtered:", filtered.length, "txContainerEl:", !!this.txContainerEl);
      this.updateCreditsValue(filteredSum);
      if (this.txContainerEl && filtered.length > 0) {
        if (isDevMode()) diag("[FinanceWidget] incrementalUpdate() - calling updateTxRows");
        this.updateTxRows(filtered);
      } else if (isDevMode()) {
        diag("[FinanceWidget] incrementalUpdate() - SKIPPED, txContainerEl:", !!this.txContainerEl, "filtered.length:", filtered.length);
      }
      if (isDevMode()) diag("[FinanceWidget] incrementalUpdate() end");
    }
    /** Update the credits value without rebuilding the entire section. */
    updateCreditsValue(sum) {
      if (!this.contentEl) return;
      const creditsValue = this.contentEl.querySelector(
        `.${this.classPrefix}-row .${this.classPrefix}-value.${this.classPrefix}-accent`
      );
      if (creditsValue) {
        creditsValue.textContent = sum.toLocaleString();
      }
    }
    renderError(state) {
      if (isDevMode()) diag("[FinanceWidget] renderError() start, error:", state.error);
      if (!this.contentEl) return;
      this.contentEl.innerHTML = "";
      this.resetTxState();
      const errorEl = document.createElement("div");
      errorEl.className = `${this.classPrefix}-error`;
      errorEl.textContent = state.error ?? "Unknown error";
      this.contentEl.appendChild(errorEl);
      if (isDevMode()) diag("[FinanceWidget] renderError() end");
    }
    /** Reset transaction rendering state. */
    resetTxState() {
      this.txContainerEl = null;
      this.displayedTxIds = [];
      this.txRowCache.clear();
      this.prevShift = null;
      this.prevIsWaiting = null;
      this.prevFilteredCount = -1;
    }
    // -------------------------------------------------------------------------
    // Transaction row
    // -------------------------------------------------------------------------
    createTransactionRow(tx) {
      const row = document.createElement("div");
      row.className = `${this.classPrefix}-tx-row`;
      const id = txIdentity(tx);
      row.dataset.txId = id;
      const timeStr = FinanceShift.formatTime(tx.date);
      row.appendChild(this.createTxCell(timeStr));
      row.appendChild(this.createTxCell(tx.operation, true));
      row.appendChild(this.createTxCell(String(tx.userID)));
      row.appendChild(this.createTxCell(tx.sum.toLocaleString(), false, true));
      row.addEventListener("click", () => {
        if (this.destroyed) return;
        this.controller.markTxViewed(id);
      });
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

  // ../src/companion/layering.ts
  var LAUNCHER_START = 2147483647;
  var TOAST_START = LAUNCHER_START - 100;
  var MODAL_START = TOAST_START - 100;
  var WIDGET_START = MODAL_START - 100;
  var Layer = /* @__PURE__ */ ((Layer2) => {
    Layer2[Layer2["WIDGET"] = WIDGET_START] = "WIDGET";
    Layer2[Layer2["MODAL"] = MODAL_START] = "MODAL";
    Layer2[Layer2["TOAST"] = TOAST_START] = "TOAST";
    Layer2[Layer2["LAUNCHER"] = LAUNCHER_START] = "LAUNCHER";
    return Layer2;
  })(Layer || {});
  function zIndex(layer, subLayer = 0 /* BASE */) {
    return layer + subLayer;
  }
  var Z = {
    widget: Layer.WIDGET,
    widgetDropdown: zIndex(Layer.WIDGET, 20 /* DROPDOWN */),
    widgetHeader: zIndex(Layer.WIDGET, 30 /* HEADER */),
    widgetResize: zIndex(Layer.WIDGET, 0 /* BASE */),
    modal: Layer.MODAL,
    modalContent: zIndex(Layer.MODAL, 10 /* CONTENT */),
    modalDropdown: zIndex(Layer.MODAL, 20 /* DROPDOWN */),
    toast: Layer.TOAST,
    launcher: Layer.LAUNCHER
  };

  // ../src/companion/finance-widget.css.ts
  var FINANCE_WIDGET_CSS = `
/* Widget root */
.ab-finance {
    position: fixed;
    top: 24px;
    left: 24px;
    width: 400px;
    height: 440px;
    min-width: 320px;
    min-height: 200px;
    max-width: 700px;
    max-height: 600px;
    background: #1F2235;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    z-index: ${Z.widget};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #E0E0E0;
    box-shadow: 0 8px 32px 0 rgba(0,0,0,0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    user-select: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* Container queries for responsive internal layout */
    container-type: inline-size;
    container-name: finance-widget;
}

/* Collapsed \u2014 JS sets explicit dimensions (height 44px, width = expanded width).
   CSS makes the header fill the collapsed bar exactly and centers its content,
   so title, CASH, and actions stay vertically aligned with the expanded layout. */
.ab-finance-collapsed .ab-finance-resize-handle {
    display: none;
}

.ab-finance-collapsed .ab-finance-header {
    border-bottom: none;
    border-radius: 10px;
    min-height: 0;
    height: 100%;
    box-sizing: border-box;
    padding: 0 12px;
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
    gap: clamp(4px, 1vw, 8px);
    padding: 8px 12px;
    cursor: grab;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.03);
    min-height: 36px;
    border-radius: 10px 10px 0 0;
    flex-shrink: 0;
    touch-action: none;
}

.ab-finance-header-title {
    font-size: 14px;
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
    flex-shrink: 0;
}

.ab-finance-header-actions button {
    background: none;
    border: none;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    font-size: 12px;
    flex-shrink: 0;
}

.ab-finance-header-actions button:hover {
    color: #E0E0E0;
    background: rgba(255,255,255,0.1);
}

@keyframes ab-finance-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* CASH indicator \u2014 doubles as the refresh control */
.ab-finance-cash-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(255, 215, 0, 0.08);
    border: 1px solid rgba(255, 215, 0, 0.15);
    cursor: pointer;
    flex-shrink: 0;
    font: inherit;
    color: inherit;
    line-height: 1;
}

.ab-finance-cash-indicator:hover {
    background: rgba(255, 215, 0, 0.16);
    border-color: rgba(255, 215, 0, 0.3);
}

.ab-finance-cash-indicator:disabled {
    opacity: 0.5;
    cursor: default;
    background: rgba(255, 215, 0, 0.08);
    border-color: rgba(255, 215, 0, 0.15);
}

.ab-finance-cash-icon {
    font-size: 14px;
    line-height: 1;
}

.ab-finance-cash-label {
    font-size: 11px;
    font-weight: 700;
    color: #FFD700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
}

.ab-finance-cash-refresh {
    font-size: 12px;
    line-height: 1;
    color: rgba(255, 215, 0, 0.6);
    transition: color 0.15s ease;
}

.ab-finance-cash-indicator:hover .ab-finance-cash-refresh {
    color: #FFD700;
}

.ab-finance-cash-refresh.spinning {
    animation: ab-finance-spin 0.6s linear infinite;
}

/* New-transaction indicator \u2014 red circle with "!", hidden by default.
   Uses visibility (not display:none) so it never shifts header layout. */
.ab-finance-new-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    border-radius: 50%;
    background: #EF5350;
    color: #FFFFFF;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    visibility: hidden;
    cursor: default;
}

.ab-finance-new-indicator.visible {
    visibility: visible;
}

/* Flexible empty drag surface \u2014 consumes remaining header width. */
.ab-finance-header-spacer {
    flex: 1 1 auto;
    min-width: 0;
    align-self: stretch;
}

/* Shift selector \u2014 lives in the expanded body, near the date/shift info */
.ab-finance-shift-select {
    position: relative;
    align-self: flex-start;
}

.ab-finance-shift-btn {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.15);
    color: #E0E0E0;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 6px;
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
    left: 0;
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

.ab-finance-shift-time-range {
    font-weight: 500;
    color: rgba(255,255,255,0.7);
}

/* Collapse button */
.ab-finance-collapse-btn {
    font-size: 11px !important;
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
    gap: 4px;
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
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

.ab-finance-value {
    font-size: 14px;
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
    font-size: 11px;
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
    font-size: 11px;
    padding: 6px 0;
}

/* Error */
.ab-finance-error {
    text-align: center;
    color: #EF5350;
    font-size: 11px;
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
    font-size: 10px;
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
    font-size: 11px;
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

/* New transaction highlight */
.ab-finance-tx-new {
    animation: ab-finance-highlight 2s ease-out;
}

@keyframes ab-finance-highlight {
    0% { background: rgba(89,175,255,0.25); }
    100% { background: transparent; }
}

/* ============================================================================
   RESPONSIVE LAYOUT \u2014 Container Queries & clamp()
   Finance content adapts to widget width/height without transform:scale.
   ============================================================================ */

/* Base responsive sizing using clamp() \u2014 scales smoothly within bounds */
.ab-finance-header {
    padding: clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 12px);
    min-height: clamp(32px, 8vh, 36px);
}

.ab-finance-header-title {
    font-size: clamp(12px, 2.5vw, 14px);
    gap: clamp(4px, 1vw, 6px);
}

.ab-finance-logo {
    width: clamp(14px, 3vw, 16px);
    height: clamp(14px, 3vw, 16px);
}

.ab-finance-body {
    padding: clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px);
    gap: clamp(3px, 1vw, 6px);
}

.ab-finance-label {
    font-size: clamp(10px, 2vw, 12px);
}

.ab-finance-value {
    font-size: clamp(12px, 2.5vw, 14px);
}

.ab-finance-tx-header,
.ab-finance-tx-row {
    grid-template-columns: clamp(40px, 10vw, 50px) 1fr 1fr clamp(50px, 12vw, 60px);
    gap: clamp(3px, 1vw, 4px);
    font-size: clamp(9px, 1.8vw, 11px);
}

.ab-finance-btn {
    font-size: clamp(10px, 2vw, 12px);
    padding: clamp(3px, 0.8vw, 5px) clamp(4px, 1vw, 6px);
}

.ab-finance-cash-indicator {
    padding: clamp(1px, 0.5vw, 2px) clamp(6px, 1.5vw, 8px);
}

.ab-finance-cash-label {
    font-size: clamp(10px, 2vw, 12px);
}

.ab-finance-cash-icon {
    font-size: clamp(12px, 2.5vw, 14px);
}

.ab-finance-shift-info {
    gap: clamp(2px, 0.8vw, 4px);
}

.ab-finance-shift-info-row {
    font-size: clamp(10px, 2vw, 12px);
}

.ab-finance-collapsed .ab-finance-header {
    padding: clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 12px);
}

/* Container query: narrow widget \u2014 compress layout */
@container finance-widget (max-width: 340px) {
    .ab-finance-body {
        padding: 6px 8px;
        gap: 3px;
    }
    .ab-finance-tx-header,
    .ab-finance-tx-row {
        grid-template-columns: 40px 1fr 1fr 50px;
        gap: 3px;
        font-size: 9px;
    }
    .ab-finance-shift-info-row {
        font-size: 10px;
    }
    .ab-finance-cash-indicator {
        padding: 1px 6px;
    }
    .ab-finance-cash-label {
        font-size: 10px;
    }
}

/* Container query: medium widget \u2014 default layout */
@container finance-widget (min-width: 341px) and (max-width: 480px) {
    .ab-finance-body {
        padding: 8px 10px;
        gap: 4px;
    }
    .ab-finance-tx-header,
    .ab-finance-tx-row {
        grid-template-columns: 50px 1fr 1fr 60px;
        gap: 4px;
        font-size: 10px;
    }
}

/* Container query: wide widget \u2014 expanded columns & typography */
@container finance-widget (min-width: 481px) {
    .ab-finance-body {
        padding: 10px 14px;
        gap: 6px;
    }
    .ab-finance-tx-header,
    .ab-finance-tx-row {
        grid-template-columns: 60px 1fr 1fr 70px;
        gap: 6px;
        font-size: 11px;
    }
    .ab-finance-label {
        font-size: 11px;
    }
    .ab-finance-value {
        font-size: 13px;
    }
    .ab-finance-shift-info-row {
        font-size: 11px;
    }
}

/* Container query: tall widget \u2014 more vertical space for transactions */
@container finance-widget (min-height: 400px) {
    .ab-finance-body {
        flex: 1;
        overflow-y: auto;
    }
    .ab-finance-tx-container {
        max-height: calc(100% - 60px);
        overflow-y: auto;
    }
}

/* Legacy media queries as fallback for browsers without container query support */
@media (max-width: 320px) {
    .ab-finance {
        min-width: 240px;
    }
    .ab-finance-header {
        padding: 6px 10px;
        min-height: 32px;
    }
    .ab-finance-header-title {
        font-size: 12px;
        gap: 4px;
    }
    .ab-finance-logo {
        width: 14px;
        height: 14px;
    }
    .ab-finance-body {
        padding: 6px 8px;
        gap: 3px;
    }
    .ab-finance-label {
        font-size: 10px;
    }
    .ab-finance-value {
        font-size: 12px;
    }
    .ab-finance-tx-header,
    .ab-finance-tx-row {
        grid-template-columns: 40px 1fr 1fr 50px;
        gap: 3px;
        font-size: 9px;
    }
    .ab-finance-btn {
        font-size: 10px;
        padding: 3px 4px;
    }
    .ab-finance-cash-indicator {
        padding: 1px 6px;
    }
    .ab-finance-cash-label {
        font-size: 10px;
    }
    .ab-finance-cash-icon {
        font-size: 12px;
    }
}

@media (min-width: 500px) {
    .ab-finance-body {
        padding: 10px 14px;
        gap: 6px;
    }
    .ab-finance-tx-header,
    .ab-finance-tx-row {
        grid-template-columns: 60px 1fr 1fr 70px;
        gap: 6px;
    }
}
`;

  // ../src/companion/crm-service.ts
  var CRM_STORAGE_PREFIX = "chat-sender-";
  var DELAY_PROPERTIES = ["intervalSeconds", "delay", "interval", "timeout", "seconds"];
  var DEFAULT_DELAY = 65;
  var MAX_WAIT_MS = 5e3;
  var POLL_INTERVAL_MS = 250;
  var REQUIRED_STOP_TICKS = 4;
  var CrmService = class _CrmService {
    /** Find the first chat-sender-* key in localStorage. */
    static findProfileKey() {
      try {
        const keys = Object.keys(localStorage);
        return keys.find((k) => k.startsWith(CRM_STORAGE_PREFIX) && k !== CRM_STORAGE_PREFIX && !k.includes("backup")) ?? null;
      } catch {
        return null;
      }
    }
    /** Read and parse a CRM profile from localStorage. */
    static readProfile(key) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }
    /** Write a CRM profile to localStorage. */
    static writeProfile(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
      }
    }
    /** Validate that the data has the expected CRM profile structure. */
    static validateProfile(data) {
      if (!data || typeof data !== "object" || Array.isArray(data)) return false;
      return "status" in data && "chainProgress" in data;
    }
    // -------------------------------------------------------------------------
    // Business logic — restored from b44e683:440-510
    // -------------------------------------------------------------------------
    /**
     * Reset IceBreaker progress.
     * Filters chainProgress to remove private channel entries,
     * cleans sended list, clears delivered, sets status = "stopped".
     */
    static resetIceBreaker(data) {
      const chain = data.chainProgress || {};
      const privateIds = /* @__PURE__ */ new Set();
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
        data.sended = data.sended.split(";").filter((id) => id && !privateIds.has(id)).join(";");
      }
      if ("delivered" in data) {
        data.delivered = "";
      }
      data.status = "stopped";
      return true;
    }
    /**
     * Start a new shift.
     * Clears ALL chainProgress, sended, delivered for both IB and BR.
     * Sets status = "stopped".
     */
    static newShift(data) {
      data.chainProgress = {};
      data.sended = "";
      data.delivered = "";
      data.status = "stopped";
      if (data.broadcast && typeof data.broadcast === "object") {
        data.broadcast.chainProgress = {};
        data.broadcast.sended = "";
        data.broadcast.status = "stopped";
      }
      return true;
    }
    /**
     * Apply delay values to message entries.
     * Sets intervalSeconds on the first entry to 0, others to the delay value.
     */
    static applyDelays(data, privDelay, broadDelay) {
      _CrmService.applyPropertyUpdates(data.messages, privDelay);
      if (data.broadcast && data.broadcast.messages) {
        _CrmService.applyPropertyUpdates(data.broadcast.messages, broadDelay);
      }
      return true;
    }
    /**
     * Read current delay values from profile data.
     * Skips first message (set to 0 by applyDelays) and returns first non-zero delay.
     */
    static readDelays(data) {
      const detectDelay = (messages) => {
        if (!messages || typeof messages !== "object") return DEFAULT_DELAY;
        const items = Object.values(messages);
        if (items.length === 0) return DEFAULT_DELAY;
        const first = items[0];
        if (!first || typeof first !== "object") return DEFAULT_DELAY;
        const property = DELAY_PROPERTIES.find((p) => p in first);
        if (!property) return DEFAULT_DELAY;
        for (let i = 1; i < items.length; i++) {
          const item = items[i];
          if (item && typeof item === "object") {
            const value = item[property];
            if (typeof value === "number" && value > 0) return value;
          }
        }
        const firstValue = first[property];
        if (typeof firstValue === "number" && firstValue > 0) return firstValue;
        return DEFAULT_DELAY;
      };
      return {
        priv: detectDelay(data.messages),
        broad: detectDelay(data.broadcast?.messages)
      };
    }
    /** Check if IB or BR engines are active. */
    static isEngineActive(data) {
      const ibStatus = _CrmService.getModuleStatus(data, "icebreaker");
      const brStatus = _CrmService.getModuleStatus(data, "broadcast");
      return _CrmService.isStatusActive(ibStatus) || _CrmService.isStatusActive(brStatus);
    }
    // -------------------------------------------------------------------------
    // Page interaction — restored from b44e683:345-377
    // -------------------------------------------------------------------------
    /** Check if the sender is stopped by inspecting DOM buttons. */
    static isSenderStopped() {
      const startBtn = _CrmService.findButton("start");
      const stopBtn = _CrmService.findButton("stop");
      const startExists = !!startBtn;
      const stopDisabled = !!(stopBtn && (stopBtn.disabled || stopBtn.getAttribute("disabled") !== null || stopBtn.classList.contains("disabled")));
      const stopDisappeared = !stopBtn;
      return startExists || stopDisabled || stopDisappeared;
    }
    /** Click the stop button and wait for sender to stop. Returns true if stopped. */
    static async stopSenderSafely() {
      const stopBtn = _CrmService.findButton("stop");
      if (!stopBtn) return true;
      if (stopBtn.disabled || stopBtn.getAttribute("disabled") !== null) return true;
      try {
        stopBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        stopBtn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        stopBtn.click();
      } catch {
        return false;
      }
      const startLimit = Date.now();
      let checkTicks = 0;
      while (Date.now() - startLimit < MAX_WAIT_MS) {
        if (_CrmService.isSenderStopped()) {
          checkTicks++;
          if (checkTicks >= REQUIRED_STOP_TICKS) return true;
        } else {
          checkTicks = 0;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      return false;
    }
    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------
    static getModuleStatus(data, moduleType) {
      if (!data) return "Unknown";
      const statusRaw = moduleType === "broadcast" ? data.broadcast?.status : data.status;
      if (!statusRaw) return "Unknown";
      const s = statusRaw.toString().toLowerCase();
      if (s === "stopped") return "Stopped";
      if (s === "progress") return "Progress";
      if (s === "running") return "Running";
      if (s === "paused") return "Paused";
      return "Unknown";
    }
    static isStatusActive(status) {
      return status === "Running" || status === "Progress" || status === "Paused";
    }
    static applyPropertyUpdates(messages, delayValue) {
      if (!messages || typeof messages !== "object") return;
      const property = _CrmService.detectDelayProperty(messages);
      if (!property) return;
      const items = Object.values(messages);
      items.forEach((item, index) => {
        if (item && typeof item === "object") {
          item[property] = index === 0 ? 0 : delayValue;
        }
      });
    }
    static findButton(targetId) {
      const lowerTarget = targetId.toLowerCase();
      try {
        const elements = Array.from(document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']"));
        for (const el of elements) {
          const labelText = (el.textContent || el.value || el.innerText || el.getAttribute("aria-label") || "").trim().toLowerCase();
          if (labelText === lowerTarget) {
            return el;
          }
        }
      } catch {
      }
      return null;
    }
    /**
     * Detect the text property name from existing messages.
     * Returns "text" by default if not found.
     */
    static detectTextProperty(messages) {
      if (!messages || typeof messages !== "object") return "text";
      const items = Object.values(messages);
      if (items.length === 0) return "text";
      const first = items[0];
      if (first && typeof first === "object") {
        for (const key in first) {
          if (typeof first[key] === "string" && key !== "intervalSeconds" && key !== "delay" && key !== "interval" && key !== "timeout" && key !== "seconds") {
            return key;
          }
        }
      }
      return "text";
    }
    /**
     * Detect the delay property name from existing messages.
     * Uses DELAY_PROPERTIES constant for known delay property names.
     */
    static detectDelayProperty(messages) {
      if (!messages || typeof messages !== "object") return null;
      const items = Object.values(messages);
      if (items.length === 0) return null;
      const first = items[0];
      if (first && typeof first === "object") {
        const match = DELAY_PROPERTIES.find((p) => p in first);
        if (match) return match;
      }
      return null;
    }
    /**
     * Normalize raw textarea lines into an ordered, deduplicated snippet list.
     * Pure function: trims each line, drops empty lines, keeps the first
     * occurrence of duplicated text (case-sensitive compare), and counts the
     * duplicates that were skipped. Performs no storage, profile, history,
     * or UI access.
     */
    static normalizeSnippets(lines) {
      const seen = /* @__PURE__ */ new Set();
      const unique = [];
      let duplicatesSkipped = 0;
      let linesEntered = 0;
      for (const raw of lines) {
        const trimmed = String(raw).trim();
        if (trimmed.length === 0) continue;
        linesEntered++;
        if (seen.has(trimmed)) {
          duplicatesSkipped++;
        } else {
          seen.add(trimmed);
          unique.push(trimmed);
        }
      }
      return { linesEntered, unique, duplicatesSkipped };
    }
    /**
     * Import snippets into a profile (IceBreaker or Broadcast) using
     * deterministic replacement semantics.
     *
     * The pasted snippet list is treated as the authoritative, ordered
     * message collection. The target collection is rebuilt from scratch with
     * sequential keys "1".."N" and the canonical { text, intervalSeconds }
     * message schema, preserving the currently configured target delay.
     *
     * Flow: fresh profile read -> count current target messages -> optional
     * confirmation gate -> re-read profile after confirmation -> delay
     * detection -> sequential rebuild -> canonical no-change compare -> one
     * atomic write -> read-back verification -> rollback on failure.
     *
     * History is recorded through a static import of addImportHistory and is
     * deterministic for success / no-change / failed outcomes. Cancelled
     * operations record nothing and never touch storage.
     */
    static async importSnippetsToProfile(target, snippets, options = {}) {
      const targetName = target === "icebreaker" ? "IceBreaker" : "Broadcast";
      const { linesEntered, unique, duplicatesSkipped } = _CrmService.normalizeSnippets(snippets);
      let resolved = null;
      const base = (overrides) => ({
        outcome: "failure",
        targetName,
        linesEntered,
        uniqueSnippets: unique.length,
        previousMessageCount: 0,
        finalMessageCount: 0,
        duplicatesSkipped,
        message: "",
        ...resolved ? { profileId: resolved.profileId, storageKey: resolved.storageKey } : {},
        ...overrides
      });
      if (unique.length === 0) {
        return base({ message: "No valid snippets entered. Existing messages were not changed." });
      }
      if (options.resolveProfile) {
        resolved = options.resolveProfile();
      } else {
        const key2 = _CrmService.findProfileKey();
        resolved = key2 ? { profileId: key2.replace(CRM_STORAGE_PREFIX, ""), storageKey: key2 } : null;
      }
      if (!resolved) {
        return base({
          message: options.resolveProfile ? "Unable to determine the active GoldenBride profile. No data was changed." : "No CRM profile found."
        });
      }
      const key = resolved.storageKey;
      const profileId = resolved.profileId;
      const initial = _CrmService.readProfile(key);
      if (!initial || !_CrmService.validateProfile(initial)) {
        return base({ message: "Invalid profile structure." });
      }
      const initialMessages = _CrmService.getTargetMessages(initial, target);
      if (initialMessages === void 0) {
        return base({ message: "Target collection not found in profile." });
      }
      const previousMessageCount = _CrmService.collectionCount(initialMessages);
      if (previousMessageCount > 0 && options.confirmReplace) {
        const confirmed = await options.confirmReplace(
          `${targetName} profile: ${profileId}

This profile currently has ${previousMessageCount} message(s).
Replacing them will remove ${previousMessageCount} existing message(s) and rebuild the list from your snippets.`
        );
        if (!confirmed) {
          return base({
            outcome: "cancelled",
            previousMessageCount,
            finalMessageCount: previousMessageCount,
            message: "Import cancelled. Existing messages were not changed."
          });
        }
      }
      if (options.resolveProfile) {
        const revalidated = options.resolveProfile();
        if (!revalidated) {
          return base({
            previousMessageCount,
            finalMessageCount: previousMessageCount,
            message: "The active GoldenBride profile could no longer be determined. No data was changed."
          });
        }
        if (revalidated.storageKey !== key) {
          return base({
            previousMessageCount,
            finalMessageCount: previousMessageCount,
            message: `The active GoldenBride profile changed from ${profileId} to ${revalidated.profileId}. No data was changed.`
          });
        }
      }
      const data = _CrmService.readProfile(key);
      if (!data || !_CrmService.validateProfile(data)) {
        return base({ message: "Invalid profile structure." });
      }
      const messages = _CrmService.getTargetMessages(data, target);
      if (messages === void 0) {
        return base({ message: "Target collection not found in profile." });
      }
      const delayValue = target === "icebreaker" ? _CrmService.readDelays(data).priv : _CrmService.readDelays(data).broad;
      const rebuilt = _CrmService.buildReplacementMessages(messages, unique, delayValue);
      if (_CrmService.messagesEquivalent(messages, rebuilt)) {
        _CrmService.recordImportHistory(profileId, key, {
          result: "no-change",
          target,
          linesEntered,
          uniqueSnippets: unique.length,
          previousMessageCount,
          finalMessageCount: previousMessageCount,
          duplicatesSkipped
        });
        return base({
          outcome: "no-change",
          previousMessageCount,
          finalMessageCount: previousMessageCount,
          message: "No changes applied \u2014 the target list already matches the entered snippets."
        });
      }
      const originalCollection = _CrmService.deepCopyCollection(messages);
      const originalSnapshot = _CrmService.canonicalSnapshot(messages);
      _CrmService.replaceTargetMessages(data, target, rebuilt);
      _CrmService.writeProfile(key, data);
      const verified = _CrmService.verifyReplacement(_CrmService.readProfile(key), target, rebuilt);
      if (!verified) {
        const rollbackRestored = _CrmService.rollbackTargetCollection(key, target, originalCollection, originalSnapshot);
        _CrmService.recordImportHistory(profileId, key, {
          result: "failed",
          target,
          linesEntered,
          uniqueSnippets: unique.length,
          previousMessageCount,
          finalMessageCount: 0,
          duplicatesSkipped
        });
        const message = rollbackRestored ? "Storage write verification failed. The original messages were restored." : "Storage write verification failed AND the original messages could not be restored. Manual recovery is required.";
        return base({ message });
      }
      const finalMessageCount = _CrmService.collectionCount(rebuilt);
      _CrmService.recordImportHistory(profileId, key, {
        result: "success",
        target,
        linesEntered,
        uniqueSnippets: unique.length,
        previousMessageCount,
        finalMessageCount,
        duplicatesSkipped
      });
      return base({
        outcome: "success",
        previousMessageCount,
        finalMessageCount,
        message: `${targetName} snippets updated for profile ${profileId}.

Lines entered: ${linesEntered}
Unique snippets: ${unique.length}
Messages replaced: ${previousMessageCount}
Messages created: ${finalMessageCount}
Duplicate lines skipped: ${duplicatesSkipped}
Final message count: ${finalMessageCount}`
      });
    }
    /** Resolve the target messages collection, or undefined when the target container is missing. */
    static getTargetMessages(data, target) {
      if (target === "icebreaker") {
        const messages2 = data.messages;
        return _CrmService.isMessageCollection(messages2) ? messages2 : void 0;
      }
      const broadcast = data.broadcast;
      if (!broadcast || typeof broadcast !== "object" || Array.isArray(broadcast)) return void 0;
      const messages = broadcast.messages;
      return _CrmService.isMessageCollection(messages) ? messages : void 0;
    }
    /** True for supported message collection containers: a non-null object or an array. */
    static isMessageCollection(value) {
      return !!value && typeof value === "object";
    }
    /** Count the entries in a message collection: array length or object key count. */
    static collectionCount(messages) {
      return Array.isArray(messages) ? messages.length : Object.keys(messages).length;
    }
    /** Replace the target messages collection with the rebuilt collection. */
    static replaceTargetMessages(data, target, rebuilt) {
      if (target === "icebreaker") {
        data.messages = rebuilt;
      } else {
        data.broadcast.messages = rebuilt;
      }
    }
    /**
     * Build the replacement collection preserving the source shape: a keyed
     * object for object sources (sequential keys "1".."N") and a dense array
     * for array sources (index 0 = Message 1). Canonical { text, intervalSeconds }
     * schema, first message delay 0, later messages use the detected target
     * delay value. No runtime/progress fields copied.
     */
    static buildReplacementMessages(messages, snippets, delayValue) {
      const textProp = _CrmService.detectTextProperty(messages);
      const delayProp = _CrmService.detectDelayProperty(messages) ?? "intervalSeconds";
      const item = (snippet, index) => ({
        [textProp]: snippet,
        [delayProp]: index === 0 ? 0 : delayValue
      });
      if (Array.isArray(messages)) {
        return snippets.map((snippet, index) => item(snippet, index));
      }
      const rebuilt = {};
      snippets.forEach((snippet, index) => {
        rebuilt[String(index + 1)] = item(snippet, index);
      });
      return rebuilt;
    }
    /**
     * Canonical snapshot for equivalence and verification: the collection shape
     * discriminator, the canonical property names, and the ordered text/delay
     * values. Compares only shape/order/text/delay/canonical property names —
     * never identity, insertion order, or runtime fields.
     */
    static canonicalSnapshot(messages) {
      const textProp = _CrmService.detectTextProperty(messages);
      const delayProp = _CrmService.detectDelayProperty(messages) ?? "intervalSeconds";
      const entries = Array.isArray(messages) ? messages : Object.keys(messages).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).map((key) => messages[key]);
      return {
        shape: Array.isArray(messages) ? "array" : "object",
        textProperty: textProp,
        delayProperty: delayProp,
        items: entries.map((item) => {
          if (!item || typeof item !== "object") return { text: void 0, delay: void 0 };
          return { text: item[textProp], delay: item[delayProp] };
        })
      };
    }
    /** True when both collections carry the same shape, canonical property names, ordered text, and delay values. */
    static messagesEquivalent(a, b) {
      return JSON.stringify(_CrmService.canonicalSnapshot(a)) === JSON.stringify(_CrmService.canonicalSnapshot(b));
    }
    /** Immutable deep copy for rollback. JSON round-trip: plain data only, functions and symbols are dropped. */
    static deepCopyCollection(messages) {
      return JSON.parse(JSON.stringify(messages));
    }
    /** Read the persisted profile back and confirm the target collection matches the expected rebuilt collection. */
    static verifyReplacement(saved, target, expected) {
      if (!saved || !_CrmService.validateProfile(saved)) return false;
      const messages = _CrmService.getTargetMessages(saved, target);
      if (messages === void 0) return false;
      return _CrmService.messagesEquivalent(messages, expected);
    }
    /**
     * Restore the original target collection after a failed verification.
     * Returns true only when the restore is confirmed: the target resolves, the
     * shape matches the original, and the canonical snapshot equals the original.
     */
    static rollbackTargetCollection(key, target, originalCollection, originalSnapshot) {
      const data = _CrmService.readProfile(key);
      if (!data || !_CrmService.validateProfile(data)) return false;
      if (target === "icebreaker") {
        data.messages = originalCollection;
      } else {
        const broadcast = data.broadcast;
        if (!broadcast || typeof broadcast !== "object" || Array.isArray(broadcast)) return false;
        broadcast.messages = originalCollection;
      }
      _CrmService.writeProfile(key, data);
      const saved = _CrmService.readProfile(key);
      const messages = saved ? _CrmService.getTargetMessages(saved, target) : void 0;
      if (messages === void 0) return false;
      return JSON.stringify(_CrmService.canonicalSnapshot(messages)) === JSON.stringify(originalSnapshot);
    }
    /** Record an import history entry through the static dev import. Best-effort, never throws. */
    static recordImportHistory(profileId, storageKey, entry) {
      try {
        addImportHistory({
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          profileKey: profileId,
          storageKey,
          importedCount: entry.result === "success" ? entry.finalMessageCount ?? 0 : 0,
          ...entry
        });
      } catch {
      }
    }
  };

  // ../src/companion/profile-resolver.ts
  var CRM_STORAGE_PREFIX2 = "chat-sender-";
  var PROFILE_KEY_RE = /^chat-sender-\d+$/;
  var PROFILE_ID_SOURCE = "\\d{1,20}";
  var PROFILE_ID_RE = new RegExp(`^${PROFILE_ID_SOURCE}$`);
  var SIDEBAR_CONTAINER_SELECTOR = ".account-wrap-new";
  var SIDEBAR_ID_SELECTOR = ".total-new a span";
  var HASH_LADY_PARAM = "favoriteForLadyId";
  function extractProfileIdFromHash(href) {
    if (typeof href !== "string" || href.length === 0) return null;
    const hashIndex = href.indexOf("#");
    if (hashIndex < 0) return null;
    const fragment = href.slice(hashIndex + 1);
    const m = new RegExp(`(?:^|[;&])${HASH_LADY_PARAM}=(${PROFILE_ID_SOURCE})(?:[;&]|$)`).exec(fragment);
    return m ? m[1] : null;
  }
  function extractProfileIdFromUrl(href) {
    if (typeof href !== "string" || href.length === 0) return null;
    const m = /[?&](?:id|profile|lady)[=/](\d{1,20})(?:&|$)/i.exec(href);
    return m ? m[1] : null;
  }
  function extractScopedSidebarProfileId(doc) {
    if (!doc || !doc.body) return null;
    try {
      if (typeof window !== "undefined" && window.top && window !== window.top) return null;
    } catch {
    }
    let containers;
    try {
      containers = doc.querySelectorAll(SIDEBAR_CONTAINER_SELECTOR);
    } catch {
      return null;
    }
    if (containers.length !== 1) return null;
    const ids = /* @__PURE__ */ new Set();
    const spans = containers[0].querySelectorAll(SIDEBAR_ID_SELECTOR);
    for (const span of spans) {
      const value = (span.textContent ?? "").trim();
      if (PROFILE_ID_RE.test(value)) ids.add(value);
    }
    return ids.size === 1 ? [...ids][0] : null;
  }
  function listProfileKeys() {
    try {
      return Object.keys(localStorage).filter((k) => PROFILE_KEY_RE.test(k)).sort();
    } catch {
    }
    return [];
  }
  function resolveActiveProfile() {
    const sidebarId = extractScopedSidebarProfileId(typeof document !== "undefined" ? document : null);
    if (sidebarId) {
      return {
        ok: true,
        profileId: sidebarId,
        storageKey: `${CRM_STORAGE_PREFIX2}${sidebarId}`,
        source: "sidebar-dom",
        confidence: "HIGH"
      };
    }
    try {
      const hashId = extractProfileIdFromHash(window.location.href);
      if (hashId) {
        return {
          ok: true,
          profileId: hashId,
          storageKey: `${CRM_STORAGE_PREFIX2}${hashId}`,
          source: "url",
          confidence: "MEDIUM"
        };
      }
    } catch {
    }
    try {
      const urlId = extractProfileIdFromUrl(window.location.href);
      if (urlId) {
        return {
          ok: true,
          profileId: urlId,
          storageKey: `${CRM_STORAGE_PREFIX2}${urlId}`,
          source: "url",
          confidence: "MEDIUM"
        };
      }
    } catch {
    }
    const profiles = listProfileKeys();
    if (profiles.length === 1) {
      const id = profiles[0].replace(CRM_STORAGE_PREFIX2, "");
      return {
        ok: true,
        profileId: id,
        storageKey: profiles[0],
        source: "single-profile",
        confidence: "LOW"
      };
    }
    return {
      ok: false,
      profileId: null,
      storageKey: null,
      source: "blocked",
      confidence: "NONE",
      reason: "Active GoldenBride profile could not be determined safely."
    };
  }
  function resolveActionContext() {
    const resolution = resolveActiveProfile();
    if (!resolution.ok || !resolution.profileId || !resolution.storageKey) return null;
    return {
      profileId: resolution.profileId,
      storageKey: resolution.storageKey,
      source: resolution.source,
      confidence: resolution.confidence
    };
  }

  // ../src/companion/storage-version.ts
  var STORAGE_VERSION = 2;
  var VERSION_KEY = STORAGE_KEYS.STORAGE_VERSION;
  function getStoredVersion() {
    const raw = StorageService.get(VERSION_KEY);
    if (!raw) return 0;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && typeof parsed.version === "number") {
        return parsed.version;
      }
    } catch {
    }
    return 0;
  }
  function setStoredVersion(version) {
    const data = { version };
    StorageService.set(VERSION_KEY, JSON.stringify(data));
  }

  // ../src/companion/companion-diagnostics.ts
  var moduleNames = [];
  function setRegisteredModules(names) {
    moduleNames = names;
  }
  function detectEnvironment() {
    if (getRuntimeEnvironment().isExtension()) {
      return "extension";
    }
    if (typeof GM_info !== "undefined" || typeof Tampermonkey !== "undefined") {
      return "userscript";
    }
    return "unknown";
  }
  function getVersion() {
    return getRuntimeEnvironment().getExtensionVersion();
  }
  function collectDiagnostics() {
    return {
      version: getVersion(),
      modules: [...moduleNames],
      storage: StorageService.getAdapterType(),
      storageVersion: getStoredVersion(),
      environment: detectEnvironment(),
      runtime: {
        isTopFrame: getRuntimeEnvironment().isTopFrame(),
        isExtension: getRuntimeEnvironment().isExtension(),
        devMode: isDevMode(),
        readyState: getRuntimeEnvironment().getReadyState()
      }
    };
  }
  function logDiagnostics() {
    if (!isDevMode()) return;
    const info = collectDiagnostics();
    console.groupCollapsed("[Companion] Diagnostics");
    console.log("Version:", info.version);
    console.log("Environment:", info.environment);
    console.log("Modules:", info.modules);
    console.log("Storage:", info.storage);
    console.log("Storage Version:", info.storageVersion);
    console.log("Runtime:", info.runtime);
    console.groupEnd();
  }
  function exposeDiagnostics() {
    if (!isDevMode()) return;
    try {
      window.__COMPANION_DIAGNOSTICS__ = {
        info: collectDiagnostics,
        log: logDiagnostics,
        get launcher() {
          return launcherDiagnostics.getState();
        }
      };
      diag("Diagnostics exposed at window.__COMPANION_DIAGNOSTICS__");
    } catch {
    }
  }

  // ../src/companion/companion-diagnostics-collectors.ts
  var financeController = null;
  function setFinanceController(controller) {
    financeController = controller;
  }
  async function collectStorageData() {
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
    try {
      storageKeys = localStorage.length;
    } catch {
    }
    const profileKey = CrmService.findProfileKey();
    if (profileKey) {
      const raw = localStorage.getItem(profileKey);
      if (raw) {
        try {
          profileSize = `${(new Blob([raw]).size / 1024).toFixed(2)} KB`;
        } catch {
        }
      }
    }
    const allBackupKeys = Object.keys(localStorage).filter((k) => k.includes("backup"));
    backupKeys = allBackupKeys.length > 0 ? `${allBackupKeys.length} (${allBackupKeys.slice(0, 3).join(", ")}${allBackupKeys.length > 3 ? "..." : ""})` : "None";
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage != null && estimate.quota != null) {
          const usedMB = (estimate.usage / (1024 * 1024)).toFixed(2);
          const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(0);
          quotaUsage = `${usedMB} MB / ${quotaMB} MB`;
        }
      } catch {
      }
    }
    const allProfiles = Object.keys(localStorage).filter((k) => k.startsWith("chat-sender-"));
    detectedProfiles = allProfiles.length > 0 ? allProfiles.join(", ") : "None";
    selectedProfile = profileKey ? profileKey.replace("chat-sender-", "") : "Unknown";
    storageKey = profileKey || "Unknown";
    const activeResolution = resolveActiveProfile();
    const visibleProfileId = activeResolution.ok ? activeResolution.profileId : null;
    const selectedId = profileKey ? profileKey.replace("chat-sender-", "") : null;
    const profileMismatch = visibleProfileId && selectedId ? visibleProfileId === selectedId ? "NO" : "YES" : "Unknown";
    const activeSource = activeResolution.ok ? activeResolution.source === "sidebar-dom" ? "GoldenBride sidebar DOM" : activeResolution.source === "url" ? "URL parameter" : "Single profile fallback" : "Unavailable";
    if (profileKey) {
      const profileId = profileKey.replace("chat-sender-", "");
      backupExists = allBackupKeys.some((k) => k.includes(profileId)) ? "Yes" : "No";
    } else {
      backupExists = allBackupKeys.length > 0 ? "Yes (orphaned)" : "No";
    }
    try {
      const totalSize = Object.values(localStorage).reduce((sum, v) => sum + new Blob([v]).size, 0);
      estimatedLocalStorageKB = `${(totalSize / 1024).toFixed(2)} KB`;
    } catch {
    }
    const storageEntries = [];
    const entriesByType = {
      "CRM Profile": [],
      "Backup": [],
      "App State": [],
      "Finance": [],
      "Other": []
    };
    const importantPrefixes = ["chat-sender-", "ab-", "finance-"];
    for (const key of Object.keys(localStorage)) {
      const isImportant = importantPrefixes.some((p) => key.startsWith(p));
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
      } catch {
      }
      entriesByType[type].push({ key, size, type });
    }
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
      "Storage Entries": storageEntries.length > 0 ? storageEntries.join("\n") : "No important entries"
    };
  }
  function collectRuntimeData() {
    const info = collectDiagnostics();
    const profileKey = CrmService.findProfileKey();
    const profileData = profileKey ? CrmService.readProfile(profileKey) : null;
    const senderStopped = CrmService.isSenderStopped();
    const engineActive = profileData ? CrmService.isEngineActive(profileData) : false;
    const ibStatus = profileData ? String(profileData.status ?? "Unknown") : "N/A";
    const brStatus = profileData ? String(profileData.broadcast?.status ?? "Unknown") : "N/A";
    let health = "OK";
    if (!info.runtime.isTopFrame) health = "Iframe context";
    else if (engineActive) health = "Engine active";
    const profileValid = profileData ? CrmService.validateProfile(profileData) : false;
    const totalStorageSize = Object.values(localStorage).reduce((sum, v) => sum + new Blob([v]).size, 0);
    const isStorageOk = totalStorageSize < 5 * 1024 * 1024;
    const startBtn = CrmService["findButton"]("start");
    const stopBtn = CrmService["findButton"]("stop");
    const uiHooksPresent = !!startBtn || !!stopBtn;
    const isCrmPage = (() => {
      try {
        const url = window.location.href;
        if (url.includes("goldenbride") || url.includes("crm") || url.includes("chat-sender")) return true;
        if (document.querySelector("[data-crm], .crm-container, #chat-sender, .sender-panel")) return true;
      } catch {
      }
      return false;
    })();
    let uiHooksStatus;
    if (uiHooksPresent) {
      uiHooksStatus = "Present";
    } else if (isCrmPage) {
      uiHooksStatus = "Missing";
    } else {
      uiHooksStatus = "Not applicable";
    }
    const activeResolution = resolveActiveProfile();
    const visibleProfileId = activeResolution.ok ? activeResolution.profileId : null;
    const selectedId = profileKey ? profileKey.replace("chat-sender-", "") : null;
    const profileMismatch = !!(visibleProfileId && selectedId && visibleProfileId !== selectedId);
    const overallHealth = profileMismatch || !profileValid || !uiHooksPresent && uiHooksStatus !== "Not applicable" ? "Attention Required" : "Healthy";
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
      "Overall": overallHealth
    };
  }
  function collectDomData() {
    const startBtn = CrmService["findButton"]("start");
    const stopBtn = CrmService["findButton"]("stop");
    const iframes = document.querySelectorAll("iframe");
    const iframeDetails = Array.from(iframes).slice(0, 5).map((f, i) => {
      const el = f;
      return `#${i + 1}: ${el.src || "no src"} (${el.width || "?"}x${el.height || "?"})`;
    }).join("; ") || "None";
    let accessibleIframes = 0;
    let blockedIframes = 0;
    iframes.forEach((f) => {
      try {
        const _ = f.contentDocument;
        accessibleIframes++;
      } catch {
        blockedIframes++;
      }
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
      "Stop Button": stopBtn ? stopBtn.disabled ? "Disabled" : "Enabled" : "Not found",
      "Document Title": document.title || "Untitled",
      "Document ReadyState": document.readyState,
      // Userscript DOM fields
      "Accessible documents": "1",
      "Accessible iframes": String(accessibleIframes),
      "Blocked iframes": String(blockedIframes),
      "ShadowRoots": String(shadowRoots),
      "Buttons scanned": String(buttonsScanned)
    };
  }
  function collectLiveReaderData() {
    const profileKey = CrmService.findProfileKey();
    const profileData = profileKey ? CrmService.readProfile(profileKey) : null;
    if (!profileData) {
      return { "Status": "No profile loaded" };
    }
    const p = profileData;
    const ibStatus = String(p.status ?? "Unknown");
    const brStatus = String(p.broadcast?.status ?? "Unknown");
    const ibMessages = p.messages;
    const ibDelay = ibMessages && typeof ibMessages === "object" ? (() => {
      const first = Object.values(ibMessages)[0];
      return first?.intervalSeconds != null ? `${first.intervalSeconds} sec` : "N/A";
    })() : "N/A";
    const brMessages = p.broadcast?.messages;
    const brDelay = brMessages && typeof brMessages === "object" ? (() => {
      const first = Object.values(brMessages)[0];
      return first?.intervalSeconds != null ? `${first.intervalSeconds} sec` : "N/A";
    })() : "N/A";
    const ibCpCount = p.chainProgress && typeof p.chainProgress === "object" ? String(Object.keys(p.chainProgress).length) : "0";
    const ibSended = typeof p.sended === "string" ? String(p.sended.split(";").filter(Boolean).length) : "0";
    const brCpCount = p.broadcast?.chainProgress && typeof p.broadcast.chainProgress === "object" ? String(Object.keys(p.broadcast.chainProgress).length) : "0";
    const brSended = typeof p.broadcast?.sended === "string" ? String(p.broadcast.sended.split(";").filter(Boolean).length) : "0";
    const hasMessages = p.messages ? "FOUND" : "NOT FOUND";
    const hasBroadcastMessages = p.broadcast?.messages ? "FOUND" : "NOT FOUND";
    const hasChainProgress = p.chainProgress ? "FOUND" : "NOT FOUND";
    const hasDelivered = p.delivered !== void 0 ? "FOUND" : "NOT FOUND";
    const hasSended = p.sended !== void 0 ? "FOUND" : "NOT FOUND";
    const hasBroadcast = p.broadcast ? "FOUND" : "NOT FOUND";
    const fields = [
      { label: "IceBreaker Status", value: ibStatus, dataPath: "status" },
      { label: "Broadcast Status", value: brStatus, dataPath: "broadcast.status" },
      { label: "Private Delay", value: ibDelay, dataPath: "messages.*.intervalSeconds" },
      { label: "Broadcast Delay", value: brDelay, dataPath: "broadcast.messages.*.intervalSeconds" },
      { label: "IceBreaker In Progress", value: ibCpCount, dataPath: "chainProgress" },
      { label: "IceBreaker Completed", value: ibSended, dataPath: "sended" },
      { label: "Broadcast In Progress", value: brCpCount, dataPath: "broadcast.chainProgress" },
      { label: "Broadcast Completed", value: brSended, dataPath: "broadcast.sended" }
    ];
    const result = {};
    for (const f of fields) {
      result[`${f.label} | value`] = f.value;
      result[`${f.label} | displayed`] = f.value;
      result[`${f.label} | source`] = "CrmService.readProfile()";
      result[`${f.label} | confidence`] = "HIGH";
      result[`${f.label} | dataPath`] = `chat-sender-*.${f.dataPath}`;
      result[`${f.label} | parseStatus`] = f.value !== "N/A" && f.value !== "Unknown" ? "OK" : "EMPTY";
    }
    result["messages"] = hasMessages;
    result["broadcast.messages"] = hasBroadcastMessages;
    result["chainProgress"] = hasChainProgress;
    result["delivered"] = hasDelivered;
    result["sended"] = hasSended;
    result["broadcast"] = hasBroadcast;
    return result;
  }
  function collectRuntimeMapData() {
    const info = collectDiagnostics();
    const versionSource = (() => {
      const v = getRuntimeEnvironment().getExtensionVersion();
      if (v !== "0.0.0") return `getRuntimeEnvironment().getExtensionVersion() [${v}]`;
      return "fallback (0.0.0)";
    })();
    const environmentSource = (() => {
      if (getRuntimeEnvironment().isExtension()) return "getRuntimeEnvironment().isExtension() (extension)";
      if (typeof GM_info !== "undefined" || typeof Tampermonkey !== "undefined") return "GM_info (userscript)";
      return "fallback (unknown)";
    })();
    const storageSource = (() => {
      if (getPlatform().chromeStorage) return "getPlatform().chromeStorage";
      return "localStorage";
    })();
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
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
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
      "Viewport": viewport
    };
  }
  function collectResetData() {
    const profileKey = CrmService.findProfileKey();
    const profileData = profileKey ? CrmService.readProfile(profileKey) : null;
    const cpCount = profileData && typeof profileData.chainProgress === "object" ? String(Object.keys(profileData.chainProgress).length) : "0";
    const sendedCount = typeof profileData?.sended === "string" ? String(profileData.sended.split(";").filter(Boolean).length) : "0";
    const deliveredCount = typeof profileData?.delivered === "string" ? String(profileData.delivered.split(";").filter(Boolean).length) : "0";
    const brSendedCount = typeof profileData?.broadcast?.sended === "string" ? String(profileData.broadcast.sended.split(";").filter(Boolean).length) : "0";
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
    } catch {
    }
    let iceBreakerCompletedReason = "Unknown";
    if (sendedCount !== "0") {
      iceBreakerCompletedReason = `${sendedCount} (Explicit Counter)`;
    } else if (!profileKey) {
      iceBreakerCompletedReason = "Profile missing";
    } else if (!profileData) {
      iceBreakerCompletedReason = "Profile unreadable";
    } else if (!profileData.sended) {
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
    } else if (!profileData.broadcast?.sended) {
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
      "BR Completed Reason": broadcastCompletedReason
    };
  }
  function collectErrorLog() {
    const errors = getErrorHistory();
    if (errors.length === 0) {
      return {
        "Status": "Empty",
        "Entries": "0",
        "Capacity": "10"
      };
    }
    const result = {};
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
  function collectErrorHistory() {
    const errors = getErrorHistory();
    if (errors.length === 0) {
      return {
        "Status": "Empty",
        "Entries": "0",
        "Capacity": "Unlimited"
      };
    }
    const result = {};
    errors.forEach((e, i) => {
      result[`#${i + 1}`] = `${e.timestamp} | ${e.source || "unknown"} | ${e.message}`;
      if (e.stack) {
        result[`#${i + 1} Stack`] = e.stack.slice(0, 300);
      }
    });
    result["Total Errors"] = String(errors.length);
    return result;
  }
  function collectImportHistory() {
    const imports = getImportHistory();
    if (imports.length === 0) {
      return {
        "Status": "Empty",
        "Entries": "0",
        "Capacity": "Unlimited"
      };
    }
    const result = {};
    imports.forEach((imp, i) => {
      if (imp.target === void 0) {
        result[`Import ${i + 1}`] = `${imp.timestamp} | ${imp.profileKey} | ${imp.importedCount} items | ${imp.result}`;
        return;
      }
      const targetLabel = imp.target === "icebreaker" ? "IceBreaker" : "Broadcast";
      result[`Import ${i + 1}`] = `${imp.timestamp} | ${imp.profileKey} | ${targetLabel} | ${imp.importedCount} items | ${imp.result} | key ${imp.storageKey ?? "-"} | lines ${imp.linesEntered ?? "-"} | unique ${imp.uniqueSnippets ?? "-"} | prev ${imp.previousMessageCount ?? "-"} | final ${imp.finalMessageCount ?? "-"} | dups ${imp.duplicatesSkipped ?? "-"}`;
    });
    result["Total Imports"] = String(imports.length);
    return result;
  }
  async function collectUserscriptDiagnostics() {
    const info = collectDiagnostics();
    const fallback = (collectorName, error) => ({
      "Status": "Collector failed",
      "Error": error instanceof Error ? error.message : String(error),
      "Collector": collectorName
    });
    let storageData;
    try {
      storageData = await collectStorageData();
    } catch (e) {
      storageData = fallback("Storage", e);
    }
    let runtimeData;
    try {
      runtimeData = collectRuntimeData();
    } catch (e) {
      runtimeData = fallback("Runtime", e);
    }
    let domData;
    try {
      domData = collectDomData();
    } catch (e) {
      domData = fallback("DOM", e);
    }
    let liveReaderData;
    try {
      liveReaderData = collectLiveReaderData();
    } catch (e) {
      liveReaderData = fallback("LiveReader", e);
    }
    let runtimeMapData;
    try {
      runtimeMapData = collectRuntimeMapData();
    } catch (e) {
      runtimeMapData = fallback("RuntimeMap", e);
    }
    let resetData;
    try {
      resetData = collectResetData();
    } catch (e) {
      resetData = fallback("Reset", e);
    }
    let errorLogData;
    try {
      errorLogData = collectErrorLog();
    } catch (e) {
      errorLogData = fallback("ErrorLog", e);
    }
    let errorHistoryData;
    try {
      errorHistoryData = collectErrorHistory();
    } catch (e) {
      errorHistoryData = fallback("ErrorHistory", e);
    }
    let importHistoryData;
    try {
      importHistoryData = collectImportHistory();
    } catch (e) {
      importHistoryData = fallback("ImportHistory", e);
    }
    const systemSection = {
      "Script version": `v${info.version}`,
      "Environment": info.environment,
      "Extension": info.runtime.isExtension ? "Yes" : "No",
      "Top Frame": info.runtime.isTopFrame ? "Yes" : "No",
      "DevMode": info.runtime.devMode ? "Yes" : "No",
      "Storage Adapter": info.storage,
      "Storage Schema": String(info.storageVersion),
      "Modules": info.modules.join(", ") || "None"
    };
    const profileSection = {
      "Detected profiles": storageData["Detected profiles"] ?? "None",
      "Selected profile": storageData["Selected profile"] ?? "Unknown",
      "Storage key": storageData["Storage key"] ?? "Unknown",
      "Visible active profile": storageData["Visible active profile"] ?? "Unavailable",
      "Profile resolution source": storageData["Profile resolution source"] ?? "Unavailable",
      "Profile resolution confidence": storageData["Profile resolution confidence"] ?? "NONE",
      "Profile mismatch": storageData["Profile mismatch"] ?? "Unknown",
      "Profile size": storageData["Profile Size"] ?? "0 KB",
      "Backup exists": storageData["Backup exists"] ?? "No",
      "Estimated localStorage usage": storageData["Estimated localStorage usage (KB)"] ?? "N/A"
    };
    const runtimeSection = {
      "Booster UI opened": domData["Booster UI opened"] ?? "NO",
      "START button": domData["START button"] ?? "NOT FOUND",
      "STOP button": domData["STOP button"] ?? "NOT FOUND"
    };
    const profileStructureSection = {
      "messages": liveReaderData["messages"] ?? "NOT FOUND",
      "broadcast.messages": liveReaderData["broadcast.messages"] ?? "NOT FOUND",
      "chainProgress": liveReaderData["chainProgress"] ?? "NOT FOUND",
      "delivered": liveReaderData["delivered"] ?? "NOT FOUND",
      "sended": liveReaderData["sended"] ?? "NOT FOUND",
      "broadcast": liveReaderData["broadcast"] ?? "NOT FOUND"
    };
    const progressSourceSection = {
      "IceBreaker completed": resetData["IB Completed Reason"] ?? "Unknown",
      "Broadcast completed": resetData["BR Completed Reason"] ?? "Unknown"
    };
    const runtimeMapSection = {};
    for (const [key, value] of Object.entries(runtimeMapData)) {
      runtimeMapSection[key] = value;
    }
    const storageSection = {
      "status": runtimeData["IceBreaker Status"] ?? "Profile missing",
      "broadcast.status": runtimeData["Broadcast Status"] ?? "Profile missing",
      "chainProgress size": resetData["In-Progress Count"] !== "0" ? `${resetData["In-Progress Count"]} items` : resetData["In-Progress Count"] === "0" ? "0 items" : "Counter unavailable",
      "delivered size": resetData["Delivered Count"] !== "0" ? `${resetData["Delivered Count"]} items` : resetData["Delivered Count"] === "0" ? "0 items" : "Counter unavailable",
      "sended size": resetData["Completed Count"] !== "0" ? `${resetData["Completed Count"]} items` : resetData["Completed Count"] === "0" ? "0 items" : "Counter unavailable"
    };
    const domSection = {
      "Accessible documents": "1",
      "Accessible iframes": domData["Accessible iframes"] ?? "0",
      "Blocked iframes": domData["Blocked iframes"] ?? "0",
      "ShadowRoots": domData["ShadowRoots"] ?? "0",
      "Buttons scanned": domData["Buttons scanned"] ?? "0"
    };
    const healthCheckSection = {
      "Profile": runtimeData["Profile"] ?? "Unknown",
      "Storage": runtimeData["Storage"] ?? "Unknown",
      "UI Hooks": runtimeData["UI Hooks"] ?? "Unknown",
      "IceBreaker": runtimeData["IceBreaker Status"] ?? "Unknown",
      "Broadcast": runtimeData["Broadcast Status"] ?? "Unknown",
      "Overall": runtimeData["Overall"] ?? "Unknown"
    };
    const errorLogSection = errorLogData;
    const errorHistorySection = errorHistoryData;
    const importHistorySection = importHistoryData;
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
      "IMPORT HISTORY": importHistorySection
    };
  }
  function generateReport(groups) {
    const lines = [];
    lines.push("=== Companion \u2014 Diagnostics Report ===");
    lines.push(`Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`);
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
  function generateJson(groups) {
    return JSON.stringify({
      generated: (/* @__PURE__ */ new Date()).toISOString(),
      groups
    }, null, 2);
  }
  function generateDebugBundle(groups) {
    const report = generateReport(groups);
    const json = generateJson(groups);
    const extras = [];
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
    } catch {
      extras.push("  (access denied)");
    }
    extras.push("");
    extras.push("--- Performance ---");
    try {
      const perf = performance.getEntriesByType("navigation")[0];
      if (perf) {
        extras.push(`  domContentLoaded: ${Math.round(perf.domContentLoadedEventEnd)}ms`);
        extras.push(`  loadComplete: ${Math.round(perf.loadEventEnd)}ms`);
      }
    } catch {
      extras.push("  (unavailable)");
    }
    return [
      report,
      "",
      "=== JSON Data ===",
      json,
      "",
      "=== Debug Extras ===",
      extras.join("\n")
    ].join("\n");
  }
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
    }
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
  async function copyDebugBundle() {
    const groups = await collectUserscriptDiagnostics();
    const bundle = generateDebugBundle(groups);
    return copyToClipboard(bundle);
  }

  // ../src/companion/finance-module.ts
  var FINANCE_MODULE_ID = "finance";
  var FinanceModule = class {
    constructor() {
      __publicField(this, "id", FINANCE_MODULE_ID);
      __publicField(this, "metadata", {
        name: "Finance",
        version: "1.0.0",
        description: "Finance transaction viewer with shift-based filtering and unread tracking"
      });
      __publicField(this, "capabilities", {
        snapshot: true,
        diagnostics: true,
        versioning: true,
        export: false,
        events: true
      });
      __publicField(this, "platformServices", null);
      __publicField(this, "controller", null);
      __publicField(this, "widget", null);
      __publicField(this, "initialized", false);
      __publicField(this, "disposed", false);
      __publicField(this, "lastSnapshot", null);
      __publicField(this, "unsubscribeController", null);
      __publicField(this, "stylesInjected", false);
      __publicField(this, "boundHashChangeHandler", null);
      /** Handle SPA route changes via hashchange (Part D). */
      __publicField(this, "onHashChange", () => {
        if (this.disposed || !this.initialized || !this.widget) return;
        const runtime = getRuntimeEnvironment();
        const newCategory = runtime.getRouteCategory();
        if (newCategory === "non-chat") {
          if (!this.widget.isCollapsed) {
            if (isDevMode()) diag("[FinanceModule] hashchange: chat -> non-chat, collapsing");
            this.widget.collapse();
          }
        } else if (newCategory === "chat") {
          if (isDevMode()) diag("[FinanceModule] hashchange: non-chat -> chat, restoring chat preference");
          this.widget.applyChatPreference();
        }
      });
    }
    // -----------------------------------------------------------------------
    // Dependency Injection
    // -----------------------------------------------------------------------
    injectPlatformServices(services) {
      this.platformServices = services;
    }
    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------
    async initialize() {
      if (this.initialized) return;
      if (this.disposed) {
        throw new Error("FinanceModule: cannot reinitialize after dispose");
      }
      if (!this.platformServices) {
        throw new Error("FinanceModule: injectPlatformServices must be called before initialize");
      }
      if (isDevMode()) diag("[FinanceModule] initialize()");
      this.injectStyles();
      this.controller = new FinanceController();
      setFinanceController(this.controller);
      this.unsubscribeController = this.controller.subscribe((state) => {
        this.onControllerStateChange(state);
      });
      this.lastSnapshot = this.createSnapshot();
      this.platformServices.versionManager.createVersion(
        this.id,
        "startup",
        this.lastSnapshot,
        Object.freeze({
          addedTransactions: 0,
          removedTransactions: 0,
          shiftChanged: false,
          creditsChanged: false,
          statusChanged: false,
          unviewedChanged: false
        })
      );
      this.initialized = true;
      this.boundHashChangeHandler = this.onHashChange.bind(this);
      window.addEventListener("hashchange", this.boundHashChangeHandler);
      await this.platformServices.eventBus.publish(
        "finance:initialized",
        { moduleId: this.id },
        this.id
      );
      if (isDevMode()) diag("[FinanceModule] initialized");
    }
    async dispose() {
      if (this.disposed) return;
      if (isDevMode()) diag("[FinanceModule] dispose()");
      if (this.unsubscribeController) {
        this.unsubscribeController();
        this.unsubscribeController = null;
      }
      if (this.boundHashChangeHandler) {
        window.removeEventListener("hashchange", this.boundHashChangeHandler);
        this.boundHashChangeHandler = null;
      }
      this.controller?.cancelPending();
      this.widget?.destroy();
      this.widget = null;
      this.controller = null;
      const services = this.platformServices;
      this.platformServices = null;
      this.disposed = true;
      this.initialized = false;
      if (services) {
        await services.eventBus.publish(
          "finance:disposed",
          { moduleId: this.id },
          this.id
        );
      }
      if (isDevMode()) diag("[FinanceModule] disposed");
    }
    // -----------------------------------------------------------------------
    // Snapshot / Diff
    // -----------------------------------------------------------------------
    createSnapshot() {
      const state = this.controller?.getState();
      return Object.freeze({
        transactionIds: Object.freeze(
          (state?.data?.list ?? []).map((tx) => txIdentity(tx))
        ),
        shift: state?.shift ?? "day",
        credits: state?.data?.total ?? 0,
        status: state?.status ?? "idle",
        unviewedCount: state?.unviewedTransactions ?? 0
      });
    }
    createDiff(previous, current) {
      const prevIds = new Set(previous.transactionIds);
      const currIds = new Set(current.transactionIds);
      let added = 0;
      let removed = 0;
      for (const id of currIds) {
        if (!prevIds.has(id)) added++;
      }
      for (const id of prevIds) {
        if (!currIds.has(id)) removed++;
      }
      return Object.freeze({
        addedTransactions: added,
        removedTransactions: removed,
        shiftChanged: previous.shift !== current.shift,
        creditsChanged: previous.credits !== current.credits,
        statusChanged: previous.status !== current.status,
        unviewedChanged: previous.unviewedCount !== current.unviewedCount
      });
    }
    // -----------------------------------------------------------------------
    // Legacy Interface (Launcher Compatibility)
    // -----------------------------------------------------------------------
    open() {
      if (!this.initialized || this.disposed) return;
      if (!this.controller) return;
      if (!this.widget) {
        this.widget = new FinanceWidget(this.controller);
        this.widget.hide();
      }
      this.widget.show();
      if (isDevMode()) diag("[FinanceModule] widget shown");
    }
    /**
     * Restore the widget to its persisted visibility state with route-dependent behavior.
     * Chat routes restore the saved chat preference; non-chat routes force
     * collapsed without touching the chat preference and without auto-refresh.
     */
    restoreVisibility() {
      if (!this.initialized || this.disposed) return;
      if (!this.controller) return;
      const runtime = getRuntimeEnvironment();
      const routeCategory = runtime.getRouteCategory();
      if (!this.widget) {
        this.widget = new FinanceWidget(this.controller, {
          forceCollapsed: routeCategory === "non-chat"
        });
      }
      if (routeCategory === "non-chat") {
        if (isDevMode()) diag("[FinanceModule] non-chat route \u2014 forcing collapsed, preserving chat preference");
        if (!this.widget.isCollapsed) {
          this.widget.collapse();
        }
        this.widget.show();
      } else {
        if (isDevMode()) diag("[FinanceModule] chat route \u2014 restoring saved chat preference");
      }
      if (isDevMode()) diag("[FinanceModule] widget visibility restored");
    }
    close() {
      if (this.disposed) return;
      this.widget?.hide();
      if (isDevMode()) diag("[FinanceModule] widget hidden");
    }
    /**
     * Destroy the current widget (if any) and create a fresh one backed by
     * the existing controller, then show it. Preserves persisted geometry
     * and off-screen recovery. The controller is retained — no state reset.
     */
    restartWidgetAndShow() {
      if (!this.initialized || this.disposed) return;
      if (!this.controller) return;
      if (this.widget) {
        this.widget.destroy();
        this.widget = null;
      }
      this.widget = new FinanceWidget(this.controller);
      this.widget.show();
      if (isDevMode()) diag("[FinanceModule] widget restarted and shown");
    }
    /**
     * Toggle the widget between shown and hidden states. When showing,
     * always constructs a fresh widget instance to guarantee a clean state
     * (DOM, listeners, subscriptions) while preserving the controller and
     * persisted geometry.
     */
    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.restartWidgetAndShow();
      }
    }
    get isOpen() {
      return this.widget?.isVisible ?? false;
    }
    destroy() {
      this.dispose();
    }
    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------
    onControllerStateChange(state) {
      const current = this.createSnapshot();
      if (this.lastSnapshot && this.platformServices) {
        const diff = this.createDiff(this.lastSnapshot, current);
        this.platformServices.versionManager.createVersion(
          this.id,
          this.resolveReason(state),
          current,
          diff
        );
        if (diff.addedTransactions > 0) {
          void this.platformServices.eventBus.publish(
            "finance:item-added",
            { count: diff.addedTransactions },
            this.id
          );
        }
        if (diff.removedTransactions > 0) {
          void this.platformServices.eventBus.publish(
            "finance:item-removed",
            { count: diff.removedTransactions },
            this.id
          );
        }
      }
      this.lastSnapshot = current;
    }
    resolveReason(state) {
      if (state.status === "loading") return "refresh";
      if (state.status === "error") return "api_response";
      if (this.lastSnapshot && state.shift !== this.lastSnapshot.shift) return "shift_change";
      if (state.status === "loaded" && this.lastSnapshot?.status !== "loaded") return "refresh";
      return "user_click";
    }
    injectStyles() {
      if (this.stylesInjected) return;
      this.stylesInjected = true;
      const style = document.createElement("style");
      style.id = "ab-finance-styles";
      style.textContent = FINANCE_WIDGET_CSS;
      document.head.appendChild(style);
    }
  };

  // ../src/companion/dashboard-service.ts
  var DashboardService = class {
    static readCRMData(storageKey) {
      try {
        const key = storageKey ?? CrmService.findProfileKey();
        if (!key) return null;
        return CrmService.readProfile(key);
      } catch {
        return null;
      }
    }
  };

  // ../src/companion/dashboard.ts
  var DASHBOARD_FIELDS = [
    { label: "IceBreaker Status", path: "data.status", isStatus: true },
    { label: "Broadcast Status", path: "data.broadcast.status", isStatus: true },
    { label: "IceBreaker In Progress", path: "data.chainProgress" },
    { label: "IceBreaker Completed", path: "data.sended" },
    { label: "Broadcast In Progress", path: "data.broadcast.chainProgress" },
    { label: "Broadcast Completed", path: "data.broadcast.sended" }
  ];
  function isRunningStatus(value) {
    const v = value.toLowerCase();
    return v === "running" || v === "progress" || v === "active" || v.includes("running");
  }
  function resolveField(data, field) {
    try {
      if (field.path === "data.status") {
        return String(data?.status ?? "Unknown");
      }
      if (field.path === "data.broadcast.status") {
        return String(data?.broadcast?.status ?? "Unknown");
      }
      if (field.path === "data.chainProgress") {
        const cp = data?.chainProgress;
        return cp && typeof cp === "object" ? String(Object.keys(cp).length) : "0";
      }
      if (field.path === "data.sended") {
        const s = data?.sended;
        return typeof s === "string" ? String(s.split(";").filter(Boolean).length) : "0";
      }
      if (field.path === "data.broadcast.chainProgress") {
        const cp = data?.broadcast?.chainProgress;
        return cp && typeof cp === "object" ? String(Object.keys(cp).length) : "0";
      }
      if (field.path === "data.broadcast.sended") {
        const s = data?.broadcast?.sended;
        return typeof s === "string" ? String(s.split(";").filter(Boolean).length) : "0";
      }
      return "N/A";
    } catch {
      return "N/A";
    }
  }
  function createStatusDot(isActive) {
    const dot = document.createElement("span");
    dot.className = isActive ? "ab-status-dot active" : "ab-status-dot";
    return dot;
  }
  function renderDashboard(container, storageKey) {
    container.innerHTML = "";
    const data = DashboardService.readCRMData(storageKey);
    if (!data) {
      const empty = document.createElement("div");
      empty.className = "ab-empty";
      empty.textContent = "No CRM data found. Start IceBreaker or Broadcast to see live status.";
      container.appendChild(empty);
      return;
    }
    const grid = document.createElement("div");
    grid.className = "ab-grid ab-grid-compact";
    for (const field of DASHBOARD_FIELDS) {
      const card = document.createElement("div");
      card.className = "ab-card ab-card-compact";
      const label = document.createElement("div");
      label.className = "ab-card-title";
      label.textContent = field.label;
      const value = document.createElement("div");
      value.className = "ab-card-value";
      const text = resolveField(data, field);
      if (field.isStatus) {
        const dot = createStatusDot(isRunningStatus(text));
        value.appendChild(dot);
        const span = document.createElement("span");
        span.textContent = text;
        value.appendChild(span);
      } else {
        value.textContent = text;
      }
      card.appendChild(label);
      card.appendChild(value);
      grid.appendChild(card);
    }
    container.appendChild(grid);
  }
  function updateDashboard(storageKey) {
    const container = document.getElementById("ab-status-grid");
    if (container) {
      renderDashboard(container, storageKey);
    }
  }
  var dashboardInterval = null;
  function start() {
    if (dashboardInterval) return;
    dashboardInterval = setInterval(updateDashboard, 5e3);
  }
  function stop() {
    if (!dashboardInterval) return;
    clearInterval(dashboardInterval);
    dashboardInterval = null;
  }

  // ../src/companion/companion-styles.ts
  var modalStylesInjected = false;
  function injectStyles() {
    if (modalStylesInjected) return;
    modalStylesInjected = true;
    const style = document.createElement("style");
    style.id = "ab-companion-styles";
    style.textContent = COMPANION_STYLES_CSS;
    document.head.appendChild(style);
  }
  function showToast(message, isError = false) {
    injectStyles();
    const toast = document.createElement("div");
    toast.className = "ab-toast";
    toast.textContent = message;
    if (isError) toast.style.background = "var(--ab-danger)";
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "ab-slide-up 0.2s reverse forwards";
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }
  var COMPANION_STYLES_CSS = `
/* \u2500\u2500 Variables \u2500\u2500 */
:root {
    --ab-bg: rgba(15, 23, 42, 0.85);
    --ab-bg-card: rgba(30, 41, 59, 0.6);
    --ab-text: #f8fafc;
    --ab-text-dim: #94a3b8;
    --ab-accent: #2F6BFF;
    --ab-accent-hover: #4A82FF;
    --ab-border: rgba(255, 255, 255, 0.1);
    --ab-danger: #ef4444;
    --ab-success: #10b981;
    --ab-warning: #f59e0b;
    --ab-font: system-ui, -apple-system, sans-serif;
}

/* \u2500\u2500 Overlay \u2500\u2500 */
.ab-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(4px);
    z-index: ${Z.modal};
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--ab-font);
    color: var(--ab-text);
    opacity: 0;
    transition: opacity 0.15s ease;
}
.ab-overlay.visible { opacity: 1; }

/* \u2500\u2500 Modal \u2500\u2500 */
.ab-modal {
    background: var(--ab-bg);
    border-radius: 12px;
    width: 400px;
    max-height: 90vh;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);
    border: 1px solid var(--ab-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform: scale(0.95);
    transition: transform 0.15s ease;
}
.ab-modal.large { width: 600px; }
.ab-modal.medium { width: 460px; }
.ab-modal.small { width: 320px; }
.ab-overlay.visible .ab-modal { transform: scale(1); }

/* \u2500\u2500 Header \u2500\u2500 */
.ab-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--ab-border);
}
.ab-header-brand {
    display: flex;
    align-items: center;
    gap: 8px;
}
.ab-header-logo {
    width: 22px;
    height: 22px;
}
.ab-header-title {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.2px;
}
.ab-header-right {
    display: flex;
    align-items: center;
    gap: 12px;
}
.ab-header-version {
    font-size: 11px;
    color: var(--ab-text-dim);
    font-weight: 500;
    letter-spacing: 0.3px;
}
.ab-modal.small .ab-header {
    justify-content: center;
}
.ab-modal.small .ab-header h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
}
.ab-close-icon {
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.15s;
    display: flex;
}
.ab-close-icon:hover { opacity: 1; }
.ab-close-icon:focus-visible {
    outline: 2px solid var(--ab-accent);
    outline-offset: 2px;
    border-radius: 4px;
}
.ab-close-icon svg { width: 20px; height: 20px; fill: var(--ab-text); }

/* \u2500\u2500 Content \u2500\u2500 */
.ab-content {
    padding: 16px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 75vh;
}

/* \u2500\u2500 Sections \u2500\u2500 */
.ab-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.ab-section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--ab-accent);
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(47,107,255,0.3);
}
.ab-content::-webkit-scrollbar { width: 6px; }
.ab-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }

/* \u2500\u2500 Grid / Cards \u2500\u2500 */
.ab-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}
.ab-grid-compact {
    gap: 8px;
}
.ab-card {
    background: var(--ab-bg-card);
    border: 1px solid var(--ab-border);
    border-radius: 10px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color 0.15s ease, background 0.15s ease;
}
.ab-card-compact {
    padding: 8px 10px;
    gap: 4px;
}
.ab-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    background: rgba(30, 41, 59, 0.8);
}
.ab-card-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--ab-text-dim);
}
.ab-card-value {
    font-size: 15px;
    font-weight: 600;
    color: var(--ab-text);
    display: flex;
    align-items: center;
    gap: 6px;
}

/* \u2500\u2500 Status indicator \u2500\u2500 */
.ab-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ab-danger);
    flex-shrink: 0;
}
.ab-status-dot.active {
    background: var(--ab-success);
}

/* \u2500\u2500 Actions grid \u2500\u2500 */
.ab-actions-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.ab-actions-row .ab-btn {
    justify-content: center;
}

/* \u2500\u2500 Delay Modal: Input groups \u2500\u2500 */
.ab-input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
}
.ab-input-group label {
    font-size: 12px;
    color: var(--ab-text-dim);
    font-weight: 500;
}
.ab-input-group input[type="number"] {
    background-color: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--ab-border);
    border-radius: 6px;
    padding: 10px 12px;
    color: var(--ab-text);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 14px;
    line-height: 1.4;
    width: 100%;
    box-sizing: border-box;
    /* Explicit readability in all states */
    caret-color: var(--ab-text);
    opacity: 1;
    -webkit-text-fill-color: var(--ab-text);
}
.ab-input-group input[type="number"]:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background-color: rgba(0, 0, 0, 0.25);
}
.ab-input-group input[type="number"]:focus {
    outline: none;
    border-color: var(--ab-accent);
    background-color: rgba(0, 0, 0, 0.3);
    box-shadow: 0 0 0 2px rgba(47, 107, 255, 0.2);
}
.ab-input-group input[type="number"]::selection {
    background-color: var(--ab-accent);
    color: #fff;
}
.ab-input-group input[type="number"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: rgba(0, 0, 0, 0.15);
    color: var(--ab-text-dim);
}
.ab-input-group input[type="number"]:invalid {
    border-color: var(--ab-danger);
}

/* \u2500\u2500 Delay Modal: Actions container \u2500\u2500 */
.ab-actions-container {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: flex-end;
    align-items: center;
    width: 100%;
    margin-top: 8px;
}
.ab-actions-container .ab-btn {
    min-width: 80px;
    height: 40px;
    flex-shrink: 0;
}

/* \u2500\u2500 Full-width button \u2500\u2500 */
.ab-btn-full {
    width: 100%;
    justify-content: center;
}

/* \u2500\u2500 Buttons \u2500\u2500 */
.ab-btn {
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--ab-border);
    border-radius: 8px;
    padding: 10px 16px;
    color: var(--ab-text);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    font-family: var(--ab-font);
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 8px;
}
.ab-btn:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.2);
}
.ab-btn:active { transform: scale(0.98); transition-duration: 0.05s; }
.ab-btn:focus-visible {
    outline: 2px solid var(--ab-accent);
    outline-offset: 2px;
}
.ab-btn.primary {
    background: var(--ab-accent);
    border-color: var(--ab-accent);
    color: #fff;
}
.ab-btn.primary:hover { background: var(--ab-accent-hover); }
.ab-btn.danger {
    background: rgba(239,68,68,0.2);
    border-color: rgba(239,68,68,0.4);
    color: #fca5a5;
}
.ab-btn.danger:hover { background: rgba(239,68,68,0.3); }

/* \u2500\u2500 Diagnostics \u2500\u2500 */
.ab-diag-group { margin-bottom: 16px; }
.ab-diag-group h3 {
    margin: 0 0 8px 0;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--ab-accent);
    border-bottom: 1px solid rgba(47,107,255,0.3);
    padding-bottom: 4px;
}
.ab-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}
.ab-table td {
    padding: 4px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    word-break: break-all;
    transition: background 0.1s ease;
}
.ab-table tr:hover td {
    background: rgba(255, 255, 255, 0.03);
}
.ab-table td:first-child {
    color: var(--ab-text-dim);
    width: 45%;
}

/* \u2500\u2500 Toast \u2500\u2500 */
.ab-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--ab-success);
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    z-index: ${Z.toast};
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: ab-slide-up 0.2s forwards;
}
@keyframes ab-slide-up {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

/* \u2500\u2500 Empty state \u2500\u2500 */
.ab-empty {
    text-align: center;
    color: var(--ab-text-dim);
    font-size: 13px;
    padding: 20px 0;
}

/* \u2500\u2500 Import Dialog \u2500\u2500 */
.ab-import-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 8px;
}

.ab-import-warning {
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fcd34d;
    font-size: 12px;
    line-height: 1.45;
    margin-bottom: 8px;
}

.ab-import-error {
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(220, 38, 38, 0.12);
    border: 1px solid rgba(220, 38, 38, 0.4);
    color: #fca5a5;
    font-size: 12px;
    line-height: 1.45;
    margin-bottom: 8px;
}

.ab-import-error[hidden] { display: none; }

.ab-btn-import {
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 10px;
    transition: all 0.15s;
}
.ab-btn-import svg { width: 16px; height: 16px; flex-shrink: 0; }

/* IceBreaker - cool blue */
.ab-btn-import.icebreaker {
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.25), rgba(29, 78, 216, 0.2));
    border-color: rgba(37, 99, 235, 0.4);
    color: #93c5fd;
}
.ab-btn-import.icebreaker:hover {
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.35), rgba(29, 78, 216, 0.3));
    border-color: rgba(37, 99, 235, 0.6);
    color: #bfdbfe;
}

/* Broadcast - warm orange/amber */
.ab-btn-import.broadcast {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.2));
    border-color: rgba(245, 158, 11, 0.4);
    color: #fcd34d;
}
.ab-btn-import.broadcast:hover {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.35), rgba(217, 119, 6, 0.3));
    border-color: rgba(245, 158, 11, 0.6);
    color: #fde047;
}

/* Cancel - burgundy/wine */
.ab-btn-cancel {
    width: 100%;
    padding: 14px 20px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(153, 27, 27, 0.3), rgba(127, 29, 29, 0.25));
    border-color: rgba(153, 27, 27, 0.5);
    color: #fca5a5;
    margin-top: 8px;
}
.ab-btn-cancel:hover {
    background: linear-gradient(135deg, rgba(153, 27, 27, 0.4), rgba(127, 29, 29, 0.35));
    border-color: rgba(153, 27, 27, 0.7);
    color: #fecaca;
}

/* Textarea with line-number gutter */
.ab-import-editor {
    display: flex;
    border: 1px solid var(--ab-border);
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.15s, box-shadow 0.15s;
}
.ab-import-editor:focus-within {
    border-color: var(--ab-accent);
    box-shadow: 0 0 0 3px rgba(47, 107, 255, 0.15);
}
.ab-import-editor.ab-import-editor-error {
    border-color: rgba(220, 38, 38, 0.7);
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);
}

.ab-import-gutter {
    width: 40px;
    flex-shrink: 0;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.04);
    border-right: 1px solid var(--ab-border);
    text-align: right;
}

.ab-import-gutter-numbers {
    padding: 14px 8px 14px 0;
    color: var(--ab-text-dim);
    font-family: var(--ab-font);
    font-size: 13px;
    line-height: 1.5;
    white-space: pre;
    will-change: transform;
    user-select: none;
}

.ab-import-textarea {
    width: 100%;
    min-height: 260px;
    padding: 14px;
    border: none;
    background: var(--ab-bg-card);
    color: var(--ab-text);
    font-family: var(--ab-font);
    font-size: 13px;
    line-height: 1.5;
    box-sizing: border-box;
    resize: none;
    outline: none;
}
.ab-import-textarea::placeholder {
    color: var(--ab-text-dim);
    opacity: 0.7;
}

/* Custom scrollbar for textarea */
.ab-import-textarea::-webkit-scrollbar { width: 8px; }
.ab-import-textarea::-webkit-scrollbar-track { background: transparent; }
.ab-import-textarea::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: content-box;
}
.ab-import-textarea::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
    background-clip: content-box;
}
.ab-import-textarea::-webkit-scrollbar-corner { background: transparent; }
`;

  // ../src/companion/companion-dialogs.ts
  var DEFAULT_DELAY2 = 65;
  function createDialogOverlay() {
    injectStyles();
    const overlay = document.createElement("div");
    overlay.className = "ab-overlay";
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("visible"));
    return overlay;
  }
  function closeDialogOverlay(overlay) {
    overlay.classList.remove("visible");
    setTimeout(() => overlay.remove(), 150);
  }
  function showAlert(msgHtml) {
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
      document.getElementById("ab-alert-ok").onclick = () => {
        closeDialogOverlay(overlay);
        resolve();
      };
    });
  }
  function showConfirm(msgHtml, confirmLabel = "Yes", cancelLabel = "No") {
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
                    <button class="ab-btn primary" id="ab-confirm-yes">${confirmLabel}</button>
                    <button class="ab-btn" id="ab-confirm-no">${cancelLabel}</button>
                </div>
            </div>
        `;
      document.getElementById("ab-confirm-yes").onclick = () => {
        closeDialogOverlay(overlay);
        resolve(true);
      };
      document.getElementById("ab-confirm-no").onclick = () => {
        closeDialogOverlay(overlay);
        resolve(false);
      };
    });
  }
  function showImportSnippetsModal() {
    return new Promise((resolve) => {
      const overlay = createDialogOverlay();
      overlay.innerHTML = `
            <div class="ab-modal medium">
                <div class="ab-header">
                    <h2>Import Snippets</h2>
                </div>
                <div class="ab-content" style="gap: 12px; padding: 20px;">
                    <div class="ab-import-buttons">
                        <button class="ab-btn ab-btn-import icebreaker" id="ab-import-icebreaker">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="6" y1="20" x2="6.01" y2="20"/></svg>
                            Import to IceBreaker
                        </button>
                        <button class="ab-btn ab-btn-import broadcast" id="ab-import-broadcast">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                            Import to Broadcast
                        </button>
                    </div>
                    <div class="ab-import-warning" id="ab-import-warning">
                        Pasting snippets will replace the current message list of the selected target.
                    </div>
                    <label style="display:block; margin-bottom:6px; font-size:12px; color:var(--ab-text-dim); font-weight:500;">
                        Paste snippets (one per line):
                    </label>
                    <div class="ab-import-editor" id="ab-import-editor">
                        <div class="ab-import-gutter" id="ab-import-gutter">
                            <div class="ab-import-gutter-numbers" id="ab-import-gutter-numbers">1</div>
                        </div>
                        <textarea class="ab-import-textarea" id="ab-import-textarea" 
                            placeholder="Snippet 1
Snippet 2
Snippet 3
..."></textarea>
                    </div>
                    <div class="ab-import-error" id="ab-import-error" hidden>
                        Please paste at least one non-empty snippet before importing.
                    </div>
                    <button class="ab-btn ab-btn-cancel" id="ab-import-cancel">Cancel</button>
                </div>
            </div>
        `;
      const textarea = document.getElementById("ab-import-textarea");
      const gutterNumbers = document.getElementById("ab-import-gutter-numbers");
      const errorBox = document.getElementById("ab-import-error");
      const editor = document.getElementById("ab-import-editor");
      textarea.focus();
      const updateLineNumbers = () => {
        const count = Math.max(1, textarea.value.split("\n").length);
        gutterNumbers.textContent = Array.from({ length: count }, (_, i) => String(i + 1)).join("\n");
        gutterNumbers.style.transform = "translateY(0px)";
        if (errorBox.hidden === false) {
          errorBox.hidden = true;
          editor.classList.remove("ab-import-editor-error");
        }
      };
      const syncGutterScroll = () => {
        gutterNumbers.style.transform = `translateY(${-textarea.scrollTop}px)`;
      };
      const onInput = () => updateLineNumbers();
      const onScroll = () => syncGutterScroll();
      textarea.addEventListener("input", onInput);
      textarea.addEventListener("scroll", onScroll);
      const parseSnippets = () => {
        return textarea.value.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      };
      const confirmImport = (target) => {
        const snippets = parseSnippets();
        if (snippets.length === 0) {
          errorBox.hidden = false;
          editor.classList.add("ab-import-editor-error");
          textarea.focus();
          return;
        }
        textarea.removeEventListener("input", onInput);
        textarea.removeEventListener("scroll", onScroll);
        closeDialogOverlay(overlay);
        resolve({ snippets, target });
      };
      document.getElementById("ab-import-cancel").onclick = () => {
        textarea.removeEventListener("input", onInput);
        textarea.removeEventListener("scroll", onScroll);
        closeDialogOverlay(overlay);
        resolve(null);
      };
      document.getElementById("ab-import-icebreaker").onclick = () => confirmImport("icebreaker");
      document.getElementById("ab-import-broadcast").onclick = () => confirmImport("broadcast");
    });
  }
  function showDelayModal(initialDelays) {
    return new Promise((resolve) => {
      const overlay = createDialogOverlay();
      const initialPriv = initialDelays?.priv ?? DEFAULT_DELAY2;
      const initialBroad = initialDelays?.broad ?? DEFAULT_DELAY2;
      overlay.innerHTML = `
            <div class="ab-modal small">
                <div class="ab-header">
                    <h2>Change Delays</h2>
                </div>
                <div class="ab-content">
                    <div class="ab-input-group">
                        <label>Private Delay (seconds)</label>
                        <input type="number" id="ab-delay-priv" value="${initialPriv}" min="1" max="3600">
                    </div>
                    <div class="ab-input-group">
                        <label>Broadcast Delay (seconds)</label>
                        <input type="number" id="ab-delay-broad" value="${initialBroad}" min="1" max="3600">
                    </div>
                    <div class="ab-actions-container">
                        <button class="ab-btn primary" id="ab-delay-apply">Apply</button>
                        <button class="ab-btn" id="ab-delay-cancel">Cancel</button>
                    </div>
                </div>
            </div>
        `;
      document.getElementById("ab-delay-apply").onclick = () => {
        const privInput = document.getElementById("ab-delay-priv");
        const broadInput = document.getElementById("ab-delay-broad");
        const priv = parseInt(privInput.value, 10);
        const broad = parseInt(broadInput.value, 10);
        if (isNaN(priv) || isNaN(broad)) {
          showAlert("Invalid numeric value. Please enter valid numbers.");
          return;
        }
        if (priv < 1 || priv > 3600 || broad < 1 || broad > 3600) {
          showAlert("Delay values must be between 1 and 3600 seconds.");
          return;
        }
        if (!Number.isInteger(priv) || !Number.isInteger(broad)) {
          showAlert("Delay values must be whole numbers.");
          return;
        }
        closeDialogOverlay(overlay);
        resolve({ priv, broad });
      };
      document.getElementById("ab-delay-cancel").onclick = () => {
        closeDialogOverlay(overlay);
        resolve(null);
      };
    });
  }

  // ../src/companion/app-version.ts
  var APP_VERSION = "v2.1.0";

  // ../src/companion/companion-modal.ts
  var modalOverlay = null;
  var fadingOverlay = null;
  function renderActionsSection(container, onFinanceClick) {
    const row1 = document.createElement("div");
    row1.className = "ab-actions-row";
    const resetBtn = document.createElement("button");
    resetBtn.className = "ab-btn";
    resetBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg> Reset IceBreaker`;
    resetBtn.addEventListener("click", async () => {
      const key = CrmService.findProfileKey();
      if (!key) {
        await showAlert("No CRM profile found.");
        return;
      }
      const data = CrmService.readProfile(key);
      if (!data || !CrmService.validateProfile(data)) {
        await showAlert("Invalid profile structure.");
        return;
      }
      if (!await CrmService.stopSenderSafely()) {
        if (!await showConfirm("Stop verification failed. Force continue?")) return;
      }
      const resetStart = Date.now();
      CrmService.resetIceBreaker(data);
      CrmService.writeProfile(key, data);
      const resetDuration = Date.now() - resetStart;
      try {
        localStorage.setItem("ab-last-reset", JSON.stringify({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), type: "resetIceBreaker", profileKey: key, durationMs: resetDuration }));
      } catch {
      }
      updateDashboard();
      await showAlert("IceBreaker reset successfully.");
    });
    row1.appendChild(resetBtn);
    const newShiftBtn = document.createElement("button");
    newShiftBtn.className = "ab-btn danger";
    newShiftBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4ZM6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V8H6V19Z"/></svg> New Shift`;
    newShiftBtn.addEventListener("click", async () => {
      const key = CrmService.findProfileKey();
      if (!key) {
        await showAlert("No CRM profile found.");
        return;
      }
      const data = CrmService.readProfile(key);
      if (!data || !CrmService.validateProfile(data)) {
        await showAlert("Invalid profile structure.");
        return;
      }
      if (!await CrmService.stopSenderSafely()) {
        if (!await showConfirm("Stop verification failed. Force continue?")) return;
      }
      CrmService.newShift(data);
      CrmService.writeProfile(key, data);
      updateDashboard();
      await showAlert("New Shift started.");
    });
    row1.appendChild(newShiftBtn);
    container.appendChild(row1);
    container.appendChild(createDivider());
    const row2 = document.createElement("div");
    row2.className = "ab-actions-row";
    const delaysBtn = document.createElement("button");
    delaysBtn.className = "ab-btn primary";
    delaysBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> Change Delays`;
    delaysBtn.addEventListener("click", async () => {
      const key = CrmService.findProfileKey();
      if (!key) {
        await showAlert("No CRM profile found.");
        return;
      }
      const data = CrmService.readProfile(key);
      if (!data || !CrmService.validateProfile(data)) {
        await showAlert("Invalid profile structure.");
        return;
      }
      if (CrmService.isEngineActive(data)) {
        await showAlert("Please stop IceBreaker and Broadcast before changing delays.");
        return;
      }
      if (!await CrmService.stopSenderSafely()) {
        if (!await showConfirm("Stop verification failed. Force continue?")) return;
      }
      const currentDelays = CrmService.readDelays(data);
      const delays = await showDelayModal(currentDelays);
      if (!delays) return;
      CrmService.applyDelays(data, delays.priv, delays.broad);
      CrmService.writeProfile(key, data);
      await showAlert("Delays successfully updated and verified.");
    });
    row2.appendChild(delaysBtn);
    const importBtn = document.createElement("button");
    importBtn.className = "ab-btn";
    importBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg> Import Snippets`;
    importBtn.addEventListener("click", async () => {
      const result = await showImportSnippetsModal();
      if (!result) return;
      const { snippets, target } = result;
      const importResult = await CrmService.importSnippetsToProfile(target, snippets, {
        confirmReplace: async (message) => showConfirm(message, "Replace", "Cancel"),
        resolveProfile: () => {
          const context = resolveActionContext();
          return context ? { profileId: context.profileId, storageKey: context.storageKey } : null;
        }
      });
      if (importResult.outcome === "success") {
        updateDashboard(importResult.storageKey);
      }
      const reportHtml = importResult.message.replace(/\n/g, "<br>");
      await showAlert(reportHtml);
    });
    row2.appendChild(importBtn);
    container.appendChild(row2);
  }
  function renderFinanceSection(container, onFinanceClick) {
    const financeBtn = document.createElement("button");
    financeBtn.className = "ab-btn ab-btn-full";
    financeBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg> Finance Widget`;
    financeBtn.addEventListener("click", onFinanceClick);
    container.appendChild(financeBtn);
  }
  function createDivider() {
    const div = document.createElement("div");
    div.style.borderTop = "1px solid var(--ab-border)";
    div.style.margin = "8px 0";
    return div;
  }
  function createSectionTitle(text) {
    const title = document.createElement("div");
    title.className = "ab-section-title";
    title.textContent = text;
    return title;
  }
  function handleClose() {
    hide();
  }
  function onKeyDown(e) {
    if (e.key === "Escape") handleClose();
  }
  function onOverlayClick(e) {
    if (e.target === modalOverlay) handleClose();
  }
  function show(onFinanceClick) {
    if (fadingOverlay) {
      fadingOverlay.remove();
      fadingOverlay = null;
    }
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
                    <span class="ab-header-version">${APP_VERSION}</span>
                    <div class="ab-close-icon" id="ab-main-close">
                        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </div>
                </div>
            </div>
            <div class="ab-content" id="ab-unified-content"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    modalOverlay = overlay;
    document.getElementById("ab-main-close")?.addEventListener("click", handleClose);
    document.addEventListener("keydown", onKeyDown);
    overlay.addEventListener("click", onOverlayClick);
    const content = document.getElementById("ab-unified-content");
    if (content) {
      const statusSection = document.createElement("div");
      statusSection.className = "ab-section";
      statusSection.appendChild(createSectionTitle("Status"));
      const statusGrid = document.createElement("div");
      statusGrid.id = "ab-status-grid";
      statusSection.appendChild(statusGrid);
      content.appendChild(statusSection);
      const actionsSection = document.createElement("div");
      actionsSection.className = "ab-section";
      actionsSection.appendChild(createSectionTitle("Actions"));
      const actionsContent = document.createElement("div");
      actionsSection.appendChild(actionsContent);
      content.appendChild(actionsSection);
      const financeSection = document.createElement("div");
      financeSection.className = "ab-section";
      financeSection.appendChild(createSectionTitle("Finance"));
      const financeContent = document.createElement("div");
      financeSection.appendChild(financeContent);
      content.appendChild(financeSection);
      renderDashboard(statusGrid);
      renderActionsSection(actionsContent, onFinanceClick);
      renderFinanceSection(financeContent, onFinanceClick);
    }
    requestAnimationFrame(() => overlay.classList.add("visible"));
    start();
    diag("CompanionModal shown");
    CompanionModal.getInstance().onVisibilityChange?.();
  }
  function hide() {
    if (!modalOverlay) return;
    stop();
    document.removeEventListener("keydown", onKeyDown);
    modalOverlay.classList.remove("visible");
    const overlay = modalOverlay;
    fadingOverlay = overlay;
    setTimeout(() => {
      overlay?.remove();
      if (fadingOverlay === overlay) {
        fadingOverlay = null;
      }
    }, 150);
    modalOverlay = null;
    diag("CompanionModal hidden");
    CompanionModal.getInstance().onVisibilityChange?.();
  }
  var _CompanionModal = class _CompanionModal {
    constructor() {
      __publicField(this, "onFinanceClick", null);
      __publicField(this, "onVisibilityChange", null);
    }
    static initInstance(modal) {
      if (_CompanionModal.instance) {
        throw new Error("CompanionModal instance already initialized.");
      }
      _CompanionModal.instance = modal;
    }
    static getInstance() {
      if (!_CompanionModal.instance) {
        throw new Error("CompanionModal not initialized. Call CompanionModal.initInstance() during bootstrap.");
      }
      return _CompanionModal.instance;
    }
    /** Set the callback for the Finance Widget button. */
    setFinanceClickHandler(handler) {
      this.onFinanceClick = handler;
    }
    /** Set the callback for visibility changes (show/hide). */
    setOnVisibilityChange(callback) {
      this.onVisibilityChange = callback;
    }
    /** Show the Companion modal. */
    show() {
      show(this.onFinanceClick ?? (() => {
      }));
    }
    /** Hide the Companion modal. */
    hide() {
      hide();
    }
    /** Toggle the Companion modal. */
    toggle() {
      if (modalOverlay) {
        hide();
      } else {
        this.show();
      }
    }
    /** Whether the modal is currently visible. */
    get isVisible() {
      return modalOverlay !== null;
    }
  };
  __publicField(_CompanionModal, "instance", null);
  var CompanionModal = _CompanionModal;

  // ../src/companion/companion-app.ts
  var LAUNCHER_CSS = `
/* --- Launcher group layout tokens --- */
:root {
    --launcher-size: 52px;
    --launcher-icon-size: 31px;
    --launcher-right: 24px;
    --launcher-top: 24px;
    --launcher-gap: 4px;
    --diagnostics-size: 33px;
    --diagnostics-icon-size: 18px;
}

#ab-companion-launcher {
    position: fixed;
    top: var(--launcher-top);
    right: var(--launcher-right);
    z-index: ${Z.launcher};
    width: var(--launcher-size);
    height: var(--launcher-size);
    border-radius: 50%;
    background: #2F6BFF;
    border: 2px solid rgba(255,255,255,0.15);
    color: #FFFFFF;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 5px 19px rgba(47,107,255,0.4);
    transition: all 0.15s ease;
    user-select: none;
    touch-action: none;
    overflow: hidden;
    padding: 0;
}

#ab-companion-launcher img {
    width: var(--launcher-icon-size);
    height: var(--launcher-icon-size);
    pointer-events: none;
}

#ab-companion-launcher:hover {
    background: #4A82FF;
    box-shadow: 0 7px 28px rgba(47,107,255,0.6);
    transform: scale(1.05);
}

#ab-companion-launcher:active {
    transform: scale(0.95);
    transition-duration: 0.05s;
}

#ab-companion-launcher.active {
    background: #2F6BFF;
    box-shadow: 0 0 0 4px rgba(47,107,255,0.3), 0 5px 19px rgba(47,107,255,0.5);
}

#ab-companion-launcher.active:hover {
    background: #4A82FF;
    box-shadow: 0 0 0 4px rgba(47,107,255,0.4), 0 7px 28px rgba(47,107,255,0.6);
}

/* Diagnostics launcher button - centered below main launcher */
#ab-diagnostics-launcher {
    position: fixed;
    top: calc(var(--launcher-top) + var(--launcher-size) + var(--launcher-gap));
    right: calc(var(--launcher-right) + (var(--launcher-size) - var(--diagnostics-size)) / 2);
    z-index: ${Z.launcher};
    width: var(--diagnostics-size);
    height: var(--diagnostics-size);
    border-radius: 50%;
    background: #2F6BFF;
    border: 2px solid rgba(255,255,255,0.15);
    color: #FFFFFF;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(47,107,255,0.4);
    transition: all 0.15s ease;
    user-select: none;
    touch-action: none;
    overflow: hidden;
    padding: 0;
}

#ab-diagnostics-launcher svg {
    width: var(--diagnostics-icon-size);
    height: var(--diagnostics-icon-size);
    pointer-events: none;
}

#ab-diagnostics-launcher:hover {
    background: #4A82FF;
    box-shadow: 0 6px 20px rgba(47,107,255,0.6);
    transform: scale(1.1);
}

#ab-diagnostics-launcher:active {
    transform: scale(0.9);
    transition-duration: 0.05s;
}
`;
  var _CompanionApp = class _CompanionApp {
    constructor(moduleManager) {
      __publicField(this, "moduleManager");
      __publicField(this, "launcher", null);
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
      style.textContent = LAUNCHER_CSS;
      document.head.appendChild(style);
    }
    /** Start the Companion application and create the launcher UI. */
    start() {
      if (this.started) return;
      this.injectStyles();
      this.createUI();
      this.started = true;
      diag("initialized");
    }
    // -------------------------------------------------------------------------
    // UI
    // -------------------------------------------------------------------------
    createUI() {
      if (!document.body) {
        throw new Error("CompanionApp.createUI(): document.body not available");
      }
      const btn = document.createElement("button");
      btn.id = "ab-companion-launcher";
      btn.title = "Companion";
      btn.innerHTML = COMPANION_LOGO_WHITE_SVG;
      btn.addEventListener("click", () => this.onLauncherClick());
      document.body.appendChild(btn);
      this.launcher = btn;
      getLauncherDiagnostics().track("launcher mounted", true);
      const diagBtn = document.createElement("button");
      diagBtn.id = "ab-diagnostics-launcher";
      diagBtn.title = "Copy Debug Bundle";
      diagBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,8 4,8 6,3 8,13 10,8 12,8"/></svg>`;
      diagBtn.addEventListener("click", () => this.onDiagnosticsClick());
      document.body.appendChild(diagBtn);
      getLauncherDiagnostics().track("launcher visible", true);
      const modal = CompanionModal.getInstance();
      modal.setOnVisibilityChange(() => this.syncLauncherState());
    }
    syncLauncherState() {
      if (!this.launcher) return;
      const modal = CompanionModal.getInstance();
      this.launcher.classList.toggle("active", modal.isVisible);
    }
    onLauncherClick() {
      CompanionModal.getInstance().toggle();
    }
    async onDiagnosticsClick() {
      try {
        const ok = await copyDebugBundle();
        showToast(ok ? "Debug Bundle copied to clipboard." : "Failed to copy Debug Bundle.", !ok);
      } catch (e) {
        diag("Diagnostics launcher error:", e);
        showToast("Failed to generate Debug Bundle.", true);
      }
    }
  };
  /** Singleton guard — prevents multiple instances. */
  __publicField(_CompanionApp, "instance", null);
  var CompanionApp = _CompanionApp;

  // ../src/companion/storage-migration.ts
  var FINANCE_SHIFT_TYPES = ["morning", "day", "night"];
  var DEFAULT_FINANCE_STATE = {
    x: 24,
    y: 24,
    width: 360,
    height: 380,
    collapsed: true,
    hidden: false
  };
  function isFinanceShift(value) {
    return typeof value === "string" && FINANCE_SHIFT_TYPES.includes(value);
  }
  function readValidatedState(raw) {
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      if (value && typeof value === "object" && typeof value.x === "number" && typeof value.y === "number" && typeof value.width === "number" && value.width > 0 && typeof value.height === "number" && value.height > 0 && typeof value.collapsed === "boolean" && typeof value.hidden === "boolean") {
        const state = {
          x: value.x,
          y: value.y,
          width: value.width,
          height: value.height,
          collapsed: value.collapsed,
          hidden: value.hidden
        };
        if (isFinanceShift(value.shift)) {
          state.shift = value.shift;
        }
        return state;
      }
    } catch {
    }
    return null;
  }
  function readLegacyWidgetState(raw) {
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== "object") return null;
      const state = { ...DEFAULT_FINANCE_STATE };
      if (typeof value.width === "number" && value.width > 0) {
        state.width = value.width;
      }
      if (typeof value.height === "number" && value.height > 0) {
        state.height = value.height;
      }
      if (typeof value.collapsed === "boolean") {
        state.collapsed = value.collapsed;
      }
      if (typeof value.closed === "boolean") {
        state.hidden = value.closed;
      }
      return state;
    } catch {
    }
    return null;
  }
  function readShift(raw) {
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      if (isFinanceShift(value)) {
        return value;
      }
      if (value && typeof value === "object" && isFinanceShift(value.shift)) {
        return value.shift;
      }
    } catch {
    }
    return null;
  }
  function migrateFinanceStateV1toV2() {
    const existingRaw = StorageService.get(STORAGE_KEYS.FINANCE_WIDGET_STATE);
    const financeStateRaw = StorageService.get(STORAGE_KEYS.FINANCE_STATE);
    const legacyWidgetRaw = StorageService.get(STORAGE_KEYS.LEGACY_FINANCE_WIDGET);
    const legacyPresetRaw = StorageService.get(STORAGE_KEYS.LEGACY_FINANCE_PRESET);
    if (existingRaw || financeStateRaw || legacyWidgetRaw || legacyPresetRaw) {
      const state = readValidatedState(existingRaw) ?? readLegacyWidgetState(legacyWidgetRaw) ?? { ...DEFAULT_FINANCE_STATE };
      const shift = readShift(existingRaw) ?? readShift(financeStateRaw) ?? readShift(legacyPresetRaw);
      if (shift) {
        state.shift = shift;
      }
      try {
        StorageService.set(STORAGE_KEYS.FINANCE_WIDGET_STATE, JSON.stringify(state));
      } catch (error) {
        diag("Finance state migration: failed to write unified state", error);
      }
    }
    StorageService.remove(STORAGE_KEYS.FINANCE_STATE);
    StorageService.remove(STORAGE_KEYS.LEGACY_FINANCE_WIDGET);
    StorageService.remove(STORAGE_KEYS.LEGACY_FINANCE_PRESET);
  }
  var MIGRATIONS = [
    { from: 1, to: 2, migrate: migrateFinanceStateV1toV2 }
  ];
  function runMigrations() {
    const storedVersion = getStoredVersion();
    if (storedVersion >= STORAGE_VERSION) {
      return;
    }
    if (storedVersion === 0) {
      setStoredVersion(STORAGE_VERSION);
      diag("Storage initialized at version", STORAGE_VERSION);
      return;
    }
    diag("Storage migration needed:", storedVersion, "\u2192", STORAGE_VERSION);
    let currentVersion = storedVersion;
    for (const migration of MIGRATIONS) {
      if (migration.from === currentVersion) {
        try {
          diag("Running migration:", migration.from, "\u2192", migration.to);
          migration.migrate();
          currentVersion = migration.to;
        } catch (error) {
          diag("Migration failed:", migration.from, "\u2192", migration.to, error);
          return;
        }
      }
    }
    setStoredVersion(STORAGE_VERSION);
    diag("Storage migration complete at version", STORAGE_VERSION);
  }

  // ../src/companion/bootstrap-coordinator.ts
  var BootstrapCoordinator = class {
    constructor(runtime, globalState, diagnostics, manager, financeModule, modal, app) {
      this.runtime = runtime;
      this.globalState = globalState;
      this.diagnostics = diagnostics;
      this.manager = manager;
      this.financeModule = financeModule;
      this.modal = modal;
      this.app = app;
    }
    start() {
      try {
        if (this.runtime.getReadyState() === "loading") {
          this.runtime.onDomReady(() => this.start());
          return;
        }
        if (this.globalState.get("__AB_COMPANION_APP__")) {
          diag("Bootstrap already completed, skipping");
          return;
        }
        this.globalState.set("__AB_COMPANION_APP__", true);
        if (!this.runtime.isTopFrame()) {
          diag("Skipping iframe context");
          return;
        }
        diag("Bootstrap started");
        this.run().catch((error) => this.handleError(error));
        diag("Bootstrap finished");
      } catch (error) {
        this.handleError(error);
      }
    }
    async run() {
      await waitForStorageReady();
      this.diagnostics.track("main() started", true);
      this.diagnostics.track("document ready", true);
      if (isDevMode()) diag("[bootstrap] createApp() start");
      diag("Running storage migrations");
      runMigrations();
      diag("Injecting platform services");
      this.manager.injectPlatformServices();
      diag("Initializing modules");
      await this.manager.initializeAll();
      this.diagnostics.setModuleInfo({
        registeredIds: this.manager.getRegisteredIds(),
        initializationOrder: this.manager.getInitializationOrder(),
        initializationFailures: Array.from(this.manager.getInitializationFailures()).map(([id, error]) => ({ id, error }))
      });
      setRegisteredModules(this.manager.getAll().map((m) => m.id));
      this.diagnostics.track("root container created", true);
      this.modal.setFinanceClickHandler(() => {
        if (isDevMode()) diag("[bootstrap] Finance button clicked, toggling FinanceModule");
        this.financeModule?.toggle();
      });
      this.diagnostics.track("launcher created", true);
      diag("Starting CompanionApp");
      this.app.start();
      if (isDevMode()) diag("[bootstrap] Restoring Finance module visibility");
      this.financeModule?.restoreVisibility();
      exposeDiagnostics();
      this.diagnostics.track("initialization completed", true);
      if (isDevMode()) diag("[bootstrap] createApp() end");
    }
    handleError(error) {
      diagError("Bootstrap failed:", error);
      this.diagnostics.track(
        "start",
        false,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error.stack : void 0
      );
      try {
        this.globalState.set("__AB_COMPANION_APP__", true);
      } catch {
      }
    }
  };

  // ../src/companion/create-composition.ts
  async function createComposition(platform, runtime, globalState) {
    setPlatform(platform);
    setRuntimeEnvironment(runtime);
    setGlobalState(globalState);
    const diagnostics = new LauncherDiagnostics();
    setLauncherDiagnostics(diagnostics);
    diagnostics.setActiveImplementations(
      platform.constructor.name,
      runtime.constructor.name,
      globalState.constructor.name
    );
    await initStorage();
    const manager = new ModuleManager();
    const financeModule = new FinanceModule();
    manager.register(financeModule);
    const modal = new CompanionModal();
    CompanionModal.initInstance(modal);
    const app = new CompanionApp(manager);
    return new BootstrapCoordinator(
      getRuntimeEnvironment(),
      getGlobalState(),
      getLauncherDiagnostics(),
      manager,
      financeModule,
      modal,
      app
    );
  }

  // ../src/companion/chrome-platform.ts
  var ChromePlatform = class {
    constructor() {
      __publicField(this, "localStorage", {
        getItem(key) {
          try {
            return localStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem(key, value) {
          try {
            localStorage.setItem(key, value);
          } catch {
          }
        },
        removeItem(key) {
          try {
            localStorage.removeItem(key);
          } catch {
          }
        },
        clear() {
          try {
            localStorage.clear();
          } catch {
          }
        }
      });
      __publicField(this, "chromeStorage", (() => {
        try {
          if (typeof chrome !== "undefined" && chrome.storage?.local) {
            return {
              getAll() {
                return chrome.storage.local.get(null).then((all) => {
                  const result = {};
                  for (const [key, value] of Object.entries(all)) {
                    if (typeof value === "string") {
                      result[key] = value;
                    }
                  }
                  return result;
                });
              },
              set(key, value) {
                return chrome.storage.local.set({ [key]: value });
              },
              remove(key) {
                return chrome.storage.local.remove(key);
              },
              clear() {
                return chrome.storage.local.clear();
              }
            };
          }
        } catch {
        }
        return null;
      })());
    }
    isExtension() {
      try {
        return typeof chrome !== "undefined" && !!chrome.runtime?.id;
      } catch {
        return false;
      }
    }
    isTopFrame() {
      try {
        return window === window.top;
      } catch {
        return true;
      }
    }
    getExtensionVersion() {
      try {
        if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
          return chrome.runtime.getManifest().version;
        }
      } catch {
      }
      return "0.0.0";
    }
    getGlobal(key) {
      try {
        return window[key];
      } catch {
        return void 0;
      }
    }
    setGlobal(key, value) {
      try {
        window[key] = value;
      } catch {
      }
    }
    getReadyState() {
      try {
        return document.readyState;
      } catch {
        return "complete";
      }
    }
    onDomReady(callback) {
      try {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", callback);
        } else {
          queueMicrotask(callback);
        }
      } catch {
        queueMicrotask(callback);
      }
    }
  };

  // ../src/companion/bootstrap.ts
  var coordinatorPromise = createComposition(
    new ChromePlatform(),
    new ChromeRuntimeEnvironment(),
    new ChromeGlobalState()
  );
  async function bootstrap() {
    const coordinator = await coordinatorPromise;
    coordinator.start();
  }
  if (!getRuntimeEnvironment().isExtension()) {
    bootstrap();
  }
})();
})();
