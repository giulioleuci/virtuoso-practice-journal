### Task 7: Simplify only after data boundaries are in place

**Files:** Modify `src/components/diary/{SessionLogSheet,StudyRoutineWizard}.tsx`, `src/pages/{Profile,Tasks,NewTaskPage,Lessons,Library}.tsx`; create focused controller hooks/sections and `src/components/shared/FeatureEmptyState.tsx` with tests.

- [ ] Write failing controller tests for session submission/error/reset, routine-wizard steps/output, and backup command state transitions; mock application commands, never Dexie.
- [ ] Extract controller hooks, then presentational sections. Reuse `components/shared/Pager.tsx` in `StudyRoutineWizard`; keep `SessionLogSheet` persistence in `LogSessionUseCase`.
- [ ] Replace audit-confirmed duplicate `EmptyLessons`/`EmptyLibrary` with parameterised `FeatureEmptyState({ icon, title, description, action })`; retain distinct shadcn ellipsis primitives.
- [ ] Consolidate form-sheet/confirmation/async-state presentation utilities only when feature tests prove behavior equivalence; do not reintroduce business logic to components.
- [ ] Run relevant component/page suites plus lint; commit `refactor: simplify presentation orchestration`.

Global: controller hooks call application commands, never Dexie. No data-boundary regression. TDD, preserve UI behavior, no unrelated refactoring.
