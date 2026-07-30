# Companion Knowledge Base

**Purpose:** Central documentation hub for the Companion platform.

**Status:** Accepted

---

## Documents

| # | File | Status | Description |
|---|------|--------|-------------|
| 00 | [PROJECT_OVERVIEW.md](00_PROJECT_OVERVIEW.md) | Accepted | High-level project description, vision, and scope |
| 01 | [ENGINEERING_PHILOSOPHY.md](01_ENGINEERING_PHILOSOPHY.md) | Accepted | Engineering principles and design values |
| 02 | [ARCHITECTURE.md](02_ARCHITECTURE.md) | Accepted | Platform architecture and component relationships |
| 03 | [COMPONENTS.md](03_COMPONENTS.md) | Accepted | Individual component descriptions and responsibilities |
| 04 | [PUBLIC_APIS.md](04_PUBLIC_APIS.md) | Accepted | Public API philosophy, contracts, and guarantees |
| 05 | [INTERNAL_INFRASTRUCTURE.md](05_INTERNAL_INFRASTRUCTURE.md) | Accepted | Internal platform services and boundaries |
| 06 | [BASELINE.md](06_BASELINE.md) | Accepted | Current project baseline and accepted EPICs |
| 07 | [ROADMAP.md](07_ROADMAP.md) | Accepted | Planned architectural evolution |
| 08 | [ARCHITECTURE_DECISIONS.md](08_ARCHITECTURE_DECISIONS.md) | Accepted | Architectural decision rationale |
| 09 | [AI_RULES.md](09_AI_RULES.md) | Accepted | Rules for AI-assisted development |
| 10 | [REVIEW_PROCESS.md](10_REVIEW_PROCESS.md) | Accepted | EPIC review and acceptance workflow |
| 11 | [GLOSSARY.md](11_GLOSSARY.md) | Accepted | Terminology and definitions |

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

## Cross-References

- [ADR README](../docs/adr/README.md) — ADR lifecycle and status conventions.
- [Review Process](10_REVIEW_PROCESS.md) — How documents transition from Proposed to Accepted.
- [Baseline](06_BASELINE.md) — Accepted documents form the project baseline.
- [INDEX.md](INDEX.md) — Central navigation hub with canonical reading order and reader profiles.
