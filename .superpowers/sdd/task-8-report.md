# Task 8 report

## Commit

`6c401ae refactor: complete clean architecture lite migration`

## Removed and migrated

- Deleted unused `src/hooks/useFormDraft.ts`: graph showed `saveDraft` had zero callers; TypeScript reference scan confirmed no caller and `TaskWizard` only cleared a key no production code writes.
- Deleted unused `Tasks.totalPerWeek`.
- Deleted legacy Dexie helper module `src/lib/services/_shared.ts` after moving its only live behavior, `deleteWithUndo`, to `src/presentation/utils/deleteWithUndo.ts`.
- Added focused test proving deletion completes before toast display and toast undo invokes restoration.
- Removed duplicate `SessionPort.deleteByTaskAndDate` declaration; updated stale port assertion to current transaction contract.

## Retained by evidence

- `src/lib/services/*` and `src/lib/db.ts` compatibility facades remain. Graph and TypeScript scans found active production imports plus legacy integration-test imports; zero-reference deletion condition was not met.
- Tasks/Library inline toast callbacks remain required undo-helper adapters; JSX `onClick` callbacks remain framework behavior.

## Certification

- Final graph re-index: 4,973 nodes, 8,388 edges (matching the closure certification in `architectural_audit_report.md`).
- Query for presentation `IMPORTS` to `lib.db`, infrastructure, or Dexie: 0 rows.
- Architecture baseline is `{}`; architecture test passes.
- `npm run ci`: pass — lint has one existing `History.tsx` exhaustive-deps warning; strict i18n validation passes after removing 103 unreachable keys from all locale maps; 40 test files / 321 tests pass; production build passes.
