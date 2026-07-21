/**
 * Finance Companion Bootstrap
 *
 * Entry point that creates FinanceController and FinanceWidget.
 * This file is the only one that should reference both controller and widget.
 */

import { FinanceController } from "./finance-controller";
import { FinanceWidget } from "./finance-widget";

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

    // Create controller and widget
    const controller = new FinanceController();
    new FinanceWidget(controller);
}

bootstrap();
