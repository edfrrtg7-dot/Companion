/**
 * CompanionApp
 *
 * Main Companion application. Provides a floating launcher button
 * that toggles the CompanionModal window.
 *
 * The modal handles Dashboard | Manager tabs.
 * Diagnostics button provides a quick action to copy the Debug Bundle.
 * Finance lives independently via FinanceWidget.
 */

import { ModuleManager } from "./module-manager";
import { CompanionModal } from "./companion-modal";
import { COMPANION_LOGO_WHITE_SVG } from "./brand-logo";
import { diag } from "./dev";
import { Z } from "./layering";
import { copyDebugBundle } from "./companion-diagnostics-collectors";
import { showToast } from "./companion-styles";
import { getLauncherDiagnostics } from "./launcher-diagnostics";

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const LAUNCHER_CSS = `
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
        this.injectStyles();
        this.createUI();
        this.started = true;
        diag("initialized");
    }

    // -------------------------------------------------------------------------
    // UI
    // -------------------------------------------------------------------------

    private createUI(): void {
        if (!document.body) {
            throw new Error("CompanionApp.createUI(): document.body not available");
        }

        // Launcher button
        const btn = document.createElement("button");
        btn.id = "ab-companion-launcher";
        btn.title = "Companion";
        btn.innerHTML = COMPANION_LOGO_WHITE_SVG;
        btn.addEventListener("click", () => this.onLauncherClick());

        document.body.appendChild(btn);
        this.launcher = btn;
        getLauncherDiagnostics().track("launcher mounted", true);

        // Diagnostics launcher button — copy Debug Bundle to clipboard
        const diagBtn = document.createElement("button");
        diagBtn.id = "ab-diagnostics-launcher";
        diagBtn.title = "Copy Debug Bundle";
        diagBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,8 4,8 6,3 8,13 10,8 12,8"/></svg>`;
        diagBtn.addEventListener("click", () => this.onDiagnosticsClick());
        document.body.appendChild(diagBtn);
        getLauncherDiagnostics().track("launcher visible", true);

        // Register visibility change callback to keep launcher state synced
        const modal = CompanionModal.getInstance();
        modal.setOnVisibilityChange(() => this.syncLauncherState());
    }

    private syncLauncherState(): void {
        if (!this.launcher) return;
        const modal = CompanionModal.getInstance();
        this.launcher.classList.toggle("active", modal.isVisible);
    }

    private onLauncherClick(): void {
        CompanionModal.getInstance().toggle();
    }

    private async onDiagnosticsClick(): Promise<void> {
        try {
            const ok = await copyDebugBundle();
            showToast(ok ? "Debug Bundle copied to clipboard." : "Failed to copy Debug Bundle.", !ok);
        } catch (e) {
            diag("Diagnostics launcher error:", e);
            showToast("Failed to generate Debug Bundle.", true);
        }
    }
}
