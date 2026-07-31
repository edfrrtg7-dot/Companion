/**
 * Companion Arena Bootstrap — Composition Root for Arena Runtime
 *
 * Arena is an embedded runtime with no Chrome Extension APIs.
 * This entry point provides Arena-specific Platform and RuntimeEnvironment
 * implementations while sharing all application construction logic
 * with the Chrome entry point via createComposition().
 */

import { createComposition } from "./create-composition";
import { ArenaPlatform } from "./arena-platform";
import { ArenaRuntimeEnvironment } from "./arena-runtime-environment";
import { ChromeGlobalState } from "./global-state";
import { getRuntimeEnvironment } from "./runtime-environment";
import { BootstrapCoordinator } from "./bootstrap-coordinator";

const coordinatorPromise: Promise<BootstrapCoordinator> = createComposition(
    new ArenaPlatform(),
    new ArenaRuntimeEnvironment(),
    new ChromeGlobalState(),
);

/** Start the application lifecycle. Called by Arena host. */
export async function bootstrap(): Promise<void> {
    const coordinator = await coordinatorPromise;
    coordinator.start();
}

// Auto-bootstrap when loaded as userscript
if (!getRuntimeEnvironment().isExtension()) {
    bootstrap();
}
