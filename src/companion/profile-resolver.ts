/**
 * ProfileResolver
 *
 * Resolves the active GoldenBride profile from the current page at action time.
 *
 * The primary source is the scoped active-lady account container in the
 * GoldenBride sidebar: `.account-wrap-new` (avatar + lady name + `ID:` row +
 * account menu). The profile ID is read ONLY from
 * `.account-wrap-new .total-new a span` (digits only). Nothing outside that
 * container is inspected, so admirer/client/card/chat IDs rendered elsewhere on
 * the page never affect resolution. Resolution is tab-local: every call reads
 * the current page DOM and never consults a cached, global, or previously
 * selected profile. When the active profile cannot be determined safely the
 * result is BLOCKED and no write is permitted.
 *
 * Fallback chain (after scoped sidebar fails): explicit `favoriteForLadyId`
 * hash parameter (MEDIUM) → explicit `id`/`profile`/`lady` query parameter
 * (MEDIUM) → exactly one `chat-sender-*` profile in storage (LOW) → BLOCKED.
 *
 * This module owns profile *selection* for profile-scoped actions. Storage
 * access (read/write/verify) remains the responsibility of CrmService.
 */

const CRM_STORAGE_PREFIX = "chat-sender-";
const PROFILE_KEY_RE = /^chat-sender-\d+$/;
const PROFILE_ID_SOURCE = "\\d{1,20}";
const PROFILE_ID_RE = new RegExp(`^${PROFILE_ID_SOURCE}$`);

/** Scoped active-lady account container in the GoldenBride sidebar. */
const SIDEBAR_CONTAINER_SELECTOR = ".account-wrap-new";
/** The ID element within the container; value is digits only. */
const SIDEBAR_ID_SELECTOR = ".total-new a span";
/** Verified GoldenBride hash parameter carrying the active lady id. */
const HASH_LADY_PARAM = "favoriteForLadyId";

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
 * Pure: extract the active lady id from an explicit `favoriteForLadyId=<digits>`
 * hash parameter. Conservative: the exact parameter name is required, the value
 * must be digits only, and the parameter must be bounded by the fragment start,
 * `;`, `&`, or the end of the fragment. Arbitrary numbers and similarly named
 * parameters are never accepted.
 */
export function extractProfileIdFromHash(href: string): string | null {
    if (typeof href !== "string" || href.length === 0) return null;
    const hashIndex = href.indexOf("#");
    if (hashIndex < 0) return null;
    const fragment = href.slice(hashIndex + 1);
    const m = new RegExp(`(?:^|[;&])${HASH_LADY_PARAM}=(${PROFILE_ID_SOURCE})(?:[;&]|$)`).exec(fragment);
    return m ? m[1] : null;
}

/**
 * Pure: extract a numeric profile id from an explicit id/profile/lady URL
 * query parameter. Conservative: returns null unless the route carries an
 * explicit numeric query parameter, so it can never guess a random number.
 */
export function extractProfileIdFromUrl(href: string): string | null {
    if (typeof href !== "string" || href.length === 0) return null;
    const m = /[?&](?:id|profile|lady)[=/](\d{1,20})(?:&|$)/i.exec(href);
    return m ? m[1] : null;
}

/**
 * Extract the visible lady id from the scoped sidebar account container.
 *
 * Scans ONLY `.account-wrap-new` in the top frame. Returns the id when there is
 * exactly one container and exactly one distinct valid digit id inside
 * `.total-new a span`. Zero or multiple containers, or zero/multiple distinct
 * ids, resolve to null so the caller continues the fallback chain instead of
 * guessing. IDs anywhere outside the container are ignored completely.
 */
export function extractScopedSidebarProfileId(doc: Document | null): string | null {
    if (!doc || !doc.body) return null;
    try {
        if (typeof window !== "undefined" && window.top && window !== window.top) return null;
    } catch { /* window unavailable */ }

    let containers: NodeListOf<Element>;
    try {
        containers = doc.querySelectorAll(SIDEBAR_CONTAINER_SELECTOR);
    } catch {
        return null;
    }
    if (containers.length !== 1) return null;

    const ids = new Set<string>();
    const spans = containers[0].querySelectorAll(SIDEBAR_ID_SELECTOR);
    for (const span of spans) {
        const value = (span.textContent ?? "").trim();
        if (PROFILE_ID_RE.test(value)) ids.add(value);
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
 * Order: scoped sidebar DOM (HIGH) → `favoriteForLadyId` hash (MEDIUM) →
 * explicit query parameter (MEDIUM) → single chat-sender-* profile in storage
 * (LOW) → BLOCKED.
 */
export function resolveActiveProfile(): ProfileResolution {
    const sidebarId = extractScopedSidebarProfileId(typeof document !== "undefined" ? document : null);
    if (sidebarId) {
        return {
            ok: true,
            profileId: sidebarId,
            storageKey: `${CRM_STORAGE_PREFIX}${sidebarId}`,
            source: "sidebar-dom",
            confidence: "HIGH",
        };
    }

    try {
        const hashId = extractProfileIdFromHash(window.location.href);
        if (hashId) {
            return {
                ok: true,
                profileId: hashId,
                storageKey: `${CRM_STORAGE_PREFIX}${hashId}`,
                source: "url",
                confidence: "MEDIUM",
            };
        }
    } catch { /* window unavailable */ }

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
