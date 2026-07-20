### Task 3: Isolate all Dexie operations in repositories

**Files:** Modify `src/lib/db.ts`, `src/test/setup.ts`; create `src/infrastructure/dexie/db.ts`, `src/infrastructure/repositories/dexie/{task,session,library,lesson,collection,profile,backup}Repository.ts`, and co-located repository tests.

- [ ] Write failing `fake-indexeddb` tests: active lists exclude `deletedAt`; a task with sessions soft-deletes and one without sessions hard-deletes; bulk removal returns `{ soft, hard }`; recurrence writes atomically; session logging creates immutable snapshots and completes the task.
- [ ] Move schema construction/migrations unchanged to `src/infrastructure/dexie/db.ts`; preserve database name, versions, indexes, and upgrade behavior.
- [ ] Implement repositories one at a time. Every table name, predicate, join, `db.transaction`, and rollback belongs in infrastructure.
- [ ] Add rollback tests for task/session/help-request logging and backup import by failing a second write and asserting no partial first write remains.
- [ ] Run `npx vitest run src/infrastructure/repositories/dexie`; commit `refactor: isolate Dexie repositories`.

Global constraints: preserve IndexedDB schema/data and all user-visible behavior. Only `src/infrastructure/**` may import Dexie, `dexie-react-hooks`, `db`, table names, `FileReader`, `Blob`, object URLs, or Capacitor file APIs. All table operations/predicates/joins/transactions/rollback belong in infrastructure. Domain/application do not import Dexie/browser APIs. Use graph discovery in search_graph, trace_path, get_code_snippet order; TDD every behavior. Do not stage/modify unrelated dirty files.
