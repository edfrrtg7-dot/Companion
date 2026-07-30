# Knowledge Index

Canonical navigation hub for Companion engineering documentation. Use this index to locate any document or follow the recommended reading paths.

---

## Canonical Reading Order

The following sequence is the recommended path through the Knowledge Base. Each document builds on the previous one.

| Step | Document | Category | Path | Prerequisites |
|------|----------|----------|------|---------------|
| 1 | Project Overview | Vision | [`00_PROJECT_OVERVIEW.md`](00_PROJECT_OVERVIEW.md) | None |
| 2 | Engineering Philosophy | Engineering | [`01_ENGINEERING_PHILOSOPHY.md`](01_ENGINEERING_PHILOSOPHY.md) | Project Overview |
| 3 | Architecture | Architecture | [`02_ARCHITECTURE.md`](02_ARCHITECTURE.md) | Engineering Philosophy |
| 4 | Components | Architecture | [`03_COMPONENTS.md`](03_COMPONENTS.md) | Architecture |
| 5 | Public APIs | Architecture | [`04_PUBLIC_APIS.md`](04_PUBLIC_APIS.md) | Components |
| 6 | Internal Infrastructure | Architecture | [`05_INTERNAL_INFRASTRUCTURE.md`](05_INTERNAL_INFRASTRUCTURE.md) | Public APIs |
| 7 | Baseline | Governance | [`06_BASELINE.md`](06_BASELINE.md) | Internal Infrastructure |
| 8 | Roadmap | Planning | [`07_ROADMAP.md`](07_ROADMAP.md) | Baseline |
| 9 | Architecture Decisions | Reference | [`08_ARCHITECTURE_DECISIONS.md`](08_ARCHITECTURE_DECISIONS.md) | Baseline |
| 10 | AI Rules | Engineering | [`09_AI_RULES.md`](09_AI_RULES.md) | Engineering Philosophy |
| 11 | Review Process | Governance | [`10_REVIEW_PROCESS.md`](10_REVIEW_PROCESS.md) | AI Rules |
| 12 | Glossary | Reference | [`11_GLOSSARY.md`](11_GLOSSARY.md) | Any (reference only) |

---

## Reader Profiles

### New Contributors

Follow the full canonical reading order (1-12). Start with Project Overview and proceed sequentially.

### Maintainers

Core sequence: Project Overview → Engineering Philosophy → Architecture → Components → Baseline → Architecture Decisions. Reference other documents as needed.

### Reviewers

Reading order: Review Process → Baseline → AI Rules → Architecture Decisions. Reference specific documents relevant to the submission under review.

### AI Implementation Agents

Start with AGENTS.md, then follow the full canonical reading order, then consult the current EPIC.

---

## Knowledge Taxonomy

Every KB document belongs to exactly one category. See [`README.md`](README.md#knowledge-taxonomy) for full definitions.

| Category | Documents |
|----------|-----------|
| Vision | 00 |
| Engineering | 01, 09 |
| Architecture | 02, 03, 04, 05 |
| Governance | 06, 10 |
| Planning | 07 |
| Reference | 08, 11 |

---

## Single Source of Truth

Every major concept has exactly one canonical document. See [`README.md`](README.md#single-source-of-truth) for the complete map.

| Concept | Canonical Source |
|---------|-----------------|
| Project identity | 00_PROJECT_OVERVIEW.md |
| Engineering principles | 01_ENGINEERING_PHILOSOPHY.md |
| Platform architecture | 02_ARCHITECTURE.md |
| Component design | 03_COMPONENTS.md |
| Public API contracts | 04_PUBLIC_APIS.md |
| Internal infrastructure | 05_INTERNAL_INFRASTRUCTURE.md |
| Accepted state | 06_BASELINE.md |
| Future plans | 07_ROADMAP.md |
| Decision rationale | 08_ARCHITECTURE_DECISIONS.md |
| AI rules | 09_AI_RULES.md |
| Review process | 10_REVIEW_PROCESS.md |
| Terminology | 11_GLOSSARY.md |

---

## Dependency Graph

```
Vision → Engineering → Architecture → Governance → Planning

Reference ← (supports all, depends on none)
```

The graph is acyclic. See [`README.md`](README.md#documentation-dependency-graph) for the full diagram.

---

## Document Index by Category

### Project Governance

| Document | Path | Description |
|---|---|---|
| AGENTS.md | [`/AGENTS.md`](/AGENTS.md) | AI contributor entry point |
| Baseline | [`06_BASELINE.md`](06_BASELINE.md) | Accepted architectural state and foundation |
| ADR Index | [`/docs/adr/README.md`](/docs/adr/README.md) | ADR index with individual decision records |
| Knowledge Base Hub | [`README.md`](README.md) | KB hub with lifecycle model and authority matrix |
| Review Process | [`10_REVIEW_PROCESS.md`](10_REVIEW_PROCESS.md) | EPIC review and acceptance workflow |
| Roadmap | [`07_ROADMAP.md`](07_ROADMAP.md) | Planned architectural evolution |

### Engineering Process

| Document | Path | Description |
|---|---|---|
| AI Rules | [`09_AI_RULES.md`](09_AI_RULES.md) | Operational rules for AI agents |
| Bootstrap Guide | [`/docs/bootstrap/README.md`](/docs/bootstrap/README.md) | Agent onboarding guide |
| Engineering Philosophy | [`01_ENGINEERING_PHILOSOPHY.md`](01_ENGINEERING_PHILOSOPHY.md) | Engineering principles and discipline |
| Glossary | [`11_GLOSSARY.md`](11_GLOSSARY.md) | Canonical project terminology |
| Repository Structure | [`/docs/project-structure.md`](/docs/project-structure.md) | Source directory breakdown |

### Templates

| Document | Path |
|---|---|
| ADR Template | [`/templates/ADR_TEMPLATE.md`](/templates/ADR_TEMPLATE.md) |
| EPIC Template | [`/templates/EPIC_TEMPLATE.md`](/templates/EPIC_TEMPLATE.md) |
| Investigation Template | [`/templates/INVESTIGATION_TEMPLATE.md`](/templates/INVESTIGATION_TEMPLATE.md) |
| Review Template | [`/templates/REVIEW_TEMPLATE.md`](/templates/REVIEW_TEMPLATE.md) |
| Bug Report Template | [`/.github/ISSUE_TEMPLATE/bug_report.md`](/.github/ISSUE_TEMPLATE/bug_report.md) |
| EPIC Issue Template | [`/.github/ISSUE_TEMPLATE/epic.md`](/.github/ISSUE_TEMPLATE/epic.md) |
| Investigation Issue Template | [`/.github/ISSUE_TEMPLATE/investigation.md`](/.github/ISSUE_TEMPLATE/investigation.md) |
| Pull Request Template | [`/.github/PULL_REQUEST_TEMPLATE.md`](/.github/PULL_REQUEST_TEMPLATE.md) |

### Architecture

| Document | Path | Description |
|---|---|---|
| Architecture | [`02_ARCHITECTURE.md`](02_ARCHITECTURE.md) | Platform layers, ownership, dependency direction |
| Architecture Decisions | [`08_ARCHITECTURE_DECISIONS.md`](08_ARCHITECTURE_DECISIONS.md) | Rationale behind architectural choices |
| ADR Records | [`/docs/adr/README.md`](/docs/adr/README.md) | Individual ADR files |
| Components | [`03_COMPONENTS.md`](03_COMPONENTS.md) | Component responsibilities and evolution |
| Internal Infrastructure | [`05_INTERNAL_INFRASTRUCTURE.md`](05_INTERNAL_INFRASTRUCTURE.md) | Internal platform services and boundaries |
| Project Overview | [`00_PROJECT_OVERVIEW.md`](00_PROJECT_OVERVIEW.md) | High-level project description |
| Public APIs | [`04_PUBLIC_APIS.md`](04_PUBLIC_APIS.md) | Public API contracts and guarantees |

### Development

| Document | Path |
|---|---|
| README | [`/README.md`](/README.md) |
| Coding Standards | [`/docs/coding-standards.md`](/docs/coding-standards.md) |
| Build | [`/docs/build.md`](/docs/build.md) |
| Security | [`/docs/security.md`](/docs/security.md) |
| UI Guidelines | [`/docs/ui-guidelines.md`](/docs/ui-guidelines.md) |

### Reviews

| Document | Path |
|---|---|
| Review Process | [`10_REVIEW_PROCESS.md`](10_REVIEW_PROCESS.md) |
| Review Template | [`/templates/REVIEW_TEMPLATE.md`](/templates/REVIEW_TEMPLATE.md) |
| Pull Request Template | [`/.github/PULL_REQUEST_TEMPLATE.md`](/.github/PULL_REQUEST_TEMPLATE.md) |
