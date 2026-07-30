# Architecture Decision Records

**Status:** Accepted

## Purpose

Architecture Decision Records (ADRs) document significant architectural decisions made during the Companion project. Each ADR captures the context, the decision itself, and the consequences, preserving the rationale for future contributors.

ADRs exist to answer the question "why was this done this way?" — providing traceability that source code and implementation documentation alone cannot.

## When an ADR Is Required

An ADR is required for any decision that:

- Introduces or removes an architectural layer.
- Changes a public API contract.
- Modifies dependency rules between components.
- Adopts or replaces a core technology.
- Changes the module lifecycle or ownership model.
- Alters governance or review processes.
- Modifies the relationship between the platform and modules.

An ADR is **not** required for:

- Bug fixes within existing architecture.
- Feature implementation within existing contracts.
- Documentation corrections or formatting changes.
- Routine maintenance or refactoring without architectural impact.

## ADR Lifecycle

Each ADR progresses through the following states:

| State | Description |
|---|---|
| **Proposed** | Under consideration; not yet accepted. |
| **Accepted** | Approved and in effect. The decision is part of the current architecture. |
| **Superseded** | Replaced by a later ADR. The original record is retained for historical traceability with a reference to the superseding ADR. |
| **Deprecated** | No longer recommended but not yet formally replaced. Preserved for reference. |
| **Archived** | Historical record only. No longer referenced but retained for traceability. |

ADR statuses follow the [Knowledge Base documentation lifecycle](../../knowledge/README.md#documentation-lifecycle).

## Relationship to the Project Baseline

Accepted ADRs become part of the project Baseline. The Baseline (`knowledge/06_BASELINE.md`) records the current architectural state; ADRs record the rationale that produced that state.

When an ADR is superseded, the Baseline is updated to reflect the new decision. The superseded ADR remains in the record for historical traceability.

## ADR Index

| ADR | Title | Status |
|---|---|---|
| ADR-001 | Companion becomes a Chrome Extension | Accepted |
| ADR-002 | Companion follows modular architecture | Accepted |
| ADR-003 | CompanionWindow is the only window base class | Accepted |
| ADR-004 | ModuleManager owns module lifecycle | Accepted |
| ADR-005 | Documentation is the source of truth | Accepted |

## Historical Record

Earlier ADRs are preserved in [`docs/decision-log.md`](../decision-log.md) for reference. New ADRs should be created as individual files in this directory.
