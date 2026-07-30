# Components

**Purpose:** Architectural reference for every major platform component.

**Status:** Accepted

---

## Platform Foundation

### Purpose

Defines the fundamental types and contracts that all other components depend on. Without this component, no other part of the platform can express module identity, module metadata, or capability contracts in a consistent way.

### Responsibilities

- Define what a module is and what structure every module must conform to.
- Define what capabilities are and how they are described.
- Define the types and contracts that form the vocabulary of the platform.

### Does Not Own

- Does not own infrastructure, services, or platform behaviour.
- Does not own module business logic.
- Does not own initialisation or lifecycle decisions.

### Dependencies

Depends on nothing outside itself. It is the lowest architectural layer.

### Architectural Guarantees

- The types and contracts defined in this layer are stable. No accepted EPIC changes or removes them without explicit review.
- Every component in every layer above can rely on these definitions being present and unchanging.

### Evolution Rules

- New foundation types may be added. Existing types may be extended but never removed without a major architecture revision.
- Changes that would invalidate existing module implementations are not permitted.

---

## Infrastructure

### Purpose

Provides the shared services that every module needs but that no module should build itself: state versioning, event publication, runtime diagnostics, persistence, capability discovery, service discovery, and dependency validation.

### Responsibilities

- Own and manage all shared platform services.
- Ensure services are available and correctly configured before modules initialise.
- Enforce deterministic behaviour across all platform operations.

### Does Not Own

- Does not own module business logic.
- Does not own module state (it persists and distributes state, but ownership remains with the producing module).
- Does not own the public API contracts that modules consume.

### Dependencies

Depends on Platform Foundation for types and contracts. Depends on nothing above the Infrastructure layer.

### Architectural Guarantees

- All infrastructure services are available before any module initialises.
- Infrastructure behaviour is deterministic — identical sequences produce identical results.
- Infrastructure never leaks internal state to modules outside of defined public API channels.
- Service implementations can be replaced without affecting modules, as long as the public API contract is preserved.

### Evolution Rules

- New services may be added alongside existing ones.
- Existing services may be extended with new capabilities.
- Removing or changing existing service behaviour requires a new public API contract or an accepted EPIC that explicitly modifies the contract.

---

## Public APIs

### Purpose

Bridge the Infrastructure layer and the Module layer. Modules receive platform capabilities through stable, controlled interfaces that encapsulate internal infrastructure details.

### Responsibilities

- Define the interface through which modules access infrastructure.
- Enforce that modules cannot access infrastructure outside the defined interface.
- Remain stable — modules written against a given API version should work across infrastructure changes.

### Does Not Own

- Does not own infrastructure implementations.
- Does not own module internals.
- Does not own the types and contracts defined in Platform Foundation.

### Dependencies

Depends on Platform Foundation types. Receives infrastructure capabilities but does not depend on infrastructure implementations — only on the contracts those implementations fulfil.

### Architectural Guarantees

- The set of public APIs is the exclusive channel for module-platform interaction.
- No module can bypass public APIs to access infrastructure directly.
- Public APIs remain backward compatible within a given architecture revision. Breaking changes require a major version increment.

### Evolution Rules

- New APIs may be added. Existing APIs may gain new methods.
- Existing API methods may not be removed or have their signatures changed without a breaking-change EPIC and major version bump.

---

## Modules

### Purpose

Implement specific operational features — finance monitoring, diagnostics dashboards, or other tools — that users interact with inside the CRM.

### Responsibilities

- Own their business logic, domain state, and internal data models.
- Implement the module contract defined in Platform Foundation.
- Consume platform services only through public APIs.
- Manage their own user interface within the CRM page.

### Does Not Own

- Does not own platform infrastructure.
- Does not own other modules' state or logic.
- Does not own the lifecycle or initialisation sequence.

### Dependencies

Depends on Platform Foundation (module contract) and Public APIs (platform services). Never depends on Infrastructure directly. Never depends on other modules' implementations.

### Architectural Guarantees

- Modules are isolated — a failure in one module cannot affect others.
- Modules can be added or removed without modifying platform code.
- Modules receive platform services after all infrastructure is initialised and before any module is used.

### Evolution Rules

- Modules evolve independently. A module can be rewritten or replaced as long as it implements the same module contract.
- Modules cannot introduce dependencies on unstable or internal platform code.
- Deprecated modules are removed cleanly — their lifecycle disposal removes all registered listeners, persisted state, and event subscriptions.

---

## User Interface

### Purpose

Render module functionality within the CRM page. Transform module state into interactive visual elements that users can see and operate.

### Responsibilities

- Render module-owned UI components.
- Dispatch user interactions back to the owning module through the module's controller contract.
- Adapt to the CRM page's layout and constraints.

### Does Not Own

- Does not own module business logic.
- Does not own platform infrastructure.
- Does not own the module's state or data model.

### Dependencies

Depends on the module it belongs to. Depends on the browser DOM and the CRM page environment. Does not depend on other UI components or on platform infrastructure.

### Architectural Guarantees

- UI rendering never blocks platform initialisation or module logic.
- UI components are owned by their module and disposed when the module is disposed.
- No cross-module UI coupling — one module's UI cannot affect another module's UI.

### Evolution Rules

- UI components can be redesigned without affecting module logic, as long as they respect the module's controller contract.
- Modules may replace their UI entirely without coordination with other modules.
- UI components may be added or removed as modules evolve.

---

## Navigation

- **Previous:** [Architecture](02_ARCHITECTURE.md)
- **Next:** [Public APIs](04_PUBLIC_APIS.md)
- **Related:** [INDEX.md](INDEX.md) | [README.md](README.md)
