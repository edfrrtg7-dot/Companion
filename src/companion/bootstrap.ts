/**
 * Finance Companion Bootstrap
 *
 * Entry point that creates FinanceController and FinanceWidget.
 * This file is the only one that should reference both controller and widget.
 */

import { FinanceController } from "./finance-controller";
import { FinanceWidget } from "./finance-widget";
import { FINANCE_WIDGET_CSS } from "./finance-widget.css";

function injectStyles(): void {
    const style = document.createElement("style");
    style.id = "ab-finance-styles";
    style.textContent = FINANCE_WIDGET_CSS;
    document.head.appendChild(style);
}

function bootstrap(): void {
    // Wait for DOM ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrap);
        return;
    }

    // Guard: only run once
    if ((window as any).__AB_FINANCE_COMPANION__) return;
    (window as any).__AB_FINANCE_COMPANION__ = true;

    // Guard: top frame only
    if (window !== window.top) return;

    // Inject CSS
    injectStyles();

    // Create controller
    const controller = new FinanceController();

    // Create widget — no reopen button, Finance is reopened only through Companion Manage
    new FinanceWidget(controller);
}

bootstrap();
