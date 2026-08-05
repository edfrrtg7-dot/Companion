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
.ab-modal.medium { width: 460px; }
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

/* ── Delay Modal: Input groups ── */
.ab-input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
}
.ab-input-group label {
    font-size: 12px;
    color: var(--ab-text-dim);
    font-weight: 500;
}
.ab-input-group input[type="number"] {
    background-color: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--ab-border);
    border-radius: 6px;
    padding: 10px 12px;
    color: var(--ab-text);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 14px;
    line-height: 1.4;
    width: 100%;
    box-sizing: border-box;
    /* Explicit readability in all states */
    caret-color: var(--ab-text);
    opacity: 1;
    -webkit-text-fill-color: var(--ab-text);
}
.ab-input-group input[type="number"]:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background-color: rgba(0, 0, 0, 0.25);
}
.ab-input-group input[type="number"]:focus {
    outline: none;
    border-color: var(--ab-accent);
    background-color: rgba(0, 0, 0, 0.3);
    box-shadow: 0 0 0 2px rgba(47, 107, 255, 0.2);
}
.ab-input-group input[type="number"]::selection {
    background-color: var(--ab-accent);
    color: #fff;
}
.ab-input-group input[type="number"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: rgba(0, 0, 0, 0.15);
    color: var(--ab-text-dim);
}
.ab-input-group input[type="number"]:invalid {
    border-color: var(--ab-danger);
}

/* ── Delay Modal: Actions container ── */
.ab-actions-container {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: flex-end;
    align-items: center;
    width: 100%;
    margin-top: 8px;
}
.ab-actions-container .ab-btn {
    min-width: 80px;
    height: 40px;
    flex-shrink: 0;
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

/* ── Import Dialog ── */
.ab-import-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 8px;
}

.ab-import-warning {
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fcd34d;
    font-size: 12px;
    line-height: 1.45;
    margin-bottom: 8px;
}

.ab-import-error {
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(220, 38, 38, 0.12);
    border: 1px solid rgba(220, 38, 38, 0.4);
    color: #fca5a5;
    font-size: 12px;
    line-height: 1.45;
    margin-bottom: 8px;
}

.ab-import-error[hidden] { display: none; }

/* Live import preview statistics */
.ab-import-stats {
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--ab-border);
    margin-bottom: 8px;
}
.ab-import-stats[hidden] { display: none; }
.ab-import-stats-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--ab-text);
    margin-bottom: 8px;
}
.ab-import-stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
}
.ab-import-stat-label {
    font-size: 12px;
    color: var(--ab-text-dim);
}
.ab-import-stat-value {
    font-size: 12px;
    font-weight: 600;
    color: var(--ab-text);
    text-align: right;
}

.ab-btn-import {
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 10px;
    transition: all 0.15s;
}
.ab-btn-import svg { width: 16px; height: 16px; flex-shrink: 0; }

/* IceBreaker - cool blue */
.ab-btn-import.icebreaker {
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.25), rgba(29, 78, 216, 0.2));
    border-color: rgba(37, 99, 235, 0.4);
    color: #93c5fd;
}
.ab-btn-import.icebreaker:hover {
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.35), rgba(29, 78, 216, 0.3));
    border-color: rgba(37, 99, 235, 0.6);
    color: #bfdbfe;
}

/* Broadcast - warm orange/amber */
.ab-btn-import.broadcast {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.2));
    border-color: rgba(245, 158, 11, 0.4);
    color: #fcd34d;
}
.ab-btn-import.broadcast:hover {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.35), rgba(217, 119, 6, 0.3));
    border-color: rgba(245, 158, 11, 0.6);
    color: #fde047;
}

/* Cancel - burgundy/wine */
.ab-btn-cancel {
    width: 100%;
    padding: 14px 20px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(153, 27, 27, 0.3), rgba(127, 29, 29, 0.25));
    border-color: rgba(153, 27, 27, 0.5);
    color: #fca5a5;
    margin-top: 8px;
}
.ab-btn-cancel:hover {
    background: linear-gradient(135deg, rgba(153, 27, 27, 0.4), rgba(127, 29, 29, 0.35));
    border-color: rgba(153, 27, 27, 0.7);
    color: #fecaca;
}

/* Textarea with line-number gutter */
.ab-import-editor {
    display: flex;
    border: 1px solid var(--ab-border);
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.15s, box-shadow 0.15s;
}
.ab-import-editor:focus-within {
    border-color: var(--ab-accent);
    box-shadow: 0 0 0 3px rgba(47, 107, 255, 0.15);
}
.ab-import-editor.ab-import-editor-error {
    border-color: rgba(220, 38, 38, 0.7);
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);
}

.ab-import-gutter {
    width: 40px;
    flex-shrink: 0;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.04);
    border-right: 1px solid var(--ab-border);
    text-align: right;
}

.ab-import-gutter-numbers {
    padding: 14px 8px 14px 0;
    color: var(--ab-text-dim);
    font-family: var(--ab-font);
    font-size: 13px;
    line-height: 1.5;
    white-space: pre;
    will-change: transform;
    user-select: none;
}

.ab-import-textarea {
    width: 100%;
    min-height: 260px;
    padding: 14px;
    border: none;
    background: var(--ab-bg-card);
    color: var(--ab-text);
    font-family: var(--ab-font);
    font-size: 13px;
    line-height: 1.5;
    white-space: pre;
    overflow-x: auto;
    box-sizing: border-box;
    resize: none;
    outline: none;
}
.ab-import-textarea::placeholder {
    color: var(--ab-text-dim);
    opacity: 0.7;
}

/* Custom scrollbar for textarea */
.ab-import-textarea::-webkit-scrollbar { width: 8px; }
.ab-import-textarea::-webkit-scrollbar-track { background: transparent; }
.ab-import-textarea::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: content-box;
}
.ab-import-textarea::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
    background-clip: content-box;
}
.ab-import-textarea::-webkit-scrollbar-corner { background: transparent; }
`;