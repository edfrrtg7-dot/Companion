# Internal Infrastructure

**Purpose:** Architectural description of Companion's internal platform layer.

**Status:** Accepted

---

## 1. Purpose

The internal infrastructure layer exists so that shared platform concerns are owned centrally rather than duplicated across modules. It provides the services that every module needs — state versioning, event distribution, diagnostics, persistence — without requiring modules to build or manage those services themselves.

This layer is intentionally invisible to modules. Modules interact with infrastructure only through the Public API layer. The infrastructure can be replaced, restructured, or extended without module code being affected, as long as the public API contracts remain stable.

---

## 2. Infrastructure Responsibilities

**Orchestration.** The infrastructure owns the central coordination of all platform components. It determines the order of initialisation, enforces lifecycle rules, and ensures that all shared services are operational before modules begin execution.

**Lifecycle management.** The infrastructure controls when modules are registered, initialised, and disposed. Modules do not control their own lifecycle. Lifecycle is deterministic — the same sequence of operations always produces the same results.

**Service coordination.** The infrastructure manages the registration and discovery of shared services. Services are registered centrally and made available through the Public API layer. Modules consume services but never manage their lifecycle or implementation.

**Capability coordination.** The infrastructure manages the registration and discovery of platform capabilities. Capabilities describe what the platform or its modules can do, independent of how those capabilities are implemented.

**Diagnostics.** The infrastructure collects and exposes internal platform state for inspection. Diagnostics are read-only — they provide visibility into the platform's operation without allowing external components to modify platform state.

**Persistence.** The infrastructure provides mechanisms for persisting and retrieving module state. Persistence is managed centrally to ensure consistent serialisation, storage key discipline, and lifecycle-aware cleanup.

**Event distribution.** The infrastructure routes events between components. Events are the primary communication mechanism across the platform. The infrastructure ensures that events are delivered to all subscribers, that subscribers are isolated from each other's failures, and that events are immutable after publication.

---

## 3. Ownership

Infrastructure exclusively owns the following responsibilities, none of which can be delegated to modules:

- **Initialisation sequencing.** Only the infrastructure determines the order in which components start and stop. If modules controlled lifecycle, dependency ordering could not be enforced, and initialisation would be unpredictable.

- **Service lifecycle.** Services managed by the infrastructure are registered and disposed by the infrastructure. Module-discovered services are guaranteed to exist for the module's entire lifetime. If modules managed service lifecycle, a module could dispose a service that another module depends on.

- **Platform state integrity.** The infrastructure ensures that platform state — registered capabilities, available services, diagnostic data — is internally consistent. Modules observe this state but never modify it directly.

- **Communication routing.** The infrastructure owns the routing of all cross-component communication. If modules communicated outside the infrastructure, the platform would lose visibility into interactions, and isolation guarantees would be unenforceable.

---

## 4. Internal Boundaries

The following responsibilities remain internal and are intentionally excluded from the Public API:

- **Service implementation.** The Public API defines how modules consume services, but never how services are implemented, registered, or disposed. The implementation details of any service are internal infrastructure concerns.

- **Event routing infrastructure.** The Public API exposes the ability to publish and subscribe to events, but never how events are routed, delivered, or stored. The routing mechanism is internal and may change.

- **Persistence storage backends.** The Public API exposes the ability to persist and retrieve data, but never how data is stored, where it is stored, or what storage backend is used. Storage implementation is internal.

- **Diagnostic collection.** The Public API exposes diagnostic snapshots for inspection, but never how diagnostics are collected, aggregated, or retained. The collection mechanism is internal.

- **Lifecycle scheduling.** The Public API allows modules to observe lifecycle events, but never how lifecycle is scheduled, ordered, or enforced. The scheduling mechanism is internal.

The architectural rule is: if a responsibility exists only to support implementation, it is internal. If a responsibility fulfils a contract that modules depend on, it is part of the Public API.

---

## 5. Infrastructure Evolution

Internal infrastructure may evolve freely as long as public API contracts remain stable.

Services may be replaced with entirely different implementations. Storage backends may change. Event routing strategies may be optimised. Diagnostic collection may be extended or consolidated. None of these changes require module modifications because no module depends on infrastructure implementation details.

When infrastructure evolves, the following rules apply:

- New internal capabilities may be added without coordination with modules.
- Existing internal capabilities may be modified or removed as long as no public API contract changes.
- Internal interfaces between infrastructure components are not public contracts and may change without notice.
- Before modifying an internal capability, the infrastructure verifies that no public API contract depends on the specific implementation behaviour being changed.

---

## 6. Architectural Guarantees

- **Determinism.** Given the same sequence of operations, the infrastructure produces the same results. Module registration order, initialisation order, and disposal order are fixed and repeatable.

- **Consistency.** Infrastructure state is internally consistent at all observable points. Capability registration, service availability, and diagnostic snapshots are always coherent. Partial updates are never visible to consumers.

- **Isolation.** Failures within infrastructure services are contained. A failure in one service does not cascade to other services. Module failures are also contained — a failing module cannot corrupt infrastructure state.

- **Reliability.** Infrastructure services are available from the moment initialisation completes until disposal begins. No service is revoked, restarted, or replaced while modules are executing. Modules can rely on infrastructure availability for their entire lifetime.

---

## 7. Relationship to Public APIs

Public APIs are the visible face of internal infrastructure. Every public API capability corresponds to an internal infrastructure responsibility, but the mapping is not one-to-one. A single internal service may support multiple public API capabilities. Multiple internal services may collaborate to fulfil a single public API contract.

The relationship follows these rules:

- Public APIs define **what** modules can do. Internal infrastructure defines **how** it happens.
- Public APIs are stable contracts. Internal infrastructure is implementation that may change.
- Public APIs are the only permitted access path. Modules must never bypass public APIs to reach infrastructure directly.
- Internal infrastructure never exposes its interfaces as public contracts. If a module needs a capability, a public API is created for it — the internal interface is never reused as the public one.

This separation allows the platform to evolve its implementation without disrupting its consumers, and allows modules to depend on stable contracts without needing to track infrastructure changes.

---

## Navigation

- **Previous:** [Public APIs](04_PUBLIC_APIS.md)
- **Next:** [Baseline](06_BASELINE.md)
- **Related:** [INDEX.md](INDEX.md) | [README.md](README.md)
