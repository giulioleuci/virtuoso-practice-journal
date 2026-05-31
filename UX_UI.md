# Virtuoso — UX/UI Design Report

**Scope:** Full audit of every page, modal/sheet, and navigation pattern in the app, with design recommendations tailored to the sole deployment target: a 6-inch Android smartphone at 2400×1080 resolution, portrait-only, touch-only input.

**Device profile:** 2400×1080 px at ~438 PPI (3× density) → **360 dp wide × 800 dp tall**. Aspect ratio 20:9. This is wider-density and significantly taller than the 16:9 phones (360×640 dp) common in older Material Design guidance. The extra vertical space is the single most important fact in this document — it relaxes many space-pressure problems while leaving horizontal constraints unchanged.

**Report structure:** Global → Navigation → Per-page/modal → New surfaces → Structural changes. Each recommendation includes: what it is, why it matters on this device, and its technical complexity.

---

## 0. Methodology & Constraints

### Device axioms applied throughout

| Constraint | Value | Design implication |
|---|---|---|
| Viewport width | 360 dp | No horizontal scrolling; no side-by-side layouts below ~160 dp each |
| Viewport height | 800 dp | Room for 12–14 compact list rows after nav bar and page header |
| Touch targets | 44 dp min / 48 dp preferred (Material 3) | Current `px-3 py-2` nav items and many card buttons are borderline |
| Thumb reach | ~75 mm from bottom edge | Bottom-center is easy; top corners require grip shift — put destructive actions there |
| Instrument context | User may have one hand on an instrument | UI must be operable one-handed; minimize reads mid-action |
| No hover | N/A — touch only | All hover-only affordances must be visible or behind tap-hold |
| Android back gesture | Handled via `useAndroidBackButton` | Must remain consistent across all Sheets and modals |
| Keyboard inset | Handled via `useKeyboardInset` | Sheets must scroll their own content when keyboard opens, not the page |
| Pixel density | 438 PPI / 3× density | 1 dp = 3 physical pixels; sub-12 px text is sharp but still cognitively small |

---

## 1. Global / Cross-Cutting

### 1.1 Typography scale — `text-[11px]` is too small

**Current state:** Nav labels use `text-[11px]`. Many secondary labels inside cards use `text-xs` (12 px). At 438 PPI these render sharply, but small text still demands more reading effort — especially when the user is glancing at the screen while holding an instrument.

**Recommendation:** Raise the minimum body text size to 13 px (`text-sm`). Reserve 12 px for truly supplemental metadata (e.g., a session timestamp inside an expanded card). Nav labels: at least 12 px.

**Complexity:** Low — Tailwind theme change + search-and-replace on `text-[11px]`.

**Impact:** High — legibility improvement across the whole app.

---

### 1.2 Touch target audit — interactive rows need min 48 dp height

**Current state:** Many list rows (task cards, library items, lesson cards) rely on natural content height (~36–40 px). Buttons inside cards (`px-3 py-1.5`) do not meet the 48 dp minimum.

**Recommendation:** Add `min-h-[48px]` to all tappable list rows and `min-h-[44px]` to all icon buttons. Create a shared `<TouchRow>` component with proper padding and an `active:bg-accent/50` press state.

**Complexity:** Medium — mechanical but systematic across `Diary.tsx`, `Library.tsx`, `Tasks.tsx`, `Lessons.tsx`.

**Impact:** High — reduces mis-taps during one-handed use.

---

### 1.3 Swipe-to-dismiss on all bottom Sheets

**Current state:** shadcn/ui Sheets support drag-to-close but the pill handle is small and not always rendered.

**Recommendation:** Always render a 32×4 dp pill handle at the top of every Sheet. Set snap points at 50 % and 92 % of screen height (≈ 400 dp and 736 dp on this device). At 800 dp tall, a 92 % sheet leaves the page header visible — providing strong spatial context. A 50 % snap is ideal for quick-action sheets (session quality, assignment decisions) that don't need the full screen.

**Complexity:** Medium — wrap shadcn Sheet with a `MobileSheet` component using `vaul` Drawer snap support.

**Impact:** High — snap points feel dramatically better at 800 dp because the half-open state is genuinely useful.

---

### 1.4 Empty-state CTAs must be full-width buttons

**Current state:** `EmptyState.tsx` renders a description and icon; callers add their own CTA. Small inline buttons are hard to tap.

**Recommendation:** Add a mandatory `action?: { label: string; onClick: () => void }` prop. Render it as a full-width primary button below the description.

**Complexity:** Low.

**Impact:** Medium — removes "I don't know what to do" confusion on first run.

---

### 1.5 Toast notifications — position above the nav bar

**Current state:** Sonner toasts appear at the bottom; the nav bar sits at the bottom. The two may overlap depending on z-index and `safe-area-inset-bottom`.

**Recommendation:** Set toast `offset` to `nav-height + safe-area-inset-bottom + 8px`. Destructive/undo toasts: `duration: 8000` (user may be looking at their instrument). Informational toasts: `duration: 4000`.

**Complexity:** Low — config change in `App.tsx`.

**Impact:** Medium — prevents visual overlap.

---

### 1.6 Haptic feedback for key actions

**Current state:** No haptic feedback.

**Recommendation:** Use `@capacitor/haptics`:
- Task complete: `HapticsImpactStyle.Medium`
- Session saved: `HapticsImpactStyle.Light`
- Delete confirmed: `HapticsNotificationType.Warning`
- Streak milestone: `HapticsNotificationType.Success`

**Complexity:** Low — install plugin, wrap in `haptic()` utility, call at 4–5 action sites.

**Impact:** High — confirms actions when the user is not looking at the screen.

---

### 1.7 Dark mode completeness

**Current state:** Tailwind CSS variables for theming; `dark:` variants may be partially applied.

**Recommendation:** Audit all `bg-*` and `text-*` classes for hard-coded light-only values (`bg-white`, `text-gray-900`). Set the Capacitor `StatusBar` color to match the theme. Drive the `dark` class on `<html>` from `window.matchMedia('(prefers-color-scheme: dark)')`.

**Complexity:** Medium — systematic audit; no structural changes.

**Impact:** High — musicians often practice in dim rooms at night; dark mode is not optional.

---

### 1.8 Pull-to-refresh as a confidence gesture

**Current state:** Dexie live queries update automatically, but after a background kill the Capacitor WebView may appear stale.

**Recommendation:** Add pull-to-refresh on the Diary and History pages. On pull, call `db.open()` to verify the connection and show a brief "Up to date" toast. No actual refetch is needed.

**Complexity:** Low–Medium — custom hook using `touchstart`/`touchmove`/`touchend` + a CSS spinner.

**Impact:** Low — reduces user anxiety after app resume.

---

## 2. Navigation (AppShell)

### 2.1 Bottom nav — take advantage of the tall screen

**Current state:** Each nav item is `min-w-[56px]` with `px-3 py-2`. At 360 dp with 5 items, each is ~62 dp wide — workable but tight.

**Recommendation:** Because the screen is 800 dp tall and the nav bar is at the very bottom, there is no pressure to shrink the bar. Increase the bar height to `py-3` and always show both icon and label. The extra 8 dp height gives the thumb a larger target without wasting screen space (800 dp is tall enough that losing 8 dp of content area is negligible).

**Complexity:** Low — CSS change in `AppShell.tsx`.

**Impact:** Low–Medium — more comfortable tapping; consistent with Material 3 nav bar specs.

---

### 2.2 Tasks is not in the bottom nav

**Current state:** Tasks is a full page but not a bottom nav item — accessible only via Diary links or direct URL.

**Recommendation:** Replace the `Profile` tab with a `Tasks` tab. Move Profile to a gear icon in the Diary page header (it is low-frequency). The 5 tabs become: Diary · Library · Tasks · Lessons · History.

**Complexity:** Low — change the `items` array in `AppShell.tsx`; add a header icon link to Profile in `Diary.tsx`.

**Impact:** High — tasks are created daily; hiding them is a discoverability failure.

---

### 2.3 History is low-frequency — remove from primary nav

**Current state:** History is a level-1 nav item. It is consulted perhaps weekly; Tasks is used daily.

**Recommendation:** (Follows from §2.2) Make History accessible from a "View history" button or chart icon in the Diary and Tasks page headers. Free its nav slot for Tasks.

**Complexity:** Low — nav array change + add a History link in two pages.

**Impact:** High — aligns the nav with actual usage frequency.

---

### 2.4 Page transitions

**Current state:** No page transition animations; content snaps in immediately.

**Recommendation:** Add a fade-up slide: new pages fade in from `translateY(8px)` to `translateY(0)` over 180 ms. Use React Router's `useLocation` key to trigger a CSS animation class. Respect `prefers-reduced-motion`.

**Complexity:** Medium — `<PageTransition>` wrapper in the Outlet.

**Impact:** Medium — makes navigation feel intentional and polished.

---

## 3. Diary Page (`/`)

The Diary page is the **most-used page in the app**. At 800 dp tall it can show significantly more content than on older 16:9 phones — this changes several priorities.

### 3.1 Hero quote — hidden by default

**Current state:** An inspirational quote occupies space at the top of the page. Defaults to visible.

**Recommendation:** Default `hideHeroQuote` to `true`. A musician opening the app to practice needs their task list immediately. Show the quote only on days when the task list is empty, as a motivational nudge.

**Complexity:** Low — flip a default in `Profile.tsx` and `db.ts` migration.

**Impact:** High — the first task card visible without any scroll is a meaningful improvement.

---

### 3.2 Streak display — a persistent header pill

**Current state:** The streak counter appears as a full horizontal section near the top of the Diary page.

**Recommendation:** Replace with a small pill badge (🔥 N days) in the top-right of the Diary page header. Tapping the pill navigates to History. At 800 dp tall the freed vertical space is less critical than on shorter screens, but the pill is still less visually noisy than a full section.

**Complexity:** Low — JSX restructure in `Diary.tsx`; no data changes.

**Impact:** Medium — cleaner header; motivation preserved.

---

### 3.3 Task cards — swipe-right to complete, swipe-left to skip

**Current state:** Task completion requires tapping a button. Skipping requires a "..." menu. Both are multi-tap flows.

**Recommendation:** Implement swipe gestures on task cards:
- Swipe right → Mark complete (green checkmark revealed behind card)
- Swipe left → Skip (yellow indicator)
- After completion, collapse the card with a 200 ms height animation before opening `SessionLogSheet`
- Haptic feedback at the gesture commit threshold (~40 % of card width)

Vertical scroll must always take priority over the swipe — only trigger horizontal gesture when the initial touch vector is predominantly horizontal.

**Complexity:** High — `<SwipeableRow>` component with touch event handling, threshold detection, spring animation, and service calls.

**Impact:** Very high — completing tasks is the core daily action; this is the single most impactful UX change.

---

### 3.4 Task cards — inline "Log" button

**Current state:** Logging a session requires tapping the card, finding the session log button, and opening `SessionLogSheet` — at least 2 taps.

**Recommendation:** Add a prominent "Log" button (circular play icon, 44 dp) directly on each incomplete task card. This opens `SessionLogSheet` pre-populated with the task. The main card tap area remains separate (expand for details / task options).

**Complexity:** Low — add a button to the task card JSX and thread the `SessionLogSheet` open state.

**Impact:** High — reduces the most frequent interaction from 2–3 taps to 1 tap.

---

### 3.5 Carryover tasks — separate visual band

**Current state:** Carryover tasks from previous days appear mixed in with today's tasks, differentiated only by a label.

**Recommendation:** Place carryovers in a clearly labeled collapsible section below today's tasks, with a subtle amber background tint and a label showing the originating date. Add a "Carry none" button to dismiss all at once.

At 800 dp tall, both sections fit on screen simultaneously for typical task loads, so the collapsible is mainly needed when carryovers are numerous.

**Complexity:** Medium — visual change only; data separation already exists.

**Impact:** Medium — reduces confusion between today's tasks and stale carryovers.

---

### 3.6 Accordion sections — default open

**Current state:** Study routines and upcoming lessons are inside Accordions that may default to collapsed.

**Recommendation:** Default all Diary accordions to open. At 800 dp, the user can see today's tasks AND the study routine section without scrolling in most cases. Save the collapsed state in `localStorage` only if the user explicitly collapses a section.

**Complexity:** Low — change `defaultValue` on the Accordion component.

**Impact:** Medium — "I forgot I had a lesson today" is now much less likely.

---

### 3.7 Practice Mode — full-screen overlay with screen wake lock

**Current state:** `PracticeMode.tsx` likely renders as an in-page section or sheet.

**Recommendation:** Make Practice Mode a full-screen modal (`position: fixed; inset: 0`) with:
- Large task title (Cormorant Garamond, centered, ~32 px)
- A simple stopwatch/timer
- One large "Done — Log Session" button at the bottom (full-width, 64 dp tall)
- One "Exit" button top-left
- `navigator.wakeLock.request('screen')` to prevent screen sleep
- Portrait lock via Capacitor `ScreenOrientation`

**Complexity:** Medium — restructure `PracticeMode.tsx`; add WakeLock call.

**Impact:** High — a practicing musician must not see the nav bar or other tasks.

---

### 3.8 Pending assignments — replace section with a notification chip

**Current state:** Pending assignments appear as a section on the Diary page, pushing tasks further down.

**Recommendation:** Replace with a chip near the top of the page: "N assignments to review →" — tapping navigates to `/lessons/assignments` (or opens the Assignments Sheet from §7.1). At 800 dp tall this frees space without hiding the information.

**Complexity:** Low — remove the section; add a chip. `pendingCount` is already computed.

**Impact:** Medium — keeps Diary focused on today's tasks.

---

### 3.9 Session FAB — position above the nav bar

**Current state:** `SessionFAB.tsx` is at the bottom. The nav bar is also at the bottom. On 800 dp this overlap is less likely to cause layout issues, but z-index must still be correct.

**Recommendation:** Position the FAB at `bottom: calc(nav-height + safe-area-inset-bottom + 16px)`. Keep it visible when the nav is hidden during scroll. Give it a unique z-index layer.

**Complexity:** Low — CSS positioning + z-index change.

**Impact:** High — a hidden FAB means users cannot log sessions.

---

## 4. Library Page (`/library`)

### 4.1 Kind tabs — horizontally scrollable tab row

**Current state:** 4 kind tabs at equal width. At 360 dp, each is ~86 dp — workable but labels may truncate.

**Recommendation:** Use a `ScrollArea` horizontal tab bar with `overflow-x: auto; scroll-snap-type: x mandatory`. Each tab takes its natural text width plus padding. Active tab is underlined (not filled). A shadow on the right edge signals off-screen tabs.

**Complexity:** Low — replace the tab bar JSX.

**Impact:** Low–Medium — prevents truncation; cleaner look.

---

### 4.2 Search + filter — full-width search input, single "Filter" button

**Current state:** Likely shows a search input, subject filter, sort dropdown, and group-by toggle — 3–4 rows of controls.

**Recommendation:**
- Full-width search input (always visible)
- A single "Filter" button with a badge showing active filter count, opening a bottom Sheet with subject filter, sort order, and group-by toggle

**Complexity:** Low–Medium — add a filter Sheet; move 3 controls into it.

**Impact:** High — frees ~80–100 dp for the item list. At 800 dp tall the list below can show 10+ items unobstructed.

---

### 4.3 Library item cards — compact list rows

**Current state:** Tall rich cards likely show only 2–3 items simultaneously.

**Recommendation:** Compact list row at 56 dp height:
- Left: colored subject border (2 dp) + kind icon
- Center: item title (1 line, truncated) + composer/status in smaller text
- Right: BPM sparkline (40×20 dp) + overflow menu (···)

Tap the row to expand inline: shows full mastery sparkline and segment list. Accordion — only one row expanded at a time.

At 800 dp tall, 10–12 compact rows are visible simultaneously after search + filter controls.

**Complexity:** Medium — refactoring `Library.tsx` card rendering; sparklines must shrink to spec.

**Impact:** High — 4× more items visible on screen; critical for libraries with 20+ pieces.

---

### 4.4 Item Analysis — convert to a full-height Sheet

**Current state:** `ItemAnalysisPage` is a full page (`/library/item/:id/analysis`).

**Recommendation:** Convert to a full-height bottom Sheet opened from the overflow menu. Charts lazy-load when the Sheet opens. Deep links to the analysis route still work by opening the Library page with the Sheet pre-opened. At 800 dp, a 92 % Sheet gives 736 dp for charts — enough for meaningful visualization.

**Complexity:** Medium — `ItemAnalysisSheet` already exists; change is removing the route and routing navigation to the Sheet.

**Impact:** Medium — no page transition; list context is preserved behind the Sheet.

---

### 4.5 "Add item" — FAB instead of header button

**Current state:** The add button is likely in the page header, disappearing on scroll.

**Recommendation:** FAB at `bottom: nav-height + 16px`, always visible. Consistent with the Diary page pattern.

**Complexity:** Low.

**Impact:** Low–Medium — removes scroll-to-top to add.

---

## 5. Collections Page (`/library/collections`)

### 5.1 Merge Collections into Library as a view toggle

**Current state:** Collections is a separate route reachable from Library. Navigating between them is 2 taps.

**Recommendation:** Add an "Items / Collections" segmented control at the top of the Library page. The 4 kind tabs persist across both views. This eliminates the separate Collections route. At 800 dp, the segmented control takes ~40 dp; the list below still has ample room.

**Complexity:** Medium — merge `Collections.tsx` JSX into `Library.tsx`; replace route with state. `NewCollectionSheet` and `AssignPiecesSheet` remain unchanged.

**Impact:** High — removes a navigation level.

---

### 5.2 AssignPiecesSheet — up/down buttons instead of drag-reorder

**Current state:** Drag-reorder is notoriously unreliable in mobile WebViews.

**Recommendation:** Replace drag-reorder with explicit up/down arrow buttons on each selected row. Long-press to enter reorder mode. Keep drag-reorder only for potential tablet breakpoints.

**Complexity:** Medium — conditional rendering; arrow swap logic.

**Impact:** Medium — prevents drag-vs-scroll conflicts.

---

## 6. Lessons Page (`/lessons`)

### 6.1 Lesson history — infinite scroll with sticky date dividers

**Current state:** Pagination with `Pager` (prev/next buttons).

**Recommendation:** Replace with infinite scroll (load 10 more via `IntersectionObserver`) with sticky date dividers ("May 2026", "April 2026"). At 800 dp, more history is visible per viewport, making natural scroll even more appropriate than pagination.

**Complexity:** Medium — replace `Pager` with intersection observer hook; add sticky dividers.

**Impact:** Medium — natural mobile pattern vs. tap-to-page.

---

### 6.2 RecurrenceSheet — 2-step form

**Current state:** All recurrence fields in a single scrolling form.

**Recommendation:** 2-step Sheet:
1. Subject + teacher name + color
2. Schedule (frequency, day(s), time)

Progress indicator (2 dots at top). "Next" / "Back" navigation.

**Complexity:** Low–Medium — add step state; wrap fields in conditional renders.

**Impact:** Medium — reduces form abandonment.

---

### 6.3 LessonLogSheet — chip picker for pieces played

**Current state:** Multi-select dropdown for pieces played — cramped on 360 dp.

**Recommendation:** Replace with a bottom Sheet search-and-chip UI:
- Search input filters library items
- Tapping an item adds it as a chip above the input
- Chips wrap and are scrollable; each has an × to remove

At 800 dp, a half-open sheet (400 dp) gives plenty of room for the chip row + search + results list.

**Complexity:** Medium — custom `SearchableChipPicker`; reusable in `AssignPiecesSheet`.

**Impact:** High — logging a lesson with 5 pieces should take ~10 seconds.

---

## 7. Assignments Page (`/lessons/assignments`)

### 7.1 Convert Assignments to a Sheet

**Current state:** Assignments is a full page.

**Recommendation:** Convert to a bottom Sheet opened from a Lessons page "Pending assignments" button (or the Diary chip from §3.8). Tapping an assignment opens `NewTaskPage` with prefill. Redirect `/lessons/assignments` to Lessons with the Sheet pre-opened.

**Complexity:** Low–Medium — convert `Assignments.tsx` to a Sheet component; update router.

**Impact:** Medium — removes a navigation level.

---

### 7.2 Assignment rows — swipe gestures

**Current state:** "Create task" and "Ignore" buttons on each card.

**Recommendation:** Reuse `SwipeableRow` from §3.3:
- Swipe right → Create task (navigates to NewTaskPage with prefill)
- Swipe left → Ignore (with undo toast)

**Complexity:** High — reuse of the same `SwipeableRow` component.

**Impact:** Medium — faster assignment triage.

---

## 8. History Page (`/history`)

### 8.1 Filter controls — horizontal scrollable pill row

**Current state:** Grouping, sorting, subject filter, and date range controls occupy the top of the page.

**Recommendation:** Horizontally scrollable row of filter pills below the page title. Active filters are highlighted. Tapping a pill opens a small sheet with that filter's options. Tapping × on a pill removes it. At 800 dp, the list below the pill row still shows 10+ sessions.

**Complexity:** Low–Medium — refactor the filter bar JSX.

**Impact:** High — frees content area; makes active filters visible at a glance.

---

### 8.2 Charts — horizontally scrollable with minimum 600 dp width

**Current state:** Charts render at full width. At 360 dp, 30 sessions compress data points to ~10 dp spacing — unreadable.

**Recommendation:** Render charts with `min-width: 600dp` inside a horizontal `ScrollArea`. Visible viewport = 360 dp; user scrolls to see older data. Add pinch-to-zoom via a zoom state variable that scales the chart's x-axis `domain`.

At 800 dp tall, the chart area can be taller (200–250 dp) without crowding other content.

**Complexity:** High — charting library must support controlled viewport (Recharts or Victory). Pinch-to-zoom requires a custom gesture handler.

**Impact:** High — unreadable charts are useless.

---

### 8.3 SessionDetailSheet — snap points

**Current state:** `SessionDetailSheet` opens as a modal Sheet.

**Recommendation:** Use `MobileSheet` (§1.3) with:
- 50 % snap (400 dp): date, quality, BPM, notes
- 92 % snap (736 dp): full detail — layers, techniques, segment metrics

The user drags up to see more; no separate "expand" button needed.

**Complexity:** Low — snap point configuration on the Sheet.

**Impact:** Medium — progressive disclosure; advanced data is accessible but not forced.

---

### 8.4 Session list — infinite scroll

**Current state:** `Pager` pagination.

**Recommendation:** Same as §6.1 — infinite scroll + sticky date dividers.

**Complexity:** Medium.

**Impact:** Medium.

---

## 9. Tasks Page (`/tasks`)

### 9.1 Rename tabs to plain language

**Current state:** Tabs labelled "Occurrences" and "Series" — technical terms a musician may not understand.

**Recommendation:**
- "Occurrences" → "Tasks" (with today's date shown prominently)
- "Series" → "Recurring"

**Complexity:** Low — i18n key change + default tab state.

**Impact:** Low–Medium — reduces cognitive friction.

---

### 9.2 Share `<TaskCard>` between Diary and Tasks

**Current state:** Diary and Tasks likely have different card implementations.

**Recommendation:** Extract a single shared `<TaskCard>` component used in both pages, with the swipe-to-complete/skip gesture (§3.3) applied in both contexts.

**Complexity:** Medium — extract + consolidate.

**Impact:** Medium — consistency; eliminates code duplication.

---

### 9.3 Calendar view — 7-day date strip instead of a full monthly grid

**Current state:** `TaskCalendarView.tsx` renders a full monthly grid. At 360 dp, each day cell is ~47×35 dp — below the 44 dp touch minimum. Task dots inside cells are tiny.

**Recommendation:** Replace with a horizontal date strip (7-day window centered on today) at the top of the Tasks page:
- Each day: 44×60 dp pill showing the day number + a dot for tasks
- Swiping the strip advances by 7 days
- Tapping a day filters the task list below

At 800 dp tall, the strip (60 dp) + list header (40 dp) + 8–10 task rows fit comfortably on one screen.

**Complexity:** Medium — new `DateStrip` component; connect date selection to task filter.

**Impact:** High — the full-grid calendar is unusable at 360 dp width.

---

### 9.4 Remove bulk delete; use swipe-to-delete + undo

**Current state:** Bulk delete requires entering selection mode and confirming.

**Recommendation:** Remove bulk delete. Use:
- Swipe-to-delete (left swipe past skip threshold) with 5-second undo toast
- "Delete all completed" in a ··· header menu for power users

**Complexity:** Low–Medium.

**Impact:** Low — bulk delete is rarely needed.

---

## 10. NewTaskPage and EditTaskPage

### 10.1 Convert NewTaskPage to a multi-step bottom Sheet

**Current state:** Task creation is a full page navigation — the user loses context (which day, which library item) during creation.

**Recommendation:** Multi-step Sheet:
1. **Step 1:** Task name + link type (free / item / collection) — most users stop here
2. **Step 2:** Date, subject, recurrence — shown only via "More options"
3. **Step 3:** BPM, layers, techniques, notes — shown only via "Advanced"

The `TaskWizard` and `StudyRoutineWizard` remain as separate full-page flows via a "Use wizard" button on Step 1.

Keep routes `/tasks/new` and `/tasks/edit/:id` — they open the Sheet overlay on whatever page the user was on.

At 800 dp, a 92 % Sheet gives 736 dp — enough for all three steps without internal scrolling on most task types.

**Complexity:** High — significant refactor of `NewTaskPage.tsx` and `EditTaskPage.tsx`. Form validation and submission logic unchanged; only container and step logic changes. `LinkTargetFields` and `RecurrenceFields` fit naturally into steps.

**Impact:** Very high — daily action; reducing it from a full-page context switch to a 1-step sheet dramatically improves flow.

---

### 10.2 Link type selector — large tappable cards

**Current state:** Link type (free / item / collection) is likely a `Select` dropdown.

**Recommendation:** Three full-width tappable cards (~72 dp tall each):
- **Free-form** — icon + "No specific piece"
- **Piece / Segment** — icon + "From my library"
- **Collection** — icon + "From a collection"

Selected card gets a primary-colored border.

**Complexity:** Low — replace Select with custom card radio group.

**Impact:** Medium — faster selection; clearer affordance.

---

### 10.3 Recurrence builder — day-of-week pill buttons

**Current state:** Checkboxes or a dropdown for day-of-week selection.

**Recommendation:** A row of 7 circular day pills (M T W T F S S), each 40×40 dp. Multiple pills can be active for multi-day recurrence.

**Complexity:** Low — custom `DayPicker` component.

**Impact:** Medium — faster and more visual than checkboxes.

---

## 11. SessionLogSheet

### 11.1 Quality selector — 2×2 grid of large buttons

**Current state:** A segmented control at full width with 4 options (~86 dp each) — tight and small targets.

**Recommendation:** 2×2 grid of large buttons (≈160 dp wide × 64 dp tall each):
- 😤 Hard
- 📈 Improve
- ✅ Well
- 🌟 Great

Selected state: solid background. At 360 dp wide, two columns of 160 dp each fit with standard gutters.

**Complexity:** Low — replace control with a 2×2 button grid.

**Impact:** Very high — quality rating is the most important field; must be fast and large.

---

### 11.2 BPM input — stepper buttons, keyboard entry secondary

**Current state:** `<Input type="number">` — opens the numpad, covering ~50 % of the screen.

**Recommendation:** Custom `BpmStepper`:
- Large BPM display (Cormorant Garamond, 48 px, centered)
- `−5` and `−1` on the left; `+1` and `+5` on the right (each button 48×48 dp)
- A smaller text input below for direct keyboard entry (less prominent)
- Pre-populated from `BpmSuggestion`

At 360 dp, the stepper row with 4 buttons + display fits without crowding.

**Complexity:** Medium — custom component; replaces `BpmCoupler` pattern.

**Impact:** High — BPM entry is frequent; eliminates keyboard-cover problem.

---

### 11.3 Session log form — 3 fields by default

**Current state:** The Sheet likely shows 7+ fields: BPM, note value, reps, confidence, quality, notes, layers, techniques, per-segment metrics.

**Recommendation:** Show only:
1. Quality (2×2 grid, §11.1)
2. BPM (stepper, §11.2)
3. Notes (1-line textarea)

All other fields behind a `<Collapsible>` "More fields" trigger. Granular segment mode behind its existing toggle.

At 800 dp tall, a 50 % snap sheet (400 dp) comfortably holds the 3-field form. The user only needs to swipe up or tap "More fields" for advanced data.

**Complexity:** Low — wrap existing fields in a `<Collapsible>`.

**Impact:** Very high — a quick session log should take 5 seconds.

---

### 11.4 Granular segment mode — horizontal carousel

**Current state:** Multiple sets of quality/BPM/reps stacked vertically — a very long scrolling form for pieces with 3+ movements.

**Recommendation:** Horizontal segment carousel:
- One segment visible at a time (title + quality + BPM)
- "Next segment →" button advances
- Progress dots (●●○○) show position
- "Done" on the last segment submits the whole session

At 800 dp, the carousel card can be taller (~300 dp) without crowding.

**Complexity:** High — carousel/step state managing per-segment data; replaces flat `segMetrics` state.

**Impact:** High — granular multi-movement logging is currently unusable for pieces with 3+ movements.

---

## 12. NewLibraryItemSheet

### 12.1 Split into 3 steps

**Current state:** All fields in one scrolling sheet — 8+ fields for a repertoire item.

**Recommendation:** 3-step Sheet:
1. Kind selector (4 large cards) + title + subject
2. Kind-specific fields (BPM/composer for repertoire; mastery sliders for theory; etc.)
3. Segments editor — only shown for repertoire/manual if the user taps "Add movements/sections"

`LibraryItemKindFields`, `MasterySliders`, and `BpmCoupler` already exist as subcomponents — step 2 is a reorganization, not a rewrite.

**Complexity:** Medium — add step state; reorganize existing field components.

**Impact:** High — adding a piece should feel quick, not overwhelming.

---

### 12.2 SegmentsEditor — accordion rows

**Current state:** Segments listed as a table with per-row fields for label, targetBpm, noteVal, techniques — table layout does not fit 360 dp.

**Recommendation:** Each segment is a collapsed accordion row showing only its label. Expanding reveals BPM, note value, and technique chips. "+" at the bottom adds a segment. Left swipe reveals delete.

**Complexity:** Low–Medium — replace flat list with shadcn/ui Accordion.

**Impact:** Medium — current layout likely overflows horizontally.

---

## 13. Profile Page (`/profile`)

### 13.1 Move Profile out of the bottom nav

See §2.2. Profile is low-frequency and should not occupy a prime nav slot.

---

### 13.2 SubjectsEditor — open in a full-height Sheet

**Current state:** Inline card in the Profile page. Cramped for users with 4+ subjects.

**Recommendation:** Open the subjects editor via a full-height Sheet (or modal page) accessed by an "Edit" button. At 800 dp, a 92 % Sheet gives 736 dp — plenty of room to list and add subjects without scrolling.

**Complexity:** Low — wrap existing component in a Sheet.

**Impact:** Low–Medium.

---

### 13.3 Backup / restore — native Android share sheet

**Current state:** Export produces a JSON file navigated through the Android file picker.

**Recommendation:** After export, trigger the Android native share sheet (`@capacitor/share`) immediately. The user can share to Google Drive, email, or WhatsApp with one tap.

**Complexity:** Low — install plugin; call `Share.share({ files: [fileUri] })` after export.

**Impact:** Medium — backup is useless if it is hard to complete.

---

### 13.4 Reminder settings — time picker wheel

**Current state:** `<Input type="time">` — Android's system time input is functional but not touch-optimized.

**Recommendation:** A time picker Sheet with an iOS-style wheel (e.g., `react-mobile-picker` or CSS 3D transform scroll). Use `@capacitor/local-notifications` for the actual reminder scheduling. Keep `type="time"` as a non-JS fallback.

**Complexity:** Medium — conditional rendering of native vs web picker; LocalNotifications integration.

**Impact:** Medium — reminder setup is done once; mobile-native wheel is significantly more comfortable.

---

## 14. Study Routine Wizard

### 14.1 Matrix editor — replace with per-day configuration

**Current state:** A matrix (groups × days of week × item count). A 4×7 grid at 360 dp gives ~36 dp per cell — below the 44 dp touch minimum.

**Recommendation:** Per-day configuration flow:
- Horizontal day strip (M T W T F S S), each 44×44 dp pill
- Selecting a day shows a list of groups, each with a `+`/`-` stepper for item count
- "Copy from Mon" shortcut bulk-applies one day's config to selected days

The data model (`matrix: Record<dayOfWeek, Record<groupId, itemCount>>`) is unchanged; only the editing UI changes. At 800 dp tall, the day strip + 3–4 groups with steppers fit on one screen without scrolling.

**Complexity:** High — complete redesign of the matrix editor section of `StudyRoutineWizard`.

**Impact:** High — the study routine feature is inaccessible on mobile in its current form.

---

### 14.2 EditStudyRoutinePage — convert to a full-height Sheet

**Current state:** Full page navigation.

**Recommendation:** Full-height Sheet (92 % = 736 dp) opened from the Diary study routine section or the Tasks page. Route `/tasks/routines/edit/:id` remains but renders the Sheet overlay on the Tasks page.

**Complexity:** Low–Medium.

**Impact:** Low–Medium — fewer navigation levels.

---

## 15. Onboarding

### 15.1 IntroSlides — "Skip" always visible and large

**Current state:** Skip button location and size unknown.

**Recommendation:** Always show a large "Skip" button (bottom-right, ≥44 dp) from slide 1. Add a "tap anywhere to advance" affordance.

**Complexity:** Low.

**Impact:** Medium — reduces first-run friction.

---

### 15.2 Subject creation — preset instrument cards

**Current state:** Subject creation via typed name + dropdown type selector.

**Recommendation:** Large tappable cards with instrument icons: Piano 🎹 · Guitar 🎸 · Violin 🎻 · Voice 🎤 · Theory 📖 · Composition ✍️ · Custom. The user selects one or more; Custom allows typing. At 360 dp, a 2-column grid of 160 dp wide cards fits cleanly.

**Complexity:** Low–Medium — add preset data; replace text form with card grid.

**Impact:** High — first-run experience directly determines whether the user continues.

---

## 16. Structural Changes Summary

### 16.1 Pages to convert to Sheets

| Current Page | Proposed Surface | Rationale |
|---|---|---|
| `ItemAnalysisPage` | Full-height Sheet (92 %, from Library) | Chart detail is contextual; at 800 dp 736 dp is enough |
| `Assignments` (`/lessons/assignments`) | Sheet (from Lessons or Diary) | A list of pending items, not a destination |
| `EditStudyRoutinePage` | Full-height Sheet (from Tasks or Diary) | Configuration action |
| `NewTaskPage` / `EditTaskPage` | Multi-step Sheet (routes remain for deep links) | Daily action; context must be preserved |

### 16.2 New surfaces to add

| Surface | Type | Purpose |
|---|---|---|
| **Quick Log Sheet** | Bottom Sheet (50 % snap) | Log a free-form session from the Diary FAB without a task — quality + optional BPM + note; for unplanned practice |
| **Streak/Stats Overlay** | Full-screen Sheet | Tapping the streak pill: longest streak, total estimated hours, all-time quality distribution, best BPM records |
| **Practice Timer Screen** | Full-screen overlay | §3.7 — screen wake lock, large task title, one-tap log |
| **Global Search** (`/search`) | Full page | Search across library, tasks, lessons, sessions; accessed via magnifying glass in Diary header |
| **Day Review Sheet** | Bottom Sheet | End-of-day checklist of incomplete tasks with one-tap log buttons; triggered by notification or FAB state |

### 16.3 Pages to merge

| Pages | Merged Into | Rationale |
|---|---|---|
| `Library` + `Collections` | `Library` (view toggle) | Same catalog; separation doubles navigation depth |
| `History` (primary nav) | Accessible from Diary + Tasks header | Analytical page; follows naturally from task/session context |

---

## 17. Priority Matrix

| # | Recommendation | Priority | Complexity | Impact |
|---|---|---|---|---|
| 3.3 | Swipe-to-complete tasks | P1 | High | Very High |
| 11.1 | Quality selector 2×2 grid | P1 | Low | Very High |
| 11.3 | Session log: 3 fields by default | P1 | Low | Very High |
| 10.1 | NewTaskPage as multi-step Sheet | P1 | High | Very High |
| 3.4 | Inline "Log" button on task cards | P1 | Low | High |
| 3.7 | Practice Mode full-screen overlay | P1 | Medium | High |
| 1.7 | Dark mode completeness | P1 | Medium | High |
| 14.1 | Study routine matrix → per-day flow | P1 | High | High |
| 2.2 | Add Tasks to bottom nav; remove Profile | P2 | Low | High |
| 3.1 | Hero quote hidden by default | P2 | Low | High |
| 4.2 | Library filter collapsed to one row | P2 | Medium | High |
| 4.3 | Library compact list rows | P2 | Medium | High |
| 8.2 | Charts horizontally scrollable | P2 | High | High |
| 9.3 | Calendar → 7-day date strip | P2 | Medium | High |
| 11.2 | BPM stepper input | P2 | Medium | High |
| 11.4 | Granular segment carousel | P2 | High | High |
| 12.1 | NewLibraryItemSheet multi-step | P2 | Medium | High |
| 1.2 | Touch target audit (min 48 dp) | P2 | Medium | High |
| 1.3 | Sheet pill handle + snap points | P2 | Medium | High |
| 5.1 | Merge Collections into Library | P3 | Medium | High |
| 3.9 | FAB above nav bar | P3 | Low | High |
| 6.3 | Lesson pieces chip picker | P3 | Medium | High |
| 15.2 | Onboarding preset instrument cards | P3 | Medium | High |
| 4.4 | ItemAnalysis as Sheet | P3 | Medium | Medium |
| 3.5 | Carryover tasks separate band | P3 | Low | Medium |
| 3.2 | Streak as header pill | P3 | Low | Medium |
| 6.1 | Lessons infinite scroll | P3 | Medium | Medium |
| 6.2 | RecurrenceSheet 2-step | P3 | Low | Medium |
| 7.1 | Assignments as Sheet | P3 | Medium | Medium |
| 8.1 | History filter pill row | P3 | Medium | Medium |
| 1.6 | Haptic feedback | P3 | Low | High |
| 13.3 | Backup → native share sheet | P3 | Low | Medium |
| 10.2 | Link type as tappable cards | P3 | Low | Medium |
| 10.3 | Day-of-week pill buttons | P3 | Low | Medium |
| 12.2 | SegmentsEditor as accordion | P3 | Low | Medium |
| 16.2 | New: Global Search page | P3 | High | High |
| 16.2 | New: Quick Log Sheet | P3 | Medium | Medium |
| 2.4 | Page transitions | P4 | Medium | Medium |
| 1.1 | Minimum font size 13 px | P4 | Low | High |
| 3.6 | Accordions default open | P4 | Low | Medium |
| 3.8 | Pending assignments → chip | P4 | Low | Medium |
| 4.1 | Kind tabs as scroll row | P4 | Low | Low |
| 4.5 | Library add → FAB | P4 | Low | Medium |
| 8.3 | SessionDetailSheet snap points | P4 | Low | Medium |
| 9.1 | Rename tabs | P4 | Low | Low |
| 9.2 | Share TaskCard between Diary & Tasks | P4 | Medium | Medium |
| 9.4 | Remove bulk delete | P4 | Low | Low |
| 13.2 | SubjectsEditor in Sheet | P4 | Low | Low |
| 13.4 | Time picker wheel | P4 | Medium | Low |
| 14.2 | EditStudyRoutinePage → Sheet | P4 | Low | Low |
| 15.1 | IntroSlides skip always visible | P4 | Low | Low |
| 1.4 | EmptyState full-width CTA | P4 | Low | Medium |
| 1.5 | Toast above nav | P4 | Low | Medium |
| 1.8 | Pull-to-refresh | P4 | Medium | Low |
| 2.1 | Nav bar height increase | P4 | Low | Medium |
| 7.2 | Assignments swipe gestures | P4 | High | Medium |
| 8.4 | History infinite scroll | P4 | Medium | Medium |

---

## 18. Implementation Order

**Phase 1 — Core daily flow (1–2 weeks):**
- §11.1 Quality selector 2×2 grid
- §11.3 Session log 3 fields by default
- §3.4 Inline "Log" button on task cards
- §3.1 Hide hero quote by default
- §1.7 Dark mode audit
- §1.5 Toast above nav
- §3.9 FAB position fix

**Phase 2 — Navigation and structure (1–2 weeks):**
- §2.2 Tasks in bottom nav, Profile out
- §3.3 Swipe-to-complete tasks (build `SwipeableRow`)
- §1.3 Sheet pill handle + snap points
- §1.2 Touch target pass
- §10.2 Link type cards
- §10.3 Day-of-week pills
- §3.5 Carryover tasks separate band

**Phase 3 — Forms and editors (2–3 weeks):**
- §10.1 NewTaskPage as multi-step Sheet
- §11.2 BPM stepper
- §11.4 Granular segment carousel
- §12.1 NewLibraryItemSheet multi-step
- §12.2 SegmentsEditor accordion
- §6.3 Lesson pieces chip picker
- §6.2 RecurrenceSheet 2-step

**Phase 4 — Browse and analysis (1–2 weeks):**
- §4.2 Library filter row collapse
- §4.3 Library compact list
- §5.1 Merge Collections into Library
- §9.3 Date strip instead of calendar grid
- §8.2 Horizontally scrollable charts
- §8.1 History filter pill row
- §4.4 ItemAnalysis as Sheet

**Phase 5 — Polish and new features (ongoing):**
- §1.6 Haptic feedback
- §3.7 Practice Mode full-screen
- §14.1 Study routine matrix redesign
- §13.3 Native share for backup
- §16.2 Global Search page
- §2.4 Page transitions
- §15.2 Onboarding presets
