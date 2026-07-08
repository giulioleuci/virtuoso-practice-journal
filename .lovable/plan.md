
## 1. Segment history drill-down in `LastSessionStrip`

- Make each `segmentBreakdown` row a `<button>` that opens a new **`SegmentHistorySheet`** (`src/components/diary/SegmentHistorySheet.tsx`).
- The sheet queries all sessions across tasks sharing the same `itemId` where `segmentMetrics[segmentId]` is defined, sorted newest-first, and renders a chronological list: date, quality glyph, BPM (with note glyph), confidence, and mini bars for that segment's `layerScores` / `techniqueScores`.
- Clicking a row calls the existing `SessionDetailSheet` for the full context (kept behind a "View full session" link).
- New i18n keys: `session.segmentHistory`, `session.noSegmentHistory`, `session.viewFullSession`.

## 2. Additional seeded segment metrics in `sampleData.ts`

- Extend the existing multi-segment seed so **at least 3 different items** (a sonata with 3 movements, a study with 4 phrases, and a concerto excerpt) have several past sessions with populated `segmentMetrics` covering varied quality/BPM/layer scores.
- Values must be realistic progressions (BPM trending up, quality alternating, layer scores gradually improving) so the strip visualisation and new history sheet are populated across easy/medium/hard cases.

## 3. Backup export/import coverage for `segmentMetrics`

- Current `backupService` dumps all Dexie tables verbatim, which already includes `segmentMetrics` on session rows. I'll:
  - Add a regression test in `src/lib/services/backup.test.ts` seeding a session with `segmentMetrics` + `snapshot.segments`, round-tripping through export/import, and asserting equality.
  - Bump the export `version` to `2` and add a lightweight forward-compat guard (accept both `1` and `2`).
- No schema change needed.

## 4. FAB on `/tasks` → `/tasks/new`

- Add a small presentational FAB (matching the style of `SessionFAB`: `fixed bottom-24 right-4`, primary circle, `Plus` icon) directly inside `src/pages/Tasks.tsx`.
- Uses `react-router`'s `useNavigate()` to push `/tasks/new`. Aria label `tasks.new`.

## 5. Async homework capture

**Data model.** New Dexie table `pendingAssignments`:

```
id, subjectId, recurrenceId?, text, createdAt
```

Added in a new DB migration version (bump `db.version(N+1)`) with no data backfill.

**Service.** New `pendingAssignmentsService` (`src/lib/services/pendingAssignments.ts`) with `add`, `remove`, `list(subjectId?, recurrenceId?)`, and `consumeFor(subjectId, recurrenceId?)` (returns texts and deletes rows).

**UI entry points.**
- On `/diary` and `/lessons` pages, add a secondary FAB (below the existing session FAB on Diary; standalone on Lessons) with an `Inbox`/`ClipboardPlus` icon.
- Tapping opens a lightweight `AddHomeworkSheet` with:
  - Subject picker (defaults to today's next lesson subject if any)
  - Optional recurrence picker filtered to that subject
  - Free-text field + save.

**LessonLogSheet integration.**
- Replace the `useEffect` that seeds `assignments` from `existingAssignments` with a `useLiveQuery` that also merges `pendingAssignments` scoped to `subjectId` + `recurrenceId`, so newly-captured homework appears in the open sheet without reopening.
- Local `assignments` state is derived from (existing lesson rows) ∪ (pending rows) ∪ (locally added drafts), de-duplicated by text.
- On save, `lessonsService.log` / `updateLesson` receives the merged list; after success we call `pendingAssignmentsService.consumeFor(...)` inside the same call so pending rows are deleted only once persisted.

**i18n.** New keys in all four languages: `homework.add`, `homework.title`, `homework.subject`, `homework.recurrence`, `homework.textPlaceholder`, `homework.pendingBadge`, `toast.homeworkAdded`.

## Technical details

- New file: `src/components/diary/SegmentHistorySheet.tsx`.
- New file: `src/components/lessons/AddHomeworkSheet.tsx`.
- New file: `src/lib/services/pendingAssignments.ts` + register in `services/index.ts`.
- Modified: `src/lib/db.ts` (new table + version bump), `src/components/diary/LastSessionStrip.tsx`, `src/lib/sampleData.ts`, `src/lib/services/backup.ts`, `src/lib/services/backup.test.ts`, `src/pages/Tasks.tsx`, `src/pages/Diary.tsx`, `src/pages/Lessons.tsx`, `src/components/lessons/LessonLogSheet.tsx`, and the four `src/lib/language/*.json` files.
- No changes to task/session schemas, backup file structure, or existing service signatures beyond `lessonsService.log/updateLesson` (unchanged — they already accept an assignments array).

Confirm and I'll implement.
