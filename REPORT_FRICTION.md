# Virtuoso Practice Journal — UX Friction & Optimization Report

This report identifies concrete, actionable strategies to reduce friction, minimize clicks, enforce visual/interaction consistency, and surface more useful insights. Each item follows the same structure: what to change, why, which patterns apply, and what it costs to implement.

The overarching design principle is **effortless capture + meaningful feedback**: the user should log a practice session as fast as possible (ideally 1–3 taps) and receive analytics that immediately inform how they practice next.

---

## Session Logging

---

* **Inline One-Tap Session Completion with Progressive Disclosure**
  * The checkbox on a task card already performs an auto-log, but it is visually indistinguishable from a "done" toggle and its behaviour is undiscoverable. The full session sheet has 7–15 fields, which is excessive for a daily routine where defaults are good enough most of the time. The solution is a three-level interaction: (1) one tap on the task row → instant session with intelligent defaults and a brief "undo" toast; (2) a secondary tap on a "details" chip → an expanded inline card with quality, BPM delta, and confidence in 3–4 large-touch controls; (3) an explicit "Full log" button for edge cases where extra fields are needed.
  * **UX pattern:** Progressive disclosure. Users should never see more interface than what they need for the task at hand. The first level handles 80 % of sessions; the second handles 18 %; the third handles 2 %.
  * **Impact on UX:** Reduces daily logging from ≥ 4 taps + scroll to 1 tap for the common case. Removes cognitive load of deciding which optional fields to fill. Increases the probability that every practice session gets logged.
  * **Impact on UI:** The task card needs a clearly styled "log" tap target (not a checkbox). The expanded inline card uses large-touch quality selectors (already exists in `SessionLogSheet`) and a BPM delta stepper (+5 / −5 relative to target). The full sheet becomes a secondary, opt-in path.
  * **Impact on app code:** `SessionLogSheet` stays for full editing. A new `QuickSessionRow` component wraps the task card. The auto-log logic already exists in the diary service; it just needs to be exposed more prominently. An "undo" mechanism needs a short-lived `pendingDelete` state (or soft-create with a 5-second cancellation window).
  * **Ease / maintainability:** Medium effort. The logic is already present; the work is in the UI refactor. New component adds moderate surface area. Low regression risk because the full sheet remains untouched.
  * **Notes:** The quality selector symbols (♭ ♮ ♯ ✦) are musically meaningful but not immediately legible on first use. Adding a subtle label ("hard / work / good / great") below each glyph in the quick card aids new users without cluttering.

---

* **Pre-Session Mode Selector on Task Card (Standard vs. Granular)**
  * Currently the user opens the session sheet and then discovers the "granular" toggle mid-form. Switching modes after partially filling fields forces re-entry. The mode should be chosen *before* the sheet opens.
  * **UX pattern:** Front-loading choices. Decide the shape of the task before starting it so the form presented is exactly what is needed.
  * **Impact on UX:** Eliminates mid-form mode switching, removes disorienting layout shift inside the sheet. Users with multi-segment items always know which experience they will get.
  * **Impact on UI:** Two small icon buttons on the task card (one for standard, one for granular, only visible on items with 2+ segments). Alternatively, a long-press or swipe-up on the card presents a bottom action sheet with both options.
  * **Impact on app code:** Pass a `mode` prop to `SessionLogSheet`. The component already handles both modes; no logic changes required. The trigger in `DiaryPage` (or equivalent task row component) needs a secondary entry point.
  * **Ease / maintainability:** Low effort. Purely UI surface change.
  * **Notes:** For items with only one segment, the selector should not appear at all to avoid confusing options.

---

* **Comparison Strip: Last Session's Results Inside the Log Form**
  * When a user opens the session sheet they have no reference to their previous session for the same task. They must remember or estimate their last BPM, quality, and confidence. This leads to inconsistent entries and missed trend data.
  * **UX pattern:** Contextual anchoring. Show the last data point for the same metric alongside the current input so the user can calibrate against reality.
  * **Impact on UX:** Users can see if they are improving, regressing, or plateauing without leaving the form. Motivates consistent BPM increments. Reduces "I can't remember what I entered last time" errors.
  * **Impact on UI:** A single, compact row at the top of the session sheet: `Last: ♯ good · 92 BPM · Confidence 3/5 · 3 days ago`. Subdued typography (muted foreground, caption size). No interaction required.
  * **Impact on app code:** The session sheet already queries the task and item. A single additional Dexie query for the most recent session where `taskId = currentTask.id` (or `libraryItemId`) sorted by `createdAt DESC`, limit 1. This can be done in `useEntities.ts` as a `useLastSessionForTask` hook.
  * **Ease / maintainability:** Low–medium effort. One new hook, one display component. Data query is trivial (indexed by taskId).
  * **Notes:** For theory items, show the last layer scores as a mini radar comparison. For technique items, show BPM trend (last 3 values as a micro-sparkline directly in the form header).

---

* **Smart BPM Suggestion (Auto-Increment Engine)**
  * Users frequently don't know when to raise their BPM target. The app has the data to tell them: if quality ≥ "well" and confidence ≥ 4 for the last 3 consecutive sessions at the same BPM, the app should surface a subtle suggestion: "You've hit 96 BPM consistently — try 100 today?"
  * **UX pattern:** Data-driven coaching. The app becomes an advisor, not just a logger.
  * **Impact on UX:** Removes guesswork. Provides a concrete next step without the user having to review history manually. Creates a sense of progress and forward motion.
  * **Impact on UI:** A small banner or chip inside the session form when the BPM field is focused: "Suggested: 100 BPM ↑". Tapping the chip fills the field. Dismissable.
  * **Impact on app code:** A service function `computeBpmSuggestion(taskId, sessions)` that checks recent sessions for the consistency condition. Called once when the session sheet opens. No real-time computation needed.
  * **Ease / maintainability:** Medium effort. The rule logic is simple; the harder part is edge-case handling (sessions with no BPM, theory items, first 3 sessions). Should be behind a feature flag or clearly optional.
  * **Notes:** Also applicable to the Library item's `targetBpm` field. If multiple sessions reach `targetBpm`, the app could suggest raising `targetBpm`.

---

* **End-of-Day Summary Card**
  * When all tasks are completed (or at a configurable time), show a full-screen (or hero-card) summary of the session: total time practiced, quality distribution, BPM gains, notes streak. This replaces the raw task list as the "done state" of the diary.
  * **UX pattern:** Reward loop / closure state. A clear "done" screen reinforces habit formation. Used by Duolingo, Headspace, and fitness apps to close the activity loop.
  * **Impact on UX:** Creates emotional closure. Gives a quick sense of accomplishment. Surfaces the most important metrics from the day without the user having to navigate to History.
  * **Impact on UI:** Replace the hero card's progress ring with a celebration state when done/total = done/total = 100 %. Display a compact table: task name · quality · BPM. One "View full history" link. One motivational quote (already in the EmptyState pattern).
  * **Impact on app code:** The diary already knows done/total counts. Conditional rendering on the hero card component. The session data needed is already fetched. No new queries.
  * **Ease / maintainability:** Low–medium effort. Conditional render only; no new routes or data.
  * **Notes:** Do not make this dismissal-mandatory. Users who have leftover tasks should not be "tricked" into thinking they are done.

---

## Task Management

---

* **Task Creation via Contextual Entry Points (Reduce Navigation Depth)**
  * Currently creating a task always requires navigating to `/tasks/new`, a full-page form. Most task creation happens in one of three contexts: (a) from a library item ("practice this piece"), (b) from a lesson assignment ("make this a task"), (c) from the diary ("add a task for today"). Each context has different defaults and should pre-fill the form accordingly. Instead of routing to `/tasks/new` cold, each entry point should open a bottom sheet with the fields pre-populated for that context.
  * **UX pattern:** Context-aware entry points. The form shape adapts to where the user triggered it, eliminating redundant field-filling.
  * **Impact on UX:** Reduces task creation from 7+ interactions to 3–4. Assignments-to-task flow already partially does this; the pattern should be generalized to library items and diary.
  * **Impact on UI:** "Practice this" button on library item cards → opens `NewTaskSheet` pre-filled with item, subject, title. A "+" button on the diary page → opens a slim "quick task" sheet with subject + title (free-form only). Assignment's "Make task" button → pre-fills subject + title (already partially done).
  * **Impact on app code:** Extract the task form logic from `NewTaskPage` into a `NewTaskSheet` component that accepts an optional `initialValues` prop. The full `/tasks/new` page can wrap this sheet for the standalone flow. Significant refactor of the form into a reusable component.
  * **Ease / maintainability:** High effort upfront, but pays dividends. The form is currently monolithic in `NewTaskPage`; extracting it improves testability and reusability. Maintenance cost is moderate because a single form component now handles multiple entry scenarios.
  * **Notes:** The study routine wizard is complex enough that it should remain a full page — it's not a contextual entry, it's a configuration task. Only the standard task form benefits from this change.

---

* **Task Creation: Intelligent Wizard with Step Summary**
  * The standard task form presents all fields simultaneously with conditional visibility, creating a long scroll. A 3-step wizard (What → How → When) reduces cognitive load by presenting only relevant fields per step, with a persistent summary sidebar showing what has been selected.
  * Step 1 "What": Subject, link type (free / item / collection), item/collection picker with live search.
  * Step 2 "How": Title (pre-filled, editable), BPM + noteVal, layers, techniques.
  * Step 3 "When": Recurrence toggle, weekday/interval picker, end condition.
  * **UX pattern:** Multi-step wizard with breadcrumb progress. Used in onboarding flows, checkout, and anywhere configuration spans multiple decision points that do not need to be visible simultaneously.
  * **Impact on UX:** Users always know how far through they are. Each step has 2–4 fields max, not 8–10. Back navigation between steps preserves state.
  * **Impact on UI:** Sticky step indicator at the top (3 dots or "1 of 3"). Step content in the center. "Next" / "Back" / "Save" buttons at the bottom. A compact summary chip bar below the step indicator ("Piano · Beethoven Sonata · Weekly Mon/Wed").
  * **Impact on app code:** Significant refactor of `NewTaskPage`. The form state already exists as a unified object; the visual split is a container change. Steps can be implemented as conditional rendering of sub-sections within the same form state. No data layer changes.
  * **Ease / maintainability:** Medium–high effort for UI. Data and validation logic is unchanged. Adding a step adds a JSX block; this pattern scales well.
  * **Notes:** Users who know what they want should be able to jump to any step (clicking the step indicator). Power users on desktop might prefer a single-page layout — this could be a profile toggle ("compact forms").

---

* **Batch Task Operations (Mark All Done, Archive Old Tasks)**
  * The Tasks page lists tasks one-by-one with no multi-select. Users who have many completed tasks must delete or dismiss them individually. A multi-select mode (long-press or checkbox mode toggle) with a bulk action bar ("Delete selected", "Move to today") reduces this to a single confirmation.
  * **UX pattern:** Batch / multi-select action. Standard in email clients, file managers, and to-do apps (Things 3, Todoist).
  * **Impact on UX:** Bulk cleanup of old or completed tasks becomes a 3-tap operation instead of N individual delete confirmations.
  * **Impact on UI:** A "Select" button at the top of the task list activates checkboxes. A sticky bottom bar appears with action counts ("3 selected") and action buttons. Deselect all / Exit selection mode via an X button.
  * **Impact on app code:** Multi-select state in the Tasks page component. Batch delete/move operations already exist in the service layer as single-record calls; a new `batchDeleteTasks(ids[])` function in `tasks.ts` would be a small addition.
  * **Ease / maintainability:** Medium effort. The UI pattern is well-understood. Service-layer batch function is straightforward. Soft delete safety is already handled.
  * **Notes:** Soft-delete logic means "Delete" in batch mode may soft-delete or hard-delete depending on whether sessions exist. The batch action label should be "Remove" (ambiguous between hard/soft) to avoid confusing users.

---

* **Drag-to-Reorder Daily Tasks on Diary Page**
  * The diary shows today's tasks in a fixed order (presumably creation order or DB insertion order). Musicians often want to warm up with scales before tackling a concerto, or may have energy-dependent preferences (difficult pieces first or last). There is no way to reorder the day's tasks.
  * **UX pattern:** Drag-and-drop list reordering. Used in any prioritized task manager (Things, Reminders, Linear).
  * **Impact on UX:** Lets users mentally organize their practice session before starting. A clear ordering reduces decision fatigue during practice ("what do I do next?").
  * **Impact on UI:** Drag handles (⠿ grip icon) on each task row, visible in a "reorder" mode activated by a small button. Or persistent drag handles if the list is short.
  * **Impact on app code:** Requires a `position` or `order` field on the `tasks` table (new column, new migration). A `reorderDiaryTasks` service function updates positions. The `useLiveQuery` hook for diary tasks must sort by `position`. Moderate data layer change.
  * **Ease / maintainability:** Medium effort. The DB migration is a straightforward new column with a default of `createdAt` as initial sort value. The drag-and-drop library (react-beautiful-dnd or @dnd-kit/core) adds a dependency. The sort order needs to be preserved across carryovers.
  * **Notes:** If tasks are generated by a study routine, their order is algorithmically determined. Drag reordering should only affect the "today" view, not the underlying task definition.

---

* **Subject Quick-Filter on Diary Page**
  * Musicians often practice multiple subjects per day (piano + music theory + ear training). There is no way to filter the diary to show only the tasks for one subject when context-switching. The user must mentally scan all tasks.
  * **UX pattern:** Chip-based filter bar. Used in content feeds, task managers, and library apps where items belong to distinct categories.
  * **Impact on UX:** Reduces scan time when practicing a specific subject in a focused session. Prevents accidental logging on the wrong subject's task.
  * **Impact on UI:** A horizontal scrolling chip row below the hero card. Each chip represents a subject present in today's tasks, with a count badge ("Piano 3", "Theory 2"). "All" chip selected by default.
  * **Impact on app code:** Filter state in the diary page component. `useLiveQuery` already returns all today's tasks; the filter is applied in-memory. No DB changes.
  * **Ease / maintainability:** Low effort. Pure UI state change. Chips derived from the existing tasks array.
  * **Notes:** The filter should persist for the session (local state, not URL params) since it's a transient view preference.

---

## Navigation & Information Architecture

---

* **Persistent "Add Session" Floating Action Button (FAB)**
  * There is no globally accessible way to log an ad-hoc session that was not planned as a task. A musician might do an unscheduled review of a piece and want to log it. Currently, this requires creating a task first or navigating to an existing task. A FAB that opens a minimal "free session" sheet (item picker + quality + notes) would handle this case.
  * **UX pattern:** FAB for primary action. Used in Material Design, Notion, Linear, and anywhere the dominant action is "create something new." The FAB floats above content and is always reachable.
  * **Impact on UX:** Removes the "I need to create a task before I can log" mental block. Enables retrospective logging ("I forgot to log yesterday's practice"). Reduces the steps from 4+ to 2.
  * **Impact on UI:** A ✦ or + FAB in the bottom-right corner of the diary and history pages. Hides on scroll-down (same behaviour as the nav bar). Opens a compact bottom sheet: date (today by default), subject, item (optional), quality, notes.
  * **Impact on app code:** The FAB trigger creates a session without a task ID (`taskId: null`). The sessions service and `SessionLogSheet` already partially support this (sessions have an optional `taskId`). A "free session" mode in the sheet needs to expose the item picker.
  * **Ease / maintainability:** Medium effort. Session creation without task is already supported in the data model. The UI work is a new sheet variant and the FAB component itself.
  * **Notes:** Free sessions should appear in History with a distinct visual indicator (no task name, just item name and date). Filtering "free sessions" vs. "task sessions" could be a useful History filter.

---

* **Bottom Navigation: Active Tab Persistence and Deep Link Memory**
  * When navigating away from a tab (e.g., Library → Diary → Library) the Library scroll position and active kind tab reset. On mobile, users frequently context-switch between the diary and library. Losing scroll position creates significant re-navigation cost.
  * **UX pattern:** Scroll position preservation / view state memory. iOS UITabBarController persists each tab's scroll state; most native apps do this. Web equivalent: keep components mounted or save scroll position in session state.
  * **Impact on UX:** Eliminates the "where was I?" experience. Reduces wasted taps when quickly checking library context and returning to diary.
  * **Impact on UI:** No visible change. The tabs appear identical; the difference is invisible but felt.
  * **Impact on app code:** React Router v6 does not persist component state across tab navigations by default (pages unmount). Options: (a) keep the 5 tab pages mounted and use CSS `display:none` to hide inactive ones; (b) store scroll offsets and active filters in a Zustand/Context store keyed by route, and restore on mount. Option (b) is safer (less memory) but requires more code.
  * **Ease / maintainability:** Medium effort. Option (b) is the cleaner approach. A `useViewState(routeKey)` hook that reads/writes to a React Context on unmount/mount. Adds a small global state layer.
  * **Notes:** This is one of the highest-ROI changes for daily users. The irritation of losing context compounds over hundreds of sessions.

---

* **Contextual Navigation: "Open in History" from Task Card**
  * A task card on the diary shows the last session's result, but there is no direct link to the full history of that task. Users who want to see a trend must navigate to History, switch to "Task" grouping, and search for the task name — 4–6 taps.
  * **UX pattern:** Deep-link / contextual drill-down. Items that represent tracked data should provide a direct path to their analytics.
  * **Impact on UX:** Reduces analytics access from 4–6 taps to 1. Encourages engagement with trend data, which is the primary value of a practice journal.
  * **Impact on UI:** A small "↗ History" icon button on the task card (or in the task's detail sheet). Navigates to `/history?taskId=X` with the task pre-selected. Alternatively, a "View trend" bottom sheet that embeds the relevant sparklines inline without leaving the diary.
  * **Impact on app code:** History page already accepts URL params. Adding `taskId` as a filter param and pre-selecting "Task" grouping is a small change to the History page's filter initialization logic.
  * **Ease / maintainability:** Low–medium effort. The History filter logic and URL param handling already exist. The deep-link requires only a new optional param and the UI trigger.
  * **Notes:** Similarly useful from library item cards: "View full history" → `/history?itemId=X` with "Item" grouping pre-selected.

---

* **Lessons Integration in Diary Hero Card**
  * If the user has a lesson today (based on their recurrence schedule), there is no mention of it on the diary. They must navigate to the Lessons tab to see upcoming lessons. A lesson that day should influence what the user focuses on — they might want to prepare specific pieces.
  * **UX pattern:** Unified daily view. Best-in-class daily planner apps (Fantastical, Structured) consolidate all time-sensitive events in a single view.
  * **Impact on UX:** Users are reminded to prepare for lessons. Reduces the cognitive cost of cross-referencing the diary and lessons tabs before practice.
  * **Impact on UI:** A compact "Lesson today" banner below the hero card (or within it), showing the teacher's name, subject, and time. A "Log lesson" quick-button on the banner.
  * **Impact on app code:** The diary page needs to query upcoming lessons for today. The recurrence calculation logic already exists in the lessons service. A new `useTodayLesson` hook using the existing recurrence data.
  * **Ease / maintainability:** Medium effort. The recurrence-to-dates calculation may need to be extracted as a utility for use outside the Lessons page.
  * **Notes:** If the user has multiple teachers (multiple recurrences), show all today's lessons stacked. Tapping the banner navigates to the Lessons page.

---

## Analytics & Insights

---

* **Practice Streak and Consistency Tracker**
  * The app has no streak mechanic or consistency metric. Users have no daily motivation signal beyond the task completion counter. A streak (consecutive days with ≥ 1 logged session) and a weekly consistency score (sessions this week vs. target) are the most effective behavioral nudges in habit-forming apps.
  * **UX pattern:** Streak / habit tracking. Used in Duolingo, Headspace, Strava, and most habit-tracker apps. The streak number creates a loss-aversion effect ("I don't want to break the streak") that is far more motivating than completion percentages.
  * **Impact on UX:** Provides a persistent, visible reason to open the app and log at least one session daily. The stat is glanceable (one number) and emotionally resonant.
  * **Impact on UI:** A flame icon (🔥 or custom SVG) with a number in the hero card or as a persistent chip in the diary header. A secondary "Best streak: N days" below it. A weekly grid (7 dots, filled = practiced) could replace or supplement.
  * **Impact on app code:** `computeStreak(sessions[])` function: sort sessions by `createdAt`, count consecutive calendar days ending today. This is a pure function with no DB changes needed. Add to the stats service. Expose via a `useStreakStats` hook.
  * **Ease / maintainability:** Low effort. Pure computation on existing data. No DB changes. The only gotcha is timezone handling (use local date, not UTC).
  * **Notes:** The "grace day" setting in Profile already exists and should feed the streak computation (a missed day within the grace period does not break the streak). This is already partially anticipated in the data model.

---

* **Per-Item Progress Dashboard (Dedicated Analysis View)**
  * The `ItemAnalysisSheet` currently shows some statistics, but it opens as a sheet inside the Library page. It is not easily navigable from the History page and lacks trend depth (BPM progress over full history, quality trend, confidence trend, sessions per week). A dedicated `/library/item/:id/analysis` page would allow full-width charts and longer time horizons.
  * **UX pattern:** Detail analytics page. Used in fitness apps (Strava segment efforts, Apple Fitness+ workout history), music practice apps (Tonestro), and learning platforms (Duolingo skill progress). The item's full history deserves a full-screen view.
  * **Impact on UX:** Users can make informed decisions about which items to focus on. Seeing a flat BPM trend for 3 weeks is a clear signal to change approach. Seeing quality consistently below "well" suggests the item is too difficult.
  * **Impact on UI:** Full-screen page with: a BPM line chart (target vs. reached, full history), a quality distribution bar chart (hard / work / good / great per week), a confidence trend line, a sessions-per-week bar chart, and a list of all logged sessions (with notes preview). Use the existing terracotta/sage/gold/blue/plum palette as series colors.
  * **Impact on app code:** The analysis sheet component already has some of this. Moving it to a full page requires a new route (`/library/item/:id/analysis`) and extracting/expanding the chart components. The data queries are already available via `useEntities.ts`.
  * **Ease / maintainability:** Medium effort for the route/page. High effort if the chart library needs to be expanded (check if recharts/visx is already a dependency). The biggest maintenance cost is chart responsiveness across screen sizes.
  * **Notes:** Theory items have a fundamentally different metric space (5 mastery layers vs. BPM). The analysis page must conditionally render the appropriate chart set based on `kind`.

---

* **Weekly Practice Overview in History (Default View)**
  * The History page defaults to a list with grouping options. The most actionable view for a musician is a weekly overview: "This week I practiced 5 days, 4.5 hours, with these quality distributions." The "Day" grouping exists but is not the default top-of-page experience. An always-visible weekly summary card above the grouping options would provide instant context without requiring the user to scroll or change filters.
  * **UX pattern:** Dashboard summary card. The top of an analytics page should answer the most common question ("How am I doing this week?") before offering deeper drill-down options.
  * **Impact on UX:** Reduces the number of steps to get a weekly snapshot from "navigate to History → select date range → read list" to "navigate to History → read summary card" (2 taps instead of 5+).
  * **Impact on UI:** A horizontally scrollable card row at the top of the History page: "This week", "Last week", "This month". Each card shows: days practiced, total sessions, dominant quality, longest session, most practiced item. Below this, the existing grouping tabs and list remain unchanged.
  * **Impact on app code:** Pre-compute weekly stats from the existing `useSessions` query. The computation is the same as `StatsDashboard` but scoped to the current/last week. The `StatsDashboard` component might be refactored into a `StatsCard` component that accepts a `sessions` slice.
  * **Ease / maintainability:** Medium effort. The `StatsDashboard` already exists; scoping it to weeks and making it a card requires layout refactoring rather than logic refactoring.
  * **Notes:** The most important metric for a practice journal is "days practiced per week" — this should be the largest, most prominent number on the card.

---

* **Trend Alerts and Practice Recommendations on Diary Page**
  * The app collects rich data but offers no proactive recommendations. A user who has not practiced a piece in 2 weeks, or whose BPM has been flat for 5 sessions, or whose quality on a piece is declining, receives no signal from the app. These insights exist in the data and should surface as unobtrusive alerts or suggestions.
  * **UX pattern:** Proactive coaching / smart notifications. Used in fitness apps (Strava training load alerts), sleep trackers (Oura ring), and learning apps. The app moves from passive logger to active coach.
  * **Impact on UX:** Users act on data they would otherwise miss. A declining quality trend is visible in the charts but not noticed because users rarely check History. A push-style alert in the diary ("You haven't practiced Beethoven Op.109 in 14 days") closes the feedback loop.
  * **Impact on UI:** A collapsible "Insights" section on the diary page between the hero card and the task list. Shows 1–3 alert chips: "↓ Quality declining on [Item]", "⏸ [Item] not practiced in 14 days", "↑ Ready to raise BPM on [Item]". Each chip is tappable (links to item history or opens session sheet).
  * **Impact on app code:** A `computePracticeAlerts(sessions[], tasks[], items[])` service function. Rules: (a) item not in tasks for N days (N = profile carryoverDays * 3); (b) last 3 quality ratings for item all "hard" or "improve"; (c) BPM flat for 3+ sessions at same target BPM. Returns an array of `Alert` objects. Displayed in diary, refreshed on Dexie live query update.
  * **Ease / maintainability:** Medium effort. The alert logic is pure computation; the display component is simple. The risk is alert fatigue — the system should show at most 3 alerts and prioritize by recency.
  * **Notes:** Alerts should be dismissable (per-item, stored in local state or a small `alerts` table with `dismissedAt`). A dismissed alert should not reappear for at least 7 days.

---

* **Mastery Progress Indicator on Library Items**
  * Each library item has layers (conceptual, analytical, etc.) and BPM data, but the "mastery score" is not surfaced as a single glanceable value on the item card. Users must open the analysis sheet to see the radar chart. A single composite score (0–100 or a percentage) computed from the item's own layer scores and BPM progress would let users quickly assess where each item stands.
  * **UX pattern:** Single-metric summary with drill-down. The card summarizes; the sheet details. Used in fitness dashboards (VO2 max), language apps (fluency score), and any domain where multiple sub-dimensions compose into a performance metric.
  * **Impact on UX:** Library page becomes scannable at a glance. "Which pieces need work?" is answerable without opening any sheets.
  * **Impact on UI:** A small circular progress indicator (ring or arc, 0–100 %) on each item card, colored by range (red < 40, amber 40–70, green > 70). Optional: a text "Mastery 68 %" below the ring. Clicking the ring opens the analysis sheet.
  * **Impact on app code:** `computeItemMastery(item, sessions[])` function. For theory: average of last layer scores across all 5 dimensions. For repertoire/technique: composite of BPM progress (currentBpm / targetBpm * 50 %) + average quality score (last N sessions * 50 %). This is heuristic and should be adjustable. Surfaced in the library item hook or computed in the card component.
  * **Ease / maintainability:** Medium effort. The computation adds a function; the ring component is reusable. The definition of "mastery" is subjective and the formula may need iteration based on user feedback — keep the algorithm configurable.
  * **Notes:** Consider a "Needs attention" sort option on the library page that ranks items by mastery score ascending (lowest mastery first). This is a one-line sort addition once the score is computed.

---

* **Practice Time Tracking (Automatic and Manual)**
  * The app has a Practice Mode with a wall-clock timer, but the elapsed time is not stored as a session field — it is only inserted as a note text. There is no "time practiced" metric visible in any analytics view. Tracking practice duration is a fundamental goal for most musicians (practicing 30 min/day vs. 2 hours/day makes a significant difference in outcomes).
  * **UX pattern:** Duration-first logging. Fitness apps (Strava, Whoop) always log duration as a primary, first-class metric. For a practice journal, duration is arguably more important than BPM.
  * **Impact on UX:** Users can set weekly practice time goals and see if they are meeting them. History analytics gain a "total time this week" metric. The diary hero card can show "60 min practiced today."
  * **Impact on UI:** Duration field in the session log form (number input in minutes, or time picker). Pre-filled from Practice Mode elapsed time (already partially done via notes). Shown on task cards as "45 min last session." Weekly total shown in History summary card.
  * **Impact on app code:** Add `durationMinutes` column to the `sessions` table (new migration). Update session log schema (Zod) and service functions. Update history analytics queries to sum duration. Pre-fill from Practice Mode. This is a non-trivial but contained DB change.
  * **Ease / maintainability:** Medium–high effort due to DB migration. The migration is additive (nullable column), so existing data is preserved. The new field flows through the session form → service → history analytics chain, touching multiple files. Well worth the maintenance cost given the value of the data.
  * **Notes:** Manual entry should accept "45 min" or "1:30" format. The field should be optional and default to empty (not 0) to avoid polluting analytics with zero-duration entries. The Practice Mode timer should auto-fill this on session close.

---

## Forms & Input Patterns

---

* **Consistent Form Layout: Two-Column Grid on Tablet/Desktop**
  * Forms currently stack all fields vertically in a single column. On larger screens (tablet landscape, desktop) this wastes horizontal space and makes forms feel very tall. Related field pairs (BPM + Note Value, Start BPM + Target BPM, Quality + Confidence) could sit side by side without confusion.
  * **UX pattern:** Responsive two-column form layout. Used in admin dashboards, settings panels, and any data-entry-heavy UI when screen width permits. Groups conceptually related fields horizontally.
  * **Impact on UX:** Reduces vertical scrolling in sheets on larger screens. Visually communicates the relationship between paired fields (BPM and noteVal are always entered together).
  * **Impact on UI:** Use a CSS Grid with `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))` for form field pairs. Tailwind `grid grid-cols-2 gap-4` on a container div wrapping paired fields. Single-column on mobile (< 640 px), two-column on `sm:` and above.
  * **Impact on app code:** Pure CSS/layout change. No logic changes. Requires identifying paired fields in each form and wrapping them in a grid container.
  * **Ease / maintainability:** Low effort. CSS-only. No new components. Risk: some field labels may be too long for a two-column layout — truncation testing required.
  * **Notes:** The session log sheet is the most critical beneficiary since it has the most fields. The library item form (segments editor) would also benefit significantly on larger screens.

---

* **Input Auto-Advance on Selection in Chip Pickers**
  * The `MultiChipPicker` component (used for layers, techniques, tags) requires the user to: open the picker, select items, then explicitly close or move to the next field. When only one item needs to be selected, the close step is unnecessary friction.
  * **UX pattern:** Auto-advance after single selection. When a single-select field (like "Subject" or "Quality") is resolved, immediately advance focus to the next field. For multi-selects, keep the picker open until a "Done" tap or focus-away event.
  * **Impact on UX:** Removes the explicit "close picker" tap in common single-selection scenarios. Reduces form completion time by 1 tap per picker field.
  * **Impact on UI:** For quality selector (already 4 buttons): tapping a button auto-closes and advances. For subject picker (always single): auto-advance after selection. For multi-chip pickers (layers, techniques): keep open, add a "Done" button.
  * **Impact on app code:** Modify `Select` and quality button components to call `onNext()` after selection. The multi-chip picker already has a close mechanism. The quality selector needs a callback prop `onSelect` that fires and closes.
  * **Ease / maintainability:** Low effort per picker. The pattern is consistent once defined. Risk: users who want to review their selection before advancing may find auto-advance disorienting — test with real users.
  * **Notes:** Auto-advance should respect the form's natural tab order. On mobile, "advancing" means scrolling to the next field, not triggering keyboard focus (which would open the soft keyboard unexpectedly).

---

* **Form Draft Auto-Save to sessionStorage**
  * Complex forms (task creation, library item, study routine wizard) have no draft persistence. If the user accidentally taps "Back" or the browser is refreshed, all entered data is lost. This is especially painful for the study routine wizard (3-step, 15+ fields).
  * **UX pattern:** Auto-save drafts. Used in email clients (Gmail's draft saving), long-form editors (Notion, Medium), and any multi-field form where completion takes more than 30 seconds.
  * **Impact on UX:** Eliminates the anxiety of accidental data loss. Users who pause mid-form (take a call, switch apps) can return to exactly where they left off. Reduces form abandonment.
  * **Impact on UI:** A subtle "Draft saved" indicator (1 second toast or a small chip below the form title). On re-opening the form, a "Resume draft?" banner at the top with a "Resume" and "Start fresh" button.
  * **Impact on app code:** `useDraftForm(formKey, initialValues)` hook that uses `useEffect` to write form state to `sessionStorage` on every change (debounced 500 ms) and reads it on mount. The form key should include the entity type and optionally the entity ID (e.g., `"newTask"`, `"editLibraryItem:42"`). The hook returns `[value, setValue, clearDraft]`.
  * **Ease / maintainability:** Medium effort. The hook is reusable across all forms. The `sessionStorage` schema must be versioned to avoid stale drafts after app updates. `clearDraft()` must be called on successful submit.
  * **Notes:** Do not use `localStorage` for drafts (persists too long, creates confusion on return visits). `sessionStorage` is cleared when the tab closes, which is the right behavior.

---

* **Unified Empty State Pattern with Contextual CTAs**
  * Various pages and sections show different empty states with inconsistent visual styles and CTA labels. The EmptyState component exists but is not used uniformly — some empty states are plain text, some are missing entirely, and some have conflicting CTA wording ("Add task" vs. "New task" vs. "Create task").
  * **UX pattern:** Consistent empty states. Every empty list, every first-use experience, every zero-data view should use the same component with a consistent structure: icon, title, subtitle, one CTA button. The CTA label must match the corresponding "add" button label in the non-empty state (same verb, same noun).
  * **Impact on UX:** Users learn the vocabulary once ("New task" always creates a task; "Add item" always adds a library item). No cognitive overhead deciding which empty state to act on.
  * **Impact on UI:** Audit every `EmptyState` and every "no results" text in the app. Replace all with `<EmptyState icon="..." title="..." subtitle="..." cta={{ label: '...', onClick: ... }} />`. Standardize CTA labels across the entire app.
  * **Impact on app code:** The `EmptyState` component already exists. This is a textual and component-usage audit. Create a vocabulary table (e.g., in CLAUDE.md) defining the exact label for each entity's create action.
  * **Ease / maintainability:** Low–medium effort (tedious but mechanical). Reduces future inconsistency if the vocabulary table is maintained.
  * **Notes:** Empty states are also opportunities for onboarding tips ("No tasks yet — tasks represent individual practice goals. [Create your first task →]"). A second line of explanatory text helps new users understand what to do.

---

* **Standardize Destructive Action Confirmations (One Pattern Only)**
  * Currently, some destructive actions use `AlertDialog` (with a typed "DELETE" confirmation for wipe-all-data), some use a simple confirm dialog, and some appear to fire immediately (some delete buttons on task cards). Users cannot predict which pattern will apply.
  * **UX pattern:** Contextual confirmation scaling. Low-risk deletes (a task with no sessions): one tap (no confirmation, with undo toast). Medium-risk deletes (a library item with sessions, soft delete): one confirmation dialog. High-risk deletes (wipe all data): typed confirmation. The severity of the gesture should match the severity of the action.
  * **Impact on UX:** Removes the anxiety of clicking any delete button ("Will this ask me again?"). Experienced users are not slowed down by unnecessary confirmations on trivial deletes.
  * **Impact on UI:** Three distinct UI patterns: (1) Delete button → immediate delete + "Undo" toast (5 seconds); (2) Delete button → bottom sheet with "Delete [Item Name]" headline, brief consequence description, and a red "Delete" button; (3) Danger zone actions → typed confirmation dialog (already implemented).
  * **Impact on app code:** Define a `useDestructiveAction` hook that selects the appropriate confirmation pattern based on `severity: "low" | "medium" | "high"`. The undo mechanic for "low" severity requires a temporary `pendingDelete` state that defers the actual DB call by 5 seconds.
  * **Ease / maintainability:** Medium effort. The hook centralizes the pattern, reducing the number of ad-hoc confirmation implementations. Future destructive actions automatically benefit from the pattern.
  * **Notes:** The "Undo" toast is the single highest-ROI UX improvement for confidence in deleting: it removes fear of accidental deletion without requiring a confirmation click.

---

## Visual Consistency & Design System

---

* **Standardize Section Headers Across All Pages**
  * Different pages use different typographic patterns for section titles. Some use `<h2>` with direct children styling, others use a `CardHeader` pattern, others use raw `<p>` with bold class. The visual hierarchy is inconsistent, making the app feel less polished and harder to scan.
  * **UX pattern:** Design token / component-driven typography. All section headers use a single `<SectionHeader>` component (or consistent Tailwind class combination) so every page speaks the same visual language.
  * **Impact on UX:** Users unconsciously learn the visual grammar. A consistent header style means "I know this is a section boundary" without having to read the text. Reduces cognitive parsing load.
  * **Impact on UI:** Define a `<SectionHeader title="..." action={<Button />} />` component used on every page. Standardize to: title in `font-serif text-lg font-semibold tracking-wide`, optional right-aligned action button, a 1 px divider below.
  * **Impact on app code:** One new `SectionHeader` component. An audit pass replacing all ad-hoc section headers with it. Low risk of regressions (purely presentational).
  * **Ease / maintainability:** Low effort. High payoff in visual cohesion. Easier to update the design system in the future (one component to change vs. many inline classes).
  * **Notes:** The same argument applies to card action menus (the "..." dropdown). All cards should use an identical `<CardActions>` component with the same icon, same placement (top-right), and same dropdown style.

---

* **Consistent Icon Usage (One Icon per Concept, No Synonyms)**
  * A quick audit suggests inconsistency in icon usage: some "edit" actions use a pencil icon, others might use a gear or three-dot menu. Some "delete" actions use a trash icon, others an X. "Add" actions use both "+" and a dedicated FAB depending on context.
  * **UX pattern:** Icon vocabulary. Pick one icon per semantic action and use it everywhere: pencil = edit, trash = delete, + = add/create, ✕ = close/cancel, ↩ = go back, ✓ = complete, ♦ = session/log. Never use two different icons for the same concept.
  * **Impact on UX:** Users learn the icon set once. After a few sessions, they navigate by icon shape without reading labels. This is the "automated use" the user goal describes.
  * **Impact on UI:** Create an `icons.ts` re-export file that defines the semantic mapping: `export const EditIcon = Pencil; export const DeleteIcon = Trash2; ...`. All components import from this file. If the icon needs to change globally, it changes in one place.
  * **Impact on app code:** One new file, then a find-and-replace pass on icon imports. Zero logic changes.
  * **Ease / maintainability:** Low effort. High maintainability benefit. Enforced by the single import file.
  * **Notes:** Lucide React (already used) has sufficient icon coverage for all concepts needed. No new icon library required.

---

* **Color-Coding Subjects Consistently Across the Entire App**
  * The app has 5 theme colors (terracotta, sage, gold, blue, plum). Collections use these colors. But subjects (instruments, theory) appear to use either a generic color or inconsistent coloring across pages. If each subject were assigned a stable color from the palette, users would immediately recognize which subject a task, session, or library item belongs to by color alone, without reading the subject label.
  * **UX pattern:** Semantic color coding. Used in calendar apps (Google Calendar event colors), project managers (Linear teams/labels), and any app with multiple distinct categories. Color becomes a primary navigation aid.
  * **Impact on UX:** Glanceable subject identification. On the diary page, color-coded task rows let users scan their day by color (blue = piano, gold = theory). On History, color-coded bars immediately communicate subject distribution. Reduces reading load by ~50 % for daily use.
  * **Impact on UI:** When a subject is created in the Subjects editor, assign a color from the palette (the user can change it). Store `color` on the `subjects` table. Use the color as a left-border accent on task cards, a background tint on subject chips, and the color of the subject label everywhere.
  * **Impact on app code:** New `color` column on `subjects` table (migration). Auto-assign from the 5 palette colors in round-robin order on creation. Propagate color to task cards, library item cards, session log chips. Medium data-layer change with wide UI propagation.
  * **Ease / maintainability:** Medium effort for the migration and propagation. The color value is just a string; it flows wherever the subject is displayed. The 5-color palette limit means users may share colors if they have > 5 subjects — acceptable for this app's expected scale.
  * **Notes:** This single change would make the diary page dramatically more scannable. It should be one of the highest-priority visual changes. The onboarding flow should assign default colors automatically based on the subject preset selected.

---

* **Study Routine Wizard: Visual Week-Grid Preview**
  * The study routine matrix (Step 3: day × group) is currently a numeric input grid. Users enter "2" in Monday/Group1 but have no visual sense of what that looks like as a week of tasks. A visual preview below the matrix showing the generated tasks for the coming week (by day) would make the schedule tangible before saving.
  * **UX pattern:** Preview-before-confirm. Used in email template builders, calendar scheduling tools, and any configuration UI where the output is a visual/temporal artifact. Show the user what they are creating, not just the parameters.
  * **Impact on UX:** Removes the "I'm not sure what this will produce" uncertainty from the routine wizard. Reduces configuration errors (discovering the routine generates 12 tasks on Monday when 4 was intended). Builds confidence before saving.
  * **Impact on UI:** A collapsible "Preview" section at the bottom of Step 3. Shows 7 day-columns, each with a list of task names that would be generated based on the current matrix values. Updates live as the matrix is edited. Uses the subject's color coding (see above).
  * **Impact on app code:** The routine generation logic already exists. Extracting it as a pure function `previewRoutineWeek(matrix, groups, items)` (without writing to DB) and calling it with the current wizard state requires refactoring the generation logic to be DB-independent. Medium effort.
  * **Ease / maintainability:** Medium–high effort. The routine generation has side effects (DB writes) that must be separated from the preview computation. Well-designed separation improves testability.
  * **Notes:** The preview should show the *first* week of generated tasks, not an abstract representation. If spaced repetition is enabled, note that subsequent weeks will differ.

---

## Library & Collections

---

* **Quick-Add Library Item from Task Creation (Inline Creation Flow)**
  * When creating a task and selecting an item, if the item does not exist yet, the user must: cancel task creation, go to Library, create the item, return to task creation, and re-enter all previous values. This breaks the flow entirely.
  * **UX pattern:** Inline creation in pickers. Used in project management tools (Linear: create a team while creating a ticket), CRMs, and any nested entity relationship where the child entity might not exist yet. The picker has a "Create new…" option that opens an inline mini-form.
  * **Impact on UX:** Removes a complete context-switch and flow restart. Creates a seamless "I want to practice this piece → create task → create piece" experience without navigation.
  * **Impact on UI:** In the item picker within task creation, a "Create new item" option at the bottom of the dropdown/sheet. Tapping it opens a slim "Quick add item" sheet (title, composer, kind, subject). On save, the new item is automatically selected in the parent form.
  * **Impact on app code:** The `NewLibraryItemSheet` component already exists. It needs to accept an `onCreated(item)` callback. The item picker in task creation calls `onCreated` to select the newly created item. A nested sheet (sheet inside sheet) is the UI pattern used elsewhere in the app, so it is consistent.
  * **Ease / maintainability:** Medium effort. The sheet component already exists. The nested-sheet pattern is already established. The main risk is state coordination between the nested sheet and the parent form.
  * **Notes:** The quick-add item should only require title, subject, and kind. Advanced fields (segments, tags, BPM targets) should be editable later from the Library page. This is a "good enough to get started" creation flow.

---

* **Library Sorting: Add "Needs Attention" Sort**
  * The library currently sorts by Recent, Title, or Composer. There is no way to surface items that have been neglected (not practiced in a long time) or are declining in quality. A "Needs attention" sort (by longest time since last session) would help users identify gaps in their practice.
  * **UX pattern:** Smart sorting by behavioral signal. Used in spaced repetition apps (Anki), learning platforms (Duolingo word review), and any app where recency of engagement is a primary concern.
  * **Impact on UX:** Users no longer need to mentally track which pieces they haven't touched. The app surfaces neglected items automatically.
  * **Impact on UI:** Add "Needs attention" to the sort dropdown. Sorts by `lastSessionDate` ascending (oldest first). Items never practiced appear at the top.
  * **Impact on app code:** `lastSessionDate` needs to be either stored on the library item (denormalized for performance) or computed from the sessions table (join). Given the app's local-first/no-backend architecture, a `lastPracticedAt` denormalized field on `libraryItems`, updated on session create, is the cleanest approach. New DB column + migration.
  * **Ease / maintainability:** Medium effort (migration + update-on-session-create). The sort itself is trivial once the field exists. Denormalization is a well-understood pattern with clear update points.
  * **Notes:** The same `lastPracticedAt` field enables the "not practiced in N days" alert described in the Trend Alerts section. These two features share an infrastructure cost — implement them together.

---

* **Segment-Level Quick Nav from Diary Task Card**
  * Tasks can be linked to specific segments, but when the task card shows on the diary, there is no indication of which segments are targeted today without opening the session sheet. For a multi-movement work, this forces the user to remember which movements were assigned.
  * **UX pattern:** Contextual preview / metadata chip. Show the key constraint (which segments) directly on the card so the user can set up their music/score before opening the session form.
  * **Impact on UX:** Removes the "open sheet to check which segments, then close, then set up music, then re-open sheet" sequence. Saves 2–3 taps and reduces interruption during physical setup.
  * **Impact on UI:** Below the task title, a row of small colored segment chips ("I. Allegro · II. Adagio") when the task has segments. Tapping a chip opens the segment's section in the session sheet.
  * **Impact on app code:** The task card component needs to fetch the task's linked segments (available via `useLiveQuery`). The chip row is a display-only addition. No service changes.
  * **Ease / maintainability:** Low effort. Data is already available; purely a UI addition.
  * **Notes:** If a task has many segments (5+), collapse to "3 segments" chip to avoid card overflow.

---

## Onboarding & First-Use

---

* **Onboarding: Progressive Disclosure of Features (Not All at Once)**
  * The current onboarding covers language, name, subjects, and reminders, and then launches into `IntroSlides` which explains the full feature set at once. New users cannot absorb all of this before they have context. The result is that advanced features (study routines, granular session logging, collections) are introduced but never used.
  * **UX pattern:** Progressive onboarding / contextual tooltips. Introduce features at the moment the user first encounters them, not in a pre-use slideshow. Used in Notion ("First time seeing a database? Here's how it works."), Linear, and most modern SaaS apps.
  * **Impact on UX:** New users focus on the core loop first (add task → log session → see history). Advanced features are introduced contextually, reducing overwhelm. Feature adoption increases because users learn in context.
  * **Impact on UI:** Replace the IntroSlides with context-sensitive first-use tooltips/banners. First diary visit: "Start by logging a session — tap a task to begin." First library visit: "Your repertoire lives here — add your first piece." First History visit: "This is where your practice trends appear."
  * **Impact on app code:** A `firstUse` record in the `profile` table (or `localStorage`) tracking which pages/features have been visited for the first time. A `<FirstUseHint>` component that wraps any feature and shows the hint once.
  * **Ease / maintainability:** Medium effort. The hint component is simple. The tracking state is simple. The copy must be written for each feature. Maintenance: new features need new hints — this is a lightweight but ongoing obligation.
  * **Notes:** Keep the IntroSlides as a "replay tour" from Profile (already exists). Remove it from the mandatory onboarding flow.

---

## Offline & Data

---

* **Inline Data Export (CSV per Entity) for External Analysis**
  * The app exports data as a single JSON blob (full DB dump). Musicians who want to analyze practice time in a spreadsheet (Excel, Google Sheets) cannot use JSON directly. A per-entity CSV export ("Export sessions as CSV") would dramatically increase the usability of the data outside the app.
  * **UX pattern:** Multi-format export. Offering both machine-readable (JSON) and human-readable (CSV) exports is the standard for data portability in local-first apps and productivity tools.
  * **Impact on UX:** Users can paste practice data into a spreadsheet, create pivot tables, or feed it into external tools. Reduces the "trapped data" feeling of a local-first app.
  * **Impact on UI:** In the Profile → Data section, add "Export sessions (CSV)" and "Export library (CSV)" buttons alongside the existing JSON export.
  * **Impact on app code:** A `exportSessionsCSV(sessions[])` function that maps session fields to column headers and uses the browser's Blob/download API. Pure transformation logic; no DB changes. The JSON export pattern already exists and can be adapted.
  * **Ease / maintainability:** Low effort. Pure function with no external dependencies. The CSV transformation is straightforward for flat data (sessions). Nested data (segment metrics) requires flattening decisions — document the schema in the export header row.
  * **Notes:** The CSV export is the single most-requested feature in practice journal apps based on public feedback from competing apps (PracticeFirst, Modacity, Tonestro). It is a low-cost differentiator.

---

## Summary Priority Matrix

The following is a rough effort/impact ordering for reference:

| Change | Effort | UX Impact |
|---|---|---|
| Practice streak counter | Low | High |
| Subject color coding | Medium | High |
| Inline one-tap session completion | Medium | High |
| Last session comparison strip in log form | Low | High |
| Session scroll position persistence | Medium | High |
| Contextual "Open in History" deep link | Low | Medium–High |
| Form draft auto-save | Medium | Medium–High |
| Weekly overview card in History | Medium | Medium–High |
| Consistent icon vocabulary | Low | Medium |
| Undo toast for low-risk deletes | Medium | Medium |
| BPM auto-increment suggestion | Medium | Medium |
| Trend alerts and coaching panel | Medium | Medium |
| Practice duration as first-class field | Medium–High | High |
| Per-item analysis full page | Medium | Medium |
| Contextual task creation entry points | High | High |
| Task creation wizard (3-step) | High | Medium–High |
| Study routine visual week preview | Medium–High | Medium |
| FAB for ad-hoc session logging | Medium | Medium |
| Drag-to-reorder daily tasks | Medium | Low–Medium |
| Mastery score on library cards | Medium | Medium |
| Inline library item creation from task form | Medium | Medium |
| CSV data export | Low | Low–Medium |
| Progressive onboarding tooltips | Medium | Medium |
| Two-column responsive form layout | Low | Low–Medium |
| Batch task operations | Medium | Low–Medium |
| "Needs attention" library sort | Medium | Medium |
| End-of-day summary card | Low | Medium |
| Lessons reminder in diary hero | Medium | Medium |
| Empty state audit + vocabulary standardization | Low | Low |
| Section header standardization | Low | Low |
