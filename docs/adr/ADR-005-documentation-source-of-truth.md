# ADR-005: Documentation is the source of truth

**Status:** Accepted

## Context

AI assistants and human developers need consistent guidance for implementing features. Without a single source of truth, implementations diverge and architecture degrades over time.

## Decision

Documentation becomes the single source of truth for all architectural decisions, coding standards, and design guidelines. If code conflicts with documentation, documentation is updated only after explicit approval. All implementation tasks must follow the documented standards. AI assistants must read and adhere to documentation before making changes.

## Consequences

**Positive:**
- Consistent implementations across time.
- Clear reference for AI assistants.
- Architecture decisions preserved.
- Reduced redesign risk.

**Negative:**
- Documentation must be maintained.
- Stale documentation can mislead.
- Approval process adds friction to documentation changes.

## Related EPICs

- (precedes formal EPIC system)
