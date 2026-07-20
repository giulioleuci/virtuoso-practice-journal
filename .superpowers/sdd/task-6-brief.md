### Task 6: Replace direct presentation reads/writes slice by slice

**Files:** Modify `src/hooks/useEntities.ts` and every audit-listed presentation offender; create `src/application/queries/{task,session,library,lesson,collection,profile}Queries.ts`, `src/presentation/hooks/useEntities.ts`, `src/infrastructure/dexie/subscribe.ts`, and hook tests.

- [ ] Write failing adapter tests covering task date/range, item/segment, collection, history/session, lesson, and profile DTO updates after a fake subscription notification.
- [ ] Define query DTOs for UI joins; presentation may use a React adapter but infrastructure exclusively contains Dexie subscription mechanism.
- [ ] Migrate direct-Dexie offenders in vertical feature slices: collections; diary components/pages; lessons; library; remaining pages. Use graph traces for each caller and remove baseline entry in same commit.
- [ ] Delete old direct-Dexie hook implementation only after all callers move; graph-query remaining presentation imports of db, Dexie, and dexie-react-hooks to prove each count zero.
- [ ] Run `npx vitest run src/presentation/hooks src/test/architecture/import-boundaries.test.ts && npm run lint` after each slice; commit `refactor: migrate <feature> presentation boundary`.

Global: Presentation never imports db/Dexie/dexie-react-hooks/infrastructure/browser-native APIs. Application queries only use domain ports/types; infrastructure owns Dexie subscription. Migrate all audit-listed offenders, not only hooks. TDD, graph traces, per-slice verification; no unrelated changes.
