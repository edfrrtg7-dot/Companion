# Roadmap

**Purpose:** Planned architectural evolution of the Companion platform.

**Status:** Accepted

---

## 1. Purpose

The Roadmap exists to communicate the intended architectural direction of the Companion platform. It describes where the platform is going and in what order major architectural capabilities are expected to evolve.

The Roadmap is a planning document, not an implementation specification. Items on the Roadmap have not been accepted and may change, be deferred, or be removed before becoming EPICs. Only items that have completed the acceptance process and been implemented become part of the Baseline.

This document exists to provide context for contributors, maintainers, and reviewers about the planned evolution of the platform. It does not make commitments about delivery.

---

## 2. Planning Principles

**Incremental evolution.** The platform grows one step at a time. Each step adds a well-defined capability without requiring changes to previously accepted architecture. The Roadmap reflects this — it describes discrete additions, not monolithic transformations.

**Dependency-driven planning.** Items that other work depends on are prioritised earlier. The platform builds from the foundation upward. An item that unblocks multiple future capabilities is planned before items that depend on it.

**Architecture before features.** Infrastructure and platform capabilities are planned before the feature modules that consume them. The Roadmap sequences architectural work ahead of module-level work that depends on it.

**Implementation follows accepted EPICs.** The Roadmap identifies what should be built, but nothing is implemented until it goes through the EPIC process. Roadmap items are proposals, not tasks.

**Plans may change before acceptance.** The Roadmap is a living document. New information, changing priorities, or architectural discoveries may shift the order or content of planned items. Plans become commitments only after acceptance.

---

## 3. Evolution Strategy

The platform grows by extending accepted foundations, not by replacing them.

Each architectural layer is designed to accommodate future additions. The foundation does not need to be modified when a new capability is added — it is extended. New services join existing ones. New public API contracts coexist with established ones.

This strategy means the Roadmap does not require redesign milestones. Every planned addition assumes the current Baseline is sufficient as a starting point. If a planned addition requires a change to the Baseline, that change is itself a separate Roadmap item that precedes the dependent work.

Evolution proceeds in phases. Each phase addresses a category of architectural growth — completing infrastructure, enabling module integration, or extending the platform's reach. Phases are sequential where dependencies require ordering, but parallel otherwise.

---

## 4. Architectural Milestones

The following major categories represent areas of future architectural growth. They are described conceptually and are not implementation specifications.

**Infrastructure completion.** The platform's internal layer is largely defined but not fully complete. Remaining infrastructure capabilities include formalising cross-module communication patterns, completing the diagnostics surface, and hardening persistence lifecycle behaviour. These items are foundational — they must be in place before feature modules can rely on a stable platform.

**Feature module expansion.** With the Finance module as the model, additional operational modules extend the platform's utility. Future modules address adjacent operational needs within the GoldenBride CRM environment. Each new module validates and exercises the platform's public API contracts.

**Integration patterns.** As the number of modules grows, patterns for module-to-module coordination become more important. The Roadmap includes formalising how modules cooperate through events and shared services without coupling to each other's implementations.

**Developer experience.** As the platform matures, tooling and documentation support for module development becomes a priority. This includes stable module templates, development aids, and verification tooling that helps module authors confirm their implementations conform to platform contracts.

---

## 5. Prioritisation

Future work is prioritised according to the following factors, in order:

1. **Architectural dependencies.** Items that other work depends on are ranked highest. Foundational capabilities always precede the features that build on them.
2. **Platform readiness.** Items that complete the infrastructure layer take priority over items that consume infrastructure. The platform must be stable before modules can be reliably built.
3. **Validation value.** Items that exercise and validate public API contracts are prioritised over items that add infrastructure without consumers. A capability is not proven until a module uses it.
4. **Maintenance burden.** Items that reduce ongoing maintenance overhead or eliminate fragile patterns are prioritised ahead of purely additive work.

Prioritisation is reassessed at each planning cycle. Accepted EPICs and emerging architectural insights may shift priorities.

---

## 6. Relationship to the Baseline

The Baseline records accepted architectural state. The Roadmap records planned architectural direction. The two are distinct and must remain so.

A Roadmap item becomes part of the Baseline only after:

- It is formalised as an EPIC with defined scope, requirements, and verification criteria.
- The EPIC undergoes architectural review.
- The EPIC is accepted.
- Implementation is completed.
- The Baseline is updated to reflect the new architectural state.

Until all of these steps are completed, the item remains a plan. It is not part of the accepted architecture, and no implementation work should assume it exists.

This separation is intentional. It allows the Roadmap to be aspirational without creating incorrect expectations about the current state of the platform.

---

## 7. Roadmap Governance

Roadmap items evolve through the following stages:

- **Proposal.** An idea for future architectural growth is identified. It is recorded in the Roadmap as a conceptual milestone. No commitment is made.
- **EPIC creation.** When a proposal is considered ready for architectural review, it is formalised into an EPIC with scope, requirements, and verification criteria.
- **Review.** The EPIC is reviewed for architectural consistency, dependency correctness, and alignment with the platform's engineering philosophy.
- **Acceptance or rejection.** The EPIC is either accepted as part of the architectural evolution or rejected. Rejected items may be revised and resubmitted.
- **Promotion into the Baseline.** An accepted EPIC that has been implemented becomes part of the Baseline. The Architecture Manifest and Architecture Revision are updated to reflect the new state.

Roadmap governance is lightweight by design. The formal rigour is applied at the EPIC stage, where implementation commitments are made. Before that stage, the Roadmap is a communication and coordination tool, not a control mechanism.

---

## Navigation

- **Previous:** [Baseline](06_BASELINE.md)
- **Next:** [Architecture Decisions](08_ARCHITECTURE_DECISIONS.md)
- **Related:** [INDEX.md](INDEX.md) | [README.md](README.md)
