# RC-STABLE-006-FIX-001 — Import Snippets Editor: One Visual Row per Snippet

## 1. Objective

UI-only bug-fix EPIC for the Import Snippets dialog:

- **A. Disable soft wrapping** so each logical snippet occupies exactly one visual row.
  Long lines overflow horizontally instead of wrapping into extra visual rows, and the
  editor gets a horizontal scrollbar. Vertical scrolling must remain available.
- **B. Keep the line-number gutter correct**: numbers start at 1, one number per
  newline-delimited row, horizontal textarea scrolling must not move the gutter, the
  gutter must stay vertically synced with the textarea scroll, and the gutter must not
  itself horizontally scroll.
- **C. Fix the misleading `Empty: 1` preview stat** for a terminal newline. A single
  terminal newline must report `Empty: 0`; interior blank lines still count; multiple
  trailing blank lines are ignored as trailing file whitespace; the exact rule must be
  investigated and documented.
- **D. Import pipeline unchanged**: split `\r?\n`, trim, case-sensitive first-occurrence
  dedup, replacement, history, targeting, and confirm/rollback must be byte-identical
  before and after.

Scope: **Import Snippets editor + preview statistics only** (`companion-dialogs.ts`,
`companion-styles.ts`, regenerated userscripts). Profile resolution, storage writes,
replacement, confirmation, history, and the Finance module are NOT modified.

## 2. Baseline

- Git HEAD at start: `cd9eb5a872af8a461abb9604443fbb27e041f7b3` (commit
  `RC-STABLE-006: polish finance UI and import preview`), equal to `origin/master`
  (VERIFIED via `git rev-parse` before work).
- Working tree at start: only the untracked project directories
  (`agencybooster-devtoolkit/`, `.ai/`, `templates/`, `extension/dist.zip`,
  `src/companion.zip`, `dashboard_result.txt`, `temp-collectors.ts`) — no tracked
  modifications.

## 3. Runtime Evidence (pre-fix)

User-run live browser session against GoldenBride (Chrome, unpacked
`extension/dist/`), reported before this EPIC:

- With the 41-line TXT pasted, a long snippet wrapped to multiple visual rows while the
  gutter showed a single line number next to the wrapped rows.
- Preview showed `Lines: 41, Unique: 41, Duplicates: 0, Empty: 1` for a TXT that ends in
  a terminal newline and contains 41 real snippets.

## 4. Existing Architecture

- `showImportSnippetsModal()` (`src/companion/companion-dialogs.ts`) renders, inside
  `createDialogOverlay()`: `.ab-import-editor` (flex row) containing
  `.ab-import-gutter`/`.ab-import-gutter-numbers` and
  `<textarea id="ab-import-textarea">` (no `wrap` attribute).
- `updateLineNumbers()` (`companion-dialogs.ts:160-168`) writes numbers 1..N where
  `N = textarea.value.split("\n").length` (per-newline, not per-visual-row) and resets
  the gutter transform.
- `updateStats()` (`companion-dialogs.ts:177-185`) computes `Empty = Math.max(0,
  rawLines.length - linesEntered)` where `rawLines = textarea.value.split(/\r?\n/)` and
  `linesEntered` comes from `CrmService.normalizeSnippets` (`crm-service.ts:359-376`).
- `syncGutterScroll()` (`companion-dialogs.ts:187-189`) sets
  `gutterNumbers.style.transform = translateY(-textarea.scrollTop)`.
- The importer (`CrmService.importSnippetsToProfile` →
  `normalizeSnippets`) splits `\r?\n`, trims each line, `continue`s on empty lines, and
  keeps first occurrence of case-sensitive duplicates. It has **no** trailing-empty
  policy and cannot distinguish interior from trailing empty lines.
- CSS lives in `COMPANION_STYLES_CSS` (`src/companion/companion-styles.ts`),
  `.ab-import-textarea` (line 551) had no `white-space`/`overflow-x` override, so
  browsers soft-wrapped long lines.

## 5. Modified-File Plan

| File | Reason |
| --- | --- |
| `src/companion/companion-dialogs.ts` | Disable soft wrap (`wrap="off"`); correct Empty accounting. |
| `src/companion/companion-styles.ts` | Non-wrap CSS (`white-space: pre`) + horizontal scroll (`overflow-x: auto`). |
| `scripts/Companion.user.js` | Tracked build artifact; regenerated from changed source. |
| `scripts/Companion.arena.user.js` | Tracked build artifact; regenerated from changed source. |
| `.ai/context/rc-stable-006-fix-001-import-editor-line-wrapping.md` | This report. |

Untracked, NOT committed: `agencybooster-devtoolkit/rc-stable-006-fix-001-import-editor-line-wrapping-harness.ts`
(+ `.cjs`) and the updated `rc-stable-006-finance-ui-polish-harness.ts` (+ `.cjs`).
`extension/dist/` is gitignored.

No other files are modified. Import pipeline, profile resolution, storage, replacement,
confirmation, history, and Finance are untouched.

## 6. Changes Per File

### `src/companion/companion-dialogs.ts`
- Textarea element: added `wrap="off"` (one logical line = one visual row; the textarea
  itself becomes horizontally scrollable, vertical scrolling preserved).
- `updateStats()`: replaced `Empty = rawLines.length - linesEntered` with
  `lastMeaningful` scanning:
  ```
  let lastMeaningful = rawLines.length;
  while (lastMeaningful > 0 && rawLines[lastMeaningful - 1].trim().length === 0) lastMeaningful--;
  const empty = Math.max(0, lastMeaningful - linesEntered);
  ```
  i.e. a trailing run of empty **or whitespace-only** lines after the last meaningful
  line is ignored; only empty lines between meaningful lines count as `Empty`.
  `Lines`, `Unique`, `Duplicates` are computed by the unchanged
  `CrmService.normalizeSnippets` call. The JSDoc was corrected to describe the new rule.
- `parseSnippets()` (split `\r?\n` → trim → filter empty) is unchanged; no newline is
  inserted/removed from user content.

### `src/companion/companion-styles.ts`
- `.ab-import-textarea`: added `white-space: pre;` and `overflow-x: auto;`. Together with
  `wrap="off"` this disables soft wrapping in every engine and makes long lines scroll
  horizontally inside the textarea. Vertical scrolling is unaffected (no
  `overflow-y: hidden`; existing `min-height: 260px` and `resize: none` kept).
- No gutter CSS change: `.ab-import-gutter` already has `overflow: hidden`, fixed 40px
  width, `flex-shrink: 0`, and is a flex sibling of the textarea — horizontal textarea
  scrolling physically cannot move it; vertical sync is handled by the existing
  `translateY(-scrollTop)` transform.

### `scripts/Companion.user.js` / `scripts/Companion.arena.user.js`
- Regenerated via `npm run build` / `npm run build:arena`. Content-verified to contain
  `wrap="off"`, `white-space: pre`, `overflow-x: auto`, `lastMeaningful`, and to no
  longer contain the old `Math.max(0, rawLines.length - linesEntered)` formula.

## 7. Chosen Empty Rule (documented)

The importer has no trailing-empty policy (it simply skips all empty lines), so the
preview defines the rule. Preview-only; import result is untouched.

**Rule: `Empty` counts only empty/whitespace-only lines that have at least one meaningful
line after them. A trailing run of empty/whitespace-only lines after the last meaningful
line is trailing file whitespace and is ignored.**

| Input | Lines | Unique | Duplicates | Empty |
| --- | --- | --- | --- | --- |
| `A\nB\nC\n` (terminal newline) | 3 | 3 | 0 | **0** |
| `A\n\nB\n` (one interior blank) | 2 | 2 | 0 | **1** |
| `A\n\n\nB\n` (two interior blanks) | 2 | 2 | 0 | **2** |
| `A\nB\n\n\n` (multiple trailing blanks) | 2 | 2 | 0 | **0** |
| `A\nB \n` (trailing whitespace-only line) | 2 | 2 | 0 | **0** |
| `A\nA\nB\n` (duplicate) | 3 | 2 | 1 | **0** |

`Lines/Unique/Duplicates` remain byte-identical to the importer because they come from
the same `normalizeSnippets` call.

## 8. Harness Verification

New harness: `agencybooster-devtoolkit/rc-stable-006-fix-001-import-editor-line-wrapping-harness.ts`
(untracked). Opens the Import modal on JSDOM, then covers the required checks:

```
23 checks, 0 failures
EXIT=0
```

- **A1** long single line → gutter shows exactly `1` (one logical line).
- **A2** `wrap="off"` attribute present.
- **A3** `.ab-import-textarea` CSS has `white-space: pre` and `overflow-x: auto`.
- **A4** `min-height: 260px` kept and no `overflow-y: hidden` (vertical scroll intact).
- **B1** gutter is a flex sibling of the textarea; gutter CSS `overflow: hidden`;
  horizontal scroll (`scrollLeft=100`) leaves gutter transform at `translateY(0px)`.
- **B2** vertical sync: `scrollTop=30` → `translateY(-30px)`.
- **B3** 41-line fixture (incl. terminal newline) → `41/41/0/0`.
- **C1** `A\nB\nC\n` → Empty 0. **C2** `A\n\n\nB\n` → Empty 2. **C3** `A\nB\n\n\n` →
  Empty 0. **C4** `A\nA\nB\n` → Duplicates 1.
- **D1** newline insert adds a gutter row (`1` → `1\n2`). **D2** newline removal drops it
  (`1\n2` → `1`). **D3** parsed snippets byte-equivalent to the importer pipeline
  (expected derived via `CrmService.normalizeSnippets` on the same raw lines); target
  preserved. **D4** preview never imports (`getImportHistory().length === 0`) and empty
  input still blocks with the error box.

## 9. Regression Verification

All harnesses rebuilt from the current source and rerun in this session (exit 0, 0
failures):

| Harness | Checks | Failures | Run exit |
| --- | --- | --- | --- |
| `rc-stable-003` (import-modal UI + `normalizeSnippets`) | 133 | 0 | 0 |
| `rc-stable-003-fix-003` | 44 | 0 | 0 |
| `rc-stable-003-fix-003-fix-001` | 26 | 0 | 0 |
| `rc-stable-006` (Finance polish + import preview) | 30 | 0 | 0 |
| `rc-stable-006-fix-001` (new) | 23 | 0 | 0 |

`rc-stable-006`'s `crossCheck()` helper encoded the old `Empty = rawLines.length -
linesEntered` formula; it was updated to mirror the new trailing-ignore rule so the
41-line fixture correctly asserts `41/41/0/0`. This is an untracked harness change only.

## 10. Build Verification

| Command | Exit code | Result |
| --- | --- | --- |
| `npm run lint` | 0 | eslint `src/ extension/` clean |
| `npm run typecheck` (`npx tsc --noEmit`) | 0 | clean |
| `npm run build` | 0 | `scripts/Companion.user.js` regenerated (version check OK) |
| `npm run build:arena` | 0 | `scripts/Companion.arena.user.js` regenerated |
| `npm run build:ext` | 0 | `extension/dist/` regenerated |

`extension/dist/content.js` content-verified to contain `wrap="off"`, `white-space: pre`,
`overflow-x: auto`, `lastMeaningful`; the old Empty formula is gone.

## 11. Browser Verification

Not executed in this session — **UNKNOWN**. Expected behaviour on a live GoldenBride page
(import the 41-line TXT):

- A long snippet occupies exactly one visual row; horizontal scrollbar appears when a
  line exceeds the editor width; vertical scrolling still works.
- The gutter shows one number per logical row (1..41), stays left-aligned and fixed when
  the textarea scrolls horizontally, and follows vertical scrolling.
- Preview shows `Lines: 41, Unique: 41, Duplicates: 0, Empty: 0` immediately after paste
  (previously `Empty: 1`).
- Import afterwards reports `Lines entered: 41, Unique snippets: 41, Messages created:
  41` — guaranteed by the unchanged pipeline.

## 12. Remaining Limitations

- The `Empty` rule is a preview convention; the importer itself has no trailing-empty
  policy and remains unchanged (it skips all empty lines during import regardless).
- jsdom cannot compute real layout, so "one visual row" is verified structurally
  (`wrap="off"` + `white-space: pre` + `overflow-x: auto`) and via the per-newline
  gutter numbering, not by pixel measurement.
- Horizontal scrollbar styling: only the WebKit scrollbar (`::-webkit-scrollbar`,
  8px) is customised; a horizontal scrollbar reuses the same style rule (Firefox may
  render a default scrollbar).

## 13. Unknowns

- Real-browser pixel-level wrapping/scrolling behaviour for very long lines: UNKNOWN
  (no live layout engine in the harness).
- Live preview numbers after pasting the actual 41-line TXT: UNKNOWN — expected
  `41/41/0/0` is verified logically (exact-same `normalizeSnippets` call) and by the DOM
  harness (B3), but not yet observed on a real page.
- Whether any browser renders a horizontal scrollbar outside the WebKit customisation on
  Windows: UNKNOWN until a live run.

## 14. Stable Release Readiness

- Implementation complete; lint, typecheck, build, arena build, and extension build all
  pass (exit 0).
- New harness 23/23; all required import regressions and the rc-stable-006 harness 0
  failures.
- No exported API changed; architecture and module boundaries preserved; Companion still
  never imports Finance internals; no new dependencies; no unrelated files modified.
- Open items: live-browser verification (Section 11), pending a user-run Chrome session.

## 15. Commit

- Baseline `HEAD`: `cd9eb5a872af8a461abb9604443fbb27e041f7b3`.
- Commit message: `RC-STABLE-006-FIX-001: preserve one visual row per snippet`
- Push `origin/master`; verify `HEAD == origin/master`.
