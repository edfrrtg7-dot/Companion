# Coding Standards

## Overview

These standards apply to all Companion source code. Every contributor and AI assistant must follow these conventions. Documentation takes precedence; code follows documentation.

## Naming Conventions

### PascalCase

Used for:
- Class names: `CompanionApp`, `ModuleManager`, `CompanionWindow`
- Interface names: `CompanionModule`, `FinanceWidgetConfig`
- Type aliases: `FinanceState`, `ShiftType`
- Enum members: `Operation.EmailSend`
- Component names: `FinanceWidget`

### camelCase

Used for:
- Variable names: `widgetInitialized`, `stylesInjected`
- Function names: `ensureFinanceWidget`, `createFinanceModule`
- Method names: `registerModule`, `getModules`
- Parameters: `classPrefix`, `storageKey`
- Private fields: `boundOnKeyDown`, `isDragging`
- Event handlers: `onDragPointerDown`, `onShiftSelect`

### SCREAMING_SNAKE_CASE

Used for:
- Module-level constants: `DEFAULT_CLASS_PREFIX`, `MIN_WIDTH`
- Configuration constants: `STORAGE_KEY`, `COLLAPSED_WIDTH`
- Type constants: `DEFAULT_STATE`

### kebab-case

Used for:
- CSS class names: `ab-finance-header`, `ab-companion-launcher`
- File names: `companion-app.ts`, `finance-widget.css.ts`
- DOM IDs: `ab-finance-widget`, `ab-companion-launcher`

## Folder Naming

- All source directories use lowercase: `companion`, `core`, `shared`
- No PascalCase or camelCase in directory names
- No abbreviations unless universally understood

## File Naming

- TypeScript files: `kebab-case.ts` (e.g., `companion-app.ts`, `finance-widget.ts`)
- CSS-in-JS files: `kebab-case.css.ts` (e.g., `finance-widget.css.ts`)
- Test files: `kebab-case.test.ts` (future)
- Documentation: `kebab-case.md` (e.g., `module-api.md`, `coding-standards.md`)

## Import Ordering

1. External libraries (if any)
2. Internal modules from `src/`
3. Relative imports within the same module
4. Type-only imports last

```typescript
// 1. External (none currently)

// 2. Internal modules
import { CompanionWindow } from "./companion-window";
import { FinanceController } from "./finance-controller";

// 3. Relative imports
import { FinanceShift, ShiftType } from "./finance-shift";
import { COMPANION_LOGO_SVG } from "./brand-logo";
```

## Export Rules

- Export classes and interfaces that are used outside the module
- Export types that appear in public APIs
- Keep implementation details private
- Use `export type` for type-only exports
- Barrel exports through `index.ts`

```typescript
// Good: type export
export type { FinanceWidgetConfig } from "./finance-widget";

// Good: value export
export { FinanceWidget } from "./finance-widget";

// Good: type-only export
export type { WindowState, CompanionWindowConfig } from "./companion-window";
```

## TypeScript Conventions

### Strict Typing

- Use `strict: true` in tsconfig
- Never use `any` type
- Prefer `unknown` over `any` when type is uncertain
- Use explicit return types for public methods
- Use `readonly` for immutable properties
- Use `as const` for literal arrays and objects

### Type Assertions

- Prefer type narrowing over type assertions
- Use `as` assertions only when narrowing is impossible
- Avoid double assertions

```typescript
// Good: type narrowing
if (typeof parsed === "object" && parsed !== null) {
    return parsed as FinanceWindowState;
}

// Bad: premature assertion
return JSON.parse(raw) as FinanceWindowState;
```

### Null Safety

- Use optional chaining (`?.`) for nullable access
- Use nullish coalescing (`??`) for defaults
- Explicit null checks before DOM operations

```typescript
// Good
this.widget?.show();
const value = config.storageKey ?? DEFAULT_KEY;

// Bad
if (this.widget) { this.widget.show(); }
```

### Enums

- Use `const enum` for performance-critical enums
- Use string enums for readability
- Document each member

```typescript
export const enum Operation {
    EmailSend = "EmailSend",
    EmailRead = "EmailRead",
    TextChat = "TextChat",
    VideoChat = "VideoChat",
}
```

## Comment Policy

### Required Comments

- File-level JSDoc describing the module's purpose
- Class-level JSDoc describing responsibilities and non-responsibilities
- Public method JSDoc for non-obvious behavior
- ADR references for architectural decisions

### Forbidden Comments

- Inline comments explaining obvious code
- Commented-out code
- TODO comments without ticket references
- Comments that duplicate the code

### Comment Style

```typescript
/**
 * FinanceWidget
 *
 * DOM-based widget that displays live finance data from FinanceController.
 *
 * Non-responsibilities:
 *   - HTTP communication (see FinanceApiClient)
 *   - State management (see FinanceController)
 *   - Window management (see CompanionWindow)
 */
```

## Error Handling

### Custom Errors

- Extend `Error` for domain-specific errors
- Include context in error messages
- Use error hierarchy for categorization

```typescript
export class FinanceApiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "FinanceApiError";
    }
}

export class FinanceApiHttpError extends FinanceApiError {
    constructor(public readonly status: number) {
        super(`HTTP ${status}`);
        this.name = "FinanceApiHttpError";
    }
}
```

### Try-Catch

- Use try-catch for I/O operations (localStorage, network)
- Log errors in development mode only
- Never swallow errors silently
- Provide meaningful error messages

```typescript
function loadState(key: string): WindowState | null {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as WindowState;
    } catch {
        return null;
    }
}
```

## Logging

### Development Diagnostics

- Use the `diag()` function from `dev.ts`
- Enable via `localStorage.setItem("ab-dev", "1")`
- Log significant lifecycle events
- Prefix logs with component name

```typescript
import { diag } from "./dev";

// In CompanionApp
diag("initialized");

// In FinanceWidget
diag("Finance created");
diag("Finance shown");
diag("Finance hidden");
```

### Production Logging

- No console output in production
- All logging gated behind dev mode check
- No sensitive data in logs

## Formatting

- 4-space indentation
- Single quotes for strings
- Trailing commas in multi-line arrays/objects
- Semicolons required
- Line length: no hard limit, prefer readability
- Blank line between methods
- No trailing whitespace

## Forbidden Practices

### `any` Type

```typescript
// Forbidden
function process(data: any): any { }

// Required
function process(data: unknown): string { }
```

### Magic Numbers

```typescript
// Forbidden
root.style.width = "330px";

// Required
const COLLAPSED_WIDTH = 330;
root.style.width = COLLAPSED_WIDTH + "px";
```

### Magic Strings

```typescript
// Forbidden
if (localStorage.getItem("ab-dev")) { }

// Required
const DEV_KEY = "ab-dev";
if (localStorage.getItem(DEV_KEY)) { }
```

### Duplicated Code

- Extract shared logic into utility functions
- Use base classes for common behavior
- Maximum duplication threshold: 3 occurrences

### Circular Dependencies

- Dependencies flow in one direction
- No module imports from its dependents
- Use dependency injection for reverse dependencies

### Hidden Globals

- All state must be explicit (fields, parameters, or return values)
- No global mutable state
- Module-scoped constants are acceptable

### Business Logic in UI

- UI layer handles rendering and user interaction only
- Business logic belongs in controllers or services
- Widget classes must not contain API calls

### Direct DOM Manipulation Outside UI Layer

- Only widget classes manipulate the DOM
- Controllers must not create or modify DOM elements
- API clients must not access the DOM
