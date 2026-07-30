# Baseline

**Purpose:** Canonical reference for the accepted architectural state of the Companion project.

**Status:** Accepted

---

## 1. Purpose

The Baseline defines what has been architecturally accepted. It is the authoritative record of decisions that have become part of the project's permanent foundation.

The Baseline is descriptive, not prescriptive. It records what exists architecturally, not what is planned. Future work builds on this foundation but is not part of it.

Roadmap content, future EPICs, and speculative architecture have no place in this document.

### What is part of the Baseline

- Accepted EPICs and their architectural outcomes.
- Accepted Architecture Decision Records (ADRs).
- Canonical documentation that describes accepted architecture.
- The Architecture Manifest (revision number, project version, accepted EPIC list).
- Infrastructure components, contracts, and public APIs that have passed review.

### What is not part of the Baseline

- Source code alone — code implements the Baseline but never defines it.
- Unaccepted EPICs, proposals, or roadmap items.
- Implementation details not described in accepted documentation.
- Internal implementation that has not been reviewed and accepted.
- Experimental or speculative work, even if present in the codebase.

---

## 2. Baseline Principles

**Accepted architecture is canonical.** Once an architectural decision is accepted and recorded in the Baseline, it becomes the authoritative reference. Subsequent work must be consistent with accepted decisions unless a new EPIC explicitly revisits them.

**New work builds upon the baseline.** Every EPIC assumes the Baseline as its starting point. Accepted foundations are not recreated. If the Baseline states that a capability exists, new work does not rebuild it — it extends or consumes it.

**Accepted decisions are not reimplemented.** Reimplementing accepted architecture wastes effort and introduces inconsistency. If the Baseline documents a service, a registry, or a contract, that component is considered part of the permanent foundation.

**Architectural stability.** The Baseline changes only through explicit acceptance. Incremental additions extend the Baseline without modifying existing entries. Breaking changes require a major architecture revision.

**Incremental evolution.** The Baseline grows one EPIC at a time. Each accepted EPIC extends the Baseline without invalidating previous entries.

---

## 2.5 Baseline Composition

The Baseline is composed of relationships between four distinct artifacts:

- **Code** implements the Baseline. Code provides runtime evidence that the architecture works as described. However, code alone never changes the Baseline. An implementation that exists in source files but has not been through the promotion process is not part of the Baseline.
- **Accepted EPICs** are the mechanism by which the Baseline changes. Every addition or modification to the Baseline begins as an EPIC that undergoes review and acceptance.
- **ADRs** (Architecture Decision Records) preserve the rationale behind Baseline entries. The Baseline records what was accepted; ADRs record why it was accepted that way.
- **Documentation** is the canonical record of the Baseline. The source of truth is maintained in Knowledge Base documents, not in conversation history, commit messages, or informal notes.

### Authority

When conflicts occur, the following hierarchy determines authority:

1. **Accepted Baseline document** (`knowledge/06_BASELINE.md`) — highest authority for architectural state.
2. **Accepted ADRs** (`docs/adr/`) — authority for architectural rationale and decision context.
3. **Canonical Knowledge Base documents** (`knowledge/`) — authority for architecture, components, APIs, and process.
4. **Source code** — implements the Baseline. If code contradicts accepted documentation, the documentation takes precedence until an EPIC explicitly changes it.
5. **Informal documentation** (drafts, proposals, unaccepted notes) — no authority over accepted documents.

A conflict between code and accepted documentation is always resolved by updating the code to match the documentation, unless a new EPIC explicitly changes the architecture.

---

## 3. Current Architecture Revision

The current architecture revision is **R9**.

An architecture revision identifies a specific, immutable state of the platform architecture. Each accepted EPIC increments the revision. Modules, public APIs, and internal infrastructure are consistent within a single revision.

Older revisions are historical records. New work is always defined against the current revision. When a new revision is accepted, the previous revision becomes part of the project's architectural history but is no longer the active foundation.

---

## 4. Accepted Foundation

The following architectural foundations have been accepted and are part of the permanent baseline.

**Platform Foundation.** The base layer defining module identity, module metadata, capability contracts, and the fundamental types that all other layers depend on. This layer has no dependencies on any other component.

**Architecture Manifest.** The project's canonical description of its own state — project version, architecture revision, accepted EPICs, and current phase. The Manifest is updated with every accepted EPIC.

**Module lifecycle.** Modules follow a deterministic lifecycle: registration, dependency injection, initialisation, and disposal. Lifecycle is owned by the platform, not by modules. Registration and initialisation are distinct phases.

**Dependency injection.** Modules receive platform capabilities through a controlled injection mechanism. No module constructs or accesses infrastructure directly. Infrastructure dependencies are declared at registration time.

**Event communication.** Components communicate through a publish-subscribe event system. Events are immutable after publication. Subscribers are isolated from each other's failures. Publishers have no knowledge of subscribers.

**Immutable state publication.** Platform and module state is published as immutable snapshots. No component can mutate another component's state. State consumers receive read-only views.

**Version management.** A central versioning mechanism tracks state changes across the platform. Versions are immutable after publication. Modules and infrastructure can observe version history without modifying it.

**Diagnostics and observability.** Platform state can be inspected at runtime through a read-only diagnostics mechanism. Diagnostics expose what the platform knows without allowing external components to modify platform state.

**Platform persistence.** A central persistence mechanism allows modules to store and retrieve state. Persistence is lifecycle-aware — stored data is cleaned up when the owning module is disposed. Storage keys are structured and validated.

**Capability registry.** Platform capabilities are registered centrally and discoverable through a read-only query mechanism. Capabilities describe what modules can do, not how they do it. Registration happens during module registration, before initialisation.

**Service registry.** Shared service implementations are registered centrally and discoverable through a read-only query mechanism. Services provide concrete implementations behind defined contracts. Registration happens during module registration.

**Dependency validation.** Module dependencies on capabilities and services are validated before initialisation. Missing dependencies produce deterministic failures at registration time, not at runtime.

**Plugin API.** An extended module contract that provides platform context for plugins. Plugin modules conform to a standardised interface and are adapted to the standard module lifecycle through a bridge mechanism.

**Launcher API.** A registry for launcher entries that modules can contribute to the platform's launcher interface. Entries are ordered and can be dynamically registered and unregistered.

**Finance operations.** A complete feature module demonstrating the platform architecture: finance state management, versioning on state mutations, event publication for state changes, and lifecycle-aware persistence.

---

## 5. Versioning Philosophy

Architectural versions evolve through a structured process:

- **Minor increments** occur when a new EPIC is accepted. Each accepted EPIC adds to the architectural foundation without breaking existing contracts.
- **Major increments** occur when the architecture undergoes a breaking change — removal or fundamental alteration of a previously accepted contract. Major increments require explicit review and acceptance of a breaking-change EPIC.
- **Revisions are sequential.** There is no branching or parallel version tracks. The current revision is always the direct successor of the previous one.
- **Backward compatibility** is maintained within a major revision. Code written against revision R(x) continues to work against revision R(y) where x and y share the same major version.

The versioning system provides predictability: contributors know that accepted architecture will not change without notice, and that breaking changes are confined to major revision boundaries.

---

## 6. Baseline Promotion

Work becomes part of the Baseline through a defined promotion pipeline. Each stage must be completed before the next begins:

1. **Implementation** — The accepted EPIC is implemented according to its scope and requirements.
2. **Verification** — The implementation passes all verification criteria defined in the EPIC. Evidence is collected and reported.
3. **Review** — The implementation undergoes architectural review. Scope compliance, architectural consistency, verification completeness, and documentation impact are evaluated.
4. **Acceptance** — The review concludes with an explicit acceptance decision. Rejected work returns to implementation for correction and resubmission.
5. **Merge** — The accepted implementation is merged into the main branch. The codebase now reflects the new architectural state.
6. **Baseline update** — The Baseline document and Architecture Manifest are updated to reflect the new acceptance. The architecture revision is incremented.

**Implementation alone never changes the Baseline.** Code merged without going through this promotion pipeline does not become part of the accepted architectural state, even if it is present in the repository.

---

## 7. Baseline Change Rules

### When the Baseline is updated

- After an EPIC passes review and is merged.
- When a superseding ADR is accepted.
- When the Architecture Manifest changes (project version, revision, accepted EPIC list).

### When the Baseline is not updated

- When code is merged without an accepted EPIC.
- When implementation scope exceeds the accepted EPIC without explicit approval.
- When documentation is corrected without architectural change.
- When experimental or speculative work is added to the repository.

### Handling superseded decisions

When an architectural decision is superseded by a new ADR:

- The Baseline is updated to reflect the new decision.
- The original ADR remains in the archive with status "Superseded by ADR-XXX".
- The superseded decision is not removed from the Baseline history — it is replaced by the new entry.
- Older architecture revisions remain as historical records.

### Relationship with ADR history

The Baseline records the current accepted architectural state. ADRs in `docs/adr/` preserve the full decision history, including superseded and deprecated records. To understand why the Baseline looks the way it does, consult the ADR that produced each entry. To understand what the Baseline currently requires, consult the Baseline document directly.

---

## 8. Relationship to Other Documents

The Baseline is one of several architectural documents, each with a distinct responsibility:

- **Architecture** describes how the platform is structured — its layers, ownership model, dependency direction, and flow. The Baseline records what has been accepted as part of that structure.
- **Roadmap** describes planned future work. The Baseline describes what already exists. Roadmap items become Baseline entries only after their EPIC is accepted and implemented.
- **Architecture Decisions** document the rationale behind specific choices. The Baseline records the outcome of those decisions, not the reasoning that led to them.
- **ADRs** (`docs/adr/`) record individual architectural decisions with context, consequences, and status. The Baseline is the aggregate of accepted ADR outcomes.
- **Review Process** describes how EPICs are reviewed and accepted. The Baseline records the results of that process.

In summary: the Baseline is the record of accepted architectural state. It is neither a plan, a rationale, nor a procedure.

---

## Navigation

- **Previous:** [Internal Infrastructure](05_INTERNAL_INFRASTRUCTURE.md)
- **Next:** [Roadmap](07_ROADMAP.md)
- **Related:** [INDEX.md](INDEX.md) | [Architecture Decisions](08_ARCHITECTURE_DECISIONS.md) | [README.md](README.md)
