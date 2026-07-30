# Engineering Philosophy

**Purpose:** Principles and discipline that guide architectural and engineering decisions in the Companion project.

**Status:** Accepted

---

## 1. Philosophy

Companion treats architecture as the foundation of the project, not an afterthought.

Every feature is built on a stable infrastructure layer. That layer is designed before the features that depend on it, not alongside them. This approach ensures that features can be added, removed, or replaced without destabilising the system.

The project values long-term maintainability over short-term velocity. A decision that makes the system easier to understand and change six months from now is preferred over a decision that delivers a feature faster today at the cost of future complexity.

---

## 2. Core Principles

**Architecture before features.** Infrastructure is designed and implemented before the features that use it. This prevents feature modules from accidentally shaping the platform in inconsistent ways.

**Explicit ownership.** Every component, service, and responsibility has a single owner. Ownership is documented and enforced through the type system and module contracts. No shared or ambiguous ownership.

**Stable contracts.** Public APIs are defined before they are consumed. Once accepted, they become canonical. Changes to stable contracts require explicit review and acceptance.

**Incremental evolution.** The platform evolves one layer at a time. Each layer provides a foundation for the next without depending on it. This prevents the need for rewrites when new capabilities are added.

**Separation of responsibilities.** Infrastructure belongs to the platform. Business logic belongs to modules. The two are never mixed. Modules never construct infrastructure. Infrastructure never contains module-specific logic.

**Simplicity over cleverness.** The simplest implementation that satisfies the requirements is preferred. Clever optimisations, generic abstractions, and future-proofing for unconfirmed use cases are avoided until evidence justifies them.

**Reuse before creation.** Before introducing a new abstraction, service, or utility, existing code is searched first. Duplicate implementations are eliminated. Parallel abstractions for similar problems are not accepted.

**Deterministic behaviour.** The platform must produce the same results given the same inputs and sequence of operations. Non-deterministic behaviour — random ordering, race conditions, silent failures — is considered a defect.

---

## 3. Design Values

**Predictability.** Behaviour should be obvious from the code and contracts. Surprising side effects, implicit state, and hidden dependencies are avoided.

**Maintainability.** Every component should be understandable in isolation. A developer working on one part of the system should not need to understand unrelated parts.

**Modularity.** Components are self-contained and communicate through defined interfaces. Replacing one component with another implementation should not require changes to its consumers.

**Extensibility.** The platform should accommodate new functionality without structural changes. Adding a module should not require modifying platform code.

**Consistency.** Similar problems have similar solutions. Patterns established in one part of the system are followed in others.

**Observability.** The platform exposes its own state for diagnostics and debugging. Runtime inspection is a first-class capability, not an afterthought.

---

## 4. Engineering Discipline

**Minimal scope.** Every implementation addresses exactly the problem at hand. Work that is not directly required by the accepted specification is explicitly out of scope.

**Incremental changes.** Large changes are broken into small, independently verifiable steps. Each step must compile, pass validation, and be reviewable on its own.

**Evidence-based decisions.** Engineering decisions are supported by objective evidence — compilation results, runtime observations, test outcomes, or repository state. Assumptions and speculation are identified as such and not treated as evidence.

**Verification before acceptance.** Implementation is not complete until verification has been performed. Compilation alone is not sufficient evidence of correctness. Runtime behaviour must be confirmed where applicable.

**Avoiding speculative abstractions.** Abstractions are introduced only when there is concrete evidence of a recurring pattern. Future possibilities are not sufficient justification for generic infrastructure.

---

## 5. Documentation Philosophy

Documentation is an architectural asset, not auxiliary material.

The canonical description of the platform lives in documentation, not in conversation history, not in code comments, and not in individual memory. Documentation is treated with the same rigour as code: it has owners, it is reviewed, and it must be kept in sync with the implementation.

Documentation exists to answer questions that code alone cannot:

- Why was a decision made?
- What problem does this component solve?
- What are the boundaries of this module's responsibility?
- What alternatives were considered and rejected?

Without documentation, architectural knowledge becomes tribal. Tribal knowledge is fragile, inaccessible to new contributors, and invisible to AI implementation agents.

---

## 6. Evolution Strategy

The project grows through stable layers.

Each layer solves a specific class of problem and becomes part of the permanent baseline. Later layers may build on earlier ones but must not require changes to them. This means the foundation is never redesigned — it is extended.

Within a layer, evolution happens through addition rather than modification. New capabilities are added alongside existing ones. Existing capabilities are modified only when the accepted specification requires it.

Major redesigns are avoided. When a change would require modifying multiple layers, the change is decomposed into smaller steps, each preserving backward compatibility with the layer below.

---

## 7. Decision Making

Engineering decisions are made based on the following hierarchy of authority:

1. Accepted EPICs and documented architecture.
2. Established patterns within the existing codebase.
3. Objective evidence (compilation, tests, runtime observations).
4. Engineering principles defined in this document.

When a decision conflicts with an accepted baseline, the baseline takes precedence. Changing the baseline requires explicit review and acceptance.

When evidence is unavailable, the decision is deferred or marked as explicitly uncertain. Assumptions are documented so they can be validated later.

Every significant decision should be traceable to its supporting evidence or accepted specification. Decisions made without evidence are explicitly labelled as provisional.
