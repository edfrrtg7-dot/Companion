# Public APIs

**Purpose:** Architectural description of Companion's public platform contracts.

**Status:** Accepted

---

## 1. Purpose

Public APIs are the stable boundary between the platform and its modules. They exist so that modules can depend on platform capabilities without depending on platform implementation.

Without a defined public API layer, modules would either duplicate infrastructure (wasteful and inconsistent) or couple themselves to internal platform code (fragile and impossible to maintain). Public APIs solve both problems: they provide a single, controlled channel through which modules access platform services, and they shield modules from changes in how those services are implemented.

---

## 2. API Design Principles

**Stability.** Public APIs are the most stable layer of the platform. Once accepted, they are treated as immutable contracts. Changes are permitted only through explicit EPIC review.

**Explicit contracts.** Every API capability is declared explicitly. There are no implicit services, optional injections that may or may not be available, or runtime checks to discover whether a capability exists. Contracts are known at registration time.

**Backward compatibility.** Within the same architecture revision, code written against a public API continues to work without modification. Additive changes do not break existing consumers.

**Minimal surface area.** Public APIs expose only what modules need. Internal capabilities are not made public. Every exposed capability increases the cost of evolution and is justified by concrete module requirements.

**Predictable behaviour.** API operations have defined behaviour, defined preconditions, and defined postconditions. There are no hidden side effects. Calling the same API with the same inputs produces the same results.

**Versioned evolution.** Breaking changes are confined to major architecture revisions. Within a revision, APIs evolve by addition only.

---

## 3. Platform APIs

**Platform context.** A single entry point through which a module receives all the platform capabilities it is permitted to use. The context is injected during module registration and remains stable for the module's lifetime. It provides access to infrastructure capabilities without exposing how those capabilities are implemented.

**Capability access.** Modules can discover which capabilities are available in the platform and query whether a specific capability is registered. Capability access is read-only — modules cannot register or unregister capabilities. The capability system allows modules to coordinate without depending on each other's implementations.

**Service access.** Modules can retrieve registered service implementations through a service discovery mechanism. As with capabilities, service access is read-only. Modules cannot register services. Services are the mechanism for one module to provide a concrete implementation that other modules can use through a well-defined contract.

**Lifecycle interaction.** Modules can observe lifecycle events — such as initialisation completion or pre-disposal — through the platform. Lifecycle observation is passive; modules cannot influence lifecycle ordering or prevent lifecycle transitions. This allows modules to perform setup or teardown in response to platform state changes.

---

## 4. Consumer Responsibilities

Modules must declare their API dependencies at registration time. The platform uses these declarations to verify that all required capabilities and services are available before the module initialises.

Modules must not bypass public APIs to access internal infrastructure. Direct access to infrastructure internals is an architectural violation even if the code compiles or works at runtime.

Modules must not assume that capabilities or services registered by other modules will be available. The platform validates dependencies, but modules should handle the case where a dependency is explicitly optional.

Modules must not depend on the internal implementation of any public API. Behaviour described in the API contract is guaranteed; behaviour not described is not guaranteed and may change without notice.

---

## 5. Compatibility Rules

**Additive evolution.** APIs evolve through addition. New capabilities, new parameters with defaults, and new query methods may be added within the same architecture revision. Existing contracts are not changed.

**Deprecation.** When an API capability is superseded, it is marked as deprecated. Deprecated capabilities remain functional for at least one full architecture revision. They are removed only in a major revision with explicit documentation of the replacement.

**Major version boundaries.** Breaking changes — removing a capability, changing contract semantics, or altering preconditions — require a major architecture revision. All consumers must be updated at the boundary.

**Avoiding breaking contracts.** A change is breaking if it would cause an existing correct module to fail to compile, fail at registration, or behave differently without modification. Additive changes, bug fixes that bring behaviour in line with documented contracts, and performance improvements that do not change observable behaviour are not considered breaking.

---

## 6. Architectural Guarantees

- Every public API is available and functional before any module initialises.
- Public APIs remain available for the entire lifetime of a module. No API is revoked during module execution.
- Changes to infrastructure implementation never change the observable behaviour of public APIs.
- The platform validates all declared module dependencies against available APIs before initialisation.
- Public APIs are architecture-level contracts. Module-level tests or integration tests that pass against a given API revision continue to pass within that revision.
- No internal infrastructure detail is ever exposed through a public API.

---

## 7. API Boundaries

Public APIs contain only contracts that modules are permitted to depend on. Everything else is internal infrastructure.

A capability belongs in the public API if modules need to discover it. If only the platform uses it internally, it belongs in infrastructure.

A service registration belongs in the public API if modules need to consume it. If it is a platform-internal service used exclusively by other infrastructure components, it belongs in infrastructure.

The lifecycle API belongs in the public API only to the extent that modules need to observe lifecycle events. Lifecycle control — ordering, sequencing, precondition enforcement — is infrastructure.

Implementation details never cross the boundary. The public API defines what a module can do, never how the platform does it. Any type, function, or constant that exists only to support platform implementation is excluded from the public API.
