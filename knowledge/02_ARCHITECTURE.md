# Architecture

**Purpose:** Canonical architectural description of the Companion platform.

**Status:** Accepted

---

## 1. Architectural Overview

Companion is a layered platform. Each layer has a well-defined responsibility, clear ownership, and strict dependency rules. Higher layers depend on stable abstractions provided by lower layers. Lower layers have no knowledge of higher layers.

The platform is organised around a single orchestrator that owns all infrastructure. Modules never interact with infrastructure directly; they interact through public APIs provided by the orchestrator. This separation ensures that modules remain decoupled from platform internals and that infrastructure can evolve without affecting module code.

Communication follows a publisher-subscriber model. State is owned by the component that produced it and is shared through immutable snapshots. No component can mutate another component's state.

---

## 2. Architectural Layers

**Platform Foundation.** The base layer that defines the fundamental types and contracts used throughout the system: module identity, module metadata, capability definitions, and the contract every module must implement. All other layers depend on this foundation.

**Infrastructure.** The internal layer that implements shared platform services: state versioning, event publication, diagnostics, persistence, capability discovery, service discovery, and module dependency validation. This layer is owned entirely by the orchestrator and is not directly accessible to modules.

**Public APIs.** The stable contracts that bridge infrastructure and modules. Modules receive platform services through dependency injection — a controlled set of infrastructure capabilities exposed through a defined interface. This layer is the only way modules interact with the platform.

**Modules.** Self-contained units that implement specific functionality. Modules depend on public APIs but never on internal infrastructure. Modules cannot depend on each other's internals; communication between modules occurs through the platform's event system.

**User Interface.** The presentation layer that renders module content within the CRM page. UI components are owned by modules and communicate with their module through a defined controller contract. The platform provides no UI framework — each module is responsible for its own presentation.

Dependencies flow downward: User Interface → Modules → Public APIs → Infrastructure → Platform Foundation. No layer depends on a layer above it.

---

## 3. Ownership Model

Every architectural responsibility has exactly one owner. Ownership is assigned at the layer level and is never shared or ambiguous.

The orchestrator owns all infrastructure. No module or external component can register services, create infrastructure instances, or influence infrastructure lifecycle. Infrastructure ownership is absolute and non-delegable.

Modules own their business logic, state, and presentation. The platform does not dictate how modules implement their internals as long as they conform to public API contracts.

This explicit ownership prevents two common sources of architectural decay: components that gradually accumulate unrelated responsibilities, and infrastructure that becomes coupled to specific feature logic.

---

## 4. Dependency Direction

Dependencies follow a strict top-down direction. Higher layers depend on lower layers. Lower layers must never depend on higher layers.

Stable abstractions live in lower layers. The Platform Foundation and Public API layers define contracts that remain stable across module changes. Implementation details that may change — such as specific services or module internals — live in higher layers and depend on those stable contracts.

Implementation depends on contracts, never the reverse. A module depends on a public API interface, not on the infrastructure implementing that interface. This allows the infrastructure to be replaced or upgraded without module changes.

Cyclic dependencies are prevented at the architectural level. Each layer has a defined set of permitted dependencies. A dependency that crosses layer boundaries in the wrong direction is treated as an architectural violation.

---

## 5. Data and Control Flow

**Initialisation flow.** The platform starts at the foundation layer and proceeds upward. Foundation types and contracts are established first. Infrastructure is built on top of the foundation. Public APIs are made available to modules. Modules are registered and initialised. User interface components are created.

This order guarantees that when a module initialises, all the infrastructure and APIs it depends on are already available.

**Communication flow.** Components communicate through a publish-subscribe pattern. A component publishes an event to the platform. Other components that have subscribed to that event type receive an immutable copy. Publishers have no knowledge of subscribers.

This decouples the producer of information from its consumers. Adding a new subscriber does not require modifying the publisher.

**State ownership.** State is owned by the component that produced it. The platform provides mechanisms for state to be persisted and shared, but it never takes ownership. Shared state is always read-only from the consumer's perspective.

**Lifecycle ownership.** Lifecycle is owned by the orchestrator. Modules do not control when they are initialised or disposed. The orchestrator sequences all lifecycle events deterministically. This ensures predictable startup and shutdown order.

---

## 6. Extensibility

The architecture supports extensibility through stable public APIs and a deterministic lifecycle.

New modules are added by implementing a defined module contract and registering through the orchestrator. No existing platform code needs to change. The orchestrator discovers the module, injects the required platform services, and manages its lifecycle automatically.

New infrastructure capabilities are added by extending the infrastructure layer and exposing them through the public API layer. Existing public APIs remain unchanged; new capabilities are offered alongside existing ones.

Because dependencies flow downward and abstractions are stable, adding new functionality never requires modifying lower layers. The foundation and infrastructure layers are extended, not rewritten.

---

## 7. Architectural Boundaries

The platform architecture defines clear boundaries that prevent coupling and scope creep.

**Platform boundary.** The platform owns infrastructure, lifecycle, and communication. It does not own business logic, domain state, or user interface. Any code that implements a specific feature belongs in a module, not in the platform.

**Module boundary.** A module owns its domain logic, its internal state, and its user interface. It does not own infrastructure, platform services, or other modules' concerns. A module cannot access another module's internal state or depend on another module's implementation.

**Public API boundary.** Public APIs are the contract between platform and modules. Modules may only interact with the platform through these APIs. The platform may not bypass its own public APIs to access module internals.

**Communication boundary.** Events are the only cross-module communication channel. Modules do not call each other's methods, share state, or depend on each other's types. Any interaction between modules must go through the event system.

These boundaries are enforced at the architectural level. Violating a boundary is a design defect, regardless of whether the code compiles or runs correctly.

---

## Navigation

- **Previous:** [Engineering Philosophy](01_ENGINEERING_PHILOSOPHY.md)
- **Next:** [Components](03_COMPONENTS.md)
- **Related:** [INDEX.md](INDEX.md) | [README.md](README.md)
