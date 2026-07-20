# Task 2 report: domain contracts from Dexie

## Status

Completed. `src/lib/db.ts` remains the legacy Dexie schema facade; its database name, tables, versions, migrations, and indexes are unchanged.

## Graph evidence

Discovery used `search_graph`, then `trace_path`, then `get_code_snippet` for model symbols and service workflows.

- `tasksService.carryOver`: traced from `Diary`; copies a task to a date and marks source skipped.
- `sessionsService.log`: traced to `buildSessionSnapshot`; writes snapshot-backed session records.
- `libraryService.upsert`: traced from `NewLibraryItemSheet.save`.
- `lessonsService.log`: traced from `LessonLogSheet.save` and `buildLessonSnapshot`.
- `collectionsService.remove`: traced from collection/page consumers.
- `profileService.update`: traced from profile tests.
- `backupService.importAll`: traced from profile import handlers; clears and bulk-adds all tables inside a read-write transaction.

## TDD evidence

- RED: `npx vitest run src/domain/domain-boundaries.test.ts` failed because extracted contract module list was empty.
- GREEN: same focused test passed with 2 tests after extraction.

## Changed files

- Added domain constants, entities, and workflow-derived ports under `src/domain/`.
- Added `src/domain/domain-boundaries.test.ts`, preventing domain imports of React, Dexie, browser APIs, and `@/lib/db`.
- Replaced extracted declarations in `src/lib/db.ts` with compatibility re-exports from domain. Kept Dexie facade/schema/migrations unchanged.

## Verification

- `npx vitest run src/domain/domain-boundaries.test.ts`
- `npm run lint` (exit 0; existing presentation-boundary warnings remain)
- `npm run build`

## Self-review

- Domain files import only other domain modules and TypeScript built-ins.
- Ports use domain values and IDs only; no Dexie table types leak through interfaces.
- Existing `@/lib/db` consumers retain source-compatible type/constant exports.
- No IndexedDB schema, version, migration, or index string changed.

## Review-fix: session and library port contracts

- RED: `npx vitest run src/domain/domain-boundaries.test.ts` failed with two new port-contract assertions: completed session logging lacked a persisted task ID, input date/help text, and atomic workflow method; library removal returned `Promise<void>`.
- GREEN: focused test passes with four assertions after introducing `PersistedTask`, making `SessionLogInput` include `date` and optional `helpText`, exposing `logWithCompletion`, and retaining `Promise<"soft" | "hard">` for library removal.
- `logWithCompletion` captures existing `sessionsService.logWithCompletion` behavior: snapshot-backed session persistence, task completion, and optional help-request creation in one transaction. No schema or migration changed.
- Verification: focused Vitest test passed; `npm run lint` exited 0 with existing 80 presentation-boundary warnings; `npm run build` exited 0.
