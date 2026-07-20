### Task 4: Replace task/session/routine services with application use cases

**Files:** Modify `src/lib/services/{tasks,sessions}.ts` and routine modules found by graph tracing; create `src/application/useCases/{createTask,updateTask,removeTask,logSession,deleteSession,generateStudyRoutine}.ts`, their tests, and `src/test/fakes/{FakeTaskRepository,FakeSessionRepository}.ts`.

- [ ] Write failing fake-port tests for recurrence generation/empty result failure, soft-vs-hard removal, carry-over, logging completion plus optional help request, and reset-after-last-session deletion.
- [ ] Implement constructor-injected use cases. `LogSessionUseCase.execute(task, input)` must create an effective-input snapshot, write a session, complete the task, and add a help request transactionally.
- [ ] Turn legacy service exports into temporary thin adapters over composition root; migrate callers with graph inbound traces. Application imports neither `db`, React, Zod form hooks, nor browser APIs.
- [ ] Move study-routine validation, pool selection, matrix generation, and persistence to `GenerateStudyRoutineUseCase` before splitting wizard JSX.
- [ ] Run `npx vitest run src/application/useCases src/lib/services/tasks.test.ts src/lib/services/sessions.test.ts`; commit `refactor: move task and session workflows to use cases`.

Global constraints: presentation -> application -> domain. Application depends only domain ports/types, never concrete infrastructure, db, React, Dexie, browser APIs, or Zod form hooks. Repository implementations compose only in an infrastructure composition root. Preserve behavior. Use graph discovery then TDD; do not alter unrelated files.
