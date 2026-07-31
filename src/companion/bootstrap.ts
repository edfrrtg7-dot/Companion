/**
 * Companion Bootstrap — Composition Root
 *
 * Single entry point for the Companion application.
 * Creates all infrastructure and application dependencies,
 * then delegates lifecycle orchestration to BootstrapCoordinator.
 *
 * Responsibilities:
 *   - Initialize Platform, RuntimeEnvironment, GlobalState
 *   - Create ModuleManager with all builtin modules
 *   - Create CompanionModal and CompanionApp
 *   - Initialize storage infrastructure
 *   - Create BootstrapCoordinator with all dependencies
 *   - Auto-bootstrap in userscript context
 */

import { createComposition } from "./create-composition";
import { ChromePlatform } from "./chrome-platform";
import { ChromeRuntimeEnvironment } from "./runtime-environment";
import { ChromeGlobalState } from "./global-state";
import { getRuntimeEnvironment } from "./runtime-environment";
import { BootstrapCoordinator } from "./bootstrap-coordinator";

const coordinatorPromise: Promise<BootstrapCoordinator> = createComposition(
    new ChromePlatform(),
    new ChromeRuntimeEnvironment(),
    new ChromeGlobalState(),
);

/** Start the application lifecycle. Called by extension content script or module auto-start. */
export async function bootstrap(): Promise<void> {
    const coordinator = await coordinatorPromise;
    coordinator.start();
}

// Auto-bootstrap when loaded as userscript (Tampermonkey)
// Extension content script imports and calls bootstrap() explicitly
if (!getRuntimeEnvironment().isExtension()) {
    bootstrap();
}
