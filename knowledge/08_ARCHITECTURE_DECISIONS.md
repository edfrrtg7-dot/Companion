# Architecture Decisions

**Purpose:** Permanent record of architectural reasoning for the Companion platform.

**Status:** Accepted

---

## 1. Purpose

Architectural decisions are documented separately from Architecture and Baseline because rationale and outcome serve different purposes.

The Architecture document describes what the platform looks like. The Baseline records what has been accepted. Neither explains why those choices were made. Without the why, future contributors cannot distinguish intentional decisions from accidental ones, cannot evaluate whether a decision's context still applies, and cannot understand which trade-offs were considered and accepted.

This document preserves the reasoning. It exists so that every significant architectural choice is traceable to the context, alternatives, and trade-offs that produced it.

---

## 2. Decision Principles

**Explicit architectural reasoning.** Every significant architectural choice is recorded with its rationale. Implicit decisions — choices made without documentation — are considered provisional until their reasoning is captured.

**Long-term maintainability.** Decisions are evaluated primarily by their effect on long-term maintainability. Short-term convenience is secondary to the platform's ability to remain stable and understandable over years of evolution.

**Consistency over convenience.** When choosing between a consistent approach that requires more up-front work and an inconsistent approach that is faster in the moment, consistency is preferred. The cost of inconsistency accumulates over time.

**Documenting trade-offs.** Every decision involves trade-offs. Both the benefits gained and the costs accepted are documented. A decision that acknowledges its trade-offs is more useful than one that presents itself as an unqualified improvement.

**Traceable evolution.** Decisions are linked to the context that motivated them. When context changes, the decision can be re-evaluated against the original rationale. This prevents decisions from persisting beyond their useful life.

---

## 3. Decision Structure

Each architectural decision should capture the following elements:

**Context.** The circumstances that motivated the decision. This includes the problem being solved, constraints that apply, and dependencies that influenced the outcome. Context is essential for future evaluation — a decision whose context is forgotten cannot be meaningfully reviewed.

**Decision.** The architectural choice that was made. This is stated clearly and unambiguously. It describes what was decided, not how it is implemented.

**Rationale.** The reasoning that led to the decision. This includes which alternatives were considered, why they were rejected, and which trade-offs were accepted. The rationale is the most important part — it is what distinguishes a deliberate decision from an arbitrary one.

**Consequences.** The architectural impact of the decision. This includes what becomes possible, what is constrained, and what responsibilities shift as a result. Consequences may be positive or negative.

**Status.** Whether the decision is accepted, superseded, or deprecated. Accepted decisions are part of the current architectural rationale. Superseded decisions have been replaced by later decisions. Deprecated decisions are no longer recommended but remain for historical traceability.

---

## 4. Decision Categories

Architectural decisions in the Companion project fall into the following categories:

**Layering.** Decisions about how the platform is divided into layers, what each layer is responsible for, and how layers relate to each other. These decisions define the fundamental structure of the platform.

**Ownership.** Decisions about which component owns which responsibility. Ownership decisions determine how responsibilities are distributed and prevent ambiguity about who is responsible for what.

**Dependency direction.** Decisions about which components may depend on which other components. These decisions enforce the dependency graph and prevent architectural coupling.

**Public contract philosophy.** Decisions about what belongs in public APIs, how contracts are defined, and what guarantees they provide. These decisions shape the relationship between platform and modules.

**Extensibility.** Decisions about how the platform accommodates growth. Extensibility decisions determine whether new capabilities are added by extension or by modification.

**Governance.** Decisions about how architectural changes are proposed, reviewed, and accepted. Governance decisions define the process by which the architecture evolves.

---

## 5. Relationship to the Baseline

Accepted decisions shape the Baseline but are not the Baseline itself.

The Baseline records what has been accepted architecturally. The Architecture Decisions record why those acceptances were made. They are complementary: the Baseline answers "what is accepted?", the Architecture Decisions answer "why was it accepted this way?"

A decision that leads to an accepted architectural state is recorded in both places — the outcome in the Baseline, the rationale in Architecture Decisions. A decision that is rejected or superseded is recorded only in Architecture Decisions, preserving the reasoning for historical traceability.

This separation means that reading the Baseline alone tells you what exists, but reading the Architecture Decisions tells you why it exists. Both are needed for a complete understanding of the platform's architecture.

---

## 6. Decision Evolution

Architectural decisions may evolve as the platform grows and context changes.

A decision may be **superseded** when a new decision replaces it. The original decision remains in the document as a historical record, marked with its status and a reference to the decision that superseded it. This preserves the chain of reasoning.

A decision may be **deprecated** when it is no longer considered the best approach but has not yet been formally replaced. Deprecated decisions remain for traceability but should not be used as justification for new work.

A decision may be **reinstated** when a superseding decision is itself superseded and the original reasoning becomes relevant again. The status is updated to reflect the current state.

Decision evolution is always explicit. A decision does not change status without a documented review. This ensures that the decision record remains authoritative and traceable.

---

## 7. Governance

Architectural decisions are governed through the following process:

- **Proposal.** A decision is proposed when an architectural choice needs to be recorded. Proposals may originate from EPIC reviews, architectural discussions, or identified gaps in the existing decision record.
- **Review.** The proposal is reviewed for clarity, completeness, and consistency with existing decisions and the accepted Baseline. Reviewers assess whether the context is accurately described, whether alternatives were fairly considered, and whether trade-offs are honestly acknowledged.
- **Acceptance or rejection.** The decision is either accepted and added to the Architecture Decisions document, or rejected with rationale. Rejected decisions may be revised and resubmitted.
- **Supersession or deprecation.** An existing decision may be superseded or deprecated through the same process. The original decision is updated to reflect its new status and linked to the decision that replaced it.
- **Historical retention.** No decision record is ever deleted. Even superseded and deprecated decisions remain in the document for historical traceability. Removing a decision record would erase the rationale that led to subsequent choices.

The decision record is append-only. New decisions are added. Existing decisions are updated only to change their status or add links to superseding decisions. The content of the original decision is never modified after acceptance.
