# ADR-002: Companion follows modular architecture

**Status:** Accepted

## Context

Companion needs to support multiple independent features (Finance, Translator, Statistics, AI, Rules). These features should be developed independently, deployed together, and composed at runtime.

## Decision

Companion adopts a modular architecture where:

- Each feature is an independent module.
- Modules implement a common interface (`CompanionModule`).
- A central `ModuleManager` handles lifecycle.
- A `CompanionApp` provides the launcher and menu UI.
- Modules are registered during bootstrap and lazy-initialized on first use.

## Consequences

**Positive:**
- Independent module development.
- Lazy initialisation reduces startup cost.
- Easy addition of new modules.
- Clear separation of concerns.

**Negative:**
- Additional abstraction layer.
- Module interface must remain stable.
- Inter-module communication requires planning.

## Related EPICs

- (precedes formal EPIC system)
