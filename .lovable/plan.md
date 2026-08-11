# Virtuoso — Improvement Suggestions

After reviewing the codebase and the existing `IMPROVEMENT_RECOMMENDATIONS.md`, here is a curated, prioritized set of suggestions. Many items from the original report are **already implemented** (wake lock, metronome, repertoire, performance readiness, spaced review, adaptive drawers, multi-day lessons, segment carousel, async homework, i18n validation, centralized date formatting, notification presets, page transitions). The suggestions below focus on what is **genuinely missing** and high-value.

---

## Tier 1 — High impact, low effort

### A. Tap-tempo & hands-free keyboard shortcuts (Practice Mode)
The metronome exists in `PracticeMode.tsx`, but tap-tempo was explicitly removed (line 44: `// Tap-tempo removed`). Musicians holding an instrument need to set tempo by tapping a large on-screen zone. Add:
- A large tap-tempo zone that derives BPM from the last 4–8 taps.
- Keyboard shortcuts during practice: **Spacebar** = start/pause metronome, **N** = next segment, **Esc** = exit. Useful for Bluetooth page-turner pedals that send space/PageDown.

### B. Pitch pipe / reference tone
The Web Audio API is already wired up for the metronome in `PracticeMode.tsx`. A reference tone generator (A440 / A442 Hz selectable) is a natural, ~50-line extension using the same `AudioContext`. Gives musicians a quick tuning reference without leaving the app.

### C. Offline-first confidence badge
A small, subtle green indicator in the app header (e.g. a dot + "Saved locally") confirming data is persisted to IndexedDB. Builds trust for a local-first app where users may worry about data loss. ~20 lines in `AppShell.tsx`.

### D. Interactive sparkline tooltips
`BpmSparkline.tsx` and `MasterySparkline.tsx` render trend lines but have no tap/hover interaction. Add a lightweight tooltip showing the date and value at each point, plus a delta indicator ("+12 BPM in 14 days"). Recharts (already a dependency) supports this natively.

---

## Tier 2 — Medium impact, medium effort

### E. One-tap quick session log
Currently logging a session requires opening `SessionLogSheet` and filling fields. Add a "quick log" path: a single tap on a task card that logs a session with sensible defaults (today's date, estimated duration from task, no quality rating) and marks the task done. Full logging remains available via the sheet. Reduces friction for routine daily practice.

### F. Smart BPM auto-increment suggestion
After a session rated 4–5 stars on a task linked to a repertoire piece or exercise, automatically suggest incrementing the target BPM by +2 to +5. Shows a toast/prompt: "Great session! Bump target from 80 → 84 BPM?" The BPM progression data already exists in sessions; this closes the loop.

### G. Replace edit routes with slide-over drawers
`/tasks/edit/:id` (`EditTaskPage.tsx`) and `/tasks/routines/edit/:id` (`EditStudyRoutinePage.tsx`) are separate full-page routes. Navigating away from the Diary/Tasks view to edit a detail breaks flow. Replace with bottom-sheet drawers (the `ResponsiveSheet` pattern already exists) that overlay the current page, keeping context.

---

## Tier 3 — High impact, higher effort

### H. Weekly teacher summary export (print-based)
No PDF library is installed. Instead of adding `jspdf`, use the browser's native print API (`window.print()`) with a dedicated print-optimized route/component that renders a clean one-page summary: total practice time, pieces worked on, tempos, and assignment notes. Works on mobile via "Save as PDF" in the print dialog. Zero new dependencies.

### I. Consolidate Collections into Library
`/library/collections` (`Collections.tsx`) is a separate page. Collections are essentially playlists/folders of library items. Move collections into the Library view as a tab or filter ("All items" / "Collections"), reducing navigation depth. The data layer already supports it.

### J. Split History into Analytics + Session Log
`History.tsx` (293 lines) mixes a detailed session audit log with the `StatsDashboard` analytics. Consider promoting the StatsDashboard to its own primary "Analytics" view (accessible from the nav or More menu) and keeping History as a pure chronological session log. Gives analytics more screen real estate for richer charts.

---

## Suggested order if you want me to implement

```
Phase 1 (quick wins):  A → B → C → D
Phase 2 (flow):        E → F → G
Phase 3 (structure):   H → I → J
```

Tell me which items (by letter) you'd like me to implement, or if you'd like me to refine any of these further.
