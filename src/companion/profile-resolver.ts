/**
 * ProfileResolver
 *
 * Resolves the active GoldenBride profile from the current page at action time.
 *
 * Primary source is the visible lady identity rendered in the GoldenBride
 * sidebar ("Lilia" / "ID: 812510"). Resolution is tab-local: every call reads
 * the current page DOM and never consults a cached, global, or previously
 * selected profile. When the active profile cannot be determined safely the
 * result is BLOCKED and no write is permitted.
 *
 * This module owns profile *selection* for profile-scoped actions. Storage
 * access (read/write/verify) remains the responsibility of CrmService.
 */

const CRM_STORAGE_PREFIX = "chat-sender-";
const PROFILE_KEY_RE = /^chat-sender-\d+$/;
const MAX_TEXT_NODES = 2000;

/** Where the active profile id was resolved from. */
export type ProfileResolutionSource = "sidebar-dom" | "url" | "single-profile" | "blocked";

/** Confidence in the resolved profile id. */
export type ProfileResolutionConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

/** Result of a single active-profile resolution attempt. */
export interface ProfileResolution {
    readonly ok: boolean;
    readonly profileId: string | null;
    readonly storageKey: string | null;
    readonly source: ProfileResolutionSource;
    readonly confidence: ProfileResolutionConfidence;
    readonly reason?: string;
}

/** Immutable context for a profile-scoped action. All stages use storageKey. */
export interface ProfileScopedActionContext {
    readonly profileId: string;
    readonly storageKey: string;
    readonly source: ProfileResolutionSource;
    readonly confidence: ProfileResolutionConfidence;
}

/**
 * Pure: parse a standalone "ID: <digits>" line from a text block.
 *
 * The label must be the word "ID" starting a line of its own followed by a
 * colon and digits. Labels embedded in a sentence ("Client ID: 123",
 * "User ID: 456") do not match, so client/man IDs elsewhere on the page are
 * never read.
 */
export function parseVisibleProfileId(text: string): string | null {
    if (typeof text !== "string") return null;
    const m = /(?:^|\n)\s*ID\s*:\s*(\d{1,20})\s*(?=\n|$)/.exec(text);
    if (!m) return null;
    const id = m[1];
    if (!/^\d+$/.test(id)) return null;
    return id;
}

/**
 * Pure: extract a numeric profile id from an explicit id/profile/lady URL
 * parameter. Conservative: returns null unless the route carries an explicit
 * numeric parameter, so it can never guess a random number from the URL.
 */
export function extractProfileIdFromUrl(href: string): string | null {
    if (typeof href !== "string" || href.length === 0) return null;
    const m = /[?&](?:id|profile|lady)[=/](\d{1,20})(?:&|$)/i.exec(href);
    return m ? m[1] : null;
}

/**
 * Extract the visible profile id from the page DOM.
 *
 * Scans text nodes of the top-frame document for standalone "ID: <digits>"
 * lines. Returns the id only when exactly one distinct id is present;
 * ambiguity (two or more distinct ids anywhere in the page) resolves to null
 * so the caller can block instead of guessing.
 */
export function extractVisibleProfileId(doc: Document | null): string | null {
    if (!doc || !doc.body) return null;
    try {
        if (typeof window !== "undefined" && window.top && window !== window.top) return null;
    } catch { /* window unavailable */ }
    const ids = new Set<string>();
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    let scanned = 0;
    while (node && scanned < MAX_TEXT_NODES) {
        const id = parseVisibleProfileId(node.textContent ?? "");
        if (id) ids.add(id);
        node = walker.nextNode();
        scanned++;
    }
    return ids.size === 1 ? [...ids][0] : null;
}

/** List every chat-sender-<id> profile key in storage (backups excluded). */
function listProfileKeys(): string[] {
    try {
        return Object.keys(localStorage)
            .filter((k) => PROFILE_KEY_RE.test(k))
            .sort();
    } catch { /* storage unavailable */ }
    return [];
}

/**
 * Resolve the active GoldenBride profile.
 *
 * Order: sidebar DOM (HIGH) → explicit URL parameter (MEDIUM) → single
 * chat-sender-* profile in storage (LOW) → BLOCKED.
 */
export function resolveActiveProfile(): ProfileResolution {
    const visibleId = extractVisibleProfileId(typeof document !== "undefined" ? document : null);
    if (visibleId) {
        return {
            ok: true,
            profileId: visibleId,
            storageKey: `${CRM_STORAGE_PREFIX}${visibleId}`,
            source: "sidebar-dom",
            confidence: "HIGH",
        };
    }

    try {
        const urlId = extractProfileIdFromUrl(window.location.href);
        if (urlId) {
            return {
                ok: true,
                profileId: urlId,
                storageKey: `${CRM_STORAGE_PREFIX}${urlId}`,
                source: "url",
                confidence: "MEDIUM",
            };
        }
    } catch { /* window unavailable */ }

    const profiles = listProfileKeys();
    if (profiles.length === 1) {
        const id = profiles[0].replace(CRM_STORAGE_PREFIX, "");
        return {
            ok: true,
            profileId: id,
            storageKey: profiles[0],
            source: "single-profile",
            confidence: "LOW",
        };
    }

    return {
        ok: false,
        profileId: null,
        storageKey: null,
        source: "blocked",
        confidence: "NONE",
        reason: "Active GoldenBride profile could not be determined safely.",
    };
}

/** Resolve an immutable action context, or null when resolution is blocked. */
export function resolveActionContext(): ProfileScopedActionContext | null {
    const resolution = resolveActiveProfile();
    if (!resolution.ok || !resolution.profileId || !resolution.storageKey) return null;
    return {
        profileId: resolution.profileId,
        storageKey: resolution.storageKey,
        source: resolution.source,
        confidence: resolution.confidence,
    };
}
