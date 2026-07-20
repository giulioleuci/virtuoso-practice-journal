# Task 3 report: isolate Dexie repositories

## Graph evidence

Used codebase-memory-mcp `search_graph`, then `trace_path`, then `get_code_snippet`.

- `tasksService.deleteTasksPreservingHistory` callers: `removeSeries`, `bulkRemove`, Tasks page.
- `sessionsService.logWithCompletion` callers: Diary, SessionFAB, SessionLogSheet; callees included snapshot/timestamp work.
- `backupService.importAll` callers: Profile import paths.
- Snippets identified Dexie predicates, joins, and transactions in task, session, library, lesson, collection, profile, and backup services.

## RED / GREEN

- RED: repository contract suite initially failed resolving missing `taskRepository`/`sessionRepository` modules.
- GREEN: `npx vitest run src/infrastructure/repositories/dexie` passes 7 tests.

## Behavior and rollback coverage

- Active task lists exclude `deletedAt` rows.
- Task removal soft-deletes with sessions; hard-deletes otherwise; bulk reports `{ soft, hard }`.
- Recurrence multi-write is transactional: failed second write leaves no root task.
- Session logging writes immutable snapshot and completes task.
- Help-request write failure rolls back session and task completion.
- Backup duplicate second library write rolls back prior table replacement.
- Existing service suites: 84 tests across task/session/library/lesson/collection/profile/backup pass.

## Changed files

- `src/infrastructure/dexie/db.ts`: exact `virtuoso` schema, versions 1–11, stores and migrations moved intact.
- `src/infrastructure/repositories/dexie/*Repository.ts`: task, session, library, lesson, collection, profile, backup ownership.
- `src/infrastructure/repositories/dexie/repositories.test.ts`: fake-indexeddb repository tests.
- `src/lib/db.ts`: legacy types/db facade only.
- `src/lib/services/*`: compatibility service delegates.
- `src/lib/domain/snapshots.ts`: delegates snapshot reads to infrastructure.

## Verification

- `npx vitest run src/infrastructure/repositories/dexie` — passed, 7 tests.
- Existing focused service suites — passed, 84 tests.
- `npm run lint` — exit 0; 80 pre-existing presentation-boundary warnings.
- `npm run build` — passed.

## Concerns

- Existing presentation/direct-Dexie warnings remain baseline work outside Task 3.
- Legacy `@/lib/db` facade remains for existing callers; Dexie class/schema implementation is infrastructure-owned.

## Correction addendum

- Added typed ports and Dexie repositories for help requests, pending assignments, subjects/techniques, and study routines.
- `studyRoutinesService` now delegates to `studyRoutineRepository`; all table access, predicates, joins, and writes moved to infrastructure.
- Replaced `Record<string, unknown>` repository contract workarounds with full port APIs, including exact recurring-task input and `deleteByTaskAndDate`.
- Added RED/GREEN repository coverage for routine creation/task generation. Profile onboarding failure injection remains deterministic: the second individual subject write fails inside its transaction, leaving neither subjects nor profile persisted.
- Correction verification: `npx vitest run src/infrastructure/repositories/dexie src/lib/services` (144 tests), `npx tsc --noEmit`, `npm run lint` (0 errors; 80 pre-existing baseline warnings), and `npm run build` all pass.
