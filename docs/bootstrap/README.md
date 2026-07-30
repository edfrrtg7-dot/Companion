# Bootstrap Guide

## Entry Point

Start at `AGENTS.md` in the repository root. It is the canonical entry point for all AI contributors and contains the mandatory reading order, working principles, and workflow.

## Required Reading Order

1. **`AGENTS.md`** — Entry point, principles, workflow, rules.
2. **`README.md`** — Project overview, features, development setup.
3. **`knowledge/`** — Knowledge Base: project overview, philosophy, architecture, components.
4. **`knowledge/06_BASELINE.md`** — Accepted architectural state.
5. **`knowledge/07_ROADMAP.md`** — Planned evolution.
6. **Current EPIC** — Active requirements.

Do not skip steps. Each document builds on the previous one.

## Engineering Workflow

1. **Read documentation** — Required documents and Baseline.
2. **Investigate** — Understand the problem, explore the repository.
3. **Plan** — Design the solution, define files and changes.
4. **Implement** — Write code within EPIC scope.
5. **Verify** — Collect evidence (execution, compilation, tests, static analysis).
6. **Review** — Submit changes and evidence.
7. **Acceptance** — Pass review, promote to Baseline.

## Evidence Hierarchy

Preferences from most to least reliable:

1. Runtime evidence
2. Compiler evidence
3. Automated test evidence
4. Repository evidence
5. Source code structure
6. Static reasoning

## Review Workflow

1. **Submission** — Proposal or implementation with scope and file list.
2. **Analysis** — Evaluate scope, architectural alignment, documentation impact.
3. **Verification** — Apply evidence hierarchy.
4. **Decision** — Accept, reject, or request changes.
5. **Promotion** — Merge, update Baseline, increment revision.

See `knowledge/10_REVIEW_PROCESS.md` for the full process.

## Reference Documents

| Document | Path |
|---|---|
| AGENTS.md | `/AGENTS.md` |
| Glossary | `/knowledge/11_GLOSSARY.md` |
| Templates | `/templates/` |
| Pull Request Template | `/.github/PULL_REQUEST_TEMPLATE.md` |
| Issue Templates | `/.github/ISSUE_TEMPLATE/` |
