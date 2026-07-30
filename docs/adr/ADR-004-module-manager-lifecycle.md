# ADR-004: ModuleManager owns module lifecycle

**Status:** Accepted

## Context

Modules need centralised lifecycle management. Without a single owner, modules might be opened, closed, or destroyed by multiple components, leading to state inconsistencies.

## Decision

ModuleManager is the only component that manages module lifecycle: registration, lookup, opening, closing, and destruction. CompanionApp delegates all module operations to ModuleManager. No other component may directly open, close, or destroy modules.

## Consequences

**Positive:**
- Single source of truth for module state.
- Clean separation between UI (CompanionApp) and lifecycle (ModuleManager).
- Prevents duplicate opens/closes.
- Easy to add lifecycle hooks in the future.

**Negative:**
- Additional indirection for module operations.
- ModuleManager must handle all lifecycle edge cases.

## Related EPICs

- (precedes formal EPIC system; refined in ModuleManager 2.0 platform work)
