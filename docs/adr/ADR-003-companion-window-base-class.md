# ADR-003: CompanionWindow is the only window base class

**Status:** Accepted

## Context

Multiple modules need draggable, resizable, collapsible windows with state persistence. Implementing this per module would duplicate significant code and create inconsistencies.

## Decision

`CompanionWindow` is the abstract base class for all windows. It provides drag handling, resize handling, collapse/expand behaviour, state persistence (position, size, collapsed, hidden), and keyboard shortcuts. Subclasses implement their own DOM creation and business logic but inherit all window management behaviour.

## Consequences

**Positive:**
- Consistent window behaviour across modules.
- Single implementation of drag/resize/collapse logic.
- Automatic state persistence for all windows.
- Easy addition of new window-based modules.

**Negative:**
- All windows share the same interaction model.
- Custom window behaviours require CompanionWindow modification.
- Base class changes affect all windows.

## Related EPICs

- (precedes formal EPIC system)
