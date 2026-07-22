# Project Structure

## Overview

Companion follows a clean separation between source code, build output, assets, and documentation.

## Directory Layout

```
Companion/
├── src/
│   └── companion/          Source code (TypeScript)
│       ├── bootstrap.ts    Application entry point
│       ├── companion-app.ts       Main application (launcher, menu)
│       ├── companion-module.ts    Module interface definition
│       ├── companion-window.ts    Abstract base class for windows
│       ├── module-manager.ts      Module registration and lifecycle
│       ├── dev.ts                 Development diagnostics
│       ├── brand-logo.ts          SVG logo (generated from assets/logo.svg)
│       ├── brand-colors.ts        Brand color constants
│       ├── finance-api-client.ts  Finance HTTP client
│       ├── finance-controller.ts  Finance state management
│       ├── finance-mapper.ts      Finance response mapping
│       ├── finance-shift.ts       Finance shift definitions
│       ├── finance-widget.ts      Finance UI widget
│       ├── finance-widget.css.ts  Finance widget styles
│       └── index.ts              Barrel exports
├── extension/
│   ├── manifest.json       Chrome Extension manifest (Manifest V3)
│   ├── content.ts          Content script entry point
│   ├── background.ts       Background service worker
│   ├── icons/              Extension icons (generated)
│   └── dist/               Built extension output (gitignored)
├── assets/
│   └── logo.svg            Master brand asset (source of truth)
├── scripts/
│   └── Companion.user.js   Legacy Tampermonkey userscript (built)
├── agencybooster-devtoolkit/
│   ├── build-finance.mjs           Legacy userscript build
│   ├── build-extension-dev.mjs     Extension dev build
│   ├── build-extension-prod.mjs    Extension production build
│   ├── generate-icons.mjs          Icon generator
│   ├── tsconfig.json               TypeScript configuration
│   ├── eslint.config.mjs           (moved to root)
│   ├── .prettierrc                 (moved to root)
│   └── package.json                Development dependencies
├── docs/                   Documentation
├── eslint.config.mjs       ESLint configuration
├── .prettierrc             Prettier configuration
├── .editorconfig           Editor configuration
├── .gitignore              Git ignore rules
├── package.json            Root package.json (npm scripts)
├── LICENSE                 License
├── NOTICE                  Copyright notice
└── README.md               Project overview
```

## Source Code (`src/companion/`)

All application source code lives here. TypeScript files follow kebab-case naming.

### Entry Point

`bootstrap.ts` is the single entry point. It:
- Creates ModuleManager
- Registers modules
- Creates CompanionApp
- Starts the application

### Core Components

| File | Purpose |
|------|---------|
| `companion-app.ts` | Main application — launcher UI, menu, delegates to ModuleManager |
| `companion-module.ts` | `CompanionModule` interface definition |
| `companion-window.ts` | Abstract base class for draggable, resizable windows |
| `module-manager.ts` | Module registration and lifecycle management |

### Finance Module

| File | Purpose |
|------|---------|
| `finance-widget.ts` | Finance UI widget (extends CompanionWindow) |
| `finance-controller.ts` | Finance state management |
| `finance-api-client.ts` | HTTP client for Finance API |
| `finance-mapper.ts` | Response mapping and validation |
| `finance-shift.ts` | Shift definitions and date calculation |
| `finance-widget.css.ts` | Widget styles |

### Shared

| File | Purpose |
|------|---------|
| `dev.ts` | Development mode diagnostics |
| `brand-logo.ts` | SVG logo (generated from `assets/logo.svg`) |
| `brand-colors.ts` | Brand color constants |
| `index.ts` | Barrel exports |

## Extension (`extension/`)

Chrome Extension (Manifest V3) runtime files.

| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest — permissions, content scripts, service worker |
| `content.ts` | Content script — DOM ready, duplicate prevention, bootstrap |
| `background.ts` | Service worker — future messaging, storage, updates |
| `icons/` | Generated PNG icons (from `assets/logo.svg`) |
| `dist/` | Built extension output (gitignored) |

## Assets (`assets/`)

Static resources. The single source of truth for branding.

| File | Purpose |
|------|---------|
| `logo.svg` | Master brand asset — all icons and logos derive from this |

## Build Tooling (`agencybooster-devtoolkit/`)

Build scripts and development configuration.

| File | Purpose |
|------|---------|
| `build-finance.mjs` | Legacy userscript build |
| `build-extension-dev.mjs` | Extension dev build (sourcemaps, no minify) |
| `build-extension-prod.mjs` | Extension production build (minified) |
| `generate-icons.mjs` | PNG icon generation from `assets/logo.svg` |
| `tsconfig.json` | TypeScript configuration |
| `package.json` | Development dependencies |

## Documentation (`docs/`)

Project documentation. See [Documentation Index](#documentation-index) for complete listing.

## Documentation Index

| Document | Purpose |
|----------|---------|
| [Vision](vision.md) | Why Companion exists. Mission, goals, philosophy. |
| [Architecture](architecture.md) | System design, component hierarchy, dependency rules. |
| [Module API](module-api.md) | Module lifecycle, interface, registration patterns. |
| [UI Guidelines](ui-guidelines.md) | Visual standards, spacing, colors, behaviors. |
| [Coding Standards](coding-standards.md) | Naming, typing, formatting, forbidden practices. |
| [Project Structure](project-structure.md) | This document. Directory layout and purpose. |
| [Branding](branding.md) | Logo usage, icon generation, brand consistency. |
| [Security](security.md) | Threat model, protection strategy, limitations. |
| [Build](build.md) | Build pipeline, current and future. |
| [Roadmap](roadmap.md) | Version plan, feature timeline. |
| [Decision Log](decision-log.md) | Architecture Decision Records. |
| [AI Rules](ai-rules.md) | Mandatory rules for AI assistants. |

## File Naming Rules

- All source files: `kebab-case.ts`
- CSS-in-JS files: `kebab-case.css.ts`
- Build scripts: `build-*.mjs`
- Documentation: `kebab-case.md`
- No PascalCase or camelCase in filenames
