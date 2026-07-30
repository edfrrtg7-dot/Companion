# AI Rules

**Purpose:** Operational engineering rules for AI implementation agents contributing to the Companion project.

**Status:** Accepted

---

## 1. Purpose

AI agents require explicit operational rules because they operate differently from human contributors. An AI agent does not carry project context between sessions, cannot rely on implicit knowledge of past decisions, and must be guided by written rules rather than experience or intuition.

These rules constrain implementation behaviour, not architectural design. They tell an AI agent how to approach implementation work while leaving architectural decisions to EPICs and the Review Process.

---

## 2. General Principles

**Architecture first.** Before implementing any change, verify that the accepted architecture supports it. If the change would violate a documented architectural rule, stop and report the conflict. Do not implement workarounds for architectural constraints.

**Baseline first.** Check the Baseline before adding new capabilities. If a required capability already exists in the accepted architecture, reuse it. If it does not exist but should, report the gap rather than building an unplanned replacement.

**Incremental implementation.** Implement the smallest change that satisfies the requirements. Large changes are broken into independently verifiable steps. Each step compiles, passes validation, and is reviewable on its own.

**Evidence over assumptions.** Verify claims with objective evidence — compiler output, runtime observations, test results, repository state. Do not assume behaviour based on how code appears without running it.

**Consistency.** Follow the patterns established in the existing codebase and documentation. Do not introduce new conventions, naming styles, or structural patterns unless the EPIC explicitly requires them.

---

## 3. Implementation Rules

Prefer modifying existing code over creating new abstractions. Before introducing a new module, service, or utility, search the codebase for similar implementations. If a suitable implementation exists, extend it rather than building a parallel one.

Restrict changes to the files specified in the EPIC scope. Do not modify unrelated files, perform project-wide formatting, rename public APIs, or introduce new dependencies without explicit instruction.

Do not implement future EPICs, partially implement future EPICs, or prepare infrastructure for future EPICs. Work only on what the current EPIC requires.

Preserve accepted architecture. If an EPIC requires a change that conflicts with the Baseline or documented architecture, report the conflict instead of implementing a workaround.

Remove or replace obsolete code introduced by the current implementation. Do not leave dead code paths, commented-out code, or unused exports after completing a change.

---

## 4. Documentation Rules

Treat documentation as production code. Documentation receives the same rigour as implementation — it must be reviewed, kept in sync with the codebase, and verified for accuracy.

Prefer updating existing documentation over creating new files. If a concept belongs in an existing document, add it there rather than creating a separate document.

Do not duplicate information that exists elsewhere. If a concept is already documented, reference it rather than re-describing it.

Maintain terminology consistency. Use the same terms for the same concepts across all documentation. If the Baseline or Architecture document uses a specific term for a component or concept, use that term everywhere.

After completing implementation work, update any documentation that the change affects. Outdated documentation is treated as a defect.

---

## 5. Verification Rules

Use the following evidence hierarchy when verifying implementation work:

1. Runtime evidence — actual behaviour observed during execution.
2. Compiler evidence — compilation success or failure.
3. Automated test evidence — test pass or fail results.
4. Repository evidence — git history, file state, tracked changes.
5. Source code — static analysis of code structure.
6. Static reasoning — logical deduction without direct observation.

Report verification results using these mutually exclusive terms:

- **VERIFIED** — directly observed through objective evidence (runtime, compiler, test output, repository data).
- **EXPECTED** — logical deduction from verified facts. Not directly observed but strongly implied.
- **UNKNOWN** — cannot be determined from available evidence. No conclusion can be drawn.

Never fabricate evidence. Never reconstruct missing evidence. Never report EXPECTED behaviour as VERIFIED. If evidence cannot be obtained, report UNKNOWN.

After implementation, verify that no obsolete code remains, no duplicate implementations were introduced, and architectural consistency is preserved.

---

## 6. Review Expectations

Before submitting implementation for review, provide the following:

- **Analysis** — what the implementation does and why the approach was chosen.
- **Modified files** — every file changed, with the reason and summary of changes for each.
- **Verification results** — what was verified, using which evidence, and the outcome for each verification step.
- **Remaining limitations** — known issues, edge cases not handled, or verification steps that could not be completed.
- **Unknowns** — areas where evidence was insufficient to draw a conclusion.

Do not submit implementation with unresolved verification failures. If verification cannot be completed, document the gap explicitly.

---

## 7. Governance

These rules evolve through the same process as other project documentation.

A proposed change to the AI Rules is submitted as a documentation update. It is reviewed for consistency with the existing Engineering Philosophy, Review Process, and Architecture Decisions. Changes that would conflict with accepted architectural documentation are rejected unless the architectural documentation is also updated.

Accepted changes become part of the project's permanent engineering guidance. Previous versions are retained for historical traceability.

AI agent behaviour that consistently violates these rules is treated as a defect in either the rules themselves (if they are unclear or incomplete) or the agent's implementation (if it fails to follow clear rules). In either case, the appropriate fix is documented and applied.

---

## Navigation

- **Previous:** [Architecture Decisions](08_ARCHITECTURE_DECISIONS.md)
- **Next:** [Review Process](10_REVIEW_PROCESS.md)
- **Related:** [INDEX.md](INDEX.md) | [README.md](README.md)
