# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Architecture

**Virtuoso** is a local-first SPA for musicians to track practice sessions, repertoire, lessons, and tasks. All data lives in the browser via IndexedDB (Dexie).

### Stack

- **React 18 + TypeScript + Vite** — SPA with React Router v6 for client-side routing
- **Dexie (IndexedDB)** — all persistence; no backend
- **TanStack Query** — set up in `App.tsx` but Dexie live hooks are the primary data layer
- **shadcn/ui + Tailwind CSS** — UI components in `src/components/ui/`; custom theme colors (terracotta, sage, gold, blue, plum) with Cormorant Garamond / Inter / Manrope fonts
- **React Hook Form + Zod** — forms and validation; schemas in `src/lib/schemas.ts`

### Data Layer (`src/infrastructure/dexie/db.ts`)

All tables are defined in `src/infrastructure/dexie/db.ts`; v13 reshaped tasks/sessions/assignments and clears pre-release data. v14 back-fills session subject/content references and wipes nothing. v19 prunes untouched future routine/recurrence tasks beyond the 14-day window (also on every backup import). Key tables:

| Table | Purpose |
|---|---|
| `profile` | Single row (id: "me") — user settings, language, instrument |
| `subjects` | Study subjects (instrument, theory, composition) |
| `techniques` | Practice techniques linked to subjects |
| `library` | Repertoire/exercises/manuals/theory items |
| `segments` | Sub-sections of library items (e.g., movements) |
| `tasks` | Daily practice tasks (free-form, library item, or collection-based); `plan: SegmentEntry[]` holds per-section tempo/layers/techniques |
| `sessions` | Practice session logs: `marks: SegmentMark[]` (per-section tempo, confidence 1-5, layers, techniques) plus snapshot |
| `recurrences` | Recurring lesson schedule rules |
| `lessons` | Lesson logs with snapshot context |
| `assignments` | Teacher homework attached to a lesson from the moment it is written; `taskIds[]` links it to planned tasks |
| `collections` | Named groupings of library items |
| `collectionItems` | Many-to-many join between collections and library items |

**Patterns to know:**
- `deletedAt` timestamp used for soft deletes across most tables
- `SessionSnapshot` / `LessonSnapshot` are immutable context copies stored inside session/lesson records for historical fidelity
- Tasks support three scope types: free-form, linked to a library item (with optional segment), or linked to a collection

### Service Layer (`src/lib/services/`)

Business logic is extracted from components into service modules (`collections.ts`, `sessions.ts`, `tasks.ts`; the rest re-export repositories from `index.ts`). These are the place to add DB operations — not inside page components.

### Live Queries (`src/presentation/hooks/useEntities.ts`)

All data-fetching hooks live here, built on `usePresentationQuery` (re-reads on Dexie `storagemutated`). Components import these hooks, never Dexie.

### Internationalization (`src/lib/i18n.tsx`)

Four languages supported: English, Italian, Spanish, German. Translation strings and context provider are in this single file. Access via the `useI18n()` hook.

### Page Structure

Pages are in `src/pages/`. Feature-scoped components (forms, cards, dialogs) live in `src/components/<feature>/`. Shared primitives (EmptyState, ErrorBoundary, StarRating) are in `src/components/shared/`.

### Testing

Vitest with jsdom; `fake-indexeddb` mocks IndexedDB so Dexie tests run in Node. Setup file is `src/test/setup.ts` (mocks `window.matchMedia`). Tests live co-located with service files in `src/lib/`.
