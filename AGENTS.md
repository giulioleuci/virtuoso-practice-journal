## Commands

```bash
# Development
npm run dev          # Start dev server on port 8080

# Build
npm run build        # Production build
npm run build:dev    # Development build

# Testing
npm run test         # Run all tests once
npm run test:watch   # Run tests in watch mode

# Linting
npm run lint         # Run ESLint

To run a single test file: `npx vitest run src/lib/services/tasks.test.ts`
```

## Codebase Analysis via codebase-memory-mcp (MANDATORY)

You have access to the `codebase-memory-mcp` tool, which maintains a compiled Knowledge Graph of this entire ecosystem (powered by tree-sitter and SQLite). **You MUST use this MCP to navigate, query, trace, and review the code** rather than reading raw text files or relying on simple text searches. This prevents context-window bloat, hallucinations, and missed dependencies. Name of project: `home-giulio-Desktop-virtuoso-practice-journal`.

### Token-efficient discovery (MANDATORY)

This repository is undergoing a **heavy refactor toward Clean Architecture Lite**. Preserve the token budget while investigating it:

1. Index when needed, then use `search_graph`, `trace_path`, and `get_code_snippet` in that order. Use narrow, symbol-level queries; do not dump whole source files.
2. **Caveman is mandatory for compact source inspection and editing workflow.** Use it alongside the codebase graph before falling back to raw file reads or broad search; follow the installed Caveman help for exact invocation.
3. If Caveman is unavailable, report that missing prerequisite before any raw-source fallback. Continue only with narrowly scoped MCP snippets when safe.
4. Use `rg` only for non-code discovery, literal strings, or when the graph cannot answer a code question; it cannot replace graph navigation.

### Refactor Architecture Target: Clean Architecture Lite

The target direction is `presentation (pages/components/hooks) -> application (use cases/query DTOs) -> domain (entities/ports)`, with infrastructure implementing those ports.

- `src/domain/**`: entities, value objects, constants, ports; imports neither React, Dexie, nor browser/native APIs.
- `src/application/**`: use cases, orchestration, query DTOs; imports neither React, Dexie, nor browser/native APIs.
- `src/infrastructure/**`: Dexie schema/migrations, table names, soft-delete predicates, transactions, repository implementations, browser/native adapters.
- Presentation must never import `db`, `Dexie`, `dexie-react-hooks`, `src/infrastructure/**`, or browser/native file APIs. Every mutation uses a named application use case.
- Migrate behavior-preserving vertical slices. Do not do JSX-only reorganisation before establishing that slice's data boundary.
- `src/test/architecture/import-boundaries.test.ts` is the temporary presentation-boundary baseline. New violations fail immediately; remove baseline entries as each vertical slice moves.

## Architecture

**Virtuoso** is a local-first SPA for musicians to track practice sessions, repertoire, lessons, and tasks. All data lives in the browser via IndexedDB (Dexie).

### Stack

- **React 18 + TypeScript + Vite** — SPA with React Router v6 for client-side routing
- **Dexie (IndexedDB)** — all persistence; no backend
- **dexie-react-hooks** — live queries that trigger reactive re-renders on DB changes
- **TanStack Query** — set up in `App.tsx` but Dexie live hooks are the primary data layer
- **shadcn/ui + Tailwind CSS** — UI components in `src/components/ui/`; custom theme colors (terracotta, sage, gold, blue, plum) with Cormorant Garamond / Inter / Manrope fonts
- **React Hook Form + Zod** — forms and validation; schemas in `src/lib/schemas.ts`

### Data Layer (migration target: `src/domain` + `src/infrastructure/dexie`)

All tables are defined here with 5 migration versions. Key tables:

| Table | Purpose |
|---|---|
| `profile` | Single row (id: "me") — user settings, language, instrument |
| `subjects` | Study subjects (instrument, theory, composition) |
| `techniques` | Practice techniques linked to subjects |
| `library` | Repertoire/exercises/manuals/theory items |
| `segments` | Sub-sections of library items (e.g., movements) |
| `tasks` | Daily practice tasks (can be free-form, library item, or collection-based) |
| `sessions` | Practice session logs with quality ratings and snapshots |
| `recurrences` | Recurring lesson schedule rules |
| `lessons` | Lesson logs with snapshot context |
| `assignments` | Teacher assignments from lessons |
| `collections` | Named groupings of library items |
| `collectionItems` | Many-to-many join between collections and library items |

**Patterns to know:**
- `deletedAt` timestamp used for soft deletes across most tables
- `SessionSnapshot` / `LessonSnapshot` are immutable context copies stored inside session/lesson records for historical fidelity
- Tasks support three scope types: free-form, linked to a library item (with optional segment), or linked to a collection

### Application Layer (current: `src/lib/services/`; target: `src/application/useCases/`)

Current services centralise some business logic but access Dexie directly. Move workflows into injected application use cases and move Dexie work into infrastructure repositories. New DB operations belong only in infrastructure repositories.

### Live Queries (current: `src/hooks/useEntities.ts`; target: presentation adapters)

Current hooks use `useLiveQuery` directly. Replace them incrementally with presentation adapters that consume application query services and return DTOs; keep Dexie subscription mechanics in infrastructure.

### Internationalization (`src/lib/i18n.tsx`)

Four languages supported: English, Italian, Spanish, German. Translation strings and context provider are in this single file. Access via the `useI18n()` hook.

### Page Structure

Pages are in `src/pages/`. Feature-scoped components (forms, cards, dialogs) live in `src/components/<feature>/`. Shared primitives (EmptyState, ErrorBoundary, StarRating) are in `src/components/shared/`.

### Testing

Vitest with jsdom; `fake-indexeddb` mocks IndexedDB so Dexie tests run in Node. Setup file is `src/test/setup.ts` (mocks `window.matchMedia`). Add domain/application tests with fakes, Dexie repository integration tests, and architecture-boundary tests as the refactor proceeds.
