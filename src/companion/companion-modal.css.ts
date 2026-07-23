/**
 * CompanionModal CSS
 *
 * Original AgencyBooster Companion styles.
 * Restored from b44e683 — the last userscript commit.
 *
 * These are the exact CSS patterns used by the original overlay/modal system.
 * No redesign. No new visual elements. Just the original styles extracted into a module.
 */

export const COMPANION_MODAL_CSS = `
/* ── Variables ── */
:root {
    --ab-bg: rgba(15, 23, 42, 0.85);
    --ab-bg-card: rgba(30, 41, 59, 0.6);
    --ab-text: #f8fafc;
    --ab-text-dim: #94a3b8;
    --ab-accent: #3b82f6;
    --ab-accent-hover: #2563eb;
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
    z-index: 2147483646;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--ab-font);
    color: var(--ab-text);
    opacity: 0;
    transition: opacity 0.2s ease;
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
    transition: transform 0.2s ease;
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
.ab-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
    letter-spacing: -0.2px;
}
.ab-close-icon {
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
    display: flex;
}
.ab-close-icon:hover { opacity: 1; }
.ab-close-icon svg { width: 20px; height: 20px; fill: var(--ab-text); }

/* ── Tabs ── */
.ab-tabs {
    display: flex;
    border-bottom: 1px solid var(--ab-border);
    background: rgba(0,0,0,0.2);
}
.ab-tab {
    flex: 1;
    padding: 12px 8px;
    text-align: center;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: var(--ab-text-dim);
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    user-select: none;
    letter-spacing: 0.2px;
}
.ab-tab:hover {
    color: var(--ab-text);
    background: rgba(255,255,255,0.05);
}
.ab-tab.active {
    color: var(--ab-accent);
    border-bottom-color: var(--ab-accent);
    background: rgba(59,130,246,0.1);
    font-weight: 600;
}

/* ── Content ── */
.ab-content {
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 65vh;
}
.ab-content::-webkit-scrollbar { width: 6px; }
.ab-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }

/* ── Grid / Cards ── */
.ab-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}
.ab-card {
    background: var(--ab-bg-card);
    border: 1px solid var(--ab-border);
    border-radius: 10px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
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
.ab-btn:active { transform: scale(0.98); }
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
    border-bottom: 1px solid rgba(59,130,246,0.3);
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
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: ab-slide-up 0.3s forwards;
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
