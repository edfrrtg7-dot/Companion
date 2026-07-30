# Project Overview

**Purpose:** High-level description of the Companion project, its goals, and its context within the GoldenBride CRM ecosystem.

**Status:** Accepted

---

## 1. Project Vision

Companion aims to become the standard productivity layer for GoldenBride CRM.

Rather than a single-purpose tool, Companion is designed as a modular platform that can grow with its users' needs. Its long-term purpose is to provide a stable, extensible foundation for operational tools — finance monitoring, diagnostics, automation, and whatever future modules may be required — without requiring structural changes to the underlying CRM or to Companion itself.

The platform is built to last. Every architectural decision prioritises the ability to add, remove, or replace modules without destabilising the rest of the system.

---

## 2. Mission

Companion solves a practical problem: GoldenBride CRM users need real-time access to operational data — finance figures, shift information, system diagnostics — that the CRM does not natively provide in a convenient form.

Rather than building isolated scripts and bookmarks that each solve one piece of the puzzle, Companion provides a single, consistent interface for these tools. It eliminates the need for users to switch between multiple disconnected utilities, and it eliminates the need for developers to rebuild common infrastructure (storage, event handling, state persistence) for each new feature.

---

## 3. Design Goals

- **Modularity.** Every feature is a self-contained module. Modules communicate through defined contracts, never through shared mutable state or direct knowledge of each other's internals.

- **Extensibility.** The platform provides stable public APIs. New modules can be added without modifying existing platform code. Old modules can be removed without leaving traces in the infrastructure.

- **Maintainability.** Infrastructure services are owned and managed by a single orchestrator. Modules do not construct infrastructure themselves. This makes the system easier to understand, debug, and change.

- **Predictable architecture.** Lifecycle, communication, and data flow follow strict deterministic rules. There are no hidden side effects, no surprising initialisation orders, and no runtime type checks that replace explicit contracts.

- **Incremental evolution.** The platform is built in layers. Each layer solves one problem and provides a foundation for the next. No layer depends on future layers. This allows the project to grow organically without requiring rewrites.

---

## 4. Non-Goals

- Companion is **not** a replacement for GoldenBride CRM. It operates alongside the CRM, injecting tools into existing pages without modifying the CRM's own code or data.

- Companion is **not** a general-purpose application framework. Its architecture is tailored to the specific constraints of a Chrome Extension environment — long-running content scripts, limited persistence APIs, single-page application navigation — and is not intended to be portable to other contexts.

- Companion is **not** a plugin marketplace or a sandbox for third-party code. The Plugin API exists to allow platform modules to be developed in a structured way, not to support arbitrary untrusted extensions.

- Companion is **not** a real-time synchronisation engine. Modules may persist state locally, but cross-device synchronisation, conflict resolution, and multi-user coordination are outside the project's scope.

- Companion is **not** a UI framework. Visual components exist only as concrete implementations of module needs. There is no component library, theming system, or design system that modules are required to use.

---

## 5. Project Scope

Companion covers the following major areas:

- **Platform infrastructure.** A set of shared services — versioning, events, diagnostics, storage, registries — that every module can rely on without building its own.

- **Module lifecycle.** A deterministic process for registering, initialising, and disposing modules. The platform owns the lifecycle; modules own their business logic.

- **Stable public APIs.** Contracts that modules use to interact with the platform. These APIs are the only supported way for modules to access infrastructure.

- **Finance operations.** The first complete feature module, providing transaction monitoring, shift-based filtering, and unread tracking.

- **Diagnostics and debugging.** Runtime inspection tools that expose platform state for development and troubleshooting.

---

## 6. Intended Audience

This document is written for:

- **Contributors** who need to understand what Companion is before working on any specific part of it.
- **Maintainers** who need a shared reference point for architectural discussions and decisions.
- **AI implementation agents** that need a stable description of the project before generating code or documentation.
- **Reviewers** who evaluate whether proposed changes align with the project's stated goals and scope.

Readers should start here and then follow the Knowledge Base structure outlined below to dive deeper into specific areas.

---

## 7. Knowledge Base Structure

The remaining Knowledge Base documents build on this overview in a logical sequence:

- **[01_ENGINEERING_PHILOSOPHY.md](01_ENGINEERING_PHILOSOPHY.md)** — The principles that guide how engineering decisions are made.
- **[02_ARCHITECTURE.md](02_ARCHITECTURE.md)** — How the platform is structured and how components relate to each other.
- **[03_COMPONENTS.md](03_COMPONENTS.md)** — Descriptions of individual components and their responsibilities.
- **[04_PUBLIC_APIS.md](04_PUBLIC_APIS.md)** — The stable contracts modules use to interact with the platform.
- **[05_INTERNAL_INFRASTRUCTURE.md](05_INTERNAL_INFRASTRUCTURE.md)** — Platform services that are internal to the infrastructure layer.
- **[06_BASELINE.md](06_BASELINE.md)** — What has been built so far and what is considered stable.
- **[07_ROADMAP.md](07_ROADMAP.md)** — What is planned for future iterations.
- **[08_ARCHITECTURE_DECISIONS.md](08_ARCHITECTURE_DECISIONS.md)** — Rationale behind key architectural choices.
- **[09_AI_RULES.md](09_AI_RULES.md)** — Constraints for AI-assisted development.
- **[10_REVIEW_PROCESS.md](10_REVIEW_PROCESS.md)** — How EPICs are reviewed and accepted.
- **[11_GLOSSARY.md](11_GLOSSARY.md)** — Terminology and definitions used throughout the project.

Each document is self-contained but assumes familiarity with this overview.
