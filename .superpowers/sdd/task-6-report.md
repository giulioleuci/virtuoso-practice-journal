# Task 6 report

## Scope completed

- Added infrastructure-owned Dexie React subscription bridge in `src/infrastructure/dexie/subscribe.ts`.
- Added presentation query composition exports and moved the centralized entity hook implementation to `src/presentation/hooks/useEntities.ts`.
- Migrated every production caller to `@/presentation/hooks/useEntities`, then removed the legacy `src/hooks/useEntities.ts` re-export and its Dexie-backed hook test.
- Added application query DTO contracts for task, session, library, lesson, collection, and profile reads.
- Replaced every production `pages`, `components`, and `hooks` import of `@/lib/db`, `dexie`, and `dexie-react-hooks` with the composition/subscription adapters.
- Retired all temporary presentation-boundary baseline entries.

## TDD evidence

1. Added `src/presentation/hooks/useEntities.test.tsx` first.
2. Replaced Dexie-backed adapter coverage with a `PresentationReadPort` fake that delivers explicit subscription notifications.
3. Adapter tests now prove task-date, task-range, item, segment, collection, history, session, lesson, and profile DTO refreshes without infrastructure imports.

## Verification

- `npx vitest run src/presentation/hooks src/test/architecture/import-boundaries.test.ts`: 3 files, 22 tests passed.
- `npm run lint`: exit 0; one existing React Hooks warning in `src/pages/History.tsx:116`.
- Post-index graph audit: legacy `src/hooks/useEntities.ts` 0 rows; imports targeting that legacy module 0 rows.
- `rg` audit: legacy `@/hooks/useEntities` / `src/hooks/useEntities` production imports 0; presentation infrastructure/Dexie imports 0.

## Commit

Focused correction commit records only Task 6 hook migration, fake-subscription tests, and this report.
