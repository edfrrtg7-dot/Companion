/**
 * CompanionApp
 *
 * Main Companion application. Provides a floating launcher
 * and manages registered modules (Finance, and future modules).
 *
 * Modules register themselves via registerModule().
 * The launcher toggles modules open/closed.
 *
 * This is the application's single entry point and launcher.
 * No standalone module launchers should exist.
 */

import { ModuleManager } from "./module-manager";
import { diag } from "./dev";

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const LAUNCHER_BUTTON_CSS = `
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

// ---------------------------------------------------------------------------
// CompanionApp
// ---------------------------------------------------------------------------

export class CompanionApp {
    /** Singleton guard — prevents multiple instances. */
    private static instance: CompanionApp | null = null;

    private readonly moduleManager: ModuleManager;
    private launcher: HTMLButtonElement | null = null;
    private moduleMenu: HTMLDivElement | null = null;

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
        style.textContent = LAUNCHER_BUTTON_CSS;
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
        // Launcher button
        const btn = document.createElement("button");
        btn.id = "ab-companion-launcher";
        btn.title = "Companion";
        btn.textContent = "C";
        btn.addEventListener("click", () => this.onLauncherClick());
        document.body.appendChild(btn);
        this.launcher = btn;

        // Module menu
        const menu = document.createElement("div");
        menu.id = "ab-companion-modules";
        document.body.appendChild(menu);
        this.moduleMenu = menu;

        this.buildMenuItems();
    }

    private buildMenuItems(): void {
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

    private updateMenuItems(): void {
        if (!this.moduleMenu) return;
        const items = this.moduleMenu.querySelectorAll(".ab-companion-module-item");
        items.forEach((el) => {
            const modName = (el as HTMLElement).dataset.module;
            if (!modName) return;
            const mod = this.moduleManager.get(modName);
            if (mod && mod.isOpen) {
                el.classList.add("open");
            } else {
                el.classList.remove("open");
            }
        });
    }

    private onLauncherClick(): void {
        if (!this.moduleMenu) return;

        if (this.moduleMenu.classList.contains("open")) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    private openMenu(): void {
        if (!this.moduleMenu || !this.launcher) return;
        this.updateMenuItems();
        this.moduleMenu.classList.add("open");
        this.launcher.classList.add("active");
    }

    private closeMenu(): void {
        if (!this.moduleMenu || !this.launcher) return;
        this.moduleMenu.classList.remove("open");
        this.launcher.classList.remove("active");
    }

    private onModuleItemClick(name: string): void {
        this.moduleManager.toggle(name);
        this.updateMenuItems();
        this.closeMenu();
    }
}
