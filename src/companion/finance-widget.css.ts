import { Z } from "./layering";

export const FINANCE_WIDGET_CSS = `
/* Widget root */
.ab-finance {
    position: fixed;
    bottom: 24px;
    left: 24px;
    width: 400px;
    height: 440px;
    min-width: 320px;
    min-height: 200px;
    max-width: 700px;
    max-height: 600px;
    background: #1F2235;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    z-index: ${Z.widget};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #E0E0E0;
    box-shadow: 0 8px 32px 0 rgba(0,0,0,0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    user-select: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* Collapsed — JS sets explicit dimensions via COLLAPSED_WIDTH/HEIGHT constants.
   CSS only hides the resize handle and adjusts header border. */
.ab-finance.collapsed .ab-finance-resize-handle {
    display: none;
}

.ab-finance.collapsed .ab-finance-header {
    border-bottom: none;
    border-radius: 10px;
}

/* Resize handle */
.ab-finance-resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.3) 50%);
    border-radius: 0 0 10px 0;
    z-index: 1;
    touch-action: none;
}

.ab-finance-resize-handle:hover {
    background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.5) 50%);
}

/* Header / Drag handle */
.ab-finance-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    cursor: grab;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.03);
    min-height: 36px;
    border-radius: 10px 10px 0 0;
    flex-shrink: 0;
    touch-action: none;
}

.ab-finance-header-title {
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    color: rgba(255,255,255,0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
}

/* Companion Logo */
.ab-finance-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
}

.ab-finance-logo svg {
    width: 100%;
    height: 100%;
}

.ab-finance-header-actions {
    display: flex;
    gap: 2px;
    align-items: center;
    position: relative;
    flex-shrink: 0;
}

.ab-finance-header-actions button {
    background: none;
    border: none;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    font-size: 12px;
    flex-shrink: 0;
}

.ab-finance-header-actions button:hover {
    color: #E0E0E0;
    background: rgba(255,255,255,0.1);
}

/* Header refresh button */
.ab-finance-header-refresh-btn {
    font-size: 16px !important;
    line-height: 1;
}

.ab-finance-header-refresh-btn.spinning {
    animation: ab-finance-spin 0.6s linear infinite;
}

.ab-finance-header-refresh-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

@keyframes ab-finance-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* CASH indicator */
.ab-finance-cash-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(255, 215, 0, 0.08);
    border: 1px solid rgba(255, 215, 0, 0.15);
    cursor: default;
    flex-shrink: 0;
}

.ab-finance-cash-icon {
    font-size: 14px;
    line-height: 1;
}

.ab-finance-cash-label {
    font-size: 11px;
    font-weight: 700;
    color: #FFD700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
}

.ab-finance-cash-dot {
    font-size: 10px;
    line-height: 1;
    color: rgba(255, 215, 0, 0.4);
    transition: color 0.3s ease;
}

.ab-finance-cash-dot.pulse {
    color: #FFD700;
    animation: ab-finance-gold-pulse 1.5s ease-in-out infinite;
}

@keyframes ab-finance-gold-pulse {
    0%, 100% { opacity: 0.4; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.2); }
}

/* Collapse button */
.ab-finance-collapse-btn {
    font-size: 11px !important;
}

.ab-finance-collapse-btn:hover {
    color: #59AFFF !important;
    background: rgba(89,175,255,0.1) !important;
}

/* Close button */
.ab-finance-close-btn:hover {
    background: rgba(239,83,80,0.3) !important;
    color: #EF5350 !important;
}

/* Body */
.ab-finance-body {
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
    flex: 1;
    user-select: text;
}

.ab-finance-body::-webkit-scrollbar {
    width: 4px;
}

.ab-finance-body::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 2px;
}

/* Row */
.ab-finance-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.ab-finance-label {
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

.ab-finance-value {
    font-size: 14px;
    font-weight: 600;
    color: #E0E0E0;
}

.ab-finance-value.ab-finance-accent {
    color: #59AFFF;
}

.ab-finance-value.ab-finance-success {
    color: #81C784;
}

.ab-finance-value.ab-finance-warning {
    color: #FFB74D;
}

/* Button */
.ab-finance-btn {
    flex: 1;
    background: rgba(255,255,255,0.05);
    color: #E0E0E0;
    border: 1px solid rgba(255,255,255,0.1);
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    text-align: center;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
}

.ab-finance-btn:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.2);
}

.ab-finance-btn:active {
    transform: scale(0.97);
}

.ab-finance-btn.primary {
    background: #2F6BFF;
    border-color: #2F6BFF;
    color: #FFFFFF;
}

.ab-finance-btn.primary:hover {
    background: #4A82FF;
}

.ab-finance-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Fixed-width centered button variant */
.ab-finance-btn-full {
    width: 160px;
    flex: none;
    margin: 0 auto;
}

/* Divider */
.ab-finance-divider {
    height: 1px;
    background: rgba(255,255,255,0.1);
    margin: 2px 0;
}

/* Message */
.ab-finance-message {
    text-align: center;
    color: rgba(255,255,255,0.5);
    font-size: 11px;
    padding: 6px 0;
}

/* Error */
.ab-finance-error {
    text-align: center;
    color: #EF5350;
    font-size: 11px;
    padding: 6px 0;
}

/* Transaction container */
.ab-finance-tx-container {
    display: flex;
    flex-direction: column;
    gap: 0;
    width: 100%;
}

/* Transaction header: 4 columns — Time | Operation | Target ID | Credits */
.ab-finance-tx-header {
    display: grid;
    grid-template-columns: 50px 1fr 1fr 60px;
    gap: 4px;
    font-size: 10px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.3px;
    padding: 2px 0;
    border-bottom: 1px solid rgba(255,255,255,0.1);
}

/* Transaction rows: same 4 columns */
.ab-finance-tx-row {
    display: grid;
    grid-template-columns: 50px 1fr 1fr 60px;
    gap: 4px;
    font-size: 11px;
    padding: 3px 0;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    color: #E0E0E0;
}

.ab-finance-tx-cell {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
}

.ab-finance-tx-header-cell {
    text-align: center;
    font-weight: 600;
}

.ab-finance-tx-op {
    color: rgba(255,255,255,0.5);
}

/* Shift info */
.ab-finance-shift-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 2px 0;
}

.ab-finance-shift-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

/* Status */
.ab-finance-status {
    font-size: 9px;
    color: rgba(255,255,255,0.5);
    text-align: center;
    margin-top: 1px;
}

/* New transaction highlight */
.ab-finance-tx-new {
    animation: ab-finance-highlight 2s ease-out;
}

@keyframes ab-finance-highlight {
    0% { background: rgba(89,175,255,0.25); }
    100% { background: transparent; }
}

/* Responsive — narrow widget (<320px) */
@media (max-width: 320px) {
    .ab-finance {
        min-width: 240px;
    }
    .ab-finance-header {
        padding: 6px 10px;
        min-height: 32px;
    }
    .ab-finance-header-title {
        font-size: 12px;
        gap: 4px;
    }
    .ab-finance-logo {
        width: 14px;
        height: 14px;
    }
    .ab-finance-body {
        padding: 6px 8px;
        gap: 3px;
    }
    .ab-finance-label {
        font-size: 10px;
    }
    .ab-finance-value {
        font-size: 12px;
    }
    .ab-finance-tx-header,
    .ab-finance-tx-row {
        grid-template-columns: 40px 1fr 1fr 50px;
        gap: 3px;
        font-size: 9px;
    }
    .ab-finance-btn {
        font-size: 10px;
        padding: 3px 4px;
    }
    .ab-finance-cash-indicator {
        padding: 1px 6px;
    }
    .ab-finance-cash-label {
        font-size: 10px;
    }
    .ab-finance-cash-icon {
        font-size: 12px;
    }
}

/* Responsive — wide widget (>500px) */
@media (min-width: 500px) {
    .ab-finance-body {
        padding: 10px 14px;
        gap: 6px;
    }
    .ab-finance-tx-header,
    .ab-finance-tx-row {
        grid-template-columns: 60px 1fr 1fr 70px;
        gap: 6px;
    }
}
`;
