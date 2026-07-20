# Virtuoso Architectural Audit

## Closure certification — 2026-07-20

This report's original audit follows as historical context. The Clean Architecture Lite migration is now certified with these final outcomes:

- Presentation boundary: the architecture test baseline is `{}` and `src/test/architecture/import-boundaries.test.ts` passes. The fresh final codebase-memory index contains 4,973 nodes and 8,388 edges; its query over `src/{pages,components,hooks,presentation}` found **0** `IMPORTS` edges to `lib.db`, `infrastructure`, or Dexie targets.
- Architecture ownership: entities and ports live in `src/domain`, commands and query DTOs in `src/application`, and Dexie tables, transactions, live subscriptions, and backup file adapters in `src/infrastructure`. Presentation uses application-facing query/controller hooks.
- Safe removals: deleted uncalled `useFormDraft` (its `saveDraft` had no caller and its sole consumer only cleared a key that no code writes), unused `Tasks.totalPerWeek`, and legacy `_shared.ts`. The one live UI-only `deleteWithUndo` behavior moved to `src/presentation/utils/deleteWithUndo.ts` with a focused test proving delete-before-toast and undo restoration.
- Intentional retentions: `src/lib/services/*` and `src/lib/db.ts` remain compatibility facades. TypeScript import audit found production callers (including presentation command adapters and domain compatibility type imports) and legacy integration tests, so deleting them is not safe until those callers are independently migrated. They no longer give presentation direct access to Dexie; the permanent boundary test enforces that.
- Candidate decisions: inline `toast` callbacks in Tasks and Library remain because they are required arguments to the undo helper; JSX `onClick` handlers remain framework callbacks. Distinct shadcn ellipsis primitives remain intentionally separate.
- Certification gate: `npm run ci` runs lint, strict i18n parity/reference/unused-key validation, all tests, and production build. The final recorded run passes.

**Scope:** read-only architectural analysis of the indexed code graph, performed 2026-07-20. No application source was changed.

## Executive summary

Virtuoso is a capable local-first React application, but it is not currently organised as Clean Architecture Lite. Its practical shape is **UI -> `lib`**, rather than **UI -> use cases -> repositories/infrastructure**. The graph contains 4,880 nodes and 8,078 edges; the strongest observed boundaries are `components -> lib` (234 calls) and `pages -> lib` (139 calls). The `lib` package acts as a shared core rather than a deliberately separated application/infrastructure boundary.

The principal architectural risk is persistence leakage. Twenty-eight presentation files import the concrete `db` instance from `src/lib/db.ts`; 29 presentation/hook files import `dexie-react-hooks` directly. Several of those presentation modules issue table operations themselves. This makes screens, dialogs, and visualisation widgets dependent on Dexie table names, query syntax, soft-delete rules, and transaction details.

There are positive foundations to retain: domain types and the Dexie schema are centralised in `src/lib/db.ts`, business-oriented modules already exist in `src/lib/services/`, reactive reads are consolidated in `src/hooks/useEntities.ts`, and backup data operations exist in `src/lib/services/backup.ts`. The recommended migration is incremental: introduce repository ports and Dexie implementations behind them, move service/use-case orchestration above those ports, and then remove all UI imports of `db` and Dexie hooks.

## Evidence and current map

| Area | Current responsibility | Architectural assessment |
|---|---|---|
| `src/pages`, `src/components` | Screens, forms, sheets, visualisation, and many data reads/writes | Presentation is coupled to persistence. |
| `src/hooks/useEntities.ts` | `useLiveQuery`-based reads directly over Dexie | Infrastructure-aware query adapter; it should not be the UI's direct data source in the target model. |
| `src/lib/services/*` | Mixed use cases and direct Dexie access | A useful starting point, but it is not separated from infrastructure. |
| `src/lib/db.ts` | Dexie schema, migrations, and exported model/types | Correct infrastructure location for the concrete database, but types should be extracted from it. |
| `src/lib/services/backup.ts` | Backup import/export data work | Correct intent; browser file handling remains in a page. |

The graph's detected packages are `components`, `pages`, `hooks`, `lib`, `app`, and test/build utilities. It does not currently reveal an `application` or `repositories` layer. Community detection also cuts across folders, notably diary/session/routine flows, supporting the conclusion that features are coupled through shared UI and `lib` access rather than through stable use-case contracts.

## Architectural violations

### A. Direct Dexie access from presentation

The following 28 UI files import the concrete `db` from `src/lib/db.ts`. Every one violates the proposed rule that UI must contain no database logic.

| Feature | Files |
|---|---|
| Collections | `components/collections/AssignPiecesSheet.tsx` |
| Diary | `components/diary/BpmSuggestion.tsx`, `LastSessionStrip.tsx`, `LinkTargetFields.tsx`, `PracticeMode.tsx`, `SegmentHistorySheet.tsx`, `SessionDetailSheet.tsx`, `SessionFAB.tsx`, `SessionLogSheet.tsx`, `StatsDashboard.tsx`, `StudyRoutineWizard.tsx`, `TaskWizard.tsx` |
| Lessons | `components/lessons/AddHomeworkSheet.tsx`, `LessonLogSheet.tsx` |
| Library | `components/library/BpmSparkline.tsx`, `ItemAnalysisSheet.tsx`, `ItemHelpSheet.tsx`, `MasterySparkline.tsx`, `NewLibraryItemSheet.tsx`, `TeacherAnswersSheet.tsx` |
| Pages | `pages/Diary.tsx`, `EditStudyRoutinePage.tsx`, `History.tsx`, `Index.tsx`, `ItemAnalysisPage.tsx`, `Lessons.tsx`, `Library.tsx`, `NewTaskPage.tsx` |

The graph also identifies direct table operations in presentation code, including `LinkTargetFields`, `BpmSuggestion`, `LastSessionStrip`, `SegmentHistorySheet`, `SessionDetailSheet`, `BpmSparkline`, `Index`, and `TheoryMasterySection`. The remainder above must be migrated as well even when they currently use `db` only for reads: a concrete repository must not be a UI dependency.

### B. Dexie reactive adapter exposed to UI

Twenty-nine files under `components`, `pages`, or `hooks` import `dexie-react-hooks`. This includes `src/hooks/useEntities.ts` and 28 UI files. `useEntities` is preferable to arbitrary queries scattered across screens, but it still imports `db` and encodes Dexie queries. In the target architecture it should be replaced or reshaped as an infrastructure-backed presentation adapter whose public API returns view models/use-case results, never Dexie collections or query semantics.

### C. Domain contract leakage

At least 135 imports from UI/pages/hooks target `src/lib/db.ts`, including types and constants. Not all are persistence violations: types such as `Task`, `Session`, `LibraryItem`, and value constants are legitimate domain concepts. However, hosting them beside `db` forces presentation code to depend on infrastructure. Extract domain entities/value objects/constants to `src/domain`, leaving only Dexie schema/migrations in `src/infrastructure/dexie`.

### D. Overgrown presentation orchestration

The largest UI units mix rendering, workflow state, business decisions, and persistence:

| Unit | Lines | Cognitive complexity |
|---|---:|---:|
| `components/diary/StudyRoutineWizard.tsx` | 867 | 37 |
| `components/diary/SessionLogSheet.tsx` | 597 | 53 |
| `pages/Profile.tsx` | 502 | 19 |
| `pages/Tasks.tsx` | 365 | 17 |
| `pages/NewTaskPage.tsx` | 305 | 26 |
| `components/diary/PracticeMode.tsx` | 298 | 14 |

These are priority candidates for use-case extraction; do not start by merely splitting JSX into smaller files while retaining `db` access.

## Dead-code candidates

Static in-degree analysis must be treated as a candidate list, not a deletion list: React JSX, route configuration, callbacks, framework configuration, and tests are incompletely represented by CALLS edges. The graph reports 39 zero-degree functions before manual exclusions. It also marks many service exports as entry points, so those are explicitly excluded below.

### High-confidence candidates to validate and remove or make private

| Symbol | File | Reason |
|---|---|---|
| `onClick` | `src/lib/services/_shared.ts` | Zero graph degree, non-entry-point, one-line export; suspicious in a service helper. |
| `saveDraft` | `src/hooks/useFormDraft.ts` | Zero graph degree, non-entry-point; verify whether it is only called dynamically by its enclosing hook before deleting. |
| `totalPerWeek` | `src/pages/Tasks.tsx` | Zero graph degree, non-entry-point; likely unused local helper. |
| `toast` (two occurrences) | `src/pages/Tasks.tsx`, `src/pages/Library.tsx` | Graph-zero wrapper functions; verify import alias/callback use, then remove if redundant. |
| `MockNotification`, `text` | `src/lib/platform.test.ts` | Graph-zero test fixture members; assess as test-support code, not production dead code. |

### False-positive classes deliberately excluded

The graph also reports framework callbacks and external-library exports as zero-degree (for example `FormField`, calendar icons, `Toaster`, event listener mocks, `manualChunks`, and UI handlers). These should not be removed based on graph degree alone. Likewise, exported service APIs such as session `list`/`byTask`/`update`, task `hardDelete`/`hasSessions`/`restore`, and pending-assignment functions are marked as graph entry points and are not evidence of dead code.

**Required validation gate:** before deleting any candidate, run a TypeScript-aware reference check and the relevant tests; only then remove it. This prevents static-call-graph false positives.

## Duplication and logic leaks

### Confirmed duplicate UI

The graph's `SIMILAR_TO` edges show:

- `EmptyLessons` in `src/pages/Lessons.tsx` and `EmptyLibrary` in `src/pages/Library.tsx`: **0.969 Jaccard similarity**. Replace with a parameterised empty-state component or one shared feature-empty-state API.
- `BreadcrumbEllipsis` and `PaginationEllipsis`: **0.953 similarity**, but these are separate shadcn-style primitives with distinct semantics. Keep unless component-library consolidation is already planned.

### Repeated mobile UI/workflow patterns to consolidate

- Multiple sheet/dialog-based create/edit flows are duplicated across diary, lessons, library, and collections. Standardise a feature-agnostic mobile form-sheet shell, confirmation-dialog API, and async submit/error state pattern; keep feature fields in their feature modules.
- `Pager` exists both as `components/shared/Pager.tsx` and as a local function in `StudyRoutineWizard.tsx`. Reuse or extend the shared component rather than retaining local variants.
- Large list/card pages (`Tasks`, `Library`, `Lessons`, `History`, `Diary`) repeatedly combine loading, empty, filter, selection, pagination, delete confirmation, and actions. Extract reusable presentation primitives only after the use-case/data boundary is in place.

### File-management leakage

`src/pages/Profile.tsx` contains `onExport`, `onImport`, and `onImportNative`, including browser/native file interaction. The graph traces `onExport -> backup.exportAll`; the data transformation itself is already in `src/lib/services/backup.ts`, but file selection/read/download handling belongs in infrastructure. The UI should only call use cases such as `exportBackup()` and `importBackup(file)` and render progress/results. Place browser FileReader/Blob/download/native picker adapters behind an `IBackupFileGateway` implementation.

## Refactoring action plan: Clean Architecture Lite

1. **Define dependency rules and enforce them.** Create `src/domain`, `src/application`, `src/infrastructure`, and retain `src/presentation` (or map the existing pages/components/hooks into it). Add ESLint import restrictions: presentation cannot import `infrastructure/**`, `Dexie`, `db`, or `dexie-react-hooks`; application cannot import React or browser file APIs; domain imports neither React nor Dexie.

2. **Extract domain contracts from `db.ts`.** Move entities, value types, `THEORY_LAYERS`, and other domain constants to `src/domain`. Keep database row mapping, schema versions, and migrations in `src/infrastructure/dexie`. Define repository interfaces in domain/application-facing code: `TaskRepository`, `SessionRepository`, `LibraryRepository`, `LessonRepository`, `CollectionRepository`, `ProfileRepository`, and `BackupRepository`.

3. **Implement Dexie repositories.** Create `src/infrastructure/repositories/dexie/*Repository.ts`. Repositories exclusively own table names, soft-delete predicates, transactions, joins, and conversion between Dexie rows and domain models. Preserve live-query capability behind repository subscription/query interfaces rather than exposing tables.

4. **Move business workflows into application use cases.** Convert existing `src/lib/services/*` into `src/application/useCases/*`, injected with repository ports. Prioritise task/session CRUD, recurrence regeneration, lesson assignments, routines, and collection operations. A use case returns domain results/view-ready DTOs and has no JSX, React hooks, Dexie, `FileReader`, or `URL.createObjectURL` dependency.

5. **Split backup use case from file gateway.** Keep validation, versioning, parsing, and transactional import in `ImportBackupUseCase` / `ExportBackupUseCase`. Implement `BrowserBackupFileGateway` and any native equivalent in infrastructure for picker, `FileReader`, Blob generation, and download. Refactor `Profile` to invoke these use cases only.

6. **Migrate presentation by vertical slice.** Begin with the most coupled, highest-value flows: (a) Profile backup, (b) task creation/editing, (c) session logging, (d) study routine. Replace each direct `db` import with a use-case hook/controller. Migrate every file in the direct-Dexie table above; a single remaining import is a failed boundary.

7. **Introduce presentation query adapters.** Rework `useEntities.ts` so presentation consumes repository-backed query services or view-model hooks. It may use a React subscription adapter, but Dexie-specific imports must stay in infrastructure. Provide query DTOs that eliminate UI joins such as subjects + tasks + sessions.

8. **Decompose large screens after extraction.** Split `StudyRoutineWizard`, `SessionLogSheet`, and `Profile` into presentational sections plus a controller/hook that calls use cases. Reuse the shared pager, empty states, sheet shell, list/card and confirmation patterns discovered above.

9. **Delete safely and lock the boundary.** Validate the dead-code candidates, remove only confirmed unused exports, add use-case/repository tests (with in-memory or fake repositories) and infrastructure integration tests for Dexie migrations/transactions. Add an architecture test/lint rule to block `db` or Dexie imports from presentation forever.

## Completion criteria

- `src/pages`, `src/components`, and presentation hooks contain zero imports of `db`, `Dexie`, or `dexie-react-hooks`.
- Only `src/infrastructure/**` imports Dexie or uses browser/native file APIs.
- Every UI mutation goes through a named application use case.
- Domain entities/types no longer originate in `db.ts`.
- Backup parsing/import/export is testable without rendering `Profile` or invoking browser APIs.
- Repository and use-case tests cover soft deletes, recurrence regeneration, snapshots, and backup rollback behavior.
