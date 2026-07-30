# Companion Knowledge Base

**Purpose:** Central documentation hub for the Companion platform.

**Status:** Accepted

---

## Documents

| # | File | Category | Status | Description |
|---|------|----------|--------|-------------|
| 00 | [PROJECT_OVERVIEW.md](00_PROJECT_OVERVIEW.md) | Vision | Accepted | High-level project description, vision, and scope |
| 01 | [ENGINEERING_PHILOSOPHY.md](01_ENGINEERING_PHILOSOPHY.md) | Engineering | Accepted | Engineering principles and design values |
| 02 | [ARCHITECTURE.md](02_ARCHITECTURE.md) | Architecture | Accepted | Platform architecture and component relationships |
| 03 | [COMPONENTS.md](03_COMPONENTS.md) | Architecture | Accepted | Individual component descriptions and responsibilities |
| 04 | [PUBLIC_APIS.md](04_PUBLIC_APIS.md) | Architecture | Accepted | Public API philosophy, contracts, and guarantees |
| 05 | [INTERNAL_INFRASTRUCTURE.md](05_INTERNAL_INFRASTRUCTURE.md) | Architecture | Accepted | Internal platform services and boundaries |
| 06 | [BASELINE.md](06_BASELINE.md) | Governance | Accepted | Current project baseline and accepted EPICs |
| 07 | [ROADMAP.md](07_ROADMAP.md) | Planning | Accepted | Planned architectural evolution |
| 08 | [ARCHITECTURE_DECISIONS.md](08_ARCHITECTURE_DECISIONS.md) | Reference | Accepted | Architectural decision rationale |
| 09 | [AI_RULES.md](09_AI_RULES.md) | Engineering | Accepted | Rules for AI-assisted development |
| 10 | [REVIEW_PROCESS.md](10_REVIEW_PROCESS.md) | Governance | Accepted | EPIC review and acceptance workflow |
| 11 | [GLOSSARY.md](11_GLOSSARY.md) | Reference | Accepted | Terminology and definitions |

---

## Documentation Lifecycle

Every engineering document follows a defined lifecycle. The current status of a document determines whether it is authoritative, provisional, or historical.

### Status Definitions

| Status | Meaning | Authoritative | When Used |
|--------|---------|---------------|-----------|
| **Archived** | Preserved for historical reference only. Content is no longer relevant to current work. | No | Superseded documents that are retained for traceability. |
| **Draft** | Work in progress. Content may be incomplete, inconsistent, or unverified. | No | Documents under active development or awaiting review. |
| **Proposed** | Submitted for review but not yet accepted. Content is complete enough to evaluate. | No | Documents that have completed drafting and are ready for the review process. |
| **Accepted** | Formally reviewed and approved. Content is canonical and must be followed. | Yes | Documents that have passed review and are part of the current engineering baseline. |
| **Deprecated** | No longer recommended for new work. Content may be retained for reference but should not be used as guidance. | Limited | Documents that have been replaced or superseded but not yet formally Archived. |
| **Superseded** | Replaced by a newer document. Content is retained for historical traceability only. | Historical only | Documents that have been explicitly replaced by a new Accepted document. |

### Authority Matrix

| Status | Authoritative |
|---------|---------------|
| Accepted | Yes. Must be followed. |
| Draft | No. Subject to change. |
| Proposed | No. Under review. |
| Deprecated | Limited. Existing implementations may reference but new work must not. |
| Superseded | Historical only. Replaced by the superseding document. |
| Archived | Historical only. Not to be used. |

### Document Header Convention

Every engineering document SHOULD begin with the following metadata block:

```markdown
# Document Title

**Purpose:** Brief statement of the document's function.

**Status:** Accepted | Draft | Proposed | Deprecated | Superseded | Archived
```

The `**Status:**` field is required. The `**Purpose:**` field is strongly recommended. Additional fields (`Owner`, `Last Updated`) are optional.

### Transition Rules

Valid lifecycle transitions:

```
Draft
  → Proposed (submitted for review)
  → Accepted (review passed)

Accepted
  → Deprecated (no longer recommended, not yet replaced)
  → Superseded (replaced by a newer Accepted document)

Deprecated
  → Archived (no longer relevant)
  → Superseded (replaced if a replacement document is accepted)

Superseded
  → Archived (historical reference only)
```

Invalid transitions:

- Draft → Accepted (must go through Proposed first)
- Accepted → Draft (demotion requires explicit review)
- Archived → anything (Archived is a terminal state)
- Skip statuses (e.g., Proposed → Deprecated without being Accepted first)

---

## Canonical Reading Order

The Knowledge Base is designed to be read sequentially. Start with 00 and proceed through 11 for a complete understanding of the platform.

| Order | Document | Prerequisites |
|-------|----------|---------------|
| 1 | [00_PROJECT_OVERVIEW.md](00_PROJECT_OVERVIEW.md) | None |
| 2 | [01_ENGINEERING_PHILOSOPHY.md](01_ENGINEERING_PHILOSOPHY.md) | 00 |
| 3 | [02_ARCHITECTURE.md](02_ARCHITECTURE.md) | 01 |
| 4 | [03_COMPONENTS.md](03_COMPONENTS.md) | 02 |
| 5 | [04_PUBLIC_APIS.md](04_PUBLIC_APIS.md) | 03 |
| 6 | [05_INTERNAL_INFRASTRUCTURE.md](05_INTERNAL_INFRASTRUCTURE.md) | 04 |
| 7 | [06_BASELINE.md](06_BASELINE.md) | 05 |
| 8 | [07_ROADMAP.md](07_ROADMAP.md) | 06 |
| 9 | [08_ARCHITECTURE_DECISIONS.md](08_ARCHITECTURE_DECISIONS.md) | 06 |
| 10 | [09_AI_RULES.md](09_AI_RULES.md) | 01 |
| 11 | [10_REVIEW_PROCESS.md](10_REVIEW_PROCESS.md) | 09 |
| 12 | [11_GLOSSARY.md](11_GLOSSARY.md) | Any |

For alternative reading paths by role, see [INDEX.md](INDEX.md#reader-profiles).

---

## Reader Profiles

### New Contributors

Read 00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 in order.

### Maintainers

Read 00 → 01 → 02 → 03 → 06 → 08. Reference other documents as needed.

### Reviewers

Read 10 → 06 → 09 → 08. Reference specific documents relevant to the submission.

### AI Implementation Agents

Start with AGENTS.md, then follow the full canonical reading order, then consult the current EPIC.

---

## Navigation Model

Every Knowledge Base document SHOULD include a `## Navigation` section at the end with:

- **Previous** — the document that precedes this one in the reading order.
- **Next** — the document that follows this one in the reading order.
- **Related** — other documents that are relevant but not directly sequential.

The navigation section provides deterministic forward and backward traversal through the Knowledge Base.

---

## Knowledge Taxonomy

Every Knowledge Base document belongs to exactly one category.

| Category | Purpose | Documents |
|----------|---------|-----------|
| **Vision** | Project identity, goals, scope, and audience. | 00 |
| **Engineering** | Engineering principles, discipline, and operational rules. | 01, 09 |
| **Architecture** | Platform structure, components, contracts, and internal services. | 02, 03, 04, 05 |
| **Governance** | Accepted state, review process, and change management. | 06, 10 |
| **Planning** | Future direction and prioritisation. | 07 |
| **Reference** | Supporting information: rationale, terminology. | 08, 11 |

---

## Document Responsibilities

Each document has a clearly defined scope to prevent overlap.

| # | Primary Responsibility | Contains | Does Not Contain |
|---|-----------------------|----------|------------------|
| 00 | Define project identity, vision, goals, and audience | What Companion is and why it exists | Implementation details, architecture, process |
| 01 | Define engineering principles and decision-making values | How the project approaches engineering | Architecture, specific components, process workflow |
| 02 | Describe platform structure, layers, ownership, and dependencies | Conceptual architecture model | Component details, API contracts, implementation |
| 03 | Describe component responsibilities, ownership, and evolution | What each component does and does not own | Architecture rationale, API definitions |
| 04 | Define public API philosophy, contracts, and guarantees | The boundary between platform and modules | Internal infrastructure details |
| 05 | Define internal infrastructure responsibilities and boundaries | Platform services hidden behind Public APIs | Module logic, public contract definitions |
| 06 | Record accepted architectural state and foundation | What has been accepted and what it means | Rationale for decisions (see 08), future plans (see 07) |
| 07 | Define planned architectural evolution and priorities | Where the platform is going | Accepted state (see 06), implementation details |
| 08 | Preserve architectural decision rationale | Why decisions were made | Current accepted state (see 06), process workflow |
| 09 | Define operational rules for AI implementation agents | How AI agents should work | Engineering philosophy (see 01), review process (see 10) |
| 10 | Define review workflow, verification, and acceptance process | How work is reviewed and accepted | AI operational rules (see 09), engineering philosophy (see 01) |
| 11 | Define project terminology | Canonical definitions | Explanatory content from other documents |

---

## Single Source of Truth

Every major engineering concept has exactly one canonical document. Other documents reference rather than duplicate.

| Concept | Canonical Source |
|---------|-----------------|
| Project identity and vision | 00_PROJECT_OVERVIEW.md |
| Engineering principles | 01_ENGINEERING_PHILOSOPHY.md |
| Platform architecture | 02_ARCHITECTURE.md |
| Component design | 03_COMPONENTS.md |
| Public API contracts | 04_PUBLIC_APIS.md |
| Internal infrastructure | 05_INTERNAL_INFRASTRUCTURE.md |
| Accepted architectural state | 06_BASELINE.md |
| Future plans | 07_ROADMAP.md |
| Decision rationale | 08_ARCHITECTURE_DECISIONS.md |
| AI implementation rules | 09_AI_RULES.md |
| Review and acceptance process | 10_REVIEW_PROCESS.md |
| Terminology | 11_GLOSSARY.md |
| ADR records | docs/adr/ |
| Repository governance templates | .github/ |
| Engineering templates | templates/ |

---

## Duplication Rules

Information should follow these guidelines:

**Move** — When content belongs in a different document's responsibility area, move it to the correct canonical location.

**Reference** — When a concept from one document is relevant to another, reference the canonical source by relative path. Do not summarise or paraphrase in a way that could drift from the original.

**Duplicate (rarely)** — Only duplicate when the reader needs the information in context and navigation to the canonical source would break the reading flow. Duplicated content must include a reference to the canonical source. Duplication across multiple documents is a design smell and should be resolved by moving the content to its canonical home.

Parallel descriptions of the same concept in different documents are not permitted. If two documents describe the same concept, the description belongs in exactly one document — the canonical source — and the other document references it.

---

## Documentation Dependency Graph

Conceptual dependencies between categories. Arrows mean "depends on" or "builds upon."

```
Vision (00)
  |
  v
Engineering (01, 09)
  |
  v
Architecture (02, 03, 04, 05)
  |
  v
Governance (06, 10)
  |
  v
Planning (07)

Reference (08, 11) ← no dependencies on other categories
```

The dependency graph is acyclic. There is no circular dependency between any two categories.

- **Vision** depends on nothing. It is the foundation.
- **Engineering** depends on Vision.
- **Architecture** depends on Engineering.
- **Governance** depends on Architecture (it records what has been accepted).
- **Planning** depends on Governance (it plans future work based on accepted state).
- **Reference** depends on nothing. It supports all categories without depending on them.

---

## Cross-References

- [ADR README](../docs/adr/README.md) — ADR lifecycle and status conventions.
- [Review Process](10_REVIEW_PROCESS.md) — How documents transition from Proposed to Accepted.
- [Baseline](06_BASELINE.md) — Accepted documents form the project baseline.
- [INDEX.md](INDEX.md) — Central navigation hub with canonical reading order and reader profiles.
