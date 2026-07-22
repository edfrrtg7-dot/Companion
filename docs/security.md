# Security

## Overview

Companion operates in a browser extension context with access to page DOM, localStorage, and network requests. Security must be practical, realistic, and proportional to the threat model.

## Threat Model

### Assets

| Asset | Sensitivity | Description |
|-------|-------------|-------------|
| User session | High | JSESSIONID cookie for GoldenBride CRM |
| Finance data | Medium | Transaction history, credits, operations |
| Widget state | Low | Position, size, collapse state |
| User preferences | Low | Module settings, shift selection |

### Threats

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Session token exposure | Low | High | No token logging, no external requests |
| Data leakage to third parties | Low | High | No analytics, no telemetry, no external endpoints |
| XSS via DOM manipulation | Medium | Medium | No innerHTML with user data, sanitized outputs |
| LocalStorage tampering | Low | Low | State validation on load, graceful degradation |
| Code inspection | Certain | Low | Obfuscation in production builds |

### Attack Surface

- Content script runs in page context (same origin as CRM)
- Access to page DOM and cookies
- Access to localStorage
- Network requests limited to same origin
- Background service worker for future messaging and storage

## Security Goals

1. **No credential exposure** — session tokens are never logged, stored, or transmitted externally
2. **No data exfiltration** — all network requests go to the same origin (GoldenBride CRM)
3. **No third-party dependencies** — zero external runtime dependencies
4. **Minimal attack surface** — only necessary permissions are requested
5. **Graceful degradation** — security failures result in feature loss, not data exposure

## Limitations

### Browser Extension Constraints

1. **Source code is accessible** — users can inspect the extension source. Obfuscation provides deterrence, not security.
2. **Content script context** — content scripts share the page's origin, meaning the page can potentially access extension storage.
3. **No server-side component** — all processing is client-side. Server-side validation is the CRM's responsibility.
4. **localStorage is not encrypted** — data is stored in plaintext. Sensitive data should not be persisted.

### Realistic Expectations

- Companion is a productivity tool, not a security-critical system
- The primary threat is accidental data exposure, not targeted attacks
- Protection measures are proportional to the actual risk level
- Complete code protection is impossible in a browser extension

## Protection Strategy

### Current Measures

1. **No external network requests** — all API calls go to the same origin (GoldenBride CRM)
2. **No credential logging** — session tokens are never written to console or logs
3. **No analytics or telemetry** — no data is sent to third parties
4. **No third-party dependencies** — zero runtime dependencies reduce supply chain risk
5. **State validation** — localStorage data is validated on load, corrupted data is rejected
6. **Development mode gating** — diagnostic logs only activate with explicit opt-in

### Production Measures (Future)

1. **Code obfuscation** — minification and obfuscation in production builds
2. **Content Security Policy** — restrict script execution sources
3. **Permission minimization** — request only necessary Chrome extension permissions
4. **Integrity checks** — verify bundle integrity on load

## Data Handling

### Finance Data

- Retrieved via same-origin API requests
- Processed in memory only
- Never stored in localStorage (only widget state is persisted)
- Never sent to external endpoints
- Displayed in widget UI, not cached

### Widget State

- Position, size, collapse state persisted to localStorage
- No sensitive data in persisted state
- State validated on load with schema checks
- Corrupted state gracefully falls back to defaults

### Session Information

- JSESSIONID cookie used automatically by browser for same-origin requests
- Never accessed, logged, or stored by Companion code
- Managed entirely by the browser's cookie jar

## Future Security

### Chrome Extension Migration

When migrating to Chrome Extension (Manifest V3):

1. **Minimal permissions** — only request `activeTab` and necessary host permissions
2. **Background script isolation** — service worker runs in isolated context
3. **Content script isolation** — content scripts run in an isolated world
4. **Storage API** — use `chrome.storage` instead of localStorage for sensitive data
5. **CSP enforcement** — define strict Content Security Policy

### Production Build Pipeline

```
TypeScript → esbuild → Terser → Obfuscation → Packaging
```

Each stage reduces code readability and increases reverse-engineering difficulty.

## Security Checklist

- [ ] No credentials in console.log statements
- [ ] No external network requests (except same-origin)
- [ ] No third-party runtime dependencies
- [ ] No sensitive data in localStorage
- [ ] State validation on load
- [ ] Development logging gated behind dev mode
- [ ] Code obfuscated in production builds
- [ ] Minimal permissions requested
