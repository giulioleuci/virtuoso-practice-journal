# Task 6 final-fix review

## Requirements

- Fake subscription tests cover task date/range, item/segment, collection, history/session, lesson, and profile DTO refreshes.
- Presentation tests import only application contracts and local adapters; no Dexie or infrastructure imports remain.
- All production callers import `@/presentation/hooks/useEntities`.
- Legacy `src/hooks/useEntities.ts` and its old Dexie-backed test are removed.

## Evidence

- `npx vitest run src/presentation/hooks src/test/architecture/import-boundaries.test.ts`: 22 passing tests.
- `npm run lint`: exit 0; existing warning only at `src/pages/History.tsx:116`.
- `rg` legacy-import count: 0.
- Graph after re-index: legacy module rows 0; imports targeting it 0.
- `git diff --check`: clean.

## Assessment

No remaining Task 6 final-review gaps found.
