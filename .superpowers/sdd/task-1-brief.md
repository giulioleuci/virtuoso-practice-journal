### Task 1: Lock the boundary before moving code

**Files:** Modify `AGENTS.md`, `eslint.config.js`; create `src/test/architecture/import-boundaries.test.ts`.

- [ ] Write a failing architecture test which enumerates `src/pages`, `src/components`, and presentation hooks and rejects imports of `@/lib/db`, `dexie`, `dexie-react-hooks`, `@/infrastructure/`, `FileReader`, `Blob`, `URL.createObjectURL`, and Capacitor filesystem modules.
- [ ] Run `npx vitest run src/test/architecture/import-boundaries.test.ts`; record audit's current offenders as explicit temporary baseline, so new violations fail immediately.
- [ ] Add ESLint `no-restricted-imports` overrides: domain/application exclude React/Dexie/browser APIs; presentation excludes persistence/infrastructure/native APIs.
- [ ] Re-run `npx vitest run src/test/architecture/import-boundaries.test.ts && npm run lint`; expect PASS with only documented baseline.
- [ ] Commit: `chore: enforce clean architecture boundaries`.

Global constraints: preserve local-first behavior. Dependency direction: `presentation -> application -> domain`; infrastructure implements ports and is never imported by presentation. Only `src/infrastructure/**` may import Dexie, `dexie-react-hooks`, `db`, table names, `FileReader`, `Blob`, object URLs, or Capacitor file APIs. TDD every behavior. Use codebase-memory-mcp for source discovery (index/search_graph/trace_path/get_code_snippet) and Caveman compact workflow. Do not stage or alter unrelated dirty worktree files.
