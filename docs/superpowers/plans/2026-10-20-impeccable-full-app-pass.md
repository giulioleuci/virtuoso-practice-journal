# Impeccable Full-App Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the full Impeccable command sequence (audit, critique, fix, delight, layout, overdrive, quieter, typeset, adapt, clarify, distill, harden, optimize, polish) on every page and screen group of Virtuoso, with `document`, `extract` and `generate` used where they pay off.

**Architecture:** The plan contains no code. Each task is one page or screen group. Each sub-step invokes one Impeccable command against that group's targets and applies the result. A shared protocol (below) defines what each command means in this app, the verification gate, and the ledger, so tasks only name targets and local focus. Foundation work (DESIGN.md, shared kit) goes first so later tasks inherit it.

**Tech Stack:** Existing only: React 18, TypeScript, Vite, Tailwind, shadcn/ui, Dexie, Vitest, the `impeccable` skill, Chrome DevTools / Playwright MCP for visual checks. No new dependencies.

**Spec:** The user request of 2026-10-20 in this conversation, plus `PRODUCT.md` (platform web, Operate mode, principles: fewest taps, one concept one record, capture first, offline).

## Global Constraints

- UI-only. No change to Dexie schema, entities, ports, repositories or backup format. A `harden` finding that needs a data change is logged in the ledger and raised to the user, not implemented.
- Surface mode is **Operate** (`PRODUCT.md`): scanability, consistency and speed of logging outrank expression. Ambition shows as precision and restraint.
- Keep the established identity: theme colors terracotta, sage, gold, blue, plum; fonts Cormorant Garamond (serif headings), Inter, Manrope. Do not replace the visual world; refine it.
- Every user-facing string change is made in all four locales (en, it, es, de) in `src/lib/i18n.tsx` and its locale data, and `npm run i18n:validate` must pass.
- Touch targets at least 44px on phone; the floating action bar stays as the app-wide pattern; respect `prefers-reduced-motion`.
- No new runtime dependency unless the `optimize` step proves a measured win and the user approves.
- Navigate code with the codebase-memory-mcp tools (project `home-giulio-Desktop-virtuoso-practice-journal`), not bulk grep/read.
- Read `reference/craft-floor.md` of the impeccable skill before the first UI edit of each task.
- Commit with explicit paths only (`git commit -m ... -- <paths>`); the index may hold user-staged deletions. Never commit `.impeccable/`.
- Viewports for every visual check: phone 390x844, tablet 768x1024, desktop 1280x800. Locales sampled: it, en, de (de/es are the longest strings, check overflow there). Data states: first-run/empty, demo-seeded (explicit demo action in Profile), stress (long titles, many rows; created during `harden`).
- Some surfaces were already distilled/polished on 2026-10-18 (Diary, Log, Practice mode, Routine builder, Study setup; critique at `.impeccable/critique/2026-10-18T08-50-32Z__src-pages-diary-tsx.md`). For those, read the earlier output first and work on the delta; do not redo accepted decisions.

## Review Focus

- Command conflicts: `delight`/`overdrive` additions erased by `quieter`/`distill`, or the reverse. Expected: the final state of each surface is the one the `polish` step screenshot shows; the ledger records every accepted and rejected change with reason. Pinned by the task gate comparing the pre-`quieter` and post-`polish` screenshots.
- Long-string overflow: German/Spanish labels, long piece titles and 3-line teacher notes breaking buttons, chips, tabs and the bottom nav on phone. Expected: wrap or truncate with accessible full text, no horizontal page scroll. Pinned by `harden` stress-state captures and a component test per new truncation.
- Floating bar and keyboard: action bar covering the last field or the BPM input when the soft keyboard is open. Expected: last interactive element reachable above the bar. Pinned in `adapt` for Log, Tasks forms, Lessons sheets.
- Empty, first-run and error states missing or inconsistent (blank page on a fresh install, unknown route, failed live query). Expected: every route renders a purposeful state. Pinned by one RTL test per route group for the empty state.
- Performance regressions from `overdrive` (motion jank, bundle growth, eager chart code). Expected: no startup JS growth versus the Task 0 baseline; recharts stays lazy. Pinned by the `optimize` step build-size comparison.

---

## Pass Protocol (applies to Tasks 1-19)

**Ledger.** Each task keeps `.impeccable/pass/NN-<slug>.md` (git-ignored): findings from audit and critique with severity, what was fixed, what was deferred and why, and the before/after screenshot names. The ledger is how later steps and later tasks avoid undoing earlier decisions.

**Command meaning in this app.**

| Step | Invocation | Scope and expected outcome |
|---|---|---|
| Map | codebase-memory-mcp | Resolve route to page file to child components to services for the task; list them in the ledger. Confirm which files exist; some were removed in earlier distill passes. |
| Audit | `$impeccable audit <target>` | Technical quality: accessibility, performance, responsive, theming. Findings with severity into the ledger. |
| Critique | `$impeccable critique <target>` | UX heuristic review against `PRODUCT.md` users (instrument in hand, live lesson). Findings with severity into the ledger. |
| Resolve | direct edits guided by the ledger | Fix every P0/P1 from audit and critique; P2/P3 fixed when under a few lines, otherwise logged as deferred. |
| Delight | `$impeccable delight <target>` | Small personality touches that fit Operate mode (microcopy, completion moments, empty-state warmth). Rejected if it adds a tap or delay. |
| Layout | `$impeccable layout <target>` | Spacing rhythm, hierarchy, grouping, alignment on all three viewports. |
| Overdrive | `$impeccable overdrive <target>` | One bounded, performance-safe ambitious improvement per task where Operate mode allows it (for example a richer but cheap visualization or transition). If none fits, record "no overdrive, reason" in the ledger. Honor the Task 0 policy gate. |
| Quieter | `$impeccable quieter <target>` | Reduce visual noise, competing accents, redundant borders and badges, including noise introduced by the previous two steps. |
| Typeset | `$impeccable typeset <target>` | Type scale, serif/sans roles, numerals for tempo and counts, line length, wrap behavior in de/es. |
| Adapt | `$impeccable adapt <target>` | Phone, tablet, desktop, Capacitor Android (safe areas, soft keyboard, back button), landscape. |
| Clarify | `$impeccable clarify <target>` | Labels, helper text, errors, empty-state copy in all four locales. |
| Distill | `$impeccable distill <target>` | Remove redundant controls, duplicated information and dead options, per "one concept, one record". |
| Harden | `$impeccable harden <target>` | Stress state, offline, empty lists, long text, invalid input, undo/destructive confirmations, i18n expansion. Adds RTL tests for each new guard. |
| Optimize | `$impeccable optimize <target>` | Render cost, list virtualization need, query churn, lazy chunks, image/icon weight; compare build size with the Task 0 baseline. |
| Polish | `$impeccable polish <target>` | Final pass: alignment, states (hover, focus, disabled, loading), consistency, final screenshots at 3 viewports. |
| Document | `$impeccable document` | Generate or refresh `DESIGN.md` from the code. |
| Extract | `$impeccable extract <target>` | Pull a pattern repeated on 2 or more surfaces into a shared component or token, then migrate every consumer found in the ledgers. Only at the tasks that list it. |
| Generate | `$impeccable generate <n> <action> <element>` | Alternatives of one named element compared in the live browser, user picks. Only at the tasks that list it, and only for an element the critique flagged as having several plausible solutions. |

**Task gate (last step of every task).** All must pass with zero new findings versus the Task 0 baseline:
1. `npx tsc --noEmit -p tsconfig.app.json`
2. `npm run lint`
3. `npm run i18n:validate`
4. The impeccable design detector over the touched files (`$impeccable hooks status` shows how it is wired).
5. `npx vitest run <touched directories or files>`; the full suite is run only in Task 0 and Task 20 (known 5s timeouts in the full run, see Task 0).
6. Final screenshots at 3 viewports in the ledger.

Then commit: `git commit -m "feat(ui): impeccable pass on <surface>" -- <touched paths>`.

---

### Task 0: Foundation, baseline and policy gate

**Files:**
- Create: `DESIGN.md` (does not exist yet), `.impeccable/pass/` ledger directory
- Read: `PRODUCT.md`, `tailwind.config.*`, `src/index.css`, `src/components/ui/`

**Interfaces:**
- Produces: `DESIGN.md` (tokens, type roles, component conventions) consumed by all later tasks; baseline numbers (lint/tsc/test status, build size, Lighthouse) in `.impeccable/pass/00-baseline.md`.

- [ ] **Step 1: Load context.** Run the impeccable context loader once for the session; follow its directives.
- [ ] **Step 2: Baseline checks.** Run `npm run ci` and `npx tsc --noEmit -p tsconfig.app.json`. Record pass/fail per stage. Expected known issue: full-suite vitest 5s timeouts (for example `StudySetup.test.tsx`) that pass in isolation; record exactly which tests, and re-run each in isolation to confirm.
- [ ] **Step 3: Size and performance baseline.** Run `npm run build`; record entry chunk and total gzip sizes. Run a Lighthouse audit via the Chrome DevTools MCP on `/` at phone emulation; record scores.
- [ ] **Step 4: Document.** Run `$impeccable document` to generate `DESIGN.md` from the existing code, then review it for accuracy against the real tokens.
- [ ] **Step 5: Extract tokens.** Run `$impeccable extract` on theme tokens only (colors, radii, spacing, type roles) so later tasks reference tokens, not literals. Migrate only hard-coded values that duplicate an existing token.
- [ ] **Step 6: Policy gate (ask the user once).** Confirm: (a) `overdrive` scope per task (conservative recommended, one bounded item); (b) whether the live browser is available for `generate` steps; (c) whether the Capacitor Android emulator is available for `adapt` checks.
- [ ] **Step 7: Seed states.** Document in the ledger how to reach the three data states (first-run, demo-seeded via the explicit Profile action, stress) so every task reuses them.
- [ ] **Step 8: Commit** `DESIGN.md` and token edits.

---

### Task 1: App shell and shared kit

**Targets:** `src/components/AppShell.tsx`, `src/components/NavLink.tsx` (desktop nav, mobile bottom nav with floating Today and more-menu, recently reworked in commit 9095acc), `src/components/shared/*` (EmptyState, FeatureEmptyState, FilterPanel, FloatingActions, Loading, MultiChipPicker, PageHeader, Pager, ProgressTabs, RatingFields, RatingScale, ScrollList, SectionHeader, StateNotice, ErrorBoundary), the `src/components/ui/` primitives they use.

**Local focus:** shared components change every later screen, so this runs first and is the strictest. Findings in shared components found in later tasks are fixed here-style: edit once, then re-run consumers' tests and re-check Task 1 screenshots.

- [ ] **Step 1: Map.** List shared components and every importing page via the graph; record fan-in per component.
- [ ] **Step 2: Audit.** Nav landmarks, focus order, active-state contrast, 44px targets, safe areas.
- [ ] **Step 3: Critique.** Nav model: is Today always one tap; does the more-menu hide frequent destinations.
- [ ] **Step 4: Resolve** P0/P1 findings.
- [ ] **Step 5: Delight.** Nav transitions and empty-state tone.
- [ ] **Step 6: Layout.** Page header rhythm, section header spacing, filter panel structure.
- [ ] **Step 7: Overdrive.** Bounded: for example a unified route transition if cheap.
- [ ] **Step 8: Quieter.** Nav chrome, redundant dividers.
- [ ] **Step 9: Typeset.** PageHeader and SectionHeader roles; serif only for headings.
- [ ] **Step 10: Adapt.** Bottom nav versus floating action bar stacking, Android back button, keyboard.
- [ ] **Step 11: Clarify.** Nav labels, empty-state and error-notice copy in 4 locales.
- [ ] **Step 12: Distill and Extract.** Merge overlapping EmptyState/FeatureEmptyState/StateNotice if the audit shows duplication; run `$impeccable extract` for any chip/list pattern repeated in the ledgers so far.
- [ ] **Step 13: Harden.** ErrorBoundary and Loading fallbacks, route-level failure, long nav labels in de.
- [ ] **Step 14: Optimize.** Shell render cost, lazy route fallbacks.
- [ ] **Step 15: Polish.**
- [ ] **Step 16: Document refresh.** Re-run `$impeccable document` so `DESIGN.md` reflects the shared kit.
- [ ] **Step 17: Gate and commit.**

---

### Task 2: First-run experience

**Targets:** `src/components/onboarding/Onboarding.tsx`, `src/components/onboarding/IntroSlides.tsx`, fresh-install state of `/`.

**Local focus:** pending user decision from the previous session: intro slides and seed-data onboarding were left unchanged. Ask the user in Step 3 whether to shorten or keep them.

- [ ] **Step 1: Map and baseline** with a fresh IndexedDB.
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.** Time to first logged session; raise the slides/seed-data question to the user.
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.** Welcome tone, first-success moment.
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Overdrive.** Bounded.
- [ ] **Step 8: Quieter.**
- [ ] **Step 9: Typeset.**
- [ ] **Step 10: Adapt.** Landscape, small phones, language picker.
- [ ] **Step 11: Clarify.** Four locales; instrument/subject wording.
- [ ] **Step 12: Distill.** Skippable steps, fewer slides.
- [ ] **Step 13: Harden.** Interrupted onboarding, reload mid-flow, language switch mid-flow.
- [ ] **Step 14: Optimize.** Keep onboarding out of the returning-user critical path.
- [ ] **Step 15: Polish.**
- [ ] **Step 16: Gate and commit.**

---

### Task 3: Diary (Today, route `/`)

**Targets:** `src/pages/Diary.tsx`, `WeekStrip`, `CompletionBar`, `QuickAdd`, `TaskCalendarView`, `CarryoverBatchActions`, `SessionFAB`, `UpdateNextTaskPanel` (confirm placement via graph).

**Local focus:** already distilled and polished on 2026-10-18 (first-run empty state, deduped progress, 44px completion bar). Re-run on the delta; lesson card at top and 7-day strip are recent decisions.

- [ ] **Step 1: Map and baseline** (empty, seeded, stress).
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.** Read the 2026-10-18 critique first; score only what changed.
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.**
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Generate (flagship).** Alternatives for the one element critique flags most (likely the day header or task group header), 3 variants, user picks in the live browser.
- [ ] **Step 8: Overdrive.** Bounded.
- [ ] **Step 9: Quieter.**
- [ ] **Step 10: Typeset.**
- [ ] **Step 11: Adapt.** Week strip on 390px, FAB versus bottom nav overlap.
- [ ] **Step 12: Clarify.**
- [ ] **Step 13: Distill.**
- [ ] **Step 14: Harden.** 50+ tasks in a day, long titles, overdue carryover batch of 20.
- [ ] **Step 15: Optimize.** List rendering with many tasks, live query frequency.
- [ ] **Step 16: Polish.**
- [ ] **Step 17: Gate and commit.**

---

### Task 4: Session logging (`/log`)

**Targets:** `src/pages/SessionLogPage.tsx`, `MarksEditor`, `BpmCoupler`, `BpmSuggestion`, `Recorder`, `SessionDraftActions`, `RatingFields`, `RatingScale`.

**Local focus:** the speed-critical flow of the product ("logging costs seconds"). Prior polish fixed BPM input width, plural strings and note-value row. Measure taps from open to saved.

- [ ] **Step 1: Map and baseline**, including tap count for a 3-section session.
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.** Save moment, streak or completion acknowledgement if cheap.
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Generate (flagship).** Alternatives for the per-section mark row (tempo, confidence, layers, techniques), 3 variants, user picks.
- [ ] **Step 8: Overdrive.** Bounded.
- [ ] **Step 9: Quieter.**
- [ ] **Step 10: Typeset.** Tempo numerals and note-value glyphs.
- [ ] **Step 11: Adapt.** Soft keyboard over BPM inputs, floating bar clearance.
- [ ] **Step 12: Clarify.**
- [ ] **Step 13: Distill.** Confidence required; mood and focus stay optional context only.
- [ ] **Step 14: Harden.** Draft recovery after reload, recorder permission denied, 20-section log, invalid BPM.
- [ ] **Step 15: Optimize.** Re-render cost while typing BPM.
- [ ] **Step 16: Polish.**
- [ ] **Step 17: Gate and commit.**

---

### Task 5: Practice mode (metronome, pendulum, recorder tab)

**Targets:** `src/components/diary/PracticeMode.tsx` and the controls it hosts.

**Local focus:** used with hands busy. Prior work moved beats-per-bar and rhythmic figure under the slider, pendulum to 80px on phone. Pending: browser/phone recheck, confirmation that "numero di tap" means `beatsPerBar`.

- [ ] **Step 1: Map and baseline.**
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.**
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Overdrive.** Bounded; animation must not drift the audio clock.
- [ ] **Step 8: Quieter.**
- [ ] **Step 9: Typeset.** Large BPM readout legible at arm's length.
- [ ] **Step 10: Adapt.** Landscape on phone, tablet on a music stand, wake-lock if already used.
- [ ] **Step 11: Clarify.**
- [ ] **Step 12: Distill.**
- [ ] **Step 13: Harden.** Audio context blocked until gesture, tab hidden, BPM extremes.
- [ ] **Step 14: Optimize.** Animation frame cost, timer accuracy under load.
- [ ] **Step 15: Polish.**
- [ ] **Step 16: Gate and commit.**

---

### Task 6: Session detail and History

**Targets:** `src/pages/SessionPage.tsx` (`/sessions/:id`), `src/pages/History.tsx` (`/history`), `SegmentHistory`.

- [ ] **Step 1: Map and baseline.**
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.**
- [ ] **Step 6: Layout.** Historical snapshot readability.
- [ ] **Step 7: Overdrive.** Bounded.
- [ ] **Step 8: Quieter.**
- [ ] **Step 9: Typeset.**
- [ ] **Step 10: Adapt.**
- [ ] **Step 11: Clarify.**
- [ ] **Step 12: Distill.**
- [ ] **Step 13: Harden.** Session whose library item or segment was soft-deleted, 500+ sessions, session with no marks.
- [ ] **Step 14: Optimize.** History list pagination or virtualization.
- [ ] **Step 15: Polish.**
- [ ] **Step 16: Gate and commit.**

---

### Task 7: Tasks area and task forms

**Targets:** `src/pages/Tasks.tsx`, `NewTaskPage`, `EditTaskPage`, `BulkAddTasksPage`, `PlanEditor`, `LinkTargetFields`, `WhenFields`, `RecurrenceFields`, `useTaskPlan` consumers.

**Local focus:** three task scopes (free-form, library item with optional segment, collection); form consistency across new, edit and bulk.

- [ ] **Step 1: Map and baseline.**
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.**
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Overdrive.** Bounded.
- [ ] **Step 8: Quieter.**
- [ ] **Step 9: Typeset.**
- [ ] **Step 10: Adapt.** Keyboard on forms, date/time inputs on mobile.
- [ ] **Step 11: Clarify.** Recurrence wording in 4 locales.
- [ ] **Step 12: Distill and Extract.** Collapse duplicated field groups between new, edit and bulk; run `$impeccable extract` for form-row and picker patterns repeated here and in Tasks 8, 9, 12, 14.
- [ ] **Step 13: Harden.** Validation messages, discard-changes confirmation, bulk add with 100 lines.
- [ ] **Step 14: Optimize.**
- [ ] **Step 15: Polish.**
- [ ] **Step 16: Gate and commit.**

---

### Task 8: Routine builder

**Targets:** `src/pages/RoutinePage.tsx` (`/tasks/routines/new`, `/tasks/routines/edit/:id`), `src/components/diary/RoutineBuilder.tsx`.

**Local focus:** recently changed: group reorder via move up/down, "only selected" filter, `combine` flag, weekly grid collapsed until days chosen. UI of the last three was never verified in a browser; verify first.

- [ ] **Step 1: Map and baseline**, including browser verification of the unverified features.
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.**
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Overdrive.** Bounded.
- [ ] **Step 8: Quieter.** The group menu is dense.
- [ ] **Step 9: Typeset.**
- [ ] **Step 10: Adapt.**
- [ ] **Step 11: Clarify.** Wording of "one task per day" and generation preview.
- [ ] **Step 12: Distill.**
- [ ] **Step 13: Harden.** Group with 1 piece and count 3, empty group, 20 groups.
- [ ] **Step 14: Optimize.** Generator preview cost.
- [ ] **Step 15: Polish.**
- [ ] **Step 16: Gate and commit.**

---

### Task 9: Library list and new-item flow

**Targets:** `src/pages/Library.tsx` (`/library`), `NewLibraryItemSheet`, `LibraryItemKindFields`, `FilterPanel` use, `BpmCoupler` use.

**Local focus:** five material types (piece, study, technical exercise, exercise, theory); recent library filter work.

- [ ] **Step 1: Map and baseline.**
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.**
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Generate (flagship).** Alternatives for the library row/card (type, title, progress, last practiced), 3 variants, user picks.
- [ ] **Step 8: Overdrive.** Bounded.
- [ ] **Step 9: Quieter.**
- [ ] **Step 10: Typeset.**
- [ ] **Step 11: Adapt.**
- [ ] **Step 12: Clarify.** Type names and per-type fields in 4 locales.
- [ ] **Step 13: Distill.**
- [ ] **Step 14: Harden.** 500 items, no results, duplicate titles, soft-deleted items.
- [ ] **Step 15: Optimize.** Filtering and list rendering at 500 items.
- [ ] **Step 16: Polish.**
- [ ] **Step 17: Gate and commit.**

---

### Task 10: Library item, analysis and segments

**Targets:** `/library/item/:id` (`ItemPage` if present, else its replacement; confirm via graph), `ItemAnalysis`, `BpmTimelineChart`, `BpmSparkline`, `SegmentsEditor`, `ItemHelpSheet`, `TeacherAnswersSheet`; legacy redirect `library/item/:id/analysis`.

- [ ] **Step 1: Map and baseline.**
- [ ] **Step 2: Audit.** Chart accessibility (text alternative, color-only encoding).
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.**
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Generate (flagship).** Alternatives for the item header plus progress summary, 3 variants, user picks.
- [ ] **Step 8: Overdrive.** Bounded; best candidate surface in the app for a richer chart, keeping recharts lazy.
- [ ] **Step 9: Quieter.**
- [ ] **Step 10: Typeset.**
- [ ] **Step 11: Adapt.** Charts at 390px.
- [ ] **Step 12: Clarify.**
- [ ] **Step 13: Distill and Extract.** Chart wrapper and sheet shell patterns shared with Tasks 11, 13, 14.
- [ ] **Step 14: Harden.** Item with no sessions, one data point, 1000 data points, 30 segments.
- [ ] **Step 15: Optimize.** Chart chunk stays lazy; downsample large series.
- [ ] **Step 16: Polish.**
- [ ] **Step 17: Gate and commit.**

---

### Task 11: Segment page

**Targets:** `src/pages/SegmentPage.tsx` (`/library/item/:id/segment/:segmentId`).

- [ ] **Step 1: Map and baseline.**
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.**
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Overdrive.** Bounded (record "none" if Task 10 covers it).
- [ ] **Step 8: Quieter.**
- [ ] **Step 9: Typeset.**
- [ ] **Step 10: Adapt.**
- [ ] **Step 11: Clarify.** Inherited versus own tempo target wording.
- [ ] **Step 12: Distill.**
- [ ] **Step 13: Harden.** Segment without bar range, deleted parent.
- [ ] **Step 14: Optimize.**
- [ ] **Step 15: Polish.**
- [ ] **Step 16: Gate and commit.**

---

### Task 12: Collections

**Targets:** `src/pages/Collections.tsx` (`/library/collections`), `src/pages/CollectionPage.tsx` (`/library/collections/:id`), `NewCollectionSheet`.

**Local focus:** mixed-type ordered flat index; reorder interaction.

- [ ] **Step 1: Map and baseline.**
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.**
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Overdrive.** Bounded.
- [ ] **Step 8: Quieter.**
- [ ] **Step 9: Typeset.**
- [ ] **Step 10: Adapt.** Touch reordering.
- [ ] **Step 11: Clarify.**
- [ ] **Step 12: Distill and Extract.** Reuse the list-row pattern extracted in Task 9/10 instead of a parallel one.
- [ ] **Step 13: Harden.** Empty collection, item removed everywhere, 200 items.
- [ ] **Step 14: Optimize.**
- [ ] **Step 15: Polish.**
- [ ] **Step 16: Gate and commit.**

---

### Task 13: Repertoire, performance events, readiness

**Targets:** `src/pages/Repertoire.tsx`, `EventPage.tsx` (`/library/events/:id`), `ReadinessPage.tsx` (`/library/events/:id/item/:itemId`), `PerformanceEventSheet`.

- [ ] **Step 1: Map and baseline.**
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.** Event countdown tone.
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Overdrive.** Bounded.
- [ ] **Step 8: Quieter.**
- [ ] **Step 9: Typeset.**
- [ ] **Step 10: Adapt.**
- [ ] **Step 11: Clarify.** Readiness wording in 4 locales.
- [ ] **Step 12: Distill.**
- [ ] **Step 13: Harden.** Past event, event with no pieces, studies in the programme.
- [ ] **Step 14: Optimize.**
- [ ] **Step 15: Polish.**
- [ ] **Step 16: Gate and commit.**

---

### Task 14: Lessons

**Targets:** `src/pages/Lessons.tsx` (`/lessons`), `LessonLogSheet`, `NextLessonPanel`, `RecurrenceSheet`, `TeacherRecapSheet`, `LessonExtraActions`, `HomeworkInput`.

**Local focus:** second core situation in `PRODUCT.md`: jotting homework live during a lesson, fast typing.

- [ ] **Step 1: Map and baseline**, including tap count to record one homework item.
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.**
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Generate (flagship).** Alternatives for the lesson log sheet layout, 3 variants, user picks.
- [ ] **Step 8: Overdrive.** Bounded.
- [ ] **Step 9: Quieter.**
- [ ] **Step 10: Typeset.**
- [ ] **Step 11: Adapt.** Sheet height with soft keyboard.
- [ ] **Step 12: Clarify.**
- [ ] **Step 13: Distill and Extract.** Sheet shell pattern shared with Tasks 9, 10, 13.
- [ ] **Step 14: Harden.** Lesson without homework, cancelled recurrence, 30 homework lines, draft recovery.
- [ ] **Step 15: Optimize.**
- [ ] **Step 16: Polish.**
- [ ] **Step 17: Gate and commit.**

---

### Task 15: Assignments

**Targets:** `src/pages/Assignments.tsx` (`/lessons/assignments`).

**Local focus:** "nothing the teacher assigned is lost": linkage between assignment and planned tasks (`taskIds`).

- [ ] **Step 1: Map and baseline.**
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.**
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Overdrive.** Bounded.
- [ ] **Step 8: Quieter.**
- [ ] **Step 9: Typeset.**
- [ ] **Step 10: Adapt.**
- [ ] **Step 11: Clarify.** Status wording (unplanned, planned, done).
- [ ] **Step 12: Distill.**
- [ ] **Step 13: Harden.** Assignment with deleted task, many open assignments.
- [ ] **Step 14: Optimize.**
- [ ] **Step 15: Polish.**
- [ ] **Step 16: Gate and commit.**

---

### Task 16: Analytics

**Targets:** `src/pages/Analytics.tsx` (`/analytics`), `ProgressDashboard`, `StatsDashboard`, `ProgressTabs` (confirm which dashboards sit here versus Diary).

- [ ] **Step 1: Map and baseline.**
- [ ] **Step 2: Audit.** Chart accessibility and color-only encoding.
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.**
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Generate (flagship).** Alternatives for the top-level stat summary, 3 variants, user picks.
- [ ] **Step 8: Overdrive.** Bounded, with recharts kept as a lazy chunk.
- [ ] **Step 9: Quieter.**
- [ ] **Step 10: Typeset.**
- [ ] **Step 11: Adapt.**
- [ ] **Step 12: Clarify.** Metric names and units in 4 locales.
- [ ] **Step 13: Distill.** Drop metrics that do not feed a decision.
- [ ] **Step 14: Harden.** No data, 1 day of data, 3 years of data.
- [ ] **Step 15: Optimize.** Aggregation cost on large histories.
- [ ] **Step 16: Polish.**
- [ ] **Step 17: Gate and commit.**

---

### Task 17: Profile and settings

**Targets:** `src/pages/Profile.tsx` (`/profile`), `src/components/profile/SubjectsEditor.tsx` (swatch names and white-swatch check were edited in the last session; the final edit hit a disk conflict, so verify it applied).

- [ ] **Step 1: Map and baseline.**
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.**
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Overdrive.** Bounded.
- [ ] **Step 8: Quieter.**
- [ ] **Step 9: Typeset.**
- [ ] **Step 10: Adapt.**
- [ ] **Step 11: Clarify.** Backup/import/demo-data wording; destructive actions say exactly what is lost.
- [ ] **Step 12: Distill and Extract.** Settings row pattern shared with other tasks.
- [ ] **Step 13: Harden.** Invalid backup file, version mismatch, interrupted import, demo replacement confirmation, language switch.
- [ ] **Step 14: Optimize.**
- [ ] **Step 15: Polish.**
- [ ] **Step 16: Gate and commit.**

---

### Task 18: Study setup

**Targets:** `src/pages/StudySetup.tsx` (`/study-setup/:id?`), `StudySetup.test.tsx`.

**Local focus:** previously polished; `StudySetup.test.tsx` times out in the full suite, so check whether the test or the page is slow before touching either.

- [ ] **Step 1: Map and baseline**, including a profile of the timeout.
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.**
- [ ] **Step 6: Layout.**
- [ ] **Step 7: Overdrive.** Bounded.
- [ ] **Step 8: Quieter.**
- [ ] **Step 9: Typeset.**
- [ ] **Step 10: Adapt.**
- [ ] **Step 11: Clarify.**
- [ ] **Step 12: Distill.**
- [ ] **Step 13: Harden.** New versus edit by id, unknown id, unsaved changes.
- [ ] **Step 14: Optimize.** Fix the root cause of the full-suite timeout.
- [ ] **Step 15: Polish.**
- [ ] **Step 16: Gate and commit.**

---

### Task 19: Print summary and system screens

**Targets:** `src/pages/PrintSummary.tsx` (`/print/weekly`, print stylesheet), `src/pages/NotFound.tsx`, `ErrorBoundary`, `Loading` and route `Fallback` states, `StateNotice`.

- [ ] **Step 1: Map and baseline** (print preview in browser, unknown route, forced render error).
- [ ] **Step 2: Audit.**
- [ ] **Step 3: Critique.**
- [ ] **Step 4: Resolve.**
- [ ] **Step 5: Delight.** Light touch on NotFound.
- [ ] **Step 6: Layout.** Print page breaks and margins on A4/Letter.
- [ ] **Step 7: Overdrive.** Record "none" unless a cheap print-quality gain exists.
- [ ] **Step 8: Quieter.**
- [ ] **Step 9: Typeset.** Print type sizes and black-and-white legibility.
- [ ] **Step 10: Adapt.**
- [ ] **Step 11: Clarify.** Error and recovery copy in 4 locales.
- [ ] **Step 12: Distill.**
- [ ] **Step 13: Harden.** Empty week, 7-day full week, long titles in print.
- [ ] **Step 14: Optimize.** Route fallback flash.
- [ ] **Step 15: Polish.**
- [ ] **Step 16: Gate and commit.**

---

### Task 20: Cross-app closing pass

**Files:** all touched files; `DESIGN.md`.

**Interfaces:**
- Consumes: all ledgers `.impeccable/pass/01-*.md` to `19-*.md`, Task 0 baseline.
- Produces: refreshed `DESIGN.md`, final report.

- [ ] **Step 1: Extract sweep.** Read all ledgers, list patterns repeated on 2 or more surfaces that were not yet extracted, run `$impeccable extract` for each, migrate consumers.
- [ ] **Step 2: Document.** Run `$impeccable document` to refresh `DESIGN.md` against the final code.
- [ ] **Step 3: Consistency audit.** Run `$impeccable audit` and `$impeccable critique` on the app as a whole (routes `/`, `/log`, `/library`, `/lessons`, `/analytics`, `/profile`) for cross-page inconsistencies; fix findings.
- [ ] **Step 4: Optimize.** Run `$impeccable optimize` app-wide; compare build size and Lighthouse with Task 0 baseline. Expected: no regression in entry chunk size; recharts still lazy.
- [ ] **Step 5: Polish.** Run `$impeccable polish` app-wide.
- [ ] **Step 6: Full verification.** Run `npm run ci` and `npx tsc --noEmit -p tsconfig.app.json`. Expected: pass, with the Task 0 flaky timeouts fixed or still listed explicitly.
- [ ] **Step 7: Report.** Summarize per task: findings fixed, deferred, rejected, and any data-model issue raised by `harden`. Commit remaining changes with explicit paths.
