import { Z } from "./layering";

export const FINANCE_WIDGET_CSS = `
/* Widget root */
.ab-finance {
    position: fixed;
    top: 24px;
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
    /* Container queries for responsive internal layout */
    container-type: inline-size;
    container-name: finance-widget;
}

/* Collapsed — JS sets explicit dimensions (height 44px, width = expanded width).
   CSS makes the header fill the collapsed bar exactly and centers its content,
   so title, CASH, and actions stay vertically aligned with the expanded layout. */
.ab-finance-collapsed .ab-finance-resize-handle {
    display: none;
}

.ab-finance-collapsed .ab-finance-header {
    border-bottom: none;
    border-radius: 10px;
    min-height: 0;
    height: 100%;
    box-sizing: border-box;
    padding: 0 12px;
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

@keyframes ab-finance-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* CASH indicator — doubles as the refresh control */
.ab-finance-cash-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(255, 215, 0, 0.08);
    border: 1px solid rgba(255, 215, 0, 0.15);
    cursor: pointer;
    flex-shrink: 0;
    font: inherit;
    color: inherit;
    line-height: 1;
}

.ab-finance-cash-indicator:hover {
    background: rgba(255, 215, 0, 0.16);
    border-color: rgba(255, 215, 0, 0.3);
}

.ab-finance-cash-indicator:disabled {
    opacity: 0.5;
    cursor: default;
    background: rgba(255, 215, 0, 0.08);
    border-color: rgba(255, 215, 0, 0.15);
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

.ab-finance-cash-refresh {
    font-size: 12px;
    line-height: 1;
    color: rgba(255, 215, 0, 0.6);
    transition: color 0.15s ease;
}

.ab-finance-cash-indicator:hover .ab-finance-cash-refresh {
    color: #FFD700;
}

.ab-finance-cash-refresh.spinning {
    animation: ab-finance-spin 0.6s linear infinite;
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

/* Shift selector */
.ab-finance-shift-btn {
    background: none;
    border: none;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 500;
    transition: all 0.15s ease;
}

.ab-finance-shift-btn:hover {
    color: #E0E0E0;
    background: rgba(255,255,255,0.1);
}

.ab-finance-shift-dropdown {
    display: none;
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: #1F2235;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 4px;
    z-index: 10;
    min-width: 160px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}

.ab-finance-shift-dropdown.open {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.ab-finance-shift-option {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: none;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 6px 10px;
    cursor: pointer;
    text-align: left;
    color: #E0E0E0;
    transition: all 0.15s ease;
    width: 100%;
}

.ab-finance-shift-option:hover {
    background: rgba(255,255,255,0.08);
}

.ab-finance-shift-option.active {
    background: #2F6BFF;
    border-color: #2F6BFF;
    color: #FFFFFF;
}

.ab-finance-shift-option.active:hover {
    background: #4A82FF;
}

.ab-finance-shift-name {
    font-size: 11px;
    font-weight: 600;
}

.ab-finance-shift-time {
    font-size: 9px;
    opacity: 0.7;
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

/* ============================================================================
   RESPONSIVE LAYOUT — Container Queries & clamp()
   Finance content adapts to widget width/height without transform:scale.
   ============================================================================ */

/* Base responsive sizing using clamp() — scales smoothly within bounds */
.ab-finance-header {
    padding: clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 12px);
    min-height: clamp(32px, 8vh, 36px);
}

.ab-finance-header-title {
    font-size: clamp(12px, 2.5vw, 14px);
    gap: clamp(4px, 1vw, 6px);
}

.ab-finance-logo {
    width: clamp(14px, 3vw, 16px);
    height: clamp(14px, 3vw, 16px);
}

.ab-finance-body {
    padding: clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px);
    gap: clamp(3px, 1vw, 6px);
}

.ab-finance-label {
    font-size: clamp(10px, 2vw, 12px);
}

.ab-finance-value {
    font-size: clamp(12px, 2.5vw, 14px);
}

.ab-finance-tx-header,
.ab-finance-tx-row {
    grid-template-columns: clamp(40px, 10vw, 50px) 1fr 1fr clamp(50px, 12vw, 60px);
    gap: clamp(3px, 1vw, 4px);
    font-size: clamp(9px, 1.8vw, 11px);
}

.ab-finance-btn {
    font-size: clamp(10px, 2vw, 12px);
    padding: clamp(3px, 0.8vw, 5px) clamp(4px, 1vw, 6px);
}

.ab-finance-cash-indicator {
    padding: clamp(1px, 0.5vw, 2px) clamp(6px, 1.5vw, 8px);
}

.ab-finance-cash-label {
    font-size: clamp(10px, 2vw, 12px);
}

.ab-finance-cash-icon {
    font-size: clamp(12px, 2.5vw, 14px);
}

.ab-finance-shift-info {
    gap: clamp(2px, 0.8vw, 4px);
}

.ab-finance-shift-info-row {
    font-size: clamp(10px, 2vw, 12px);
}

.ab-finance-collapsed .ab-finance-header {
    padding: clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 12px);
}

/* Container query: narrow widget — compress layout */
@container finance-widget (max-width: 340px) {
    .ab-finance-body {
        padding: 6px 8px;
        gap: 3px;
    }
    .ab-finance-tx-header,
    .ab-finance-tx-row {
        grid-template-columns: 40px 1fr 1fr 50px;
        gap: 3px;
        font-size: 9px;
    }
    .ab-finance-shift-info-row {
        font-size: 10px;
    }
    .ab-finance-cash-indicator {
        padding: 1px 6px;
    }
    .ab-finance-cash-label {
        font-size: 10px;
    }
}

/* Container query: medium widget — default layout */
@container finance-widget (min-width: 341px) and (max-width: 480px) {
    .ab-finance-body {
        padding: 8px 10px;
        gap: 4px;
    }
    .ab-finance-tx-header,
    .ab-finance-tx-row {
        grid-template-columns: 50px 1fr 1fr 60px;
        gap: 4px;
        font-size: 10px;
    }
}

/* Container query: wide widget — expanded columns & typography */
@container finance-widget (min-width: 481px) {
    .ab-finance-body {
        padding: 10px 14px;
        gap: 6px;
    }
    .ab-finance-tx-header,
    .ab-finance-tx-row {
        grid-template-columns: 60px 1fr 1fr 70px;
        gap: 6px;
        font-size: 11px;
    }
    .ab-finance-label {
        font-size: 11px;
    }
    .ab-finance-value {
        font-size: 13px;
    }
    .ab-finance-shift-info-row {
        font-size: 11px;
    }
}

/* Container query: tall widget — more vertical space for transactions */
@container finance-widget (min-height: 400px) {
    .ab-finance-body {
        flex: 1;
        overflow-y: auto;
    }
    .ab-finance-tx-container {
        max-height: calc(100% - 60px);
        overflow-y: auto;
    }
}

/* Legacy media queries as fallback for browsers without container query support */
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
