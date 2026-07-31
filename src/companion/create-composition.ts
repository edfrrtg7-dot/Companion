import type { Platform } from "./platform-interface";
import type { RuntimeEnvironment } from "./runtime-environment";
import type { GlobalState } from "./global-state";
import { setPlatform } from "./platform-interface";
import { setRuntimeEnvironment, getRuntimeEnvironment } from "./runtime-environment";
import { setGlobalState, getGlobalState } from "./global-state";
import { LauncherDiagnostics, setLauncherDiagnostics, getLauncherDiagnostics } from "./launcher-diagnostics";
import { ModuleManager } from "./module-manager";
import { FinanceModule } from "./finance-module";
import { CompanionModal } from "./companion-modal";
import { CompanionApp } from "./companion-app";
import { initStorage, waitForStorageReady, StorageService } from "./storage-service";
import { BootstrapCoordinator } from "./bootstrap-coordinator";
import { SessionMemory, getSessionMemory, setSessionMemory } from "./session-memory";

/**
 * Create the complete application object graph for a given set of
 * platform implementations. Returns the BootstrapCoordinator ready to start.
 *
 * Object construction logic is shared between Chrome and Arena entry points.
 * Each entry point provides the appropriate platform implementations and
 * the resulting composition is identical.
 */
export async function createComposition(platform: Platform, runtime: RuntimeEnvironment, globalState: GlobalState): Promise<BootstrapCoordinator> {
    setPlatform(platform);
    setRuntimeEnvironment(runtime);
    setGlobalState(globalState);

    const diagnostics = new LauncherDiagnostics();
    setLauncherDiagnostics(diagnostics);
    diagnostics.setActiveImplementations(
        platform.constructor.name,
        runtime.constructor.name,
        globalState.constructor.name,
    );

    // Wait for storage hydration to complete before initializing modules
    // that depend on persisted data (SessionMemory, FinanceModule)
    await initStorage();

    const sessionMemory = new SessionMemory(StorageService);
    setSessionMemory(sessionMemory);
    sessionMemory.start();

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
        app,
    );
}
