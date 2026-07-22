# Vision

## Mission

Companion exists to transform the GoldenBride CRM workflow from manual, repetitive tasks into an intelligent, automated experience. Every second saved compounds into meaningful productivity gains for operators who spend hours in the system daily.

## Vision

Companion will become the definitive productivity platform for GoldenBride CRM — a modular, extensible system that anticipates operator needs, automates routine work, and provides actionable insights without leaving the browser.

## Goals

1. **Reduce operational friction** — eliminate repetitive clicks, manual data entry, and context switching
2. **Accelerate workflows** — provide instant access to finance data, translations, and analytics
3. **Scale through modules** — enable independent features that compose into a unified experience
4. **Maintain reliability** — operate invisibly in production without disrupting CRM functionality
5. **Ensure longevity** — build a codebase that remains maintainable for years

## Product Philosophy

Companion follows three core principles:

- **Invisible until needed** — Companion never interrupts workflows. It appears on demand, operates quietly, and disappears when dismissed.
- **Module independence** — each feature is a self-contained unit. Finance does not depend on Translator. Statistics does not depend on Rules. The platform connects them, but modules stand alone.
- **Progressive enhancement** — Companion starts minimal and grows through modules. A user with only Finance enabled experiences a complete, polished product. Adding modules expands capability without degrading performance.

## Core Principles

### Documentation First

Every architectural decision is documented before implementation begins. Documentation is the single source of truth. Code follows documentation; documentation does not follow code.

### Module Isolation

Modules communicate through well-defined interfaces. No module imports another module's internal types. No module depends on another module's DOM structure. The ModuleManager orchestrates lifecycle; modules respond to lifecycle events.

### Conservative Change

Architecture changes require explicit approval. Refactoring for aesthetic reasons is prohibited. Every change must justify its existence against the current system's stability.

## User Value

Companion delivers value through three mechanisms:

1. **Time savings** — automated data retrieval, one-click operations, batch processing
2. **Error reduction** — validated inputs, consistent formatting, automated checks
3. **Decision support** — aggregated data, trend visualization, intelligent defaults

## Long-term Direction

Companion has transitioned from a Tampermonkey userscript to a Chrome Extension (Manifest V3). This transition enables:

- Persistent background processing
- Cross-origin resource access
- Native notification APIs
- Structured permissions model
- Distribution through the Chrome Web Store

The modular architecture ensures this transition requires only an extension wrapper — all core logic remains unchanged.

## Non-Goals

- **Not a CRM replacement** — Companion augments GoldenBride; it does not compete with it
- **Not a general browser extension** — Companion is purpose-built for GoldenBride CRM
- **Not a framework** — Companion is an application, not a library for others to extend
- **Not a data hoarder** — Companion processes data in real-time; it does not build massive local databases
- **Not a social platform** — Companion is a single-user productivity tool

## Success Criteria

Companion succeeds when:

- Operators complete daily tasks 30% faster
- Error rates in finance operations drop below 1%
- Module adoption reaches 80% of active operators
- Zero production incidents per quarter
- Codebase remains under active development after 2 years

## Decision Authority

The project owner has final authority on all architectural decisions. Documentation reflects approved decisions. Implementation follows documentation. No deviation is permitted without explicit approval.

## Development Philosophy

- **Build incrementally** — each commit delivers a testable, working system
- **Document decisions** — every ADR captures the reasoning behind architecture choices
- **Resist complexity** — the simplest solution that meets requirements is preferred
- **Measure twice, cut once** — thorough planning prevents costly rework
- **Preserve stability** — production reliability is non-negotiable
