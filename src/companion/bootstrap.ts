/**
 * Companion Bootstrap
 *
 * Single entry point for the Companion application.
 * Creates CompanionApp, registers Finance module, starts the app.
 *
 * Finance is the first Companion module.
 * Additional modules will be registered here in the future.
 */

import { CompanionApp } from "./companion-app";
import { CompanionModule } from "./companion-module";
import { ModuleManager } from "./module-manager";
import { FinanceController } from "./finance-controller";
import { FinanceWidget } from "./finance-widget";
import { FINANCE_WIDGET_CSS } from "./finance-widget.css";
import { diag } from "./dev";

let app: CompanionApp | null = null;
let widget: FinanceWidget | null = null;
let controller: FinanceController | null = null;
let stylesInjected = false;
let widgetInitialized = false;

function injectFinanceStyles(): void {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement("style");
    style.id = "ab-finance-styles";
    style.textContent = FINANCE_WIDGET_CSS;
    document.head.appendChild(style);
}

/**
 * Lazily initialize the Finance widget on first open.
 * Creates controller and widget, then hides the widget.
 * The widget remains hidden until the user opens it via the Companion launcher.
 */
function ensureFinanceWidget(): void {
    if (widgetInitialized) return;
    widgetInitialized = true;

    injectFinanceStyles();
    controller = new FinanceController();
    widget = new FinanceWidget(controller);
    widget.hide();
    diag("Finance created");
}

function createFinanceModule(): CompanionModule {
    return {
        name: "finance",
        label: "Finance",
        open(): void {
            ensureFinanceWidget();
            widget?.show();
            diag("Finance shown");
        },
        close(): void {
            widget?.hide();
            diag("Finance hidden");
        },
        get isOpen(): boolean {
            return widget?.isVisible ?? false;
        },
        destroy(): void {
            widget?.destroy();
            controller?.cancelPending();
            widget = null;
            controller = null;
            widgetInitialized = false;
        },
    };
}

function createApp(): void {
    const manager = new ModuleManager();
    manager.register(createFinanceModule());
    app = new CompanionApp(manager);
    app.start();
}

export function bootstrap(): void {
    // Wait for DOM ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrap);
        return;
    }

    // Guard: only run once
    if ((window as any).__AB_COMPANION_APP__) return;
    (window as any).__AB_COMPANION_APP__ = true;

    // Guard: top frame only
    if (window !== window.top) return;

    diag("Bootstrap started");
    createApp();
    diag("Bootstrap finished");
}

// Auto-bootstrap when loaded as userscript (Tampermonkey)
// Content script imports and calls bootstrap() explicitly
if (typeof chrome === "undefined" || !chrome.runtime?.id) {
    bootstrap();
}
