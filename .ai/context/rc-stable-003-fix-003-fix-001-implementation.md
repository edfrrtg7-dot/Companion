# RC-STABLE-003-FIX-003-FIX-001 — Scope profile detection to the lady sidebar

## 1. Objective

Scope active-profile detection strictly to the GoldenBride lady sidebar container
`.account-wrap-new`, reading the profile ID only from `.total-new a span` (digits only),
and ignoring every ID outside that container. Add a verified `favoriteForLadyId=<digits>`
hash-parameter fallback (MEDIUM) used only after the scoped sidebar DOM fails.

## 2. Baseline

- Git HEAD at start: `e6c903dc5c66e0b4cd8013a0c550e502afa34042` (commit
  `RC-STABLE-003-FIX-003: target imports to the active GoldenBride profile`), equal to
  `origin/master` (VERIFIED via `git rev-parse HEAD` before work).
- Pre-existing resolver behaviour in `src/companion/profile-resolver.ts`: TreeWalker text
  scan over `document.body` with `parseVisibleProfileId` matching standalone `ID:` lines
  (bounded by `MAX_TEXT_NODES = 2000`), fallback order sidebar DOM (HIGH) → URL
  `?id|profile|lady` (MEDIUM) → single `chat-sender-*` profile (LOW) → BLOCKED.
- No real GoldenBride DOM classes/selectors existed anywhere in the repository
  (`src/`, `extension/`, `docs/`, `.ai/`, `agencybooster-devtoolkit/`) before this EPIC
  (VERIFIED by search during plan phase). Only Companion's own `.ab-*` UI and
  `CrmService.findButton` generic matching existed.

## 3. Rejection Evidence

- The previous unscoped approach used a page-wide text scan. The page (verified in the
  FIX-003 work) contains many standalone `ID:` lines that are not the active lady:
  admirer IDs, client IDs, card IDs, chat sender IDs, modal IDs. The text scan could not
  distinguish the lady's own ID row from those. That design was rejected.
- Broader fallbacks were rejected during planning: parsing arbitrary numbers, or
  similarly named parameters (`ladyId`, `lady_id`, etc.), would reintroduce the guessing
  the EPIC forbids.

## 4. Confirmed Defect

The previous resolution logic targeted "the active GoldenBride profile" but determined it
by scanning the whole page for the *first/any* standalone `ID:` line. Any non-lady ID
rendered on the page could be picked up, so profile-scoped actions (IceBreaker import,
Broadcast import) could target the wrong `chat-sender-*` storage key. The EPIC confirmed
defect: active-profile detection was not scoped to the actual lady-identity element.

## 5. Existing DOM Anchors (evidence)

Live GoldenBride DOM snippet (user-provided, VERIFIED):

```
<div class="account-wrap-new">
  <div class="avatar-row"> ... <img data-bg-webp ... data-bg-jpg ...> </div>
  <a class="gwt-Anchor">Kira</a>
  <div class="total-new"><a class="gwt-Anchor">ID: <span>1408104</span></a></div>
  <ul class="account-menu"> ... </ul>
</div>
```

- Container: `.account-wrap-new` — the active-lady account block.
- ID element: `.account-wrap-new .total-new a span` — value `1408104`, digits only.
- Verified GoldenBride URL hash (from `docs` context evidence): the active-lady route uses
  `#!HOME;favoriteForLadyId=<digits>` (e.g. lady "Kira" → `favoriteForLadyId=1408104`).

## 6. Modified-File Plan

| File | Reason |
| --- | --- |
| `src/companion/profile-resolver.ts` | Replace unscoped page-wide text scan with scoped `.account-wrap-new` extraction + `favoriteForLadyId` hash fallback. |
| `scripts/Companion.user.js` | Tracked build artifact; regenerated from changed source. |
| `scripts/Companion.arena.user.js` | Tracked build artifact; regenerated from changed source. |
| `.ai/context/rc-stable-003-fix-003-fix-001-implementation.md` | This report. |

Not modified (per EPIC constraint): `crm-service`, `companion-modal`, `dev/`,
`dashboard/`, `diagnostics-collectors`, and every other file in the repository.

## 7. Modified Files

1. `src/companion/profile-resolver.ts` (modified)
2. `scripts/Companion.user.js` (regenerated artifact)
3. `scripts/Companion.arena.user.js` (regenerated artifact)
4. `.ai/context/rc-stable-003-fix-003-fix-001-implementation.md` (created, this report)

`agencybooster-devtoolkit/` contains the untracked harness; it is NOT part of the commit.

## 8. Changes Per File

### `src/companion/profile-resolver.ts`

- Removed: `MAX_TEXT_NODES`, `parseVisibleProfileId`, `extractVisibleProfileId`, and the
  `document.createTreeWalker` page-wide scan.
- Added `PROFILE_ID_SOURCE = "\\d{1,20}"` (unanchored, reused in both regexes) and
  `PROFILE_ID_RE = /^\d{1,20}$/` (validation).
- Added constants `SIDEBAR_CONTAINER_SELECTOR = ".account-wrap-new"`,
  `SIDEBAR_ID_SELECTOR = ".total-new a span"`, `HASH_LADY_PARAM = "favoriteForLadyId"`.
- New export `extractProfileIdFromHash(href)`: reads `favoriteForLadyId=<digits>` from the
  URL hash fragment; requires exact param name, digits-only value, bounded by fragment
  start / `;` / `&` / end. Never accepts arbitrary numbers or similarly named params.
- New export `extractScopedSidebarProfileId(doc)`: top-frame guard, then requires exactly
  one `.account-wrap-new` container; reads `.total-new a span` values, trims, validates
  against `PROFILE_ID_RE`, dedupes, requires exactly one distinct id. Zero/multiple
  containers or zero/multiple ids → `null` (fallback continues; never a guess).
- `resolveActiveProfile()` order now: scoped sidebar DOM (HIGH) → `favoriteForLadyId` hash
  (MEDIUM) → explicit `?id|profile|lady` query param (MEDIUM) → single `chat-sender-*`
  profile (LOW) → BLOCKED. `resolveActionContext()` returns an immutable
  `ProfileScopedActionContext` or null.
- Public resolver interface (`resolveActiveProfile`, `resolveActionContext`,
  `ProfileResolution`, `ProfileScopedActionContext`, `ProfileResolutionSource`) unchanged,
  so import revalidation, history, dashboard, and diagnostics keep working with the new
  scoped resolution.

### `scripts/Companion.user.js` / `scripts/Companion.arena.user.js`

Regenerated via `npm run build` / `npm run build:arena`. Verified to contain the new
`SIDEBAR_CONTAINER_SELECTOR`, `HASH_LADY_PARAM`, `extractScopedSidebarProfileId`
(VERIFIED by content search: line 4652/4654/4668 in `Companion.user.js`; 4587/4589/4603 in
`Companion.arena.user.js`).

## 9. Scoped Sidebar Resolution

`extractScopedSidebarProfileId`:

1. Null/absent `doc.body` → `null`. Top-frame guard: returns `null` when in a subframe.
2. `querySelectorAll(".account-wrap-new")`; exactly 1 required, else `null`.
3. Within that single container, `querySelectorAll(".total-new a span")`; each value is
   trimmed and accepted only if it matches `^\d{1,20}$`.
4. Distinct ids are deduped; exactly one distinct id → returned; zero or ≥2 → `null`.

## 10. Ignored External IDs

The following categories never influence resolution (VERIFIED by harness F2/F3/F4/F11):

- Unrelated `ID:` lines elsewhere on the page (F2: ten unrelated ids).
- Admirer/client/card IDs and `chat-sender-*` elements rendered outside the container (F3).
- Hidden modal IDs (F4).
- Companion's own `.ab-*` UI (`ID:` shown by Companion itself) (F11).

## 11. Fallback Policy

- HIGH: scoped sidebar `.account-wrap-new .total-new a span` (single, digits-only).
- MEDIUM: `favoriteForLadyId=<digits>` hash parameter (verified GoldenBride route).
- MEDIUM: explicit `?id=` / `?profile=` / `?lady=` numeric query parameter.
- LOW: exactly one `chat-sender-*` profile present in storage.
- BLOCKED: no safe determination; no write is permitted.

## 12. Ambiguity Handling

Zero or multiple `.account-wrap-new` containers → no sidebar signal (fallback continues).
Zero or multiple distinct valid ids inside the container → no sidebar signal. Multiple
stored profiles with no other signal → BLOCKED (no guess). Malformed/empty/non-digit span
values are ignored (F7a–F7c); whitespace-trimmed valid values resolve (F7d).

## 13. Multi-Tab Isolation

Resolution is tab-local; every call reads the current page DOM and hash. No shared
last-active state exists. Harness M group: tab A sidebar `812510` and tab B sidebar
`978023` each resolve to their own profile in separate JSDOM windows (M1/M2); M3 verifies
there is no shared last-active state (closing both windows leaves storage free of any
implicit selection).

## 14. Import Integration

`CrmService.importSnippetsToProfile` still receives the profile via
`resolveProfile`/`resolveActionContext`. Harness I group verifies:

- I1: IceBreaker targets the scoped profile `812510`.
- I2: the other stored profile (`978023`) is untouched.
- I3: Broadcast import targets the scoped profile and replaces the broadcast collection.
- I4: revalidation detects the active profile changed (`812510` → `978023`) and aborts the
  import (no write on abort).
- I5: object-collection import regression green.
- I6: delay regression `[0,65,65]` (first message delay 0, later 65) green.
- I7: import history records the scoped profile id + storage key.

## 15. Diagnostics

Harness D group verifies `getImportTargetDiagnostics`-style output:

- D1: scoped sidebar resolution is reported with source HIGH (`sidebar-dom`).
- D2: mismatch between the resolved active profile and the profile being imported is
  flagged in the diagnostics payload.

## 16. Runtime Harness

New harness: `agencybooster-devtoolkit/rc-stable-003-fix-003-fix-001-harness.ts`
(untracked). Builds with esbuild (`--external:jsdom`), runs on Node with three JSDOM
windows (main global + two multi-tab fixtures).

Result (VERIFIED):

```
=== RESULT: 26 checks, 0 failures ===
RUN_EXIT=0
```

Group breakdown: F1–F11 scoped detection (incl. user cases 1–10 + Companion UI ignored),
M1–M3 multi-tab, I1–I7 import integration + regressions, D1–D2 diagnostics. User-required
cases 1–10 map: (1)=F1, (2)=F2, (3)=F3, (4)=F4, (5)=F5, (6)=F6, (7)=F7a–d, (8)=F8,
(9)=F9, (10)=F10.

## 17. Build Verification

| Command | Exit code | Result |
| --- | --- | --- |
| `npx esbuild rc-stable-003-fix-003-fix-001-harness.ts --bundle --platform=node --format=cjs --external:jsdom --outfile=...cjs` | 0 | BUILD_EXIT=0 |
| `node rc-stable-003-fix-003-fix-001-harness.cjs` | 0 | 26 checks, 0 failures |
| `npm run lint` | 0 | eslint `src/ extension/` clean |
| `npx tsc --noEmit` (in `agencybooster-devtoolkit/`) | 0 | typecheck clean |
| `npm run build` | 0 | `scripts/Companion.user.js` 296.2kb |
| `npm run build:arena` | 0 | `scripts/Companion.arena.user.js` 294.5kb |

Regression harnesses (rebuilt + rerun against new resolver):

| Harness | Checks | Failures | Run exit |
| --- | --- | --- | --- |
| `rc-stable-001` | 47 | 0 | 0 |
| `rc-stable-002-fix-001` | 20 | 0 | 0 |
| `rc-stable-002-fix-002` | 42 | 0 | 0 |
| `rc-stable-003` | 133 | 0 | 0 |
| `rc-stable-003-fix-003` | 44 | 0 | 0 |
| `rc-polish-004-fix` | 29 | 0 | 0 |
| `rc-stable-003-fix-003-fix-001` (new) | 26 | 0 | 0 |

## 18. Browser Verification

The following manual live steps were NOT executed in this session: opening a GoldenBride
lady with ID `812510` in Favorite Men / Men Search, opening a second lady `978023`,
confirming import snippets target the scoped profile, and confirming Companion diagnostics
(visible/selected/source/confidence/mismatch). Browser runtime behaviour of the scoped
selectors and the hash fallback is therefore **UNKNOWN** and requires live confirmation.
The selectors used come from the user-provided live DOM snippet (Section 5), so they are
repository+evidence backed, but live runtime verification remains outstanding.

## 19. Regression Verification

All accepted regressions rerun clean (Section 17 table). No Finance files were touched;
Companion never imports Finance internals. Import semantics for history, revalidation,
delay calculation, and array/object collection handling are unchanged and verified by the
existing harness suites.

## 20. Limitations

- The `.account-wrap-new` class is the current GoldenBride sidebar structure; if the CRM
  changes its markup, the HIGH source silently falls through to the MEDIUM/LOW chain
  instead of failing loudly.
- Hash fallback only understands the verified `favoriteForLadyId` parameter; other
  GoldenBride routes that carry the lady id in a different parameter are not supported.
- Runtime live verification remains outstanding (Section 18).

## 21. Unknowns

- Live browser behaviour of the new scoped resolution and hash fallback: UNKNOWN (not
  executed this session).
- Whether GoldenBride renders `.account-wrap-new` identically across all routes (Favorite
  Men, Men Search, other pages): UNKNOWN.
- Whether the hash contains `favoriteForLadyId` on every active-lady route: UNKNOWN.

## 22. Stable Release Readiness

- Implementation complete; lint, typecheck, build, arena build all pass (exit 0).
- New harness: 26 checks, 0 failures. All accepted regressions: 0 failures.
- Resolver interface unchanged; architecture and module boundaries preserved.
- No unrelated files modified.
- Remaining gap: live browser verification (Section 18). Until that is performed,
  browser-level behaviour is UNKNOWN, so this commit is ready for merge but live
  confirmation is the only open item before user-facing validation.
