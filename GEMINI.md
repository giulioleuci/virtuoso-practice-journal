# 🎻 Virtuoso Practice Journal - Project Instructions

## Project Overview
**Virtuoso** is a local-first digital companion designed for musicians to track their daily practice, manage repertoire (Library), record lessons, and organize study tasks. It prioritizes privacy and speed by storing all data locally on the user's device.

### Core Technologies
- **Frontend:** React 18 (TypeScript), Vite, React Router v6
- **Persistence:** Dexie.js (IndexedDB) - Local-first architecture
- **State Management:** `dexie-react-hooks` for live DB queries, TanStack Query for async state
- **UI/Styling:** shadcn/ui, Tailwind CSS, Lucide React
- **Mobile:** Capacitor (Android support)
- **Validation:** Zod + React Hook Form
- **Internationalization:** Custom i18n solution (EN, IT, ES, DE)
- **Testing:** Vitest with jsdom and `fake-indexeddb`

---

## Architecture & Data Flow

### 1. Local-First Persistence (`src/lib/db.ts`)
All data resides in IndexedDB via Dexie. The database uses a versioned schema with migrations.
- **Soft Deletes:** Most tables use a `deletedAt` (timestamp) field instead of hard deletion. Always filter for `!deletedAt` when querying active data.
- **Historical Snapshots:** `Session` and `Lesson` records store immutable "snapshots" of relevant state (e.g., library item details at that moment) to ensure history remains accurate even if the original items are modified later.

### 2. Business Logic (Service Layer)
Do NOT put database operations directly into React components. Use the service modules in `src/lib/services/`:
- `collections.ts`: Manage groupings of library items.
- `library.ts`: Manage repertoire, exercises, and segments.
- `sessions.ts`: Logic for recording practice sessions.
- `tasks.ts`: Task creation, recurrence, and completion.

### 3. Reactive Data Fetching (`src/hooks/useEntities.ts`)
Use the centralized hooks in `useEntities.ts` to get live-updating data. These hooks wrap Dexie's `useLiveQuery` to ensure the UI stays in sync with the database automatically.

### 4. Internationalization (`src/lib/i18n.tsx`)
Use the `useI18n()` hook to access translation strings.
- Translation files are in `src/lib/language/` (JSON).
- The `t()` function supports simple key lookup.

---

## Development Conventions

### Styling & Theme
- **Fonts:** `Cormorant Garamond` (titles), `Inter`/`Manrope` (interface).
- **Colors:** Use the custom semantic palette defined in `tailwind.config.ts`:
  - `terracotta`: #E67E5F
  - `sage`: #8BA88E
  - `gold`: #C5A059
  - `blue`: #5B84B1
  - `plum`: #7B506F
- **Cards:** Use "lifted" effects with multi-level shadows as per the design philosophy.

### Components
- **UI Primitives:** Located in `src/components/ui/` (shadcn).
- **Shared Components:** Generic helpers (EmptyState, StarRating, etc.) in `src/components/shared/`.
- **Feature Components:** Grouped by feature in `src/components/<feature>/`.

### Testing
- Tests are co-located with the logic they test (e.g., `src/lib/services/tasks.test.ts`).
- Always verify DB logic with tests using the provided Vitest setup.

### UX & Accessibility
- **Focus Indicators:** Large interactive cards must have clear focus indicators. Use Tailwind's `focus-visible` and `ring-ring` for keyboard discoverability.
- **Randomized Content:** Memoize randomized content (like quotes) using `useMemo` to prevent flickering during re-renders.

---

## Building and Running

### Development
```bash
npm run dev          # Start dev server on port 8080
npm run lint         # Run ESLint check
```

### Testing
```bash
npm run test         # Run all tests once
npm run test:watch   # Run tests in watch mode
```

### Mobile (Android)
```bash
npm run cap:sync     # Build web app and sync with Android project
npm run cap:open     # Open the project in Android Studio
```

### Production
```bash
npm run build        # Generate production build in dist/
```

---

## Key Files
- `src/lib/db.ts`: Database schema and Dexie configuration.
- `src/lib/schemas.ts`: Zod validation schemas for forms and entities.
- `src/hooks/useEntities.ts`: Primary data fetching hooks.
- `src/lib/i18n.tsx`: Internationalization logic and context.
- `capacitor.config.ts`: Mobile app configuration.
