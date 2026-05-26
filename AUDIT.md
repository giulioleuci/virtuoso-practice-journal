# Virtuoso — Architecture Audit & Refactor Plan

> Goal: reduce code duplication, improve separation of responsibilities, and
> enforce clean separation between layers (data → service → hooks → UI).
> This plan is written to be executed step-by-step in a fresh session. Each
> task lists the exact files to touch, what to create, and how to verify.

## How to use this document

- Tasks are grouped into **phases**. Phases are ordered so that later phases
  build on infrastructure created by earlier ones.
- Each phase ends with a **verification** step (`npm run test`, `npm run lint`,
  `npm run build`, manual smoke test on `npm run dev`).
- Do **one task per commit** where practical. Keep diffs reviewable.
- The repo uses Dexie live queries as the primary data layer (see `CLAUDE.md`).
  The target architecture below preserves that — it does **not** introduce a
  new state library.

---

## 1. Current architecture (as-is)

```
src/
  lib/
    db.ts            ← schema + types + business logic (snapshots, cascade deletes, import/export)
    schemas.ts       ← Zod schemas + flattenErrors()
    recurrence.ts    ← date keys + task/lesson recurrence expansion
    services/        ← repository wrappers (tasks, sessions, library, collections,
                       studyRoutines, profile, subjects, lessons, helpRequests)
    i18n.tsx, constants.ts, subjectColors.ts, platform.ts, quotes.ts, icons.ts
  hooks/
    useEntities.ts   ← live-query wrappers (useSubjects, useLibrary, …)
    useFormDraft.ts, useKeyboardInset.ts, useAndroidBackButton.ts, use-toast.ts
  pages/             ← route components (Diary, Library, Lessons, Tasks, …)
  components/        ← feature components (diary/, library/, collections/, lessons/, profile/)
    ui/, shared/     ← shadcn primitives + shared bits
```

### Intended layering

```
UI (pages / components)
   │  uses hooks for reads, services for writes; no business logic
   ▼
hooks/useEntities.ts (live reads)        services/* (writes + complex reads)
   │                                          │
   └──────────────► db.ts (schema + Dexie tables only) ◄────────┘
```

### Where the layering breaks today

1. **Direct DB access from UI is pervasive.** 47 page/component files import
   `@/lib/db`, with **139 `db.<table>` call sites** in `pages/` + `components/`.
   Reads *and writes* bypass the hooks/service layers.
2. **`db.ts` is overloaded.** Besides schema + types it holds business logic:
   `buildSessionSnapshot`, `buildLessonSnapshot`, `deleteLibraryItem`,
   `deleteTaskPreservingHistory`, `deleteTasksPreservingHistory`, `exportAll`,
   `importAll`, `wipeAll`. Schema and behavior should not live together.
3. **Business logic lives in pages/components** (streaks, lesson-date math,
   analytics bucketing, session grouping, subject-layer resolution).
4. **Cross-cutting helpers are copy-pasted** (date keys, `computeStreak`,
   subject-layer resolution, pagination, delete-with-undo, sheet form lifecycle).

---

## 2. Findings

Severity: **H** = high (architectural / many call sites), **M** = medium,
**L** = low.

### 2.1 Layer separation — direct DB access in UI

> **Reads vs writes (verified).** The 139 `db.<table>` sites are *mostly reads*
> (`useLiveQuery(db.…)`). Writes are largely already routed through services —
> only **12 direct-write sites across 5 files** remain: `Tasks.tsx` 134/140 and
> `Library.tsx` 118/126/128 and `Collections.tsx` 63/65 (all in undo-restore
> paths → see D3), `SubjectsEditor.tsx` 416/443/450 (inline color updates), and
> `SessionFAB.tsx` 73/84 (task creation). So the dominant layering problem is
> **reads bypassing hooks**, not scattered writes.

| # | Severity | Location | Issue |
|---|---|---|---|
| L1 | H | 47 files / 139 sites in `pages/` + `components/` | UI imports `db` and runs `useLiveQuery(db.…)` reads directly, bypassing `useEntities`. |
| L1b | M | `Tasks.tsx` 134/140, `Library.tsx` 118/126/128, `Collections.tsx` 63/65, `SubjectsEditor.tsx` 416/443/450, `SessionFAB.tsx` 73/84 | 12 direct **write** sites in UI. Most are undo-restore (D3); `SubjectsEditor`/`SessionFAB` need new service methods. |
| L2 | H | `pages/Diary.tsx` 87–157, `Library.tsx` 51–66, `Lessons.tsx` 47–52, `Tasks.tsx` 50–52, `Collections.tsx` 31–35, `History.tsx` 38–48, `NewTaskPage.tsx` 46–84, `EditTaskPage.tsx` 25–32, `ItemAnalysisPage.tsx` 86–102 | Pages assemble multi-table reads inline instead of via hooks. |
| L3 | H | `components/diary/{SessionLogSheet,PracticeMode,StudyRoutineWizard,TaskWizard,LinkTargetFields}.tsx`, `components/library/NewLibraryItemSheet.tsx`, `components/collections/{AssignPiecesSheet,NewCollectionSheet}.tsx`, `components/profile/SubjectsEditor.tsx` | Feature components query and write to `db` directly. |
| L4 | M | `db.ts` 359–493 | Business logic (snapshot builders, cascade deletes, import/export/wipe) lives in the schema module. |

### 2.2 Separation of responsibilities — business logic in UI

| # | Severity | Location | Issue |
|---|---|---|---|
| R1 | H | `pages/Diary.tsx` 50–79 **and** `components/diary/StatsDashboard.tsx` 12–24 | `computeStreak` implemented **twice** with different signatures (`Session[]` vs `Set<string>`). |
| R2 | H | `pages/NewTaskPage.tsx` 127–172, `components/diary/TaskWizard.tsx` 134–153, `pages/Lessons.tsx` 113–126, `pages/Diary.tsx` 133 | "Next lesson date" computed in ≥3 places (two near-identical, one simpler). |
| R3 | H | `pages/{NewTaskPage,EditTaskPage}.tsx`, `components/diary/{EditTaskSheet,TaskWizard,SessionLogSheet,SessionDetailSheet,LastSessionStrip}.tsx` | `isTheorySubject ? [...THEORY_LAYERS] : (subject?.layers ?? [])` repeated in **7+ files**. |
| R4 | M | `pages/ItemAnalysisPage.tsx` 14–20, 106–168 | `weekKey` + weekly bucketing + per-layer scoring is analytics logic embedded in a page. |
| R5 | M | `pages/History.tsx` 64, 80–122 | Session grouping (by task/day/item/segment) is complex logic in the page. |
| R6 | M | `pages/Tasks.tsx` 29–43, 188–194 | `summarizeRecurrence`, `summarizeRoutineDays`, `totalPerWeek` defined in a page. |
| R7 | M | `components/diary/SessionLogSheet.tsx` 103–155 | Builds segment-metric maps + session payload inline (belongs in `sessionsService`). |
| R8 | L | `components/diary/StudyRoutineWizard.tsx` 64–70, 152–200 | Pool-key generation + group-pool manipulation in component (mirrors `studyRoutines.ts` `poolEntryKey`). |

### 2.3 Duplication — copy-pasted patterns

| # | Severity | Location | Issue |
|---|---|---|---|
| D1 | H | `recurrence.ts` 3 (`dayKey`), `components/diary/StatsDashboard.tsx` 8, `components/diary/TaskCalendarView.tsx` 9, `pages/NewTaskPage.tsx` 163, `components/diary/TaskWizard.tsx` 147, `pages/ItemAnalysisPage.tsx` 14 (`weekKey`), `lib/services/studyRoutines.ts` 34/41 (`formatDate`/`getWeekKey`) | The `YYYY-MM-DD` formatter is reimplemented **6–7 times**. Worse: `recurrence.ts` uses **local** time, `studyRoutines.ts` uses **UTC** — a latent off-by-one-day bug. |
| D2 | M | `pages/{Library,Diary,Tasks,Lessons,History}.tsx` | Pagination (`PAGE_SIZE`, `page`/`setPage`, `slice`, `totalPages`) reimplemented in 5 pages; `Library` and `Lessons` also define a local `Pager` component. |
| D3 | M | `pages/Library.tsx` 112–134, `pages/Collections.tsx` 54–71, `pages/Tasks.tsx` 132–143 | "Hard-delete + undo toast" pattern (snapshot object → service delete → toast with restore action) duplicated. |
| D4 | M | ~10 sheet components (`SessionLogSheet`, `NewLibraryItemSheet`, `AssignPiecesSheet`, `NewCollectionSheet`, `RecurrenceSheet`, `LessonLogSheet`, `TeacherRecapSheet`, `EditTaskSheet`, …) | Identical sheet lifecycle: prefill-on-open effect, reset-on-close effect, validate→save handler. |
| D5 | M | `lib/services/studyRoutines.ts` 24–59 vs `lib/recurrence.ts` 3–14 | Date helpers (`parseISODate`/`parseDayKey`, `addDays`, `formatDate`/`dayKey`, `todayStr`/`today`) duplicated across modules. |
| D6 | L | `pages/ItemAnalysisPage.tsx`, `components/diary/StatsDashboard.tsx`, `components/library/{BpmSparkline,MasterySparkline,MasterySliders}.tsx` | Hand-rolled SVG/chart math repeated; consolidate if analytics views grow. |

### 2.4 Service layer consistency

| # | Severity | Location | Issue |
|---|---|---|---|
| S1 | M | every `services/*.ts` + `useEntities.ts` | Soft-delete predicate `.filter((x) => !x.deletedAt)` is repeated in each `list()` and each read hook. No shared helper. |
| S2 | M | `services/library.ts`, `services/lessons.ts`, `services/profile.ts` (thin) vs `services/studyRoutines.ts` (447 lines, fat) | Inconsistent depth: some services are 1-line wrappers; `studyRoutines` mixes sampling algorithm + persistence. |
| S3 | M | `db.ts` 359–462 | Snapshot builders + cascade-delete helpers are imported *by* services (`sessions.ts`, `tasks.ts`, `library.ts`) but live in `db.ts`. They are service logic. |
| S4 | L | `services/*` | Timestamp (`createdAt`/`updatedAt`) and id handling are open-coded per service (`createdAt: Date.now()` scattered). |
| S5 | L | `db.ts` types vs `schemas.ts` | TS interfaces (`Task`, `Session`, …) and Zod schemas (`taskInputSchema`, `sessionInputSchema`) describe overlapping shapes independently; drift risk. Acceptable, but document the boundary (DB type = stored shape; Zod = form input shape). |
| S6 | M | `services/collections.ts` 54–60 (`listForItem`) & 63–68 (`listItems`) | Many-to-many link resolution (`collectionItems.where(...)` → map ids → `anyOf` → filter `!deletedAt`) duplicated. Extract `resolveMany(...)` helper into `_shared.ts`. |
| S7 | L | `services/subjects.ts` 9–14 (`remove`) & `services/lessons.ts` (`deleteLesson`) | Identical composite-delete transaction shape (`transaction("rw", parent, child, …)` → delete children by FK → delete parent). Candidate for a `cascadeDelete(parent, [{table, fk}])` helper. |
| S8 | L | all services | Method naming drift: `remove()` vs `delete()` vs `deleteRecurrence()`/`deleteLesson()`; `upsert()` vs split `create()`/`update()`. Standardize on `remove()` for deletes and pick one create/update convention. |
| S9 | M | `useEntities.ts` + components | Missing hooks force inline queries. Add `useTasksBySubjectAndDate`, `useRecurrencesBySubject`, `useCollectionsByKind` (used inline in `Diary.tsx`, `SessionFAB.tsx`, 5+ components). |

---

## 3. Target architecture (to-be)

```
src/lib/
  db.ts                         ← SCHEMA ONLY: table defs, migrations, `db` instance, TS interfaces
  date.ts            (NEW)      ← dayKey/today/parseDayKey/addDays/weekKey/startOfWeek (single source)
  domain/            (NEW)      ← pure domain logic, no Dexie:
    subjectLayers.ts            ← getSubjectLayers(subject)
    streak.ts                   ← computeStreak(daysWithSessions | Session[])
    lessonSchedule.ts           ← nextLessonDate(recurrences, opts)
    analytics.ts                ← itemAnalytics(sessions), groupSessions(...)
    snapshots.ts                ← buildSessionSnapshot/buildLessonSnapshot (moved from db.ts)
  services/
    _shared.ts         (NEW)    ← notDeleted() predicate, withTimestamps(), undo helpers
    *.ts                        ← all DB writes + complex reads; import domain/* for logic
  utils.ts                      ← cn() (unchanged)

src/hooks/
  useEntities.ts                ← all live reads (expand to cover every table)
  useSheetForm.ts    (NEW)      ← sheet open/prefill/reset/save lifecycle
  usePagination.ts   (NEW)      ← page state + slice + totalPages

src/components/shared/
  Pager.tsx          (NEW)      ← single pagination control
```

**Rules after refactor**

- UI may import: `@/hooks/*`, `@/lib/services/*`, `@/lib/domain/*` (pure),
  `@/lib/date`, `@/lib/schemas`, types from `@/lib/db`. UI must **not** call
  `db.<table>` for writes; reads go through `useEntities`.
- `services/*` may import `db`, `domain/*`, `date`, `schemas`.
- `domain/*` and `date.ts` are pure (no Dexie import) → trivially unit-testable.
- `db.ts` imports nothing from `services`/`domain`.

---

## 4. Implementation plan (phased)

### Phase 0 — Guardrails (do first)

- [ ] **0.1** Add an ESLint `no-restricted-imports` rule (or a `no-restricted-syntax`
  rule) that flags `db.<table>.{add,put,update,delete,bulkAdd,bulkPut,bulkDelete}`
  inside `src/pages/**` and `src/components/**`. Start as `warn` so the build
  stays green, flip to `error` at the end of Phase 5.
  - File: `eslint.config.js` (or `.eslintrc`).
- **Verify:** `npm run lint` runs and reports the expected warnings (this is the
  baseline backlog the later phases burn down).

### Phase 1 — Foundational pure modules (no behavior change)

- [ ] **1.1 Create `src/lib/date.ts`.** Move/centralize: `dayKey`, `today`,
  `parseDayKey`, `addDays`, `weekKey`, `startOfWeek` (Monday), `endOfWeek`.
  Decide **one** timezone convention (recommend **local**, matching
  `recurrence.ts`, since dates are user-facing day strings). Re-export the
  existing names from `recurrence.ts` for now to avoid a churny rename.
  - Replaces: `recurrence.ts` 3–14; `studyRoutines.ts` 24–59
    (`parseISODate`/`addDays`/`formatDate`/`getWeekKey`/`getMondayOfWeek`/
    `getSundayOfWeek`/`todayStr`); `ItemAnalysisPage.tsx` 14–20;
    `StatsDashboard.tsx` 8; `TaskCalendarView.tsx` 9; inline keys in
    `NewTaskPage.tsx` 163 and `TaskWizard.tsx` 147. (Fixes D1, D5.)
  - ⚠ When replacing `studyRoutines.ts` UTC helpers, confirm tests still pass —
    this is where the local/UTC discrepancy could shift a boundary day.
- [ ] **1.2 Create `src/lib/domain/subjectLayers.ts`** exporting
  `getSubjectLayers(subject: Subject | undefined): string[]` →
  `subject?.type === "theory" ? [...THEORY_LAYERS] : (subject?.layers ?? [])`.
  Replace the 7+ inline copies (R3 list).
- [ ] **1.3 Create `src/lib/domain/streak.ts`** with a single `computeStreak`.
  Pick one input shape (recommend `Set<string>` of day keys, with a helper
  `daysFromSessions(sessions)` ). Replace `Diary.tsx` 50–79 and
  `StatsDashboard.tsx` 12–24. (Fixes R1.)
- [ ] **1.4 Create `src/lib/domain/lessonSchedule.ts`** with
  `nextLessonDate(recurrences: LessonRecurrence[], opts?): string | undefined`
  built on `upcomingLessonDates`. Replace the inline logic in `NewTaskPage.tsx`
  127–172, `TaskWizard.tsx` 134–153, and reuse in `Lessons.tsx`/`Diary.tsx`.
  (Fixes R2.)
- **Verify:** add unit tests for each new module (`*.test.ts`, pure, fast).
  `npm run test` green; `npm run lint`; `npm run build`.

### Phase 2 — Move business logic out of `db.ts`

- [ ] **2.1 Create `src/lib/domain/snapshots.ts`** and move `buildSessionSnapshot`
  + `buildLessonSnapshot` there (they need `db` reads — acceptable for a domain
  module that reads, or place under `services/` if you want domain pure; keep
  them where their three callers — `sessions.ts`, `tasks.ts` — already import).
  Re-export from `db.ts` temporarily, then update imports.
- [ ] **2.2 Move cascade-delete + maintenance helpers** (`deleteLibraryItem`,
  `deleteTaskPreservingHistory`, `deleteTasksPreservingHistory`, `exportAll`,
  `importAll`, `wipeAll`) into the relevant services:
  - `deleteLibraryItem` → `libraryService.remove` body.
  - `deleteTask*` → `tasksService`.
  - `exportAll/importAll/wipeAll` → new `services/backup.ts` (used by
    `Profile.tsx`).
- [ ] **2.3** After moves, `db.ts` contains only: imports, types/interfaces,
  the `VirtuosoDB` class + migrations, and `export const db`. (Fixes L4, S3.)
- **Verify:** existing service tests (`tasks.test.ts`, `library.test.ts`,
  `sessions.test.ts`, `db.test.ts`) must still pass — they cover most of this
  behavior. Update import paths in tests.

### Phase 3 — Service-layer consistency

- [ ] **3.1 Create `src/lib/services/_shared.ts`:**
  - `notDeleted = <T extends { deletedAt?: number }>(x: T) => !x.deletedAt`
  - `liveActive(table)` style helper if useful.
  - `withCreated<T>(x): T & { createdAt }` / `withUpdated`.
  Replace the repeated `.filter((x) => !x.deletedAt)` in every service `list()`.
  (Fixes S1, S4.)
- [ ] **3.2 Split `studyRoutines.ts`** (447 lines): extract the pure sampling
  algorithm (`confidenceToWeight`, `computeWeights`,
  `weightedSampleWithoutReplacement`, `uniformSampleWithoutReplacement`,
  `buildTask`, `generate`) into `domain/studyRoutineGenerator.ts` (pure, takes
  resolved inputs). Keep `studyRoutinesService` as the thin persistence/IO shell
  (`create`/`regenerateFromDate`/`update`/`remove` + `resolvePoolEntries`).
  (Fixes S2.) This also lets `StudyRoutineWizard` import `poolEntryKey` from one
  place (R8).
- [ ] **3.3** Audit each service for a consistent surface: `list/get/byX/create/
  update/remove`. Standardize deletes on `remove()` (rename `deleteRecurrence`/
  `deleteLesson`), pick one create/update convention. (Fixes S8.) Promote
  misplaced page logic here (see Phase 5).
- [ ] **3.4** Add to `_shared.ts`: `resolveMany(linkTable, linkFK, ids,
  targetTable)` for the M2M pattern (S6) and `cascadeDelete(parentTable, id,
  children: {table, fk}[])` for the composite-delete pattern (S7). Adopt in
  `collections.ts`, `subjects.ts`, `lessons.ts`.
- [ ] **3.5** Add `now()` (≡ `Date.now()`) to `_shared.ts` (or `lib/date.ts`)
  and replace the 20+ scattered `Date.now()` calls in services so time is
  mockable in one place. (Fixes S4.)
- **Verify:** `npm run test` (services are well-covered); `npm run lint`.

### Phase 4 — Shared UI infrastructure

- [ ] **4.1 Create `src/components/shared/Pager.tsx`** — props
  `{ page, totalPages, onChange }`, renders prev/next + label. Replace the local
  `Pager` in `Library.tsx` 368 and `Lessons.tsx` 444, and the inline controls in
  `Tasks.tsx` 364–374, `History.tsx`, `Diary.tsx` 443/529. (Fixes D2.)
- [ ] **4.2 Create `src/hooks/usePagination.ts`** — `usePagination(items, size)`
  → `{ page, setPage, totalPages, pageItems, reset }`. Adopt in the 5 paginated
  pages. Standardize 0- vs 1-based indexing (recommend 0-based; `Tasks`/`History`
  already are).
- [ ] **4.3 Create `src/hooks/useSheetForm.ts`** — encapsulates the
  open→prefill, close→reset, validate→save lifecycle (D4). Signature sketch:
  ```ts
  useSheetForm<T>({ open, initial, prefill, schema, onSave })
  → { values, setField, errors, submit, submitting }
  ```
  Migrate sheets incrementally (start with `NewCollectionSheet`, the simplest).
- [ ] **4.4 Create `deleteWithUndo` helper** (in `_shared.ts` or a
  `useUndoableDelete` hook that wraps the toast). Signature:
  `deleteWithUndo({ remove, restore, message, toast })`. Adopt in `Library.tsx`,
  `Collections.tsx`, `Tasks.tsx`. (Fixes D3.)
- **Verify:** `npm run dev` — manually exercise pagination on Library/Tasks/
  History, open/close each migrated sheet, delete + undo a library item, a
  collection, and a task. Confirm no regressions.

### Phase 5 — Push reads through hooks, writes through services

Burn down the L1/L2/L3 backlog from the ESLint warnings. Per page/component:

- [ ] **5.1 Expand `useEntities.ts`** to cover every table needed by pages
  (`useLessons`, `useRecurrences`, `useAssignments`, `useCollections`,
  `useStudyRoutines`, `useHelpRequests`, `useTask(id)`, `useItem(id)`, …), plus
  the composed hooks that today force inline queries: `useTasksBySubjectAndDate`,
  `useRecurrencesBySubject`, `useCollectionsByKind` (S9). Each applies
  `notDeleted` where appropriate. This is the single read surface.
- [ ] **5.2** Replace inline `useLiveQuery(db.…)` in pages/components with these
  hooks. Order by size/risk: `Collections.tsx`, `EditTaskPage.tsx`,
  `Lessons.tsx`, `Tasks.tsx`, `Library.tsx`, `Diary.tsx`, `History.tsx`,
  `ItemAnalysisPage.tsx`, then the feature components.
- [ ] **5.3** Replace every UI **write** (`db.x.add/put/update/delete`) with a
  service call. Add service methods where missing (e.g.
  `sessionsService.groupSessions` for History R5, `libraryService.itemAnalytics`
  / a `domain/analytics.ts` for ItemAnalysisPage R4,
  `studyRoutinesService` summaries for Tasks R6).
- [ ] **5.4** Move remaining page logic: `SessionLogSheet` 103–155 →
  `sessionsService.logWithCompletion` already exists; route the metric-building
  through it (R7).
- [ ] **5.5** Flip the Phase 0 ESLint rule to `error`. The only remaining
  `@/lib/db` imports in UI should be **type-only** (`import { type Task }`),
  which the rule allows.
- **Verify:** `npm run lint` (zero violations), `npm run test`, `npm run build`,
  and a full manual pass of `npm run dev`: create/edit/delete tasks (incl.
  recurring), log a session (free / item+segments / collection / theory),
  library CRUD + segments, collections assign, lessons + recurrence + recap,
  study-routine wizard generate, history filters, item analysis charts, profile
  export/import.

---

## 5. New files summary

| File | Purpose | Replaces |
|---|---|---|
| `src/lib/date.ts` | Single date-key/util module | D1, D5 |
| `src/lib/domain/subjectLayers.ts` | `getSubjectLayers` | R3 |
| `src/lib/domain/streak.ts` | `computeStreak` | R1 |
| `src/lib/domain/lessonSchedule.ts` | `nextLessonDate` | R2 |
| `src/lib/domain/analytics.ts` | item analytics + session grouping | R4, R5 |
| `src/lib/domain/snapshots.ts` | snapshot builders (from db.ts) | L4, S3 |
| `src/lib/domain/studyRoutineGenerator.ts` | pure sampling algorithm | S2, R8 |
| `src/lib/services/_shared.ts` | `notDeleted`, `now()`, `resolveMany`, `cascadeDelete`, `deleteWithUndo` | S1, S4, S6, S7, D3 |
| `src/lib/services/backup.ts` | export/import/wipe | L4 |
| `src/components/shared/Pager.tsx` | pagination control | D2 |
| `src/hooks/usePagination.ts` | pagination state | D2 |
| `src/hooks/useSheetForm.ts` | sheet form lifecycle | D4 |

## 6. Sequencing & risk

- Phases 1–2 are **pure refactors with strong test coverage** → low risk, do
  first; they unblock everything else.
- Phase 5 is the largest (47 files) but each file is independent → ship in small
  batches behind the ESLint warning so partial progress is always green.
- The **one genuine behavior risk** is the local-vs-UTC date discrepancy
  surfaced in D1/D5 (`studyRoutines.ts` uses UTC, the rest local). Resolve
  deliberately in 1.1 with a test that pins boundary days (e.g. a session at
  23:30 local near a week boundary).

## 7. Done criteria

- No `db.<table>` write calls in `src/pages` or `src/components`
  (ESLint `error`, type-only `db` imports allowed).
- All reads in pages flow through `src/hooks/useEntities.ts`.
- `db.ts` contains schema + types + migrations only.
- Single implementation each of: date keys, `computeStreak`,
  `getSubjectLayers`, `nextLessonDate`, pagination, sheet lifecycle,
  delete-with-undo.
- `npm run test`, `npm run lint`, `npm run build` all green; full manual smoke
  pass complete.
</content>
</invoke>
