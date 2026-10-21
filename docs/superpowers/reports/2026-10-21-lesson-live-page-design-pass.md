# Live lesson page: design pass report

2026-10-21 · branch `lesson-live-page` · Task 5 of `docs/superpowers/plans/2026-10-21-lesson-live-page.md`

The live lesson page (`/lessons/live`) and its way back (the AppShell "Back to lesson" chip and the Diary banner) went through the impeccable sequence: shape, live variants, carbonize, adapt, harden, clarify, polish, audit, critique and the detector. The ledgers are in `.impeccable/pass/21-lesson-live-*.md` (git-ignored); the screenshots are in `.impeccable/pass/shots/21-lesson-live-*.png`.

## Shape brief (summary)

- **Scene:** a musician in a lesson, phone in one hand, typing short lines while the teacher talks (Operate mode). The page stays open for the whole lesson; they may leave for the weekly summary or questions and come back.
- **Primary action:** add a line to Homework or Notes with one tap, typing, and Enter. Every line is saved on Enter, and unsent text survives a reload, so there is no Save button.
- **Identity kept:** the Practice Taccuino (warm paper, terracotta as the only action color, serif titles, Inter controls, open ruled lists, 44px controls). No new buttons, cards, tabs or modals.
- **User requirements:** both add fields at the top of the screen, auto-growing fields (Enter adds, Shift+Enter breaks the line), entries newest first.

## Variants and the pick

Three `layout` variants were shown in the live browser at 390×844 (session `51f1ab9f`):

1. **Capture first** (structure): a compact header, then both add fields together under small sans labels, then a rule, then the Homework and Notes entries under serif headings.
2. **Compact ledger** (density): each list keeps its own field at the top of its section, with tighter metadata.
3. **Paged panes** (topology): Homework and Notes as swipeable panes, with two columns from 1151px.

**The user picked variant 1 at density 1 and split 2.** It was carbonized in JSX rather than copying the preview's CSS trick, so DOM order equals visual order. `LessonEntryList.tsx` now exports two parts: `LessonEntryField` (label, auto-growing field, draft persistence, double-submit guard) and `LessonEntryList` (entries newest first, edit in place, delete with Undo). Field labels are real `<label>` elements in the Inter label style, and each textbox's accessible name is its visible label. Each list sits under a real `h2` in the serif title style (1.25rem, 600). A list stays hidden until it has an entry, and the rule hides with it. No live-mode leftovers, inline styles or `index.css` rules remain; `live-complete` reported `completed` and `index.html` is unchanged.

## What each pass found and fixed

| Pass | Found | Fixed |
|---|---|---|
| adapt | At 1280px desktop, lines ran to about 130 characters. On phones, the chip row made the bottom nav 117px tall, against 112px of main padding, a 72px `--navigation-height`, and a hard-coded 84px offset for the Diary selection bar, so the bar overlapped the chip. | Live page capped at `max-w-2xl` (about 80ch). While the chip shows, AppShell sets `--navigation-height` to 72px + 2.75rem (0 from 700px) and the main bottom padding to 9.75rem; FloatingActions reads the variable. Measured: an 11px gap between the selection bar and the nav. |
| harden | 40 notes + 40 homework, 230-character lines, unbroken URLs, emoji, German compounds: no overflow. A forced storage failure kept the text. Deleting a row dropped focus to the page. | Focus moves to the neighbouring row on delete. The flaky "editing a note" test was traced to React mirroring a controlled textarea's value into its text content, and the test now waits for the saved row. |
| clarify | A failed add or edit said only "Could not save", with no recovery. Adds were silent for screen readers. | New `lessonLive.notSaved` in en/it/es/de ("Not saved. Your text is still there: try again."). A polite status says "Added: …" after each add, reusing `toast.added`. |
| polish | An edit opened with the caret at the start. Chrome flagged the date input as a form field without a name. On the weekly summary in German at 390px, "Zurück" broke mid-word. | The caret opens after the text; the date input has `name="date"`; the Back link no longer shrinks. |
| audit | A11y 3, performance 4, theming 4, responsive 4, integrity 4: **19/20**. | Remaining: deleting the last row of a list still drops focus, because the list hides. |
| critique | **32/40**, single-context (sub-agents not allowed for this task). | Both P2s fixed: delete focus and silent add. The open items are listed below. |
| detector | `impeccable detect --json src` found the same 5 Inter (`overused-font`) warnings in `src/index.css` as the previous pass, and 0 findings in the changed files. The browser overlay reported Inter and the cream palette, both the accepted identity. | Nothing to fix. |

Product fix carried in this pass: the Diary banner says "Resume lesson" only when the lesson in progress is the banner's own slot today. Otherwise it starts today's lesson for that slot, and the shell's chip remains the general way back.

DESIGN.md gains two component notes: **Capture field** (Inputs) and **Back to lesson** (Navigation).

## Verification

- Chromium (chrome-devtools) at 390×844, 320×640, 768×1024, 1280×800 and 844×390 landscape: no horizontal scroll, no control under 44px, label contrast 6.8:1.
- **Flow checks:** a note and a homework added with Enter, newest first; a Shift+Enter two-line draft restored after a reload; to the weekly summary and back with the chip, draft intact; the Diary banner "resume" and "log" states; delete with Undo.
- **German on a phone:** the flow checks above ran in German at 390×844, plus a German check at 320×640.
- **Tests:** new tests cover Enter vs Shift+Enter, newest-first order, lists hidden while empty, a legacy string in `notes`, a failed add keeping its text, the caret after the text on edit, delete focus, and the Diary banner with another lesson in progress.
- **Gates:** `npx tsc --noEmit` passes; `npm run ci` passes with lint, four-language validation, 98 files / 631 tests and the production build. One intermediate full run failed only the known load-sensitive StudySetup "Staccato" lookup, which passes 3/3 in isolation, and the next full run was green.

## Open items

- With the keyboard open, the header (246px at 390px) leaves little room for the newest entries under the Notes field. The compact header was the accepted density; it needs checking on a real phone, which was not available here.
- Finish has no closing moment (for example "Lesson saved: 3 homework, 4 notes"). This is a product decision.
- At 320px in German, empty fields take two lines because the field sizes itself to the placeholder. Accepted.
- Deleting the last row of a list drops focus, because the list hides.
- With the chip shown, `scroll-padding-bottom` (7rem on `html`) is about 4px short of the taller nav.
- The weekly summary's Back link goes to History, not back to the lesson; the chip covers the return.
- Real Android/iOS soft keyboards, Safari, and the older-WebView fallback for `field-sizing` were not tested.
