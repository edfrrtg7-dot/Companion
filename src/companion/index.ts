/**
 * Companion Module
 *
 * Provides cross-tab and cross-device coordination,
 * including the Finance API client for server-side data access.
 */

// CompanionApp — application launcher and module registry
export { CompanionApp } from "./companion-app";
export type { CompanionModule } from "./companion-module";

// ModuleManager — module registration and lifecycle
export { ModuleManager } from "./module-manager";

// CompanionWindow — base class for draggable, resizable, collapsible windows
export { CompanionWindow } from "./companion-window";
export type { WindowState, CompanionWindowConfig } from "./companion-window";

// FinanceApiClient — HTTP communication layer
export { FinanceApiClient } from "./finance-api-client";
export type { FinanceApiResponse, FinanceApiClientConfig } from "./finance-api-client";
export {
    FinanceApiError,
    FinanceApiAbortError,
    FinanceApiHttpError,
    FinanceApiParseError,
    FinanceApiServerError,
} from "./finance-api-client";

// FinanceMapper — type-safe response mapping
export { FinanceMapper } from "./finance-mapper";
export type {
    FinanceRawResponse,
    FinanceRawTransaction,
    FinanceResponse,
    FinanceTransaction,
} from "./finance-mapper";
export { Operation } from "./finance-mapper";
export {
    FinanceMapperError,
    FinanceMapperValidationError,
} from "./finance-mapper";

// FinanceShift — shift definitions and date calculation
export { FinanceShift } from "./finance-shift";
export type { ShiftType, ShiftDefinition, ShiftDateRange } from "./finance-shift";

// FinanceController — orchestration layer
export { FinanceController } from "./finance-controller";
export type {
    FinanceState,
    FinanceStatus,
    FinanceStateListener,
    FinanceControllerConfig,
} from "./finance-controller";

// FinanceWidget — DOM-based UI
export { FinanceWidget } from "./finance-widget";
export type { FinanceWidgetConfig } from "./finance-widget";

// Brand assets
export { COMPANION_LOGO_SVG, COMPANION_LOGO_DATA_URI } from "./brand-logo";
export { BRAND_COLORS } from "./brand-colors";
