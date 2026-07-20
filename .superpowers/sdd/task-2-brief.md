### Task 2: Extract models and create ports

**Files:** Modify `src/lib/db.ts`; create `src/domain/entities/{task,session,library,lesson,collection,profile,common}.ts`, `src/domain/constants/theoryLayers.ts`, `src/domain/ports/{task,session,library,lesson,collection,profile,backup}.ts`, and `src/domain/domain-boundaries.test.ts`.

- [ ] Write failing tests that domain imports no React, Dexie, browser APIs, or `@/lib/db`.
- [ ] Using graph traces for model consumers, extract current shapes of `Task`, `TaskRecurrence`, `Session`, `SessionSnapshot`, `Lesson`, `LessonSnapshot`, library/collection/profile types, `NoteVal`, `SegmentMetric`, `SessionQuality`, and `THEORY_LAYERS` to domain with compatibility re-exports during migration.
- [ ] Define ports from real workflows: task active/date reads, create/update/remove/carry-over; session snapshot logging/deletion; library/lesson/collection/profile queries; and backup import/export transaction support. Ports expose domain types, never Dexie tables.
- [ ] Retain schema, versions, indexes, and migrations in legacy DB facade until Dexie repository tests exist.
- [ ] Run `npx vitest run src/domain/domain-boundaries.test.ts && npm run lint`; commit `refactor: extract domain contracts from dexie`.

Global constraints: preserve IndexedDB schema/data and all user-visible behavior. Dependency direction `presentation -> application -> domain`; infrastructure implements ports. Domain imports neither React, Dexie, browser/native APIs, nor `@/lib/db`. Use codebase-memory-mcp graph discovery in search_graph, trace_path, get_code_snippet order; use Caveman compact inspection. TDD every behavior. Do not stage/modify unrelated dirty worktree files.
