# Impeccable full-app pass — implementation report

2026-10-20 · branch `impeccable-full-app-pass`

Tasks 0–20 are committed. The user picked six flagship variants and a compact practice mode in the live browser, chose to remove the intro slides, and a fresh-context whole-branch review ran; its confirmed findings are fixed.

The accepted direction remains **The Practice Taccuino**: warm paper, terracotta actions, serif headings, practical controls and ruled lists. The approved condensed pass prioritizes usability and recovery; no dependencies were added. Domain entities, schemas, ports, application logic and repositories are unchanged from baseline `9095acc`.

## Changes by task

| Task | Result | Remaining scope or decision |
|---|---|---|
| 0 · baseline | Captured design, tests, bundle and browser baseline; removed unused CSS. | Physical-device baseline unavailable. |
| 1 · shell/kit | Navigation names, contrast, focus, overlay levels and shared feedback. | Retained the user's Today navigation choice. |
| 2 · first run | Accessible choices, stable drafts, guarded submission and app-wide reminders. | Intro slides await preference; no new onboarding features. |
| 3 · Diary | Clear task actions, empty-day/session handling, completion feedback. | Picked task row v2: title and tempo share a row from 700px. Carryover duplicate is repository logic. |
| 4 · log | Reliable draft recovery, validation, safe discard and clear saved-session destination. | Picked mark row v3: reached tempo before confidence. Target tempo still seeds reached tempo by domain rule. |
| 5 · practice | Audio-clock timing, responsive landscape, visible controls and reduced motion. | Real-device audio calibration remains unverified. |
| 6 · history/session | Snapshot fallbacks, recovery, tempo context and usable controls. | Large-history navigation and dedicated single-session read are deferred. |
| 7 · tasks | Date selection, stable edited titles, accurate bulk counts, series-edit notice. | Whole-series editing is a feature; no shared form abstraction added. |
| 8 · routines | Grouping/reorder feedback, overlay hierarchy, safe generation controls. | Generator merging whole pieces still loses material identity. |
| 9 · Library | Keyboard tabs, long-content fit, stable editor drafts and validation. | Picked row v1: grid with grouped actions. Closing/reloading an editor still discards its draft. |
| 10 · material/analysis | Missing-state recovery, chart tables, bounded plots, accessible scrubber and question-write recovery. | Picked header v3: back and Edit toolbar above the title. Free-only sparkline guard retained. |
| 11 · section | Complete inherited tempo notation, source context and missing-parent recovery. | No extra chart or model change. |
| 12 · collections | Safe delete/Undo errors, accessible metadata, stable pagination and long-content fit. | Distant reorder still requires repeated arrow taps. |
| 13 · repertoire/events | Confirmed deletion, safe retry identity, programme search and valid readiness context. | Event/programme writes remain separate transactions. |
| 14 · lessons | Typing survives earlier save completion/failure; form retries preserve edits; accessible keyboard-aware sheets. | Picked lesson sheet v3: notes lead, date beside the footer. Drafts do not survive explicit close/reload. |
| 15 · assignments | Orphaned homework returns to inbox; multi-day retries preserve completed days and created IDs; Undo/error feedback. | Leaving after a failed link can lose the retry checkpoint. |
| 16 · analytics | Latest zero preserved, true calendar/week windows, bounded recent data, shared readable tables. | Picked stat summary v1: equal columns with a divider. No new metrics. |
| 17 · settings | Import replacement confirmation, named controls, 44px switches, selected states and failed-save recovery. | Empty-backup validation and demo atomicity need separate application/storage work. |
| 18 · Study setup | Preserved accepted layout; fixed long-text overflow and independent accordion drafts. | Subject deletion can create unrestorable backups; one load-sensitive test lookup remains recorded. |
| 19 · print/system | Identity-safe report grouping, chosen week start, fixed print columns, natural page flow and announced loading. | Native print/Safari not checked. |
| 20 · closing | Route arrival/title, filter focus recovery, wrapping Settings links, 44px primitive defaults, refreshed design contract. | Practice mode picked compact v2 (390×844 height 1240→844, no scroll); intro slides removed; review fixes: Diary homework rule, wake-lock re-acquire, beat reset, reduced-motion entrances, 44px stragglers, filter group name. |

## Verification

- `npx tsc --noEmit -p tsconfig.app.json`: pass.
- `npm run ci`: pass — lint, four-locale validation, **96 files / 594 tests**, production/PWA build.
- Baseline: 72 test files / 499 tests. The occasional 5s baseline timeouts did not reproduce. The StudySetup technique-rename lookup later failed in two consecutive full runs (passes isolated), so that one lookup now waits 3s. `NewTaskPage` "titles a multi-section task in the app language" failed once under full load and passed isolated and on the next full run; it stays listed as load-sensitive.
- Chromium: 390×844 German, 768×1024 Italian and 1280×800 English; all six core routes fit. Extra checks cover 320px, large Library/homework/collection/history fixtures, missing records, failed saves and retries, empty/one-day/three-year analytics, print A4/Letter and forced render errors.
- Design detector: **five retained Inter warnings, zero advisories** after documenting actual type sizes. Inter is part of the accepted identity.
- Lighthouse on production first-run: accessibility, best practices and SEO **100**. This bundled runner gives paint metrics zero weight and omits LCP, so its performance score is not used as a speed claim. A separate identical-throttle browser comparison is recorded below.

| Gzip | Task 0 | Current |
|---|---:|---:|
| Entry JavaScript | 165.99 kB | 161.11 kB |
| Entry + preloaded vendors | 326.08 kB | 321.29 kB |
| Recharts | Lazy | Lazy, 105.05 kB |

First-run screens, teacher recap and Lessons load through existing lazy/Suspense patterns. Lessons retains idle prefetch for later navigation. Chart tables mount only when expanded; plotted points and analytics windows remain bounded.

A direct comparison rebuilt baseline `9095acc` separately and used fresh 390×844 browser contexts, 4× CPU throttling, 1.6 Mbit/s download and 40ms latency. LCP was **2276ms baseline / 2384ms current** (+108ms); CLS was **0 for both**. This is one paired measurement, not a speed-improvement claim. The original Task 0 trace (979ms) used a different harness and is not directly comparable. The explicit entry/startup-size budget passes.

## Data and product issues deliberately outside this UI pass

- Moving carryover tasks can duplicate a record; unchanged repository behavior.
- Logging still seeds reached BPM from the plan target; an untouched save can record an unobserved result.
- Routine generation can merge whole pieces into an anonymous free task and lose material identity.
- Event metadata/programme and assignment task creation/linking are separate writes. UI retries are safe while their checkpoint is mounted, but closing after a partial failure can leave incomplete links.
- The importer accepts an empty v4 data object. Import now warns and confirms replacement, including empty backups, but stricter validation is not implemented.
- Demo seeding wipes before completing all writes; interruption can lose prior data. Failure now explains possible partial replacement and backup recovery.
- Deleting a referenced subject can leave an exported backup that fails reference validation.
- Editing every occurrence in a task series is a new feature; the editor now clearly says only the current day changes.

## Deferred refinements and limitations

- The `assignments.pending` read case in the presentation read port is now unused (Diary switched to the shared rule); it was left because ports are out of scope for this UI pass.
- Library: the favourite toggle still sits inside the item heading, so the heading's accessible name includes it (pre-existing on main).
- Sheet, routine and Study setup drafts generally survive write failures, not leaving/reloading. Log-session draft recovery remains supported.
- Distant collection reorder and large-history page jumps remain cumbersome; week view/move-task, tap tempo/pedal controls and remembered meter are features beyond this pass.
- Small existing refinements remain: optional onboarding progressive disclosure/composition preset, quote punctuation, German musician terminology for layers, routine partial-checkbox/weekend presentation, note-value strip density, and history kind filtering of deleted materials where snapshots lack kind.
- Real Android/iOS hardware, soft-keyboard behavior, Safari, native permissions, audio timing and native print dialogs remain unverified. Viewport shrink is an approximation.
- Unnecessary wrappers, new dependencies, decorative motion/overdrive and a new visual identity were rejected. Existing Tabs, ResponsiveSheet, command state and Undo patterns were reused. Shared ChartData and inbox selection were extracted only for actual consumers.

## Rulings recorded during implementation

These preserve the complete decision trail, including superseded decisions and their stated costs.

- Setup: Ruling: work on new local branch `impeccable-full-app-pass` instead of main, in place (no worktree) — skill forbids main without consent, in-place keeps node_modules — cost if wrong: one `git checkout main && git merge`.
- Task 0: Ruling: pass depth CONDENSED per user answer (audit+critique, resolve, harden, polish; other commands only when flagged, skips logged) — user chose it at policy gate — cost if wrong: re-run skipped commands per surface.
- Task 0: Ruling: lint baseline failed only on `.remember/tmp` tooling file; added `.remember` to eslint ignores — gate needs a green lint — cost if wrong: one line.
- Task 0: Ruling: deleted unused src/App.css (Vite boilerplate, zero imports) — dead code — cost if wrong: restore one file.
- Task 0: Ruling: DESIGN.md qualitative rounds compressed to one question (North Star); color names chosen by me from tokens — keep interruptions low — cost if wrong: rename in DESIGN.md.
- Task 1: Ruling: critique Assessment B (detector) run in parent, after/independent of isolated sub-agent A; overlay injection skipped — halves sub-agent cost, A stays unanchored — cost if wrong: weaker B evidence (no in-page overlay).
- Task 1: Ruling: critique "Ask the User" questions skipped every task — plan pre-answers scope (fix P0/P1, small P2/P3) and executing-plans forbids check-ins — cost if wrong: user priorities not consulted per surface.
- Task 1: Ruling: page-level findings from the kit critique (save-bar migration, serif labels, FormErrors) carried to owning tasks 3/4/7/14/16 instead of fixed here — keeps each change inside its surface's gate — cost if wrong: later tasks must pick them up from ledger 01.
- Task 1: Ruling: removable chip = whole-chip 44px secondary button (FilterPanel pattern) instead of extracting a Chip component — 2 uses, no abstraction — cost if wrong: extract later in Task 20 sweep.
- Task 2: Ruling: web onboarding drops the reminder step (3 steps), Android keeps it — web cannot schedule OS notifications (platform.ts returns early) — cost if wrong: re-add step behind isNative.
- Task 2: Ruling: reminder scheduling moved from Profile page effect to app-wide useReminderSchedule hook (AppShell) — onboarding reminders were never scheduled until Settings opened — cost if wrong: one extra reschedule per profile change.
- Task 2: Ruling: intro slides kept unchanged pending user decision (plan asks user; queued with Task 3 generate picks) — cost if wrong: one more pass on IntroSlides.
- Task 3: Ruling: all six flagship `generate` steps (Diary task row, Log mark row, Library row, Item header, Lesson sheet, Analytics summary) batched into ONE live session after Task 16 — user asked to pick in batch; live markers would block other edits to those files — cost if wrong: flagship surfaces get their variant round late; Task 20 polish re-checks them.
- Task 3: Ruling: did not restore first-open Start emphasis nor change done-task ordering — user removed/kept them deliberately in 11bfff6 (taskOrder.test pins sinking) — cost if wrong: One Voice pressure stays until the task-row generate.
- Task 3: Ruling: Task 2's repository double-submit guard reverted to a UI guard — plan forbids repository changes — cost if wrong: another caller of initialize could still double-insert (none today).
- Task 3: Ruling: carryover "Move to today" duplicate is repository logic; logged and raised to user, not fixed — plan constraint — cost if wrong: duplicates remain.
- Task 4: Ruling: "BPM reached" seeded from the plan target left as is and raised to the user — domain seeding rule (marksFromPlan), trades taps vs invented results — cost if wrong: untouched saves keep recording the target as reached.
- Task 4: Ruling: bottom nav hidden on /log only; task forms decided in Task 7 — keep each change in its surface — cost if wrong: one more route in AppShell.
- Task 5: Ruling: metronome rewritten as an audio-clock lookahead scheduler — tempo changes restarted the bar and fired bursts; plan's optimize step asks for timer accuracy — cost if wrong: real-device audio behaviour (iOS) still unverified.
- Task 5: Ruling: short-landscape implemented as a plugin variant, not a raw screen — a raw screen disables arbitrary min-[]/max-[] variants app-wide — cost if wrong: none known.
- Task 6: Ruling: shared control height token raised 42px -> 44px (Button, Input, Select) — plan's 44px rule, shared kit fixed once — cost if wrong: 2px taller controls everywhere.
- Task 6: Ruling: next-task pre-selection and newest-session gating done in the panel/page (UI), not in domain tempoProposal — keep domain untouched — cost if wrong: other tempoProposal callers still propose slower tempos.
- Task 7: Ruling: series edit gets an explanatory notice, not a "this one / whole series" scope — series-wide edit is new behaviour on data — cost if wrong: musician edits each day separately until built.
- Task 7: Ruling: no TaskForm / FormField / ToggleGroup extraction now; candidates logged for Task 20 — 2 consumers each, ponytail — cost if wrong: duplicated fixes across New/Edit until then.
- Task 8: Ruling: z-index layers set once in shared primitives (bar 60 < dialogs 80 < popovers 90) — popover pager under the save bar; bar above dialog backdrops — cost if wrong: a custom overlay still at z-50 could sit under the bar.
- Task 8: Ruling: generator merging whole pieces into one free task (itemId lost) raised to user, not fixed — domain behaviour on generated data — cost if wrong: merged groups of whole pieces keep producing anonymous tasks.
- Task 10: Ruling: useItem normalizes loaded-missing to null in the UI reader; reader keys results and drops old completions — fixes endless loading without changing ports/repos — cost if wrong: callers must continue distinguishing null from undefined.
- Task 10: Ruling: first-run screens lazy-loaded in shared Index to restore startup budget (165.43kB entry vs165.99 baseline) — cost if wrong: first-run briefly sees existing loading skeleton.
- Task 10: Ruling: no chart/sheet wrapper extraction; only local ChartData disclosure used by two charts — existing responsibilities differ — cost if wrong: a later common shell may need extraction.
- Task 12: Ruling: deleteWithUndo requires an error callback at all four consumers and catches both delete/restore failures — root fix for silent destructive-action failures — cost if wrong: shared callers now show generic translated failure feedback.
- Task 12: Ruling: large collection index keeps existing arrow model (200 rows render without overflow); distant reorder redesign deferred — condensed policy fixes small P2s only — cost if wrong: many taps for distant moves.
- Task 13: Ruling: UI retains event ID across partial-save retries and explains partial success; full event+programme atomicity raised, not implemented — repositories excluded by plan — cost if wrong: cancelling after a failed programme write leaves saved metadata with old/empty programme.
- Task 14: Ruling: teacher recap lazy-loads on open in both owners — preserves startup budget and avoids hidden queries — cost if wrong: first opening briefly shows the existing loading sheet.
- Task 14: Ruling: next-teacher existing 28px serif kept despite detector advisory — preserve established card hierarchy; no new type size introduced — cost if wrong: one off-ramp size remains until Task20 token review.
- Task 15: Ruling: deleted-task inbox selector shared in presentation utils across Assignments/Lessons/AppShell — domain files excluded; raw taskIds incorrectly hid homework — cost if wrong: extra active-task read for navigation badges.
- Task 15: Ruling: UI checkpoints created task IDs and completed days while planner stays mounted; inline warning requires retry before leaving — task-create/link atomicity and reload recovery require repository work excluded by plan — cost if wrong: leaving after a failed link can leave an unlinked task and later duplicate it.
- Task 16: Ruling: shared ChartData disclosure extracted from ItemAnalysis for actual reuse in three dashboards; heatmap's tiny links replaced by static cells +44px daily table links — readable data and touch targets — cost if wrong: opening a day takes one extra disclosure tap.
- Task 16: Ruling: Lessons route now lazy with existing idle prefetch — entry exceeded165.99kB budget; final160.40kB restores it — cost if wrong: an immediate first lesson navigation may briefly show existing PageSkeleton.
- Task 17: Ruling: require explicit replacement confirmation before backup file picker; warn an empty backup clears journal — application accepts empty v4 data, validation/storage excluded — cost if wrong: one extra confirmation for every import; permissive validator remains.
- Task 17: Ruling: demo replacement remains non-atomic, failure now explains partial replacement and restore path — seed/storage work excluded — cost if wrong: interruption can still lose original data; raised to user.
- Task 18: Ruling: keep accepted study list/detail/accordion layout; only fix wrapping and draft loss — no evidence for redesign — cost if wrong: existing visual hierarchy remains.
- Task 18: Ruling: do not change timeout or add speculative page optimization; full suite first hit a1s retry-button lookup, then passed587/587 after correcting Task15 navigation mocks — timing root cause unconfirmed — cost if wrong: load-sensitive StudySetup lookup may recur; listed explicitly.
- Task 18: Ruling: subject deletion leaving invalid backup references raised, not fixed — repository behavior excluded — cost if wrong: deleting a referenced subject can still make its exported backup unrestorable.
- Task 19: Ruling: reports group by material ID, then planned-task ID; identity-free sessions retain subject+title grouping — same titles must not merge distinct materials — cost if wrong: free sessions sharing a title still group together.
- Task 19: Ruling: print report may span pages rather than force one-page compression; explicit columns and normal section flow preserve content — A4/Letter long fixtures fit, longer notes need space — cost if wrong: long real weeks use more paper.
- Task 20: Ruling: preserve existing North Star, colors and type; refresh DESIGN.md as already authorized by this task — no new identity workshop needed — cost if wrong: accepted28/32px headings,80px metronome,11px calendar previews and10px badge remain documented exceptions.
- Task 20: Ruling: no TaskForm/toggle-pill/FormField extraction — two task-form owners differ in creation/series behavior; other candidates differ in purpose or already use house components; actual shared ChartData/Undo/inbox selector extracted earlier — cost if wrong: some form/pill markup stays duplicated.
- Task 20: Ruling: repair route arrival/title and filter-removal focus in existing shared owners; reset now closes any open popover and returns to Search/Filters — matches keyboard recovery expectation — cost if wrong: reopening Sort after reset takes another tap; ordering selection retained and regression adapted to reopen it.
- Task 20: Ruling: Small buttons and Select options now44px in shared primitives — final scan found defaults34px/30px despite per-consumer fixes — cost if wrong: compact untouched controls grow vertically; scrolling menus already bounded.
- Task 20: Ruling: bundled Lighthouse paint metrics are unavailable/zero-weight; use direct identical-throttle baseline/current comparison instead of claiming its100performance score — LCP2276->2384ms,CLS0both,one pair — cost if wrong: small load-time differences need repeated or hardware measurements; startup size budget passes.
