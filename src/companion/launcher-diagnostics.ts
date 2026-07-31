import { isDevMode } from "./dev";

export interface LauncherDiagnosticsStage {
    readonly name: string;
    readonly timestamp: number;
    readonly success: boolean;
    readonly error?: string;
    readonly stack?: string;
}

export interface ModuleDiagnosticsInfo {
    readonly registeredIds: readonly string[];
    readonly initializationOrder: readonly string[];
    readonly initializationFailures: ReadonlyArray<{ id: string; error: string }>;
}

export interface LauncherDiagnosticsState {
    readonly enabled: boolean;
    readonly stages: ReadonlyArray<LauncherDiagnosticsStage>;
    readonly lastSuccessfulStage: string | null;
    readonly failed: boolean;
    readonly completed: boolean;
    readonly lastError?: string;
    readonly activePlatform?: string;
    readonly activeRuntime?: string;
    readonly activeGlobalState?: string;
    readonly modules?: ModuleDiagnosticsInfo;
}

export class LauncherDiagnostics {
    private stages: LauncherDiagnosticsStage[] = [];
    private failed = false;
    private completed = false;
    private lastError?: string;
    private platformName?: string;
    private runtimeName?: string;
    private globalStateName?: string;
    private moduleInfo?: ModuleDiagnosticsInfo;

    private get enabled(): boolean {
        return isDevMode();
    }

    setActiveImplementations(platform: string, runtime: string, globalState: string): void {
        this.platformName = platform;
        this.runtimeName = runtime;
        this.globalStateName = globalState;
    }

    setModuleInfo(info: ModuleDiagnosticsInfo): void {
        this.moduleInfo = info;
    }

    track(stageName: string, success: boolean, error?: string, stack?: string): void {
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

    markCompleted(): void {
        if (this.enabled) this.completed = true;
    }

    getState(): LauncherDiagnosticsState {
        const lastSuccessful = [...this.stages].reverse().find(s => s.success);
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
            modules: this.moduleInfo,
        };
    }
}

const defaultInstance = new LauncherDiagnostics();
let currentInstance: LauncherDiagnostics | undefined;

export function getLauncherDiagnostics(): LauncherDiagnostics {
    return currentInstance ?? defaultInstance;
}

export function setLauncherDiagnostics(instance: LauncherDiagnostics): void {
    currentInstance = instance;
}

// Legacy export for diagnostics module compatibility
export const launcherDiagnostics = defaultInstance;
