import { ModuleManager } from "./module-manager";
import { CompanionModal } from "./companion-modal";
import { FinanceModule } from "./finance-module";
import { CompanionApp } from "./companion-app";
import { diag, diagError, isDevMode } from "./dev";
import { runMigrations } from "./storage-migration";
import { setRegisteredModules, exposeDiagnostics } from "./companion-diagnostics";
import type { RuntimeEnvironment } from "./runtime-environment";
import type { GlobalState } from "./global-state";
import type { LauncherDiagnostics } from "./launcher-diagnostics";
import { waitForStorageReady } from "./storage-service";

export class BootstrapCoordinator {
    constructor(
        private readonly runtime: RuntimeEnvironment,
        private readonly globalState: GlobalState,
        private readonly diagnostics: LauncherDiagnostics,
        private readonly manager: ModuleManager,
        private readonly financeModule: FinanceModule,
        private readonly modal: CompanionModal,
        private readonly app: CompanionApp,
    ) {}

    start(): void {
        try {
            // Wait for DOM ready
            if (this.runtime.getReadyState() === "loading") {
                this.runtime.onDomReady(() => this.start());
                return;
            }

            // Guard: only run once
            if (this.globalState.get("__AB_COMPANION_APP__")) {
                diag("Bootstrap already completed, skipping");
                return;
            }
            this.globalState.set("__AB_COMPANION_APP__", true);

            // Guard: top frame only
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

    private async run(): Promise<void> {
        // Ensure storage is fully hydrated before any module initialization
        // that depends on persisted data (defensive: createComposition already awaits this)
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
            initializationOrder: this.manager.getInitializationOrder() as string[],
            initializationFailures: Array.from(this.manager.getInitializationFailures()).map(([id, error]) => ({ id, error })),
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

    private handleError(error: unknown): void {
        diagError("Bootstrap failed:", error);
        this.diagnostics.track(
            "start",
            false,
            error instanceof Error ? error.message : String(error),
            error instanceof Error ? error.stack : undefined,
        );
        try {
            this.globalState.set("__AB_COMPANION_APP__", true);
        } catch { /* ignore */ }
    }
}
