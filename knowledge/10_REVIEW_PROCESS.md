# Review Process

**Purpose**

**Status:** Accepted

A formal review process ensures that every proposal, implementation, and change that seeks to become part of the accepted project baseline undergoes objective evaluation. The process determines whether work satisfies scope, architectural consistency, verification completeness, and documentation quality before it is promoted to the baseline.

---

## 2. Review Principles

- **Objective evidence** – Decisions are based on verifiable outputs: compiler results, runtime traces, test outputs, and repository state.
- **Architectural consistency** – Work must align with the current accepted architecture and not violate documented constraints.
- **Reproducibility** – Evaluation must be repeatable; the same submission should yield the same outcome under identical conditions.
- **Incremental acceptance** – Submissions are accepted in small, self‑contained units so that each change can be validated independently.
- **Explicit verification** – Verification steps and their outcomes are recorded and must be satisfied before acceptance.

---

## 3. Review Workflow

The review workflow determines whether implementation becomes part of the accepted project Baseline. The workflow distinguishes between **accepted implementation** (code that passes review and is merged) and **promoted Baseline** (accepted architecture that is canonically recorded).

1. **Submission** – The author submits a proposal or implementation with a clear description of intent and a list of modified files.
2. **Analysis** – Reviewers evaluate scope, architectural alignment, and documentation impact. Any discrepancies are noted.
3. **Verification** – The reviewer runs the evidence hierarchy: compile, run tests, evaluate runtime behaviour, if necessary perform static analysis.
4. **Decision** – Based on analysis and verification, the reviewer decides to accept, reject, or request changes.
5. **Accepted implementation** – If accepted, the implementation is merged into the main branch. The codebase now reflects the change.
6. **Baseline promotion** – After merge, the Baseline document (`knowledge/06_BASELINE.md`) and Architecture Manifest are updated. The architecture revision is incremented. The change becomes part of the canonical architectural state.

An implementation that passes review and is merged but has not been promoted to the Baseline does not change the accepted architecture.

---

## 4. Verification Standards

- **Evidence hierarchy** (from most reliable to least):
  1. Runtime evidence
  2. Compiler evidence
  3. Automated test evidence
  4. Repository evidence
  5. Source code structure
  6. Static reasoning
- **Verification outcomes**:
  - **VERIFIED** – Direct evidence confirms the expected behaviour.
  - **EXPECTED** – Logical deduction from verified facts implies the behaviour.
  - **UNKNOWN** – Evidence is insufficient; the outcome cannot be determined.
- **Architectural validation** – The submission must not introduce an architectural violation.
- **Implementation completeness** – All files and modules referenced in the proposal are present and compile without errors.

---

## 5. Acceptance Criteria

- **Scope compliance** – Only the files and changes listed in the submission are modified.
- **Architectural consistency** – No new architectural violations are introduced.
- **Verification completeness** – All required evidence is provided and meets the standards. No UNKNOWN results remain.
- **Documentation consistency** – All impacted documentation is updated and in sync with code changes.

---

## 6. Handling Rejections

Rejected submissions receive a concise summary of the reasons, along with specific evidence or evidence gaps. The author may revise the work to address the issues and resubmit. Re‑review follows the same workflow.

---

## 7. Governance

The review process itself is governed by the same procedures that govern architectural decisions:

- Proposals to change the review process are submitted as documentation updates.
- Reviews ensure the process aligns with the Engineering Philosophy and Architecture Decisions.
- Accepted changes become part of the permanent engineering guidance via Baseline promotion (see [`knowledge/06_BASELINE.md`](06_BASELINE.md)).
- Historical versions of the process are retained for reference.
