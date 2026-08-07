/**
 * Dashboard
 *
 * Renders the Status section: compact 2×3 card grid with visual indicators.
 * Handles Dashboard auto-refresh polling lifecycle.
 *
 * Responsibilities:
 *   - Define DashboardField type and DASHBOARD_FIELDS constant
 *   - Resolve field values from CRM profile
 *   - Render 2-column card grid with labels and values
 *   - Manage refresh interval (start/stop)
 *
 * No state management. No caching. No external dependencies except DashboardService.
 * Invoked by companion-modal.ts to render content.
 */

import { DashboardService } from "./dashboard-service";

type DashboardField = {
    readonly label: string;
    readonly path: string;
    readonly isStatus?: boolean;
};

/** Status fields that display visual indicators. */
const STATUS_FIELDS = new Set(["data.status", "data.broadcast.status"]);

/** Dashboard fields: 2×3 grid (status + progress). */
const DASHBOARD_FIELDS: readonly DashboardField[] = [
    { label: "IceBreaker Status", path: "data.status", isStatus: true },
    { label: "Broadcast Status", path: "data.broadcast.status", isStatus: true },
    { label: "IceBreaker In Progress", path: "data.sended" },
    { label: "IceBreaker Completed", path: "data.delivered" },
    { label: "Broadcast In Progress", path: "data.broadcast.chainProgress" },
    { label: "Broadcast Completed", path: "data.broadcast.sended" },
];

/** Determine if a status value represents an active/running state. */
function isRunningStatus(value: string): boolean {
    const v = value.toLowerCase();
    return v === "running" || v === "progress" || v === "active" || v.includes("running");
}

/**
 * Resolve field value from CRM profile data.
 */
function resolveField(data: Record<string, unknown>, field: DashboardField): string {
    try {
        if (field.path === "data.status") {
            return String((data as any)?.status ?? "Unknown");
        }
        if (field.path === "data.broadcast.status") {
            return String((data as any)?.broadcast?.status ?? "Unknown");
        }
        if (field.path === "data.sended") {
            const s = (data as any)?.sended;
            return typeof s === "string" ? String(s.split(";").filter(Boolean).length) : "0";
        }
        if (field.path === "data.delivered") {
            const d = (data as any)?.delivered;
            return typeof d === "string" ? String(d.split(";").filter(Boolean).length) : "0";
        }
        if (field.path === "data.broadcast.chainProgress") {
            const cp = (data as any)?.broadcast?.chainProgress;
            return cp && typeof cp === "object" ? String(Object.keys(cp).length) : "0";
        }
        if (field.path === "data.broadcast.sended") {
            const s = (data as any)?.broadcast?.sended;
            return typeof s === "string" ? String(s.split(";").filter(Boolean).length) : "0";
        }
        return "N/A";
    } catch {
        return "N/A";
    }
}

/** Create a status indicator dot element. */
function createStatusDot(isActive: boolean): HTMLSpanElement {
    const dot = document.createElement("span");
    dot.className = isActive ? "ab-status-dot active" : "ab-status-dot";
    return dot;
}

/** Render Dashboard cards to the container element. */
function renderDashboard(container: HTMLElement, storageKey?: string): void {
    container.innerHTML = "";
    const data = DashboardService.readCRMData(storageKey);

    if (!data) {
        const empty = document.createElement("div");
        empty.className = "ab-empty";
        empty.textContent = "No CRM data found. Start IceBreaker or Broadcast to see live status.";
        container.appendChild(empty);
        return;
    }

    const grid = document.createElement("div");
    grid.className = "ab-grid ab-grid-compact";

    for (const field of DASHBOARD_FIELDS) {
        const card = document.createElement("div");
        card.className = "ab-card ab-card-compact";

        const label = document.createElement("div");
        label.className = "ab-card-title";
        label.textContent = field.label;

        const value = document.createElement("div");
        value.className = "ab-card-value";

        const text = resolveField(data, field);

        if (field.isStatus) {
            const dot = createStatusDot(isRunningStatus(text));
            value.appendChild(dot);
            const span = document.createElement("span");
            span.textContent = text;
            value.appendChild(span);
        } else {
            value.textContent = text;
        }

        card.appendChild(label);
        card.appendChild(value);
        grid.appendChild(card);
    }

    container.appendChild(grid);
}

/** Update Dashboard when visible. */
function updateDashboard(storageKey?: string): void {
    const container = document.getElementById("ab-status-grid");
    if (container) {
        renderDashboard(container, storageKey);
    }
}

/** Polling management */
let dashboardInterval: ReturnType<typeof setInterval> | null = null;

export function start(): void {
    if (dashboardInterval) return;
    dashboardInterval = setInterval(updateDashboard, 5000);
}

export function stop(): void {
    if (!dashboardInterval) return;
    clearInterval(dashboardInterval);
    dashboardInterval = null;
}

export { DashboardField, DASHBOARD_FIELDS, resolveField, renderDashboard, updateDashboard };

export { DashboardService } from "./dashboard-service";
