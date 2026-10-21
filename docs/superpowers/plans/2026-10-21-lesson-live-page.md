# Lesson Live Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Registra lezione" sheet with a page that stays open for the whole lesson, with separate editable lists of homework and generic notes, crash-safe persistence and a way back from the weekly summary.

**Architecture:** Every homework or note is written to Dexie the moment it is added (`ensureFor` creates the lesson on first write). Unsent input text lives in localStorage. A "lesson in progress" pointer in localStorage drives the Diary banner and an AppShell chip on every other page. Homework reuses `assignments`; notes become `Lesson.notes: LessonNote[]`.

**Tech Stack:** React 18, React Router v6, Dexie, Vitest + fake-indexeddb, Tailwind/shadcn, i18n JSON (en/it/es/de).

**Spec:** approved design in the chat of 2026-10-21 (reproduced in "Global Constraints"). No separate spec file.

## Global Constraints

- Route: `/lessons/live` with search params `lesson=<id>` (existing lesson) **or** `recurrence=<id>|subject=<id>` plus `date=YYYY-MM-DD`.
- `Lesson.notes?: LessonNote[]` where `LessonNote = { id: string; text: string }` replaces `notes?: string`. No data migration: update fixtures, reject nothing else. Backup stays version 4; `importBackup.ts` only checks table names, confirm no lesson field validation exists.
- Homework uses the existing `assignments` table and `lessonsService.addAssignment/updateAssignment/removeAssignment`.
- Buttons on the page: weekly summary (`/print/weekly?subject=<subjectId>`) and open questions (`TeacherRecapSheet`). Nothing else.
- Pointer key `virtuoso-lesson-live`, unsent text key `virtuoso-lesson-draft-<scope>`. Both must be wiped by the existing explicit data wipe next to `clearSessionDrafts`.
- Diary `LessonTodayBanner` loses `HomeworkInput`; it keeps one primary action (**Registra lezione**, **Riprendi lezione** when the pointer exists) plus the existing questions/summary links.
- `LessonLogSheet.tsx` and its test case are deleted.
- All copy in four languages; `npm run i18n:validate` must pass. Tap targets at least 44px (`min-h-11`).
- Project rules: services hold DB operations, hooks in `src/presentation/hooks/useEntities.ts`, Tailwind classes not `index.css`, commit with `git commit -- <paths>` (index has user-staged deletions).

## Review Focus

- Typed-but-unsent text survives a reload: draft restored into the input on mount.
- Adding a note when the lesson row does not exist yet creates exactly one lesson (double Enter, two fast adds).
- Editing a note to empty text removes nothing silently: empty edit is rejected, delete is a separate action with undo.
- Changing the date on a not-yet-created lesson only changes the URL param; on an existing lesson it moves the row and a collision with another lesson of the same slot and day is refused with an error.
- Pointer pointing to a lesson/recurrence that was deleted: banner and chip must clear it instead of linking to a dead page.

---

### Task 1: Notes as a list in the lesson model

**Files:**
- Modify: `src/domain/entities/lesson.ts`, `src/domain/ports/lesson.ts`, `src/infrastructure/repositories/dexie/lessonRepository.ts`
- Modify: `src/lib/sampleData.ts` (lesson `notes` at the two `db.lessons.add` calls near lines 438 and 465), `src/pages/Lessons.tsx:212`
- Test: `src/lib/services/lessons.test.ts`

**Interfaces:**
- Produces: `interface LessonNote { id: string; text: string }`; `Lesson.notes?: LessonNote[]`.
- Produces on `lessonRepository` / `LessonPort`:
  - `log(subjectId, recurrence, date): Promise<number>` (drops the `notes` param; keeps `assignmentTexts?: string[]` as 4th)
  - `addNote(lessonId: number, text: string): Promise<string>` returns the new note id, `""` for blank text
  - `updateNote(lessonId: number, noteId: string, text: string): Promise<void>` ignores blank text
  - `removeNote(lessonId: number, noteId: string): Promise<void>`
  - `setDate(lessonId: number, date: string): Promise<void>` throws `Error("lesson-exists")` when another lesson has same `subjectId`, `recurrenceId` and `date`
  - `updateLesson` is removed.

- [ ] **Step 1: Update the tests** in `lessons.test.ts`: drop the `notes` argument from every `log(...)` call, delete the `updateLesson` describe, add tests `addNote trims and stores`, `addNote ignores blank`, `updateNote changes only that note`, `removeNote leaves the others`, `setDate moves the lesson`, `setDate refuses a same slot and day`.
- [ ] **Step 2:** `npx vitest run src/lib/services/lessons.test.ts` — expect FAIL (methods missing).
- [ ] **Step 3: Implement** the entity, port and repository changes. Note ids via `crypto.randomUUID()`. `setDate` uses the same lookup as `ensureFor`.
- [ ] **Step 4:** Fix compile fallout: `sampleData.ts` fixtures become `notes: [{ id: "n1", text: "…" }]`; `Lessons.tsx:212` renders `l.notes` joined with ` · ` inside the same `<p>`.
- [ ] **Step 5:** `npx vitest run src/lib/services && npx tsc --noEmit` — expect PASS except `LessonLogSheet.tsx` (deleted in Task 4; leave tsc error for it only).
- [ ] **Step 6: Commit** `feat(lessons): keep lesson notes as a list`, paths explicit.

### Task 2: Lesson-in-progress pointer and unsent drafts

**Files:**
- Create: `src/lib/liveLesson.ts`, `src/presentation/hooks/useLiveLesson.ts`
- Modify: the data-wipe site that calls `clearSessionDrafts` (grep for it) to also call `clearLiveLesson()`
- Test: `src/lib/liveLesson.test.ts`

**Interfaces:**
- Produces in `liveLesson.ts`: `readLiveLesson(): string | undefined` (a `/lessons/live?...` path), `setLiveLesson(path: string): void`, `clearLiveLesson(): void`, `readLessonDraft(scope: string): string`, `writeLessonDraft(scope: string, text: string): void`, `clearLiveLesson()` also removes every `virtuoso-lesson-draft-` key. All wrap `localStorage` in try/catch. Writers dispatch `window` event `virtuoso-live-lesson`.
- Produces: `useLiveLesson(): string | undefined` via `useSyncExternalStore`, subscribed to `virtuoso-live-lesson` and `storage`.

- [ ] **Step 1: Test** `set then read returns the path`, `clear removes pointer and drafts`, `draft round-trips and blank removes the key`, `read survives a throwing localStorage`.
- [ ] **Step 2:** run the test, expect FAIL; **Step 3:** implement; **Step 4:** expect PASS.
- [ ] **Step 5: Commit** `feat(lessons): persist the lesson in progress pointer`.

### Task 3: The live lesson page

**Files:**
- Create: `src/pages/LessonLive.tsx`, `src/components/lessons/LessonEntryList.tsx`
- Modify: `src/pages/Index.tsx` (lazy route `lessons/live` placed before `lessons/assignments`), `src/components/AppShell.tsx` (`WIDE_PAGES` untouched; add `/lessons/live` to the `onForm` check so the bottom nav gives way to the input bar), `src/lib/language/{en,it,es,de}.json`
- Test: `src/pages/LessonLive.test.tsx`

**Interfaces:**
- Consumes: Task 1 repository methods, Task 2 `setLiveLesson/readLessonDraft/writeLessonDraft/clearLiveLesson`, `useLessons`, `useAssignmentsForLesson`, `useRecurrences` (grep `useEntities.ts` for the exact name), `TeacherRecapSheet`.
- Produces: `LessonEntryList` props `{ title: string; placeholder: string; addLabel: string; entries: { id: string | number; text: string }[]; draftScope: string; onAdd(text: string): Promise<unknown>; onEdit(id, text: string): Promise<unknown>; onRemove(id): Promise<unknown>; onRestore?(text: string): Promise<unknown> }`. One component serves both lists.
- Default export `LessonLive`. On mount calls `setLiveLesson(location.pathname + location.search)`. Resolves context from the params as in Global Constraints; the lesson row is looked up reactively from `useLessons()` by `(subjectId, recurrenceId, date)` so it appears after the first write. Writes go through `lessonsService.ensureFor(...)` first.
- Header: teacher, subject, date input (behaviour per Review Focus), button **Termina lezione** (clears pointer, `navigate("/lessons")`).
- Action row: **Riepilogo settimanale** (`Link` to `/print/weekly?subject=`), **Domande** (opens `TeacherRecapSheet`, with open-count badge like `LessonExtraActions`; reuse that component instead of rebuilding if it fits).
- i18n keys (all four languages): `lessonLive.title`, `lessonLive.homework`, `lessonLive.notes`, `lessonLive.addNote`, `lessonLive.notePlaceholder`, `lessonLive.finish`, `lessonLive.resume`, `lessonLive.backToLesson`, `lessonLive.dateTaken`, `lessonLive.removed` (toast with undo). Reuse `homework.add`, `homework.textPlaceholder`, `common.edit`, `common.delete`, `lessons.questionsShort`, `lessons.summaryShort`.

- [ ] **Step 1: Tests** (real Dexie via `fake-indexeddb`, same harness as `LessonSheets.test.tsx`): `adding a note creates the lesson and lists the note`, `two quick adds create one lesson`, `editing a note updates it and an empty edit is rejected`, `deleting a homework removes it and undo restores it`, `unsent text is restored after remount`, `date change on an existing lesson moves it, collision shows an alert`, `deleted recurrence in the pointer clears the pointer`.
- [ ] **Step 2:** run, expect FAIL; **Step 3:** implement component, page, route, i18n; **Step 4:** run test + `npm run i18n:validate`, expect PASS.
- [ ] **Step 5: Commit** `feat(lessons): live lesson page with homework and notes`.

### Task 4: Wire entry points, return chip, remove the sheet

**Files:**
- Modify: `src/pages/Diary.tsx` (`LessonTodayBanner`, lines ~656-690; drop `HomeworkInput` import if unused elsewhere), `src/pages/Lessons.tsx` (`openLog`, `openEditLesson`, state `logOpen/logContext`, the router-state effect, the `<LessonLogSheet>` block), `src/components/AppShell.tsx` (chip), `src/components/lessons/LessonExtraActions.tsx` untouched
- Delete: `src/components/lessons/LessonLogSheet.tsx`; remove its test case from `LessonSheets.test.tsx`; delete `HomeworkInput.tsx` and its test only if no other importer remains (grep first)
- Test: `src/pages/Diary.test.tsx`, `src/pages/Lessons.test.tsx`, `src/test/appNavigation.test.tsx`

**Interfaces:**
- Consumes: `useLiveLesson`, route and param contract from Task 3.
- Produces: helper `liveLessonPath({ lessonId?, recurrenceId?, subjectId?, date? }): string` in `src/lib/liveLesson.ts` (add the export and a one-line test in `liveLesson.test.ts`).

- [ ] **Step 1: Tests**: Diary banner has no homework input and shows `lessonLive.title` button that navigates to `/lessons/live?recurrence=<id>&date=<today>`; with a pointer set it reads `lessonLive.resume`; Lessons page edit icon navigates to `?lesson=<id>`; AppShell shows `lessonLive.backToLesson` on `/print/weekly` when a pointer is set and not on `/lessons/live`.
- [ ] **Step 2:** run, expect FAIL; **Step 3:** implement; chip sits above the mobile nav and in the sidebar, validates the pointer (recurrence/lesson still exists, else `clearLiveLesson()`).
- [ ] **Step 4:** `npx tsc --noEmit && npm run lint && npx vitest run` — expect all PASS.
- [ ] **Step 5: Commit** `feat(lessons): open the live page from the diary and lessons, add the return chip`.

### Task 5: Design pass with impeccable

Same sequence as the last commits (`docs/superpowers/reports/2026-10-20-impeccable-full-app-pass.md`, `.impeccable/pass/`).

- [ ] **Step 1:** `impeccable shape` for the page (Operate mode, phone in hand during a lesson, fast typing, two lists, return path). Record brief in `.impeccable/pass/`.
- [ ] **Step 2:** `impeccable live` / `generate` three variants of the page header + two lists in the real browser at phone width; user picks; carbonize the pick into Tailwind classes (not `index.css`).
- [ ] **Step 3:** `adapt` (phone, tablet, desktop, landscape), `harden` (long text, 40 notes, empty state, storage failure), `clarify` (copy in 4 languages incl. German length), `polish`, `quieter`/`bolder` only if critique asks.
- [ ] **Step 4:** `audit` + `critique` + detector; fix findings; update `DESIGN.md` if a new component pattern appears.
- [ ] **Step 5:** `npm run ci` and `npx tsc --noEmit`; verify in devtools: add note, add homework, reload mid-lesson, go to weekly summary and back with the chip, Diary banner, German on a phone.
- [ ] **Step 6: Commit** `feat(ui): design pass for the live lesson page`, append the pass report, update memory file `redesign-port-progress` only if relevant.

## Self-review

- Coverage: 1 page → T3; 2 notes and homework edit/delete → T1/T3; 3 Diary box → T4; 4 summary buttons and return → T3/T4; 5 persistence and resume → T2/T3/T4; impeccable → T5.
- Names match across tasks: `LessonNote`, `addNote/updateNote/removeNote/setDate`, `setLiveLesson/readLiveLesson/clearLiveLesson/useLiveLesson/liveLessonPath`, `LessonEntryList`.
