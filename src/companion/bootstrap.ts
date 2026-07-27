/**
 * Companion Bootstrap
 *
 * Single entry point for the Companion application.
 * Creates FinanceController, FinanceWidget, CompanionModal, CompanionApp.
 *
 * Two independent systems:
 *   - Companion: launcher → modal (Status | Actions | Finance)
 *   - Finance: standalone FinanceWidget, auto-launched on startup, opened via Finance Module API
 *
 * Responsibilities:
 *   - Wait for DOM ready
 *   - Prevent duplicate initialization (idempotent)
 *   - Run storage migrations
 *   - Error boundaries (failures never break CRM)
 *   - Diagnostic logging (dev mode only)
 */

import { CompanionApp } from "./companion-app";
import { CompanionModule } from "./companion-module";
import { ModuleManager } from "./module-manager";
import { CompanionModal } from "./companion-modal";
import { FinanceController } from "./finance-controller";
import { FinanceWidget } from "./finance-widget";
import { FINANCE_WIDGET_CSS } from "./finance-widget.css";
import { collectDiagnostics } from "./companion-diagnostics";
import { setFinanceController } from "./companion-diagnostics-collectors";
import { diag, diagError, diagWarn } from "./dev";
import { runMigrations } from "./storage-migration";
import { setRegisteredModules, exposeDiagnostics } from "./companion-diagnostics";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let app: CompanionApp | null = null;
let modal: CompanionModal | null = null;
let widget: FinanceWidget | null = null;
let financeController: FinanceController | null = null;
let financeStylesInjected = false;
let financeWidgetInitialized = false;

// ---------------------------------------------------------------------------
// Style injection
// ---------------------------------------------------------------------------

function injectFinanceStyles(): void {
    if (financeStylesInjected) return;
    financeStylesInjected = true;
    const style = document.createElement("style");
    style.id = "ab-finance-styles";
    style.textContent = FINANCE_WIDGET_CSS;
    document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Finance — standalone widget
// ---------------------------------------------------------------------------

function ensureFinanceController(): void {
    if (financeController) return;
    financeController = new FinanceController();
    setFinanceController(financeController);
}

function ensureFinanceWidget(): void {
    if (financeWidgetInitialized) return;
    financeWidgetInitialized = true;
    injectFinanceStyles();
    ensureFinanceController();
    widget = new FinanceWidget(financeController!);
    widget.hide();
}

function createFinanceModule(): CompanionModule {
    return {
        name: "finance",
        label: "Finance",
        open(): void {
            ensureFinanceWidget();
            widget?.show();
            diag("Finance shown (standalone)");
        },
        close(): void {
            widget?.hide();
            diag("Finance closed");
        },
        get isOpen(): boolean {
            return widget?.isVisible ?? false;
        },
        destroy(): void {
            widget?.destroy();
            financeController?.cancelPending();
            widget = null;
            financeController = null;
            financeWidgetInitialized = false;
        },
    };
}

// ---------------------------------------------------------------------------
// App creation
// ---------------------------------------------------------------------------

function createApp(): void {
    diag("Creating ModuleManager");
    const manager = new ModuleManager();

    diag("Registering Finance module");
    manager.register(createFinanceModule());

    setRegisteredModules(manager.getAll().map((m) => m.name));

    diag("Creating CompanionModal");
    modal = CompanionModal.getInstance();

    // Finance Widget button in Manager tab opens FinanceWidget
    modal.setFinanceClickHandler(() => {
        manager.open("finance");
    });

    diag("Creating CompanionApp");
    app = new CompanionApp(manager);

    diag("Starting CompanionApp");
    app.start();

    // Auto-launch Finance on startup
    manager.open("finance");

    exposeDiagnostics();
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export function bootstrap(): void {
    try {
        // Wait for DOM ready
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", bootstrap);
            return;
        }

        // Guard: only run once
        if ((window as any).__AB_COMPANION_APP__) {
            diagWarn("Bootstrap already completed, skipping");
            return;
        }
        (window as any).__AB_COMPANION_APP__ = true;

        // Guard: top frame only
        if (window !== window.top) {
            diag("Skipping iframe context");
            return;
        }

        diag("Bootstrap started");

        // Run storage migrations
        runMigrations();

        // Create and start application
        createApp();

        diag("Bootstrap finished");
    } catch (error) {
        diagError("Bootstrap failed:", error);
        try {
            (window as any).__AB_COMPANION_APP__ = true;
        } catch { /* ignore */ }
    }
}

// Auto-bootstrap when loaded as userscript (Tampermonkey)
// Content script imports and calls bootstrap() explicitly
const _isExtension = typeof chrome !== "undefined" && !!chrome.runtime?.id;
if (!_isExtension) {
    bootstrap();
}
