/**
 * FinanceModule — Companion platform integration for the Finance feature.
 *
 * Implements CompanionModule, wraps FinanceController and FinanceWidget,
 * and integrates with all platform infrastructure services.
 *
 * Lifecycle guarantees:
 * - initialize() may be called once. Subsequent calls are no-ops.
 * - dispose() may be called once. Subsequent calls are no-ops.
 * - After dispose(), internal references are nulled. open()/close() become no-ops.
 * - Re-initialization after dispose() is not supported.
 * - toggle() when hidden destroys the previous widget (if any) and constructs
 *   exactly one new widget backed by the existing controller, preserving
 *   persisted geometry and off-screen recovery. Controller identity unchanged.
 */

import { CompanionModule, ModuleId, ModuleMetadata, ModuleCapabilities } from "./platform";
import { PlatformServices, InitializableModule } from "./module-manager";
import { FinanceController, FinanceState, FinanceStatus } from "./finance-controller";
import { FinanceWidget } from "./finance-widget";
import { FinanceTransaction } from "./finance-mapper";
import { txIdentity } from "./finance-controller";
import { ShiftType } from "./finance-shift";
import { FINANCE_WIDGET_CSS } from "./finance-widget.css";
import { setFinanceController } from "./companion-diagnostics-collectors";
import { diag, isDevMode } from "./dev";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinanceSnapshot {
    readonly transactionIds: ReadonlyArray<string>;
    readonly shift: ShiftType;
    readonly credits: number;
    readonly status: FinanceStatus;
    readonly unviewedCount: number;
}

export interface FinanceDiff {
    readonly addedTransactions: number;
    readonly removedTransactions: number;
    readonly shiftChanged: boolean;
    readonly creditsChanged: boolean;
    readonly statusChanged: boolean;
    readonly unviewedChanged: boolean;
}

// ---------------------------------------------------------------------------
// FinanceModule
// ---------------------------------------------------------------------------

const FINANCE_MODULE_ID: ModuleId = "finance";

export class FinanceModule implements CompanionModule<FinanceSnapshot, FinanceDiff>, InitializableModule<FinanceSnapshot, FinanceDiff> {
    readonly id: ModuleId = FINANCE_MODULE_ID;
    readonly metadata: ModuleMetadata = {
        name: "Finance",
        version: "1.0.0",
        description: "Finance transaction viewer with shift-based filtering and unread tracking"
    };
    readonly capabilities: ModuleCapabilities = {
        snapshot: true,
        diagnostics: true,
        versioning: true,
        export: false,
        events: true
    };

    private platformServices: PlatformServices | null = null;
    private controller: FinanceController | null = null;
    private widget: FinanceWidget | null = null;
    private initialized = false;
    private disposed = false;
    private lastSnapshot: FinanceSnapshot | null = null;
    private unsubscribeController: (() => void) | null = null;
    private stylesInjected = false;

    // -----------------------------------------------------------------------
    // Dependency Injection
    // -----------------------------------------------------------------------

    injectPlatformServices(services: PlatformServices): void {
        this.platformServices = services;
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    async initialize(): Promise<void> {
        if (this.initialized) return;
        if (this.disposed) {
            throw new Error("FinanceModule: cannot reinitialize after dispose");
        }
        if (!this.platformServices) {
            throw new Error("FinanceModule: injectPlatformServices must be called before initialize");
        }

        if (isDevMode()) diag("[FinanceModule] initialize()");

        this.injectStyles();

        this.controller = new FinanceController();
        setFinanceController(this.controller);

        this.unsubscribeController = this.controller.subscribe((state: FinanceState) => {
            this.onControllerStateChange(state);
        });

        // Capture initial state as first version
        this.lastSnapshot = this.createSnapshot();

        this.platformServices.versionManager.createVersion(
            this.id,
            "startup",
            this.lastSnapshot,
            Object.freeze({
                addedTransactions: 0,
                removedTransactions: 0,
                shiftChanged: false,
                creditsChanged: false,
                statusChanged: false,
                unviewedChanged: false
            })
        );

        this.initialized = true;

        await this.platformServices.eventBus.publish(
            "finance:initialized",
            { moduleId: this.id },
            this.id
        );

        if (isDevMode()) diag("[FinanceModule] initialized");
    }

    async dispose(): Promise<void> {
        if (this.disposed) return;

        if (isDevMode()) diag("[FinanceModule] dispose()");

        if (this.unsubscribeController) {
            this.unsubscribeController();
            this.unsubscribeController = null;
        }

        this.controller?.cancelPending();

        this.widget?.destroy();
        this.widget = null;
        this.controller = null;

        // Capture services before clearing — used for event publication
        const services = this.platformServices;
        this.platformServices = null;

        this.disposed = true;
        this.initialized = false;

        if (services) {
            await services.eventBus.publish(
                "finance:disposed",
                { moduleId: this.id },
                this.id
            );
        }

        if (isDevMode()) diag("[FinanceModule] disposed");
    }

    // -----------------------------------------------------------------------
    // Snapshot / Diff
    // -----------------------------------------------------------------------

    createSnapshot(): FinanceSnapshot {
        const state = this.controller?.getState();
        return Object.freeze({
            transactionIds: Object.freeze(
                (state?.data?.list ?? []).map(tx => txIdentity(tx))
            ),
            shift: state?.shift ?? "day",
            credits: state?.data?.total ?? 0,
            status: state?.status ?? "idle",
            unviewedCount: state?.unviewedTransactions ?? 0
        });
    }

    createDiff(previous: FinanceSnapshot, current: FinanceSnapshot): FinanceDiff {
        const prevIds = new Set(previous.transactionIds);
        const currIds = new Set(current.transactionIds);

        let added = 0;
        let removed = 0;

        for (const id of currIds) {
            if (!prevIds.has(id)) added++;
        }
        for (const id of prevIds) {
            if (!currIds.has(id)) removed++;
        }

        return Object.freeze({
            addedTransactions: added,
            removedTransactions: removed,
            shiftChanged: previous.shift !== current.shift,
            creditsChanged: previous.credits !== current.credits,
            statusChanged: previous.status !== current.status,
            unviewedChanged: previous.unviewedCount !== current.unviewedCount
        });
    }

    // -----------------------------------------------------------------------
    // Legacy Interface (Launcher Compatibility)
    // -----------------------------------------------------------------------

    open(): void {
        if (!this.initialized || this.disposed) return;
        if (!this.controller) return;

        if (!this.widget) {
            this.widget = new FinanceWidget(this.controller);
            this.widget.hide();
        }

        this.widget.show();
        if (isDevMode()) diag("[FinanceModule] widget shown");
    }

    /**
     * Restore the widget to its persisted visibility state.
     * Creates the widget if needed but never forces it visible,
     * so a persisted `hidden: true` preference is respected at startup.
     */
    restoreVisibility(): void {
        if (!this.initialized || this.disposed) return;
        if (!this.controller) return;

        if (!this.widget) {
            this.widget = new FinanceWidget(this.controller);
        }
        if (isDevMode()) diag("[FinanceModule] widget visibility restored");
    }

    close(): void {
        if (this.disposed) return;
        this.widget?.hide();
        if (isDevMode()) diag("[FinanceModule] widget hidden");
    }

    /**
     * Destroy the current widget (if any) and create a fresh one backed by
     * the existing controller, then show it. Preserves persisted geometry
     * and off-screen recovery. The controller is retained — no state reset.
     */
    restartWidgetAndShow(): void {
        if (!this.initialized || this.disposed) return;
        if (!this.controller) return;

        if (this.widget) {
            this.widget.destroy();
            this.widget = null;
        }

        this.widget = new FinanceWidget(this.controller);
        this.widget.show();
        if (isDevMode()) diag("[FinanceModule] widget restarted and shown");
    }

    /**
     * Toggle the widget between shown and hidden states. When showing,
     * always constructs a fresh widget instance to guarantee a clean state
     * (DOM, listeners, subscriptions) while preserving the controller and
     * persisted geometry.
     */
    toggle(): void {
        if (this.isOpen) {
            this.close();
        } else {
            this.restartWidgetAndShow();
        }
    }

    get isOpen(): boolean {
        return this.widget?.isVisible ?? false;
    }

    destroy(): void {
        this.dispose();
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    private onControllerStateChange(state: FinanceState): void {
        const current = this.createSnapshot();

        if (this.lastSnapshot && this.platformServices) {
            const diff = this.createDiff(this.lastSnapshot, current);

            this.platformServices.versionManager.createVersion(
                this.id,
                this.resolveReason(state),
                current,
                diff
            );

            // Fire-and-forget event publications — subscriber failures must not
            // block the controller state flow
            if (diff.addedTransactions > 0) {
                void this.platformServices.eventBus.publish(
                    "finance:item-added",
                    { count: diff.addedTransactions },
                    this.id
                );
            }
            if (diff.removedTransactions > 0) {
                void this.platformServices.eventBus.publish(
                    "finance:item-removed",
                    { count: diff.removedTransactions },
                    this.id
                );
            }
        }

        this.lastSnapshot = current;
    }

    private resolveReason(state: FinanceState): string {
        if (state.status === "loading") return "refresh";
        if (state.status === "error") return "api_response";
        if (this.lastSnapshot && state.shift !== this.lastSnapshot.shift) return "shift_change";
        if (state.status === "loaded" && this.lastSnapshot?.status !== "loaded") return "refresh";
        return "user_click";
    }

    private injectStyles(): void {
        if (this.stylesInjected) return;
        this.stylesInjected = true;
        const style = document.createElement("style");
        style.id = "ab-finance-styles";
        style.textContent = FINANCE_WIDGET_CSS;
        document.head.appendChild(style);
    }
}