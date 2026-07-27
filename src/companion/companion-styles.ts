import { Z } from "./layering";

let modalStylesInjected = false;

export function injectStyles(): void {
    if (modalStylesInjected) return;
    modalStylesInjected = true;
    const style = document.createElement('style');
    style.id = 'ab-companion-styles';
    style.textContent = COMPANION_STYLES_CSS;
    document.head.appendChild(style);
}

/** Show a temporary toast notification. */
export function showToast(message: string, isError = false): void {
    injectStyles();
    const toast = document.createElement('div');
    toast.className = 'ab-toast';
    toast.textContent = message;
    if (isError) toast.style.background = 'var(--ab-danger)';
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'ab-slide-up 0.2s reverse forwards';
        setTimeout(() => toast.remove(), 200);
    }, 2500);
}

// ---------------------------------------------------------------------------
// Companion styles
// ---------------------------------------------------------------------------

export const COMPANION_STYLES_CSS = `
/* ── Variables ── */
:root {
    --ab-bg: rgba(15, 23, 42, 0.85);
    --ab-bg-card: rgba(30, 41, 59, 0.6);
    --ab-text: #f8fafc;
    --ab-text-dim: #94a3b8;
    --ab-accent: #2F6BFF;
    --ab-accent-hover: #4A82FF;
    --ab-border: rgba(255, 255, 255, 0.1);
    --ab-danger: #ef4444;
    --ab-success: #10b981;
    --ab-warning: #f59e0b;
    --ab-font: system-ui, -apple-system, sans-serif;
}

/* ── Overlay ── */
.ab-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(4px);
    z-index: ${Z.modal};
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--ab-font);
    color: var(--ab-text);
    opacity: 0;
    transition: opacity 0.15s ease;
}
.ab-overlay.visible { opacity: 1; }

/* ── Modal ── */
.ab-modal {
    background: var(--ab-bg);
    border-radius: 12px;
    width: 400px;
    max-height: 90vh;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);
    border: 1px solid var(--ab-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform: scale(0.95);
    transition: transform 0.15s ease;
}
.ab-modal.large { width: 600px; }
.ab-modal.small { width: 320px; }
.ab-overlay.visible .ab-modal { transform: scale(1); }

/* ── Header ── */
.ab-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--ab-border);
}
.ab-header-brand {
    display: flex;
    align-items: center;
    gap: 8px;
}
.ab-header-logo {
    width: 22px;
    height: 22px;
}
.ab-header-title {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.2px;
}
.ab-header-right {
    display: flex;
    align-items: center;
    gap: 12px;
}
.ab-header-version {
    font-size: 11px;
    color: var(--ab-text-dim);
    font-weight: 500;
    letter-spacing: 0.3px;
}
.ab-modal.small .ab-header {
    justify-content: center;
}
.ab-modal.small .ab-header h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
}
.ab-close-icon {
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.15s;
    display: flex;
}
.ab-close-icon:hover { opacity: 1; }
.ab-close-icon:focus-visible {
    outline: 2px solid var(--ab-accent);
    outline-offset: 2px;
    border-radius: 4px;
}
.ab-close-icon svg { width: 20px; height: 20px; fill: var(--ab-text); }

/* ── Content ── */
.ab-content {
    padding: 16px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 75vh;
}

/* ── Sections ── */
.ab-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.ab-section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--ab-accent);
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(47,107,255,0.3);
}
.ab-content::-webkit-scrollbar { width: 6px; }
.ab-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }

/* ── Grid / Cards ── */
.ab-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}
.ab-grid-compact {
    gap: 8px;
}
.ab-card {
    background: var(--ab-bg-card);
    border: 1px solid var(--ab-border);
    border-radius: 10px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color 0.15s ease, background 0.15s ease;
}
.ab-card-compact {
    padding: 8px 10px;
    gap: 4px;
}
.ab-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    background: rgba(30, 41, 59, 0.8);
}
.ab-card-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--ab-text-dim);
}
.ab-card-value {
    font-size: 15px;
    font-weight: 600;
    color: var(--ab-text);
    display: flex;
    align-items: center;
    gap: 6px;
}

/* ── Status indicator ── */
.ab-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ab-danger);
    flex-shrink: 0;
}
.ab-status-dot.active {
    background: var(--ab-success);
}

/* ── Actions grid ── */
.ab-actions-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.ab-actions-row .ab-btn {
    justify-content: center;
}

/* ── Full-width button ── */
.ab-btn-full {
    width: 100%;
    justify-content: center;
}

/* ── Buttons ── */
.ab-btn {
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--ab-border);
    border-radius: 8px;
    padding: 10px 16px;
    color: var(--ab-text);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    font-family: var(--ab-font);
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 8px;
}
.ab-btn:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.2);
}
.ab-btn:active { transform: scale(0.98); transition-duration: 0.05s; }
.ab-btn:focus-visible {
    outline: 2px solid var(--ab-accent);
    outline-offset: 2px;
}
.ab-btn.primary {
    background: var(--ab-accent);
    border-color: var(--ab-accent);
    color: #fff;
}
.ab-btn.primary:hover { background: var(--ab-accent-hover); }
.ab-btn.danger {
    background: rgba(239,68,68,0.2);
    border-color: rgba(239,68,68,0.4);
    color: #fca5a5;
}
.ab-btn.danger:hover { background: rgba(239,68,68,0.3); }

/* ── Diagnostics ── */
.ab-diag-group { margin-bottom: 16px; }
.ab-diag-group h3 {
    margin: 0 0 8px 0;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--ab-accent);
    border-bottom: 1px solid rgba(47,107,255,0.3);
    padding-bottom: 4px;
}
.ab-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}
.ab-table td {
    padding: 4px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    word-break: break-all;
    transition: background 0.1s ease;
}
.ab-table tr:hover td {
    background: rgba(255, 255, 255, 0.03);
}
.ab-table td:first-child {
    color: var(--ab-text-dim);
    width: 45%;
}

/* ── Toast ── */
.ab-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--ab-success);
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    z-index: ${Z.toast};
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: ab-slide-up 0.2s forwards;
}
@keyframes ab-slide-up {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

/* ── Empty state ── */
.ab-empty {
    text-align: center;
    color: var(--ab-text-dim);
    font-size: 13px;
    padding: 20px 0;
}
`;