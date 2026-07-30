# Glossary

**Purpose**

**Status:** Accepted

A shared glossary ensures consistent terminology across all Companion Knowledge Base documents. It provides a single source of truth for terms whose meanings can influence architectural and implementation decisions, eliminating ambiguity and enabling clear communication among contributors.

---

## 2. Terminology Principles

- **One term for one concept.** Each distinct concept is labeled with a single, unambiguous term.
- **Avoid synonyms.** Multiple terms for the same concept create confusion and are not permitted.
- **Consistent naming.** Terms follow established naming conventions and are not altered without coordinated update.
- **Stable definitions.** Once a term’s meaning is established, it remains fixed unless formally revised through the governance process.
- **Architecture‑independent wording.** Definitions stay free of implementation details, focusing on conceptual meaning rather than technical specifics.

---

## 3. Core Terms

- **Architecture** – The layered organization of the Companion platform that separates concerns through a deterministic and stable hierarchy.
- **Baseline** – The set of architectural components and decisions that have been formally accepted and are part of the permanent project foundation.
- **Component** – A logical unit that contributes to the platform’s functionality. Components are isolated by clear ownership boundaries.
- **Module** – A self‑contained unit of business functionality that conforms to the Platform Foundation contract and interacts with the platform through Public APIs.
- **Infrastructure** – The internal layer containing services owned by the orchestrator: orchestration, lifecycle management, event distribution, persistence, diagnostics, and capability coordination.
- **Platform** – The complete system encompassing the Platform Foundation, Infrastructure, Public APIs, Modules, and User Interface, together providing the Oracle‑grade productivity layer.
- **Public API** – The stable contract that enables Modules to access Infrastructure capabilities without exposing Implementation details.
- **Internal API** – The set of interfaces and contracts used within Infrastructure that are not part of the Public API and therefore remain hidden from Modules.
- **Capability** – A declarative statement of what the platform can do, defining a functional area that can be discovered and consumed by Modules.
- **Service** – A reusable implementation that fulfills a capability contract, made available to Modules through the Service registry.
- **Dependency** – A declared relationship indicating that a Module requires a specific capability, capability registration, or service to function.
- **Extension** – An addition to an existing capability or API without altering the original contract, preserving backward compatibility.
- **Plugin** – A Module that operates under the Plugin API contract, requiring a Plugin Context that provides limited platform context while preserving architectural separation.
- **Review** – The process used to evaluate submissions for architectural consistency, verification completeness, and documentation integrity.
- **Verification** – The systematic check that work satisfies evidence‑based, Architecture‑consistent, and Scope‑compliant criteria.
- **Decision** – A formal choice documented in Architecture Decisions that establishes rationale for an Architectural change.
- **Governance** – The mechanisms and procedures used to manage evolution of the platform, its components, and its documentation.

---

## 4. Documentation Terms

- **EPIC** – An Architectural Enhancement Proposal that introduces or revises a significant Architectural component; represents a change unit in the Roadmap.
- **Proposal** – A candidate EPIC that has entered the review pipeline awaiting Architectural validation.
- **Acceptance** – The formal approval of a Proposal that updates the Baseline and increments the Architecture Revision.
- **Rejection** – The outcome when a Proposal fails Architectural review criteria.
- **Draft** – An unfinished Knowledge Base document awaiting final review and acceptance.
- **Canonical document** – The finalized, version‑controlled edition of a Knowledge Base entry that constitutes the definitive reference.

---

## 5. Verification Terms

- **VERIFIED** – A conclusion supported by direct, objective evidence (runtime, compiler, test, or repository data).
- **EXPECTED** – A logical inference drawn from verified facts that cannot be directly observed but is strongly implied.
- **UNKNOWN** – A state indicating insufficient evidence to draw any conclusion.
- **Evidence** – Any verifiable output or observation that can be used to support a claim about implementation or process.
- **Runtime evidence** – Observations made during the execution of code or system behavior.
- **Compiler evidence** – Results from compilation and type‑checking phases that confirm syntactic or semantic correctness.

---

## 6. Evolution

Terminology changes require coordinated updates across all documents that reference the affected terms. Updates are managed through the same governance process used for architectural decisions, ensuring that definitions remain stable and that all references are synchronized before any change becomes official.

---

## 7. Governance

- **Proposal of change** – Initiated by a contributor filing a terminology update as part of a Knowledge Base modification.
- **Review** – Subject to evaluation for conceptual accuracy, consistency with existing definitions, and alignment with the Principles.
- **Acceptance** – Formal adoption occurs through documented approval, after which the revised definitions replace previous versions.
- **Maintenance** – Updated definitions are versioned alongside the Knowledge Base, retaining historical records for traceability.