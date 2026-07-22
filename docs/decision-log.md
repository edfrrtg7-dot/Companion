# Decision Log

## Overview

Architecture Decision Records (ADRs) capture important architectural decisions and their rationale. Each ADR documents the context, decision, and consequences.

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](#adr-001) | Companion becomes a Chrome Extension | Accepted | 2026 |
| [ADR-002](#adr-002) | Companion follows modular architecture | Accepted | 2026 |
| [ADR-003](#adr-003) | CompanionWindow is the only window base class | Accepted | 2026 |
| [ADR-004](#adr-004) | ModuleManager owns module lifecycle | Accepted | 2026 |
| [ADR-005](#adr-005) | Documentation is the source of truth | Accepted | 2026 |

---

## ADR-001

### Title

Companion becomes a Chrome Extension

### Status

Accepted

### Context

Companion started as a Tampermonkey userscript injected into GoldenBride CRM pages. While functional, the userscript approach limits access to Chrome Extension APIs, background processing, and structured permission management.

### Decision

Companion will transition from a Tampermonkey userscript to a Chrome Extension (Manifest V3). The current Tampermonkey version serves as a development and testing platform. The extension version will provide the production deployment model.

### Consequences

**Positive:**
- Access to Chrome Extension APIs (storage, notifications, background processing)
- Structured permission model
- Distribution through Chrome Web Store
- Content script isolation

**Negative:**
- Chrome Web Store review process
- Manifest V3 constraints (service worker lifecycle)
- Additional build pipeline complexity

### Related

- [Build Pipeline](build.md)
- [Security](security.md)
- [Roadmap](roadmap.md)

---

## ADR-002

### Title

Companion follows modular architecture

### Status

Accepted

### Context

Companion needs to support multiple independent features (Finance, Translator, Statistics, AI, Rules). These features should be developed independently, deployed together, and composed at runtime.

### Decision

Companion adopts a modular architecture where:
- Each feature is an independent module
- Modules implement a common interface (`CompanionModule`)
- A central `ModuleManager` handles lifecycle
- A `CompanionApp` provides the launcher and menu UI
- Modules are registered during bootstrap and lazy-initialized on first use

### Consequences

**Positive:**
- Independent module development
- Lazy initialization reduces startup cost
- Easy addition of new modules
- Clear separation of concerns

**Negative:**
- Additional abstraction layer
- Module interface must remain stable
- Inter-module communication requires planning

### Related

- [Module API](module-api.md)
- [Architecture](architecture.md)

---

## ADR-003

### Title

CompanionWindow is the only window base class

### Status

Accepted

### Context

Multiple modules need draggable, resizable, collapsible windows with state persistence. Implementing this per module would duplicate significant code and create inconsistencies.

### Decision

`CompanionWindow` is the abstract base class for all windows. It provides:
- Drag handling
- Resize handling
- Collapse/expand behavior
- State persistence (position, size, collapsed, hidden)
- Keyboard shortcuts (ESC to close)

Subclasses implement their own DOM creation and business logic but inherit all window management behavior.

### Consequences

**Positive:**
- Consistent window behavior across modules
- Single implementation of drag/resize/collapse logic
- Automatic state persistence for all windows
- Easy addition of new window-based modules

**Negative:**
- All windows share the same interaction model
- Custom window behaviors require CompanionWindow modification
- Base class changes affect all windows

### Related

- [Architecture](architecture.md)
- [UI Guidelines](ui-guidelines.md)

---

## ADR-004

### Title

ModuleManager owns module lifecycle

### Status

Accepted

### Context

Modules need centralized lifecycle management. Without a single owner, modules might be opened, closed, or destroyed by multiple components, leading to state inconsistencies.

### Decision

`ModuleManager` is the only component that manages module lifecycle:
- Registration: modules register during bootstrap
- Lookup: modules found by name
- Opening: modules opened through ModuleManager
- Closing: modules closed through ModuleManager
- Destruction: modules destroyed through ModuleManager

`CompanionApp` delegates all module operations to `ModuleManager`. No other component may directly open, close, or destroy modules.

### Consequences

**Positive:**
- Single source of truth for module state
- Clean separation between UI (CompanionApp) and lifecycle (ModuleManager)
- Prevents duplicate opens/closes
- Easy to add lifecycle hooks in the future

**Negative:**
- Additional indirection for module operations
- ModuleManager must handle all lifecycle edge cases

### Related

- [Module API](module-api.md)
- [Architecture](architecture.md)

---

## ADR-005

### Title

Documentation is the source of truth

### Status

Accepted

### Context

AI assistants and human developers need consistent guidance for implementing features. Without a single source of truth, implementations diverge and architecture degrades over time.

### Decision

Documentation becomes the single source of truth for all architectural decisions, coding standards, and design guidelines. If code conflicts with documentation, documentation is updated only after explicit approval.

All implementation tasks must follow the documented standards. AI assistants must read and adhere to documentation before making changes.

### Consequences

**Positive:**
- Consistent implementations across time
- Clear reference for AI assistants
- Architecture decisions preserved
- Reduced redesign risk

**Negative:**
- Documentation must be maintained
- Stale documentation can mislead
- Approval process adds friction to documentation changes

### Related

- [Coding Standards](coding-standards.md)
- [Architecture](architecture.md)
- [Vision](vision.md)

---

## Template for Future ADRs

```markdown
## ADR-XXX

### Title

[Short title describing the decision]

### Status

[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

### Context

[What is the issue that motivates this decision?]

### Decision

[What is the change being proposed or decided?]

### Consequences

**Positive:**
- [Benefit 1]
- [Benefit 2]

**Negative:**
- [Cost 1]
- [Cost 2]

### Related

- [Link to related documentation]
```
