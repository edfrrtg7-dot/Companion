# Companion — Engineering Handbook

## Overview

Companion v2.0.0 is a modular productivity platform built as a Chrome Extension. It injects into GoldenBride CRM pages and provides a floating UI for finance data, diagnostics, and operational tools.

This handbook defines the engineering standards for the Companion project. It takes precedence over conversation history. Repository documentation (docs/) provides supplementary guidance but must not contradict this handbook.

## Quick Start

```bash
cd agencybooster-devtoolkit
node build-extension-dev.mjs
```

Load `extension/dist/` as unpacked extension in `chrome://extensions`.

## Project Baseline

Current Git HEAD is the project baseline. Accepted EPICs become part of the baseline. Future work builds on the current baseline. Never recreate accepted work unless explicitly instructed.

## EPIC Discipline

Treat every EPIC as an isolated implementation. Do not implement future EPICs. Do not partially implement future EPICs. Do not prepare infrastructure for future EPICs unless explicitly requested. Future improvements belong in "Remaining Limitations" or recommendations, not in implementation.

## Scope Control

Implement only the requested EPIC. Do not expand implementation scope. Report unrelated issues separately without acting on them. Prefer the smallest complete implementation that satisfies requirements.

## Implementation Constraints

Never modify unrelated files. Never perform project-wide formatting without explicit approval. Never rename public APIs without explicit instruction. Never introduce new dependencies without justification.

## Incremental Development

Prefer modifying existing implementations over rewriting. Search for existing code before introducing new abstractions. Reuse existing systems whenever practical. Avoid parallel implementations.

## Architecture Preservation

Respect existing architecture. Do not redesign working systems without explicit approval. Maintain module boundaries. Avoid new dependencies unless required. Companion must never import Finance internals (FinanceWidget, FinanceController, FinanceApiClient, FinanceMapper, FinanceShift). Communication occurs only through public APIs.

## UI Implementation

Use TypeScript for behaviour, state, and structure. Use CSS for layout, spacing, typography, colours, and animations. Avoid inline styles unless runtime values require them.

## Documentation

Documentation is authoritative engineering guidance. Extend existing documentation whenever practical. Avoid replacing documentation with new files. Engineering decisions expected to guide future work belong in documentation. Do not delete documentation without explicit instruction.

## Planning

Before implementation identify: entry points, affected files, dependencies, ownership boundaries, possible side effects, architectural risks, runtime risks, and compatibility risks. Only include risks that are directly relevant. For every modified file, explain why changes are required.

## Task Authoring

Implementation tasks should constrain engineering process, constrain verification, define acceptance criteria, minimise ambiguity, require objective evidence, and require UNKNOWN when evidence is unavailable. Tasks must not rely on subjective completion criteria.

## Verification

Implementation is incomplete until verification completes. Whenever applicable verify: compilation, imports, build, runtime, obsolete code removal, and architectural consistency. Clearly distinguish VERIFIED, EXPECTED, and UNKNOWN. Never report EXPECTED behaviour as VERIFIED.

Compilation is not runtime verification. Runtime claims require runtime evidence. Compiler success is insufficient evidence for runtime behaviour.

## Evidence Hierarchy

Use evidence in this order of reliability:

1. Runtime
2. Compiler
3. Automated tests
4. Repository evidence
5. Source code
6. Static reasoning

Conversation history is context only. It is never repository evidence.

## Evidence Language

Reports must use the following terms consistently. Definitions are mutually exclusive.

- **VERIFIED** — Directly observed through objective evidence (runtime, compiler, test output, repository data).
- **EXPECTED** — Logical deduction from verified facts. Not directly observed but strongly implied.
- **UNKNOWN** — Cannot be determined from available evidence. No conclusion can be drawn.
- **UNSUPPORTED** — Claimed or stated without supporting evidence.

## Investigation Discipline

Investigation workflow: collect evidence, classify evidence, produce findings, identify unknowns, produce conclusions, recommend actions. Do not produce conclusions before evidence collection.

Every investigation report must contain: objective, evidence, findings, unknowns, conclusions, and recommended actions. Every conclusion must be traceable to collected evidence. Conclusions must never precede evidence collection.

## Evidence Authenticity

Never fabricate terminal output, git output, runtime output, filesystem state, or repository history. Never reconstruct missing evidence. If evidence cannot be obtained, report UNKNOWN. Illustrative examples must be explicitly labelled as such.

## Workspace Integrity

Never infer tracked files, untracked files, deleted files, or workspace state. Verify using objective evidence whenever possible.

## Repository Integrity

Do not infer repository history. Do not reconstruct commits or deleted files. Never conclude recovery is impossible until all applicable evidence sources have been investigated. Acceptable evidence sources include: Git history, Git reflog, dangling commits, IDE local history, workspace history, editor timeline, and external change history. If evidence is unavailable, state UNKNOWN.

## Implementation Reports

Every implementation report must contain: analysis, plan, modified files, changes per file, verification, remaining limitations, and unknowns.

### Modified Files

Every modified file must include path, reason, and summary of changes. If a file was created or deleted, state it explicitly.

### Engineering Rationale

Explain significant design decisions. Briefly explain why alternatives were rejected.

### Review Metrics

Whenever practical include: functions added, functions modified, exported APIs changed, and interfaces changed. If none changed, state that explicitly.

## Unknown Handling

Never replace unknown information with assumptions. State UNKNOWN whenever evidence is insufficient.

## Definition of Done

An EPIC is complete only when: implementation finished, verification completed, obsolete code removed, duplicate implementation removed, modified files justified, documentation updated (if required), architecture preserved, and implementation report completed.

## Reference

- [Engineering Workflow](docs/workflow.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Verification](docs/verification.md)
- [UI Guidelines](docs/ui-guidelines.md)
- [EPIC Format](docs/epic-format.md)
- [Coding Rules](docs/CODING_RULES.md)
- [Branding](docs/branding.md)
- [Changelog](docs/CHANGELOG.md)
