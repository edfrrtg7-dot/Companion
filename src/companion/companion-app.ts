/**
 * CompanionApp
 *
 * Main Companion application. Provides a floating launcher button
 * that toggles the CompanionModal window.
 *
 * The modal handles Dashboard | Manager | Diagnostics tabs.
 * Finance lives independently via FinanceWidget.
 */

import { ModuleManager } from "./module-manager";
import { CompanionModal } from "./companion-modal";
import { diag } from "./dev";

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const LAUNCHER_CSS = `
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
`;

// ---------------------------------------------------------------------------
// CompanionApp
// ---------------------------------------------------------------------------

export class CompanionApp {
    /** Singleton guard — prevents multiple instances. */
    private static instance: CompanionApp | null = null;

    private readonly moduleManager: ModuleManager;
    private launcher: HTMLButtonElement | null = null;

    constructor(moduleManager: ModuleManager) {
        if (CompanionApp.instance) {
            throw new Error("CompanionApp is a singleton. Use CompanionApp.getInstance() or check existing instance.");
        }
        CompanionApp.instance = this;
        this.moduleManager = moduleManager;
    }

    private injectStyles(): void {
        const existing = document.getElementById("ab-companion-styles");
        if (existing) return;
        const style = document.createElement("style");
        style.id = "ab-companion-styles";
        style.textContent = LAUNCHER_CSS;
        document.head.appendChild(style);
    }

    private started = false;

    /** Start the Companion application and create the launcher UI. */
    start(): void {
        if (this.started) return;
        this.started = true;
        this.injectStyles();
        this.createUI();
        diag("initialized");
    }

    // -------------------------------------------------------------------------
    // UI
    // -------------------------------------------------------------------------

    private createUI(): void {
        if (!document.body) return;

        // Launcher button
        const btn = document.createElement("button");
        btn.id = "ab-companion-launcher";
        btn.title = "Companion";
        btn.textContent = "C";
        btn.addEventListener("click", () => this.onLauncherClick());
        document.body.appendChild(btn);
        this.launcher = btn;
    }

    private onLauncherClick(): void {
        const modal = CompanionModal.getInstance();
        modal.toggle();

        // Update launcher active state
        if (this.launcher) {
            if (modal.isVisible) {
                this.launcher.classList.add("active");
            } else {
                this.launcher.classList.remove("active");
            }
        }
    }
}
