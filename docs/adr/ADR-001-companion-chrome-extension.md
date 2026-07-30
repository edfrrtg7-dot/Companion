# ADR-001: Companion becomes a Chrome Extension

**Status:** Accepted

## Context

Companion started as a Tampermonkey userscript injected into GoldenBride CRM pages. While functional, the userscript approach limits access to Chrome Extension APIs, background processing, and structured permission management.

## Decision

Companion will transition from a Tampermonkey userscript to a Chrome Extension (Manifest V3). The current Tampermonkey version serves as a development and testing platform. The extension version will provide the production deployment model.

## Consequences

**Positive:**
- Access to Chrome Extension APIs (storage, notifications, background processing).
- Structured permission model.
- Distribution through Chrome Web Store.
- Content script isolation.

**Negative:**
- Chrome Web Store review process.
- Manifest V3 constraints (service worker lifecycle).
- Additional build pipeline complexity.

## Related EPICs

- (precedes formal EPIC system)
