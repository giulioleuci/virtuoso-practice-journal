# Clean Architecture Lite Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Virtuoso from `presentation -> lib/Dexie` to Clean Architecture Lite without changing local-first behavior, and add tests that permanently enforce the boundary.

**Architecture:** Domain contains entities and ports. Application use cases orchestrate ports and return command results or query DTOs. Infrastructure implements ports with Dexie and browser/native APIs. Presentation consumes application-facing adapters only. Migrate vertical slices so each commit preserves working behavior.

**Tech Stack:** React 18, TypeScript, Vite, Dexie, `fake-indexeddb`, Vitest, ESLint, React Hook Form, Zod.

## Global Constraints

- This is a heavy refactor toward **Clean Architecture Lite**; preserve IndexedDB schema/data and all user-visible behavior.
- Mandatory discovery: index/use `codebase-memory-mcp` (`search_graph` -> `trace_path` -> `get_code_snippet`) and use Caveman ($Caveman) for compact inspection. If Caveman is unavailable, report it and use only narrow graph snippets.
- Dependency direction: `presentation -> application -> domain`; infrastructure implements ports and is never imported by presentation.
- Only `src/infrastructure/**` may import Dexie, `dexie-react-hooks`, `db`, table names, `FileReader`, `Blob`, object URLs, or Capacitor file APIs.
- Preserve soft deletion, immutable session/lesson snapshots, recurring-task generation, and backup transactional rollback.
- TDD every behavior. Run focused tests per task; final gate: `npm run ci`.

## Planned Structure

| Path | Responsibility |
|---|---|
| `src/domain/{entities,constants,ports}` | Models and contracts independent of persistence and UI. |
| `src/application/{useCases,queries}` | Commands, orchestration, query DTOs. |
| `src/infrastructure/{dexie,repositories,gateways}` | Schema, transactions, Dexie implementations, browser/native adapters. |
| `src/presentation/hooks` | React adapters over application contracts, not Dexie. |
| `src/test/{fakes,architecture}` | Fake ports and permanent dependency-boundary tests. |

---

### Task 1: Lock the boundary before moving code

**Files:** Modify `AGENTS.md`, `eslint.config.js`; create `src/test/architecture/import-boundaries.test.ts`.

- [ ] Write a failing architecture test which enumerates `src/pages`, `src/components`, and presentation hooks and rejects imports of `@/lib/db`, `dexie`, `dexie-react-hooks`, `@/infrastructure/`, `FileReader`, `Blob`, `URL.createObjectURL`, and Capacitor filesystem modules.
- [ ] Run `npx vitest run src/test/architecture/import-boundaries.test.ts`; record the audit's current offenders as an explicit temporary baseline, so new violations fail immediately.
- [ ] Add ESLint `no-restricted-imports` overrides: domain/application exclude React/Dexie/browser APIs; presentation excludes persistence/infrastructure/native APIs.
- [ ] Re-run `npx vitest run src/test/architecture/import-boundaries.test.ts && npm run lint`; expect PASS with only the documented baseline.
- [ ] Commit: `chore: enforce clean architecture boundaries`.

### Task 2: Extract models and create ports

**Files:** Modify `src/lib/db.ts`; create `src/domain/entities/{task,session,library,lesson,collection,profile,common}.ts`, `src/domain/constants/theoryLayers.ts`, `src/domain/ports/{task,session,library,lesson,collection,profile,backup}.ts`, and `src/domain/domain-boundaries.test.ts`.

- [ ] Write failing tests that domain imports no React, Dexie, browser APIs, or `@/lib/db`.
- [ ] Using graph traces for model consumers, extract the current shapes of `Task`, `TaskRecurrence`, `Session`, `SessionSnapshot`, `Lesson`, `LessonSnapshot`, library/collection/profile types, `NoteVal`, `SegmentMetric`, `SessionQuality`, and `THEORY_LAYERS` to domain with compatibility re-exports during migration.
- [ ] Define ports from real workflows: task active/date reads, create/update/remove/carry-over; session snapshot logging/deletion; library/lesson/collection/profile queries; and backup import/export transaction support. Ports expose domain types, never Dexie tables.
- [ ] Retain schema, versions, indexes, and migrations in the legacy DB facade until the Dexie repository tests exist.
- [ ] Run `npx vitest run src/domain/domain-boundaries.test.ts && npm run lint`; commit `refactor: extract domain contracts from dexie`.

### Task 3: Isolate all Dexie operations in repositories

**Files:** Modify `src/lib/db.ts`, `src/test/setup.ts`; create `src/infrastructure/dexie/db.ts`, `src/infrastructure/repositories/dexie/{task,session,library,lesson,collection,profile,backup}Repository.ts`, and co-located repository tests.

- [ ] Write failing `fake-indexeddb` tests: active lists exclude `deletedAt`; a task with sessions soft-deletes and one without sessions hard-deletes; bulk removal returns `{ soft, hard }`; recurrence writes atomically; session logging creates immutable snapshots and completes the task.
- [ ] Move schema construction/migrations unchanged to `src/infrastructure/dexie/db.ts`; preserve database name, versions, indexes, and upgrade behavior.
- [ ] Implement repositories one at a time. Every table name, predicate, join, `db.transaction`, and rollback belongs in infrastructure.
- [ ] Add rollback tests for task/session/help-request logging and backup import by failing a second write and asserting no partial first write remains.
- [ ] Run `npx vitest run src/infrastructure/repositories/dexie`; commit `refactor: isolate Dexie repositories`.

### Task 4: Replace task/session/routine services with application use cases

**Files:** Modify `src/lib/services/{tasks,sessions}.ts` and routine modules found by graph tracing; create `src/application/useCases/{createTask,updateTask,removeTask,logSession,deleteSession,generateStudyRoutine}.ts`, their tests, and `src/test/fakes/{FakeTaskRepository,FakeSessionRepository}.ts`.

- [ ] Write failing fake-port tests for recurrence generation/empty result failure, soft-vs-hard removal, carry-over, logging completion plus optional help request, and reset-after-last-session deletion.
- [ ] Implement constructor-injected use cases. `LogSessionUseCase.execute(task, input)` must create an effective-input snapshot, write a session, complete the task, and add a help request transactionally.
- [ ] Turn legacy service exports into temporary thin adapters over the composition root; migrate callers with graph inbound traces. Application imports neither `db`, React, Zod form hooks, nor browser APIs.
- [ ] Move study-routine validation, pool selection, matrix generation, and persistence to `GenerateStudyRoutineUseCase` before splitting the wizard JSX.
- [ ] Run `npx vitest run src/application/useCases src/lib/services/tasks.test.ts src/lib/services/sessions.test.ts`; commit `refactor: move task and session workflows to use cases`.

### Task 5: Isolate backup file handling and migrate Profile

**Files:** Modify `src/lib/services/backup.ts`, `src/pages/Profile.tsx`; create `src/application/useCases/{exportBackup,importBackup}.ts`, `src/domain/ports/BackupFileGateway.ts`, `src/infrastructure/gateways/{BrowserBackupFileGateway,CapacitorBackupFileGateway}.ts`, and tests.

- [ ] Write failing use-case tests for version/format validation, export, malformed input, and transactional rollback using fake repositories/gateway without rendering `Profile`.
- [ ] Implement `ImportBackupUseCase`/`ExportBackupUseCase` for validation, transformation, and transactions only. Implement file picking, `FileReader`, Blob/object-URL download, and Capacitor access only in infrastructure gateway adapters.
- [ ] Refactor `Profile` to invoke presentation commands and render their progress/result state; remove direct native/browser access and its boundary-test baseline entry.
- [ ] Run `npx vitest run src/application/useCases/backup.test.ts src/infrastructure/gateways`; commit `refactor: isolate backup file handling`.

### Task 6: Replace direct presentation reads/writes slice by slice

**Files:** Modify `src/hooks/useEntities.ts` and every audit-listed presentation offender; create `src/application/queries/{task,session,library,lesson,collection,profile}Queries.ts`, `src/presentation/hooks/useEntities.ts`, `src/infrastructure/dexie/subscribe.ts`, and hook tests.

- [ ] Write failing adapter tests covering task date/range, item/segment, collection, history/session, lesson, and profile DTO updates after a fake subscription notification.
- [ ] Define query DTOs for UI joins; presentation may use a React adapter but infrastructure exclusively contains the Dexie subscription mechanism.
- [ ] Migrate direct-Dexie offenders in vertical feature slices: collections; diary components/pages; lessons; library; remaining pages. Use graph traces for each caller and remove its baseline entry in the same commit.
- [ ] Delete the old direct-Dexie hook implementation only after all callers move; graph-query remaining presentation imports of `db`, Dexie, and `dexie-react-hooks` to prove each count is zero.
- [ ] Run `npx vitest run src/presentation/hooks src/test/architecture/import-boundaries.test.ts && npm run lint` after each slice; commit `refactor: migrate <feature> presentation boundary`.

### Task 7: Simplify only after data boundaries are in place

**Files:** Modify `src/components/diary/{SessionLogSheet,StudyRoutineWizard}.tsx`, `src/pages/{Profile,Tasks,NewTaskPage,Lessons,Library}.tsx`; create focused controller hooks/sections and `src/components/shared/FeatureEmptyState.tsx` with tests.

- [ ] Write failing controller tests for session submission/error/reset, routine-wizard steps/output, and backup command state transitions; mock application commands, never Dexie.
- [ ] Extract controller hooks, then presentational sections. Reuse `components/shared/Pager.tsx` in `StudyRoutineWizard`; keep `SessionLogSheet` persistence in `LogSessionUseCase`.
- [ ] Replace the audit-confirmed duplicate `EmptyLessons`/`EmptyLibrary` with parameterised `FeatureEmptyState({ icon, title, description, action })`; retain distinct shadcn ellipsis primitives.
- [ ] Consolidate form-sheet/confirmation/async-state presentation utilities only when feature tests prove behavior equivalence; do not reintroduce business logic to components.
- [ ] Run relevant component/page suites plus lint; commit `refactor: simplify presentation orchestration`.

### Task 8: Safely remove legacy code and certify completion

**Files:** Delete/modify only after validation: legacy `src/lib/services/*`, compatibility `src/lib/db.ts` exports, audit candidates in `src/lib/services/_shared.ts`, `src/hooks/useFormDraft.ts`, `src/pages/{Tasks,Library}.tsx`; update `architectural_audit_report.md` with closure evidence.

- [ ] For audit candidates (`onClick`, `saveDraft`, `totalPerWeek`, both `toast` wrappers), use `search_graph`/`trace_path` plus a TypeScript-aware reference check; do not delete framework callbacks or test-support code based on graph degree alone.
- [ ] Add/update focused tests before each confirmed observable deletion. Remove only zero-reference symbols with green affected tests; otherwise retain or make private.
- [ ] Retire compatibility adapters/re-exports only after the graph proves there are no importers; move final tests to domain/application/infrastructure homes.
- [ ] Remove the architecture baseline and assert `[]`; re-index and save graph evidence of zero forbidden presentation imports.
- [ ] Run `npm run ci`; expect lint, i18n validation, all unit/integration/architecture tests, and production build to pass. Commit `refactor: complete clean architecture lite migration`.

## Completion Criteria

- [ ] Presentation imports no `db`, Dexie, `dexie-react-hooks`, infrastructure path, or browser/native file API.
- [ ] Domain/application are independent of React, Dexie, and browser/native APIs.
- [ ] UI mutations use named application use cases; Dexie repositories exclusively own table operations and transactions.
- [ ] Tests cover fake-port application rules, Dexie soft deletes/recurrence/snapshots/rollback, and permanent import boundaries.
- [ ] `npm run ci` passes and the audit report contains closure evidence.
