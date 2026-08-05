# RC-STABLE-006 — Finance UI Polish & Import Preview

## 1. Analysis

UI-only EPIC in two independent parts:

**Part 1 — Finance header & body polish.**
- The header was left-heavy: the CASH cluster sat immediately next to the FINANCE
  title (`[title] [CASH+!] [spacer] [actions]`), with the single right-side flexible
  spacer pushing collapse/close to the right.
- A single flexible spacer cannot centre CASH: equal spacing on both sides requires
  the free space to be split symmetrically between `title→CASH` and `CASH→actions`.
  Pseudo-elements cannot be inserted mid-flex-list, so a second flexible element
  **between title and CASH** is required. This is a minimal, structural change.
- The shifted-time `Shift: Day (15:00 – 22:59)` row was already relocated to the body
  (in RC-STABLE-005) but was ordered *after* the Date row. The EPIC wants the Shift
  section first, with the Date below it, visually separated in the Finance design
  language.

**Part 2 — Import Snippets live preview.**
- `showImportSnippetsModal()` (`companion-dialogs.ts`) gives no feedback until Import.
- The importer always routes through the *single* normalization function
  `CrmService.normalizeSnippets()` (`crm-service.ts:359-376`): trims each line, skips
  empty lines (`continue`), keeps first occurrence of duplicates (case-sensitive),
  counts `linesEntered` and `duplicatesSkipped`.
- A preview that calls the **same** `normalizeSnippets` on the same raw lines
  (`textarea.value.split(/\r?\n/)`) is guaranteed to match the actual import result.
  Empty = raw lines − `linesEntered` (exactly the lines the importer skips).
- No circular dependency: `crm-service` does not import `companion-dialogs`
  (verified by grep); importing `CrmService` into the dialog is safe.

### Accepted UX decisions
- Shift time-range caption is kept inside the Shift section and updates together with
  the selected shift.
- The statistics panel is hidden while the textarea is empty and revealed on first
  input, then updates live.

## 2. Plan

1. `finance-widget.ts`: add a left flexible header spacer between title and CASH;
   restructure `fullRebuild()` so the body shift-info is `Shift section → divider →
   Date row`; keep the time-range caption in sync via `updateShiftButton()`.
2. `finance-widget.css.ts`: style `.ab-finance-shift-section`,
   `.ab-finance-shift-section-label`, and the (now caption) `.ab-finance-shift-time-range`.
3. `companion-dialogs.ts`: import `CrmService`; add a stats panel (hidden); compute
   `Lines/Unique/Duplicates/Empty` via `CrmService.normalizeSnippets` in `updateStats()`,
   wired into the existing `input` handler; reveal on first input.
4. `companion-styles.ts`: CSS for `.ab-import-stats*` in the dialog design language.
5. New harness + run all Finance and Import regressions + builds.
6. Report, commit, push, verify `HEAD == origin/master`.

## 3. Modified Files

| File | Reason |
| --- | --- |
| `src/companion/finance-widget.ts` | Part 1 DOM/logic: left header spacer; shift-section-first body ordering. |
| `src/companion/finance-widget.css.ts` | Part 1 CSS: shift section, section label, caption. |
| `src/companion/companion-dialogs.ts` | Part 2: `CrmService` import, stats panel DOM + `updateStats()` + wiring. |
| `src/companion/companion-styles.ts` | Part 2 CSS: `.ab-import-stats` panel. |
| `scripts/Companion.user.js` | Regenerated tracked artifact from changed source. |
| `scripts/Companion.arena.user.js` | Regenerated tracked artifact from changed source. |
| `.ai/context/rc-stable-006-finance-ui-polish.md` | This report. |

Untracked (NOT committed): `agencybooster-devtoolkit/rc-stable-006-finance-ui-polish-harness.ts`
and `.cjs`. `extension/dist/` is gitignored.

## 4. Changes Per File

### `src/companion/finance-widget.ts`
- `createRoot()`: added a second `header-spacer` element inserted **between the title
  and the CASH indicator**. Both spacers share `.ab-finance-header-spacer`
  (`flex: 1 1 auto; min-width: 0`), so the free width splits equally and the CASH
  cluster (CASH + new-transaction indicator) is visually centred between FINANCE and
  the actions. Header child order is now
  `[title, spacer, CASH, indicator, spacer, actions]`.
- `fullRebuild()`: replaced the old `Date row → selector → Shift: row` block with
  **Shift section first** (`.ab-finance-shift-section`: a "Shift" section label, the
  `createShiftSelector()`, and the time-range caption `.ab-finance-shift-time-range`) →
  a `.ab-finance-divider` → the **Date row** (`Date: dd.MM.yyyy`). The Shift section is
  therefore the first control inside the body.
- `updateShiftButton()`: in addition to the button text/active option, refreshes the
  `.ab-finance-shift-time-range` caption text so it always matches the current shift
  (guarded when the element is absent).

### `src/companion/finance-widget.css.ts`
- Added `.ab-finance-shift-section` (flex column, bordered rounded panel matching the
  widget design language), `.ab-finance-shift-section-label` (small uppercase dim
  label), and expanded `.ab-finance-shift-time-range` into a caption (font-size,
  70% white). No change needed for the spacers (existing `.ab-finance-header-spacer`
  rule already applies to both).

### `src/companion/companion-dialogs.ts`
- `import { CrmService } from "./crm-service";`.
- Added a hidden stats panel after the editor:
  ```
  Detected snippets
  Lines | Unique | Duplicates | Empty
  ```
  with ids `ab-import-stats(-title)|ab-import-stat-lines|ab-import-stat-unique|
  ab-import-stat-duplicates|ab-import-stat-empty`.
- Added `updateStats()`: `const rawLines = textarea.value.split(/\r?\n/)` →
  `CrmService.normalizeSnippets(rawLines)` → sets Lines=linesEntered,
  Unique=unique.length, Duplicates=duplicatesSkipped, Empty=raw−linesEntered, then
  reveals the panel. Wired into the existing `input` handler.
- No import, profile, or storage access — pure preview.

### `src/companion/companion-styles.ts`
- Added `.ab-import-stats`, `.ab-import-stats[hidden]`, `.ab-import-stats-title`,
  `.ab-import-stats-grid`, `.ab-import-stat-label`, `.ab-import-stat-value` using the
  same `--ab-*` tokens / rounded-bordered design as the other `.ab-import-*` styles.

### `scripts/Companion.user.js` / `scripts/Companion.arena.user.js`
- Regenerated via `npm run build` / `npm run build:arena`. Verified (content search)
  to contain `ab-import-stats-title`, `ab-finance-shift-section`,
  `ab-finance-header-spacer`, and no longer contain the old `labelShift`/`rowShiftTime`
  shift-row code.

## 5. Parser Reuse Evidence

The preview cannot diverge from the importer because it consumes the **same** function:

- Importer: `CrmService.importSnippetsToProfile()` calls
  `CrmService.normalizeSnippets(snippets)` (`crm-service.ts:398`).
- Preview: `updateStats()` calls `CrmService.normalizeSnippets(textarea.value.split(/\r?\n/))`
  directly.
- `parseSnippets()` (`companion-dialogs.ts:160-165`) splits on `\r?\n`, trims, filters
  empties; `normalizeSnippets` performs the identical split/trim/skip internally, so
  `normalizeSnippets(parseSnippets()) ≡ normalizeSnippets(rawLines)` for
  `linesEntered`/`unique`/`duplicatesSkipped`.
- Therefore **Lines (linesEntered), Unique (unique.length), Duplicates
  (duplicatesSkipped)** are byte-for-byte the counts the importer reports, and
  **Empty = rawLines − linesEntered** is exactly the set the importer skips.
- No second parsing implementation exists. Harness check `P2 … matches importer
  pipeline` recomputes the expected values from `CrmService.normalizeSnippets` on the
  same raw text and compares to the panel DOM for every scenario (including the 41-line
  case).

## 6. Verification

### Build gate (all exit 0)

| Command | Result |
| --- | --- |
| `npm run lint` | 0 |
| `npm run typecheck` (`npx tsc --noEmit`) | 0 |
| `npm run build` | 0 (`scripts/Companion.user.js`) |
| `npm run build:arena` | 0 (`scripts/Companion.arena.user.js`) |
| `npm run build:ext` | 0 (`extension/dist/`) |

`extension/dist/content.js` verified to contain `ab-import-stats-title`,
`ab-finance-shift-section`, `ab-finance-header-spacer`; stale `labelShift`/`rowShiftTime`
code is gone.

### New harness — `rc-stable-006-finance-ui-polish-harness` (built + run, exit 0)

`30 checks, 0 failures`:

- Part 1 (Finance): two flexible spacers; header child order; spacer `flex:1` CSS;
  responsive rules present; shift-info is first body element; shift section first child;
  Date row after shift section; Date label; selector inside section; no shift button in
  header; exactly one in body; caption matches `Day (15:00 – 22:59)`; dblclick on left
  spacer toggles both ways; dblclick on CASH/collapse does not toggle; shift change
  refreshes and updates button+caption together; Date row stays below after shift change;
  collapsed hides body.
- Part 2 (Import): panel hidden while empty; revealed on first input; and for `A/B/C`,
  `A/A/(blank)/(ws)/B`, 41 distinct lines, and a live second input — every stat
  cross-checked against `CrmService.normalizeSnippets` on the same raw text;
  empty input still blocks import (error box); valid input resolves with the same parsed
  snippets; no import history recorded (import never performed).

### Finance regressions (rebuilt from current source, rerun 20:02 local Day shift — all exit 0, 0 failures)

| Harness | Checks | Failures |
| --- | --- | --- |
| `rc-stable-001` | 47 | 0 |
| `rc-stable-002-fix-001` | 20 | 0 |
| `rc-stable-002-fix-002` | 42 | 0 |
| `rc-stable-004-video-chat-satellite` | 22 | 0 |
| `rc-polish-004-fix` | 29 | 0 |
| `rc-stable-005-finance-header-ui` | 33 | 0 |

`rc-stable-005` check **C21** (exact header child order) was updated to the new accepted
order `[title, spacer, CASH, indicator, spacer, actions]`; all other checks unchanged.
The known `rc-polish-004-fix` Morning-shift (07:00–14:59) flake does not apply (run at
20:02, Day shift).

### Import regressions (rebuilt + rerun — all exit 0, 0 failures)

| Harness | Checks | Failures |
| --- | --- | --- |
| `rc-stable-003` (incl. import-modal UI + `normalizeSnippets`) | 133 | 0 |
| `rc-stable-003-fix-003` | 44 | 0 |
| `rc-stable-003-fix-003-fix-001` | 26 | 0 |

The added stats panel does not affect the rc-stable-003 import-modal scenarios.

## 7. Browser Verification

Not executed in this session — **UNKNOWN**. Expected behaviour on a live GoldenBride page:

- Finance: CASH cluster visually centred (equal spacing both sides); refresh attached to
  CASH; Shift section is the first control in the body with the time-range caption
  `Day (15:00 – 22:59)` updating on shift change; the Date row renders below the Shift
  section; the dropdown opens inside the widget; responsive layout preserved;
  double-click on the empty spacer toggles collapse.
- Import with the 41-line TXT: preview shows `Lines 41 / Unique 41 / Duplicates 0 /
  Empty 0` immediately after paste; Import afterwards reports `Lines entered: 41,
  Unique snippets: 41, Messages created: 41` (guaranteed by the unchanged pipeline).

## 8. Remaining Limitations

- The stats panel reflects textarea content only; it is intentionally a pure preview and
  does not account for subsequent import-time profile resolution or confirmed-replace
  confirmation.
- The Shift-section custom panel uses the same `overflow-y: auto` body as before; an
  extremely short widget could still clip a very long open dropdown (pre-existing,
  documented in RC-STABLE-005 §19) — placing the selector at the top of the body
  actually improves headroom.
- The caption text is recomputed each rebuild and each `updateShiftButton` call; it is
  derived from the static shift definition (`label` + `timeDisplay`), not the live
  controller range.

## 9. Unknowns

- Live-browser pixel-level centering equality of the two spacers and the dropdown
  clipping at very short widget heights: UNKNOWN (jsdom has no layout engine; structural
  checks only).
- Real-device double-click/drag timing interplay: UNKNOWN (harness dispatches synthetic
  `dblclick`).
- Whether the built 41-line TXT was available during live testing: the expected `41/41/0/0`
  preview and post-import counts are verified logically (exact-same `normalizeSnippets`
  call) but not yet observed on a real page.

### Commit

- Baseline `HEAD`: `692190ca3a29f55b78c1d7d4e92d613bac4bb973`.
- Commit: `RC-STABLE-006: polish finance UI and import preview`
- Push `origin/master`; verify `HEAD == origin/master`.