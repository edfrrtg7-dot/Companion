# Repository Structure

```
/
├── .github/                  # GitHub templates (PR, issues)
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
│       ├── config.yml
│       ├── epic.md
│       ├── investigation.md
│       └── bug_report.md
├── docs/                     # Development documentation
│   ├── bootstrap/            # Agent onboarding (this directory)
│   ├── coding-standards.md   # Coding conventions
│   ├── project-structure.md  # Detailed project layout
│   └── ...
├── knowledge/                # Canonical Knowledge Base
│   ├── README.md             # Knowledge Base index
│   ├── 00_PROJECT_OVERVIEW.md
│   ├── 01_ENGINEERING_PHILOSOPHY.md
│   ├── 02_ARCHITECTURE.md
│   ├── 03_COMPONENTS.md
│   ├── 04_PUBLIC_APIS.md
│   ├── 05_INTERNAL_INFRASTRUCTURE.md
│   ├── 06_BASELINE.md
│   ├── 07_ROADMAP.md
│   ├── 08_ARCHITECTURE_DECISIONS.md
│   ├── 09_AI_RULES.md
│   ├── 10_REVIEW_PROCESS.md
│   └── 11_GLOSSARY.md
├── scripts/                  # User scripts (e.g. Companion.user.js)
├── src/                      # Source code
│   └── companion/            # Companion platform source
├── templates/                # Engineering templates
│   ├── EPIC_TEMPLATE.md
│   ├── INVESTIGATION_TEMPLATE.md
│   ├── REVIEW_TEMPLATE.md
│   └── ADR_TEMPLATE.md
├── AGENTS.md                 # AI contributor entry point
└── README.md                 # Project overview
```

For a more detailed breakdown of source directories, see `docs/project-structure.md`.
